import { create } from "zustand";

interface TaskDetailState {
  openTaskId: string | null;
  openTask: (taskId: string) => void;
  close: () => void;
}

export const useTaskDetailStore = create<TaskDetailState>((set) => ({
  openTaskId: null,
  openTask: (taskId) => set({ openTaskId: taskId }),
  close: () => set({ openTaskId: null }),
}));
