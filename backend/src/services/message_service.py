"""Business logic for sending and listing messages."""

from collections.abc import AsyncGenerator
from datetime import datetime

from models.schemas import Message, ToolStep
from repositories.conversation_repo import ConversationRepo
from repositories.message_repo import MessageRepo
from services.bot_service import BotService
from services.file_service import FileService

MAX_TITLE_LENGTH = 80


class MessageService:
    def __init__(
        self,
        message_repo: MessageRepo,
        conversation_repo: ConversationRepo,
        bot_service: BotService,
        file_service: FileService,
    ) -> None:
        self._messages = message_repo
        self._conversations = conversation_repo
        self._bot = bot_service
        self._files = file_service

    async def send_stream(
        self,
        conversation_id: str,
        content: str,
        file_ids: list[str] | None = None,
    ) -> AsyncGenerator[ToolStep | tuple[Message, Message], None]:
        """Stream tool steps, then yield the final (user_msg, assistant_msg) tuple."""
        files = []
        if file_ids:
            files = await self._files.resolve_file_ids(file_ids)

        user_msg = await self._messages.create(
            conversation_id=conversation_id,
            role="user",
            content=content,
            files=files,
        )

        await self._maybe_set_title(conversation_id, content)
        await self._conversations.touch(conversation_id)

        history = await self._messages.find_by_conversation(conversation_id)
        collected_steps: list[ToolStep] = []
        assistant_content = ""

        async for item in self._bot.generate_response_stream(
            conversation_id=conversation_id,
            history=history,
        ):
            if isinstance(item, ToolStep):
                collected_steps.append(item)
                yield item
            else:
                assistant_content = item

        assistant_msg = await self._messages.create(
            conversation_id=conversation_id,
            role="assistant",
            content=assistant_content,
            steps=collected_steps,
        )

        yield user_msg, assistant_msg

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
