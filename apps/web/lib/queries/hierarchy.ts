import { api } from "@/lib/api-client";
import type {
  CreateProjectFolderInput,
  UpdateProjectFolderInput,
  MoveProjectInput,
  CreateDocInput,
  UpdateDocInput,
} from "@repo/shared-types";

/** A list (ClickUp "List") as returned inside the sidebar tree. */
export interface TreeList {
  id: string;
  name: string;
  key: string;
  icon: string | null;
  color: string | null;
  teamId: string | null;
  folderId: string | null;
  position: number;
  _count: { tasks: number };
}

export interface TreeFolder {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  isPrivate: boolean;
  lists: TreeList[];
}

/** A space (ClickUp "Space", stored as a Team) with its folders and loose lists. */
export interface TreeSpace {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  folders: TreeFolder[];
  lists: TreeList[];
}

export const listTree = (workspaceId: string) => api.get<TreeSpace[]>(`/api/workspaces/${workspaceId}/tree`);

/** A list row on a Space/Folder overview, with task progress. */
export interface OverviewList extends TreeList {
  status: string;
  startDate: string | null;
  targetDate: string | null;
  total: number;
  completed: number;
  percent: number;
}

export interface ContainerOverview {
  container: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    kind: "space" | "folder";
    isPrivate?: boolean;
    description?: string | null;
    teamId?: string;
  };
  folders: Array<{
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    isPrivate: boolean;
    _count: { projects: number };
  }>;
  lists: OverviewList[];
}

export const getOverview = (workspaceId: string, scope: { teamId?: string; folderId?: string }) => {
  const qs = new URLSearchParams();
  if (scope.teamId) qs.set("teamId", scope.teamId);
  if (scope.folderId) qs.set("folderId", scope.folderId);
  return api.get<ContainerOverview>(`/api/workspaces/${workspaceId}/overview?${qs}`);
};

export const createFolder = (workspaceId: string, input: CreateProjectFolderInput) =>
  api.post<TreeFolder>(`/api/workspaces/${workspaceId}/list-folders`, input);

export const updateFolder = (folderId: string, input: UpdateProjectFolderInput) =>
  api.patch<TreeFolder>(`/api/list-folders/${folderId}`, input);

export const deleteFolder = (folderId: string) => api.delete<void>(`/api/list-folders/${folderId}`);

/** Reparent or reorder a list — into a folder, or straight into a space. */
export const moveProject = (projectId: string, input: MoveProjectInput) =>
  api.patch<TreeList>(`/api/projects/${projectId}/move`, input);

// ── Docs ──

export interface DocSummary {
  id: string;
  title: string;
  icon: string | null;
  projectId: string | null;
  teamId: string | null;
  parentId: string | null;
  position: number;
  updatedAt: string;
  createdAt: string;
}

export interface Doc extends DocSummary {
  workspaceId: string;
  /** Tiptap JSON document. */
  content: unknown;
  createdById: string;
}

export const listDocs = (workspaceId: string, scope: { projectId?: string; teamId?: string }) => {
  const qs = new URLSearchParams();
  if (scope.projectId) qs.set("projectId", scope.projectId);
  if (scope.teamId) qs.set("teamId", scope.teamId);
  const suffix = qs.toString() ? `?${qs}` : "";
  return api.get<DocSummary[]>(`/api/workspaces/${workspaceId}/docs${suffix}`);
};

export const createDoc = (workspaceId: string, input: CreateDocInput) =>
  api.post<Doc>(`/api/workspaces/${workspaceId}/docs`, input);

export const getDoc = (docId: string) => api.get<Doc>(`/api/docs/${docId}`);

export const updateDoc = (docId: string, input: UpdateDocInput) => api.patch<Doc>(`/api/docs/${docId}`, input);

export const deleteDoc = (docId: string) => api.delete<void>(`/api/docs/${docId}`);
