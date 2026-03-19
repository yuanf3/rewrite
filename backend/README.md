# Backend

Python FastAPI backend with a LangGraph ReAct agent for RAG-powered conversational AI.

## Setup

```bash
# From project root
cd backend
uv sync          # Install dependencies
cd src && uv run main.py  # Start server (default: localhost:8000)
```

Requires a running MongoDB, Qdrant, and Keycloak instance (see root `docker compose`).

## Architecture

```
src/
├── main.py              # FastAPI app, lifespan, router registration
├── dependencies.py      # DI helpers (service injection, ownership check)
├── core/
│   ├── config.py        # Pydantic Settings from root .env
│   ├── auth.py          # Keycloak JWT validation (RS256 via JWKS)
│   └── logging.py       # Logging setup
├── db/
│   ├── mongo.py         # AsyncMongoClient singleton + index creation
│   └── qdrant.py        # AsyncQdrantClient singleton + collection setup
├── models/
│   └── schemas.py       # Pydantic models (Conversation, Message, FileRef, etc.)
├── repositories/
│   ├── conversation_repo.py  # conversations collection
│   ├── message_repo.py       # messages collection
│   └── file_repo.py          # files metadata collection
├── services/
│   ├── bot_service.py          # LangGraph ReAct agent with RAG tools
│   ├── conversation_service.py # Conversation lifecycle + cascading deletes
│   ├── message_service.py      # Message flow + bot invocation
│   └── file_service.py         # Upload pipeline: extract -> chunk -> embed -> store
└── routes/
    ├── conversations.py   # CRUD endpoints
    ├── messages.py        # Send/list messages
    └── files.py           # File upload
```

### Layer Pattern

**Routes -> Services -> Repositories -> MongoDB/Qdrant**

- **Routes** — Thin HTTP handlers with dependency injection. All require JWT auth.
- **Services** — Business logic orchestration. Handle cascading operations (e.g. deleting a conversation removes its messages, files, vectors, and disk files).
- **Repositories** — Async MongoDB collection wrappers with cursor-based pagination.
- **DB clients** — Module-level singletons initialized during FastAPI lifespan.

### Bot Service (RAG Agent)

`bot_service.py` implements a LangGraph ReAct agent with two tools:

- **`retrieve_documents`** — Embeds the query via FastEmbed, searches Qdrant filtered by `conversation_id`, returns top 5 chunks.
- **`get_current_time`** — Returns current UTC time.

The agent loops (LLM -> tool call -> tool result -> LLM) until it produces a final response.

### File Processing Pipeline

1. Save uploaded file to `./uploads/{conversation_id}/{file_id}/{filename}`
2. Extract text (PDF via pypdf, DOCX via python-docx, TXT/MD as UTF-8)
3. Split into 500-word chunks with 50-word overlap
4. Generate embeddings via FastEmbed (`sentence-transformers/all-MiniLM-L6-v2`)
5. Store vectors in Qdrant with metadata (`conversation_id`, `file_id`, `filename`, `chunk_index`, `text`)
6. Save file metadata to MongoDB

Supported formats: PDF, DOCX, TXT, MD.

## API Endpoints

All endpoints are prefixed with `/api` and require a valid JWT Bearer token.

### Conversations

| Method | Endpoint                         | Purpose                 |
| ------ | -------------------------------- | ----------------------- |
| POST   | `/api/conversations`             | Create conversation     |
| GET    | `/api/conversations`             | List user conversations |
| DELETE | `/api/conversations`             | Delete all              |
| DELETE | `/api/conversations/{id}`        | Delete one              |
| POST   | `/api/conversations/{id}/clear`  | Clear messages & files  |

### Messages

| Method | Endpoint                             | Purpose                           |
| ------ | ------------------------------------ | --------------------------------- |
| GET    | `/api/conversations/{id}/messages`   | List messages (cursor pagination) |
| POST   | `/api/conversations/{id}/messages`   | Send message, get bot response    |

POST body: `{ "content": "...", "file_ids": ["..."] | null }`
Returns: `MessagePair` (user message + assistant message).

### Files

| Method | Endpoint                          | Purpose     |
| ------ | --------------------------------- | ----------- |
| POST   | `/api/conversations/{id}/files`   | Upload file |

Multipart form upload. Returns `{ file_id, filename, content_type, status }`.

## Authentication

JWT tokens issued by Keycloak are validated via the JWKS endpoint (RS256). The `get_current_user` dependency extracts `user_id`, `email`, and `username` from the token. Conversation ownership is enforced — users can only access their own data.

## Key Dependencies

| Package                    | Purpose                       |
| -------------------------- | ----------------------------- |
| `fastapi[standard]`        | Web framework + uvicorn       |
| `langchain-openai`         | OpenAI chat model integration |
| `langgraph`                | ReAct agent graph             |
| `pymongo`                  | Async MongoDB driver          |
| `qdrant-client[fastembed]` | Vector DB + embedding model   |
| `pydantic-settings`        | Config from .env              |
| `pyjwt[crypto]`            | JWT validation                |
| `pypdf`                    | PDF text extraction           |
| `python-docx`              | DOCX text extraction          |

## Environment Variables

Configured via root `.env` file (see `.env.example`). Key variables:

- `OPENAI_API_KEY` — Required, not checked in
- `OPENAI_MODEL` — Default: `gpt-4o-mini`
- `MONGO_*` — MongoDB connection settings
- `QDRANT_*` — Qdrant connection settings
- `KEYCLOAK_*` — Auth server settings
- `EMBEDDING_MODEL` / `EMBEDDING_DIMENSION` — Vector embedding config
