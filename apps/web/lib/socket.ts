import { io, type Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

export function getSocket(accessToken: string): Socket {
  if (socket && socket.connected && socket.auth && (socket.auth as { token: string }).token === accessToken) {
    return socket;
  }
  if (socket) {
    socket.disconnect();
  }
  socket = io(SOCKET_URL, {
    auth: { token: accessToken },
    transports: ["websocket", "polling"],
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
