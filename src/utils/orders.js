// Buyer-side order rules. They mirror the backend (order.controller.js) so the
// buttons shown match what the server will accept; the server still decides.
export const CANCEL_WINDOW_MS = 30 * 60 * 1000;
const CANCELLABLE = ['PENDING', 'CONFIRMED', 'PROCESSING'];

export const isAwaitingPayment = (o) => o?.paymentStatus === 'PENDING' && o?.orderStatus === 'PENDING';

export const paidCancelRemaining = (o, now = Date.now()) => {
  if (o?.paymentStatus !== 'PAID' || !CANCELLABLE.includes(o?.orderStatus)) return 0;
  const paidAt = new Date(o.paidAt || o.updatedAt || o.createdAt).getTime();
  return Number.isFinite(paidAt) ? Math.max(0, CANCEL_WINDOW_MS - (now - paidAt)) : 0;
};

export const canCancel = (o, now = Date.now()) => isAwaitingPayment(o) || paidCancelRemaining(o, now) > 0;

export const countdown = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Plain-language status for buyers.
export const buyerStatus = (o) => {
  if (o?.orderStatus === 'CANCELLED') return o.paymentStatus === 'REFUNDED' ? 'Cancelled · refunded' : 'Cancelled';
  if (o?.orderStatus === 'REFUNDED') return 'Refunded';
  if (o?.paymentStatus === 'DISPUTED') return 'Problem reported · under review';
  if (isAwaitingPayment(o)) return 'Awaiting payment';
  const labels = {
    PENDING: 'Order placed', CONFIRMED: 'Confirmed', PROCESSING: 'Being prepared', READY_FOR_SHIPMENT: 'Ready to ship',
    SHIPPED: 'Shipped', OUT_FOR_DELIVERY: 'Out for delivery', DELIVERED: 'Delivered', COMPLETED: 'Completed',
    RETURNED: 'Returned', REFUNDED: 'Refunded', FAILED: 'Failed',
  };
  return labels[o?.orderStatus] || o?.orderStatus || '';
};
