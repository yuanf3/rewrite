"""Routes for messages within a conversation."""

from datetime import datetime

from fastapi import APIRouter, Depends

from core.auth import AuthUser, get_current_user
from dependencies import (
    get_conversation_service,
    get_message_service,
    verify_conversation_ownership,
)
from models.schemas import Message, MessageCreate, MessagePair
from services.conversation_service import ConversationService
from services.message_service import MessageService

router = APIRouter(
    prefix="/conversations/{conversation_id}/messages", tags=["messages"]
)


@router.get("", response_model=list[Message])
async def list_messages(
    conversation_id: str,
    before: datetime | None = None,
    limit: int = 100,
    user: AuthUser = Depends(get_current_user),
    conv_service: ConversationService = Depends(get_conversation_service),
    service: MessageService = Depends(get_message_service),
):
    await verify_conversation_ownership(conversation_id, user, conv_service)
    return await service.list(conversation_id, before=before, limit=limit)


@router.post("", response_model=MessagePair, status_code=201)
async def send_message(
    conversation_id: str,
    body: MessageCreate,
    user: AuthUser = Depends(get_current_user),
    conv_service: ConversationService = Depends(get_conversation_service),
    service: MessageService = Depends(get_message_service),
):
    await verify_conversation_ownership(conversation_id, user, conv_service)
    user_msg, assistant_msg = await service.send(
        conversation_id=conversation_id,
        content=body.content,
        file_ids=body.file_ids,
    )
    return MessagePair(user_message=user_msg, assistant_message=assistant_msg)
