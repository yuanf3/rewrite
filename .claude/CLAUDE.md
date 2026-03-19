# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A monorepo chatbot application with a React frontend and Python FastAPI backend, supporting RAG (Retrieval-Augmented Generation) via LangGraph ReAct agent with vector embeddings.

## Commands

### Development

```bash
make install        # Install all dependencies (npm + uv sync)
make start          # Run backend & frontend in parallel
make start-backend  # cd backend/src && uv run main.py
make start-frontend # cd frontend && npm run dev
make dstart         # docker compose up -d (MongoDB, Qdrant, Keycloak, Mongo Express)
make dstop          # docker compose down
make clean          # Remove build artifacts & caches
```

### Frontend (from `frontend/`)

```bash
npm run dev         # Vite dev server on port 5173
npm run build       # TypeScript check + Vite production build
npm run lint        # ESLint (flat config v9)
npm run format      # Prettier with Tailwind plugin
npm run typecheck   # TypeScript strict type checking
```

### Backend (from `backend/src/`)

```bash
uv run main.py      # Run FastAPI with uvicorn
uv sync             # Install/sync dependencies from pyproject.toml
```

### No tests configured — no test runner or test directory exists yet.

## Architecture

### Stack

- **Frontend:** React 19 + TypeScript + Vite 7, Tailwind CSS 4, shadcn/ui (radix-nova style), lucide-react, next-themes, sonner
- **Backend:** Python 3.13+ FastAPI (async), LangGraph + LangChain + OpenAI, MongoDB 7 (PyMongo async), Qdrant vector DB + FastEmbed
- **Package managers:** npm (frontend), uv (backend)

### Frontend–Backend Communication

Vite proxies `/api` → `http://localhost:8000` in dev. All API calls go through [frontend/src/api/client.ts](frontend/src/api/client.ts) as typed fetch wrappers.

### Backend Layer Pattern

Routes → Services → Repositories (MongoDB) + Qdrant

- **Routes** (`backend/src/routes/`): Thin HTTP handlers with dependency injection
- **Services** (`backend/src/services/`): Business logic orchestration
- **Repositories** (`backend/src/repositories/`): MongoDB collection wrappers (including `FileRepo` for file metadata)
- **DB clients** (`backend/src/db/`): Module-level async clients managed via FastAPI lifespan in `main.py`
- **Config** (`backend/src/core/config.py`): Pydantic Settings loaded from root `.env`

### Bot Service — LangGraph ReAct Agent

`backend/src/services/bot_service.py` implements a ReAct agent using LangGraph with two tools:

- `retrieve_documents` — semantic search over uploaded docs in Qdrant (scoped to conversation)
- `get_current_time` — returns current UTC time

Uses OpenAI via LangChain (`OPENAI_API_KEY` and `OPENAI_MODEL` env vars required).

### File Processing Pipeline

upload → text extraction (PDF/DOCX/TXT/MD) → word-based chunking (500 words, 50-word overlap) → FastEmbed embeddings → Qdrant storage. Files are cleaned up on conversation deletion.

### API Endpoints

| Method | Endpoint                           | Purpose                                |
| ------ | ---------------------------------- | -------------------------------------- |
| POST   | `/api/conversations`               | Create conversation                    |
| GET    | `/api/conversations`               | List all user's conversations          |
| DELETE | `/api/conversations`               | Delete all user's conversations        |
| DELETE | `/api/conversations/{id}`          | Delete conversation                    |
| POST   | `/api/conversations/{id}/clear`    | Clear messages                         |
| GET    | `/api/conversations/{id}/messages` | Fetch messages                         |
| POST   | `/api/conversations/{id}/messages` | Send message (returns user + bot pair) |
| POST   | `/api/conversations/{id}/files`    | Upload file                            |

### Docker Services (`compose.yml`)

| Service       | Port       | Purpose                          |
| ------------- | ---------- | -------------------------------- |
| MongoDB 7     | 27017      | Primary database (`admin:admin`) |
| Mongo Express | 8081       | MongoDB web UI                   |
| Qdrant        | 6333, 6334 | Vector database                  |
| Keycloak      | 8080       | Auth (JWT issuer)                |

Docker is for services only — no Dockerfiles for the application itself.

### Authentication (Keycloak + JWT)

All API routes require a valid JWT Bearer token issued by Keycloak.

- **Backend** (`backend/src/core/auth.py`): Validates RS256 JWT via Keycloak JWKS endpoint. `get_current_user` dependency extracts `AuthUser(user_id, email, username)` from the token. `verify_conversation_ownership` checks the conversation belongs to the authenticated user (403 on mismatch).
- **Frontend** (`frontend/src/main.tsx`): `ReactKeycloakProvider` wraps the app with `onLoad: "login-required"` and PKCE S256. Keycloak client config in `frontend/src/auth/keycloak.ts` (realm: `chatbot`, client: `chatbot-frontend`).
- **API client** (`frontend/src/api/client.ts`): All requests include `Authorization: Bearer {keycloak.token}` header.
- **Realm config** auto-imported from `keycloak/realm-export.json` on Keycloak startup.

### Key Implementation Notes

- **Qdrant** configured for `sentence-transformers/all-MiniLM-L6-v2` (dim=384, cosine distance)
- **Qdrant payload index** on `conversation_id` (keyword) for filtered search and deletion
- **MongoDB indexes** created on startup: `conversations.user_id`, compound `messages.(conversation_id, created_at)`
- CORS configured for `localhost:5173`

### Environment Variables

All config lives in a single root `.env` file (see `.env.example`). Docker Compose, backend, and frontend all read from it.

**Backend:** `API_HOST`, `API_PORT`, `DEBUG`, `CORS_ORIGINS`, `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `MONGO_USERNAME`, `MONGO_PASSWORD`, `MONGO_PORT`, `MONGO_DB`, `QDRANT_URL`, `QDRANT_COLLECTION`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSION`, `OPENAI_API_KEY` (required, not checked in), `OPENAI_MODEL`, `UPLOAD_DIR`

**Frontend (Vite):** `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`

**Docker Compose:** `MONGO_PORT`, `MONGO_EXPRESS_PORT`, `MONGO_USERNAME`, `MONGO_PASSWORD`, `QDRANT_HTTP_PORT`, `QDRANT_GRPC_PORT`, `KEYCLOAK_PORT`, `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD`

### Frontend State Management

`useChat` hook manages all state: conversations, active conversation, messages (per-conversation map), optimistic updates with UUID-based temp IDs, per-conversation sending state, and file uploads.

`App.tsx` renders a 2-column layout: `AppSidebar` (conversation list) + main area (`ChatArea` / `WelcomeScreen` + `MessageInput`).

## Code Style

- **Frontend:** Prettier (80 char width, double quotes, semicolons, Tailwind plugin) + ESLint flat config v9
- **Backend:** Ruff (linter/formatter, configured in `pyproject.toml`)
- **Git commits:** Prefixed `FE:` or `BE:`
- **Path alias:** `@/` → `frontend/src/`
- **shadcn components** live in `frontend/src/components/ui/`; add new ones via the shadcn MCP tool (configured in `.mcp.json`)
- **Comments** Be concise, avoid overexplaining, code should be self-documenting.
