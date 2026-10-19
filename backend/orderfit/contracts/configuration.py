"""P0 settings contract; explicitly instantiated, never auto-loads local .env."""

import ipaddress
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class RuntimeConfiguration(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="forbid", hide_input_in_errors=True)
    database_url: SecretStr
    session_secret: SecretStr = Field(min_length=32)
    webauthn_rp_id: str | None = None
    webauthn_origin: str | None = None
    account_fingerprint_key: SecretStr = Field(min_length=32)
    account_fingerprint_key_version: Annotated[int, Field(ge=1)]
    document_dir: str
    document_storage_backend: Literal["filesystem", "s3"] = "filesystem"
    document_s3_bucket: str | None = None
    document_s3_region: str | None = None
    document_s3_endpoint_url: str | None = None
    document_s3_access_key_id: SecretStr | None = None
    document_s3_secret_access_key: SecretStr | None = None
    document_s3_addressing_style: Literal["auto", "path", "virtual"] = "auto"
    llm_mode: Literal["off", "recorded", "live"] = "off"
    llm_provider: Literal["openai", "freellmpool"] = "openai"
    freellmpool_model: str | None = None
    freellmpool_state_dir: str = "./var/freellmpool"
    freellmpool_min_interval_seconds: Annotated[int, Field(ge=0, le=60)] = 35
    openai_api_key: SecretStr | None = None
    openai_model: str | None = None
    llm_recordings_dir: str | None = None
    cookie_secure: bool = True
    allowed_origins: list[str]
    # Explicit proxy trust (JSON list of IPs/CIDRs). Empty = X-Forwarded-* headers are ignored
    # and rate limits key on the direct peer. Only list proxies the API is reachable through.
    trusted_proxy_ips: list[str] = []
    # Authentication throttles, each per 15-minute window and counted before verification
    # (a successful verification is refunded). Account and step-up session keys stay strict;
    # the per-source key is only a coarse ceiling, because behind a shared proxy/edge address
    # every user arrives from the same source (docs/deployment/vercel.md section 5).
    auth_account_limit: Annotated[int, Field(ge=1, le=15)] = 15
    auth_source_limit: Annotated[int, Field(ge=15, le=100000)] = 300
    # Document uploads (up to 26 MiB bodies) admitted at once per API process, and per source.
    upload_concurrency: Annotated[int, Field(ge=1, le=64)] = 4
    # Per verified user (not per network address: behind a shared proxy every user has the
    # same address). Only requests that passed the pre-body authorization take a slot.
    upload_source_concurrency: Annotated[int, Field(ge=1, le=64)] = 2
    # A slot is held at most this long, and released when no body bytes arrive for the idle
    # period (408), so a trickled body cannot pin upload capacity.
    upload_body_timeout_seconds: Annotated[int, Field(ge=10, le=600)] = 120
    upload_idle_timeout_seconds: Annotated[int, Field(ge=1, le=120)] = 30
    # /docs, /redoc and /openapi.json. Off unless explicitly enabled (EXPOSE_API_DOCS=true).
    expose_api_docs: bool = False
    # Read-only summaries also require the reviewed migration and API caller role.
    admin_reads_enabled: bool = False
    account_email_mode: Literal["off", "recorded", "resend"] = "off"
    account_email_environment: Literal["development", "staging", "production"] = "development"
    email_verification_enabled: bool = False
    password_recovery_enabled: bool = False
    invitation_email_enabled: bool = False
    public_app_origin: str | None = None
    account_email_from: str | None = None
    resend_api_key: SecretStr | None = None
    resend_webhook_secret: SecretStr | None = None
    account_email_active_key_id: str | None = None
    account_email_encryption_keys: dict[str, SecretStr] = {}
    account_email_source_limit: Annotated[int, Field(ge=15, le=100000)] = 300
    account_email_worker_enabled: bool = False
    session_absolute_seconds: Literal[28800] = 28800
    session_idle_seconds: Literal[1800] = 1800
    step_up_seconds: Literal[300] = 300
    provider_timeout_seconds: Annotated[int, Field(ge=1, le=30)] = 30
    provider_concurrency: Annotated[int, Field(ge=1, le=2)] = 2
    provider_max_output_tokens: Annotated[int, Field(ge=1, le=16384)] = 2048
    # In-call attempts per provider request (transient failures only); durable job retries sit on top.
    provider_max_attempts: Annotated[int, Field(ge=1, le=3)] = 2
    job_attempts: Annotated[int, Field(ge=1, le=3)] = 3
    lease_seconds: Literal[60] = 60
    heartbeat_seconds: Literal[15] = 15

    @model_validator(mode="after")
    def coherent(self):
        from orderfit.services.mail_crypto import validate_mail_configuration

        validate_mail_configuration(self)
        if bool(self.webauthn_rp_id) != bool(self.webauthn_origin):
            raise ValueError("WebAuthn RP and origin must be configured together")
        if self.webauthn_origin:
            origin = urlsplit(self.webauthn_origin)
            if (self.webauthn_origin not in self.allowed_origins
                or origin.hostname != self.webauthn_rp_id
                or origin.username or origin.password or origin.query or origin.fragment
                or origin.path not in ("", "/")
                or (origin.scheme != "https" and not
                    (origin.scheme == "http" and origin.hostname == "localhost"))):
                raise ValueError("WebAuthn requires an exact trusted HTTPS origin and RP")
        if not self.database_url.get_secret_value().startswith("postgresql+psycopg://"):
            raise ValueError("SQLAlchemy psycopg runtime URL required")
        access_key = (
            self.document_s3_access_key_id.get_secret_value()
            if self.document_s3_access_key_id else ""
        )
        secret_key = (
            self.document_s3_secret_access_key.get_secret_value()
            if self.document_s3_secret_access_key else ""
        )
        if bool(access_key) != bool(secret_key):
            raise ValueError("S3 access key and secret must be configured together")
        s3_configured = any((
            self.document_s3_bucket,
            self.document_s3_region,
            self.document_s3_endpoint_url,
            access_key,
            secret_key,
        ))
        if self.document_storage_backend == "s3":
            if not self.document_s3_bucket or not self.document_s3_bucket.strip():
                raise ValueError("S3 document storage requires a bucket")
            if not self.document_s3_region or not self.document_s3_region.strip():
                raise ValueError("S3 document storage requires a region")
        elif s3_configured:
            raise ValueError("S3 settings require DOCUMENT_STORAGE_BACKEND=s3")
        if self.document_s3_endpoint_url:
            endpoint = urlsplit(self.document_s3_endpoint_url)
            if (
                not endpoint.hostname
                or endpoint.username
                or endpoint.password
                or endpoint.query
                or endpoint.fragment
                or endpoint.path not in {"", "/"}
                or endpoint.scheme not in {"https", "http"}
                or (
                    endpoint.scheme == "http"
                    and endpoint.hostname not in {"localhost", "127.0.0.1"}
                )
            ):
                raise ValueError("S3 endpoint must be HTTPS (HTTP is allowed only on localhost)")
        if self.llm_mode == "live" and self.llm_provider == "freellmpool":
            route = (self.freellmpool_model or "").split("/", 1)
            if (len(route) != 2 or route[0] not in {"pollinations", "ovh", "llm7", "kilo"}
                or not route[1].strip() or any(ch.isspace() for ch in self.freellmpool_model)
                or not self.freellmpool_state_dir.strip()):
                raise ValueError("FreeLLMPool requires an explicit keyless provider/model and state directory")
            # The keyless pool is a local synthetic-test adapter.  It must never
            # become an accidental hosted-provider path, even when live mode is
            # selected deliberately.
            origin_hosts = {urlsplit(origin).hostname for origin in self.allowed_origins}
            if (
                not origin_hosts <= {"localhost", "127.0.0.1", "::1"}
                or self.document_storage_backend == "s3"
            ):
                raise ValueError("FreeLLMPool is permitted only with loopback origins and filesystem storage")
        if self.llm_mode == "live" and self.llm_provider == "openai" and (
            not self.openai_api_key
            or not self.openai_api_key.get_secret_value()
            or not self.openai_model
            or not self.openai_model.strip()
        ):
            raise ValueError("explicit live mode requires OpenAI key and evaluated model")

        def valid_origin(origin):
            try:
                parsed = urlsplit(origin)
                _ = parsed.port  # validates numeric port/range
                return (
                    bool(parsed.hostname)
                    and not any(
                        (
                            parsed.username,
                            parsed.password,
                            parsed.path,
                            parsed.query,
                            parsed.fragment,
                        )
                    )
                    and (
                        parsed.scheme == "https"
                        or (
                            parsed.scheme == "http"
                            and parsed.hostname in {"localhost", "127.0.0.1"}
                        )
                    )
                )
            except ValueError:
                return False

        if not self.allowed_origins or not all(valid_origin(o) for o in self.allowed_origins):
            raise ValueError("explicit permitted origins required")
        if not self.cookie_secure and any(urlsplit(o).scheme == "https" for o in self.allowed_origins):
            raise ValueError("HTTPS origins require Secure cookies")
        database = urlsplit(self.database_url.get_secret_value())
        if database.hostname not in {"localhost", "127.0.0.1", "::1", "db"}:
            from urllib.parse import parse_qs

            if parse_qs(database.query).get("sslmode") != ["verify-full"]:
                raise ValueError("Remote database connections require sslmode=verify-full")
        for entry in self.trusted_proxy_ips:
            try:
                ipaddress.ip_network(entry, strict=False)
            except ValueError as exc:
                raise ValueError(
                    "trusted proxies must be explicit IP addresses or CIDR ranges"
                ) from exc
        if self.session_secret == self.account_fingerprint_key:
            raise ValueError("session and fingerprint secrets must differ")
        return self


PASSWORD_HASH_PARAMETERS = {
    "time_cost": 3,
    "memory_cost": 65536,
    "parallelism": 4,
    "hash_len": 32,
    "salt_len": 16,
}
