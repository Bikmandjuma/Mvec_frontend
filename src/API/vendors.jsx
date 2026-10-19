import { client } from "./client";

export const vendorsApi = {
  getAll: (params) =>
    client.get("/vendors", { params }).then((r) => r.data),
  getByIdOrSlug: (idOrSlug) =>
    client.get(`/vendors/${idOrSlug}`).then((r) => r.data),
  // Following a store is saved on the account; both return { following, followers }.
  follow: (vendorId) =>
    client.post(`/vendors/${vendorId}/follow`).then((r) => r.data),
  unfollow: (vendorId) =>
    client.delete(`/vendors/${vendorId}/follow`).then((r) => r.data),
  onboard: (payload) =>
    client.post("/vendors/onboard", payload).then((r) => r.data),
  becomeSeller: (payload) =>
    client.post("/vendors/become-seller", payload).then((r) => r.data),
  getMyProfile: () =>
    client.get("/vendors/me/profile").then((r) => r.data),
  updateMyProfile: (payload) =>
    client.patch("/vendors/me/profile", payload).then((r) => r.data),
  // MVEC's commission for this seller in every category.
  getMyFees: () =>
    client.get("/vendors/me/fees").then((r) => r.data),
};
