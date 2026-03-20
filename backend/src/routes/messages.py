"""Routes for messages within a conversation."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends
from starlette.responses import StreamingResponse

from core.auth import AuthUser, get_current_user
from core.logging import logger
from dependencies import (
    get_conversation_service,
    get_message_service,
    verify_conversation_ownership,
)
from models.schemas import Message, MessageCreate, ToolStep
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


@router.post("", status_code=201)
async def send_message(
    conversation_id: str,
    body: MessageCreate,
    user: AuthUser = Depends(get_current_user),
    conv_service: ConversationService = Depends(get_conversation_service),
    service: MessageService = Depends(get_message_service),
):
    await verify_conversation_ownership(conversation_id, user, conv_service)

    async def event_stream():
        try:
            async for item in service.send_stream(
                conversation_id=conversation_id,
                content=body.content,
                file_ids=body.file_ids,
            ):
                if isinstance(item, ToolStep):
                    yield f"event: step\ndata: {item.model_dump_json()}\n\n"
                else:
                    user_msg, assistant_msg = item
                    payload = json.dumps({
                        "user_message": user_msg.model_dump(by_alias=True),
                        "assistant_message": assistant_msg.model_dump(by_alias=True),
                    }, default=str)
                    yield f"event: done\ndata: {payload}\n\n"
        except Exception as e:
            logger.error("SSE stream error: %s", e)
            payload = json.dumps({"detail": str(e)})
            yield f"event: error\ndata: {payload}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
