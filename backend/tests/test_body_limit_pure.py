"""BodyLimit: refuse oversized bodies before reading them; never buffer beyond the limit."""

import asyncio
import json
from typing import Annotated
from uuid import uuid4

from fastapi import FastAPI, File, UploadFile
from fastapi.testclient import TestClient

from orderfit.api.main import (
    SMALL_BODY_LIMIT,
    UPLOAD_BODY_LIMIT,
    BodyLimit,
    UploadGate,
    authorize_upload,
)

UPLOAD = f"/api/v1/businesses/{uuid4()}/deals/{uuid4()}/documents"
MIB = 1048576


async def allow(scope):
    return True


async def deny(scope):
    return False


def call(path, headers, chunks, method="POST", *, authorize=allow, gate=None, client=("203.0.113.9", 1)):
    """Drive the middleware directly; returns (sent messages, receive calls, app reached)."""
    state = {"receives": 0, "reached": False}
    sent = []

    async def app(scope, receive, send):
        state["reached"] = True
        while True:
            message = await receive()
            if message["type"] == "http.disconnect" or not message.get("more_body"):
                break
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    pending = list(chunks)

    async def receive():
        state["receives"] += 1
        body = pending.pop(0) if pending else b""
        return {"type": "http.request", "body": body, "more_body": bool(pending)}

    async def send(message):
        sent.append(message)

    scope = {"type": "http", "method": method, "path": path, "client": client,
             "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()]}
    limiter = BodyLimit(app, authorize=authorize, gate=gate or UploadGate(4, 2))
    asyncio.run(limiter(scope, receive, send))
    return sent, state["receives"], state["reached"]


def status(sent):
    return next(m["status"] for m in sent if m["type"] == "http.response.start")


def test_declared_oversize_without_cookie_refused_before_reading():
    for path in (UPLOAD, "/api/v1/auth/signin"):
        sent, receives, reached = call(path, {"content-length": str(2 * MIB)}, [b"x" * MIB] * 2)
        assert status(sent) == 413 and receives == 0 and not reached
        body = json.loads(b"".join(m.get("body", b"") for m in sent if m["type"] == "http.response.body"))
        assert body["error"]["code"] == "REQUEST_TOO_LARGE"


def test_large_limit_requires_upload_path_session_cookie_and_verified_authorization():
    cookie = {"cookie": "orderfit_csrf=a; orderfit_session=opaque", "content-length": str(2 * MIB)}
    sent, _, reached = call(UPLOAD, cookie, [b"x" * MIB] * 2)
    assert status(sent) == 200 and reached
    # A cookie that does not verify (any value, wrong tenant, missing deal) keeps 1 MiB.
    sent, receives, reached = call(UPLOAD, cookie, [b"x" * MIB] * 2, authorize=deny)
    assert status(sent) == 413 and receives == 0 and not reached
    # Without a started app (no database in scope) the default authorizer refuses.
    sent, receives, reached = call(UPLOAD, cookie, [b"x" * MIB] * 2, authorize=authorize_upload)
    assert status(sent) == 413 and receives == 0 and not reached
    # Same size elsewhere, an empty cookie value, or a non-upload method stays at 1 MiB.
    for path, headers, method in (
        ("/api/v1/auth/signin", cookie, "POST"),
        (UPLOAD, {"cookie": "orderfit_session=", "content-length": str(2 * MIB)}, "POST"),
        (UPLOAD, cookie, "PATCH"),
    ):
        sent, receives, reached = call(path, headers, [b"x" * MIB] * 2, method)
        assert status(sent) == 413 and receives == 0 and not reached
    over = {"cookie": "orderfit_session=opaque", "content-length": str(UPLOAD_BODY_LIMIT + 1)}
    sent, receives, _ = call(UPLOAD, over, [b"x"])
    assert status(sent) == 413 and receives == 0


def test_chunked_body_cut_off_at_limit_and_app_response_replaced():
    chunk = b"x" * (256 * 1024)
    sent, receives, reached = call("/api/v1/auth/signin", {}, [chunk] * 40)  # 10 MiB streamed
    assert reached and status(sent) == 413
    assert receives == SMALL_BODY_LIMIT // len(chunk) + 1  # stopped at the first chunk over 1 MiB
    assert [m["status"] for m in sent if m["type"] == "http.response.start"] == [413]
    # An understated Content-Length is enforced by the running count too.
    sent, receives, _ = call("/api/v1/auth/signin", {"content-length": "10"}, [chunk] * 40)
    assert status(sent) == 413 and receives == 5


def test_small_bodies_pass_through_unchanged():
    sent, receives, reached = call("/api/v1/auth/signin", {"content-length": "2"}, [b"{}"])
    assert status(sent) == 200 and reached and receives == 1


def test_real_app_upload_parsing_is_cut_off():
    app = FastAPI()

    @app.post("/api/v1/businesses/{b}/deals/{d}/documents")
    def upload(file: Annotated[UploadFile, File()]):
        return {"size": len(file.file.read())}

    @app.post("/echo")
    def echo(data: dict):
        return data

    verified = {"opaque-verified"}

    async def authorize(scope):
        cookie = dict(scope["headers"]).get(b"cookie", b"")
        return any(("orderfit_session=" + v).encode() in cookie for v in verified)

    app.add_middleware(BodyLimit, authorize=authorize, gate=UploadGate(4, 2))
    with TestClient(app) as client:
        assert client.post("/echo", json={"a": 1}).json() == {"a": 1}
        assert client.post("/echo", content=b"x" * (MIB + 1)).status_code == 413
        files = {"file": ("a.txt", b"x" * (2 * MIB), "text/plain")}
        assert client.post(UPLOAD, files=files).status_code == 413  # no session cookie
        client.cookies.set("orderfit_session", "opaque")  # present but not verified
        assert client.post(UPLOAD, files=files).status_code == 413
        client.cookies.set("orderfit_session", "opaque-verified")
        assert client.post(UPLOAD, files=files).json() == {"size": 2 * MIB}


def test_upload_gate_bounds_process_and_source_concurrency_before_reading():
    gate = UploadGate(total=3, per_source=2)
    assert gate.try_acquire("a") and gate.try_acquire("a")
    assert not gate.try_acquire("a")  # per-source cap
    assert gate.try_acquire("b")
    assert not gate.try_acquire("c")  # process cap
    gate.release("a")
    assert gate.try_acquire("c") and gate.active == 3
    for source in ("a", "b", "c"):
        gate.release(source)
    assert gate.active == 0 and gate.by_source == {}

    # Authorization runs first (an unauthorized request never takes a slot); a full gate then
    # answers 429 before any body byte is read.
    calls = []

    async def counting(scope):
        calls.append(scope["path"])
        return "user-1"

    full = UploadGate(total=1, per_source=1)
    assert full.try_acquire("user:other")
    cookie = {"cookie": "orderfit_session=opaque", "content-length": str(2 * MIB)}
    sent, receives, reached = call(UPLOAD, cookie, [b"x" * MIB] * 2, authorize=counting, gate=full)
    assert status(sent) == 429 and receives == 0 and not reached and calls == [UPLOAD]
    body = json.loads(b"".join(m.get("body", b"") for m in sent if m["type"] == "http.response.body"))
    assert body["error"]["code"] == "UPLOAD_CAPACITY" and body["error"]["retryable"] is True
    # Another source is still admitted while the process cap allows; the slot is released.
    roomy = UploadGate(total=2, per_source=1)
    assert roomy.try_acquire("peer:203.0.113.9")
    sent, _, reached = call(UPLOAD, cookie, [b"x" * MIB] * 2, gate=roomy, client=("198.51.100.7", 1))
    assert status(sent) == 200 and reached and roomy.active == 1
    # The per-key cap follows the verified user, so other users behind the same proxy
    # address are still admitted while one user is at their cap.
    shared = UploadGate(total=4, per_source=1)

    def user(name):
        async def authorize(scope):
            return name
        return authorize

    assert shared.try_acquire("user:alice")
    sent, _, _ = call(UPLOAD, cookie, [b"x" * MIB] * 2, gate=shared, authorize=user("alice"))
    assert status(sent) == 429
    sent, _, _ = call(UPLOAD, cookie, [b"x" * MIB] * 2, gate=shared, authorize=user("bob"))
    assert status(sent) == 200 and shared.active == 1


def drive(limiter, scope, chunks, delays):
    """Feed body chunks with delays (seconds) on one event loop; returns sent messages."""
    sent = []
    pending = list(zip(chunks, delays, strict=True))

    async def receive():
        if not pending:
            await asyncio.sleep(3600)  # a client that never sends again
        body, delay = pending.pop(0)
        await asyncio.sleep(delay)
        return {"type": "http.request", "body": body, "more_body": bool(pending)}

    async def send(message):
        sent.append(message)

    async def run():
        await limiter(scope, receive, send)

    return run, sent


def upload_scope(cookie="orderfit_session=opaque", client=("192.0.2.1", 1)):
    return {"type": "http", "method": "POST", "path": UPLOAD, "client": client,
            "headers": [(b"cookie", cookie.encode())]}


async def drain_app(scope, receive, send):
    while True:
        message = await receive()
        if message["type"] == "http.disconnect" or not message.get("more_body"):
            break
    await send({"type": "http.response.start", "status": 200, "headers": []})
    await send({"type": "http.response.body", "body": b"ok"})


def test_slow_anonymous_body_never_holds_a_slot_and_authorized_upload_proceeds():
    gate = UploadGate(total=1, per_source=1, body_seconds=5, idle_seconds=5)

    async def authorize(scope):
        cookie = dict(scope["headers"]).get(b"cookie", b"")
        return "member" if cookie == b"orderfit_session=verified" else False

    limiter = BodyLimit(drain_app, authorize=authorize, gate=gate)
    # Forged-cookie client behind the same proxy address trickles its body very slowly.
    slow, slow_sent = drive(limiter, upload_scope("orderfit_session=forged"), [b"x"] * 3, [0.3] * 3)
    fast, fast_sent = drive(limiter, upload_scope("orderfit_session=verified"), [b"x" * MIB] * 2, [0.01] * 2)
    observed = []

    async def concurrently():
        async def authorized_later():
            await asyncio.sleep(0.2)  # the slow anonymous body is mid-transfer
            observed.append(gate.active)
            await fast()
        await asyncio.gather(slow(), authorized_later())

    asyncio.run(concurrently())
    assert observed == [0]  # the anonymous request held no slot
    assert status(fast_sent) == 200  # the authorized upload was not blocked by the slow one
    assert status(slow_sent) == 200  # small body under 1 MiB, never counted against the gate
    assert gate.active == 0 and gate.by_source == {}


def test_body_deadlines_release_the_slot_with_408():
    async def member(scope):
        return "member"

    # Idle: the client stops sending after one chunk.
    gate = UploadGate(total=1, per_source=1, body_seconds=10, idle_seconds=0.2)
    limiter = BodyLimit(drain_app, authorize=member, gate=gate)
    stalled, sent = drive(limiter, upload_scope(), [b"x" * 1024, b"x"], [0, 3600])
    asyncio.run(stalled())
    assert status(sent) == 408 and gate.active == 0
    body = json.loads(b"".join(m.get("body", b"") for m in sent if m["type"] == "http.response.body"))
    assert body["error"]["code"] == "REQUEST_TIMEOUT" and body["error"]["retryable"] is True
    # Overall: every chunk arrives inside the idle window, but the whole body is too slow.
    gate = UploadGate(total=1, per_source=1, body_seconds=0.5, idle_seconds=0.3)
    limiter = BodyLimit(drain_app, authorize=member, gate=gate)
    trickle, sent = drive(limiter, upload_scope(), [b"x"] * 20, [0.15] * 20)
    asyncio.run(trickle())
    assert status(sent) == 408 and gate.active == 0 and gate.by_source == {}
    # A body that arrives in time is unaffected.
    gate = UploadGate(total=1, per_source=1, body_seconds=5, idle_seconds=1)
    limiter = BodyLimit(drain_app, authorize=member, gate=gate)
    prompt, sent = drive(limiter, upload_scope(), [b"x" * MIB] * 2, [0.01] * 2)
    asyncio.run(prompt())
    assert status(sent) == 200 and gate.active == 0


def test_authorization_dependency_failure_is_503_not_413():
    from orderfit.api.main import DependencyUnavailable

    async def broken(scope):
        raise DependencyUnavailable

    cookie = {"cookie": "orderfit_session=opaque", "content-length": str(2 * MIB)}
    gate = UploadGate(4, 2)
    sent, receives, reached = call(UPLOAD, cookie, [b"x" * MIB] * 2, authorize=broken, gate=gate)
    assert status(sent) == 503 and receives == 0 and not reached and gate.active == 0
