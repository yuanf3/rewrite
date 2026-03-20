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

export interface ToolStep {
  tool_name: string;
  tool_input: Record<string, unknown>;
  result: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  files: FileRef[];
  steps: ToolStep[];
  created_at: string;
}
