import { api } from "@/lib/api-client";
import type { CreateProjectInput, UpdateProjectInput, CreateLabelInput, CreateMilestoneInput } from "@repo/shared-types";

export interface WorkflowState {
  id: string;
  projectId: string;
  name: string;
  color: string;
  category: "BACKLOG" | "UNSTARTED" | "STARTED" | "COMPLETED" | "CANCELLED";
  position: number;
  isDefault: boolean;
}

export interface Label {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  targetDate: string | null;
  isCompleted: boolean;
}

export interface Project {
  id: string;
  workspaceId: string;
  teamId: string | null;
  name: string;
  key: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  status: "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED" | "CANCELLED";
  startDate: string | null;
  targetDate: string | null;
  isArchived: boolean;
  isPrivate: boolean;
  createdAt: string;
  team?: { id: string; name: string } | null;
  _count?: { tasks: number; members: number };
  workflowStates?: WorkflowState[];
  labels?: Label[];
  milestones?: Milestone[];
  members?: Array<{ id: string; userId: string; role: string; user: { id: string; name: string; avatarUrl: string | null } }>;
}

export const listProjects = (workspaceId: string, filters?: { teamId?: string; status?: string }) => {
  const params = new URLSearchParams(filters as Record<string, string>).toString();
  return api.get<Project[]>(`/api/workspaces/${workspaceId}/projects${params ? `?${params}` : ""}`);
};
export const createProject = (workspaceId: string, input: CreateProjectInput) =>
  api.post<Project>(`/api/workspaces/${workspaceId}/projects`, input);
export const getProject = (projectId: string) => api.get<Project>(`/api/projects/${projectId}`);
export const updateProject = (projectId: string, input: UpdateProjectInput) =>
  api.patch<Project>(`/api/projects/${projectId}`, input);
export const archiveProject = (projectId: string) => api.delete<void>(`/api/projects/${projectId}`);

export const createLabel = (projectId: string, input: CreateLabelInput) =>
  api.post<Label>(`/api/projects/${projectId}/labels`, input);
export const createMilestone = (projectId: string, input: CreateMilestoneInput) =>
  api.post<Milestone>(`/api/projects/${projectId}/milestones`, input);
