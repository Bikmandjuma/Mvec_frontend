// src/services/socket.js
// Single shared Socket.IO connection for the whole app (real-time messaging,
// notifications, presence). Connects once with the current JWT and is
// reused everywhere via getSocket() instead of opening a new connection per
// component.
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");

let socket = null;

export function getSocket() {
  const token = localStorage.getItem("huska_token");
  if (!token) return null;

  if (socket && socket.connected) return socket;

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  } else {
    socket.auth = { token };
  }

  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
