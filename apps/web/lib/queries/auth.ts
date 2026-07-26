import { api } from "@/lib/api-client";
import type { CurrentUser } from "@/stores/auth-store";
import type { LoginInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput } from "@repo/shared-types";

interface AuthResponse {
  user: Omit<CurrentUser, "workspaces">;
  accessToken: string;
}

export const login = (input: LoginInput) => api.post<AuthResponse>("/api/auth/login", input);
export const register = (input: RegisterInput) => api.post<AuthResponse>("/api/auth/register", input);
export const logout = () => api.post<void>("/api/auth/logout");
export const forgotPassword = (input: ForgotPasswordInput) => api.post<{ ok: true }>("/api/auth/forgot-password", input);
export const resetPassword = (input: ResetPasswordInput) => api.post<{ ok: true }>("/api/auth/reset-password", input);
export const verifyEmail = (token: string) => api.get<{ ok: true }>(`/api/auth/verify-email/${token}`);
export const resendVerification = () => api.post<{ ok: true }>("/api/auth/resend-verification");
export const getMe = () => api.get<CurrentUser>("/api/auth/me");
