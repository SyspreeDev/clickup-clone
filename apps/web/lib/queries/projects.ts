import { api } from "@/lib/api-client";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  CreateLabelInput,
  CreateMilestoneInput,
  CreateWorkflowStateInput,
  UpdateWorkflowStateInput,
} from "@repo/shared-types";

export interface WorkflowState {
  id: string;
  projectId: string;
  name: string;
  color: string;
  category: "BACKLOG" | "UNSTARTED" | "STARTED" | "COMPLETED" | "CANCELLED";
  position: number;
  isDefault: boolean;
  /** Only returned by listWorkflowStates — how many tasks currently sit here. */
  _count?: { tasks: number };
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

// ── Per-list custom statuses (WorkflowState) ──

export const listWorkflowStates = (projectId: string) =>
  api.get<WorkflowState[]>(`/api/projects/${projectId}/workflow-states`);

export const createWorkflowState = (projectId: string, input: CreateWorkflowStateInput) =>
  api.post<WorkflowState>(`/api/projects/${projectId}/workflow-states`, input);

export const updateWorkflowState = (id: string, input: UpdateWorkflowStateInput) =>
  api.patch<WorkflowState>(`/api/workflow-states/${id}`, input);

/** moveToId rehomes tasks still in this status; required when the status isn't empty. */
export const deleteWorkflowState = (id: string, moveToId?: string) =>
  api.delete<void>(
    `/api/workflow-states/${id}${moveToId ? `?moveTo=${encodeURIComponent(moveToId)}` : ""}`,
  );

export const createLabel = (projectId: string, input: CreateLabelInput) =>
  api.post<Label>(`/api/projects/${projectId}/labels`, input);
export const createMilestone = (projectId: string, input: CreateMilestoneInput) =>
  api.post<Milestone>(`/api/projects/${projectId}/milestones`, input);
