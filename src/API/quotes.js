import { client } from "./client";

// Quote requests: vendors ask for goods, suppliers send quotes.
export const quotesApi = {
  createRequest: (payload) => client.post("/quotes/requests", payload).then((r) => r.data),
  myRequests: () => client.get("/quotes/requests/mine").then((r) => r.data),
  cancelRequest: (id) => client.post(`/quotes/requests/${id}/cancel`).then((r) => r.data),
  accept: (quoteId) => client.post(`/quotes/${quoteId}/accept`).then((r) => r.data),
  open: () => client.get("/quotes/open").then((r) => r.data),
  myQuotes: () => client.get("/quotes/mine").then((r) => r.data),
  submit: (requestId, payload) => client.post(`/quotes/requests/${requestId}/quotes`, payload).then((r) => r.data),
  withdraw: (quoteId) => client.post(`/quotes/${quoteId}/withdraw`).then((r) => r.data),
  adminList: (params) => client.get("/quotes/admin/requests", { params }).then((r) => r.data),
};
