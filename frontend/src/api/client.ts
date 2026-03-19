import keycloak from "@/auth/keycloak";
import type { Conversation, Message, MessagePair } from "@/types";

export interface FileUploadResponse {
  file_id: string;
  filename: string;
  content_type: string;
  status: string;
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

export async function sendMessage(
  conversationId: string,
  body: { content: string; file_ids?: string[] }
): Promise<MessagePair> {
  const res = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
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
