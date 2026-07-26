import { api } from "@/lib/api-client";

export interface SearchResults {
  tasks: Array<{ id: string; title: string; number: number; project: { id: string; key: string; name: string } }>;
  projects: Array<{ id: string; name: string; key: string }>;
  members: Array<{ id: string; name: string; avatarUrl: string | null; email: string }>;
  files: Array<{ id: string; name: string }>;
}

export const search = (workspaceId: string, q: string) =>
  api.get<SearchResults>(`/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(q)}`);
