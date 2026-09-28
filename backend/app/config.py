"""Configuración central de la aplicación (pydantic-settings).

Las variables se leen de entorno o de un archivo .env. Ver .env.example.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración tipada de la aplicación."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Entorno
    environment: str = "development"
    debug: bool = True

    # API
    project_name: str = "CompraVendeAqui"
    api_v1_prefix: str = "/api/v1"

    # Infraestructura
    database_url: str = "postgresql+psycopg://admin:password@localhost:5432/compravende"
    redis_url: str = "redis://localhost:6379/0"

    # CORS: coma-separado en el env, lista en el código.
    # NoDecode evita que pydantic-settings intente parsear el valor como JSON;
    # el _split_cors_origins de abajo hace el split por comas.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    # Logging
    log_level: str = "INFO"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        """Permite pasar CORS_ORIGINS como cadena separada por comas."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de Settings."""
    return Settings()


settings = get_settings()
