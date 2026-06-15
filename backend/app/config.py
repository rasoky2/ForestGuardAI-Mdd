import os
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

POSTGRES_PREFIX = "postgres://"
POSTGRESQL_PREFIX = "postgresql://"

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    JWT_SECRET_KEY: str = "9478f654b01e3cbdb2df5b1285223e74ff1fcf988ea7b7f16ef062b0e6fa34d5"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    DATABASE_URL: str = "sqlite:///./forestguard.db"
    DEFAULT_ADMIN_EMAIL: str = "admin@gore-md.gob.pe"
    DEFAULT_ADMIN_PASSWORD: str = "adminforestguard"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Validamos el URL de base de datos en Pydantic v2
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith(POSTGRES_PREFIX):
            return v.replace(POSTGRES_PREFIX, POSTGRESQL_PREFIX, 1)
        return v

settings = Settings()
