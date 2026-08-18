import { api } from "@/lib/api-client";
import type { CreateWorkspaceInput, UpdateWorkspaceInput, InviteMemberInput } from "@repo/shared-types";
import type { TaskSummary } from "@/lib/queries/tasks";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  role: string;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  role: string;
  status: "ACTIVE" | "INVITED";
  user: { id: string; name: string; email: string; avatarUrl: string | null; jobTitle: string | null };
}

export interface DashboardData {
  kpis: {
    activeProjects: number;
    teamMembers: number;
    myTasks: number;
    completedTasks: number;
    pendingTasks: number;
    unreadNotifications: number;
  };
  upcomingDeadlines: Array<{ id: string; title: string; dueDate: string; project: { id: string; name: string; key: string } }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    actor: { id: string; name: string; avatarUrl: string | null };
  }>;
  upcomingMeetings: Array<{ id: string; title: string; startTime: string; endTime: string }>;
}

export const listWorkspaces = () => api.get<Workspace[]>("/api/workspaces");
export const createWorkspace = (input: CreateWorkspaceInput) => api.post<Workspace>("/api/workspaces", input);
export const getWorkspace = (workspaceId: string) => api.get<Workspace>(`/api/workspaces/${workspaceId}`);
export const updateWorkspace = (workspaceId: string, input: UpdateWorkspaceInput) =>
  api.patch<Workspace>(`/api/workspaces/${workspaceId}`, input);
export const getDashboard = (workspaceId: string) => api.get<DashboardData>(`/api/workspaces/${workspaceId}/dashboard`);

/** A task from any space/list in the workspace — this endpoint deliberately skips team-based scoping. */
export type WorkspaceTaskItem = Omit<TaskSummary, "project"> & {
  project: { id: string; name: string; key: string; team: { id: string; name: string; color: string | null } | null };
};
export const getAllTasks = (workspaceId: string) => api.get<WorkspaceTaskItem[]>(`/api/workspaces/${workspaceId}/all-tasks`);

export const listMembers = (workspaceId: string) => api.get<WorkspaceMember[]>(`/api/workspaces/${workspaceId}/members`);
export const inviteMember = (workspaceId: string, input: InviteMemberInput) =>
  api.post<WorkspaceMember & { inviteLink: string; alreadyHasAccount: boolean; emailSent: boolean }>(
    `/api/workspaces/${workspaceId}/members/invite`,
    input,
  );
export const updateMemberRole = (workspaceId: string, memberId: string, role: string) =>
  api.patch<WorkspaceMember>(`/api/workspaces/${workspaceId}/members/${memberId}`, { role });
export const removeMember = (workspaceId: string, memberId: string) =>
  api.delete<void>(`/api/workspaces/${workspaceId}/members/${memberId}`);
