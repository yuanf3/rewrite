"""Repository for the `messages` MongoDB collection

MongoDB interactions for messages.
"""

from datetime import datetime, timezone

from src.models.schemas import FileRef, Message


class MessageRepo:
    def __init__(self, db) -> None:
        self._col = db.messages

    async def create(
        self,
        conversation_id: str,
        role: str,
        content: str,
        files: list[FileRef] | None = None,
    ) -> Message:
        """Insert a new message and return it."""
        doc = {
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "files": [f.model_dump() for f in (files or [])],
            "created_at": datetime.now(timezone.utc),
        }
        result = await self._col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return Message(**doc)

    async def find_by_conversation(
        self,
        conversation_id: str,
        before: datetime | None = None,
        limit: int = 100,
    ) -> list[Message]:
        """Return messages for a conversation, oldest first (cursor-based pagination).

        The `before` cursor paginates backwards from a given timestamp so
        the client can implement "load earlier messages".
        """
        query: dict = {"conversation_id": conversation_id}
        if before is not None:
            query["created_at"] = {"$lt": before}

        cursor = self._col.find(query).sort("created_at", 1).limit(limit)
        return [Message(**doc) async for doc in cursor]

    async def delete_by_conversation(self, conversation_id: str) -> int:
        """Delete all messages belonging to a conversation. Returns deleted count."""
        result = await self._col.delete_many({"conversation_id": conversation_id})
        return result.deleted_count

    async def count_by_conversation(self, conversation_id: str) -> int:
        """Return the total message count for a conversation."""
        return await self._col.count_documents({"conversation_id": conversation_id})
