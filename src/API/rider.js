import { client, mapAuthResponse } from "./client";

const data = (r) => r.data;

/** Ikiguzi riders (`/api/rider/*`), same calls as the mobile app. */
export const riderApi = {
  // After the phone check: { verificationToken, fullName, email?, vehicleType, plateNumber? } -> { token, user }.
  register: (payload) => client.post("/rider/register", payload).then((r) => mapAuthResponse(r.data)),
  me: () => client.get("/rider/me").then(data),
  stats: () => client.get("/rider/stats").then(data),
  setOnline: (isOnline) => client.patch("/rider/availability", { isOnline }).then(data),
  // A GPS fix: { lat, lng, heading?, speedMps?, accuracyM? }.
  sendLocation: (fix) => client.patch("/rider/location", fix).then(data),
  // The trip's live view: where to go, the road route, turn-by-turn steps and time left.
  navigation: (id) => client.get(`/rider/deliveries/${id}/navigation`).then(data),
  // Buyers, sellers and admins: the riders carrying an order's parcels.
  orderLive: (orderId) => client.get(`/orders/${orderId}/live`).then(data),
  available: () => client.get("/rider/deliveries/available").then(data),
  active: () => client.get("/rider/deliveries/active").then(data),
  history: () => client.get("/rider/deliveries/history").then(data),
  accept: (id) => client.post(`/rider/deliveries/${id}/accept`).then(data),
  decline: (id) => client.post(`/rider/deliveries/${id}/reject`).then(data),
  // Before pickup: give the parcel back to other riders.
  handBack: (id) => client.post(`/rider/deliveries/${id}/release`).then(data),
  step: (id, status) => client.patch(`/rider/deliveries/${id}/status`, { status }).then(data),
  confirm: (id, code) => client.post(`/rider/deliveries/${id}/confirm`, { code }).then(data),
  wallet: () => client.get("/rider/wallet").then(data),
  withdrawals: () => client.get("/rider/wallet/withdrawals").then(data),
  withdraw: (amount, accountName, accountNumber) => client.post("/rider/wallet/withdrawals", { amount, payoutDetails: { accountName, accountNumber } }).then(data),
};

/** Admin review of riders. */
export const ridersAdminApi = {
  list: (status) => client.get("/admin/riders", { params: status ? { status } : {} }).then(data),
  review: (id, status, note) => client.patch(`/admin/riders/${id}`, { status, note }).then(data),
  // Parcels on the way now, and handing one back before pickup.
  deliveries: () => client.get("/admin/deliveries").then(data),
  release: (id, note) => client.post(`/admin/deliveries/${id}/release`, { note }).then(data),
};
