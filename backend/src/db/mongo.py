"""MongoDB async connection management.

Uses a module-level client variable initialised by connect() and torn down
by close(), both called from the FastAPI lifespan.
Uses Python's module import system to ensure a single instance.
"""

from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from core.config import settings

_client: AsyncMongoClient | None = None


def get_database() -> AsyncDatabase:
    """Return the application database. Must be called after connect()."""
    if _client is None:
        raise RuntimeError("MongoDB client is not initialised, call connect() first")
    return _client[settings.mongo_db]


async def connect() -> None:
    """Create the MongoDB client and add indexes to the database."""
    global _client
    _client = AsyncMongoClient(settings.mongo_uri)

    # Create required indexes
    db = get_database()
    await db.conversations.create_index("user_id")
    # await db.messages.create_index("conversation_id")
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])


async def close() -> None:
    """Close the MongoDB client."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
