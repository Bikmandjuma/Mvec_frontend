import { client } from "./client";

export const productsApi = {
  getAll: (params) =>
    client.get("/products", { params }).then((r) => r.data),
  getById: (id) =>
    client.get(`/products/${id}`).then((r) => r.data.product),
  getBySlug: (slug) =>
    client.get(`/products/slug/${slug}`).then((r) => r.data.product),
  getVendorProducts: () =>
    client.get("/products/vendor/me").then((r) => r.data),
  getRecommendations: (limit) =>
    client.get("/products/recommendations", { params: { limit } }).then((r) => r.data),
  create: (payload) =>
    client.post("/products", payload).then((r) => r.data),
  update: (id, payload) =>
    client.put(`/products/${id}`, payload).then((r) => r.data),
  delete: (id) =>
    client.delete(`/products/${id}`).then((r) => r.data),
  // Inventory operations
  adjustStock: (id, payload) =>
    client.patch(`/products/${id}/stock`, payload).then((r) => r.data),
  moveToStore: (productIds, storeId, note) =>
    client.post("/products/vendor/move-store", { productIds, storeId, note }).then((r) => r.data),
  getStockMovements: (params) =>
    client.get("/products/vendor/stock-movements", { params }).then((r) => r.data),
};
