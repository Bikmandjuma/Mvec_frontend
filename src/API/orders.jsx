import { client } from "./client";
import { getReferralCode } from "../services/referral";

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
      shippingAddress: mapAddress(shippingAddress),
      shippingMethod: String(payload.shippingMethod || "STANDARD").toUpperCase(),
      paymentMethod: paymentMap[requested] || "MOMO",
      couponCode: payload.couponCode || undefined,
      affiliateCode: getReferralCode() || undefined,
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
      shippingAddress: mapAddress(shippingAddress),
      shippingMethod: String(payload.shippingMethod || "STANDARD").toUpperCase(),
      paymentMethod: paymentMap[requested] || "MOMO",
      couponCode: payload.couponCode || undefined,
      affiliateCode: getReferralCode() || undefined,
    };
    return client.post("/orders/direct-checkout", body).then((r) => r.data);
  },
  getMyOrders: () =>
    client.get("/orders/my-orders").then((r) => r.data),
  getVendorOrders: () =>
    client.get("/orders/vendor/orders").then((r) => r.data),
  // All marketplace orders (super_admin only).
  getAll: () =>
    client.get("/orders").then((r) => r.data),
  getById: (id) =>
    client.get(`/orders/${id}`).then((r) => r.data),
  updateStatus: (id, status) =>
    client.patch(`/orders/${id}/status`, { status }).then((r) => r.data),
  // Seller records an order taken in person / by phone.
  createManual: (payload) =>
    client.post("/orders/vendor/manual", payload).then((r) => r.data),
  updateVendorOrderStatus: (payload) =>
    client.patch("/orders/vendor/status", payload).then((r) => r.data),
  confirmDelivery: (id, deliveryOtp) =>
    client.patch(`/orders/${id}/deliver`, { deliveryOtp }).then((r) => r.data),
  cancel: (id) =>
    client.patch(`/orders/${id}/cancel`).then((r) => r.data),
};
