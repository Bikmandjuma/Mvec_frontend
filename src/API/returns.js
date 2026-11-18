import { client } from "./client";

const data = (r) => r.data;

/** Returns after delivery: buyers ask, sellers answer, Ikiguzi decides when they disagree. */
export const returnsApi = {
  eligibility: (orderId) => client.get(`/returns/orders/${orderId}/eligibility`).then(data),
  create: (payload) => client.post("/returns", payload).then(data),
  mine: () => client.get("/returns/mine").then((r) => r.data.returns || []),
  cancel: (id) => client.post(`/returns/${id}/cancel`).then(data),
  escalate: (id, reason) => client.post(`/returns/${id}/escalate`, { reason }).then(data),
  // Sellers
  forSeller: (status) => client.get("/returns/seller", { params: status ? { status } : {} }).then((r) => r.data.returns || []),
  approve: (id, instructions) => client.post(`/returns/${id}/approve`, { instructions }).then(data),
  reject: (id, reason) => client.post(`/returns/${id}/reject`, { reason }).then(data),
  received: (id, restock) => client.post(`/returns/${id}/received`, { restock }).then(data),
  refundNow: (id) => client.post(`/returns/${id}/refund`).then(data),
  // Ikiguzi
  forAdmin: (status) => client.get("/returns/admin", { params: status ? { status } : {} }).then((r) => r.data.returns || []),
  decide: (id, decision, note) => client.post(`/returns/${id}/decide`, { decision, note }).then(data),
};
