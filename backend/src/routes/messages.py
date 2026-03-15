"""Routes for messages within a conversation."""

from datetime import datetime

from fastapi import APIRouter, Depends

from dependencies import get_message_service
from models.schemas import Message, MessageCreate, MessagePair
from services.message_service import MessageService

router = APIRouter(
    prefix="/conversations/{conversation_id}/messages", tags=["messages"]
)


@router.get("", response_model=list[Message])
async def list_messages(
    conversation_id: str,
    before: datetime | None = None,
    limit: int = 100,
    service: MessageService = Depends(get_message_service),
):
    return await service.list(conversation_id, before=before, limit=limit)


@router.post("", response_model=MessagePair, status_code=201)
async def send_message(
    conversation_id: str,
    body: MessageCreate,
    service: MessageService = Depends(get_message_service),
):
    user_msg, assistant_msg = await service.send(
        conversation_id=conversation_id,
        content=body.content,
        file_ids=body.file_ids,
    )
    return MessagePair(user_message=user_msg, assistant_message=assistant_msg)
