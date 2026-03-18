export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileRef {
  file_id: string;
  filename: string;
  content_type: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  files: FileRef[];
  created_at: string;
}

export interface MessagePair {
  user_message: Message;
  assistant_message: Message;
}
