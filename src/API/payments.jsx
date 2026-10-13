import { client } from "./client";

export const paymentsApi = {
  // MTN MoMo or Airtel Money: the provider is detected from the number.
  payMobileMoney: ({ orderId, phoneNumber }) =>
    client.post("/payments/pay", { orderId, phoneNumber }).then((r) => r.data),
  // Card (Visa/Mastercard) on Flutterwave's secure page: returns { checkoutUrl, paymentId, status }.
  payCard: ({ orderId }) =>
    client.post("/payments/pay/card", { orderId }).then((r) => r.data),
  // Asks the backend to reconcile with the gateway and returns the latest state.
  getStatus: (paymentId) =>
    client.get(`/payments/status/${paymentId}`).then((r) => r.data),
};
