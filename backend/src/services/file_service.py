"""File upload processing: save, extract text, chunk, embed, and store vectors."""

import asyncio
import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from fastembed import TextEmbedding
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import PointStruct

from core.config import settings
from models.schemas import FileRef, FileUploadResponse
from repositories.file_repo import FileRepo

logger = logging.getLogger(__name__)

ALLOWED_TYPES: dict[str, str] = {
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/markdown": "md",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}


class FileService:
    def __init__(
        self,
        file_repo: FileRepo,
        qdrant_client: AsyncQdrantClient,
        embedding_model: TextEmbedding,
    ) -> None:
        self._files = file_repo
        self._qdrant = qdrant_client
        self._model = embedding_model

    async def process_upload(
        self,
        conversation_id: str,
        file: UploadFile,
    ) -> FileUploadResponse:
        content_type = file.content_type or ""
        if content_type not in ALLOWED_TYPES:
            accepted = ", ".join(ALLOWED_TYPES.values())
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {content_type}. Accepted: {accepted}",
            )

        file_id = str(uuid.uuid4())
        filename = file.filename or "unnamed"

        # Save to disk
        save_dir = Path(settings.upload_dir) / conversation_id / file_id
        save_dir.mkdir(parents=True, exist_ok=True)
        save_path = save_dir / filename
        data = await file.read()
        save_path.write_bytes(data)

        try:
            text = self._extract_text(save_path, content_type)
            chunks = self._chunk_text(text)

            if chunks:
                embeddings = await asyncio.to_thread(
                    lambda: list(self._model.embed(chunks))
                )
                points = [
                    PointStruct(
                        id=str(uuid.uuid4()),
                        vector=emb.tolist(),
                        payload={
                            "conversation_id": conversation_id,
                            "file_id": file_id,
                            "filename": filename,
                            "chunk_index": i,
                            "text": chunk,
                        },
                    )
                    for i, (chunk, emb) in enumerate(zip(chunks, embeddings))
                ]
                await self._qdrant.upsert(
                    collection_name=settings.qdrant_collection,
                    points=points,
                )

            await self._files.create(file_id, conversation_id, filename, content_type)

            return FileUploadResponse(
                file_id=file_id,
                filename=filename,
                content_type=content_type,
                status="ready",
            )
        except HTTPException:
            raise
        except Exception:
            logger.exception("Failed to process file %s", filename)
            return FileUploadResponse(
                file_id=file_id,
                filename=filename,
                content_type=content_type,
                status="failed",
            )

    async def resolve_file_ids(self, file_ids: list[str]) -> list[FileRef]:
        """Resolve file_ids to FileRef objects for message attachment."""
        return await self._files.get_many(file_ids)

    @staticmethod
    def _extract_text(path: Path, content_type: str) -> str:
        kind = ALLOWED_TYPES[content_type]
        if kind in ("txt", "md"):
            return path.read_text(encoding="utf-8", errors="replace")
        if kind == "pdf":
            from pypdf import PdfReader

            reader = PdfReader(str(path))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        if kind == "docx":
            from docx import Document

            doc = Document(str(path))
            return "\n".join(p.text for p in doc.paragraphs)
        return ""

    @staticmethod
    def _chunk_text(
        text: str,
        max_words: int = 500,
        overlap: int = 50,
    ) -> list[str]:
        """Split text into overlapping word-based chunks."""
        words = text.split()
        if not words:
            return []
        chunks: list[str] = []
        start = 0
        while start < len(words):
            end = start + max_words
            chunks.append(" ".join(words[start:end]))
            start = end - overlap
        return chunks
