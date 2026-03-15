"""Pydantic models for API requests, responses, and internal domain objects."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------


class MongoModel(BaseModel):
    """Base for models that map directly from MongoDB documents.

    Reads ``_id`` from the raw document via a field alias and converts
    the ``ObjectId`` to a plain string automatically.

    Usage:
        doc = await collection.find_one(...)
        model = Conversation(**doc)
    """

    id: str = Field(alias="_id")

    model_config = {"populate_by_name": True}

    @field_validator("id", mode="before")
    @classmethod
    def convert_objectid(cls, v):
        return str(v)


# ---------------------------------------------------------------------------
# Embedded / shared
# ---------------------------------------------------------------------------


class FileRef(BaseModel):
    """Reference to an uploaded file, embedded on message docs."""

    file_id: str
    filename: str
    content_type: str


# ---------------------------------------------------------------------------
# Conversation
# ---------------------------------------------------------------------------


class ConversationCreate(BaseModel):
    """POST /api/conversations request body."""

    user_id: str


class Conversation(MongoModel):
    """Conversation as returned to the client."""

    user_id: str
    title: str | None = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Message
# ---------------------------------------------------------------------------


class MessageCreate(BaseModel):
    """POST /api/conversations/{id}/messages request body."""

    content: str
    user_id: str
    file_ids: list[str] | None = None


class Message(MongoModel):
    """Message as returned to the client."""

    conversation_id: str
    role: Literal["user", "assistant"]
    content: str
    files: list[FileRef] = Field(default_factory=list)
    created_at: datetime


# ---------------------------------------------------------------------------
# File upload
# ---------------------------------------------------------------------------


class FileUploadResponse(BaseModel):
    """POST /api/conversations/{id}/files response."""

    file_id: str
    filename: str
    content_type: str
    status: str  # "ready" | "failed"
