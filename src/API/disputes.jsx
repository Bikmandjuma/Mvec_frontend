import { client } from "./client";

export const disputesApi = {
  // All marketplace disputes (super_admin only).
  getAll: (params) =>
    client.get("/disputes", { params }).then((r) => r.data),
  // Disputes the signed-in user raised (buyers) or is involved in.
  getMine: () =>
    client.get("/disputes/mine").then((r) => r.data),
  open: (payload) =>
    client.post("/disputes", payload).then((r) => r.data),
  submitEvidence: (disputeId, payload) =>
    client.post(`/disputes/${disputeId}/evidence`, payload).then((r) => r.data),
  // One case: details, timeline and what you may do next.
  getCase: (disputeId) =>
    client.get(`/disputes/${disputeId}/case`).then((r) => r.data),
  fullRefund: (disputeId, note) =>
    client.post(`/disputes/${disputeId}/full-refund`, { note }).then((r) => r.data),
  offer: (disputeId, amount, note) =>
    client.post(`/disputes/${disputeId}/offer`, { amount, note }).then((r) => r.data),
  acceptOffer: (disputeId) =>
    client.post(`/disputes/${disputeId}/offer/accept`).then((r) => r.data),
  declineOffer: (disputeId) =>
    client.post(`/disputes/${disputeId}/offer/decline`).then((r) => r.data),
  withdraw: (disputeId, note) =>
    client.post(`/disputes/${disputeId}/withdraw`, { note }).then((r) => r.data),
  escalate: (disputeId, reason) =>
    client.post(`/disputes/${disputeId}/escalate`, { reason }).then((r) => r.data),
  decide: (disputeId, payload) =>
    client.post(`/disputes/${disputeId}/decide`, payload).then((r) => r.data),
  arbitrate: (disputeId, payload) =>
    client.post(`/disputes/${disputeId}/arbitrate`, payload).then((r) => r.data),
};
