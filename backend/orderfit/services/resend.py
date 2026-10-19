"""Bounded Resend transport and official Svix webhook verification."""

import asyncio
import hashlib
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from uuid import uuid4

import anyio
import httpx
from svix.webhooks import Webhook

from orderfit.api.errors import ApplicationError
from orderfit.contracts.primitives import Acknowledgement
from orderfit.store import account_access_repository as repo


def retry_after(value):
    try:
        seconds = int(value)
    except (ValueError, TypeError):
        try:
            seconds = int((parsedate_to_datetime(value) - datetime.now(UTC)).total_seconds())
        except (ValueError, TypeError, OverflowError):
            return 60
    return max(1, min(seconds, 82800))


class ResendTransport:
    def __init__(self, config, client=None):
        self.key = config.resend_api_key.get_secret_value()
        self.client = client

    def send(self, payload, provider_key):
        return asyncio.run(self._send(payload, provider_key))

    async def _send(self, payload, provider_key):
        owned = self.client is None
        client = self.client or httpx.AsyncClient(
            timeout=httpx.Timeout(15, connect=5), follow_redirects=False
        )
        try:
            with anyio.fail_after(15):
                return await self._request(client, payload, provider_key)
        except (httpx.RequestError, TimeoutError):
            return "retry", None, 60
        finally:
            if owned:
                await client.aclose()

    async def _request(self, client, payload, provider_key):
        async with client.stream(
            "POST",
            "https://api.resend.com/emails",
            json=payload,
            headers={"Authorization": f"Bearer {self.key}", "Idempotency-Key": provider_key},
        ) as response:
            raw = bytearray()
            async for chunk in response.aiter_bytes():
                raw.extend(chunk)
                if len(raw) > 65536:
                    return "retry", None, 60
            import json

            try:
                body = json.loads(raw)
            except (ValueError, UnicodeDecodeError):
                body = {}
            if not isinstance(body, dict):
                body = {}
            if (
                response.status_code in (200, 201)
                and isinstance(body.get("id"), str)
                and 0 < len(body["id"]) <= 256
            ):
                return "accepted", body["id"], 1
            if (
                response.status_code in (200, 201, 408, 429)
                or response.status_code >= 500
                or (
                    response.status_code == 409
                    and body.get("name") == "concurrent_idempotent_requests"
                )
            ):
                return "retry", None, retry_after(response.headers.get("Retry-After"))
            return "rejected", None, 1


def accept_webhook(database, config, raw, headers):
    if len(raw) > 256 * 1024:
        raise ApplicationError(413, "REQUEST_TOO_LARGE")
    try:
        event = Webhook(config.resend_webhook_secret.get_secret_value()).verify(raw, headers)
        event_id = headers["svix-id"]
        event_type = event["type"]
        at = datetime.fromisoformat(event["created_at"].replace("Z", "+00:00"))
        if at.tzinfo is None or not 0 < len(event_id) <= 256 or not 0 < len(event_type) <= 100:
            raise ValueError
        provider = event.get("data", {}).get("email_id")
        if not isinstance(provider, str) or not 0 < len(provider) <= 256:
            provider = "unsupported:" + hashlib.sha256(event_id.encode()).hexdigest()
    except Exception as exc:
        raise ApplicationError(400, "INVALID_WEBHOOK", "Invalid callback.") from exc
    with database.transaction() as c:
        repo.call(c, "event", id=event_id, provider=provider, type=event_type, at=at)
    return Acknowledgement(request_id=str(uuid4()), completed=True)
