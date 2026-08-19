import { api } from "@/lib/api-client";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiChatResult {
  reply: string;
  toolsUsed: string[];
}

export const getAiStatus = (workspaceId: string) =>
  api.get<{ configured: boolean }>(`/api/workspaces/${workspaceId}/ai/status`);

export const sendAiChat = (workspaceId: string, message: string, history: AiChatMessage[] = []) =>
  api.post<AiChatResult>(`/api/workspaces/${workspaceId}/ai/chat`, { message, history });
