import { client } from "./client";

export const storesApi = {
  getPublicBySlug: (slug) =>
    client.get(`/stores/public/${slug}`).then((r) => r.data),
  // { store: primary, stores: [...with productCount], maxStores }
  getMyStore: () =>
    client.get("/stores/mine").then((r) => r.data),
  // Same as getMyStore, but resolves to an empty list when the vendor has no store yet.
  getMyStores: () =>
    client.get("/stores/mine").then((r) => r.data).catch((err) => {
      if (err?.response?.status === 404) return { store: null, stores: [], maxStores: null };
      throw err;
    }),
  create: (payload) =>
    client.post("/stores", payload).then((r) => r.data),
  // Updates the primary store.
  update: (payload) =>
    client.put("/stores/mine", payload).then((r) => r.data),
  updateById: (id, payload) =>
    client.put(`/stores/mine/${id}`, payload).then((r) => r.data),
  setPrimary: (id) =>
    client.patch(`/stores/mine/${id}/primary`).then((r) => r.data),
  remove: (id) =>
    client.delete(`/stores/mine/${id}`).then((r) => r.data),
};
