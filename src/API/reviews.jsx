import { client } from "./client";

export const reviewsApi = {
  getVendorReviews: () =>
    client.get("/reviews/vendor/mine").then((r) => r.data),
  create: (payload) =>
    client.post("/reviews", payload).then((r) => r.data),
  getForProduct: (productId, params) =>
    client.get(`/reviews/product/${productId}`, { params }).then((r) => r.data),
  update: (id, payload) =>
    client.patch(`/reviews/${id}`, payload).then((r) => r.data),
  remove: (id) =>
    client.delete(`/reviews/${id}`).then((r) => r.data),
};
