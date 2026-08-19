import { api, apiStream } from "@/lib/api-client";

export interface AiConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessageRecord {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  toolsUsed: string[];
  createdAt: string;
}

export type AiStreamEvent =
  | { type: "conversation"; conversationId: string }
  | { type: "delta"; text: string }
  | { type: "tool"; name: string }
  | { type: "done"; conversationId: string; reply: string; toolsUsed: string[] }
  | { type: "error"; message: string };

export const getAiStatus = (workspaceId: string) =>
  api.get<{ configured: boolean }>(`/api/workspaces/${workspaceId}/ai/status`);

export const listAiConversations = (workspaceId: string) =>
  api.get<AiConversationSummary[]>(`/api/workspaces/${workspaceId}/ai/conversations`);

export const getAiConversation = (workspaceId: string, conversationId: string) =>
  api.get<AiMessageRecord[]>(`/api/workspaces/${workspaceId}/ai/conversations/${conversationId}`);

export const deleteAiConversation = (workspaceId: string, conversationId: string) =>
  api.delete<void>(`/api/workspaces/${workspaceId}/ai/conversations/${conversationId}`);

/** Streams one chat turn; `onEvent` fires as each SSE frame arrives. */
export const streamAiChat = (
  workspaceId: string,
  input: { message: string; conversationId?: string },
  onEvent: (event: AiStreamEvent) => void,
) => apiStream<AiStreamEvent>(`/api/workspaces/${workspaceId}/ai/chat`, input, onEvent);
