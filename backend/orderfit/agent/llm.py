"""The ONLY place that calls the AI model.

OpenAI Responses API with typed output and off/recorded/live modes, a configured model,
bounded requests and explicit refusal/incomplete/timeout/rate-limit handling. No live
fallback from unknown recordings. Source text remains untrusted data; the provider only
proposes candidates and never authoritative figures.
"""

import asyncio
import json
import random
import re
import threading
import time
import unicodedata
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError

from orderfit.agent.guards.extraction import harden, safe_gloss
from orderfit.agent.guards.source_budget import extraction_within_budget
from orderfit.contracts.language import (
    Candidate,
    LanguageRequest,
    LanguageResult,
    ParsedLanguage,
    Proposal,
    UnavailableLanguage,
)
from orderfit.contracts.primitives import Text
from orderfit.services.language import detect

PROMPTS = Path(__file__).parent / "prompts"
SCHEMA_VERSION = "extract-candidates.v1"
FIELDS = set(Candidate.model_fields["field"].annotation.__args__)


class ModelCandidate(BaseModel):
    """What the model may return (plain schema for provider structured output)."""

    field: str
    normalized_value: str | None
    status: Literal["extracted", "ambiguous", "missing", "conflicting"]
    document_id: str
    page: int
    exact_quote: str
    gloss_en: str | None = None


class ModelOutput(BaseModel):
    candidates: list[ModelCandidate]


class ModelReplyTerm(BaseModel):
    field: Literal["payment_days", "order_value_minor", "deposit_pct", "supplier_extension_days", "financing_draw_minor", "acceptance"]
    value: str
    quote: str


class ModelReplyReading(BaseModel):
    terms: list[ModelReplyTerm] = Field(max_length=20)
    conditions: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(default_factory=list, max_length=20)
    unsupported_clauses: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(default_factory=list, max_length=20)
    stance: Literal["accept", "reject", "partial", "unclear"] = "unclear"


class ModelWhatIfChange(BaseModel):
    """Flat OpenAI-compatible proposal shape, narrowed to the domain union after parsing."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal[
        "customer_delay_days", "ar_delay_days", "deposit_pct", "supplier_extension",
        "financing", "cost_overrun_bps",
    ]
    value: int | None = None
    eligible_cost_keys: list[str] | None = None
    days: int | None = None
    offer_id: str | None = None
    amount_minor: str | None = None


class ModelWhatIfIntent(BaseModel):
    """Provider DTO avoids JSON Schema oneOf; domain validation follows model parsing."""

    changes: list[ModelWhatIfChange] = Field(default_factory=list, max_length=10)
    clarification: str | None = Field(default=None, min_length=1, max_length=300)

    @classmethod
    def to_domain(cls, output):
        from orderfit.contracts.workflow import WhatIfChange

        adapter = TypeAdapter(WhatIfChange)
        changes = []
        value_kinds = {"customer_delay_days", "ar_delay_days", "deposit_pct", "cost_overrun_bps"}
        for change in output.changes:
            payload = change.model_dump(exclude_none=True)
            # The flat provider schema must represent every kind without a oneOf.
            # Some model responses put an AR/customer delay in the generic `days`
            # slot; normalize that explicit day value to the domain `value` field.
            if payload["kind"] in value_kinds and "days" in payload:
                days = payload.pop("days")
                if "value" in payload and payload["value"] != days:
                    raise ValueError("conflicting delay values")
                payload.setdefault("value", days)
            changes.append(adapter.validate_python(payload))
        return changes


class LLMSettings(BaseModel):
    mode: Literal["off", "recorded", "live"] = "off"
    model: str | None = None
    api_key: str | None = None
    timeout_seconds: int = 30
    max_output_tokens: int = 2048
    concurrency: int = 2
    max_attempts: Annotated[int, Field(ge=1, le=3)] = 2
    recordings_dir: Path | None = None

    @classmethod
    def from_runtime(cls, config):
        return cls(
            mode=config.llm_mode,
            model=config.openai_model,
            api_key=config.openai_api_key.get_secret_value() if config.openai_api_key else None,
            timeout_seconds=config.provider_timeout_seconds,
            max_output_tokens=config.provider_max_output_tokens,
            concurrency=config.provider_concurrency,
            max_attempts=config.provider_max_attempts,
            recordings_dir=Path(config.llm_recordings_dir) if config.llm_recordings_dir else None,
        )


class _ProviderParsed(BaseModel):
    value: BaseModel
    model: Text
    response_id: Text
    input_tokens: Annotated[int, Field(strict=True, ge=0)] | None
    output_tokens: Annotated[int, Field(strict=True, ge=0)] | None



def _unavailable(code, kind="unavailable", retryable=False) -> LanguageResult:
    return LanguageResult(result=UnavailableLanguage(kind=kind, code=code, retryable=retryable))


def render_prompt(name: str, request: LanguageRequest) -> str:
    """Document text goes inside <document> tags and is labelled untrusted data."""
    template = (PROMPTS / f"{name}.md").read_text(encoding="utf-8")
    documents = "\n".join(
        f'<document id="{s.document_id}" page="{s.page}" role="{s.source_role}">\n'
        f"{s.text.replace('<', '&lt;')}\n</document>"  # source text cannot close the data tag
        for s in request.sources
    )
    return f"{template}\n\n{documents}"


def system_prompt(name: str) -> str:
    """Load the exact system instruction sent to OpenAI."""
    return (PROMPTS / f"{name}.system.md").read_text(encoding="utf-8")


def _to_parsed(
    request: LanguageRequest,
    output: ModelOutput,
    model: str,
    response_id: str,
    recorded_at: datetime,
    input_tokens: int | None,
    output_tokens: int | None,
) -> LanguageResult:
    lookup = {(str(s.document_id), s.page): s for s in request.sources}
    candidates = []
    for item in output.candidates:
        source = lookup.get((item.document_id, item.page))
        if source is None or item.field not in FIELDS:
            return _unavailable("INVALID_OUTPUT", "invalid_output")
        try:
            candidates.append(
                Candidate(
                    field=item.field,
                    normalized_value=item.normalized_value,
                    status=item.status,
                    source=source,
                    exact_quote=item.exact_quote,
                    gloss_en=safe_gloss(item.gloss_en, item.exact_quote, detect(item.exact_quote)[0]),
                )
            )
        except ValidationError:
            return _unavailable("INVALID_OUTPUT", "invalid_output")
    candidates, guard_findings = harden(candidates)
    try:
        return LanguageResult(
            result=ParsedLanguage(
                kind="parsed",
                proposal=Proposal(candidates=candidates, changes=[], sentences=[], findings=[]),
                model=model,
                response_id=response_id,
                input_hash=request.input_hash,
                prompt_version=request.prompt_version,
                schema_version=SCHEMA_VERSION,
                recorded_at=recorded_at,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                guard_findings=guard_findings,
            )
        )
    except ValidationError:
        # Final aggregate limits and provider metadata are validated here too,
        # not only each candidate. Live and recorded results share this boundary.
        return _unavailable("INVALID_OUTPUT", "invalid_output")


def recording_path(settings: LLMSettings, request: LanguageRequest) -> Path | None:
    if settings.recordings_dir is None:
        return None
    return settings.recordings_dir / f"{request.prompt_version}__{request.input_hash}.json"


def _recorded(request: LanguageRequest, settings: LLMSettings) -> LanguageResult:
    path = recording_path(settings, request)
    if path is None or not path.is_file():  # never fall through to live
        return _unavailable("RECORDING_NOT_FOUND")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):  # a JSON list/scalar is an invalid recording
            return _unavailable("INVALID_OUTPUT", "invalid_output")
        if data.get("refusal"):
            return _unavailable("REFUSAL", "refused")
        if data.get("incomplete"):
            return _unavailable("INCOMPLETE", "incomplete", True)
        output = ModelOutput.model_validate({"candidates": data["candidates"]})
        return _to_parsed(
            request,
            output,
            f"recorded:{data.get('model', 'unknown')}",
            data.get("response_id", path.stem),
            datetime.fromisoformat(data.get("recorded_at", "2026-01-01T00:00:00+00:00")),
            None,
            None,
        )
    except (ValueError, KeyError, TypeError, AttributeError, ValidationError):
        return _unavailable("INVALID_OUTPUT", "invalid_output")


def _status_unavailable(exc) -> LanguageResult:
    """Only server-side/transient statuses are retryable; 4xx caller errors are not."""
    status = getattr(exc, "status_code", None)
    retryable = isinstance(status, int) and (status >= 500 or status in {408, 409})
    return _unavailable("PROVIDER_UNAVAILABLE", retryable=retryable)


MAX_PROMPT_CHARS = 250_000  # system + user text; extraction's own budget is 100k source characters
_QUEUE_WAIT_SECONDS = 20.0  # longest a request waits for a provider slot before failing as retryable
_BACKOFF_BASE_SECONDS = 1.0
_BACKOFF_CAP_SECONDS = 8.0
_TRANSIENT_CODES = {"TIMEOUT", "RATE_LIMIT", "PROVIDER_UNAVAILABLE"}


class _CircuitBreaker:
    """Process-wide: repeated transient failures fail fast instead of burning every timeout."""

    def __init__(self, threshold: int = 5, cooldown_seconds: float = 30.0):
        self._lock = threading.Lock()
        self._threshold, self._cooldown = threshold, cooldown_seconds
        self._failures, self._open_until = 0, 0.0

    def allow(self) -> bool:
        with self._lock:  # after the cooldown one failure re-opens it (half-open probe)
            return time.monotonic() >= self._open_until

    def record(self, reachable: bool) -> None:
        with self._lock:
            if reachable:
                self._failures = 0
                return
            self._failures += 1
            if self._failures >= self._threshold:
                self._open_until = time.monotonic() + self._cooldown


_breaker = _CircuitBreaker()

# Provider slots are process-wide: workers call asyncio.run() per job, so a loop-scoped
# asyncio.Semaphore would not bound requests across threads.
_limiters: dict[int, threading.BoundedSemaphore] = {}
_limiters_lock = threading.Lock()


async def _acquire_slot(concurrency: int, wait_seconds: float) -> threading.BoundedSemaphore | None:
    with _limiters_lock:
        limiter = _limiters.setdefault(concurrency, threading.BoundedSemaphore(concurrency))
    deadline = time.monotonic() + wait_seconds
    while not limiter.acquire(blocking=False):
        if time.monotonic() >= deadline:
            return None
        await asyncio.sleep(0.05)
    return limiter


def _retry_after(exc) -> float | None:
    try:
        value = float(exc.response.headers.get("retry-after"))
    except (AttributeError, TypeError, ValueError):
        return None
    return value if 0 <= value else None


async def _structured_call(system: str, user_content: str, output_type, settings: LLMSettings):
    """One live structured boundary for every proposal task.

    The return deliberately contains no business interpretation: callers validate
    schema-specific output and decide their deterministic fallback.
    """
    if len(system) + len(user_content) > MAX_PROMPT_CHARS:  # bound cost before any provider work
        return _unavailable("PROVIDER_UNAVAILABLE").result
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user_content}]
    if not settings.api_key or not settings.model:
        return _unavailable("PROVIDER_UNAVAILABLE").result
    if not _breaker.allow():
        return _unavailable("PROVIDER_UNAVAILABLE", retryable=True).result
    import openai  # sole provider import
    client = openai.AsyncOpenAI(
        api_key=settings.api_key, max_retries=0, timeout=settings.timeout_seconds
    )
    deadline = time.monotonic() + settings.timeout_seconds * 2
    try:
        for attempt in range(1, settings.max_attempts + 1):
            limiter = await _acquire_slot(settings.concurrency, _QUEUE_WAIT_SECONDS)
            if limiter is None:  # local saturation says nothing about provider health
                return _unavailable("RATE_LIMIT", retryable=True).result
            hint: dict = {}
            try:
                result = await _openai_once(client, messages, output_type, settings, hint)
            finally:
                limiter.release()
            transient = (
                isinstance(result, UnavailableLanguage)
                and result.code in _TRANSIENT_CODES
                and result.retryable
            )
            if not (isinstance(result, UnavailableLanguage) and result.code == "QUOTA"):
                _breaker.record(reachable=not transient)
            if not transient or attempt == settings.max_attempts or not result.retryable:
                return result
            delay = hint.get("retry_after", _BACKOFF_BASE_SECONDS * 2 ** (attempt - 1))
            if delay > _BACKOFF_CAP_SECONDS:  # the provider asked for longer than we will wait in-call
                return result
            delay += random.uniform(0, delay / 4)  # jitter so workers do not retry in lockstep
            if time.monotonic() + delay >= deadline or not _breaker.allow():
                return result
            await asyncio.sleep(delay)
    finally:
        await client.close()


async def _openai_once(client, messages, output_type, settings: LLMSettings, hint: dict):
    """One bounded Responses attempt. ``hint['retry_after']`` carries a server back-off request."""
    import openai
    try:
        response = await asyncio.wait_for(
            client.responses.parse(
                model=settings.model,
                input=messages,
                text_format=output_type,
                max_output_tokens=settings.max_output_tokens,
                store=False,
            ),
            timeout=settings.timeout_seconds + 1,
        )
    except (TimeoutError, openai.APITimeoutError):
        return _unavailable("TIMEOUT", retryable=True).result
    except openai.RateLimitError as exc:
        if getattr(exc, "code", None) == "insufficient_quota":
            return _unavailable("QUOTA").result
        if (wait := _retry_after(exc)) is not None:
            hint["retry_after"] = wait
        return _unavailable("RATE_LIMIT", retryable=True).result
    except openai.LengthFinishReasonError:
        return _unavailable("INCOMPLETE", "incomplete", True).result
    except openai.ContentFilterFinishReasonError:
        return _unavailable("REFUSAL", "refused").result
    except (ValidationError, json.JSONDecodeError):
        return _unavailable("INVALID_OUTPUT", "invalid_output").result
    except openai.APIConnectionError:
        return _unavailable("PROVIDER_UNAVAILABLE", retryable=True).result
    except openai.APIStatusError as exc:
        if (wait := _retry_after(exc)) is not None:
            hint["retry_after"] = wait
        return _status_unavailable(exc).result
    if response.status == "incomplete":
        return _unavailable("INCOMPLETE", "incomplete", True).result
    for item in response.output:
        for part in getattr(item, "content", None) or []:
            if getattr(part, "type", "") == "refusal":
                return _unavailable("REFUSAL", "refused").result
    if response.output_parsed is None:
        return _unavailable("INVALID_OUTPUT", "invalid_output").result
    usage = response.usage
    try:
        return _ProviderParsed(
            value=response.output_parsed,
            model=getattr(response, "model", None) or settings.model,
            response_id=response.id,
            input_tokens=getattr(usage, "input_tokens", None),
            output_tokens=getattr(usage, "output_tokens", None),
        )
    except ValidationError:  # invalid provider metadata (for example negative usage)
        return _unavailable("INVALID_OUTPUT", "invalid_output").result


async def _live(request: LanguageRequest, settings: LLMSettings) -> LanguageResult:
    result = await _structured_call(
        system_prompt("extract_order"), render_prompt("extract_order", request), ModelOutput, settings
    )
    if isinstance(result, UnavailableLanguage):
        return LanguageResult(result=result)
    return _to_parsed(request, result.value, result.model, result.response_id, datetime.now(UTC),
                      result.input_tokens, result.output_tokens)


async def extract(request: LanguageRequest, settings: LLMSettings) -> LanguageResult:
    """Propose candidates for ``request``; mode decides whether any network is used."""
    if settings.mode == "off":
        return _unavailable("AI_OFF")
    if not extraction_within_budget(source.text for source in request.sources):
        # This request cannot use automatic extraction. The durable handler emits
        # DOCUMENT_TOO_LONG with split/manual guidance before reaching this guard.
        return _unavailable("PROVIDER_UNAVAILABLE")
    if settings.mode == "recorded":
        return _recorded(request, settings)
    return await _live(request, settings)


def _safe_clarification(text: str | None) -> str | None:
    """A clarifying question is shown to the owner, so it carries no figures or instructions."""
    from orderfit.agent.guards import numbers
    from orderfit.agent.guards.injection import scan

    if not text or not text.strip() or len(text) > 300 or numbers.check(text, set()) or scan(text):
        return None
    return text.strip()


async def propose_intent(instruction: str, input_hash: str, settings: LLMSettings):
    """Proposal-only what-if intent; ranges and source eligibility checked by caller."""
    from orderfit.contracts.preparation import IntentResult
    from orderfit.services.preparation import deterministic_intent

    def fallback(code):
        try:
            changes = deterministic_intent(instruction)
        except ValidationError:
            changes = []
        return IntentResult(changes=changes, provenance="template", code=code)

    if settings.mode == "off":
        return fallback("AI_OFF")
    if settings.mode == "recorded":
        path = settings.recordings_dir / f"whatif.v1__{input_hash}.json" if settings.recordings_dir else None
        if path is None or not path.is_file():
            return fallback("RECORDING_NOT_FOUND")
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            output = ModelWhatIfIntent.model_validate(record["intent"])
            clarification = _safe_clarification(output.clarification)
            if output.clarification and clarification is None:
                return fallback("INVALID_OUTPUT")
            changes = ModelWhatIfIntent.to_domain(output)
            if changes and clarification:
                return fallback("INVALID_OUTPUT")
            return IntentResult(changes=changes, provenance="recorded", code=None,
                                model=record.get("model"), response_id=record.get("response_id"),
                                clarification=clarification)
        except (ValueError, KeyError, TypeError, AttributeError, ValidationError):
            return fallback("INVALID_OUTPUT")
    result = await _structured_call(
        system_prompt("whatif"), json.dumps({"instruction": instruction}), ModelWhatIfIntent, settings
    )
    if isinstance(result, UnavailableLanguage):
        return fallback(result.code)
    clarification = _safe_clarification(result.value.clarification)
    if result.value.clarification and clarification is None:
        return fallback("INVALID_OUTPUT")
    try:
        changes = ModelWhatIfIntent.to_domain(result.value)
        if changes and clarification:
            return fallback("INVALID_OUTPUT")
        return IntentResult(changes=changes, provenance="live", code=None,
                            model=result.model, response_id=result.response_id,
                            clarification=clarification)
    except (ValidationError, ValueError):
        return fallback("INVALID_OUTPUT")


def _fold(value: str) -> str:
    """Quote-presence form: NFKC, no format characters, collapsed whitespace, case-folded."""
    kept = "".join(ch for ch in unicodedata.normalize("NFKC", value) if unicodedata.category(ch) != "Cf")
    return re.sub(r"\s+", " ", kept).strip().casefold()


async def read_reply(body: str, input_hash: str, settings: LLMSettings):
    """Read a reply into typed proposals only; deterministic callers retain all authority.

    Every term, condition and unsupported clause must carry a verbatim quote of the reply.
    One fabricated quote or out-of-range value invalidates the whole reading (template
    fallback): a partly wrong reading is not a safer reading. The stance is advisory.
    """
    from orderfit.contracts.preparation import ReplyReading, ReplyTerm
    from orderfit.services.preparation import has_exact_acceptance

    def fallback(code):
        return ReplyReading(provenance="template", code=code)

    def validate(output, provenance, model=None, response_id=None):
        haystack = _fold(body)

        def grounded(quote):
            folded = _fold(quote)
            return bool(folded) and folded in haystack

        terms = []
        for item in output.terms:
            if not grounded(item.quote):
                return fallback("INVALID_OUTPUT")
            if item.field == "acceptance":
                if item.value != "accepted" or not has_exact_acceptance(body):
                    return fallback("INVALID_OUTPUT")
            elif not item.value.isascii() or not item.value.isdigit():
                return fallback("INVALID_OUTPUT")
            elif item.field == "deposit_pct" and int(item.value) > 100:
                return fallback("INVALID_OUTPUT")
            elif item.field in {"payment_days", "supplier_extension_days"} and int(item.value) > 365:
                return fallback("INVALID_OUTPUT")
            terms.append(ReplyTerm(id=uuid.uuid4(), field=item.field, value=item.value, quote=item.quote))
        clauses = [*output.conditions, *output.unsupported_clauses]
        if not all(grounded(quote) for quote in clauses):
            return fallback("INVALID_OUTPUT")
        try:
            return ReplyReading(
                terms=terms, conditions=output.conditions, unsupported_clauses=output.unsupported_clauses,
                stance=output.stance, provenance=provenance, code=None, model=model, response_id=response_id,
            )
        except ValidationError:
            return fallback("INVALID_OUTPUT")

    if settings.mode == "off":
        return fallback("AI_OFF")
    if settings.mode == "recorded":
        path = settings.recordings_dir / f"reply.v1__{input_hash}.json" if settings.recordings_dir else None
        if path is None or not path.is_file():
            return fallback("RECORDING_NOT_FOUND")
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            return validate(ModelReplyReading.model_validate(record["reading"]), "recorded",
                            record.get("model"), record.get("response_id"))
        except (ValueError, KeyError, TypeError, ValidationError):
            return fallback("INVALID_OUTPUT")
    result = await _structured_call(
        system_prompt("read_reply"), "<reply>" + body.replace("<", "&lt;") + "</reply>",
        ModelReplyReading, settings,
    )
    if isinstance(result, UnavailableLanguage):
        return fallback(result.code)
    return validate(result.value, "live", result.model, result.response_id)


class ModelClauseReading(BaseModel):
    payment_basis: Literal["order", "invoice", "delivery"]
    payment_days: int
    quote: str


class ModelClauseReadings(BaseModel):
    readings: list[ModelClauseReading] = Field(max_length=4)


async def read_clause(clause_text: str, input_hash: str, settings: LLMSettings):
    """Propose typed readings of an ambiguous payment clause (hypotheses only).

    Returns a ClauseProposal. Every reading needs a verbatim quote of the clause and an
    in-range day count; one invalid reading invalidates the whole proposal and the
    deterministic template readings are used. Labels are generated, never model prose.
    """
    from orderfit.contracts.advisory import ClauseProposal
    from orderfit.services import clauses

    def fallback(code):
        return ClauseProposal(readings=clauses.deterministic_readings(clause_text), provenance="template", code=code)

    def validate(output, provenance, model=None, response_id=None):
        seen, readings = set(), []
        for item in output.readings:
            key = (item.payment_basis, item.payment_days)
            if not 0 <= item.payment_days <= 365 or not clauses.grounded(item.quote, clause_text) or key in seen:
                return fallback("INVALID_OUTPUT")
            seen.add(key)
            readings.append(clauses.reading(item.payment_basis, item.payment_days, item.quote))
        # For a bare net/day-count clause with no named start event, the closed
        # template grammar knows the complete set of plausible anchors. Preserve
        # every such hypothesis even if the model returns only a subset.
        for baseline in clauses.deterministic_readings(clause_text):
            key = (baseline.payment_basis, baseline.payment_days)
            if key not in seen and len(readings) < 4:
                readings.append(baseline)
                seen.add(key)
        return ClauseProposal(readings=readings, provenance=provenance, code=None, model=model,
                              response_id=response_id)

    if settings.mode == "off":
        return fallback("AI_OFF")
    if settings.mode == "recorded":
        path = settings.recordings_dir / f"clause.v1__{input_hash}.json" if settings.recordings_dir else None
        if path is None or not path.is_file():
            return fallback("RECORDING_NOT_FOUND")
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            return validate(ModelClauseReadings.model_validate(record["readings"]), "recorded",
                            record.get("model"), record.get("response_id"))
        except (ValueError, KeyError, TypeError, ValidationError):
            return fallback("INVALID_OUTPUT")
    result = await _structured_call(
        system_prompt("clause"), "<clause>" + clause_text.replace("<", "&lt;") + "</clause>",
        ModelClauseReadings, settings,
    )
    if isinstance(result, UnavailableLanguage):
        return fallback(result.code)
    return validate(result.value, "live", result.model, result.response_id)


class ModelExplanation(BaseModel):
    sentences: list[str] = Field(max_length=6)


async def explain_slots(context: dict, slots: dict[str, str], input_hash: str, settings: LLMSettings):
    """Slot-only explanation text, or a template fallback.

    ``context`` holds qualitative, number-free signals; ``slots`` maps slot name to its
    meaning. The model returns sentences with ``{slot}`` placeholders only; the caller
    resolves them from engine facts. Anything failing the number/terms guards is dropped.
    """
    from orderfit.contracts.advisory import ExplanationProposal
    from orderfit.services import explanations

    def fallback(code):
        return ExplanationProposal(sentences=[], provenance="template", code=code)

    def validate(output, provenance, model=None, response_id=None):
        if explanations.problems(output.sentences, slots):
            return fallback("INVALID_OUTPUT")
        return ExplanationProposal(sentences=output.sentences, provenance=provenance, code=None,
                                   model=model, response_id=response_id)

    if settings.mode == "off":
        return fallback("AI_OFF")
    if settings.mode == "recorded":
        path = settings.recordings_dir / f"explain.v1__{input_hash}.json" if settings.recordings_dir else None
        if path is None or not path.is_file():
            return fallback("RECORDING_NOT_FOUND")
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            return validate(ModelExplanation.model_validate(record["explanation"]), "recorded",
                            record.get("model"), record.get("response_id"))
        except (ValueError, KeyError, TypeError, ValidationError):
            return fallback("INVALID_OUTPUT")
    user = json.dumps({"signals": context, "slots": slots}, sort_keys=True)
    result = await _structured_call(system_prompt("explain"), user, ModelExplanation, settings)
    if isinstance(result, UnavailableLanguage):
        return fallback(result.code)
    return validate(result.value, "live", result.model, result.response_id)
