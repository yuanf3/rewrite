"""Bot service — LangGraph ReAct agent with RAG retrieval and tool calling."""

import asyncio
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

from fastembed import TextEmbedding
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from qdrant_client import AsyncQdrantClient

from core.config import settings
from core.logging import logger
from models.schemas import Message, TokenChunk, ToolStep


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
        )

    def _build_graph(self, conversation_id: str) -> StateGraph:
        """Build a ReAct agent graph scoped to a conversation."""

        qdrant = self._qdrant
        embedding = self._embedding
        collection = settings.qdrant_collection

        async def retrieve_documents(query: str) -> str:
            """Search uploaded documents for relevant context using semantic similarity."""
            vectors = await asyncio.to_thread(lambda: list(embedding.embed([query])))
            results = await qdrant.query_points(
                collection_name=collection,
                query=vectors[0].tolist(),
                query_filter={
                    "must": [
                        {"key": "conversation_id", "match": {"value": conversation_id}}
                    ]
                },
                limit=5,
            )
            if not results.points:
                return "No relevant documents found."
            return "\n---\n".join(p.payload.get("text", "") for p in results.points)

        def get_current_time() -> str:
            """Return the current UTC date and time."""
            return datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")

        tools = [retrieve_documents, get_current_time]
        llm_with_tools = self._llm.bind_tools(tools)

        async def agent(state: MessagesState) -> dict:
            return {"messages": [await llm_with_tools.ainvoke(state["messages"])]}

        def should_continue(state: MessagesState) -> str:
            last = state["messages"][-1]
            if isinstance(last, AIMessage) and last.tool_calls:
                return "tools"
            return END

        graph = StateGraph(MessagesState)
        graph.add_node("agent", agent)
        graph.add_node("tools", ToolNode(tools))
        graph.set_entry_point("agent")
        graph.add_conditional_edges(
            "agent", should_continue, {"tools": "tools", END: END}
        )
        graph.add_edge("tools", "agent")

        return graph.compile()

    async def generate_response_stream(
        self,
        conversation_id: str,
        history: list[Message],
    ) -> AsyncGenerator[ToolStep | TokenChunk, None]:
        """Stream agent execution, yielding ToolSteps and TokenChunks."""
        try:
            lc_messages = []
            for msg in history:
                if msg.role == "user":
                    lc_messages.append(HumanMessage(content=msg.content))
                else:
                    lc_messages.append(AIMessage(content=msg.content))

            graph = self._build_graph(conversation_id)
            pending_tool_calls: dict[str, dict] = {}

            async for mode, chunk in graph.astream(
                {"messages": lc_messages}, stream_mode=["updates", "messages"]
            ):
                if mode == "updates":
                    for _node_name, update in chunk.items():
                        msgs = update.get("messages", [])
                        for m in msgs:
                            if isinstance(m, AIMessage) and m.tool_calls:
                                for tc in m.tool_calls:
                                    pending_tool_calls[tc["id"]] = {
                                        "tool_name": tc["name"],
                                        "tool_input": tc["args"],
                                    }
                            elif hasattr(m, "tool_call_id") and m.tool_call_id:
                                tc_info = pending_tool_calls.pop(m.tool_call_id, None)
                                if tc_info:
                                    yield ToolStep(
                                        tool_name=tc_info["tool_name"],
                                        tool_input=tc_info["tool_input"],
                                        result=m.content
                                        if isinstance(m.content, str)
                                        else str(m.content),
                                    )

                elif mode == "messages":
                    msg_chunk, _metadata = chunk
                    if (
                        isinstance(msg_chunk, AIMessageChunk)
                        and msg_chunk.content
                        and not msg_chunk.tool_call_chunks
                    ):
                        yield TokenChunk(content=msg_chunk.content)

            logger.info("Agent finished for conversation %s", conversation_id)
        except Exception as e:
            logger.error("Agent failed for conversation %s: %s", conversation_id, e)
            yield TokenChunk(content=f"Something went wrong: {e}")
