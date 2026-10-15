import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Storefront from "../components/Storefront";
import { ordersApi } from "../API/orders";
import { disputesApi } from "../API/disputes";
import { reviewsApi } from "../API/reviews";
import { extractErrorMessage } from "../API/client";

const money = (n) => new Intl.NumberFormat("en-RW").format(Number(n) || 0) + " RWF";
const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const CANCEL_WINDOW_MS = 30 * 60 * 1000;
const DELIVERY_WINDOW_MS = 3 * 60 * 60 * 1000;
const STATUS_STEPS = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];
const REASONS = [
  ["Product not received", "ITEM_NOT_RECEIVED"],
  ["Wrong product", "WRONG_ITEM"],
  ["Damaged product", "DAMAGED_GOODS"],
  ["Missing item", "INCOMPLETE_ORDER"],
  ["Other", "OTHER"],
];

export default function OrderDetails() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [reported, setReported] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);

  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    ordersApi.getById(id)
      .then((res) => setOrder(res.order))
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <Storefront><main className="account-page"><div className="empty-state"><h3>Loading order…</h3></div></main></Storefront>;
  if (error || !order) return <Storefront><main className="account-page"><div className="form-alert error">{error || "Order not found."}</div></main></Storefront>;

  const item = order.items?.[0];
  const vendor = item?.vendor;
  const idx = Math.max(0, STATUS_STEPS.indexOf(order.orderStatus));
  const remaining = order.paymentStatus === "PAID" ? DELIVERY_WINDOW_MS - (Date.now() - new Date(order.createdAt).getTime()) : 0;
  const canCancel =
    ["PENDING", "CONFIRMED", "PROCESSING"].includes(order.orderStatus) &&
    (order.paymentStatus !== "PAID" || Date.now() - new Date(order.createdAt).getTime() <= CANCEL_WINDOW_MS);

  const cancel = async () => {
    setMessage("");
    try {
      const res = await ordersApi.cancel(order.id);
      setOrder(res.order);
      setMessage(res.message);
    } catch (err) {
      setMessage(extractErrorMessage(err));
    }
  };

  const report = async () => {
    if (!reason || !description.trim()) return;
    setReportBusy(true);
    try {
      await disputesApi.open({
        orderId: order.id,
        reason,
        description: description.trim(),
        disputedAmount: order.totalAmount,
      });
      setReported(true);
    } catch (err) {
      setMessage(extractErrorMessage(err));
    } finally {
      setReportBusy(false);
    }
  };

  const submitReview = async () => {
    if (!reviewText.trim() || !item?.productId) return;
    try {
      await reviewsApi.create({
        productId: item.productId,
        parentOrderId: order.id,
        rating,
        reviewText: reviewText.trim(),
      });
      setReviewSubmitted(true);
    } catch (err) {
      setMessage(extractErrorMessage(err));
    }
  };

  return <Storefront><main className="account-page">
    <div className="page-title"><span className="eyebrow">ORDER DETAILS</span><h1>{order.orderNumber}</h1><p>{item?.name || "Order"} · {new Date(order.createdAt).toLocaleDateString("en-GB")}</p></div>
    {message && <div className="form-alert success">{message}</div>}

    <div className="detail-grid">
      <section className="data-card">
        <div className="data-card-head"><div><h3>Order information</h3><span>{new Date(order.createdAt).toLocaleDateString("en-GB")}</span></div><em className="status active">{order.orderStatus}</em></div>
        {order.items?.map((it) => (
          <div className="order-product" key={it.id}>
            <div><b>{it.name}</b><small>Qty {it.quantity}</small><strong>{money(it.price * it.quantity)}</strong></div>
          </div>
        ))}
        <div className="order-summary-lines">
          {order.subtotal != null && <span>Products <b>{money(order.subtotal)}</b></span>}
          {order.subtotal != null && <span>Delivery{order.shippingMethod ? ` · ${order.shippingMethod.charAt(0) + order.shippingMethod.slice(1).toLowerCase()}` : ''}{order.shippingBreakdown?.length > 1 ? ` (${order.shippingBreakdown.length} parcels)` : ''} <b>{order.shippingFee ? money(order.shippingFee) : 'Free'}</b></span>}
          {order.discountAmount > 0 && <span>Coupon {order.coupon?.code} <b>−{money(order.discountAmount)}</b></span>}
          {order.shippingBreakdown?.map((p, i) => p.eta && <span className="tiny" key={i}>{p.storeName}: {p.eta}</span>)}
          <span className="grand">Grand total <b>{money(order.totalAmount)}</b></span>
        </div>
      </section>

      <section className="data-card">
        <h3>Seller & payment</h3>
        <div className="profile-detail">
          <b>{vendor?.companyName || vendor?.fullName || "MVEC Seller"}</b>
          <span>MVEC Verified seller ✓</span>
          <span>Payment: {order.paymentStatus}</span>
          <span>Method: {order.paymentMethod}</span>
        </div>
      </section>
    </div>

    {order.paymentStatus === "PAID" && !["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.orderStatus) && (
      <section className="data-card countdown-card">
        <div className="data-card-head"><div><h3>Delivery countdown</h3><span>Three hours from successful payment</span></div><strong className={remaining < 15 * 60 * 1000 ? "danger-text" : ""}>{fmt(Math.max(0, remaining))}</strong></div>
        <p>{remaining > 0 ? "Your order must be delivered and confirmed before this timer expires." : "The delivery window has expired."}</p>
        {canCancel && <button className="outline-btn" onClick={cancel}>Cancel order · full refund</button>}
      </section>
    )}

    {order.paymentStatus === "PAID" && order.deliveryOtp && !["DELIVERED", "CANCELLED"].includes(order.orderStatus) && (
      <section className="verified-box otp-buyer-box">
        <b>🔐 Your delivery OTP</b>
        <p>Give this code only to the delivery person when your order arrives.</p>
        <strong className="delivery-otp">{order.deliveryOtp}</strong>
      </section>
    )}

    {order.orderStatus === "REFUNDED" && (
      <section className="verified-box refund-box"><b>Full refund recorded</b><p>This order was cancelled and a full refund was recorded.</p></section>
    )}

    <section className="data-card">
      <div className="data-card-head"><div><h3>Delivery timeline</h3><span>Delivery status updates automatically.</span></div></div>
      <div className="timeline">
        {STATUS_STEPS.map((s, i) => (
          <div className={i <= idx ? "timeline-item done" : "timeline-item"} key={s}>
            <i /><div><b>{s.charAt(0) + s.slice(1).toLowerCase()}</b><small>{i === idx ? "Current order status" : "MVEC workflow step"}</small></div>
          </div>
        ))}
      </div>
    </section>

    {order.orderStatus === "DELIVERED" && (
      <section className="data-card">
        <h3>Leave a review</h3>
        {reviewSubmitted ? (
          <div className="form-alert success">Thanks for your review!</div>
        ) : (
          <>
            <div className="stars" style={{ cursor: "pointer" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} onClick={() => setRating(n)} style={{ opacity: n <= rating ? 1 : 0.3 }}>★</span>
              ))}
            </div>
            <textarea className="field" value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Tell other buyers about your experience…" />
            <button className="gradient-btn" onClick={submitReview}>Submit review</button>
          </>
        )}
      </section>
    )}

    <section className="data-card">
      <h3>Report a problem</h3>
      {reported ? (
        <div className="form-alert success">Your problem was reported. MVEC support will review the order and evidence.</div>
      ) : (
        <>
          <select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a problem</option>
            {REASONS.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <textarea className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what went wrong…" />
          <button className="outline-btn" onClick={report} disabled={!reason || !description.trim() || reportBusy}>{reportBusy ? "Submitting…" : "Report a problem"}</button>
        </>
      )}
    </section>

    <Link className="outline-btn" to="/orders">← Back to orders</Link>
  </main></Storefront>;
}
