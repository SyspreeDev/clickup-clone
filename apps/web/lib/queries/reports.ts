import { api, API_URL } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export interface TeamProductivityRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  assigned: number;
  completed: number;
}
export interface ProjectProgressRow {
  projectId: string;
  name: string;
  key: string;
  total: number;
  completed: number;
  percent: number;
}
export interface TaskCompletionPoint {
  date: string;
  count: number;
}
export interface WorkloadRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  activeTasks: number;
}
export interface TimeTrackingRow {
  userId: string;
  name: string;
  minutes: number;
}

export const getTeamProductivity = (workspaceId: string) =>
  api.get<TeamProductivityRow[]>(`/api/workspaces/${workspaceId}/reports/team-productivity`);
export const getProjectProgress = (workspaceId: string) =>
  api.get<ProjectProgressRow[]>(`/api/workspaces/${workspaceId}/reports/project-progress`);
export const getTaskCompletionTrend = (workspaceId: string) =>
  api.get<TaskCompletionPoint[]>(`/api/workspaces/${workspaceId}/reports/task-completion`);
export const getWorkload = (workspaceId: string) =>
  api.get<WorkloadRow[]>(`/api/workspaces/${workspaceId}/reports/workload`);
export const getTimeTracking = (workspaceId: string) =>
  api.get<TimeTrackingRow[]>(`/api/workspaces/${workspaceId}/reports/time-tracking`);

export async function exportReport(workspaceId: string, report: string) {
  const accessToken = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}/reports/export?report=${report}`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
