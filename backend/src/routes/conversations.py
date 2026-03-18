"""Routes for conversation CRUD."""

from datetime import datetime

from fastapi import APIRouter, Depends

from core.auth import AuthUser, get_current_user
from dependencies import get_conversation_service, verify_conversation_ownership
from models.schemas import Conversation
from services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.post("", response_model=Conversation, status_code=201)
async def create_conversation(
    user: AuthUser = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
):
    return await service.create(user_id=user.user_id)


@router.get("", response_model=list[Conversation])
async def list_conversations(
    before: datetime | None = None,
    limit: int = 50,
    user: AuthUser = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
):
    return await service.list_for_user(user.user_id, before=before, limit=limit)


@router.delete("", status_code=204)
async def delete_all_conversations(
    user: AuthUser = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
):
    await service.delete_all_for_user(user.user_id)


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    user: AuthUser = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
):
    await verify_conversation_ownership(conversation_id, user, service)
    await service.delete(conversation_id)


@router.post("/{conversation_id}/clear", status_code=204)
async def clear_conversation(
    conversation_id: str,
    user: AuthUser = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
):
    await verify_conversation_ownership(conversation_id, user, service)
    await service.clear(conversation_id)
