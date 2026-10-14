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

    database_url: str = "sqlite:///./var/orderfit.db"
    checkpoint_db_path: str = "./var/checkpoints.db"
    document_dir: str = "./var/documents"

    cors_origins: list[str] = ["http://localhost:3000"]

    target_tolerance_days: int = 15


settings = Settings()
