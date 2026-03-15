"""Repository for the `conversations` MongoDB collection

MongoDB interactions for conversations.
"""

from datetime import datetime, timezone

from bson import ObjectId

from models.schemas import Conversation


def _to_model(doc: dict) -> Conversation:
    """Map a raw MongoDB document to a Conversation schema."""
    return Conversation(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        title=doc.get("title"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


class ConversationRepo:
    def __init__(self, db) -> None:
        self._col = db.conversations

    async def create(self, user_id: str, title: str | None = None) -> Conversation:
        """Insert a new conversation and return it."""
        now = datetime.now(timezone.utc)
        doc = {
            "user_id": user_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
        }
        result = await self._col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return _to_model(doc)

    async def find_by_user(
        self,
        user_id: str,
        before: datetime | None = None,
        limit: int = 50,
    ) -> list[Conversation]:
        """Return conversations for a user, newest first (cursor-based pagination)."""
        query: dict = {"user_id": user_id}
        if before is not None:
            query["updated_at"] = {"$lt": before}

        cursor = self._col.find(query).sort("updated_at", -1).limit(limit)
        return [_to_model(doc) async for doc in cursor]

    async def get(self, conversation_id: str) -> Conversation | None:
        """Find a conversation by ID, or return None."""
        doc = await self._col.find_one({"_id": ObjectId(conversation_id)})
        return _to_model(doc) if doc else None

    async def delete(self, conversation_id: str) -> bool:
        """Delete a conversation. Returns True if a document was removed."""
        result = await self._col.delete_one({"_id": ObjectId(conversation_id)})
        return result.deleted_count > 0

    async def touch(self, conversation_id: str) -> None:
        """Bump updated_at to now."""
        await self._col.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"updated_at": datetime.now(timezone.utc)}},
        )

    async def set_title(self, conversation_id: str, title: str) -> None:
        """Set the title on a conversation (used after first user message)."""
        await self._col.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"title": title}},
        )
