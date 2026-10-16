"""P0 settings contract; explicitly instantiated, never auto-loads local .env."""

import ipaddress
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class RuntimeConfiguration(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="forbid")
    database_url: SecretStr
    session_secret: SecretStr = Field(min_length=32)
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
    session_absolute_seconds: Literal[28800] = 28800
    session_idle_seconds: Literal[1800] = 1800
    step_up_seconds: Literal[300] = 300
    provider_timeout_seconds: Annotated[int, Field(ge=1, le=30)] = 30
    provider_concurrency: Annotated[int, Field(ge=1, le=2)] = 2
    provider_max_output_tokens: Annotated[int, Field(ge=1, le=16384)] = 2048
    job_attempts: Annotated[int, Field(ge=1, le=3)] = 3
    lease_seconds: Literal[60] = 60
    heartbeat_seconds: Literal[15] = 15

    @model_validator(mode="after")
    def coherent(self):
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
        if self.llm_mode == "live" and (
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
