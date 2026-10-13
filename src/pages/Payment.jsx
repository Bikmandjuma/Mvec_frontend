import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Storefront from "../components/Storefront";
import { ordersApi } from "../API/orders";
import { paymentsApi } from "../API/payments";
import { extractErrorMessage } from "../API/client";
import { getSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { money } from "../utils/format";
import { isRwandanPhone } from "../utils/delivery";

const POLL_MS = 3000;
const POLL_LIMIT_MS = 3 * 60 * 1000;

const providerOf = (phone) => {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  const local = digits.startsWith("250") ? `0${digits.slice(3)}` : digits;
  if (/^07[89]/.test(local)) return "MTN MoMo";
  if (/^07[23]/.test(local)) return "Airtel Money";
  return "";
};

export default function Payment() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [method, setMethod] = useState("momo"); // momo | card

  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState("choose"); // choose | waiting | confirmed | timeout
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const pollRef = useRef(null);
  const paymentIdRef = useRef(null);
  const startedAt = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const confirmed = useCallback(() => {
    stopPolling();
    setStage("confirmed");
    setTimeout(() => navigate(`/orders/${id}`, { replace: true }), 1200);
  }, [id, navigate, stopPolling]);

  useEffect(() => {
    let alive = true;
    ordersApi.getById(id).then((res) => {
      if (!alive) return;
      setOrder(res.order);
      if (res.order.paymentStatus === "PAID") setStage("confirmed");
    }).catch((err) => alive && setError(extractErrorMessage(err)))
      .finally(() => alive && setLoadingOrder(false));
    return () => { alive = false; };
  }, [id]);

  // Default the number once to the delivery phone or the account phone.
  const phoneDefaulted = useRef(false);
  useEffect(() => {
    if (phoneDefaulted.current || !order) return;
    phoneDefaulted.current = true;
    const raw = order.recipient?.phone || user?.telephone || "";
    setPhone(raw.startsWith("+250") ? `0${raw.slice(4)}` : raw);
  }, [order, user]);

  // Live confirmation from the server, with polling as the fallback.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const onConfirmed = (payload) => {
      if (String(payload?.orderId) === String(id)) confirmed();
    };
    const onOrderUpdate = (payload) => {
      if (String(payload?._id || payload?.id) === String(id) && payload?.paymentStatus === "PAID") confirmed();
    };
    socket.on("payment_confirmed", onConfirmed);
    socket.on("order_status_updated", onOrderUpdate);
    return () => {
      socket.off("payment_confirmed", onConfirmed);
      socket.off("order_status_updated", onOrderUpdate);
    };
  }, [id, confirmed]);

  useEffect(() => stopPolling, [stopPolling]);

  const checkOnce = useCallback(async () => {
    try {
      // The status endpoint also asks the gateway, so this works even when
      // the gateway callback cannot reach the server.
      if (paymentIdRef.current) {
        const res = await paymentsApi.getStatus(paymentIdRef.current);
        if (res.order?.paymentStatus === "PAID" || res.payment?.status === "SUCCESS") return confirmed();
        if (res.payment?.status === "FAILED" || res.payment?.status === "CANCELLED") {
          stopPolling();
          setStage("choose");
          setError(res.payment?.method === "CARD"
            ? "The card payment was declined or cancelled. No money was taken; you can try again or use mobile money."
            : "The payment was declined or cancelled on your phone. You can try again.");
          return undefined;
        }
      } else {
        const res = await ordersApi.getById(id);
        if (res.order.paymentStatus === "PAID") return confirmed();
      }
    } catch { /* temporary network issue: keep trying */ }
    if (Date.now() - startedAt.current > POLL_LIMIT_MS) {
      stopPolling();
      setStage("timeout");
    }
    return undefined;
  }, [id, confirmed, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    startedAt.current = Date.now();
    pollRef.current = setInterval(checkOnce, POLL_MS);
  }, [checkOnce, stopPolling]);

  // Back from the card page (?paymentId=…): verify the result right away.
  const returnedPaymentId = searchParams.get("paymentId");
  useEffect(() => {
    if (!returnedPaymentId || !order || order.paymentStatus === "PAID") return;
    paymentIdRef.current = returnedPaymentId;
    setMethod("card");
    setStage("waiting");
    setNotice("Checking your card payment…");
    checkOnce();
    startPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedPaymentId, order?.id]);

  async function payByCard() {
    setStage("waiting");
    try {
      const res = await paymentsApi.payCard({ orderId: id });
      paymentIdRef.current = res.paymentId || null;
      if (res.status === "SUCCESS") { confirmed(); return; }
      if (!res.checkoutUrl) throw new Error("The card page could not be opened. Please try again.");
      setNotice("Opening the secure card page…");
      window.location.assign(res.checkoutUrl);
    } catch (err) {
      setError(extractErrorMessage(err));
      setStage("choose");
    }
  }

  async function pay(e) {
    e?.preventDefault();
    setError("");
    setNotice("");
    if (method === "card") { await payByCard(); return; }
    if (!isRwandanPhone(phone)) {
      setError("Enter an MTN (078/079) or Airtel (072/073) number.");
      return;
    }
    setStage("waiting");
    try {
      const res = await paymentsApi.payMobileMoney({ orderId: id, phoneNumber: phone.trim() });
      paymentIdRef.current = res.paymentId || null;
      setNotice(res.message || "");
      if (res.status === "SUCCESS") { confirmed(); return; }
      startPolling();
    } catch (err) {
      // A prompt is already waiting on the phone: keep watching that one.
      if (err?.response?.status === 409 && err.response.data?.paymentId) {
        paymentIdRef.current = err.response.data.paymentId;
        setNotice(extractErrorMessage(err));
        startPolling();
        return;
      }
      setError(extractErrorMessage(err));
      setStage("choose");
    }
  }

  if (loadingOrder) {
    return <Storefront><main className="payment-page"><div className="empty-state"><h3>Loading…</h3></div></main></Storefront>;
  }
  if (!order) {
    return <Storefront><main className="account-page"><div className="form-alert error">{error || "Order not found."}</div><Link className="outline-btn" to="/orders">My orders</Link></main></Storefront>;
  }

  const closed = order.orderStatus === "CANCELLED" || order.paymentStatus === "REFUNDED";
  const provider = providerOf(phone);

  return <Storefront><main className="payment-page">
    <div className="page-title"><span className="eyebrow">PAYMENT</span><h1>Pay for your order</h1><p>Order #{order.orderNumber}</p></div>
    <ol className="checkout-steps"><li>1 Delivery details</li><li className="active">2 Payment</li><li className={stage === "confirmed" ? "active" : ""}>3 Confirmation</li></ol>
    {error && <div className="form-alert error" role="alert">{error}</div>}
    {notice && stage !== "confirmed" && <div className="form-alert success" role="status">{notice}</div>}
    <div className="payment-layout"><section className="payment-card">
      {closed ? (
        <>
          <h2>This order is closed</h2>
          <p>{order.cancellationReason === "PAYMENT_TIMEOUT_EXPIRED_30_MIN" ? "It was not paid within 30 minutes, so it was cancelled and the items were released." : "This order was cancelled."} You have not been charged for it.</p>
          <Link className="gradient-btn" to="/shop">Continue shopping</Link>
        </>
      ) : stage === "confirmed" ? (
        <>
          <h2>Payment confirmed ✓</h2>
          <p>Thank you! Your payment is held safely by MVEC. Taking you to your order…</p>
          <Link className="gradient-btn" to={`/orders/${id}`}>View order</Link>
        </>
      ) : (
        <form onSubmit={pay}>
          <h2>How would you like to pay?</h2>
          <div role="radiogroup" aria-label="Payment method">
            <label className={`payment-option ${method === "momo" ? "selected" : ""}`}>
              <input type="radio" name="method" value="momo" checked={method === "momo"} onChange={() => setMethod("momo")} disabled={stage === "waiting"} />
              <span className="payment-logo" aria-hidden="true">📱</span>
              <span><b>Mobile money</b><small>MTN MoMo or Airtel Money: approve a prompt on your phone</small></span>
            </label>
            <label className={`payment-option ${method === "card" ? "selected" : ""}`}>
              <input type="radio" name="method" value="card" checked={method === "card"} onChange={() => setMethod("card")} disabled={stage === "waiting"} />
              <span className="payment-logo" aria-hidden="true">💳</span>
              <span><b>Card</b><small>Visa or Mastercard on Flutterwave's secure page</small></span>
            </label>
          </div>
          {method === "momo" ? (
            <label className="field payment-fields"><span>Mobile money number</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" autoComplete="tel" disabled={stage === "waiting"} />
              {provider && <small className="tiny">{provider}</small>}
            </label>
          ) : (
            <p className="tiny payment-fields">You will enter your card on Flutterwave's secure page, then come back here automatically. MVEC never sees your card number.</p>
          )}
          <button className="gradient-btn full" type="submit" disabled={stage === "waiting"}>
            {stage === "waiting"
              ? (method === "card" ? "Confirming your card payment…" : "Waiting for your approval…")
              : `Pay ${money(order.totalAmount)}${method === "card" ? " by card" : ""}`}
          </button>
          {stage === "waiting" && method === "momo" && <p className="tiny" role="status">Approve the prompt on your phone. This page updates automatically.</p>}
          {stage === "timeout" && (
            <div className="form-alert error" role="alert">
              We have not received a confirmation yet. If you approved the payment, it may still arrive.{" "}
              <button type="button" className="text-btn" onClick={() => { setStage("waiting"); startPolling(); }}>Check again</button>{" "}
              or send a new prompt with the button above.
            </div>
          )}
          <p className="tiny">Unpaid orders are cancelled automatically after 30 minutes.</p>
        </form>
      )}
    </section><aside className="security-panel">
      <h3>Order total</h3>
      <div className="summary-lines">
        <div><span>Products</span><b>{money(order.subtotal ?? order.totalAmount - (order.shippingFee || 0))}</b></div>
        <div><span>Delivery</span><b>{order.shippingFee ? money(order.shippingFee) : "FREE"}</b></div>
        <div className="grand"><span>Total</span><strong>{money(order.totalAmount)}</strong></div>
      </div>
      <div className="secure-icon" aria-hidden="true">✓</div>
      <h3>How MVEC protects you</h3>
      <p>Your payment is held by MVEC until you confirm delivery, then released to the seller.</p>
      <div className="status-flow"><span>Payment</span><i>→</i><span>MVEC holds</span><i>→</i><span>Delivery</span><i>→</i><span>Release</span></div>
      <p className="tiny">After payment you get a delivery code in your order. Only give it to the courier when your order arrives.</p>
    </aside></div>
  </main></Storefront>;
}
