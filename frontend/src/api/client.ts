import type { Conversation, Message, MessagePair } from "@/types";

const BASE = "/api";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function createConversation(
  userId: string,
): Promise<Conversation> {
  const res = await fetch(`${BASE}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  return handleResponse(res);
}

export async function listConversations(
  userId: string,
): Promise<Conversation[]> {
  const res = await fetch(`${BASE}/conversations?user_id=${userId}`);
  return handleResponse(res);
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${BASE}/conversations/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete conversation");
}

export async function clearConversation(id: string): Promise<void> {
  const res = await fetch(`${BASE}/conversations/${id}/clear`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to clear conversation");
}

export async function getMessages(
  conversationId: string,
): Promise<Message[]> {
  const res = await fetch(
    `${BASE}/conversations/${conversationId}/messages`,
  );
  return handleResponse(res);
}

export async function sendMessage(
  conversationId: string,
  body: { content: string; user_id: string; file_ids?: string[] },
): Promise<MessagePair> {
  const res = await fetch(
    `${BASE}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return handleResponse(res);
}
