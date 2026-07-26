import { api } from "@/lib/api-client";

export interface ApiToken {
  id: string;
  name: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export const updateProfile = (input: { name?: string; jobTitle?: string; phone?: string; timezone?: string }) =>
  api.patch(`/api/users/me`, input);
export const changePassword = (input: { currentPassword: string; newPassword: string }) =>
  api.patch<{ ok: true }>(`/api/users/me/password`, input);

export const listApiTokens = () => api.get<ApiToken[]>(`/api/users/me/api-tokens`);
export const createApiToken = (name: string) => api.post<ApiToken & { token: string }>(`/api/users/me/api-tokens`, { name });
export const revokeApiToken = (id: string) => api.delete<void>(`/api/users/me/api-tokens/${id}`);
