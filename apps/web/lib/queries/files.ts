import { api, apiUpload, apiDownload } from "@/lib/api-client";

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

export function uploadFile(workspaceId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<FileItem>(`/api/workspaces/${workspaceId}/files`, formData);
}

/**
 * Downloads go through the authorized API route, so they need the bearer token —
 * which a plain <a href> can't send. Fetch it, then hand the browser a blob.
 */
export async function downloadFile(fileId: string, fileName: string) {
  const blob = await apiDownload(`/api/files/${fileId}/download`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
