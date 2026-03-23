"""Bot service — LangGraph ReAct agent with flexible tool-based workflow."""

import asyncio
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Annotated, Any

from fastembed import TextEmbedding
from langchain.agents import AgentState, create_agent
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import InjectedState
from qdrant_client import AsyncQdrantClient

from core.config import settings
from core.logging import logger
from models.schemas import Message, TokenChunk, ToolStep

# ------------------------------------------------------------------
# Tool registry — single source of truth for metadata
# ------------------------------------------------------------------


@dataclass(frozen=True)
class ToolInfo:
    label: str
    emoji: str
    thought_template: str
    input_fmt: str
    max_output: int = 300


TOOLS: dict[str, ToolInfo] = {
    "retrieve_documents": ToolInfo(
        label="Retrieving Documents",
        emoji="📚",
        thought_template='search documents for "{query}"',
        input_fmt="Query: {query}",
    ),
    "search_glossary": ToolInfo(
        label="Searching Glossary",
        emoji="🔎",
        thought_template="look up terms: {terms}",
        input_fmt="Terms: {terms}",
    ),
    "think": ToolInfo(
        label="Thinking",
        emoji="🧠",
        thought_template="think through the problem",
        input_fmt="{thought}",
        max_output=500,
    ),
}

# TODO
SYSTEM_PROMPT = """\
You are a helpful AI assistant with access to tools.

**Guidelines:**
- For complex or multi-part questions, use the `think` tool first to plan \
your approach and break down the problem.
- Retrieve documents when the question may relate to uploaded files. You can \
search multiple times with different queries.
- Use `think` to reason through, compare, or synthesise information you've \
gathered before answering.
- When you have enough information, respond directly without calling more tools.
- If no documents are relevant, say so honestly.
- Be concise and accurate.
"""


# ------------------------------------------------------------------
# Tool definitions
# ------------------------------------------------------------------


def _make_tools(
    qdrant: AsyncQdrantClient,
    embedding: TextEmbedding,
) -> list:
    """Build the tool list. Each tool closes over the shared clients."""

    @tool
    async def retrieve_documents(
        query: str,
        state: Annotated[dict, InjectedState],
    ) -> str:
        """Search uploaded documents for chunks relevant to the query.

        Args:
            query: A focused search query describing what to look for.
        """
        conversation_id = state.get("conversation_id", "")
        if not conversation_id:
            return "No conversation context available for document search."

        vectors = await asyncio.to_thread(lambda: list(embedding.embed([query])))
        results = await qdrant.query_points(
            collection_name=settings.qdrant_collection,
            query=vectors[0].tolist(),
            query_filter={
                "must": [
                    {
                        "key": "conversation_id",
                        "match": {"value": conversation_id},
                    }
                ]
            },
            limit=15,
        )

        if not results.points:
            return "No relevant documents found."

        chunks = []
        for i, pt in enumerate(results.points, 1):
            text = pt.payload.get("text", "")
            source = pt.payload.get("filename", "unknown")
            chunks.append(f"[{i}] (source: {source})\n{text}")

        return "\n------\n".join(chunks)

    @tool
    async def search_glossary(terms: str) -> str:  # TODO
        """Look up acronyms, abbreviations, or technical terms.

        Args:
            terms: Comma-separated list of terms to look up.
        """
        term_list = [t.strip() for t in terms.split(",") if t.strip()]
        if not term_list:
            return "No terms provided."

        # Placeholder — integrate a real glossary source here
        return (
            f"Glossary lookup for: {', '.join(term_list)}. "
            "No definitions found in glossary database."
        )

    @tool
    async def search_adaptation(terms: str) -> str:  # TODO
        """Look up VSPs in Adaptation data.

        Args:
            terms: Comma-separated list of terms to look up.
        """
        term_list = [t.strip() for t in terms.split(",") if t.strip()]
        if not term_list:
            return "No terms provided."

        # Placeholder — integrate a real glossary source here
        return (
            f"Glossary lookup for: {', '.join(term_list)}. "
            "No definitions found in adaptation database."
        )

    @tool
    def think(thought: str) -> str:
        """Think step-by-step: plan your approach, reason about gathered \
information, or work through a complex problem before answering.

        Args:
            thought: Your planning, reasoning, or analysis.
        """
        logger.info(thought)
        return thought

    return [retrieve_documents, search_glossary, think]


# ------------------------------------------------------------------
# Agent state & service
# ------------------------------------------------------------------


class _AgentState(AgentState):
    """Agent state extended with conversation_id for tool access."""

    conversation_id: str


class BotService:
    def __init__(
        self,
        qdrant_client: AsyncQdrantClient,
        embedding_model: TextEmbedding,
    ) -> None:
        self._qdrant = qdrant_client
        self._embedding = embedding_model
        self._llm = ChatOpenAI(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            temperature=0,
        )
        self._tools = _make_tools(self._qdrant, self._embedding)
        self._graph = create_agent(
            model=self._llm,
            tools=self._tools,
            system_prompt=SYSTEM_PROMPT,
            state_schema=_AgentState,
        )

    def _build_initial_state(
        self, conversation_id: str, history: list[Message]
    ) -> dict[str, Any]:
        """Convert message history into the initial agent state."""
        lc_messages = []
        for msg in history:
            if msg.role == "user":
                lc_messages.append(HumanMessage(content=msg.content))
            else:
                lc_messages.append(AIMessage(content=msg.content))
        return {
            "messages": lc_messages,
            "conversation_id": conversation_id,
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate_response_stream(
        self,
        conversation_id: str,
        history: list[Message],
    ) -> AsyncGenerator[ToolStep | TokenChunk, None]:
        """Stream agent execution, yielding ToolSteps and TokenChunks."""
        try:
            state = self._build_initial_state(conversation_id, history)
            pending: dict[str, dict[str, Any]] = {}

            async for event in self._graph.astream_events(state, version="v2"):
                kind = event.get("event", "")
                name = event.get("name", "")
                run_id = event.get("run_id", "")

                if kind == "on_tool_start" and name in TOOLS:
                    raw_input = event.get("data", {}).get("input", {})
                    pending[run_id] = {
                        "tool_name": name,
                        "tool_input": raw_input,
                    }

                elif kind == "on_tool_end" and name in TOOLS:
                    raw_output = event.get("data", {}).get("output", "")
                    if hasattr(raw_output, "content"):
                        raw_output = raw_output.content
                    tc_info = pending.pop(run_id, None)
                    if tc_info:
                        yield ToolStep(
                            tool_name=tc_info["tool_name"],
                            tool_input=tc_info["tool_input"],
                            result=str(raw_output),
                        )

                elif kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk", None)
                    if (
                        isinstance(chunk, AIMessageChunk)
                        and chunk.content
                        and not chunk.tool_call_chunks
                    ):
                        yield TokenChunk(content=chunk.content)

            logger.info("Agent finished for conversation %s", conversation_id)
        except Exception as e:
            logger.error("Agent failed for conversation %s: %s", conversation_id, e)
            yield TokenChunk(content=f"Something went wrong: {e}")
