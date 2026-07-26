import { api } from "@/lib/api-client";

export interface Notification {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  actorId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export const listNotifications = (unreadOnly = false) =>
  api.get<Notification[]>(`/api/notifications${unreadOnly ? "?unread=true" : ""}`);
export const markNotificationRead = (id: string) => api.patch<void>(`/api/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch<void>(`/api/notifications/read-all`);
export const deleteNotification = (id: string) => api.delete<void>(`/api/notifications/${id}`);
