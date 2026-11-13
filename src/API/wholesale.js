import { client } from "./client";

// Wholesale orders between vendors (buying) and suppliers (selling).
export const wholesaleApi = {
  getMine: (params) =>
    client.get("/wholesale/orders/mine", { params }).then((r) => r.data),
  // { supplierId, items: [{ productId, quantity }], storeId? }: storeId is the
  // vendor store that receives the goods (the primary store when left out).
  createOrder: (payload) =>
    client.post("/wholesale/orders", payload).then((r) => r.data),
  // Vendor pays: { method: "momo" | "card", phoneNumber? } -> { paymentId, status, checkoutUrl? }
  pay: (orderId, payload) =>
    client.post(`/wholesale/orders/${orderId}/pay`, payload).then((r) => r.data),
  confirmReceipt: (orderId) =>
    client.post(`/wholesale/orders/${orderId}/confirm-receipt`).then((r) => r.data),
  reportProblem: (orderId, reason) =>
    client.post(`/wholesale/orders/${orderId}/report-problem`, { reason }).then((r) => r.data),
  // Vendor or supplier, before shipping (suppliers must give a reason).
  cancel: (orderId, reason) =>
    client.post(`/wholesale/orders/${orderId}/cancel`, { reason }).then((r) => r.data),
  markShipped: (orderId) =>
    client.post(`/wholesale/orders/${orderId}/ship`).then((r) => r.data),
  // Admin
  adminList: (params) =>
    client.get("/wholesale/admin/orders", { params }).then((r) => r.data),
  adminResolve: (orderId, decision, note) =>
    client.post(`/wholesale/admin/orders/${orderId}/resolve`, { decision, note }).then((r) => r.data),
  // Admin: add a completed order's goods to the vendor's store if that failed.
  adminRestock: (orderId) =>
    client.post(`/wholesale/admin/orders/${orderId}/restock`).then((r) => r.data),
  holdEscrow: (orderId) =>
    client.post(`/wholesale/orders/${orderId}/hold-escrow`).then((r) => r.data),
};
