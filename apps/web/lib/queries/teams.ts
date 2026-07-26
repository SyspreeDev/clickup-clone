import { api } from "@/lib/api-client";
import type { CreateTeamInput, UpdateTeamInput, AddTeamMemberInput } from "@repo/shared-types";

export interface Team {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  icon: string | null;
  createdAt: string;
  members: Array<{
    id: string;
    userId: string;
    role: string;
    workspaceStatus?: "ACTIVE" | "INVITED";
    user: { id: string; name: string; avatarUrl: string | null; email?: string };
  }>;
  _count?: { projects: number };
  projects?: Array<{ id: string; name: string; key: string }>;
}

export const listTeams = (workspaceId: string) => api.get<Team[]>(`/api/workspaces/${workspaceId}/teams`);
export const createTeam = (workspaceId: string, input: CreateTeamInput) =>
  api.post<Team>(`/api/workspaces/${workspaceId}/teams`, input);
export const getTeam = (teamId: string) => api.get<Team>(`/api/teams/${teamId}`);
export const updateTeam = (teamId: string, input: UpdateTeamInput) => api.patch<Team>(`/api/teams/${teamId}`, input);
export const deleteTeam = (teamId: string) => api.delete<void>(`/api/teams/${teamId}`);
export const addTeamMember = (teamId: string, input: AddTeamMemberInput) =>
  api.post(`/api/teams/${teamId}/members`, input);
export const removeTeamMember = (teamId: string, userId: string) =>
  api.delete<void>(`/api/teams/${teamId}/members/${userId}`);
