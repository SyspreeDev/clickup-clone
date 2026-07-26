import { create } from "zustand";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  timezone: string;
  emailVerified: boolean;
  createdAt: string;
  workspaces: Array<{ id: string; name: string; slug: string; logoUrl: string | null; role: string }>;
}

interface AuthState {
  accessToken: string | null;
  user: CurrentUser | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  setSession: (accessToken: string, user?: CurrentUser | null) => void;
  setUser: (user: CurrentUser | null) => void;
  setStatus: (status: AuthState["status"]) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: "idle",
  setSession: (accessToken, user) =>
    set((state) => ({ accessToken, user: user !== undefined ? user : state.user, status: "authenticated" })),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clear: () => set({ accessToken: null, user: null, status: "unauthenticated" }),
}));
