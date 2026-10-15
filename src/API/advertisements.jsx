import { client } from "./client";

export const advertisementsApi = {
  // Approved, live ads for a storefront slot: HOMEPAGE_HERO, FEATURED, …
  getLive: (placement, limit) =>
    client.get("/advertisements", { params: { placement, limit } }).then((r) => r.data.data || []),
};
