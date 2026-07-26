import { api } from "@/lib/api-client";
import type { CreateTaskInput, UpdateTaskInput, MoveTaskInput, CreateCommentInput } from "@repo/shared-types";

export interface TaskSummary {
  id: string;
  projectId: string;
  number: number;
  workflowStateId: string;
  parentId: string | null;
  milestoneId: string | null;
  title: string;
  description: unknown;
  priority: "NO_PRIORITY" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  position: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  estimateMinutes: number | null;
  isArchived: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  assignees: Array<{ id: string; userId: string; user: { id: string; name: string; avatarUrl: string | null } }>;
  taskLabels: Array<{ labelId: string; label: { id: string; name: string; color: string } }>;
  workflowState: { id: string; name: string; color: string; category: string };
  milestone: { id: string; name: string } | null;
  _count: { subtasks: number; comments: number; attachments: number; checklists: number };
}

export interface TaskDetail extends TaskSummary {
  project: { id: string; name: string; key: string; workspaceId: string };
  createdBy: { id: string; name: string; avatarUrl: string | null };
  subtasks: TaskSummary[];
  checklists: Array<{
    id: string;
    title: string;
    position: number;
    items: Array<{ id: string; title: string; isCompleted: boolean; position: number; assigneeId: string | null }>;
  }>;
  dependencies: Array<{ id: string; type: string; dependsOn: { id: string; title: string; number: number } }>;
  dependents: Array<{ id: string; type: string; task: { id: string; title: string; number: number } }>;
  comments: Array<{
    id: string;
    content: unknown;
    authorId: string;
    author: { id: string; name: string; avatarUrl: string | null };
    createdAt: string;
    editedAt: string | null;
    isDeleted: boolean;
    replies: Array<{ id: string; content: unknown; author: { id: string; name: string; avatarUrl: string | null }; createdAt: string }>;
  }>;
  timeEntries: Array<{
    id: string;
    description: string | null;
    startedAt: string;
    endedAt: string | null;
    durationMinutes: number | null;
    user: { id: string; name: string; avatarUrl: string | null };
  }>;
}

export const listTasks = (projectId: string, filters?: Record<string, string>) => {
  const params = new URLSearchParams(filters).toString();
  return api.get<TaskSummary[]>(`/api/projects/${projectId}/tasks${params ? `?${params}` : ""}`);
};
export const getTask = (taskId: string) => api.get<TaskDetail>(`/api/tasks/${taskId}`);
export const createTask = (projectId: string, input: CreateTaskInput) =>
  api.post<TaskSummary>(`/api/projects/${projectId}/tasks`, input);
export const updateTask = (taskId: string, input: UpdateTaskInput) => api.patch<TaskSummary>(`/api/tasks/${taskId}`, input);
export const moveTask = (taskId: string, input: MoveTaskInput) => api.patch<TaskSummary>(`/api/tasks/${taskId}/move`, input);
export const deleteTask = (taskId: string) => api.delete<void>(`/api/tasks/${taskId}`);

export const addAssignee = (taskId: string, userId: string) => api.post(`/api/tasks/${taskId}/assignees`, { userId });
export const removeAssignee = (taskId: string, userId: string) => api.delete(`/api/tasks/${taskId}/assignees/${userId}`);
export const addLabel = (taskId: string, labelId: string) => api.post(`/api/tasks/${taskId}/labels/${labelId}`);
export const removeLabel = (taskId: string, labelId: string) => api.delete(`/api/tasks/${taskId}/labels/${labelId}`);

export const createChecklist = (taskId: string, title: string) => api.post(`/api/tasks/${taskId}/checklists`, { title });
export const addChecklistItem = (checklistId: string, title: string) =>
  api.post(`/api/checklists/${checklistId}/items`, { title });
export const updateChecklistItem = (id: string, input: { isCompleted?: boolean; title?: string }) =>
  api.patch(`/api/checklist-items/${id}`, input);
export const deleteChecklistItem = (id: string) => api.delete(`/api/checklist-items/${id}`);

export const createComment = (taskId: string, input: CreateCommentInput) => api.post(`/api/tasks/${taskId}/comments`, input);

export const listMyTasks = (workspaceId?: string) =>
  api.get<TaskSummary[]>(`/api/my-tasks${workspaceId ? `?workspaceId=${workspaceId}` : ""}`);
