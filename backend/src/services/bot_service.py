"""Bot service — LangGraph ReAct agent with RAG retrieval and tool calling."""

import asyncio
from datetime import UTC, datetime

from fastembed import TextEmbedding
from langchain_core.messages import AIMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from qdrant_client import AsyncQdrantClient

from core.config import settings
from core.logging import logger
from models.schemas import Message


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

    async def generate_response(
        self,
        conversation_id: str,
        history: list[Message],
    ) -> str:
        """Run the ReAct agent and return the final assistant message."""
        try:
            lc_messages = []
            for msg in history:
                if msg.role == "user":
                    lc_messages.append(HumanMessage(content=msg.content))
                else:
                    lc_messages.append(AIMessage(content=msg.content))

            graph = self._build_graph(conversation_id)
            result = await graph.ainvoke({"messages": lc_messages})

            final = result["messages"][-1]
            logger.info(
                "Agent finished — %d total messages in trace", len(result["messages"])
            )
            return final.content
        except Exception as e:
            logger.error("Agent failed for conversation %s: %s", conversation_id, e)
            return f"Something went wrong: {e}"
