import { client } from "./client";

export const payoutsApi = {
  getBalance: () =>
    client.get("/payouts/balance").then((r) => r.data),
  requestPayout: (payload) =>
    client.post("/payouts/request", payload).then((r) => r.data),
  getHistory: () =>
    client.get("/payouts/history").then((r) => r.data),
  cancel: (id) =>
    client.post(`/payouts/${id}/cancel`).then((r) => r.data),
  getStatement: (params = {}) =>
    client.get("/payouts/statement", { params }).then((r) => r.data),
};

// Super admin: approve, mark paid or reject seller withdrawal requests.
export const vendorPayoutsAdminApi = {
  list: (params = {}) =>
    client.get("/admin/vendor-payouts", { params }).then((r) => r.data),
  approve: (id) =>
    client.post(`/admin/vendor-payouts/${id}/approve`).then((r) => r.data),
  markPaid: (id, transferReference) =>
    client.post(`/admin/vendor-payouts/${id}/mark-paid`, { transferReference }).then((r) => r.data),
  reject: (id, reason) =>
    client.post(`/admin/vendor-payouts/${id}/reject`, { reason }).then((r) => r.data),
};
