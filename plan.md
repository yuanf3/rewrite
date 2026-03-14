# Chatbot application — Architecture & implementation plan

## Monorepo structure

```
chatbot/
├── frontend/                  # npm-managed React app
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── .env                   # VITE_API_URL only
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/               # fetch wrappers for every backend route
│       │   └── client.ts
│       ├── components/
│       │   ├── ChatArea.tsx        # scrollable message list
│       │   ├── WelcomeScreen.tsx   # shown when no conversation is selected
│       │   ├── MessageInput.tsx    # text field + file attach button
│       │   ├── MessageBubble.tsx   # single message rendering
│       │   ├── Sidebar.tsx         # conversation list + actions
│       │   └── FilePreview.tsx     # thumbnail / filename chip before send
│       ├── hooks/
│       │   ├── useConversations.ts
│       │   └── useMessages.ts
│       ├── types/
│       │   └── index.ts           # shared TypeScript interfaces
│       └── lib/
│           └── utils.ts           # shadcn utility (cn helper etc.)
│
├── backend/                   # uv-managed Python project
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── .env                   # all backend config
│   └── src/
│       ├── main.py            # FastAPI app + lifespan (db connections)
│       ├── config.py          # pydantic-settings for env vars
│       ├── routes/
│       │   ├── conversations.py
│       │   ├── messages.py
│       │   └── files.py
│       ├── services/
│       │   ├── conversation_service.py
│       │   ├── message_service.py
│       │   ├── file_service.py
│       │   └── bot_service.py     # black-box assistant response generation
│       ├── repositories/
│       │   ├── conversation_repo.py
│       │   └── message_repo.py
│       ├── models/
│       │   └── schemas.py     # Pydantic request/response models
│       └── db/
│           ├── mongo.py       # module-level AsyncMongoClient + connect/close
│           └── qdrant.py      # module-level QdrantClient + connect/close
│
├── docker-compose.yml         # MongoDB + Qdrant for local development
└── README.md
```

---

## Environment configuration

Two separate `.env` files to prevent backend secrets from leaking into the browser bundle.

### `frontend/.env`

```env
VITE_API_URL=http://localhost:8000/api
```

### `backend/.env`

```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB=chatbot
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=file_chunks
UPLOAD_DIR=./uploads
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSION=384
```

`EMBEDDING_MODEL` and `EMBEDDING_DIMENSION` are explicit configuration rather than buried in code. The dimension (384 for `all-MiniLM-L6-v2`) must match the Qdrant collection's vector size, so both are configured in one place. If the embedding model changes, the Qdrant collection must be recreated.

---

## Docker Compose (local development)

```yaml
services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  mongo_data:
  qdrant_data:
```

This is a phase 1 deliverable — both databases must be running before any backend work begins.

---

## Frontend

### Tech stack

React 18 + TypeScript, built with Vite, styled with Tailwind CSS and shadcn/ui components. No state management library — React context + `useState`/`useEffect` hooks are sufficient given the simple data flow.

### Layout

The top-level `App.tsx` renders a two-column layout: a narrow `Sidebar` on the left and the main content area on the right. The main area stacks either `WelcomeScreen` or `ChatArea` (flex-grow, scrollable) above `MessageInput` (always visible at bottom).

App-level state tracks `activeConversationId: string | null`. When null, the main area shows `WelcomeScreen`. When set, it shows `ChatArea` populated with that conversation's messages.

### Key components

**`Sidebar`** — fetches `GET /api/conversations?user_id=...` on mount. Renders a list of conversation items, each showing a title (or truncated first message) and a timestamp. Each item has a delete button (`DELETE /api/conversations/{id}`) and a clear button (`POST /api/conversations/{id}/clear`). Clicking a conversation sets it as the active conversation. A "new conversation" button at the top sets `activeConversationId` to null, returning to the welcome screen.

**`WelcomeScreen`** — a simple landing component shown when no conversation is selected. Displays a greeting and a brief prompt (e.g. "Start a conversation by typing a message below"). No data fetching.

**`ChatArea`** — when the active conversation changes, fetches `GET /api/conversations/{id}/messages`. Renders a scrollable list of `MessageBubble` components. Auto-scrolls to the bottom on new messages. Shows a loading skeleton while messages are being fetched.

**`MessageInput`** — a shadcn `Textarea` with a send button and a file-attach button. Always visible regardless of whether a conversation is selected. The file button opens a native file picker. Selected files appear as removable chips (`FilePreview`). Disabled while a submission is in flight (prevents double-sends).

**Submit flow** (handles both new and existing conversations):

1. If `activeConversationId` is null, call `POST /api/conversations` with `user_id`. Backend returns the new conversation (including its ID). Set this as the active conversation and add it to the sidebar list.
2. If files are attached, upload each via `POST /api/conversations/{id}/files`. Wait for all uploads to complete.
3. Send the text message via `POST /api/conversations/{id}/messages`. The backend generates the assistant response and returns both the user message and the assistant message.
4. Append both messages to the chat area. If this was the first message, the backend will have set the conversation title — refresh the sidebar entry to pick it up.

If step 2 succeeds but step 3 fails, the uploaded files are orphaned. The frontend shows an error and allows retry. A future improvement could add a cleanup endpoint or a background job that garbage-collects files not referenced by any message after a timeout.

### API client (`api/client.ts`)

A thin wrapper around `fetch` that sets the base URL, content-type headers, and handles JSON parsing. Each backend route gets a named function:

```typescript
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export async function createConversation(userId: string) {
  const res = await fetch(`${BASE}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  return res.json();
}

export async function listConversations(userId: string) {
  const res = await fetch(`${BASE}/conversations?user_id=${userId}`);
  return res.json();
}

export async function deleteConversation(id: string) {
  await fetch(`${BASE}/conversations/${id}`, { method: "DELETE" });
}

export async function clearConversation(id: string) {
  await fetch(`${BASE}/conversations/${id}/clear`, { method: "POST" });
}

export async function getMessages(conversationId: string) {
  const res = await fetch(`${BASE}/conversations/${conversationId}/messages`);
  return res.json();
}

export async function sendMessage(
  conversationId: string,
  body: { content: string; user_id: string; file_ids?: string[] },
) {
  const res = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function uploadFile(conversationId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/conversations/${conversationId}/files`, {
    method: "POST",
    body: form,
  });
  return res.json();
}
```

---

## Backend

### Tech stack

Python 3.12+, FastAPI, managed with `uv`. Dependencies: `fastapi`, `uvicorn`, `pymongo` (with `AsyncMongoClient`), `qdrant-client`, `python-multipart`, `pydantic-settings`, `sentence-transformers`.

### Layered architecture

The backend follows a three-layer pattern that keeps concerns separated:

**Routes** — thin HTTP handlers. Parse request parameters, call the appropriate service, return the response. No business logic lives here.

**Services** — business logic. Orchestrate operations across repositories and external clients (Qdrant, embedding model). For example, `FileService.process_upload` saves the file, extracts text, chunks it, embeds the chunks, and upserts them into Qdrant.

**Repositories** — data access. Each repository wraps a single MongoDB collection and exposes typed CRUD methods. The services never touch `pymongo` directly.

### Database connections (`db/mongo.py`, `db/qdrant.py`)

Module-level client variables, initialised by `connect()` / torn down by `close()`, called from the FastAPI lifespan. No singleton pattern — Python's module import system ensures a single instance naturally.

```python
# db/mongo.py
from pymongo import AsyncMongoClient
from app.config import settings

_client: AsyncMongoClient | None = None

def get_database():
    return _client[settings.mongo_db]

async def connect():
    global _client
    _client = AsyncMongoClient(settings.mongo_uri)

async def close():
    if _client:
        await _client.close()
```

### Application lifecycle (`main.py`)

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.mongo import connect as connect_mongo, close as close_mongo
from app.db.qdrant import connect as connect_qdrant, close as close_qdrant

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_mongo()
    await connect_qdrant()
    yield
    await close_mongo()
    await close_qdrant()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

from app.routes import conversations, messages, files
app.include_router(conversations.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(files.router, prefix="/api")
```

---

## API routes

### Conversations

| Method   | Path                               | Description                                                                                                                                                 |
| -------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/conversations`               | Create a new conversation. Body: `{ user_id }`. Returns the created conversation with its ID.                                                               |
| `GET`    | `/api/conversations?user_id={uid}` | List conversations for a user, ordered by `updated_at` descending. Supports cursor-based pagination via `?before={datetime}` and `?limit={n}` (default 50). |
| `DELETE` | `/api/conversations/{id}`          | Delete a conversation and all its messages, vectors, and files.                                                                                             |
| `POST`   | `/api/conversations/{id}/clear`    | Remove all messages, vectors, and files from a conversation. Keeps the conversation document.                                                               |

### Messages

| Method | Path                               | Description                                                                                                                                                     |
| ------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/conversations/{id}/messages` | Fetch messages for a conversation, ordered by `created_at` ascending. Supports cursor-based pagination via `?before={datetime}` and `?limit={n}` (default 100). |
| `POST` | `/api/conversations/{id}/messages` | Send a user message. Body: `{ content, user_id, file_ids? }`. Triggers assistant response generation. Returns `{ user_message, assistant_message }`.            |

The send-message endpoint accepts an optional `file_ids` array. If provided, the corresponding file references are attached to the user message document. This links previously uploaded files to the message that accompanies them.

### Files

| Method | Path                            | Description                                                                                                                                                                               |
| ------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/conversations/{id}/files` | Upload a file. Multipart form data. Returns `{ file_id, filename, content_type, status }`. Processing happens inline; status is `"ready"` on success or `"failed"` with an error message. |

---

## MongoDB schemas

Two collections, kept deliberately minimal.

### `conversations`

```json
{
  "_id": "ObjectId",
  "user_id": "string",
  "title": "string | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

The `title` is set from the first user message content (truncated to 80 chars). It remains null until the first message is sent.

### `messages`

```json
{
  "_id": "ObjectId",
  "conversation_id": "string",
  "role": "user | assistant",
  "content": "string",
  "files": [
    {
      "file_id": "string",
      "filename": "string",
      "content_type": "string"
    }
  ],
  "created_at": "datetime"
}
```

The `files` array is embedded directly on the message rather than in a separate collection — this avoids an extra join and keeps reads fast. Each entry is a lightweight reference; the actual file bytes live on disk and the vectorised content lives in Qdrant. Only user messages will have files; assistant messages will have an empty array.

### Indexes

```python
# Created on startup
await db.conversations.create_index("user_id")
await db.messages.create_index("conversation_id")
await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
```

The compound index on `(conversation_id, created_at)` supports the paginated message query efficiently.

---

## Qdrant vector store

### Collection design

One Qdrant collection for the whole application, named `file_chunks`. Created on startup if it doesn't exist, using the configured `EMBEDDING_DIMENSION` (384 for `all-MiniLM-L6-v2`). Each point stores:

```json
{
  "id": "uuid",
  "vector": [0.012, -0.034, ...],
  "payload": {
    "conversation_id": "string",
    "file_id": "string",
    "filename": "string",
    "chunk_index": 0,
    "text": "the original chunk text"
  }
}
```

A payload index on `conversation_id` is created at startup to make filtered searches and bulk deletions fast.

### File processing pipeline (`FileService`)

1. **Receive** the uploaded file via multipart form.
2. **Save** to disk under `{UPLOAD_DIR}/{conversation_id}/{file_id}/{filename}`.
3. **Extract text** — use `pypdf` for PDFs, plain read for `.txt`/`.md`, `python-docx` for `.docx`. Unsupported file types return a 400 response with a clear error message listing accepted formats.
4. **Chunk** the extracted text into overlapping segments (~500 tokens each, ~50 token overlap). A simple recursive character splitter is sufficient to start.
5. **Embed** each chunk using `sentence-transformers/all-MiniLM-L6-v2` (loaded once at startup, kept in memory).
6. **Upsert** the vectors into the `file_chunks` Qdrant collection with the payload above.
7. **Return** the file metadata (file_id, filename, content_type) to the caller.

Processing runs inline in the request. This is acceptable for small to medium files (most text documents process in under a second). For large PDFs this could take several seconds — see Known limitations below.

### Deletion logic

When a conversation is **deleted**, the service must: remove all message documents with that `conversation_id`, delete all Qdrant points where `payload.conversation_id` matches, delete the conversation's upload directory from disk, and remove the conversation document.

When a conversation is **cleared**, the same steps apply except the conversation document is kept.

Both operations use try/except around each store. If Qdrant or disk deletion fails, the error is logged but the operation continues — partial cleanup is better than leaving the MongoDB data intact because the user retried and got a conflict. A future improvement could add a reconciliation job.

---

## Service layer detail

### `ConversationService`

```python
class ConversationService:
    def __init__(self, conversation_repo, message_repo, qdrant_client):
        ...

    async def create(self, user_id: str) -> Conversation:
        return await self.conversation_repo.create(user_id=user_id, title=None)

    async def list_for_user(self, user_id: str, before: datetime | None, limit: int) -> list[Conversation]:
        return await self.conversation_repo.find_by_user(user_id, before=before, limit=limit)

    async def delete(self, conversation_id: str) -> None:
        await self.message_repo.delete_by_conversation(conversation_id)
        await self._delete_vectors(conversation_id)
        await self._delete_files_from_disk(conversation_id)
        await self.conversation_repo.delete(conversation_id)

    async def clear(self, conversation_id: str) -> None:
        await self.message_repo.delete_by_conversation(conversation_id)
        await self._delete_vectors(conversation_id)
        await self._delete_files_from_disk(conversation_id)
```

### `MessageService`

```python
class MessageService:
    def __init__(self, message_repo, conversation_repo, bot_service):
        ...

    async def send(
        self, conversation_id: str, user_id: str, content: str, file_ids: list[str] | None
    ) -> tuple[Message, Message]:
        # Resolve file references if provided
        files = self._build_file_refs(file_ids) if file_ids else []

        # Persist the user message
        user_msg = await self.message_repo.create(
            conversation_id=conversation_id, role="user", content=content, files=files
        )

        # Set conversation title from first message
        await self._maybe_set_title(conversation_id, content)

        # Update conversation timestamp
        await self.conversation_repo.touch(conversation_id)

        # Generate assistant response (black box)
        history = await self.message_repo.find_by_conversation(conversation_id)
        assistant_content = await self.bot_service.generate_response(
            conversation_id=conversation_id,
            history=history,
        )

        # Persist the assistant message
        assistant_msg = await self.message_repo.create(
            conversation_id=conversation_id, role="assistant", content=assistant_content, files=[]
        )

        return user_msg, assistant_msg

    async def list(
        self, conversation_id: str, before: datetime | None, limit: int
    ) -> list[Message]:
        return await self.message_repo.find_by_conversation(
            conversation_id, before=before, limit=limit
        )
```

### `BotService` (black box)

```python
class BotService:
    def __init__(self, qdrant_client, embedder):
        ...

    async def generate_response(
        self, conversation_id: str, history: list[Message]
    ) -> str:
        """
        Given the conversation history and access to the Qdrant collection
        (filtered by conversation_id), produce an assistant response.

        Implementation details are intentionally undefined. This method
        receives everything it needs — the full message history and the
        ability to query the vector store scoped to this conversation —
        and returns a string.
        """
        ...
```

The `BotService` is injected into `MessageService` like any other dependency. Its internals (LLM choice, RAG retrieval strategy, prompt construction) are out of scope for this plan. The contract is: it receives the conversation history and a conversation-scoped vector store, and returns a response string.

### `FileService`

```python
class FileService:
    def __init__(self, qdrant_client, embedder, upload_dir: str):
        ...

    async def process_upload(self, conversation_id: str, file: UploadFile) -> FileRef:
        file_id = str(uuid4())
        path = await self._save_to_disk(conversation_id, file_id, file)

        try:
            text = await self._extract_text(path, file.content_type)
            chunks = self._chunk_text(text)
            vectors = self._embed(chunks)
            await self._upsert_to_qdrant(conversation_id, file_id, file.filename, chunks, vectors)
        except UnsupportedFileType:
            await self._remove_from_disk(path)
            raise
        except Exception:
            # File is saved but vectorisation failed — log and report
            logger.exception("Failed to process file %s", file.filename)
            return FileRef(
                file_id=file_id, filename=file.filename,
                content_type=file.content_type, status="failed"
            )

        return FileRef(
            file_id=file_id, filename=file.filename,
            content_type=file.content_type, status="ready"
        )
```

---

## Dependency injection

Use FastAPI's `Depends` to wire services into route handlers. Services are constructed once during lifespan startup and stored on `app.state`:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_mongo()
    await connect_qdrant()

    db = get_database()
    conversation_repo = ConversationRepo(db)
    message_repo = MessageRepo(db)
    embedder = load_embedder(settings.embedding_model)
    qdrant = get_qdrant_client()

    app.state.conversation_service = ConversationService(conversation_repo, message_repo, qdrant)
    app.state.file_service = FileService(qdrant, embedder, settings.upload_dir)
    app.state.bot_service = BotService(qdrant, embedder)
    app.state.message_service = MessageService(message_repo, conversation_repo, app.state.bot_service)

    yield
    await close_mongo()
    await close_qdrant()


def get_conversation_service(request: Request) -> ConversationService:
    return request.app.state.conversation_service

def get_message_service(request: Request) -> MessageService:
    return request.app.state.message_service

def get_file_service(request: Request) -> FileService:
    return request.app.state.file_service
```

---

## Error handling strategy

### Backend

Routes catch service-layer exceptions and map them to HTTP responses:

- `ConversationNotFound` / `MessageNotFound` → 404
- `UnsupportedFileType` → 400 with accepted formats listed
- `FileTooLarge` → 413
- Unexpected exceptions → 500 with a generic error message (details logged server-side)

The delete/clear cascade is best-effort across stores. If MongoDB deletion succeeds but Qdrant is unreachable, the operation logs the Qdrant failure and returns success to the client. Orphaned vectors are harmless (they'll be ignored without a matching conversation) and can be reconciled later.

### Frontend

Every API call is wrapped in try/catch. Errors are displayed as toast notifications (shadcn `Sonner` or similar). Specific handling:

- Network errors → "Could not reach the server. Please try again."
- 400 errors → display the server's error message (e.g. "Unsupported file type").
- 404 on conversation actions → remove the conversation from the sidebar (it was likely deleted in another tab).
- 500 errors → generic "Something went wrong" message.

The message input disables during submission to prevent double-sends. A loading indicator appears in the chat area while the assistant response is being generated.

---

## Known limitations

**No authentication.** The `user_id` is passed as a parameter from the frontend with no verification. Anyone who knows a user ID can access their conversations. For a local prototype this is acceptable. Auth would slot in as a FastAPI middleware that extracts user identity from a session or token and injects it into route handlers.

**Synchronous file processing.** File upload blocks until text extraction, chunking, embedding, and Qdrant upsert all complete. For most text documents this takes under a second. Large PDFs (100+ pages) could take several seconds. If this becomes a problem, the processing pipeline could be moved to a background task (FastAPI `BackgroundTasks` or a proper task queue like Celery/arq), with a status-polling endpoint so the frontend can show progress.

**No pagination in the initial frontend implementation.** The backend supports cursor-based pagination on both conversations and messages. The frontend initially loads the first page and can implement infinite scroll or "load more" buttons later without backend changes.

**Orphaned file cleanup.** If file upload succeeds but the subsequent message send fails, the files exist in Qdrant and on disk but aren't referenced by any message. The plan acknowledges this and does not solve it. A background reconciliation job that checks for unreferenced files older than a threshold (e.g. 1 hour) would handle it.

---

## Implementation plan

### Phase 1 — Scaffolding & infrastructure

1. Create the monorepo root: `mkdir chatbot && cd chatbot`.
2. Write `docker-compose.yml` with MongoDB and Qdrant. Run `docker compose up -d` and verify both are reachable.
3. Frontend: `npm create vite@latest frontend -- --template react-ts`, install Tailwind CSS, run `npx shadcn@latest init`. Create `frontend/.env`.
4. Backend: `mkdir backend && cd backend && uv init`, add dependencies to `pyproject.toml`, run `uv sync`. Create `backend/.env`.
5. Confirm `npm run dev` and `uv run uvicorn app.main:app --reload` both start cleanly.

### Phase 2 — Backend core (conversations + messages)

1. Implement `config.py` with pydantic-settings reading from `.env`.
2. Implement `db/mongo.py` and `db/qdrant.py` (module-level connect/close pattern).
3. Build `ConversationRepo` and `MessageRepo` with CRUD + pagination support.
4. Build `ConversationService` (create, list, delete, clear) and `MessageService` (send, list) — with a stub `BotService` that returns a placeholder response.
5. Wire up all routes: create conversation, list conversations, delete, clear, get messages, send message.
6. Write the FastAPI lifespan with service construction and dependency injection.
7. Test all endpoints with `curl` or a REST client.

### Phase 3 — Frontend core

1. Build the layout shell: `App.tsx` with `Sidebar` + main content area + `MessageInput`.
2. Implement `WelcomeScreen` — displayed when `activeConversationId` is null.
3. Implement `api/client.ts` with all fetch functions.
4. Wire `Sidebar` to list, delete, and clear conversations.
5. Wire `ChatArea` to fetch and display messages when a conversation is selected.
6. Implement the `MessageInput` submit flow: create conversation if needed → send message → update sidebar and chat area.
7. Add loading states (message sending spinner, chat area skeleton) and error toasts.
8. Confirm end-to-end flow: new conversation from welcome screen, send messages, switch conversations, delete, clear.

### Phase 4 — File upload & vector pipeline

1. Implement `FileService` with disk storage and text extraction for supported formats.
2. Add chunking logic (recursive character splitter).
3. Load the embedding model at startup; implement the embed + Qdrant upsert steps.
4. Wire up the file upload route.
5. Add `FilePreview` to the frontend `MessageInput`; wire the upload-then-send flow.
6. Implement cascade deletion of vectors and files in the delete/clear service methods.
7. Test: upload a file, verify chunks appear in Qdrant, delete conversation, verify chunks are removed.

### Phase 5 — Bot integration & polish

1. Replace the stub `BotService` with a real implementation (details out of scope for this plan, but the contract is defined above).
2. Add frontend loading indicator while assistant response is generating.
3. Handle edge cases: empty message with only files, unsupported file types (show error), very long messages.
4. Tighten CORS configuration for production (replace `allow_origins=["*"]`).
5. Add infinite scroll or "load more" for conversations and messages using the pagination support.
