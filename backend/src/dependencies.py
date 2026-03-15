"""FastAPI dependency helpers for injecting services into route handlers."""

from fastapi import Request

from services.conversation_service import ConversationService
from services.message_service import MessageService


def get_conversation_service(request: Request) -> ConversationService:
    return request.app.state.conversation_service


def get_message_service(request: Request) -> MessageService:
    return request.app.state.message_service
