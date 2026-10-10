import { client } from "./client";

const toProductPayload = (payload) => {
  const {
    categoryId,
    mainImage,
    gallery,
    color,
    size,
    material,
    weight,
    capacity,
    model,
    ...rest
  } = payload;
  const media = { ...(payload.media || {}) };
  if (mainImage !== undefined) media.mainImage = mainImage;
  if (gallery !== undefined) media.gallery = gallery;
  const attributes = { ...(payload.attributes || {}) };
  for (const [key, value] of Object.entries({ color, size, material, weight, capacity, model })) {
    if (value !== undefined) attributes[key] = value;
  }
  const editableFields = [
    "name", "sku", "slug", "brand", "shortDescription", "description", "price",
    "discountPrice", "discount", "costPrice", "stockQuantity", "lowStockThreshold", "status",
  ];
  const result = Object.fromEntries(editableFields
    .filter((key) => rest[key] !== undefined)
    .map((key) => [key, rest[key]]));
  if (categoryId !== undefined) result.category = categoryId;
  if (Object.keys(media).length) result.media = media;
  if (Object.keys(attributes).length) result.attributes = attributes;
  return result;
};

export const productsApi = {
  getAll: (params) =>
    client.get("/products", { params }).then((r) => r.data),
  getById: (id) => {
    if (!id || id === "undefined") return Promise.reject(new Error("Product ID is missing."));
    return client.get(`/products/${id}`).then((r) => r.data.product);
  },
  getBySlug: (slug) =>
    client.get(`/products/slug/${slug}`).then((r) => r.data.product),
  getVendorProducts: () =>
    client.get("/products/vendor/me").then((r) => ({
      ...r.data,
      // Vendor CRUD responses expose Mongo's `_id`; the dashboard uses `id`.
      products: (r.data.products || []).map((product) => ({
        ...product,
        id: product.id || product._id,
      })),
    })),
  getRecommendations: (limit) =>
    client.get("/products/recommendations", { params: { limit } }).then((r) => r.data),
  create: (payload) =>
    client.post("/products", toProductPayload(payload)).then((r) => r.data),
  update: (id, payload) => {
    if (!id || id === "undefined") return Promise.reject(new Error("Product ID is missing."));
    return client.put(`/products/${id}`, toProductPayload(payload)).then((r) => r.data);
  },
  delete: (id) => {
    const productId = id || "";
    if (!productId) return Promise.reject(new Error("Product ID is missing."));
    return client.delete(`/products/${productId}`).then((r) => r.data);
  },
};
