import { client } from "./client";

// The backend returns Mongoose documents (`_id`, `Fullname`, populated `sender`,
// `readBy`); the Messages page works with flat ids and `fullName`.
const idOf = (v) => String(v?._id || v?.id || v || "");
const person = (p) => (p && typeof p === "object" ? { ...p, id: idOf(p), fullName: p.fullName || p.Fullname || "" } : { id: idOf(p) });
const conversation = (c) => c && { ...c, id: idOf(c), participants: (c.participants || []).map(person) };
export const normalizeMessage = (m) => m && {
  ...m,
  id: idOf(m),
  conversationId: idOf(m.conversationId || m.conversation),
  senderId: idOf(m.senderId || m.sender),
  readByIds: m.readByIds || (m.readBy || []).map(idOf),
};

export const conversationsApi = {
  create: (payload) =>
    client.post("/conversations", payload).then((r) => ({ ...r.data, conversation: conversation(r.data.conversation) })),
  getAll: () =>
    client.get("/conversations").then((r) => ({ ...r.data, conversations: (r.data.conversations || []).map(conversation) })),
  getMessages: (id) =>
    client.get(`/conversations/${id}/messages`).then((r) => ({ ...r.data, messages: (r.data.messages || []).map(normalizeMessage) })),
  sendMessage: (id, payload) =>
    client.post(`/conversations/${id}/messages`, payload).then((r) => ({ ...r.data, message: normalizeMessage(r.data.message) })),
  markRead: (id) =>
    client.patch(`/conversations/${id}/read`).then((r) => r.data),
  searchContacts: (q) =>
    client.get("/conversations/contacts", { params: { q } }).then((r) => ({ ...r.data, contacts: (r.data.contacts || []).map(person) })),
};
