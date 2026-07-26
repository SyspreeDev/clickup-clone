import { api, API_URL } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export interface FileItem {
  id: string;
  workspaceId: string;
  folderId: string | null;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  version: number;
  createdAt: string;
  uploadedBy: { id: string; name: string; avatarUrl: string | null };
}

export const listFiles = (workspaceId: string) => api.get<FileItem[]>(`/api/workspaces/${workspaceId}/files`);
export const deleteFile = (id: string) => api.delete<void>(`/api/files/${id}`);

export async function uploadFile(workspaceId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const accessToken = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}/files`, {
    method: "POST",
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json() as Promise<FileItem>;
}

export function fileDownloadUrl(file: FileItem) {
  return `${API_URL}${file.url}`;
}
