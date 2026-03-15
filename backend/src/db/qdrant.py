"""Qdrant async connection management

Uses a module-level client variable initialised by connect() and torn down
by close(), both called from the FastAPI lifespan.
Uses Python's module import system to ensure a single instance.
"""

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, PayloadSchemaType, VectorParams

from core.config import settings

_client: AsyncQdrantClient | None = None


def get_client() -> AsyncQdrantClient:
    """Return the Qdrant client. Must be called after connect()."""
    if _client is None:
        raise RuntimeError("Qdrant client is not initialised, call connect() first")
    return _client


async def connect() -> None:
    """Create the Qdrant client and ensure the collection exists."""
    global _client
    _client = AsyncQdrantClient(url=settings.qdrant_url)

    # Create the file_chunks collection if it doesn't already exist.
    collections = await _client.get_collections()
    existing_names = {c.name for c in collections.collections}

    if settings.qdrant_collection not in existing_names:
        await _client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(
                size=settings.embedding_dimension,
                distance=Distance.COSINE,
            ),
        )

    # Payload index on conversation_id to facilitate filtered search & delete.
    await _client.create_payload_index(
        collection_name=settings.qdrant_collection,
        field_name="conversation_id",
        field_schema=PayloadSchemaType.KEYWORD,
    )


async def close() -> None:
    """Close the Qdrant client."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
