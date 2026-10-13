import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import Pagination from "./Pagination";
import { ordersApi } from "../API/orders";
import { payoutsApi } from "../API/payouts";
import { wholesaleApi } from "../API/wholesale";
import { extractErrorMessage } from "../API/client";

const money = (n) => new Intl.NumberFormat("en-RW").format(Math.round(Number(n) || 0)) + " RWF";
const dateDMY = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
const titleCase = (s) => String(s || "").toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const nameOf = (u, fallback) => u?.companyName || u?.Fullname || u?.fullName || u?.name || fallback;

const RETAIL_STEPS = ["CONFIRMED", "PROCESSING", "READY_FOR_SHIPMENT", "SHIPPED", "DELIVERED"];
const RETAIL_ALIAS = { PENDING: -1, OUT_FOR_DELIVERY: 3, COMPLETED: 4 };
const WHOLESALE_STEPS = ["PENDING_PAYMENT", "ESCROW_HELD", "SHIPPED", "DELIVERED", "CONFIRMED_RELEASED"];
const STEP_LABEL = { READY_FOR_SHIPMENT: "Ready", PENDING_PAYMENT: "Unpaid", ESCROW_HELD: "Paid", CONFIRMED_RELEASED: "Settled" };
const CLOSED = ["CANCELLED", "RETURNED", "REFUNDED", "FAILED", "DISPUTED"];
const DONE = ["DELIVERED", "COMPLETED", "CONFIRMED_RELEASED"];

// Where the seller's money stands for a retail order.
function retailSettlement(o) {
  if (CLOSED.includes(o.orderStatus)) return { label: titleCase(o.orderStatus), tone: "danger", hint: "Not settled" };
  if (o.paymentMethod === "CASH_ON_DELIVERY" && o.paymentStatus !== "PAID") return { label: "Cash on delivery", tone: "warning", hint: "Collect from the buyer" };
  if (o.paidOffline) return { label: "Paid offline", tone: "active", hint: "Settled outside MVEC" };
  if (o.paymentStatus !== "PAID") return { label: "Awaiting payment", tone: "warning", hint: "Not yet paid" };
  if (DONE.includes(o.orderStatus)) return { label: "Released", tone: "active", hint: "Added to your balance" };
  return { label: "Held by MVEC", tone: "pending", hint: "Released after delivery" };
}

function normalizeRetail(o, role) {
  const step = RETAIL_ALIAS[o.orderStatus] ?? RETAIL_STEPS.indexOf(o.orderStatus);
  const firstItem = o.items?.[0];
  const parcel = (o.shippingBreakdown || [])[0];
  const address = o.shippingAddress || {};
  return {
    id: o._id || o.id,
    number: o.orderNumber,
    title: firstItem ? `${firstItem.name}${o.items.length > 1 ? ` +${o.items.length - 1} more` : ""}` : "Order",
    party: o.customer?.name || nameOf(o.user, "Buyer"),
    phone: o.customer?.phone || o.user?.phone,
    place: [address.sector, address.district || address.city].filter(Boolean).join(", "),
    eta: parcel?.eta,
    method: titleCase(o.shippingMethod || "STANDARD"),
    amount: role === "vendor" ? (o.vendorSubtotal || 0) + (o.vendorShippingFee || 0) : o.totalAmount,
    status: o.orderStatus,
    date: o.createdAt,
    steps: RETAIL_STEPS,
    step,
    settlement: retailSettlement(o),
    closed: CLOSED.includes(o.orderStatus),
    done: DONE.includes(o.orderStatus),
    held: o.paymentStatus === "PAID" && !o.paidOffline && !DONE.includes(o.orderStatus) && !CLOSED.includes(o.orderStatus),
    link: role === "vendor" ? `/vendor/orders/${o._id || o.id}` : role === "admin" ? `/admin/orders/${o._id || o.id}` : null,
    canConfirm: (role === "admin" || role === "delivery") && o.paymentStatus === "PAID" && ["READY_FOR_SHIPMENT", "SHIPPED", "OUT_FOR_DELIVERY"].includes(o.orderStatus),
  };
}

function normalizeWholesale(o) {
  const done = o.status === "CONFIRMED_RELEASED";
  const held = ["ESCROW_HELD", "SHIPPED", "DELIVERED"].includes(o.status);
  return {
    id: o._id || o.id,
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
    canShip: o.status === "ESCROW_HELD",
  };
}

const COPY = {
  vendor: ["Delivery & settlement", "Follow each parcel to the buyer and see when its money is released to your balance."],
  supplier: ["Delivery & settlement", "Ship paid wholesale orders. Funds are released when the vendor confirms receipt."],
  admin: ["All deliveries", "Monitor every parcel in transit and confirm deliveries with the buyer's code."],
  delivery: ["My deliveries", "Confirm each delivery with the 6-digit code the buyer shows you."],
};

export default function DeliveryTracking({ role = "vendor" }) {
  const wholesale = role === "supplier";
  const [orders, setOrders] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("active");
  const [page, setPage] = useState(1);
  const [otp, setOtp] = useState({});
  const [busyId, setBusyId] = useState("");
  const perPage = 6;

  const load = () => {
    const request = wholesale ? wholesaleApi.getMine() : role === "vendor" ? ordersApi.getVendorOrders() : ordersApi.getAll();
    return request
      .then((res) => {
        const list = res.orders || res.data || [];
        setOrders(list.map((o) => (wholesale ? normalizeWholesale(o) : normalizeRetail(o, role))));
        setError("");
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    if (role === "vendor") payoutsApi.getBalance().then((res) => setBalance(res.balance || null)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  // Orders that have entered fulfilment (unpaid retail orders still at PENDING are not deliveries yet).
  const relevant = useMemo(() => orders.filter((o) => wholesale || o.step >= 0 || o.done || o.closed), [orders, wholesale]);
  const counts = useMemo(() => ({
    active: relevant.filter((o) => !o.done && !o.closed).length,
    done: relevant.filter((o) => o.done).length,
    all: relevant.length,
  }), [relevant]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return relevant
      .filter((o) => (tab === "active" ? !o.done && !o.closed : tab === "done" ? o.done : true))
      .filter((o) => !term || `${o.number} ${o.title} ${o.party} ${o.place || ""}`.toLowerCase().includes(term));
  }, [relevant, tab, q]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / perPage)));
  const shown = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const heldTotal = relevant.filter((o) => o.held).reduce((n, o) => n + (Number(o.amount) || 0), 0);
  const releasedTotal = relevant.filter((o) => o.done && o.settlement.label === "Released").reduce((n, o) => n + (Number(o.amount) || 0), 0);

  const act = async (o, fn, done) => {
    setBusyId(o.id);
    setError("");
    try {
      await fn();
      setNotice(done);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusyId("");
    }
  };
  const confirm = (o) => act(o, () => ordersApi.confirmDelivery(o.id, otp[o.id]), `${o.number} delivered. Funds released to the seller.`);
  const ship = (o) => act(o, () => wholesaleApi.markShipped(o.id), `${o.number} marked as shipped.`);

  if (loading) return <div className="empty-state"><h3>Loading deliveries…</h3></div>;
  const [title, desc] = COPY[role] || COPY.vendor;

  return <>
    <div className="dash-page-head">
      <div><span className="eyebrow">DELIVERY & SETTLEMENT</span><h1>{title}</h1><p>{desc}</p></div>
    </div>
    {error && <div className="form-error">{error}</div>}
    {notice && <div className="form-alert success">{notice}</div>}

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
        : [["shield", "Buyer pays", "MVEC holds the money."], ["box", "Parcel delivered", "The buyer shares their 6-digit code."], ["wallet", "Funds released", "The amount moves to your balance."]]
      ).map(([icon, t, d], i) => <div key={t}><span>{i + 1}</span><Icon name={icon} size={18} /><div><b>{t}</b><small>{d}</small></div></div>)}
    </div>

    <div className="data-card">
      <div className="dlv-toolbar">
        <div className="dlv-tabs" role="tablist">
          {[["active", "In progress"], ["done", "Delivered"], ["all", "All"]].map(([k, l]) =>
            <button type="button" role="tab" aria-selected={tab === k} key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setPage(1); }}>{l}<em>{counts[k]}</em></button>)}
        </div>
        <div className="dash-filter"><Icon name="search" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={wholesale ? "Search order, vendor or product…" : "Search order, buyer, product or place…"} /></div>
      </div>

      {!shown.length && <div className="empty-state">
        <h3>{q ? "No deliveries match your search" : tab === "done" ? "Nothing delivered yet" : "No deliveries in progress"}</h3>
        <p>{wholesale ? "Paid wholesale orders you need to ship will appear here." : "Confirmed orders appear here as they move towards the buyer."}</p>
      </div>}

      {shown.map((o) => (
        <div className={"dlv-card" + (o.closed ? " closed" : "")} key={o.id}>
          <div className="dlv-card-head">
            <div className="dlv-card-main">
              <b>{o.link ? <Link to={o.link}>{o.number}</Link> : o.number}</b>
              <span>{o.title}</span>
              <small>{o.party}{o.phone ? ` · ${o.phone}` : ""}{o.place ? ` · ${o.place}` : ""} · {dateDMY(o.date)}</small>
            </div>
            <div className="dlv-money">
              <strong>{money(o.amount)}</strong>
              <em className={`status ${o.settlement.tone}`}>{o.settlement.label}</em>
              <small>{o.settlement.hint}</small>
            </div>
          </div>

          {o.closed
            ? <p className="tiny dlv-closed-note">This order was {titleCase(o.status).toLowerCase()} and will not be delivered.</p>
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

          {o.canConfirm && <div className="dlv-otp">
            <input inputMode="numeric" maxLength={6} value={otp[o.id] || ""} aria-label={`Delivery code for ${o.number}`}
              onChange={(e) => setOtp((s) => ({ ...s, [o.id]: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="••••••" />
            <button type="button" className="gradient-btn" disabled={(otp[o.id] || "").length !== 6 || busyId === o.id} onClick={() => confirm(o)}>
              <Icon name="check" size={16} />{busyId === o.id ? "Verifying…" : "Confirm delivery"}
            </button>
            <small className="tiny">Enter the code shown on the buyer's order page. It releases the held funds.</small>
          </div>}

          {o.canShip && <div className="dlv-otp">
            <button type="button" className="gradient-btn" disabled={busyId === o.id} onClick={() => ship(o)}>
              <Icon name="box" size={16} />{busyId === o.id ? "Saving…" : "Mark as shipped"}
            </button>
            <small className="tiny">The vendor's payment is already secured in escrow.</small>
          </div>}

          {role === "vendor" && o.status === "SHIPPED" && <p className="tiny dlv-hint">On its way. Delivery is confirmed when the buyer's 6-digit code is verified; your funds are released then.</p>}
        </div>
      ))}

      {filtered.length > perPage && <Pagination page={safePage} setPage={setPage} total={filtered.length} perPage={perPage} />}
    </div>
  </>;
}
