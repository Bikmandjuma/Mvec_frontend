import { client } from "./client";

export const wishlistApi = {
  get: () => client.get("/auth/wishlist").then((r) => r.data.items || []),
  add: (productIds) => client.post("/auth/wishlist", { productIds }).then((r) => r.data.items || []),
  remove: (productId) => client.delete(`/auth/wishlist/${productId}`).then((r) => r.data.items || []),
};
