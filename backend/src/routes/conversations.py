"""Routes for conversation CRUD."""

from datetime import datetime

from fastapi import APIRouter, Depends

from dependencies import get_conversation_service
from models.schemas import Conversation, ConversationCreate
from services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.post("", response_model=Conversation, status_code=201)
async def create_conversation(
    body: ConversationCreate,
    service: ConversationService = Depends(get_conversation_service),
):
    return await service.create(user_id=body.user_id)


@router.get("", response_model=list[Conversation])
async def list_conversations(
    user_id: str,
    before: datetime | None = None,
    limit: int = 50,
    service: ConversationService = Depends(get_conversation_service),
):
    return await service.list_for_user(user_id, before=before, limit=limit)


@router.delete("", status_code=204)
async def delete_all_conversations(
    user_id: str,
    service: ConversationService = Depends(get_conversation_service),
):
    await service.delete_all_for_user(user_id)


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    service: ConversationService = Depends(get_conversation_service),
):
    await service.delete(conversation_id)


@router.post("/{conversation_id}/clear", status_code=204)
async def clear_conversation(
    conversation_id: str,
    service: ConversationService = Depends(get_conversation_service),
):
    await service.clear(conversation_id)
