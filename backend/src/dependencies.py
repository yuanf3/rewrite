"""FastAPI dependency helpers for injecting services into route handlers."""

from fastapi import HTTPException, Request, status

from core.auth import AuthUser
from models.schemas import Conversation
from services.conversation_service import ConversationService
from services.file_service import FileService
from services.message_service import MessageService


def get_conversation_service(request: Request) -> ConversationService:
    return request.app.state.conversation_service


def get_message_service(request: Request) -> MessageService:
    return request.app.state.message_service


def get_file_service(request: Request) -> FileService:
    return request.app.state.file_service


async def verify_conversation_ownership(
    conversation_id: str,
    user: AuthUser,
    service: ConversationService,
) -> Conversation:
    conv = await service.get(conversation_id)
    if not conv or conv.user_id != user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return conv
