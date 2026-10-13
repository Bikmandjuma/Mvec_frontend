import { client } from "./client";

// Normalises the backend's { data, meta: { unreadCount } } into one shape.
const mine = (params) =>
  client.get("/notifications/mine", { params }).then((r) => ({
    notifications: (r.data.data || []).map((n) => ({ ...n, body: n.body || n.message || "" })),
    unreadCount: r.data.meta?.unreadCount || 0,
  }));

export const notificationsApi = {
  getMine: mine,
  getAll: mine,
  markAsRead: (id) =>
    client.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllAsRead: () =>
    client.post("/notifications/read-all").then((r) => r.data),
  remove: (id) =>
    client.delete(`/notifications/${id}`).then((r) => r.data),
};
