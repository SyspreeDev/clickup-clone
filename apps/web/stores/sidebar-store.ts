import { create } from "zustand";

interface SidebarState {
  isMobileOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isMobileOpen: false,
  open: () => set({ isMobileOpen: true }),
  close: () => set({ isMobileOpen: false }),
  toggle: () => set((s) => ({ isMobileOpen: !s.isMobileOpen })),
}));
