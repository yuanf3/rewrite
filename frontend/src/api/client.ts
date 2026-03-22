import keycloak from "@/auth/keycloak";
import type { Conversation, Message, ToolStep } from "@/types";

export interface FileUploadResponse {
  file_id: string;
  filename: string;
  content_type: string;
  status: string;
}

export interface StreamCallbacks {
  onStep: (step: ToolStep) => void;
  onDone: (pair: { user_message: Message; assistant_message: Message }) => void;
  onError: (detail: string) => void;
}

const BASE = "/api"; // import.meta.env.VITE_API_URL;

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${keycloak.token}` };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

async function handleVoidResponse(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed (${res.status})`);
  }
}

export async function createConversation(): Promise<Conversation> {
  const res = await fetch(`${BASE}/conversations`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
  });
  return handleResponse(res);
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(`${BASE}/conversations`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function deleteAllConversations(): Promise<void> {
  const res = await fetch(`${BASE}/conversations`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleVoidResponse(res);
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${BASE}/conversations/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleVoidResponse(res);
}

export async function clearConversation(id: string): Promise<void> {
  const res = await fetch(`${BASE}/conversations/${id}/clear`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleVoidResponse(res);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const res = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function sendMessageStream(
  conversationId: string,
  body: { content: string; file_ids?: string[] },
  callbacks: StreamCallbacks
): Promise<void> {
  const res = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.detail ?? `Request failed (${res.status})`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    let currentEvent = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ") && currentEvent) {
        const data = JSON.parse(line.slice(6));
        if (currentEvent === "step") callbacks.onStep(data);
        else if (currentEvent === "done") callbacks.onDone(data);
        else if (currentEvent === "error") callbacks.onError(data.detail);
        currentEvent = "";
      }
    }
  }
}

export async function uploadFile(
  conversationId: string,
  file: File
): Promise<FileUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/conversations/${conversationId}/files`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  return handleResponse(res);
}
