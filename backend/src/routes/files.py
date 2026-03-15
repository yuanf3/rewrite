"""Routes for file uploads."""

from fastapi import APIRouter, Depends, UploadFile

from dependencies import get_file_service
from models.schemas import FileUploadResponse
from services.file_service import FileService

router = APIRouter(prefix="/conversations/{conversation_id}/files", tags=["files"])


@router.post("", response_model=FileUploadResponse, status_code=201)
async def upload_file(
    conversation_id: str,
    file: UploadFile,
    service: FileService = Depends(get_file_service),
):
    return await service.process_upload(conversation_id, file)
