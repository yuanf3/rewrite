from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import db.mongo
import db.qdrant
from core.config import settings
from core.logging import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db.mongo.connect()
    await db.qdrant.connect()
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
# app.include_router(book_router)

if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Backend")
    logger.info(f"Server: http://{settings.api_host}/{settings.api_port}")
    logger.info(f"API Docs: http://{settings.api_host}/{settings.api_port}/docs")

    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
        log_level="info",
    )
