"""Routes for file uploads."""

from fastapi import APIRouter, Depends, UploadFile

from core.auth import AuthUser, get_current_user
from dependencies import (
    get_conversation_service,
    get_file_service,
    verify_conversation_ownership,
)
from models.schemas import FileUploadResponse
from services.conversation_service import ConversationService
from services.file_service import FileService

router = APIRouter(prefix="/conversations/{conversation_id}/files", tags=["files"])


@router.post("", response_model=FileUploadResponse, status_code=201)
async def upload_file(
    conversation_id: str,
    file: UploadFile,
    user: AuthUser = Depends(get_current_user),
    conv_service: ConversationService = Depends(get_conversation_service),
    service: FileService = Depends(get_file_service),
):
    await verify_conversation_ownership(conversation_id, user, conv_service)
    return await service.process_upload(conversation_id, file)
