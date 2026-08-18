"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth-store";
import type { TaskSummary } from "@/lib/queries/tasks";

export function useSocketSync(workspaceId: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);

    function joinWorkspace() {
      socket.emit("join:workspace", workspaceId);
    }
    if (socket.connected) joinWorkspace();
    socket.on("connect", joinWorkspace);

    const onTaskChange = (task: TaskSummary) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    };
    const onTaskDeleted = () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    };
    const onNotification = (n: { title: string }) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
      toast(n.title);
    };
    const onCommentChange = (comment: { taskId?: string }) => {
      if (comment?.taskId) queryClient.invalidateQueries({ queryKey: ["task", comment.taskId] });
    };
    const onActivity = () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    };
    const onMessage = (message: { channelId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", message.channelId] });
      queryClient.invalidateQueries({ queryKey: ["channels", workspaceId] });
    };
    const onPresence = () => {
      queryClient.invalidateQueries({ queryKey: ["presence"] });
    };
    const onFileChange = () => {
      queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
    };

    socket.on("task:created", onTaskChange);
    socket.on("task:updated", onTaskChange);
    socket.on("task:moved", onTaskChange);
    socket.on("task:deleted", onTaskDeleted);
    socket.on("notification:new", onNotification);
    socket.on("comment:created", onCommentChange);
    socket.on("comment:updated", onCommentChange);
    socket.on("activity:new", onActivity);
    socket.on("message:new", onMessage);
    socket.on("presence:online", onPresence);
    socket.on("presence:offline", onPresence);
    socket.on("file:created", onFileChange);
    socket.on("file:deleted", onFileChange);

    return () => {
      socket.emit("leave:workspace", workspaceId);
      socket.off("connect", joinWorkspace);
      socket.off("task:created", onTaskChange);
      socket.off("task:updated", onTaskChange);
      socket.off("task:moved", onTaskChange);
      socket.off("task:deleted", onTaskDeleted);
      socket.off("notification:new", onNotification);
      socket.off("comment:created", onCommentChange);
      socket.off("comment:updated", onCommentChange);
      socket.off("activity:new", onActivity);
      socket.off("message:new", onMessage);
      socket.off("presence:online", onPresence);
      socket.off("presence:offline", onPresence);
      socket.off("file:created", onFileChange);
      socket.off("file:deleted", onFileChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, workspaceId]);
}
