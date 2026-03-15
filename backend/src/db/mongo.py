from pymongo import AsyncMongoClient

from core.config import settings

_client: AsyncMongoClient | None = None


def get_database():
    return _client[settings.mongo_db]


async def connect():
    global _client
    _client = AsyncMongoClient(settings.mongo_uri)


async def close():
    if _client:
        await _client.close()
