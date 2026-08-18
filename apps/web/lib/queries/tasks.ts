import { api, apiUpload, ApiError } from "@/lib/api-client";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
  CreateCommentInput,
  CreateDependencyInput,
  DependencyType,
} from "@repo/shared-types";

/** The slice of a task returned on either side of a dependency link. */
export interface LinkedTask {
  id: string;
  title: string;
  number: number;
  workflowState: { id: string; name: string; color: string; category: string };
}

export interface TimeEntry {
  id: string;
  description: string | null;
  startedAt: string;
  /** Null means the timer is still running. */
  endedAt: string | null;
  durationMinutes: number | null;
  user: { id: string; name: string; avatarUrl: string | null };
}

export interface Attachment {
  id: string;
  taskId: string | null;
  fileId: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  uploadedBy: { id: string; name: string; avatarUrl: string | null };
}

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
  /** Only present on endpoints that span multiple projects, e.g. listMyTasks. */
  project?: { id: string; name: string; key: string };
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
  /** Links where this task is the one that depends: `dependsOn` must happen first. */
  dependencies: Array<{ id: string; type: DependencyType; dependsOn: LinkedTask }>;
  /** Links pointing the other way: `task` is waiting on this one. */
  dependents: Array<{ id: string; type: DependencyType; task: LinkedTask }>;
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
  timeEntries: TimeEntry[];
  attachments: Attachment[];
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

interface PresignedUpload {
  key: string;
  uploadUrl: string;
}

/**
 * Same direct-to-storage pattern as queries/files.ts uploadFile — see that
 * comment for the full explanation. This is the path that matters most for
 * client videos, since attachments are where those actually get dropped.
 */
export async function uploadAttachment(taskId: string, file: File) {
  const contentType = file.type || "application/octet-stream";
  try {
    const presigned = await api.post<PresignedUpload>(`/api/tasks/${taskId}/attachments/presign`, {
      filename: file.name,
      contentType,
    });
    const putRes = await fetch(presigned.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
    if (!putRes.ok) throw new Error(`Direct upload failed (${putRes.status})`);
    return api.post<Attachment>(`/api/tasks/${taskId}/attachments/complete`, {
      key: presigned.key,
      name: file.name,
      size: file.size,
      mimeType: contentType,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 501) {
      const formData = new FormData();
      formData.append("file", file);
      return apiUpload<Attachment>(`/api/tasks/${taskId}/attachments`, formData);
    }
    throw err;
  }
}
export const deleteAttachment = (id: string) => api.delete<void>(`/api/attachments/${id}`);
// To fetch the bytes, use downloadFile(attachment.fileId, …) from queries/files —
// stored URLs are not publicly served.

export const createComment = (taskId: string, input: CreateCommentInput) => api.post(`/api/tasks/${taskId}/comments`, input);

/**
 * Links two tasks. The row is created *on* `taskId`, meaning "taskId depends on
 * dependsOnId" — so to record that A blocks B you post to B with dependsOnId A.
 */
export const addDependency = (taskId: string, input: CreateDependencyInput) =>
  api.post<{ id: string }>(`/api/tasks/${taskId}/dependencies`, input);
export const removeDependency = (id: string) => api.delete<void>(`/api/dependencies/${id}`);

export const listTimeEntries = (taskId: string) => api.get<TimeEntry[]>(`/api/tasks/${taskId}/time-entries`);
/** Omit endedAt and durationMinutes to start a running timer. */
export const createTimeEntry = (
  taskId: string,
  input: { startedAt: Date; endedAt?: Date; durationMinutes?: number; description?: string; isManual?: boolean },
) => api.post<TimeEntry>(`/api/tasks/${taskId}/time-entries`, input);
export const stopTimeEntry = (id: string) => api.patch<TimeEntry>(`/api/time-entries/${id}/stop`, {});
export const deleteTimeEntry = (id: string) => api.delete<void>(`/api/time-entries/${id}`);

export const listMyTasks = (workspaceId?: string) =>
  api.get<TaskSummary[]>(`/api/my-tasks${workspaceId ? `?workspaceId=${workspaceId}` : ""}`);
