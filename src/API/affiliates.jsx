import { client } from "./client";

export const affiliatesApi = {
  generateLink: (payload) =>
    client.post("/affiliates/links", payload).then((r) => r.data),
  getMyLinks: () =>
    client.get("/affiliates/links").then((r) => r.data),
  getMyWallet: () =>
    client.get("/affiliates/wallet").then((r) => r.data),
  getMyPayouts: () =>
    client.get("/affiliates/payouts").then((r) => r.data),
  trackClick: (code) =>
    client.get(`/affiliates/track/${code}`).then((r) => r.data),
  // Seller: affiliate-referred sales of my products.
  getVendorSummary: () =>
    client.get("/affiliates/vendor/summary").then((r) => r.data),
  requestPayout: (payload) =>
    client.post("/affiliates/payouts/request", payload).then((r) => r.data),
};
