import { client } from "./client";
import { getVisitorId } from "./affiliates";

// Every order handed to the UI has `id`, whatever the backend version sends.
const withOrderId = (order) => (order ? { ...order, id: order.id || order._id } : order);

// Checkout payload: the server prices everything; the client only says what,
// where and to whom. `recipient` is who receives the parcel. `visitorId` lets
// the server credit the affiliate whose link the buyer clicked (the server
// resolves the attribution itself; nothing affiliate-related is trusted here).
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
  visitorId: getVisitorId() || undefined,
});

// city = district and state = province, as the backend Order model expects.
const mapAddress = (a = {}) => ({
  street: a.street || a.address || "",
  city: a.district || a.city || "",
  state: a.province || a.state || "",
  province: a.province || a.state || "",
  district: a.district || a.city || "",
  sector: a.sector || "",
  country: a.country || "Rwanda",
  postalCode: a.postalCode || "",
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
  // All marketplace orders (super_admin only).
  getAll: () =>
    client.get("/orders").then((r) => ({ ...r.data, orders: (r.data.orders || []).map(withOrderId) })),
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
  // Seller records an order taken in person / by phone.
  createManual: (payload) =>
    client.post("/orders/vendor/manual", payload).then((r) => r.data),
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
