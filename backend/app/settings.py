from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE_URL = f"sqlite:///{REPO_ROOT / 'backend' / 'ai_scientist.db'}"
DEFAULT_CORS_ORIGINS = "http://localhost:5173"
DEFAULT_LLM_MODEL = "gpt-4o-mini"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", REPO_ROOT / "backend" / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    tavily_api_key: str = Field(default="", alias="TAVILY_API_KEY")
    database_url: str = Field(default=DEFAULT_SQLITE_URL, alias="DATABASE_URL")
    redis_url: str = Field(default="", alias="REDIS_URL")

    llm_model: str = Field(default=DEFAULT_LLM_MODEL, alias="LLM_MODEL")
    llm_temperature: float = Field(default=0.2, alias="LLM_TEMPERATURE")

    cors_origins: str = Field(default=DEFAULT_CORS_ORIGINS, alias="CORS_ORIGINS")

    @field_validator("database_url", mode="before")
    @classmethod
    def _default_database_url(cls, v: object) -> object:
        if v is None or (isinstance(v, str) and not v.strip()):
            return DEFAULT_SQLITE_URL
        return v

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _default_cors(cls, v: object) -> object:
        if v is None or (isinstance(v, str) and not v.strip()):
            return DEFAULT_CORS_ORIGINS
        return v

    @field_validator("llm_model", mode="before")
    @classmethod
    def _default_llm_model(cls, v: object) -> object:
        if v is None or (isinstance(v, str) and not v.strip()):
            return DEFAULT_LLM_MODEL
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
