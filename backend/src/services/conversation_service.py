"""Business logic for conversation lifecycle."""

import logging
import shutil
from datetime import datetime
from pathlib import Path

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchValue

from core.config import settings
from models.schemas import Conversation
from repositories.conversation_repo import ConversationRepo
from repositories.file_repo import FileRepo
from repositories.message_repo import MessageRepo

logger = logging.getLogger(__name__)


class ConversationService:
    def __init__(
        self,
        conversation_repo: ConversationRepo,
        message_repo: MessageRepo,
        qdrant_client: AsyncQdrantClient,
        file_repo: FileRepo,
    ) -> None:
        self._conversations = conversation_repo
        self._messages = message_repo
        self._qdrant = qdrant_client
        self._file_repo = file_repo

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
        await self._file_repo.delete_by_conversation(conversation_id)
        await self._cleanup_vectors(conversation_id)
        self._cleanup_files(conversation_id)
        await self._conversations.delete(conversation_id)

    async def clear(self, conversation_id: str) -> None:
        """Remove all messages and associated data, but keep the conversation."""
        await self._messages.delete_by_conversation(conversation_id)
        await self._file_repo.delete_by_conversation(conversation_id)
        await self._cleanup_vectors(conversation_id)
        self._cleanup_files(conversation_id)

    async def delete_all_for_user(self, user_id: str) -> int:
        """Delete every conversation (and associated data) for a user."""
        conv_ids = await self._conversations.find_ids_by_user(user_id)
        for cid in conv_ids:
            await self._messages.delete_by_conversation(cid)
            await self._file_repo.delete_by_conversation(cid)
            await self._cleanup_vectors(cid)
            self._cleanup_files(cid)
        await self._conversations.delete_by_user(user_id)
        return len(conv_ids)

    # ------------------------------------------------------------------
    # Best-effort cleanup helpers — log and continue on failure
    # ------------------------------------------------------------------

    async def _cleanup_vectors(self, conversation_id: str) -> None:
        try:
            await self._qdrant.delete(
                collection_name=settings.qdrant_collection,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="conversation_id",
                            match=MatchValue(value=conversation_id),
                        )
                    ]
                ),
            )
        except Exception:
            logger.exception(
                "Failed to delete vectors for conversation %s", conversation_id
            )

    def _cleanup_files(self, conversation_id: str) -> None:
        try:
            path = Path(settings.upload_dir) / conversation_id
            if path.exists():
                shutil.rmtree(path)
        except Exception:
            logger.exception(
                "Failed to delete files for conversation %s", conversation_id
            )
