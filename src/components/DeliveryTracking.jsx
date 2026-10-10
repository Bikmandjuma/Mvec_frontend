import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import Pagination from "./Pagination";
import { ordersApi } from "../API/orders";
import { extractErrorMessage } from "../API/client";

const money = (n) => new Intl.NumberFormat("en-RW").format(Number(n) || 0) + " RWF";
const STEPS = ["PENDING", "CONFIRMED", "PROCESSING", "READY_FOR_SHIPMENT", "SHIPPED", "DELIVERED"];

export default function DeliveryTracking({ role = "vendor" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [otpInputs, setOtpInputs] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState({});
  const perPage = 5;

  const load = () => {
    ordersApi.getDeliverable()
      .then((res) => setOrders(res.orders || []))
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => orders.filter((o) => JSON.stringify(o).toLowerCase().includes(q.toLowerCase())),
    [orders, q],
  );
  const shown = filtered.slice((page - 1) * perPage, page * perPage);

  const verify = async (orderId) => {
    if (!orderId || orderId === "undefined") {
      setFeedback((f) => ({ ...f, [orderId || "unknown"]: "error:This delivery has no valid order ID." }));
      return;
    }
    const otp = (otpInputs[orderId] || "").trim();
    if (otp.length !== 6) return;
    setBusyId(orderId);
    setFeedback((f) => ({ ...f, [orderId]: "" }));
    try {
      await ordersApi.confirmDelivery(orderId, otp);
      setFeedback((f) => ({ ...f, [orderId]: "success:Delivery confirmed. Funds released." }));
      setOrders((prev) => prev.filter((o) => String(o.id || o._id) !== String(orderId)));
    } catch (err) {
      setFeedback((f) => ({ ...f, [orderId]: `error:${extractErrorMessage(err)}` }));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="empty-state"><h3>Loading deliveries…</h3></div>;

  return <>
    <div className="dash-page-head">
      <div><span className="eyebrow">DELIVERY & SETTLEMENT</span><h1>{role === "admin" ? "All deliveries" : "Delivery tracking"}</h1><p>Track delivery progress, the protected amount and the final delivery confirmation.</p></div>
    </div>
    <div className="verified-box settlement-banner"><b>🔒 Protected funds</b><p>Paid orders are recorded as <strong>HELD by MVEC</strong> until the buyer's delivery OTP is verified. After successful verification, the protected amount is released to the seller.</p></div>
    {error && <div className="form-error">{error}</div>}
    <div className="dash-toolbar"><div className="dash-filter"><Icon name="search" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search order, buyer or vendor…" /></div></div>
    <div className="data-card">
      <div className="data-card-head"><div><h3>Delivery operations</h3><span>{filtered.length} paid orders awaiting delivery</span></div></div>

      {shown.length === 0 && <div className="empty-state"><h3>No deliveries pending</h3><p>Paid orders awaiting delivery confirmation will appear here.</p></div>}

      {shown.map((o) => {
        const orderId = o.id || o._id;
        const idx = Math.max(0, STEPS.indexOf(o.orderStatus));
        const vendorName = o.items?.[0]?.vendor?.companyName || o.items?.[0]?.vendor?.fullName || "Marketplace seller";
        const msg = feedback[orderId] || "";
        const [msgType, msgText] = msg.includes(":") ? msg.split(/:(.*)/s) : ["", msg];
        return (
          <div className="delivery-track-card" key={orderId}>
            <div className="delivery-track-head">
              <div><b>{o.orderNumber}</b><small>{o.items?.[0]?.name || "Order"}</small><small>{o.user?.fullName || "Buyer"} · {vendorName}</small></div>
              <div className="settlement-chip"><span className="held">Funds held by MVEC</span><strong>{money(o.totalAmount)}</strong></div>
            </div>
            <div className="delivery-steps">
              {STEPS.map((s, i) => <div className={i <= idx ? "step done" : "step"} key={s}><i>{i < idx ? "✓" : i === idx ? "●" : ""}</i><small>{s}</small></div>)}
            </div>
            <div className="delivery-track-actions">
              <span>Buyer phone: <b>{o.user?.phone || "N/A"}</b></span>
              <span>Status: <b>{o.orderStatus}</b></span>
            </div>
            <div className="delivery-otp-verify">
              <input
                inputMode="numeric"
                maxLength="6"
                value={otpInputs[orderId] || ""}
                onChange={(e) => setOtpInputs((s) => ({ ...s, [orderId]: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                placeholder="Enter buyer's 6-digit OTP"
                className="inline-table-input"
              />
              <button className="gradient-btn compact-btn" onClick={() => verify(orderId)} disabled={(otpInputs[orderId] || "").length !== 6 || busyId === orderId}>
                {busyId === orderId ? "Verifying…" : "Confirm delivery"}
              </button>
            </div>
            {msgText && <small className={msgType === "success" ? "success-text" : "form-alert error"}>{msgText}</small>}
            <p className="tiny delivery-note">Ask the buyer for the OTP shown on their order details page. The correct code confirms delivery and releases the held funds to the seller.</p>
          </div>
        );
      })}

      <Pagination page={Math.min(page, Math.max(1, Math.ceil(filtered.length / perPage)))} setPage={setPage} total={filtered.length} perPage={perPage} />
    </div>
  </>;
}
