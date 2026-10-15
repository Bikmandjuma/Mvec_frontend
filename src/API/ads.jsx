import { client } from "./client";

// Public sponsored products (seller ad campaigns) for storefront surfaces.
export const adsApi = {
  sponsored: (params) =>
    client.get("/ads/sponsored", { params }).then((r) => r.data),
  click: (adId) =>
    client.post(`/ads/${adId}/click`).then((r) => r.data),
};
