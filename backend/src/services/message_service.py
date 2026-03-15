"""Business logic for sending and listing messages."""

from datetime import datetime

from models.schemas import Message
from repositories.conversation_repo import ConversationRepo
from repositories.message_repo import MessageRepo
from services.bot_service import BotService

MAX_TITLE_LENGTH = 80


class MessageService:
    def __init__(
        self,
        message_repo: MessageRepo,
        conversation_repo: ConversationRepo,
        bot_service: BotService,
    ) -> None:
        self._messages = message_repo
        self._conversations = conversation_repo
        self._bot = bot_service

    async def send(
        self,
        conversation_id: str,
        content: str,
        file_ids: list[str] | None = None,
    ) -> tuple[Message, Message]:
        """Persist a user message, generate a bot reply, and return both."""
        user_msg = await self._messages.create(
            conversation_id=conversation_id,
            role="user",
            content=content,
        )

        await self._maybe_set_title(conversation_id, content)
        await self._conversations.touch(conversation_id)

        history = await self._messages.find_by_conversation(conversation_id)
        assistant_content = await self._bot.generate_response(
            conversation_id=conversation_id,
            history=history,
        )

        assistant_msg = await self._messages.create(
            conversation_id=conversation_id,
            role="assistant",
            content=assistant_content,
        )

        return user_msg, assistant_msg

    async def list(
        self,
        conversation_id: str,
        before: datetime | None = None,
        limit: int = 100,
    ) -> list[Message]:
        return await self._messages.find_by_conversation(
            conversation_id,
            before=before,
            limit=limit,
        )

    async def _maybe_set_title(self, conversation_id: str, content: str) -> None:
        """Set the conversation title from the first user message."""
        conversation = await self._conversations.get(conversation_id)
        if conversation and conversation.title is None:
            title = content[:MAX_TITLE_LENGTH].strip()
            await self._conversations.set_title(conversation_id, title)
