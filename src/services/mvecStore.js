const read = (key, fallback = []) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

export const store = { read, write };

export function getOrders() { return read("mvec_orders", []); }
export function saveOrders(orders) { write("mvec_orders", orders); }

export function addNotification(notification) {
  const list = read("mvec_notifications", []);
  const item = {
    id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    createdAt: new Date().toISOString(),
    read: false,
    ...notification,
  };
  write("mvec_notifications", [item, ...list]);
  return item;
}
export function getNotifications(role, recipient) {
  const list = read("mvec_notifications", []);
  return list.filter(n => !role || n.role === role || n.role === "all" || (recipient && n.recipient === recipient));
}
export function markNotificationRead(id) {
  const list = read("mvec_notifications", []).map(n => String(n.id) === String(id) ? {...n, read:true} : n);
  write("mvec_notifications", list);
}

export function createOrder(order) {
  const orders = getOrders();
  const id = `MVEC-${Date.now().toString().slice(-7)}`;
  const created = {
    id,
    date: new Date().toISOString().slice(0,10),
    payment: "PENDING",
    status: "Created",
    settlementMode: "protected",
    settlementStatus: "PENDING",
    heldAmount: 0,
    disputeStatus: "none",
    commissionStatus: "Pending",
    deliveryStatus: "Order placed",
    trackingNumber: `MVEC-TRK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    ...order,
  };
  saveOrders([created, ...orders]);
  return created;
}

export function updateOrder(id, patch) {
  const next = getOrders().map(o => String(o.id) === String(id) ? {...o, ...patch} : o);
  saveOrders(next);
  return next.find(o => String(o.id) === String(id));
}

export function confirmPayment(id, method) {
  const order = updateOrder(id, {
    payment: "SUCCESS",
    paymentMethod: method,
    status: "Payment Confirmed",
    settlementMode: "protected",
    settlementStatus: "HELD",
    heldAmount: Number(getOrders().find(o => String(o.id) === String(id))?.total || 0),
    deliveryStatus: "Awaiting seller fulfillment",
  });
  if (order) {
    addNotification({
      role: "vendor",
      recipient: order.vendor,
      type: "payment",
      title: "Order paid successfully",
      message: `${order.id} was successfully paid. Funds are protected by MVEC pending delivery confirmation.`,
      reference: order.id,
    });
    if (order.supplier) {
      addNotification({
        role: "supplier",
        recipient: order.supplier,
        type: "payment",
        title: "Supplier order paid successfully",
        message: `${order.id} was successfully paid. Funds are protected by MVEC pending supply delivery confirmation.`,
        reference: order.id,
      });
    }
  }
  return order;
}

export function releaseSettlement(id, actor = "delivery") {
  const order = updateOrder(id, {
    settlementStatus: "RELEASED",
    releasedAt: new Date().toISOString(),
    status: "Completed",
    deliveryStatus: "Delivered",
    commissionStatus: "Payable",
  });
  if (order) {
    addNotification({ role:"vendor", recipient:order.vendor, type:"settlement", title:"MVEC released protected funds", message:`Funds for ${order.id} were released after delivery confirmation.`, reference:order.id });
    if (order.supplier) addNotification({ role:"supplier", recipient:order.supplier, type:"settlement", title:"MVEC released protected funds", message:`Funds for ${order.id} were released after supply receipt confirmation.`, reference:order.id });
    addNotification({ role:"admin", type:"settlement", title:"Protected settlement released", message:`${order.id} was released after ${actor} confirmation.`, reference:order.id });
  }
  return order;
}

export function getCommissionRate() {
  const n = Number(localStorage.getItem("mvec_commission_rate"));
  return Number.isFinite(n) && n >= 0 ? n : 5;
}
export function calculateCommission(amount, rate = getCommissionRate()) { return Math.round(Number(amount || 0) * Number(rate || 0) / 100); }
export function getCatalogProducts(baseProducts = []) {
  const extra = read("mvec_vendor_products", []);
  const active = extra.filter(p => p.status !== "Archived");
  const ids = new Set(baseProducts.map(p => String(p.id)));
  return [...baseProducts, ...active.filter(p => !ids.has(String(p.id)))];
}

const WALLET_KEY = "mvec_affiliate_wallet";
export function getAffiliateWallet() {
  const fallback = { available: 420000, pending: 180000, totalEarned: 600000, withdrawn: 0, withdrawals: [] };
  return read(WALLET_KEY, fallback);
}
export function saveAffiliateWallet(wallet) { write(WALLET_KEY, wallet); return wallet; }
export function requestAffiliateWithdrawal(amount, method = "MTN MoMo", account = "+250 788 100 005") {
  const wallet = getAffiliateWallet();
  const value = Math.round(Number(amount) || 0);
  if (value < 10000) throw new Error("The minimum withdrawal amount is RWF 10,000.");
  if (value > wallet.available) throw new Error("Withdrawal amount is higher than your available balance.");
  const request = { id:`AFF-PAY-${Date.now()}`, amount:value, method, account, status:"Pending review", requestedAt:new Date().toISOString() };
  const next = {...wallet, available:wallet.available-value, withdrawals:[request,...(wallet.withdrawals||[])]};
  saveAffiliateWallet(next);
  addNotification({ role:"affiliate", recipient:"affiliate@mvec.rw", type:"payout", title:"Withdrawal request submitted", message:`Your RWF ${value.toLocaleString()} payout request is pending MVEC review.`, reference:request.id });
  return request;
}
