import { client } from "./client";

// Opaque id minted by the server on the first referral click. It is the only
// thing the browser keeps: affiliate, product and price are resolved server-side.
const VISITOR_KEY = "mvec_visitor_id";

export const getVisitorId = () => {
  try {
    return localStorage.getItem(VISITOR_KEY) || "";
  } catch {
    return "";
  }
};

const saveVisitorId = (id) => {
  try {
    if (id) localStorage.setItem(VISITOR_KEY, id);
  } catch {
    /* storage unavailable: attribution simply will not persist */
  }
};

// React StrictMode (dev) mounts effects twice; share one in-flight request per
// code so a single page view is a single click.
const inflight = new Map();

export const affiliatesApi = {
  generateLink: (payload) =>
    client.post("/affiliates/links", payload).then((r) => r.data),
  getMyLinks: (params) =>
    client.get("/affiliates/links", { params }).then((r) => r.data),
  // Terminates (soft) — history is kept server-side.
  terminateLink: (id) =>
    client.delete(`/affiliates/links/${id}`).then((r) => r.data),
  deleteLink: (id) =>
    client.delete(`/affiliates/links/${id}`).then((r) => r.data),
  getOverview: () =>
    client.get("/affiliates/overview").then((r) => r.data),
  getStats: (range = "30d") =>
    client.get("/affiliates/stats", { params: { range } }).then((r) => r.data),
  getCommissions: (params) =>
    client.get("/affiliates/commissions", { params }).then((r) => r.data),
  getMyWallet: () =>
    client.get("/affiliates/wallet").then((r) => r.data?.wallet || r.data?.data || r.data),
  getMyPayouts: () =>
    client.get("/affiliates/payouts").then((r) => r.data),
  trackClick: (code) => {
    if (inflight.has(code)) return inflight.get(code);
    const request = client
      .get(`/affiliates/track/${encodeURIComponent(code)}`, { params: { visitorId: getVisitorId() || undefined } })
      .then((r) => {
        saveVisitorId(r.data?.data?.visitorId);
        return r.data;
      })
      .finally(() => setTimeout(() => inflight.delete(code), 2000));
    inflight.set(code, request);
    return request;
  },
  requestPayout: (payload) =>
    client.post("/affiliates/payouts/request", payload).then((r) => r.data),
};
