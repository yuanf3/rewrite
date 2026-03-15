from datetime import datetime, timezone

from bson import ObjectId


class ConversationRepo:
    def __init__(self, db):
        self.collection = db.conversations

    async def create(self, user_id, title=None):
        now = datetime.now(timezone.utc)
        doc = {
            "user_id": user_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def find_by_user(self, user_id, before=None, limit=50):
        query = {"user_id": user_id}
        if before:
            query["updated_at"] = {"$lt": before}
        cursor = self.collection.find(query).sort("updated_at", -1).limit(limit)
        return await cursor.to_list()

    async def get(self, conversation_id):
        return await self.collection.find_one({"_id": ObjectId(conversation_id)})

    async def delete(self, conversation_id):
        await self.collection.delete_one({"_id": ObjectId(conversation_id)})

    async def touch(self, conversation_id):
        await self.collection.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"updated_at": datetime.now(timezone.utc)}},
        )

    async def set_title(self, conversation_id, title):
        await self.collection.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"title": title}},
        )
