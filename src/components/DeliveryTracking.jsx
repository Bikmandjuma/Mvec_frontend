import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import Pagination from "./Pagination";
import { ordersApi } from "../API/orders";
import { payoutsApi } from "../API/payouts";
import { wholesaleApi } from "../API/wholesale";
import { client, extractErrorMessage } from "../API/client";
import { useAuth } from "../context/AuthContext";
import { money } from "../utils/format";

const dateDMY = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
const titleCase = (s) => String(s || "").toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const nameOf = (u, fallback) => u?.companyName || u?.Fullname || u?.fullName || u?.name || fallback;
const idOf = (x) => String(x?._id || x?.id || x || "");

// Fulfilment steps. The last one is reached only with the buyer's 6-digit
// delivery code, which also releases the held payment.
const RETAIL_STEPS = ["CONFIRMED", "PROCESSING", "READY_FOR_SHIPMENT", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const RETAIL_ALIAS = { PENDING: -1, COMPLETED: 5 };
const WHOLESALE_STEPS = ["PENDING_PAYMENT", "ESCROW_HELD", "SHIPPED", "DELIVERED", "CONFIRMED_RELEASED"];
const STEP_LABEL = { CONFIRMED: "Paid", PROCESSING: "Preparing", READY_FOR_SHIPMENT: "Packed", OUT_FOR_DELIVERY: "On the way", PENDING_PAYMENT: "Unpaid", ESCROW_HELD: "Paid", CONFIRMED_RELEASED: "Settled" };
const NEXT_ACTION = {
  CONFIRMED: ["PROCESSING", "Start preparing"],
  PROCESSING: ["READY_FOR_SHIPMENT", "Mark packed"],
  READY_FOR_SHIPMENT: ["SHIPPED", "Mark shipped"],
  SHIPPED: ["OUT_FOR_DELIVERY", "Out for delivery"],
};
const CLOSED = ["CANCELLED", "RETURNED", "REFUNDED", "FAILED", "DISPUTED"];
const DONE = ["DELIVERED", "COMPLETED", "CONFIRMED_RELEASED"];

const isCod = (o) => o.paymentMethod === "CASH_ON_DELIVERY" && o.paymentStatus !== "PAID";

// Where the seller's money stands for a retail order.
function retailSettlement(o) {
  if (CLOSED.includes(o.orderStatus) || o.paymentStatus === "DISPUTED") return { label: titleCase(o.paymentStatus === "DISPUTED" ? "DISPUTED" : o.orderStatus), tone: "danger", hint: "Not settled" };
  if (isCod(o)) return { label: "Cash on delivery", tone: "warning", hint: "Collect from the buyer" };
  if (o.paidOffline) return { label: "Paid offline", tone: "active", hint: "Settled outside MVEC" };
  if (o.paymentStatus !== "PAID") return { label: "Awaiting payment", tone: "warning", hint: "Not yet paid" };
  if (DONE.includes(o.orderStatus)) return { label: "Released", tone: "active", hint: "Added to the seller's balance" };
  return { label: "Held by MVEC", tone: "pending", hint: "Released after delivery" };
}

function normalizeRetail(o, role, userId) {
  const mine = role === "vendor" ? (o.items || []).filter((i) => idOf(i.vendor) === String(userId)) : o.items || [];
  const items = mine.length ? mine : o.items || [];
  const first = items[0];
  const parcel = (o.shippingBreakdown || [])[0];
  const address = o.shippingAddress || {};
  const payable = o.paymentStatus === "PAID" || (o.paymentMethod === "CASH_ON_DELIVERY" && o.paymentStatus === "PENDING" && o.orderStatus !== "PENDING");
  const closed = CLOSED.includes(o.orderStatus) || o.paymentStatus === "DISPUTED";
  const done = DONE.includes(o.orderStatus);
  const handedOver = role === "vendor" && (o.deliveredVendors || []).map(String).includes(String(userId));
  const active = payable && !closed && !done;
  return {
    raw: o,
    id: idOf(o),
    number: o.orderNumber,
    title: first ? `${first.quantity} × ${first.name}${items.length > 1 ? ` +${items.length - 1} more` : ""}` : "Order",
    sellers: [...new Set((o.items || []).map((i) => nameOf(i.vendor, "")).filter(Boolean))].join(", "),
    party: o.recipient?.name || o.customer?.name || nameOf(o.user, "Buyer"),
    phone: o.recipient?.phone || o.customer?.phone || o.user?.phone,
    place: [address.street, address.sector, address.district || address.city, address.province].filter(Boolean).join(", "),
    eta: parcel?.eta,
    method: titleCase(o.shippingMethod || o.deliveryMethod || "STANDARD"),
    courier: o.courier,
    amount: role === "vendor" ? (o.vendorSubtotal || 0) + (o.vendorShippingFee || 0) : o.totalAmount,
    status: o.orderStatus,
    date: o.createdAt,
    steps: RETAIL_STEPS,
    step: RETAIL_ALIAS[o.orderStatus] ?? RETAIL_STEPS.indexOf(o.orderStatus),
    settlement: retailSettlement(o),
    closed,
    done,
    handedOver,
    // Unpaid online orders are not deliveries yet.
    relevant: payable || closed || done,
    held: o.paymentStatus === "PAID" && !o.paidOffline && active,
    link: role === "vendor" ? `/vendor/orders/${idOf(o)}` : role === "admin" ? `/admin/orders/${idOf(o)}` : null,
    next: active && !handedOver && (role === "vendor" || role === "admin") ? NEXT_ACTION[o.orderStatus] : null,
    canPickUp: active && role === "delivery" && o.orderStatus !== "OUT_FOR_DELIVERY",
    canAssign: active && role === "admin",
    canConfirm: active && !handedOver && ["vendor", "admin", "delivery"].includes(role),
  };
}

function normalizeWholesale(o) {
  const done = o.status === "CONFIRMED_RELEASED";
  const held = ["ESCROW_HELD", "SHIPPED", "DELIVERED"].includes(o.status);
  return {
    raw: o,
    id: idOf(o),
    number: o.orderNumber,
    title: `${o.items?.[0]?.productName || "Wholesale order"}${o.items?.length > 1 ? ` +${o.items.length - 1} more` : ""}`,
    party: nameOf(o.vendor, "Vendor"),
    amount: o.totalAmount,
    status: o.status,
    date: o.createdAt,
    steps: WHOLESALE_STEPS,
    step: WHOLESALE_STEPS.indexOf(o.status),
    settlement: done ? { label: "Released", tone: "active", hint: "Added to your balance" }
      : held ? { label: "Held in escrow", tone: "pending", hint: "Released when the vendor confirms" }
      : CLOSED.includes(o.status) ? { label: titleCase(o.status), tone: "danger", hint: "Not settled" }
      : { label: "Awaiting payment", tone: "warning", hint: "Vendor has not paid yet" },
    closed: CLOSED.includes(o.status),
    done,
    held,
    relevant: true,
    canShip: o.status === "ESCROW_HELD",
  };
}

const COPY = {
  vendor: ["Delivery & settlement", "Move each paid order to the buyer, then confirm with the buyer's 6-digit code to release your money."],
  supplier: ["Delivery & settlement", "Ship paid wholesale orders. Funds are released when the vendor confirms receipt."],
  admin: ["All deliveries", "Monitor every parcel, assign couriers and confirm deliveries with the buyer's code."],
  delivery: ["My deliveries", "Deliveries assigned to you. Ask the buyer for their 6-digit code when you hand over the items."],
};

export default function DeliveryTracking({ role = "vendor", initialTab = "active" }) {
  const { user } = useAuth();
  const wholesale = role === "supplier";
  const [orders, setOrders] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(initialTab);
  const [page, setPage] = useState(1);
  const [codes, setCodes] = useState({});
  const [busyId, setBusyId] = useState("");
  const [feedback, setFeedback] = useState({});
  const perPage = 6;

  const load = () => {
    const request = wholesale ? wholesaleApi.getMine()
      : role === "vendor" ? ordersApi.getVendorOrders()
      : role === "admin" ? ordersApi.getAll()
      : ordersApi.getDeliverable();
    return request
      .then((res) => {
        const list = res.orders || res.data || [];
        setOrders(list.map((o) => (wholesale ? normalizeWholesale(o) : normalizeRetail(o, role, user?.id))));
        setError("");
      })
      .catch((err) => setError(extractErrorMessage(err, "We could not load your deliveries. Refresh the page to try again.")))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    if (role === "vendor") payoutsApi.getBalance().then((res) => setBalance(res.balance || null)).catch(() => {});
    if (role === "admin") {
      client.get("/users", { params: { role: "delivery", limit: 100 } })
        .then((r) => setCouriers(r.data.data || []))
        .catch(() => setCouriers([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user?.id]);

  const relevant = useMemo(() => orders.filter((o) => o.relevant), [orders]);
  const counts = useMemo(() => ({
    active: relevant.filter((o) => !o.done && !o.closed).length,
    done: relevant.filter((o) => o.done).length,
    all: relevant.length,
  }), [relevant]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return relevant
      .filter((o) => (tab === "active" ? !o.done && !o.closed : tab === "done" ? o.done : true))
      .filter((o) => !term || `${o.number} ${o.title} ${o.party} ${o.phone || ""} ${o.place || ""}`.toLowerCase().includes(term));
  }, [relevant, tab, q]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / perPage)));
  const shown = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const heldTotal = relevant.filter((o) => o.held).reduce((n, o) => n + (Number(o.amount) || 0), 0);
  const releasedTotal = relevant.filter((o) => o.done && o.settlement.label === "Released").reduce((n, o) => n + (Number(o.amount) || 0), 0);

  const say = (id, ok, text) => setFeedback((f) => ({ ...f, [id]: { ok, text } }));

  // Run an action for one card and show its result on that card.
  const act = async (o, fn, fallbackDone) => {
    setBusyId(o.id);
    say(o.id, true, "");
    try {
      const res = await fn();
      say(o.id, true, res?.message || fallbackDone);
      await load();
    } catch (err) {
      say(o.id, false, extractErrorMessage(err));
    } finally {
      setBusyId("");
    }
  };

  const advance = (o, status) => act(o, () => ordersApi.updateVendorOrderStatus({ orderId: o.id, status }), "Updated. The buyer has been notified.");
  const pickUp = (o) => act(o, () => client.patch(`/orders/${o.id}/out-for-delivery`).then((r) => r.data), "Marked as out for delivery. The buyer has been notified.");
  const assign = (o, courierId) => act(o, () => client.patch(`/orders/${o.id}/courier`, { courierId: courierId || null }).then((r) => r.data), "Courier updated.");
  const confirm = (o) => {
    const code = (codes[o.id] || "").trim();
    if (code.length !== 6) return;
    setCodes((c) => ({ ...c, [o.id]: "" }));
    return act(o, () => ordersApi.confirmDelivery(o.id, code), `${o.number} delivered. The payment is released.`);
  };
  const ship = (o) => act(o, () => wholesaleApi.markShipped(o.id), `${o.number} marked as shipped.`);

  if (loading) return <div className="empty-state"><h3>Loading deliveries…</h3></div>;
  const [title, desc] = COPY[role] || COPY.vendor;

  return <>
    <div className="dash-page-head">
      <div><span className="eyebrow">DELIVERY &amp; SETTLEMENT</span><h1>{title}</h1><p>{desc}</p></div>
      <button type="button" className="outline-btn" onClick={() => { setLoading(true); load(); }}>Refresh</button>
    </div>
    {error && <div className="form-alert error" role="alert">{error}</div>}

    <div className="metric-grid">
      <div className="metric"><div className="metric-icon"><Icon name="box" /></div><div><span>In progress</span><strong>{counts.active}</strong><small>{wholesale ? "Wholesale orders" : "Parcels on the way"}</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="shield" /></div><div><span>Held until delivery</span><strong>{money(heldTotal)}</strong><small>Protected by MVEC</small></div></div>
      {role === "vendor" && balance
        ? <>
            <div className="metric"><div className="metric-icon"><Icon name="wallet" /></div><div><span>Available balance</span><strong>{money(balance.availableBalance)}</strong><small><Link to="/vendor/payouts">Withdraw →</Link></small></div></div>
            <div className="metric"><div className="metric-icon"><Icon name="chart" /></div><div><span>Total earned</span><strong>{money(balance.totalEarned)}</strong><small>{money(balance.pendingBalance)} pending</small></div></div>
          </>
        : <>
            <div className="metric"><div className="metric-icon"><Icon name="check" /></div><div><span>Delivered</span><strong>{counts.done}</strong><small>Completed orders</small></div></div>
            <div className="metric"><div className="metric-icon"><Icon name="wallet" /></div><div><span>Released</span><strong>{money(releasedTotal)}</strong><small>Settled after delivery</small></div></div>
          </>}
    </div>

    <div className="dlv-howto">
      {(wholesale
        ? [["shield", "Vendor pays", "Funds are locked in escrow."], ["box", "You ship", "Mark the order as shipped."], ["check", "Vendor confirms", "Payment is released to you."]]
        : [["shield", "Buyer pays", "MVEC holds the money."], ["box", "Parcel delivered", "The buyer shares their 6-digit code."], ["wallet", "Funds released", "The amount moves to the seller's balance."]]
      ).map(([icon, t, d], i) => <div key={t}><span>{i + 1}</span><Icon name={icon} size={18} /><div><b>{t}</b><small>{d}</small></div></div>)}
    </div>
    {!wholesale && <div className="verified-box settlement-banner"><b>🔒 Protected funds</b><p>Only enter the buyer's code once they have the items in hand. Never accept the code over the phone before delivery.</p></div>}

    <div className="data-card">
      <div className="dlv-toolbar">
        <div className="dlv-tabs" role="tablist">
          {[["active", "In progress"], ["done", "Delivered"], ["all", "All"]].map(([k, l]) =>
            <button type="button" role="tab" aria-selected={tab === k} key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setPage(1); }}>{l}<em>{counts[k]}</em></button>)}
        </div>
        <div className="dash-filter"><Icon name="search" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search deliveries" placeholder={wholesale ? "Search order, vendor or product…" : "Search order, buyer, product or place…"} /></div>
      </div>

      {!shown.length && <div className="empty-state">
        <h3>{q ? "No deliveries match your search" : tab === "done" ? "Nothing delivered yet" : "No deliveries in progress"}</h3>
        <p>{wholesale ? "Paid wholesale orders you need to ship will appear here." : "Paid orders appear here as they move towards the buyer."}</p>
      </div>}

      {shown.map((o) => {
        const note = feedback[o.id];
        const busy = busyId === o.id;
        return <div className={"dlv-card" + (o.closed ? " closed" : "")} key={o.id}>
          <div className="dlv-card-head">
            <div className="dlv-card-main">
              <b>{o.link ? <Link to={o.link}>{o.number}</Link> : o.number}</b>
              <span>{o.title}</span>
              <small>{o.party}{o.phone ? ` · ${o.phone}` : ""} · {dateDMY(o.date)}</small>
              {o.place && <small>Deliver to: {o.place}</small>}
              {o.sellers && role !== "vendor" && <small>Seller: {o.sellers}</small>}
              {o.courier && role === "admin" && <small>Courier: {nameOf(o.courier, "Assigned")}</small>}
            </div>
            <div className="dlv-money">
              <strong>{money(o.amount)}</strong>
              <em className={`status ${o.settlement.tone}`}>{o.settlement.label}</em>
              <small>{o.settlement.hint}</small>
            </div>
          </div>

          {o.closed
            ? <p className="tiny dlv-closed-note">This order is {titleCase(o.raw.paymentStatus === "DISPUTED" ? "DISPUTED" : o.status).toLowerCase()} and will not be delivered{o.raw.paymentStatus === "DISPUTED" ? " until MVEC resolves the dispute" : ""}.</p>
            : <ol className="dlv-steps" style={{ "--steps": o.steps.length }}>
                {o.steps.map((s, i) => <li key={s} className={i < o.step || (o.done && i === o.step) ? "done" : i === o.step ? "now" : ""}>
                  <i>{i < o.step || (o.done && i === o.step) ? <Icon name="check" size={12} /> : i + 1}</i>
                  <small>{STEP_LABEL[s] || titleCase(s)}</small>
                </li>)}
              </ol>}

          {!o.closed && (o.eta || (!wholesale && o.method)) && <div className="dlv-meta">
            {!wholesale && <span><Icon name="box" size={14} />{o.method}</span>}
            {o.eta && <span><Icon name="bell" size={14} />Promised: {o.eta}</span>}
          </div>}

          {(o.next || o.canPickUp || o.canAssign) && <div className="dlv-otp">
            {o.next && <button type="button" className="outline-btn" disabled={busy} onClick={() => advance(o, o.next[0])}>{busy ? "Saving…" : o.next[1]}</button>}
            {o.canPickUp && <button type="button" className="outline-btn" disabled={busy} onClick={() => pickUp(o)}>Picked up · out for delivery</button>}
            {o.canAssign && <select className="inline-table-input" aria-label={`Courier for ${o.number}`} value={idOf(o.courier) === "null" ? "" : idOf(o.courier)} onChange={(e) => assign(o, e.target.value)} disabled={busy}>
              <option value="">{couriers.length ? "Assign a courier…" : "No courier accounts yet"}</option>
              {couriers.map((c) => <option key={c.id} value={String(c.id)}>{c.Fullname || c.fullName || c.phone}</option>)}
            </select>}
          </div>}

          {o.canConfirm && <div className="dlv-otp">
            <input inputMode="numeric" maxLength={6} value={codes[o.id] || ""} aria-label={`Delivery code for ${o.number}`}
              onChange={(e) => setCodes((s) => ({ ...s, [o.id]: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="••••••" />
            <button type="button" className="gradient-btn" disabled={(codes[o.id] || "").length !== 6 || busy} onClick={() => confirm(o)}>
              <Icon name="check" size={16} />{busy ? "Verifying…" : "Confirm delivery"}
            </button>
            <small className="tiny">{isCod(o.raw) ? "Collect the cash, then enter the code shown on the buyer's order page." : "Enter the code shown on the buyer's order page. It releases the held payment."}</small>
          </div>}

          {o.handedOver && !o.done && <p className="tiny success-text">Your items are delivered and your payment is released. Waiting for the other sellers in this order.</p>}

          {o.canShip && <div className="dlv-otp">
            <button type="button" className="gradient-btn" disabled={busy} onClick={() => ship(o)}>
              <Icon name="box" size={16} />{busy ? "Saving…" : "Mark as shipped"}
            </button>
            <small className="tiny">The vendor's payment is already secured in escrow.</small>
          </div>}

          {note?.text && <small className={note.ok ? "success-text" : "form-alert error"} role="status">{note.text}</small>}
        </div>;
      })}

      {filtered.length > perPage && <Pagination page={safePage} setPage={setPage} total={filtered.length} perPage={perPage} />}
    </div>
  </>;
}
