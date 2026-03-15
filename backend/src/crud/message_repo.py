from datetime import datetime, timezone


class MessageRepo:
    def __init__(self, db):
        self.collection = db.messages

    async def create(self, conversation_id, role, content, files=None):
        doc = {
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "files": files or [],
            "created_at": datetime.now(timezone.utc),
        }
        result = await self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def find_by_conversation(self, conversation_id, before=None, limit=100):
        query = {"conversation_id": conversation_id}
        if before:
            query["created_at"] = {"$lt": before}
        cursor = self.collection.find(query).sort("created_at", 1).limit(limit)
        return await cursor.to_list()

    async def delete_by_conversation(self, conversation_id):
        await self.collection.delete_many({"conversation_id": conversation_id})
