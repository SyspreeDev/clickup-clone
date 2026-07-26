import { api } from "@/lib/api-client";
import type { CreateMeetingInput } from "@repo/shared-types";

export interface Meeting {
  id: string;
  workspaceId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  zoomStartUrl: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  createdById: string;
  createdBy: { id: string; name: string; avatarUrl: string | null };
  project: { id: string; name: string; key: string } | null;
  attendees: Array<{
    id: string;
    userId: string;
    rsvpStatus: "PENDING" | "ACCEPTED" | "DECLINED";
    user: { id: string; name: string; avatarUrl: string | null };
  }>;
}

export const listMeetings = (workspaceId: string, scope: "upcoming" | "past" | "all" = "upcoming") =>
  api.get<Meeting[]>(`/api/workspaces/${workspaceId}/meetings?scope=${scope}`);
export const createMeeting = (workspaceId: string, input: CreateMeetingInput) =>
  api.post<Meeting>(`/api/workspaces/${workspaceId}/meetings`, input);
export const deleteMeeting = (id: string) => api.delete<void>(`/api/meetings/${id}`);
export const rsvpMeeting = (id: string, status: "PENDING" | "ACCEPTED" | "DECLINED") =>
  api.post(`/api/meetings/${id}/rsvp`, { status });
