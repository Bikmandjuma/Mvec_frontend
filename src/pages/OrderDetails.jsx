import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Storefront from "../components/Storefront";
import ProductImage from "../components/ProductImage";
import { ordersApi } from "../API/orders";
import { disputesApi } from "../API/disputes";
import { reviewsApi } from "../API/reviews";
import { extractErrorMessage } from "../API/client";
import { money, formatDate } from "../utils/format";
import { buyerStatus, canCancel, countdown, isAwaitingPayment, paidCancelRemaining } from "../utils/orders";

// Who moves the order at each step, so the buyer knows what to expect.
const STEPS = [
  { label: "Order placed", by: "You", statuses: ["PENDING"], text: "The items are reserved for you for 30 minutes while you pay." },
  { label: "Payment confirmed", by: "Payment provider · automatic", statuses: ["CONFIRMED"], text: "Mobile money, card or K-Pay confirms your payment. MVEC holds the money; the seller is not paid yet." },
  { label: "Preparing & packing", by: "Seller", statuses: ["PROCESSING", "READY_FOR_SHIPMENT"], text: "The seller prepares your items and marks them packed." },
  { label: "On the way", by: "Seller, then courier", statuses: ["SHIPPED", "OUT_FOR_DELIVERY"], text: "The seller hands the parcel over; the courier marks it out for delivery." },
  { label: "Delivered", by: "You, with your code", statuses: ["DELIVERED", "COMPLETED"], text: "When the items are in your hands, give the courier or seller your 6-digit code. That confirms delivery and releases the payment to the seller." },
];
const METHOD_LABEL = { MOMO: "MTN MoMo", AIRTEL: "Airtel Money", CARD: "card", SPENN: "SPENN", CASH_ON_DELIVERY: "cash on delivery" };
const paidWith = (order) => {
  const via = order.paidVia;
  const method = via?.method || order.paymentMethod;
  const label = METHOD_LABEL[method] || method;
  if (via?.gateway === "KPAY") return `K-Pay (${label})`;
  return method === "CARD" ? "Card" : label;
};
// K-Pay has no refund API: card and SPENN refunds are sent by MVEC's team.
const manualRefund = (order) => order.paidVia?.gateway === "KPAY" && ["CARD", "SPENN"].includes(order.paidVia?.method);
const SUBSTATUS = { READY_FOR_SHIPMENT: "Packed, waiting for pickup", OUT_FOR_DELIVERY: "Out for delivery today", PROCESSING: "Being prepared", SHIPPED: "Handed to the courier" };
const REASONS = [
  ["Product not received", "ITEM_NOT_RECEIVED"],
  ["Wrong product", "WRONG_ITEM"],
  ["Damaged product", "DAMAGED_GOODS"],
  ["Missing item", "INCOMPLETE_ORDER"],
  ["Other", "OTHER"],
];

const stepIndex = (order) => {
  if (order.paymentStatus === "PENDING" && order.paymentMethod !== "CASH_ON_DELIVERY") return 0;
  const i = STEPS.findIndex((s) => s.statuses.includes(order.orderStatus));
  return i < 1 ? 1 : i;
};

export default function OrderDetails() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null); // { ok, text }
  const [now, setNow] = useState(Date.now());
  const [cancelling, setCancelling] = useState(false);

  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const [reviewProduct, setReviewProduct] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewedIds, setReviewedIds] = useState([]);
  const [reviewBusy, setReviewBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    ordersApi.getById(id)
      .then((res) => alive && setOrder(res.order))
      .catch((err) => alive && setLoadError(extractErrorMessage(err)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  const remaining = order ? paidCancelRemaining(order, now) : 0;
  useEffect(() => {
    if (remaining <= 0) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Storefront><main className="account-page"><div className="empty-state"><h3>Loading order…</h3></div></main></Storefront>;
  if (loadError || !order) return <Storefront><main className="account-page"><div className="form-alert error">{loadError || "Order not found."}</div><Link className="outline-btn" to="/orders">← Back to orders</Link></main></Storefront>;

  const items = order.items || [];
  const productIdOf = (it) => String(it.product?._id || it.product || "");
  const cancelled = ["CANCELLED", "REFUNDED"].includes(order.orderStatus);
  const delivered = ["DELIVERED", "COMPLETED"].includes(order.orderStatus);
  const awaitingPayment = isAwaitingPayment(order);
  const idx = stepIndex(order);
  const addr = order.shippingAddress || {};
  const vendors = [...new Set(items.map((it) => it.vendor?.companyName || it.vendor?.Fullname).filter(Boolean))];
  const reviewable = items.filter((it) => productIdOf(it) && !reviewedIds.includes(productIdOf(it)));

  const cancel = async () => {
    const paid = order.paymentStatus === "PAID";
    const backTo = manualRefund(order) ? "you through K-Pay by MVEC's team" : order.paymentMethod === "CARD" ? "the card you paid with" : "your mobile money";
    if (!window.confirm(paid ? `Cancel this order? Your payment is sent back to ${backTo}.` : "Cancel this order?")) return;
    setNotice(null);
    setCancelling(true);
    try {
      const res = await ordersApi.cancel(order.id);
      setOrder((prev) => ({ ...prev, ...res.order, items: prev.items }));
      setNotice({ ok: true, text: res.message });
    } catch (err) {
      setNotice({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setCancelling(false);
    }
  };

  const report = async (e) => {
    e.preventDefault();
    if (!reason || description.trim().length < 10) {
      setNotice({ ok: false, text: "Choose what went wrong and describe it in at least 10 characters." });
      return;
    }
    setReportBusy(true);
    setNotice(null);
    try {
      await disputesApi.open({ orderId: order.id, reason, description: description.trim(), disputedAmount: order.totalAmount });
      setOrder((prev) => ({ ...prev, paymentStatus: "DISPUTED" }));
      setNotice({ ok: true, text: "Your problem was reported. MVEC support will review the order, and the seller's payment is on hold meanwhile." });
    } catch (err) {
      setNotice({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setReportBusy(false);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    const productId = reviewProduct || (reviewable.length === 1 ? productIdOf(reviewable[0]) : "");
    if (!productId) { setNotice({ ok: false, text: "Choose the product you want to review." }); return; }
    if (!reviewText.trim()) { setNotice({ ok: false, text: "Write a few words about the product." }); return; }
    setReviewBusy(true);
    setNotice(null);
    try {
      await reviewsApi.create({ product: productId, rating, reviewText: reviewText.trim() });
      setReviewedIds((x) => [...x, productId]);
      setReviewText("");
      setReviewProduct("");
      setNotice({ ok: true, text: "Thanks for your review!" });
    } catch (err) {
      setNotice({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setReviewBusy(false);
    }
  };

  return <Storefront><main className="account-page">
    <div className="page-title"><span className="eyebrow">ORDER DETAILS</span><h1 className="order-number-title">{order.orderNumber}</h1><p>Placed {formatDate(order.createdAt)} · {buyerStatus(order)}</p></div>
    {notice && <div className={`form-alert ${notice.ok ? "success" : "error"}`} role={notice.ok ? "status" : "alert"}>{notice.text}</div>}

    {awaitingPayment && (
      <section className="verified-box">
        <b>Payment needed</b>
        <p>This order is reserved for you but not paid yet. Unpaid orders are cancelled automatically 30 minutes after they are placed.</p>
        <div className="order-row-actions">
          <Link className="gradient-btn" to={`/payment/${order.id}`}>Pay {money(order.totalAmount)}</Link>
          <button type="button" className="outline-btn" onClick={cancel} disabled={cancelling}>{cancelling ? "Cancelling…" : "Cancel order"}</button>
        </div>
      </section>
    )}

    <div className="detail-grid">
      <section className="data-card">
        <div className="data-card-head"><div><h3>Items</h3><span>{items.length} product{items.length === 1 ? "" : "s"}</span></div><em className="status active">{buyerStatus(order)}</em></div>
        {items.map((it) => (
          <div className="order-product" key={it.id || it._id || productIdOf(it)}>
            {it.image && <ProductImage src={it.image} alt="" />}
            <div>
              {productIdOf(it) ? <Link to={`/product/${productIdOf(it)}`}><b>{it.name}</b></Link> : <b>{it.name}</b>}
              <small>Qty {it.quantity} × {money(it.price)}</small>
              <strong>{money(it.price * it.quantity)}</strong>
            </div>
          </div>
        ))}
        <div className="summary-lines">
          <div><span>Products</span><b>{money(order.subtotal ?? order.totalAmount - (order.shippingFee || 0))}</b></div>
          <div><span>Delivery{order.shippingMethod && order.shippingMethod !== "STANDARD" ? ` (${order.shippingMethod.toLowerCase()})` : ""}{order.shippingBreakdown?.length > 1 ? ` · ${order.shippingBreakdown.length} parcels` : ""}</span><b>{order.shippingFee ? money(order.shippingFee) : "FREE"}</b></div>
          {order.shippingBreakdown?.filter((p) => p.eta).map((p, i) => <div className="tiny" key={i}><span>{p.storeName || "Seller"}</span><span>arrives in {p.eta}</span></div>)}
          <div className="grand"><span>Total</span><strong>{money(order.totalAmount)}</strong></div>
        </div>
      </section>

      <section className="data-card">
        <h3>Delivery</h3>
        <div className="profile-detail">
          {order.recipient?.name && <b>{order.recipient.name}</b>}
          {order.recipient?.phone && <span>{order.recipient.phone}</span>}
          <span>{[addr.street, addr.sector, addr.city].filter(Boolean).join(", ")}</span>
          <span>{[addr.province || addr.state, addr.country].filter(Boolean).join(", ")}</span>
        </div>
        <h3>Seller &amp; payment</h3>
        <div className="profile-detail">
          <b>{vendors.join(", ") || "MVEC Seller"}</b>
          <span>Payment: {order.paymentStatus === "PAID" ? `Paid${order.paidAt ? ` on ${formatDate(order.paidAt)}` : ""}` : buyerStatus(order)}</span>
          {order.paymentMethod && order.paymentStatus !== "PENDING" && <span>Method: {paidWith(order)}</span>}
        </div>
      </section>
    </div>

    {remaining > 0 && canCancel(order, now) && (
      <section className="data-card countdown-card">
        <div className="data-card-head"><div><h3>Changed your mind?</h3><span>You can cancel for a full refund until the timer ends or the seller ships.</span></div><strong className={remaining < 5 * 60 * 1000 ? "danger-text" : ""}>{countdown(remaining)}</strong></div>
        <button type="button" className="outline-btn" onClick={cancel} disabled={cancelling}>{cancelling ? "Cancelling…" : "Cancel order"}</button>
      </section>
    )}

    {order.paymentStatus === "PAID" && order.deliveryOtp && !delivered && !cancelled && (
      <section className="verified-box otp-buyer-box">
        <b>🔐 Your delivery code</b>
        <p>Give this code to the seller or courier only when your order is in your hands. It releases your payment to the seller. We also sent it to you by SMS.</p>
        <strong className="delivery-otp">{order.deliveryOtp}</strong>
      </section>
    )}

    {cancelled && (
      <section className="verified-box refund-box">
        <b>{order.paymentStatus === "REFUNDED" ? "Order cancelled · full refund recorded" : "Order cancelled"}</b>
        <p>{order.paymentStatus === "REFUNDED"
          ? (manualRefund(order)
            ? `Your full refund is being sent back through K-Pay to the ${order.paidVia.method === "SPENN" ? "SPENN account" : "card"} you paid with. MVEC's team does this by hand, and you get a notification when it is sent.`
            : order.paymentMethod === "CARD"
            ? "Your full refund was sent back to the card you paid with. Banks usually show it within 5–10 working days."
            : "Your full refund was sent to the mobile money number you paid with. It usually arrives within minutes; you get an SMS when it does.")
          : order.cancellationReason === "PAYMENT_TIMEOUT_EXPIRED_30_MIN"
            ? "This order was not paid within 30 minutes, so it was cancelled. You were not charged."
            : "This order was cancelled before payment. You were not charged."}</p>
      </section>
    )}

    {!cancelled && (
      <section className="data-card">
        <div className="data-card-head"><div><h3>Progress</h3><span>Who does what at each step. You get a notification every time it moves.</span></div></div>
        <div className="timeline order-progress">
          {STEPS.map((step, i) => (
            <div className={`${i <= idx ? "timeline-item done" : "timeline-item"}${i === idx ? " current" : ""}`} key={step.label}>
              <i /><div>
                <b>{step.label}</b>
                <small className="step-by">{step.by}{i === idx ? ` · ${SUBSTATUS[order.orderStatus] || "Current step"}` : i < idx ? " · Done" : ""}</small>
                {i >= idx && <small>{step.text}</small>}
              </div>
            </div>
          ))}
        </div>
      </section>
    )}

    {delivered && reviewable.length > 0 && (
      <section className="data-card">
        <h3>Leave a review</h3>
        <form onSubmit={submitReview}>
          {reviewable.length > 1 && (
            <label className="field"><span>Product</span>
              <select value={reviewProduct} onChange={(e) => setReviewProduct(e.target.value)}>
                <option value="">Choose a product</option>
                {reviewable.map((it) => <option key={productIdOf(it)} value={productIdOf(it)}>{it.name}</option>)}
              </select>
            </label>
          )}
          <div className="stars" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} role="radio" aria-checked={n === rating} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className="star-btn" style={{ opacity: n <= rating ? 1 : 0.3 }}>★</button>
            ))}
          </div>
          <label className="field"><span>Your review</span>
            <textarea rows={3} value={reviewText} onChange={(e) => setReviewText(e.target.value)} maxLength={1000} placeholder="Tell other buyers about the product…" />
          </label>
          <button type="submit" className="gradient-btn" disabled={reviewBusy}>{reviewBusy ? "Sending…" : "Submit review"}</button>
        </form>
      </section>
    )}

    {order.paymentStatus === "PAID" && !cancelled && (
      <section className="data-card">
        <h3>Report a problem</h3>
        <p className="tiny">Use this if something is wrong with your order. The seller&apos;s payment stays on hold while MVEC reviews it.</p>
        <form onSubmit={report}>
          <div className="two-col">
            <label className="field"><span>What went wrong?</span>
              <select value={reason} onChange={(e) => setReason(e.target.value)} required>
                <option value="">Choose a problem</option>
                {REASONS.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <label className="field"><span>Details</span>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} minLength={10} required placeholder="What did you receive, and what did you expect? (at least 10 characters)" />
          </label>
          <button type="submit" className="outline-btn" disabled={reportBusy}>{reportBusy ? "Submitting…" : "Report a problem"}</button>
        </form>
      </section>
    )}
    {order.paymentStatus === "DISPUTED" && (
      <section className="verified-box"><b>Problem reported</b><p>MVEC support is reviewing this order. You can follow it under <Link to="/buyer/refunds">Refunds</Link>.</p></section>
    )}

    <Link className="outline-btn" to="/orders">← Back to orders</Link>
  </main></Storefront>;
}
