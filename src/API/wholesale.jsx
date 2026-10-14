import { client } from "./client";

export const wholesaleApi = {
  getMine: () =>
    client.get("/wholesale/orders/mine").then((r) => r.data),
  createOrder: (payload) =>
    client.post("/wholesale/orders", payload).then((r) => r.data),
  // Vendor pays: { method: "momo" | "card", phoneNumber? } -> { paymentId, status, checkoutUrl? }
  pay: (orderId, payload) =>
    client.post(`/wholesale/orders/${orderId}/pay`, payload).then((r) => r.data),
  holdEscrow: (orderId, payload) =>
    client.post(`/wholesale/orders/${orderId}/hold-escrow`, payload).then((r) => r.data),
  confirmReceipt: (orderId) =>
    client.post(`/wholesale/orders/${orderId}/confirm-receipt`).then((r) => r.data),
  markShipped: (orderId) =>
    client.post(`/wholesale/orders/${orderId}/ship`).then((r) => r.data),
};
