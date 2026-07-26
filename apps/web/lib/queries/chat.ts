import { api } from "@/lib/api-client";
import type { CreateChannelInput, CreateMessageInput } from "@repo/shared-types";

export interface Channel {
  id: string;
  workspaceId: string;
  name: string | null;
  type: "PUBLIC" | "PRIVATE" | "DM";
  topic: string | null;
  isArchived: boolean;
  createdAt: string;
  members: Array<{ id: string; userId: string; role: string; user: { id: string; name: string; avatarUrl: string | null } }>;
  _count?: { messages: number };
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  author: { id: string; name: string; avatarUrl: string | null };
  content: string;
  parentId: string | null;
  isDeleted: boolean;
  editedAt: string | null;
  createdAt: string;
  reactions: Array<{ id: string; emoji: string; userId: string; user: { id: string; name: string } }>;
}

export const listChannels = (workspaceId: string) => api.get<Channel[]>(`/api/workspaces/${workspaceId}/channels`);
export const createChannel = (workspaceId: string, input: CreateChannelInput) =>
  api.post<Channel>(`/api/workspaces/${workspaceId}/channels`, input);
export const getOrCreateDm = (workspaceId: string, userId: string) =>
  api.post<Channel>(`/api/workspaces/${workspaceId}/dm/${userId}`);

export const listMessages = (channelId: string) => api.get<Message[]>(`/api/channels/${channelId}/messages`);
export const sendMessage = (channelId: string, input: CreateMessageInput) =>
  api.post<Message>(`/api/channels/${channelId}/messages`, input);
export const addReaction = (messageId: string, emoji: string) => api.post(`/api/messages/${messageId}/reactions`, { emoji });
export const removeReaction = (messageId: string, emoji: string) => api.delete(`/api/messages/${messageId}/reactions/${emoji}`);
