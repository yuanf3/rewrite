"""Business logic for conversation lifecycle."""

import logging
from datetime import datetime

from models.schemas import Conversation
from repositories.conversation_repo import ConversationRepo
from repositories.message_repo import MessageRepo
from services.file_service import FileService

logger = logging.getLogger(__name__)


class ConversationService:
    def __init__(
        self,
        conversation_repo: ConversationRepo,
        message_repo: MessageRepo,
        file_service: FileService,
    ) -> None:
        self._conversations = conversation_repo
        self._messages = message_repo
        self._file_service = file_service

    async def get(self, conversation_id: str) -> Conversation | None:
        return await self._conversations.get(conversation_id)

    async def create(self, user_id: str) -> Conversation:
        return await self._conversations.create(user_id=user_id)

    async def list_for_user(
        self,
        user_id: str,
        before: datetime | None = None,
        limit: int = 50,
    ) -> list[Conversation]:
        return await self._conversations.find_by_user(
            user_id, before=before, limit=limit
        )

    async def delete(self, conversation_id: str) -> None:
        """Delete a conversation and all associated data across stores."""
        await self._messages.delete_by_conversation(conversation_id)
        await self._file_service.delete_by_conversation(conversation_id)
        await self._conversations.delete(conversation_id)

    async def clear(self, conversation_id: str) -> None:
        """Remove all messages and associated data, but keep the conversation."""
        await self._messages.delete_by_conversation(conversation_id)
        await self._file_service.delete_by_conversation(conversation_id)

    async def delete_all_for_user(self, user_id: str) -> int:
        """Delete every conversation (and associated data) for a user."""
        conv_ids = await self._conversations.find_ids_by_user(user_id)
        for cid in conv_ids:
            await self._messages.delete_by_conversation(cid)
            await self._file_service.delete_by_conversation(cid)
        await self._conversations.delete_by_user(user_id)
        return len(conv_ids)
