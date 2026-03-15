from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import db.mongo
import db.qdrant
from core.config import settings
from core.logging import logger
from repositories.conversation_repo import ConversationRepo
from repositories.message_repo import MessageRepo
from routes import conversations, files, messages
from services.bot_service import BotService
from services.conversation_service import ConversationService
from services.message_service import MessageService


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db.mongo.connect()
    await db.mongo.ensure_indexes()
    await db.qdrant.connect()

    mongo = db.mongo.get_database()
    qdrant = db.qdrant.get_client()

    conversation_repo = ConversationRepo(mongo)
    message_repo = MessageRepo(mongo)
    bot_service = BotService()

    app.state.conversation_service = ConversationService(
        conversation_repo, message_repo, qdrant
    )
    app.state.message_service = MessageService(
        message_repo, conversation_repo, bot_service
    )

    yield

    # Shutdown
    await db.mongo.close()
    await db.qdrant.close()


# Initialize FastAPI app
app = FastAPI(
    title="Backend API", description="Backend API for chatbot", lifespan=lifespan
)

# CORS configuration for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(conversations.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(files.router, prefix="/api")

if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Backend")
    logger.info(f"Server: http://{settings.api_host}:{settings.api_port}")
    logger.info(f"API Docs: http://{settings.api_host}:{settings.api_port}/docs")

    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
        log_level="info",
    )
