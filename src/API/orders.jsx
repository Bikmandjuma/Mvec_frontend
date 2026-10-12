import { client } from "./client";
import { getVisitorId } from "./affiliates";

// Every order handed to the UI has `id`, whatever the backend version sends.
const withOrderId = (order) => (order ? { ...order, id: order.id || order._id } : order);

export const ordersApi = {
  checkout: (payload) => {
    const shippingAddress = payload.shippingAddress || {};
    const paymentMap = {
      momo: "MOMO",
      mtn: "MOMO",
      airtel: "AIRTEL",
      cash: "CASH_ON_DELIVERY",
      cod: "CASH_ON_DELIVERY",
    };
    const requested = String(payload.paymentMethod || "momo").toLowerCase();
    const body = {
      shippingAddress: {
        street: shippingAddress.street || shippingAddress.address || "",
        city: shippingAddress.city || shippingAddress.district || "",
        state: shippingAddress.state || shippingAddress.province || "",
        country: shippingAddress.country || "Rwanda",
        postalCode: shippingAddress.postalCode || "",
      },
      paymentMethod: paymentMap[requested] || "MOMO",
      visitorId: getVisitorId() || undefined,
    };
    return client.post("/orders/checkout", body).then((r) => r.data);
  },
  directCheckout: (payload) => {
    const shippingAddress = payload.shippingAddress || {};
    const paymentMap = {
      momo: "MOMO",
      mtn: "MOMO",
      airtel: "AIRTEL",
      card: "CARD",
      cash: "CASH_ON_DELIVERY",
      cod: "CASH_ON_DELIVERY",
    };
    const requested = String(payload.paymentMethod || "momo").toLowerCase();
    const body = {
      items: payload.items || [],
      shippingAddress: {
        street: shippingAddress.street || shippingAddress.address || "",
        city: shippingAddress.city || shippingAddress.district || "",
        state: shippingAddress.state || shippingAddress.province || "",
        country: shippingAddress.country || "Rwanda",
        postalCode: shippingAddress.postalCode || "",
      },
      paymentMethod: paymentMap[requested] || "MOMO",
      visitorId: getVisitorId() || undefined,
    };
    return client.post("/orders/direct-checkout", body).then((r) => r.data);
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
