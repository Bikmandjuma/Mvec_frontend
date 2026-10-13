import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import Pagination from "./Pagination";
import { ordersApi } from "../API/orders";
import { client, extractErrorMessage } from "../API/client";
import { useAuth } from "../context/AuthContext";
import { money } from "../utils/format";

// Fulfilment steps shown to sellers, couriers and admins. The last step is
// reached only with the buyer's 6-digit delivery code.
const STEPS = [
  ["CONFIRMED", "Paid"],
  ["PROCESSING", "Preparing"],
  ["READY_FOR_SHIPMENT", "Packed"],
  ["SHIPPED", "Shipped"],
  ["OUT_FOR_DELIVERY", "Out for delivery"],
  ["DELIVERED", "Delivered"],
];
const NEXT_ACTION = {
  PENDING: ["PROCESSING", "Start preparing"],
  CONFIRMED: ["PROCESSING", "Start preparing"],
  PROCESSING: ["READY_FOR_SHIPMENT", "Mark packed"],
  READY_FOR_SHIPMENT: ["SHIPPED", "Mark shipped"],
  SHIPPED: ["OUT_FOR_DELIVERY", "Out for delivery"],
};

const idOf = (o) => String(o?.id || o?._id || "");

export default function DeliveryTracking({ role = "vendor" }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [codes, setCodes] = useState({});
  const [busyId, setBusyId] = useState("");
  const [feedback, setFeedback] = useState({});
  const perPage = 5;

  const load = () =>
    ordersApi.getDeliverable()
      .then((res) => setOrders(res.orders || []))
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    if (role === "admin") {
      client.get("/users", { params: { role: "delivery", limit: 100 } })
        .then((r) => setCouriers(r.data.data || []))
        .catch(() => setCouriers([]));
    }
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((o) => [o.orderNumber, o.recipient?.name, o.recipient?.phone, o.shippingAddress?.city, ...(o.items || []).map((i) => i.name)]
      .join(" ").toLowerCase().includes(needle));
  }, [orders, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const shown = filtered.slice((Math.min(page, pages) - 1) * perPage, Math.min(page, pages) * perPage);

  const say = (orderId, ok, text) => setFeedback((f) => ({ ...f, [orderId]: { ok, text } }));
  const replace = (order) => setOrders((prev) => prev.map((o) => (idOf(o) === idOf(order) ? { ...o, ...order } : o)));

  const advance = async (order, status) => {
    const orderId = idOf(order);
    setBusyId(orderId);
    try {
      const res = role === "delivery"
        ? await client.patch(`/orders/${orderId}/out-for-delivery`).then((r) => r.data)
        : await ordersApi.updateVendorOrderStatus({ orderId, status });
      replace(res.order);
      say(orderId, true, "Updated. The buyer has been notified.");
    } catch (err) {
      say(orderId, false, extractErrorMessage(err));
    } finally {
      setBusyId("");
    }
  };

  const assign = async (order, courierId) => {
    const orderId = idOf(order);
    setBusyId(orderId);
    try {
      const res = await client.patch(`/orders/${orderId}/courier`, { courierId: courierId || null });
      replace({ ...res.data.order, courier: couriers.find((c) => String(c.id) === courierId) || null });
      say(orderId, true, res.data.message);
    } catch (err) {
      say(orderId, false, extractErrorMessage(err));
    } finally {
      setBusyId("");
    }
  };

  const confirm = async (order) => {
    const orderId = idOf(order);
    const code = (codes[orderId] || "").trim();
    if (code.length !== 6) return;
    setBusyId(orderId);
    try {
      const res = await ordersApi.confirmDelivery(orderId, code);
      say(orderId, true, res.message);
      if (res.order?.orderStatus === "DELIVERED") {
        setTimeout(() => setOrders((prev) => prev.filter((o) => idOf(o) !== orderId)), 1500);
      } else if (res.order) {
        replace(res.order);
      }
    } catch (err) {
      say(orderId, false, extractErrorMessage(err));
    } finally {
      setBusyId("");
      setCodes((c) => ({ ...c, [orderId]: "" }));
    }
  };

  if (loading) return <div className="empty-state"><h3>Loading deliveries…</h3></div>;

  const title = role === "admin" ? "All deliveries" : role === "delivery" ? "My deliveries" : "Deliveries";

  return <>
    <div className="dash-page-head">
      <div><span className="eyebrow">DELIVERY &amp; SETTLEMENT</span><h1>{title}</h1>
        <p>{role === "delivery"
          ? "Deliveries assigned to you. Ask the buyer for their 6-digit code when you hand over the items."
          : "Move paid orders to the buyer, then confirm with the buyer's 6-digit code to release the payment."}</p>
      </div>
    </div>
    <div className="verified-box settlement-banner"><b>🔒 Protected funds</b><p>MVEC holds the payment until the buyer's delivery code is entered here. Never accept the code before the buyer has the items.</p></div>
    {error && <div className="form-alert error">{error}</div>}
    <div className="dash-toolbar"><div className="dash-filter"><Icon name="search" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search order, buyer, area or product…" aria-label="Search deliveries" /></div></div>
    <div className="data-card">
      <div className="data-card-head"><div><h3>Waiting for delivery</h3><span>{filtered.length} paid order{filtered.length === 1 ? "" : "s"}</span></div><button type="button" className="outline-btn" onClick={() => { setLoading(true); load(); }}>Refresh</button></div>

      {shown.length === 0 && <div className="empty-state"><h3>No deliveries waiting</h3><p>Paid orders appear here until they are delivered.</p></div>}

      {shown.map((o) => {
        const orderId = idOf(o);
        const idx = Math.max(0, STEPS.findIndex(([s]) => s === (o.orderStatus === "PENDING" ? "CONFIRMED" : o.orderStatus)));
        const vendors = [...new Set((o.items || []).map((i) => i.vendor?.companyName || i.vendor?.Fullname).filter(Boolean))];
        const myItems = role === "vendor" ? (o.items || []).filter((i) => String(i.vendor?._id || i.vendor) === String(user?.id)) : o.items || [];
        const handedOver = (o.deliveredVendors || []).map(String).includes(String(user?.id));
        const next = NEXT_ACTION[o.orderStatus];
        const note = feedback[orderId];
        const addr = o.shippingAddress || {};
        return (
          <div className="delivery-track-card" key={orderId}>
            <div className="delivery-track-head">
              <div>
                <b>{o.orderNumber}</b>
                <small>{myItems.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</small>
                <small>{vendors.join(", ") || "Marketplace seller"}</small>
              </div>
              <div className="settlement-chip"><span className="held">Held by MVEC</span><strong>{money(o.totalAmount)}</strong></div>
            </div>
            <div className="delivery-steps">
              {STEPS.map(([s, label], i) => <div className={i <= idx ? "step done" : "step"} key={s}><i>{i < idx ? "✓" : i === idx ? "●" : ""}</i><small>{label}</small></div>)}
            </div>
            <div className="delivery-track-actions">
              <span>Deliver to: <b>{o.recipient?.name || o.user?.Fullname || "Buyer"}</b> · <b>{o.recipient?.phone || o.user?.phone || "no phone"}</b></span>
              <span>{[addr.street, addr.sector, addr.city, addr.province].filter(Boolean).join(", ")}</span>
              {o.courier && role !== "delivery" && <span>Courier: <b>{o.courier.Fullname || o.courier.fullName || "Assigned"}</b></span>}
            </div>

            <div className="delivery-otp-verify">
              {next && role !== "delivery" && !handedOver && (
                <button type="button" className="outline-btn compact-btn" disabled={busyId === orderId} onClick={() => advance(o, next[0])}>{next[1]}</button>
              )}
              {role === "delivery" && o.orderStatus !== "OUT_FOR_DELIVERY" && (
                <button type="button" className="outline-btn compact-btn" disabled={busyId === orderId} onClick={() => advance(o, "OUT_FOR_DELIVERY")}>Picked up · out for delivery</button>
              )}
              {role === "admin" && (
                <select className="inline-table-input" aria-label="Courier" value={String(o.courier?._id || o.courier?.id || o.courier || "")} onChange={(e) => assign(o, e.target.value)} disabled={busyId === orderId}>
                  <option value="">{couriers.length ? "Assign a courier…" : "No courier accounts yet"}</option>
                  {couriers.map((c) => <option key={c.id} value={String(c.id)}>{c.Fullname || c.fullName || c.phone}</option>)}
                </select>
              )}
            </div>

            {!handedOver ? (
              <div className="delivery-otp-verify">
                <input
                  inputMode="numeric"
                  maxLength="6"
                  value={codes[orderId] || ""}
                  onChange={(e) => setCodes((s) => ({ ...s, [orderId]: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                  placeholder="Buyer's 6-digit code"
                  aria-label={`Delivery code for ${o.orderNumber}`}
                  className="inline-table-input"
                />
                <button type="button" className="gradient-btn compact-btn" onClick={() => confirm(o)} disabled={(codes[orderId] || "").length !== 6 || busyId === orderId}>
                  {busyId === orderId ? "Checking…" : "Confirm delivery"}
                </button>
              </div>
            ) : (
              <p className="tiny success-text">Your items are delivered and your payment is released. Waiting for the other sellers in this order.</p>
            )}
            {note && <small className={note.ok ? "success-text" : "form-alert error"} role="status">{note.text}</small>}
          </div>
        );
      })}

      {filtered.length > perPage && <Pagination page={Math.min(page, pages)} setPage={setPage} total={filtered.length} perPage={perPage} />}
    </div>
  </>;
}
