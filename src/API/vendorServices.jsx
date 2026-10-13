import { client } from "./client";

// Vendor monetization: freemium subscription and sponsored ad campaigns.
export const vendorServicesApi = {
  getSubscription: () =>
    client.get("/vendor/subscription").then((r) => r.data),
  changeSubscription: (plan) =>
    client.post("/vendor/subscription", { plan }).then((r) => r.data),
  getAdvertisements: () =>
    client.get("/vendor/advertisements").then((r) => r.data),
  createAdvertisement: (payload) =>
    client.post("/vendor/advertisements", payload).then((r) => r.data),
  setAdvertisementStatus: (id, status) =>
    client.patch(`/vendor/advertisements/${id}/status`, { status }).then((r) => r.data),
};
