import { client } from "./client";

export const promotionsApi = { getMine: () => client.get("/promotions").then((r) => r.data) };
