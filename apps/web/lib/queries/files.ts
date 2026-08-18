import { api, apiUpload, apiDownload, ApiError } from "@/lib/api-client";

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

interface PresignedUpload {
  key: string;
  uploadUrl: string;
}

/**
 * Uploads straight to storage (R2) when the provider supports it, bypassing
 * our server — and the Vercel proxy's request-size ceiling — for the file
 * bytes entirely. Falls back to the old buffered route (a 501 from presign)
 * when it doesn't, e.g. local dev on disk storage.
 */
export async function uploadFile(workspaceId: string, file: File) {
  const contentType = file.type || "application/octet-stream";
  try {
    const presigned = await api.post<PresignedUpload>(`/api/workspaces/${workspaceId}/files/presign`, {
      filename: file.name,
      contentType,
    });
    const putRes = await fetch(presigned.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
    if (!putRes.ok) throw new Error(`Direct upload failed (${putRes.status})`);
    return api.post<FileItem>(`/api/workspaces/${workspaceId}/files/complete`, {
      key: presigned.key,
      name: file.name,
      size: file.size,
      mimeType: contentType,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 501) {
      const formData = new FormData();
      formData.append("file", file);
      return apiUpload<FileItem>(`/api/workspaces/${workspaceId}/files`, formData);
    }
    throw err;
  }
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
