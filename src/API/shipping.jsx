import { client } from "./client";

export const shippingApi = { getMine: () => client.get("/shipping/zones/mine").then((r) => r.data) };
