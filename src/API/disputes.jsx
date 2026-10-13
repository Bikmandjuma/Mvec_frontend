import { client } from "./client";

export const disputesApi = {
  // All marketplace disputes (super_admin only).
  getAll: (params) =>
    client.get("/disputes", { params }).then((r) => r.data),
  // Disputes the current user raised, or that were raised against them as a vendor.
  getMine: () =>
    client.get("/disputes/mine").then((r) => r.data),
  open: (payload) =>
    client.post("/disputes", payload).then((r) => r.data),
  submitEvidence: (disputeId, payload) =>
    client.post(`/disputes/${disputeId}/evidence`, payload).then((r) => r.data),
  arbitrate: (disputeId, payload) =>
    client.post(`/disputes/${disputeId}/arbitrate`, payload).then((r) => r.data),
};
