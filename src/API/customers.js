import { client } from "./client";

// Seller customers: buyers with accounts and guest customers from manual orders.
export const customersApi = {
  getAll: () =>
    client.get("/users/vendor/customers").then((r) => r.data),
  // key: user id, or "guest:<phone digits>"
  getOne: (key) =>
    client.get(`/users/vendor/customers/${encodeURIComponent(key)}`).then((r) => r.data),
};
