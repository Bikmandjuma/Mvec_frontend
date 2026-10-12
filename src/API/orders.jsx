import { client } from "./client";

// Every order handed to the UI has `id`, whatever the backend version sends.
const withOrderId = (order) => (order ? { ...order, id: order.id || order._id } : order);

// Checkout payload: the server prices everything; the client only says what,
// where and to whom. `recipient` is who receives the parcel.
const checkoutBody = ({ shippingAddress = {}, recipient = {}, deliveryMethod = "standard", paymentMethod = "MOMO" }) => ({
  shippingAddress: {
    street: shippingAddress.street || "",
    district: shippingAddress.district || "",
    sector: shippingAddress.sector || "",
    province: shippingAddress.province || "",
    country: "Rwanda",
  },
  recipient: {
    name: recipient.name || "",
    phone: recipient.phone || "",
    email: recipient.email || "",
  },
  deliveryMethod,
  paymentMethod,
});

export const ordersApi = {
  checkout: (payload) =>
    client.post("/orders/checkout", checkoutBody(payload)).then((r) => ({ ...r.data, order: withOrderId(r.data.order) })),
  directCheckout: (payload) =>
    client
      .post("/orders/direct-checkout", { ...checkoutBody(payload), items: payload.items || [] })
      .then((r) => ({ ...r.data, order: withOrderId(r.data.order) })),
  getMyOrders: () =>
    client.get("/orders/my-orders").then((r) => ({ ...r.data, orders: (r.data.orders || []).map(withOrderId) })),
  getVendorOrders: () =>
    client.get("/orders/vendor/orders").then((r) => r.data),
  getDeliverable: () =>
    client.get("/orders/deliverable").then((r) => ({
      ...r.data,
      orders: (r.data.orders || []).map(withOrderId),
    })),
  getById: (id) => {
    if (!id || id === "undefined") return Promise.reject(new Error("A valid order ID is required."));
    return client.get(`/orders/${id}`).then((r) => ({ ...r.data, order: withOrderId(r.data.order) }));
  },
  updateStatus: (id, status) =>
    client.patch(`/orders/${id}/status`, { status }).then((r) => r.data),
  updateVendorOrderStatus: (payload) =>
    client.patch("/orders/vendor/status", payload).then((r) => r.data),
  confirmDelivery: (id, deliveryOtp) => {
    if (!id || id === "undefined") return Promise.reject(new Error("A valid order ID is required."));
    return client.patch(`/orders/${id}/deliver`, { deliveryOtp }).then((r) => r.data);
  },
  cancel: (id) => {
    if (!id || id === "undefined") return Promise.reject(new Error("A valid order ID is required."));
    return client.post(`/orders/${id}/cancel`).then((r) => ({ ...r.data, order: withOrderId(r.data.order) }));
  },
};
