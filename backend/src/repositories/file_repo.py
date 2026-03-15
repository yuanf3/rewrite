"""Repository for the `files` MongoDB collection.

Stores lightweight metadata for uploaded files so that file_ids
can be resolved to FileRef objects when attaching to messages.
"""

from pymongo.asynchronous.database import AsyncDatabase

from models.schemas import FileRef


class FileRepo:
    def __init__(self, db: AsyncDatabase) -> None:
        self._col = db.files

    async def create(
        self,
        file_id: str,
        conversation_id: str,
        filename: str,
        content_type: str,
    ) -> FileRef:
        """Insert file metadata after a successful upload."""
        doc = {
            "_id": file_id,
            "conversation_id": conversation_id,
            "filename": filename,
            "content_type": content_type,
        }
        await self._col.insert_one(doc)
        return FileRef(file_id=file_id, filename=filename, content_type=content_type)

    async def get_many(self, file_ids: list[str]) -> list[FileRef]:
        """Resolve a list of file_ids to FileRef objects."""
        cursor = self._col.find({"_id": {"$in": file_ids}})
        return [
            FileRef(
                file_id=str(doc["_id"]),
                filename=doc["filename"],
                content_type=doc["content_type"],
            )
            async for doc in cursor
        ]

    async def delete_by_conversation(self, conversation_id: str) -> int:
        """Delete all file metadata for a conversation."""
        result = await self._col.delete_many({"conversation_id": conversation_id})
        return result.deleted_count
