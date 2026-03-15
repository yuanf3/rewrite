"""Routes for file uploads (phase 4)."""

from fastapi import APIRouter

router = APIRouter(prefix="/conversations/{conversation_id}/files", tags=["files"])

# File upload endpoint will be implemented in phase 4.
