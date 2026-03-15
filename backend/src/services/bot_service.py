"""Stub bot service — placeholder until real LLM integration (phase 5)."""

from models.schemas import Message


class BotService:
    async def generate_response(
        self,
        conversation_id: str,
        history: list[Message],
    ) -> str:
        """Return a placeholder assistant response.

        The real implementation will receive the full message history and
        query the Qdrant vector store (scoped to conversation_id) for RAG
        retrieval. For now, just echo back a confirmation.
        """
        return "This is a placeholder response."
