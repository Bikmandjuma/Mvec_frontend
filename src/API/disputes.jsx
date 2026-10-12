import { client } from "./client";

export const disputesApi = {
  getAll: (params) =>
    client.get("/disputes", { params }).then((r) => r.data),
  // Disputes the signed-in user raised (buyers) or is involved in.
  getMine: () =>
    client.get("/disputes/mine").then((r) => r.data),
  open: (payload) =>
    client.post("/disputes", payload).then((r) => r.data),
  submitEvidence: (disputeId, payload) =>
    client.post(`/disputes/${disputeId}/evidence`, payload).then((r) => r.data),
  arbitrate: (disputeId, payload) =>
    client.post(`/disputes/${disputeId}/arbitrate`, payload).then((r) => r.data),
};
