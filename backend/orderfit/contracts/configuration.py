"""P0 settings contract; explicitly instantiated, never auto-loads local .env."""

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
    llm_mode: Literal["off", "recorded", "live"] = "off"
    openai_api_key: SecretStr | None = None
    openai_model: str | None = None
    cookie_secure: bool = True
    allowed_origins: list[str]
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
                return bool(parsed.hostname) and not any((parsed.username, parsed.password, parsed.path, parsed.query, parsed.fragment)) and (parsed.scheme == "https" or (parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}))
            except ValueError:
                return False

        if not self.allowed_origins or not all(valid_origin(o) for o in self.allowed_origins):
            raise ValueError("explicit permitted origins required")
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
