# Chatbot

A full-stack chatbot application with support for RAG (Retrieval-Augmented Generation). Upload documents and chat with an AI that can reference their content using semantic search.

Built with React + TypeScript on the frontend and Python FastAPI + LangGraph on the backend.

## Features

- Conversational AI powered by OpenAI via a LangGraph ReAct agent
- Document upload (PDF, DOCX, TXT, MD) with chunking and vector embedding
- Semantic search over uploaded documents scoped per conversation
- User authentication via Keycloak (JWT + PKCE)
- Multiple conversations with full CRUD support

## Prerequisites

- **Node.js** (for frontend)
- **Python 3.13+** with [uv](https://docs.astral.sh/uv/)
- **Docker** (for MongoDB, Qdrant, Keycloak)
- **OpenAI API key**

## Quick Start

1. **Clone and configure environment**

   ```bash
   cp .env.example .env
   # Add your OPENAI_API_KEY to .env
   ```

2. **Start infrastructure services**

   ```bash
   make dstart
   ```

   This starts MongoDB (`:27017`), Mongo Express (`:8081`), Qdrant (`:6333`) and Keycloak (`:8080`).

3. **Install dependencies**

   ```bash
   make install
   ```

4. **Start the application**

   ```bash
   make start
   ```

   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:8000](http://localhost:8000)

   On first visit, Keycloak will prompt you to log in or register; log in as admin.
   The keycloak realm `chatbot` and client `chatbot-frontend` should be imported automatically.
   Create a test user.

## Tech Stack

| Layer        | Technology                                              |
| ------------ | ------------------------------------------------------- |
| Frontend     | React 19, TypeScript, Vite 7, Tailwind CSS 4, shadcn/ui |
| Backend      | Python 3.13+, FastAPI, LangGraph, LangChain, OpenAI     |
| Database     | MongoDB 7                                               |
| Vector Store | Qdrant (sentence-transformers/all-MiniLM-L6-v2)         |
| Auth         | Keycloak (RS256 JWT)                                    |
| Package Mgmt | npm (frontend), uv (backend)                            |

## Project Structure

```
├── frontend/           # React + TypeScript SPA
│   └── src/
│       ├── api/        # Typed API client
│       ├── auth/       # Keycloak config
│       ├── components/ # UI components (shadcn/ui)
│       └── hooks/      # React hooks (useChat)
├── backend/
│   └── src/
│       ├── core/       # Config, auth
│       ├── routes/     # FastAPI route handlers
│       ├── services/   # Business logic (bot, file processing)
│       ├── repositories/ # MongoDB data access
│       └── db/         # Database clients
├── keycloak/           # Realm config (auto-imported)
├── compose.yml         # Docker services
├── Makefile            # Dev commands
└── .env.example        # Environment template
```

## Available Commands

```bash
make install        # Install all dependencies
make start          # Run backend + frontend
make start-backend  # Backend only
make start-frontend # Frontend only
make dstart         # Start Docker services
make dstop          # Stop Docker services
make clean          # Remove build artifacts & caches
```

## API Endpoints

| Method | Endpoint                           | Purpose             |
| ------ | ---------------------------------- | ------------------- |
| POST   | `/api/conversations`               | Create conversation |
| GET    | `/api/conversations`               | List conversations  |
| DELETE | `/api/conversations`               | Delete all          |
| DELETE | `/api/conversations/{id}`          | Delete one          |
| POST   | `/api/conversations/{id}/clear`    | Clear messages      |
| GET    | `/api/conversations/{id}/messages` | Fetch messages      |
| POST   | `/api/conversations/{id}/messages` | Send message        |
| POST   | `/api/conversations/{id}/files`    | Upload file         |

All endpoints require a valid JWT Bearer token.

## Environment Variables

See [`.env.example`](.env.example) for all available configuration. The key variable you must set:

```
OPENAI_API_KEY=sk-...
```
