"""Application configuration using Pydantic BaseSettings."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8")

    # Server
    api_host: str = "localhost"
    api_port: int = 8000
    debug: bool = True

    # CORS
    cors_origins: list[str] = []

    # MongoDB
    mongo_username: str = "admin"
    mongo_password: str = "admin"
    mongo_port: int = 27017
    mongo_db: str = "app_database"
    mongo_uri: str = f"mongodb://{mongo_username}:{mongo_password}@localhost:{mongo_port}/?authSource=admin"

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "file_chunks"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Embedding
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dimension: int = 384

    # File uploads
    upload_dir: str = "./uploads"


settings = Settings()
