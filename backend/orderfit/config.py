"""Settings read from the environment (see backend/.env.example).

The engine never reads settings; callers pass values in explicitly so engine
results depend only on their inputs.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ai_api_key: str = ""
    ai_model: str = ""
    ai_temperature: float = 0.0

    # SQLAlchemy form. psycopg 3 serves both sync (Alembic) and async (app) use.
    # On Neon this is the pooled endpoint (host contains "-pooler").
    database_url: str = "postgresql+psycopg://orderfit:orderfit@localhost:5432/orderfit"
    # Direct (non-pooled) endpoint for migrations; empty means use database_url.
    database_url_direct: str = ""
    document_dir: str = "./var/documents"

    cors_origins: list[str] = ["http://localhost:3000"]

    target_tolerance_days: int = 15

    @property
    def migration_url(self) -> str:
        return self.database_url_direct or self.database_url

    @property
    def psycopg_conninfo(self) -> str:
        """Plain libpq URL for psycopg and the LangGraph Postgres checkpointer."""
        return self.database_url.replace("postgresql+psycopg://", "postgresql://", 1)


settings = Settings()
