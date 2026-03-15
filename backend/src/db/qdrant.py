from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, PayloadSchemaType, VectorParams

from core.config import settings

_client: AsyncQdrantClient | None = None


def get_client():
    return _client


async def connect():
    global _client
    _client = AsyncQdrantClient(url=settings.qdrant_url)

    if not await _client.collection_exists(settings.qdrant_collection):
        await _client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(
                size=settings.embedding_dimension,
                distance=Distance.COSINE,
            ),
        )
        await _client.create_payload_index(
            collection_name=settings.qdrant_collection,
            field_name="conversation_id",
            field_schema=PayloadSchemaType.KEYWORD,
        )


async def close():
    if _client:
        await _client.close()
