import { client } from "./client";

export const shippingApi = {
  getMyZones: () =>
    client.get("/shipping/zones/mine").then((r) => r.data),
  createZone: (payload) =>
    client.post("/shipping/zones", payload).then((r) => r.data),
  updateZone: (id, payload) =>
    client.patch(`/shipping/zones/${id}`, payload).then((r) => r.data),
  removeZone: (id) =>
    client.delete(`/shipping/zones/${id}`).then((r) => r.data),
  // Buyer: delivery fee for items to an address. { address:{province,district}, method, items:[{productId,qty}] }
  quote: (payload) =>
    client.post("/shipping/quote", payload).then((r) => r.data),
  // Seller: what a buyer at an address would pay for one of my stores.
  preview: (payload) =>
    client.post("/shipping/preview", payload).then((r) => r.data),
};
