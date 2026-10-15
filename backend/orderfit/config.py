"""Settings read from the environment (see backend/.env.example).

The engine never reads settings; callers pass values in explicitly so engine
results depend only on their inputs.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Legacy scaffold; P1 wires the strict RuntimeConfiguration at startup.
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    llm_mode: str = "off"
    openai_api_key: str = ""
    openai_model: str = ""

    # SQLAlchemy form. psycopg 3 serves both sync (Alembic) and async (app) use.
    # On Neon this is the pooled endpoint (host contains "-pooler").
    database_url: str = ""
    # Direct migrator credential; never fall back to the runtime login.
    database_url_direct: str = ""
    document_dir: str = "./var/documents"

    cors_origins: list[str] = ["http://localhost:3000"]

    target_tolerance_days: int = 15

    @property
    def migration_url(self) -> str:
        if not self.database_url_direct:
            raise ValueError("DATABASE_URL_DIRECT is required for migrations")
        return self.database_url_direct

    @property
    def psycopg_conninfo(self) -> str:
        """Plain libpq URL for psycopg; no checkpoint framework is adopted."""
        return self.database_url.replace("postgresql+psycopg://", "postgresql://", 1)


settings = Settings()
