import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { verifyAccessToken } from "../lib/jwt";
import { env } from "../config/env";

let io: SocketIOServer | undefined;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsAllowAll ? true : env.corsOrigin, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("Missing auth token"));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    io?.emit("presence:online", { userId });

    socket.on("join:workspace", (workspaceId: string) => socket.join(`workspace:${workspaceId}`));
    socket.on("leave:workspace", (workspaceId: string) => socket.leave(`workspace:${workspaceId}`));
    socket.on("join:project", (projectId: string) => socket.join(`project:${projectId}`));
    socket.on("leave:project", (projectId: string) => socket.leave(`project:${projectId}`));
    socket.on("join:channel", (channelId: string) => socket.join(`channel:${channelId}`));
    socket.on("leave:channel", (channelId: string) => socket.leave(`channel:${channelId}`));

    socket.on("typing:start", (payload: { channelId: string }) => {
      socket.to(`channel:${payload.channelId}`).emit("presence:typing", { userId, channelId: payload.channelId, typing: true });
    });
    socket.on("typing:stop", (payload: { channelId: string }) => {
      socket.to(`channel:${payload.channelId}`).emit("presence:typing", { userId, channelId: payload.channelId, typing: false });
    });

    socket.on("disconnect", () => {
      io?.emit("presence:offline", { userId });
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.io server not initialized yet");
  return io;
}

// Convenience emit helpers used by REST controllers after a mutation persists.
export const emitToWorkspace = (workspaceId: string, event: string, payload: unknown) =>
  getIO().to(`workspace:${workspaceId}`).emit(event, payload);

export const emitToProject = (projectId: string, event: string, payload: unknown) =>
  getIO().to(`project:${projectId}`).emit(event, payload);

export const emitToChannel = (channelId: string, event: string, payload: unknown) =>
  getIO().to(`channel:${channelId}`).emit(event, payload);

export const emitToUser = (userId: string, event: string, payload: unknown) =>
  getIO().to(`user:${userId}`).emit(event, payload);
