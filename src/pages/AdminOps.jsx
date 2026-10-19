// Admin pages built on live marketplace data: verification of sellers and
// suppliers, supply requests and supplier payouts, payments, MVEC earnings,
// the ledger, analytics, risk signals, trust scores, subscriptions, platform
// settings and the audit log. Every number comes from the backend; nothing is
// stored in the browser.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";
import SmartTable from "../components/SmartTable";
import ProductImage from "../components/ProductImage";
import CategorySelect from "../components/CategorySelect";
import { adminApi } from "../API/admin";
import { supportApi } from "../API/support";
import { wholesaleApi } from "../API/wholesale";
import { quotesApi } from "../API/quotes";
import { extractErrorMessage } from "../API/client";
import { money, formatDate, statusLabel } from "../utils/format";

const dateTime = (v) => (v ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const pct = (v) => `${Number(v) || 0}%`;

export function Head({ eyebrow, title, desc, action }) {
  return <div className="dash-page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{desc && <p>{desc}</p>}</div>{action}</div>;
}
function Metric({ icon = "chart", label, value, sub }) {
  return <div className="metric"><div className="metric-icon"><Icon name={icon} /></div><div><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div></div>;
}
function Notice({ notice }) {
  if (!notice) return null;
  return <div className={`form-alert ${notice.ok ? "success" : "error"}`} role="status">{notice.text}</div>;
}
function Tabs({ tabs, value, onChange, label }) {
  return <div className="dlv-tabs admin-tabs" role="tablist" aria-label={label}>
    {tabs.map(([key, text, count]) => <button type="button" role="tab" key={key} aria-selected={value === key} className={value === key ? "on" : ""} onClick={() => onChange(key)}>
      {text}{count !== undefined && <em>{count}</em>}
    </button>)}
  </div>;
}
function Period({ value, onChange }) {
  return <select className="inline-table-input" aria-label="Period" value={value} onChange={(e) => onChange(Number(e.target.value))}>
    {[[7, "Last 7 days"], [30, "Last 30 days"], [90, "Last 90 days"], [365, "Last 12 months"]].map(([d, t]) => <option key={d} value={d}>{t}</option>)}
  </select>;
}
const Loading = ({ what = "data" }) => <div className="empty-state"><h3>Loading {what}…</h3></div>;
const Failed = ({ error, retry }) => <div className="empty-state"><h3>Couldn't load this page</h3><p>{error}</p>{retry && <button type="button" className="outline-btn" onClick={retry}>Try again</button>}</div>;

// Load once, reload on demand; refresh quietly every `every` ms if given.
function useLoad(fn, deps = [], every = 0) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const load = useCallback((quiet = false) => {
    if (!quiet) setState((s) => ({ ...s, loading: true, error: "" }));
    return fn().then((data) => setState({ loading: false, data, error: "" })).catch((err) => setState((s) => ({ loading: false, data: quiet ? s.data : null, error: extractErrorMessage(err) })));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
    if (!every) return undefined;
    const t = setInterval(() => load(true), every);
    return () => clearInterval(t);
  }, [load, every]);
  return { ...state, reload: load };
}
const useTab = (fallback) => {
  const { search } = useLocation();
  const navigate = useNavigate();
  const tab = new URLSearchParams(search).get("tab") || fallback;
  return [tab, (t) => navigate({ search: `?tab=${t}` }, { replace: true })];
};
const tone = (s) => (["VERIFIED", "ACTIVE", "SUCCESS", "RELEASED", "PAID", "RECEIVED", "Trusted", "Live", "On"].includes(s) ? "active" : ["REJECTED", "FAILED", "SUSPENDED", "BLOCKED", "High", "At risk", "Off"].includes(s) ? "danger" : "pending");
const Status = ({ value, label }) => <span className={`status ${tone(value)}`}>{label || statusLabel(value)}</span>;

// ─── Needs your attention (overview) ───────────────────────────────────────
export function AttentionQueue() {
  const { loading, data, error, reload } = useLoad(adminApi.getAttention, [], 60_000);
  const items = (data?.items || []).filter((i) => i.count > 0);
  return <div className="data-card attention-card">
    <div className="data-card-head"><div><h3>Needs your attention</h3><span>{loading ? "Checking…" : items.length ? `${data.total} thing${data.total === 1 ? "" : "s"} waiting · updates every minute` : "Updates every minute"}</span></div>
      <button type="button" className="outline-btn" onClick={() => reload()}>Refresh</button></div>
    {error && <p className="danger-text">{error}</p>}
    {!loading && !error && items.length === 0 && <div className="empty-state"><h3>All clear</h3><p>Nothing is waiting for an administrator right now.</p></div>}
    <div className="attention-list">
      {items.map((it) => <Link key={it.key} to={it.link} className={`attention-item ${it.urgent ? "urgent" : ""}`}>
        <strong>{it.count}</strong>
        <span><b>{it.label}</b>{it.hint && <small>{it.hint}</small>}</span>
        <Icon name="arrow" size={14} />
      </Link>)}
    </div>
  </div>;
}

// ─── Verification (sellers and suppliers) ──────────────────────────────────
const QUICK_REASONS = ["The logo is missing or unclear.", "The phone number could not be reached.", "The business description is too short to understand what you sell.", "The location is incomplete: add your district and sector.", "The business name does not match the documents or products."];

function checklist(p, kind) {
  const loc = typeof p.location === "object" && p.location ? Object.values(p.location).filter(Boolean).join(", ") : p.location;
  return [
    ["Business name", p.businessName],
    ["Phone", p.phone],
    ["Email", p.email],
    ["Description", (p.description || "").length >= 20 ? p.description : ""],
    ["Logo", p.logoUrl],
    ["Category", p.category],
    ["Location", loc],
  ];
}

function ReviewModal({ kind, profile, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  const history = useLoad(() => adminApi.getAuditLogs({ targetId: profile._id || profile.id, pageSize: 10 }), [profile]);
  const items = checklist(profile, kind);
  const missing = items.filter(([, v]) => !v).map(([k]) => k);
  const id = profile._id || profile.id;
  const decide = async (decision) => {
    if (decision === "REJECTED" && reason.trim().length < 5) { setNotice({ ok: false, text: `Write what the ${kind} must fix. They will see it.` }); return; }
    setBusy(decision); setNotice(null);
    try {
      if (kind === "seller") await adminApi.verifyVendor(id, { decision, reason });
      else await adminApi.verifySupplier(id, { decision, reason });
      onDone(decision === "VERIFIED" ? `${profile.businessName} is verified and has been notified.` : `${profile.businessName} was told what to fix.`);
    } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); setBusy(""); }
  };
  const setStatus = async (status) => {
    if (!window.confirm(status === "ACTIVE" ? `Reactivate ${profile.businessName}?` : `Suspend ${profile.businessName}? They cannot sell${kind === "supplier" ? " to vendors" : ""} while suspended.`)) return;
    setBusy(status);
    try {
      if (kind === "seller") await adminApi.updateVendorStatus(id, { status });
      else await adminApi.updateSupplierStatus(id, { status });
      onDone(status === "ACTIVE" ? `${profile.businessName} is active again.` : `${profile.businessName} is suspended.`);
    } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); setBusy(""); }
  };
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal review-modal" role="dialog" aria-modal="true" aria-label={`Review ${profile.businessName}`} onMouseDown={(e) => e.stopPropagation()}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
      <span className="eyebrow">{kind === "seller" ? "SELLER" : "SUPPLIER"} VERIFICATION</span>
      <div className="review-head">
        <ProductImage src={profile.logoUrl} alt="" />
        <div><h2>{profile.businessName}</h2><small>{profile.user?.Fullname} · joined {formatDate(profile.createdAt)}</small><div><Status value={profile.verificationStatus} /> {profile.status !== "ACTIVE" && <Status value={profile.status} />}</div></div>
      </div>
      <Notice notice={notice} />
      {missing.length === 0
        ? <div className="form-alert success">The profile is complete. Check the details look genuine before verifying.</div>
        : <div className="form-alert error">Missing or too short: {missing.join(", ")}.</div>}
      <ul className="review-checklist">
        {items.map(([k, v]) => <li key={k} className={v ? "ok" : "missing"}><span aria-hidden="true">{v ? "✓" : "✗"}</span><b>{k}</b><small>{v ? String(v).slice(0, 140) : "Not provided"}</small></li>)}
        {kind === "seller" && <li className="info"><span aria-hidden="true">i</span><b>Products</b><small>{profile.productCount ? `${profile.productCount} listed` : "None listed yet (not needed to verify)"}</small></li>}
      </ul>
      {kind === "seller" && profile.slug && <p className="tiny"><a href={`/vendors/${profile.slug}`} target="_blank" rel="noreferrer">Open the public store page ↗</a></p>}
      {profile.verificationNote && <div className="verified-box"><b>Last rejection reason</b><p>{profile.verificationNote}</p></div>}

      <label className="field"><span>Reason if you reject (the {kind} sees this)</span>
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What should they fix?" maxLength={500} />
      </label>
      <div className="reason-chips">{(missing.length ? [`Please complete: ${missing.join(", ")}.`, ...QUICK_REASONS] : QUICK_REASONS).map((r) => <button type="button" key={r} className="chip-btn" onClick={() => setReason(r)}>{r}</button>)}</div>

      <div className="modal-actions">
        <button type="button" className="gradient-btn" disabled={!!busy} onClick={() => decide("VERIFIED")}>{busy === "VERIFIED" ? "Verifying…" : "Verify"}</button>
        <button type="button" className="outline-btn" disabled={!!busy} onClick={() => decide("REJECTED")}>{busy === "REJECTED" ? "Sending…" : "Reject with reason"}</button>
        {profile.status === "ACTIVE"
          ? <button type="button" className="danger-btn" disabled={!!busy} onClick={() => setStatus("SUSPENDED")}>Suspend</button>
          : <button type="button" className="outline-btn" disabled={!!busy} onClick={() => setStatus("ACTIVE")}>Reactivate</button>}
      </div>
      {history.data?.data?.length > 0 && <div className="review-history"><h4>History</h4>{history.data.data.map((h) => <small key={h.id}>{dateTime(h.at)} · {h.actor}: {h.action}{h.detail?.reason ? ` (“${h.detail.reason}”)` : ""}</small>)}</div>}
    </div>
  </div>;
}

function VerificationList({ kind }) {
  const [tab, setTab] = useTab("PENDING");
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState(null);
  const [notice, setNotice] = useState(null);
  const fetch = kind === "seller" ? adminApi.getVendors : adminApi.getSuppliers;
  const list = useLoad(() => fetch({ page, pageSize: 20, ...(tab !== "ALL" ? { verificationStatus: tab } : {}) }), [tab, page, kind]);
  const counts = useLoad(() => Promise.all(["PENDING", "VERIFIED", "REJECTED"].map((s) => fetch({ verificationStatus: s, pageSize: 1 }).then((r) => r.meta?.total || 0))), [kind, notice]);
  const [pending, verified, rejected] = counts.data || [];
  const rows = list.data?.data || [];
  const done = (text) => { setReviewing(null); setNotice({ ok: true, text }); list.reload(); };
  return <>
    <Notice notice={notice} />
    <div className="data-card">
      <div className="data-card-head"><div><h3>{kind === "seller" ? "Sellers" : "Suppliers"}</h3><span>Review new and updated profiles. They are notified of your decision by message, SMS and email.</span></div></div>
      <Tabs label="Verification status" value={tab} onChange={(t) => { setTab(t); setPage(1); }} tabs={[["PENDING", "Waiting", pending], ["VERIFIED", "Verified", verified], ["REJECTED", "Needs changes", rejected], ["ALL", "All"]]} />
      {list.loading ? <Loading what={kind === "seller" ? "sellers" : "suppliers"} /> : list.error ? <Failed error={list.error} retry={list.reload} /> : rows.length === 0
        ? <div className="empty-state"><h3>{tab === "PENDING" ? "Nobody is waiting" : "No profiles here"}</h3><p>{tab === "PENDING" ? "New profiles appear here, and you also get a notification." : ""}</p></div>
        : <div className="orders-list">{rows.map((p) => {
          const missing = checklist(p, kind).filter(([, v]) => !v).length;
          return <div className="order-row with-logo" key={p._id || p.id}>
            <ProductImage src={p.logoUrl} alt="" className="row-logo" />
            <div className="order-row-main"><b>{p.businessName}</b><small>{p.user?.Fullname} · {p.email} · {p.phone}</small>
              <small>{p.category || "No category"}{kind === "seller" ? ` · ${p.productCount || 0} products` : ""} · updated {formatDate(p.updatedAt)}</small>
              {p.verificationNote && <small className="danger-text">Asked to fix: {p.verificationNote}</small>}</div>
            <div className="order-row-meta"><Status value={p.verificationStatus} label={p.verificationStatus === "PENDING" ? "Waiting" : undefined} />{p.status !== "ACTIVE" && <Status value={p.status} />}{missing > 0 && <small>{missing} item{missing === 1 ? "" : "s"} missing</small>}</div>
            <div className="order-row-actions"><button type="button" className={p.verificationStatus === "PENDING" ? "gradient-btn" : "outline-btn"} onClick={() => setReviewing(p)}>{p.verificationStatus === "PENDING" ? "Review" : "Open"}</button></div>
          </div>;
        })}</div>}
      {(list.data?.meta?.total || 0) > 20 && <Pagination page={page} setPage={setPage} total={list.data.meta.total} perPage={20} />}
    </div>
    {reviewing && <ReviewModal kind={kind} profile={reviewing} onClose={() => setReviewing(null)} onDone={done} />}
  </>;
}

export function AdminVendors() {
  return <DashboardLayout admin>
    <Head eyebrow="PEOPLE & STORES" title="Sellers" desc="Verify sellers, see what is missing from their profile, and suspend or reactivate stores." />
    <VerificationList kind="seller" />
  </DashboardLayout>;
}

// ─── Suppliers: accounts, supply requests, payouts ─────────────────────────
const WHOLESALE_LABEL = { PENDING_PAYMENT: "Waiting for payment", ESCROW_HELD: "Paid · to ship", SHIPPED: "Shipped", DELIVERED: "Delivered", CONFIRMED_RELEASED: "Completed", DISPUTED: "Problem reported", CANCELLED: "Cancelled" };

// Every wholesale order; disputes are decided here (pay the supplier or refund the vendor).
function WholesaleOversight({ onChanged }) {
  const [status, setStatus] = useState("DISPUTED");
  const { loading, data, error, reload } = useLoad(() => wholesaleApi.adminList(status ? { status } : {}), [status]);
  const [note, setNote] = useState({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  const rows = data?.orders || [];
  const decide = async (o, decision) => {
    if (!window.confirm(decision === "RELEASE" ? `Pay ${partyOf(o.supplier)} ${money(o.totalAmount)} (minus commission)?` : `Refund ${partyOf(o.vendor)} ${money(o.totalAmount)}?`)) return;
    setBusy(o._id); setNotice(null);
    try { const r = await wholesaleApi.adminResolve(o._id, decision, note[o._id] || ""); setNotice({ ok: true, text: r.message }); reload(); onChanged?.(); }
    catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(""); }
  };
  return <div className="data-card">
    <div className="data-card-head"><div><h3>Wholesale orders</h3><span>Vendors buying stock from suppliers. MVEC holds the money until the vendor confirms receipt; problems are decided here.</span></div>
      <select className="inline-table-input" aria-label="Show" value={status} onChange={(e) => setStatus(e.target.value)}><option value="DISPUTED">Problem reported</option><option value="ESCROW_HELD">Paid, not shipped</option><option value="SHIPPED">Shipped</option><option value="PENDING_PAYMENT">Waiting for payment</option><option value="">All</option></select></div>
    <Notice notice={notice} />
    {loading ? <Loading what="wholesale orders" /> : error ? <Failed error={error} retry={reload} /> : rows.length === 0 ? <div className="empty-state"><h3>{status === "DISPUTED" ? "No reported problems" : "No orders here"}</h3></div>
      : <div className="orders-list">{rows.map((o) => <div className="order-row supply-row" key={o._id}>
        <div className="order-row-main"><b>{o.orderNumber} · {partyOf(o.vendor)} ← {partyOf(o.supplier)}</b>
          {(o.items || []).map((i, k) => <small key={k}>{i.quantity} {i.unit || ""} × {i.productName} at {money(i.unitPrice)}</small>)}
          {o.disputeReason && <small className="danger-text">Problem: {o.disputeReason}</small>}
          {o.cancelReason && <small>Cancelled: {o.cancelReason}</small>}
          <small>Placed {formatDate(o.createdAt)}{o.paidAt ? ` · paid ${formatDate(o.paidAt)}` : ""}{o.shippedAt ? ` · shipped ${formatDate(o.shippedAt)}` : ""}</small></div>
        <div className="order-row-meta"><strong>{money(o.totalAmount)}</strong><Status value={o.status === "CONFIRMED_RELEASED" ? "ACTIVE" : o.status === "DISPUTED" || o.status === "CANCELLED" ? "FAILED" : "PENDING"} label={WHOLESALE_LABEL[o.status]} /></div>
        {o.status === "DISPUTED" && <div className="order-row-actions">
          <input className="inline-table-input" placeholder="Decision note (both sides see it)" aria-label={`Note for ${o.orderNumber}`} value={note[o._id] || ""} onChange={(e) => setNote({ ...note, [o._id]: e.target.value })} />
          <button type="button" className="gradient-btn" disabled={busy === o._id} onClick={() => decide(o, "RELEASE")}>Pay supplier</button>
          <button type="button" className="outline-btn" disabled={busy === o._id} onClick={() => decide(o, "REFUND")}>Refund vendor</button>
        </div>}
      </div>)}</div>}
  </div>;
}
const partyOf = (p) => p?.companyName || p?.Fullname || "—";

// Vendors' quote requests and how many quotes each got (read-only).
function QuoteOversight() {
  const { loading, data, error, reload } = useLoad(() => quotesApi.adminList({}), []);
  const rows = data?.requests || [];
  return <div className="data-card">
    <div className="data-card-head"><div><h3>Quote requests</h3><span>Vendors ask for goods; verified suppliers quote; accepted quotes become wholesale orders. Nothing to approve here.</span></div></div>
    {loading ? <Loading what="quote requests" /> : error ? <Failed error={error} retry={reload} /> : <SmartTable rows={rows} rowKey={(r) => r.id} empty="No quote requests yet." searchPlaceholder="Search requests…"
      columns={[
        { key: "reference", label: "Request", render: (r) => <><b>{r.reference}</b><small className="block-small">{(r.lines || []).map((l) => `${l.units} ${l.unit} ${l.product}`).join(", ")}</small></> },
        { key: "vendor", label: "Vendor", render: (r) => partyOf(r.vendor) },
        { key: "category", label: "Category" },
        { key: "quoteCount", label: "Quotes" },
        { key: "neededBy", label: "Needed by", render: (r) => formatDate(r.neededBy) },
        { key: "status", label: "Status", render: (r) => <Status value={r.status === "AWARDED" ? "ACTIVE" : r.status === "OPEN" ? "PENDING" : "FAILED"} label={{ OPEN: "Open", AWARDED: "Quote accepted", CANCELLED: "Cancelled", EXPIRED: "Expired" }[r.status]} /> },
      ]} />}
  </div>;
}

function SupplierPayouts({ onChanged }) {
  const { loading, data, error, reload } = useLoad(adminApi.getSupplierPayouts, []);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  const rows = data?.payouts || [];
  const act = async (p, status) => {
    let reason = "";
    if (status === "REJECTED") { reason = window.prompt("Why is this payout declined? The amount goes back to the supplier's balance.") || ""; if (!reason.trim()) return; }
    if (status === "PAID" && !window.confirm(`Confirm you sent ${money(p.amount)} to ${p.destination || "the supplier"}?`)) return;
    setBusy(p._id || p.id); setNotice(null);
    try {
      await adminApi.updateSupplierPayout(p._id || p.id, { status, reason });
      setNotice({ ok: true, text: status === "PAID" ? "Marked as paid. The supplier was notified." : status === "PROCESSING" ? "Marked as being sent." : "Declined; the money is back in the supplier's balance." });
      reload(); onChanged?.();
    } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(""); }
  };
  return <div className="data-card">
    <div className="data-card-head"><div><h3>Supplier bank payouts</h3><span>Mobile money payouts are sent automatically. Bank transfers: send from MVEC's account, then mark paid. The supplier is notified.</span></div><button type="button" className="outline-btn" onClick={() => reload()}>Refresh</button></div>
    <Notice notice={notice} />
    {loading ? <Loading what="payouts" /> : error ? <Failed error={error} retry={reload} /> : rows.length === 0 ? <div className="empty-state"><h3>No payouts waiting</h3></div>
      : <div className="orders-list">{rows.map((p) => <div className="order-row" key={p._id || p.id}>
        <div className="order-row-main"><b>{p.supplierName || p.accountName || "Supplier"}</b><small>{p.bankName} · {p.destination}{p.accountName ? ` · ${p.accountName}` : ""}</small><small>{p.payoutNumber} · requested {formatDate(p.requestedAt)}{p.note ? ` · “${p.note}”` : ""}</small></div>
        <div className="order-row-meta"><strong>{money(p.amount)}</strong><Status value={p.status} label={p.status === "PROCESSING" ? "Being sent" : "Waiting"} /></div>
        <div className="order-row-actions">
          {p.status === "PENDING" && <button type="button" className="outline-btn" disabled={busy === (p._id || p.id)} onClick={() => act(p, "PROCESSING")}>Sending now</button>}
          <button type="button" className="gradient-btn" disabled={busy === (p._id || p.id)} onClick={() => act(p, "PAID")}>Mark paid</button>
          <button type="button" className="outline-btn" disabled={busy === (p._id || p.id)} onClick={() => act(p, "REJECTED")}>Decline</button>
        </div>
      </div>)}</div>}
  </div>;
}

export function AdminSuppliers() {
  const [tab, setTab] = useTab("accounts");
  const attention = useLoad(adminApi.getAttention, []);
  const c = Object.fromEntries((attention.data?.items || []).map((i) => [i.key, i.count]));
  return <DashboardLayout admin>
    <Head eyebrow="PEOPLE & STORES" title="Suppliers" desc="Verify suppliers, follow wholesale orders and quote requests, decide wholesale problems and send bank payouts." />
    <Tabs label="Supplier work" value={tab} onChange={setTab} tabs={[["accounts", "Verification", c.suppliers], ["wholesale", "Wholesale orders", c.wholesaleDisputes], ["quotes", "Quote requests"], ["payouts", "Bank payouts", c.supplierPayouts]]} />
    {tab === "wholesale" ? <WholesaleOversight onChanged={attention.reload} /> : tab === "quotes" ? <QuoteOversight /> : tab === "payouts" ? <SupplierPayouts onChanged={attention.reload} /> : <VerificationList kind="supplier" />}
  </DashboardLayout>;
}

// ─── Payments ──────────────────────────────────────────────────────────────
const GATEWAY = { PAYPACK: "Mobile money", FLUTTERWAVE: "Card", KPAY: "K-Pay", MOMO: "MTN MoMo", AIRTEL: "Airtel Money" };
const METHOD = { MOMO: "MTN MoMo", AIRTEL: "Airtel Money", CARD: "Card", SPENN: "SPENN", CASH_ON_DELIVERY: "Cash" };

export function AdminPaymentsPage() {
  const { search } = useLocation();
  const [status, setStatus] = useState(new URLSearchParams(search).get("status") || "");
  const [gateway, setGateway] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { loading, data, error, reload } = useLoad(() => adminApi.getPayments({ page, pageSize: 25, status, gateway, q: query }), [page, status, gateway, query]);
  const s = data?.summary;
  const rows = data?.data || [];
  return <DashboardLayout admin>
    <Head eyebrow="ORDERS & PAYMENTS" title="Payments" desc="Every payment attempt from buyers and sellers, from every provider." />
    {s && <div className="metric-grid">
      <Metric icon="wallet" label="Received" value={money(s.successful)} sub={`${s.successfulCount} payments · last ${s.days} days`} />
      <Metric icon="chart" label="Waiting for the buyer" value={money(s.pending)} sub={`${s.pendingCount} not confirmed yet`} />
      <Metric icon="bell" label="Failed" value={s.failedCount} sub="Declined, timed out or cancelled" />
      <Metric icon="box" label="Refunded" value={money(s.refunded)} sub={`Provider fees ${money(s.fees)}`} />
    </div>}
    {s && Object.keys(s.byGateway).length > 0 && <div className="data-card"><div className="data-card-head"><div><h3>Where the money came in</h3><span>Successful payments by provider</span></div></div>
      {Object.entries(s.byGateway).map(([g, v]) => <div className="progress-row" key={g}><span>{GATEWAY[g] || g}</span><div><i style={{ width: `${Math.round((v / Math.max(...Object.values(s.byGateway))) * 100)}%` }} /></div><b>{money(v)}</b></div>)}
    </div>}
    <div className="data-card">
      <div className="data-card-head"><div><h3>All payments</h3><span>{data?.meta?.total ?? 0} payments</span></div>
        <form className="filter-row" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }}>
          <input className="inline-table-input" placeholder="Order number or reference" aria-label="Search payments" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="inline-table-input" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="SUCCESS">Received</option><option value="PENDING">Waiting</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option></select>
          <select className="inline-table-input" aria-label="Provider" value={gateway} onChange={(e) => { setGateway(e.target.value); setPage(1); }}><option value="">All providers</option><option value="PAYPACK">Mobile money</option><option value="FLUTTERWAVE">Card</option><option value="KPAY">K-Pay</option></select>
          <button type="submit" className="outline-btn">Search</button>
        </form>
      </div>
      {loading ? <Loading what="payments" /> : error ? <Failed error={error} retry={reload} /> : <SmartTable rows={rows} rowKey={(r) => r.id} pageSize={25} enableTools={false} empty="No payments match."
        columns={[
          { key: "createdAt", label: "When", render: (r) => dateTime(r.createdAt) },
          { key: "order", label: "For", render: (r) => (r.order ? <Link to={`/admin/orders/${r.order.id}`}>{r.order.orderNumber}</Link> : r.purpose) },
          { key: "payer", label: "Payer", render: (r) => r.payer?.name || "—" },
          { key: "method", label: "Method", render: (r) => `${r.gateway === "KPAY" ? "K-Pay · " : ""}${METHOD[r.method] || r.method}` },
          { key: "amount", label: "Amount", render: (r) => money(r.amount) },
          { key: "status", label: "Status", render: (r) => <Status value={r.status} label={{ SUCCESS: "Received", PENDING: "Waiting", PROCESSING: "Waiting" }[r.status]} /> },
        ]} />}
      {(data?.meta?.total || 0) > 25 && <Pagination page={page} setPage={setPage} total={data.meta.total} perPage={25} />}
    </div>
  </DashboardLayout>;
}

// ─── MVEC earnings ─────────────────────────────────────────────────────────
// MVEC's own balance. MVEC does not send this money itself: an admin moves it
// from the payment provider's account to the company bank and records it here.
function MvecWallet() {
  const wallet = useLoad(() => Promise.all([adminApi.getMvecWallet(), adminApi.getMvecWithdrawals()]), []);
  const [form, setForm] = useState({ amount: "", destination: "", note: "" });
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const w = wallet.data?.[0]?.wallet;
  const history = wallet.data?.[1]?.payouts || [];
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setNotice(null);
    try { const r = await adminApi.recordMvecWithdrawal({ ...form, amount: Number(form.amount) }); setNotice({ ok: true, text: r.message }); setForm({ amount: "", destination: "", note: "" }); setOpen(false); wallet.reload(); }
    catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(false); }
  };
  return <div className="data-card">
    <div className="data-card-head"><div><h3>MVEC wallet</h3><span>What MVEC keeps after sellers, suppliers, affiliates and provider fees, plus ad and subscription income.</span></div>
      {w && Number(w.availableBalance) > 0 && <button type="button" className="outline-btn" onClick={() => setOpen(!open)}>Record a withdrawal</button>}</div>
    <Notice notice={notice} />
    {wallet.loading ? <Loading what="the wallet" /> : wallet.error ? <Failed error={wallet.error} retry={wallet.reload} /> : <div className="metric-grid">
      <Metric icon="wallet" label="Available" value={money(w?.availableBalance)} sub="From delivered orders" />
      <Metric icon="chart" label="Held until delivery" value={money(w?.pendingBalance)} sub="Becomes available on delivery" />
      <Metric icon="box" label="Withdrawn" value={money(w?.totalWithdrawn)} sub={`${history.length} recorded`} />
    </div>}
    {open && <form onSubmit={save}>
      <p className="tiny">The money sits in MVEC's payment provider accounts (Paypack, Flutterwave, K-Pay). Move it to the company bank there, then record it here so the books match.</p>
      <div className="form-row"><label className="field"><span>Amount moved (RWF)</span><input type="number" min="1" max={w?.availableBalance} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label>
        <label className="field"><span>Moved to</span><input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="e.g. BK account 000400012345" required /></label></div>
      <label className="field"><span>Note (optional)</span><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Provider reference, purpose…" /></label>
      <div className="row-actions"><button type="button" className="outline-btn" onClick={() => setOpen(false)}>Cancel</button><button className="gradient-btn" disabled={busy}>{busy ? "Saving…" : "Record withdrawal"}</button></div>
    </form>}
    {history.length > 0 && <div className="review-history"><h4>Recorded withdrawals</h4>{history.slice(0, 8).map((p) => <small key={p._id}>{formatDate(p.createdAt)} · {money(p.amount)} to {p.accountDetails?.accountNumber || p.accountNumber || "—"} · by {p.adminUser?.Fullname || "admin"}</small>)}</div>}
  </div>;
}

export function AdminEarnings() {
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  const { loading, data, error, reload } = useLoad(() => adminApi.getEarnings({ days, page, pageSize: 25 }), [days, page]);
  const t = data?.totals;
  return <DashboardLayout admin>
    <Head eyebrow="ORDERS & PAYMENTS" title="MVEC earnings" desc="What MVEC earns on every sale, and where the rest of the money goes." action={<Period value={days} onChange={(d) => { setDays(d); setPage(1); }} />} />
    <MvecWallet />
    {t && <>
      <div className="metric-grid">
        <Metric icon="chart" label="Sales" value={money(t.gross)} sub="Paid order lines, excluding refunds" />
        <Metric icon="wallet" label="MVEC commission" value={money(t.platformFee)} sub="From the commission rules" />
        <Metric icon="shop" label="MVEC keeps" value={money(t.mvecNet)} sub={`${money(t.released)} earned · ${money(t.held)} until delivery`} />
        <Metric icon="users" label="Sellers' share" value={money(t.sellers)} sub="After MVEC's fee; theirs to withdraw once delivered" />
      </div>
      {(t.adRevenue > 0 || t.subscriptionRevenue > 0) && <div className="metric-grid">
        <Metric icon="tag" label="Ad clicks" value={money(t.adRevenue)} sub="Sponsored products, MVEC income" />
        <Metric icon="wallet" label="Subscriptions" value={money(t.subscriptionRevenue)} sub="Premium plans, MVEC income" />
      </div>}
      <div className="data-card"><div className="data-card-head"><div><h3>Where MVEC's fee goes</h3><span>From {money(t.platformFee)} in fees</span></div></div>
        {[["Affiliates (paid by MVEC)", Math.max(0, t.affiliates - t.affiliatesPaidBySellers)], ["Payment provider fees", t.gatewayFees], ["MVEC keeps", t.mvecNet]].map(([label, v]) =>
          <div className="progress-row" key={label}><span>{label}</span><div><i style={{ width: `${t.platformFee ? Math.round((v / t.platformFee) * 100) : 0}%` }} /></div><b>{money(v)}</b></div>)}
        {t.affiliatesPaidBySellers > 0 && <p className="tiny">Sellers also paid affiliates {money(t.affiliatesPaidBySellers)} from their own share.</p>}
      </div>
    </>}
    <div className="data-card">
      <div className="data-card-head"><div><h3>Per order line</h3><span>{data?.meta?.total ?? 0} lines</span></div></div>
      {loading ? <Loading what="earnings" /> : error ? <Failed error={error} retry={reload} /> : <SmartTable rows={data?.data || []} rowKey={(r) => r.id} pageSize={25} enableTools={false} empty="No sales in this period." exportName="mvec-earnings"
        columns={[
          { key: "order", label: "Order", render: (r) => (r.order ? (r.order.kind === "Wholesale" ? <span>{r.order.orderNumber}<small className="block-small">Wholesale</small></span> : <Link to={`/admin/orders/${r.order.id}`}>{r.order.orderNumber}</Link>) : "—") },
          { key: "seller", label: "Paid to" },
          { key: "gross", label: "Sale", render: (r) => money(r.gross) },
          { key: "platformFee", label: "Commission", render: (r) => `${money(r.platformFee)}${r.rate ? ` (${r.rate}%)` : ""}` },
          { key: "affiliate", label: "Affiliate", render: (r) => (r.affiliate ? money(r.affiliate) : "—") },
          { key: "mvecNet", label: "MVEC keeps", render: (r) => money(r.mvecNet) },
          { key: "status", label: "Status", render: (r) => <Status value={r.status} label={{ HELD: "Until delivery", RELEASED: "Earned", ADMIN_HOLD: "On hold", REFUNDED: "Refunded", CANCELLED: "Cancelled" }[r.status]} /> },
        ]} />}
      {(data?.meta?.total || 0) > 25 && <Pagination page={page} setPage={setPage} total={data.meta.total} perPage={25} />}
    </div>
  </DashboardLayout>;
}

// ─── Ledger ────────────────────────────────────────────────────────────────
const ENTRY = { PAYMENT_RECEIVED: "Buyer payment received", PAYMENT_ESCROW_LOCK: "Buyer payment received", ESCROW_RELEASE_VENDOR: "Seller paid (delivery)", PLATFORM_COMMISSION_DEDUCTION: "MVEC commission", AFFILIATE_COMMISSION: "Affiliate commission", GATEWAY_FEE: "Payment provider fee", BUYER_REFUND: "Refund to buyer", PAYOUT_SENT: "Withdrawal sent", AD_BUDGET_RESERVED: "Ad budget reserved", AD_BUDGET_RETURNED: "Ad budget returned", AD_CLICK_REVENUE: "Ad click (MVEC income)", SUBSCRIPTION_FEE: "Subscription fee (MVEC income)", COURIER_FEE_PAYOUT: "Courier fee", ADMIN_MANUAL_ADJUSTMENT: "Correction" };
const ACCOUNT = { BUYER_PAYMENTS: "Buyer payments", ESCROW_HOLDING: "MVEC holding", PLATFORM_REVENUE: "MVEC revenue", ADMIN_REVENUE: "MVEC revenue", DEVELOPER_REVENUE: "MVEC revenue", VENDOR_PAYABLE: "Seller balances", SUPPLIER_PAYABLE: "Supplier balances", COURIER_PAYABLE: "Courier balances", AFFILIATE_COMMISSION: "Affiliate commission", GATEWAY_FEES: "Provider fees", AD_BUDGETS: "Ad budgets", BUYER_REFUND_HOLD: "Refunded to buyers", PAID_OUT: "Paid out" };
// What each balance means, in the order money flows.
const BALANCE_ROWS = [
  ["BUYER_PAYMENTS", "Total buyers have paid in (shown negative: it came from outside)"],
  ["ESCROW_HOLDING", "Held by MVEC until delivery"],
  ["VENDOR_PAYABLE", "Earned by sellers and suppliers, not yet withdrawn"],
  ["PLATFORM_REVENUE", "Earned by MVEC, not yet withdrawn"],
  ["AFFILIATE_COMMISSION", "Earned by affiliates, not yet withdrawn"],
  ["GATEWAY_FEES", "Payment provider fees"],
  ["AD_BUDGETS", "Ad budgets reserved, not yet spent"],
  ["BUYER_REFUND_HOLD", "Refunded to buyers"],
  ["PAID_OUT", "Sent out to sellers, suppliers, affiliates and MVEC"],
];

export function AdminLedgerPage() {
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const { loading, data, error, reload } = useLoad(() => adminApi.getLedger({ page, limit: 25, ...(type ? { entryType: type } : {}) }), [type, page]);
  return <DashboardLayout admin>
    <Head eyebrow="ORDERS & PAYMENTS" title="Financial ledger" desc="Every movement of money goes from one account to another and both balances change together, so the books always add up. Entries are written automatically and can't be edited." />
    {data?.balances && <div className="data-card">
      <div className="data-card-head"><div><h3>Where the money is</h3><span>Real money sits in MVEC's payment provider account; this says whose it is.</span></div>
        <em className={"status " + (data.balanced ? "active" : "warning")}>{data.balanced ? "Books balance" : "Books do not balance"}</em></div>
      <div className="ledger-balances">{BALANCE_ROWS.map(([k, label]) => <div key={k}><span>{ACCOUNT[k]}<small>{label}</small></span><b>{money(k === "PLATFORM_REVENUE" ? (data.balances.PLATFORM_REVENUE || 0) + (data.balances.ADMIN_REVENUE || 0) + (data.balances.DEVELOPER_REVENUE || 0) : k === "VENDOR_PAYABLE" ? (data.balances.VENDOR_PAYABLE || 0) + (data.balances.SUPPLIER_PAYABLE || 0) : data.balances[k] || 0)}</b></div>)}</div>
      <p className="tiny">Should match your Paypack balance: buyer payments − refunds − money paid out.</p>
    </div>}
    <div className="data-card">
      <div className="data-card-head"><div><h3>Entries</h3><span>{data?.total ?? 0} entries</span></div>
        <select className="inline-table-input" aria-label="Entry type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">All entries</option>{Object.entries(ENTRY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      {loading ? <Loading what="the ledger" /> : error ? <Failed error={error} retry={reload} /> : <SmartTable rows={data?.entries || []} rowKey={(r) => r._id} pageSize={25} enableTools={false} empty="No ledger entries yet." exportName="mvec-ledger"
        columns={[
          { key: "createdAt", label: "When", render: (r) => dateTime(r.createdAt) },
          { key: "entryType", label: "Movement", render: (r) => ENTRY[r.entryType] || statusLabel(r.entryType) },
          { key: "from", label: "From → to", render: (r) => `${ACCOUNT[r.debitAccount?.accountType] || "—"} → ${ACCOUNT[r.creditAccount?.accountType] || "—"}` },
          { key: "order", label: "Order", render: (r) => (r.relatedOrder ? <Link to={`/admin/orders/${r.relatedOrder._id || r.relatedOrder}`}>{r.relatedOrder.orderNumber || "Open"}</Link> : "—") },
          { key: "amount", label: "Amount", render: (r) => money(r.amount) },
        ]} />}
      {(data?.total || 0) > 25 && <Pagination page={page} setPage={setPage} total={data.total} perPage={25} />}
    </div>
  </DashboardLayout>;
}

// ─── Analytics ─────────────────────────────────────────────────────────────
const ROLE = { buyer: "Buyers", vendor: "Sellers", supplier: "Suppliers", affiliate: "Affiliates", delivery: "Couriers", super_admin: "Admins", developer: "Developers" };

function Bars({ series }) {
  const max = Math.max(1, ...series.map((d) => d.gmv));
  return <div className="bar-chart" role="img" aria-label="Daily sales">
    {series.map((d) => <div key={d.day} className="bar" title={`${d.day}: ${money(d.gmv)} · ${d.orders} orders`}><i style={{ height: `${Math.max(2, Math.round((d.gmv / max) * 100))}%` }} /></div>)}
  </div>;
}
function Breakdown({ title, sub, entries, format = (v) => v }) {
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return <div className="data-card"><div className="data-card-head"><div><h3>{title}</h3>{sub && <span>{sub}</span>}</div></div>
    {entries.length === 0 ? <p className="tiny">Nothing yet in this period.</p> : entries.map(([k, v]) => <div className="progress-row" key={k}><span>{k}</span><div><i style={{ width: `${Math.round((v / max) * 100)}%` }} /></div><b>{format(v)}</b></div>)}
  </div>;
}

export function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const { loading, data, error, reload } = useLoad(() => adminApi.getAnalytics({ days }), [days]);
  const t = data?.totals;
  return <DashboardLayout admin>
    <Head eyebrow="INSIGHTS" title="Marketplace analytics" desc="Sales, orders and growth from real orders. Refunded orders are left out of sales." action={<Period value={days} onChange={setDays} />} />
    {loading && !data ? <Loading what="analytics" /> : error ? <Failed error={error} retry={reload} /> : t && <>
      <div className="metric-grid">
        <Metric icon="chart" label="Sales" value={money(t.gmv)} sub={t.gmvChange === null ? "No sales in the period before" : `${t.gmvChange >= 0 ? "▲" : "▼"} ${Math.abs(t.gmvChange)}% vs the period before`} />
        <Metric icon="cart" label="Paid orders" value={t.paidOrders} sub={`${t.orders} placed · ${t.conversion}% paid`} />
        <Metric icon="wallet" label="Average order" value={money(t.averageOrder)} sub={`MVEC kept ${money(t.mvecEarned)}`} />
        <Metric icon="users" label="New accounts" value={t.newUsers} sub={`Refund rate ${pct(t.refundRate)} · ${t.disputes} dispute${t.disputes === 1 ? "" : "s"}`} />
      </div>
      <div className="data-card"><div className="data-card-head"><div><h3>Daily sales</h3><span>Hover a bar to see the day</span></div></div><Bars series={data.series} /></div>
      <div className="dash-grid">
        <Breakdown title="Top sellers" sub="By sales" entries={data.topSellers.map((v) => [v.name, v.sales])} format={money} />
        <Breakdown title="Top products" sub="Product sales, before delivery fees (units sold in brackets)" entries={data.topProducts.map((v) => [`${v.name} (${v.units})`, v.sales])} format={money} />
      </div>
      <div className="dash-grid">
        <Breakdown title="How buyers pay" entries={Object.entries(data.paymentMix)} format={money} />
        <Breakdown title="Orders by status" entries={Object.entries(data.statusBreakdown).map(([k, v]) => [statusLabel(k), v])} />
      </div>
      <Breakdown title="New accounts" sub="By type" entries={Object.entries(data.newUsers).map(([k, v]) => [ROLE[k] || k, v])} />
    </>}
  </DashboardLayout>;
}

// ─── Risk ──────────────────────────────────────────────────────────────────
export function AdminRisk() {
  const { loading, data, error, reload } = useLoad(adminApi.getRisk, [], 120_000);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  const rows = data?.signals || [];
  const report = async (s, status) => {
    const adminNotes = status === "RESOLVED" || status === "REJECTED" ? window.prompt("Add a note for the record (optional)") || "" : "";
    setBusy(s.id);
    try { await adminApi.updateAbuseReport(s.reportId, { status, adminNotes }); setNotice({ ok: true, text: "Report updated." }); reload(); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(""); }
  };
  const levels = ["High", "Medium", "Low"].map((l) => [l, rows.filter((r) => r.level === l).length]);
  return <DashboardLayout admin>
    <Head eyebrow="PLATFORM" title="Fraud & risk" desc="Warning signs found automatically in payments, refunds, disputes, deliveries, affiliate sales and abuse reports. The list updates by itself." action={<button type="button" className="outline-btn" onClick={() => reload()}>Check again</button>} />
    <Notice notice={notice} />
    <div className="metric-grid">{levels.map(([l, n]) => <Metric key={l} icon="bell" label={`${l} risk`} value={n} sub={l === "High" ? "Act today" : l === "Medium" ? "Look this week" : "Keep an eye on"} />)}</div>
    <div className="data-card">
      {loading ? <Loading what="risk signals" /> : error ? <Failed error={error} retry={reload} /> : rows.length === 0 ? <div className="empty-state"><h3>No warning signs</h3><p>Checked: repeated failed payments, refunds and disputes per seller, late shipping, reversed affiliate sales and abuse reports.</p></div>
        : <div className="orders-list">{rows.map((s) => <div className="order-row" key={s.id}>
          <div className="order-row-main"><b>{s.partyName}{s.partyRole ? ` · ${ROLE[s.partyRole]?.replace(/s$/, "") || s.partyRole}` : ""}</b><small>{s.area}: {s.signal}</small></div>
          <div className="order-row-meta"><Status value={s.level} label={`${s.level} risk`} /></div>
          <div className="order-row-actions">
            {s.reportId && s.reportStatus === "PENDING" && <button type="button" className="outline-btn" disabled={busy === s.id} onClick={() => report(s, "INVESTIGATE")}>Investigating</button>}
            {s.reportId && <><button type="button" className="gradient-btn" disabled={busy === s.id} onClick={() => report(s, "RESOLVED")}>Resolved</button><button type="button" className="outline-btn" disabled={busy === s.id} onClick={() => report(s, "REJECTED")}>Not a problem</button></>}
            {s.link && <Link className="outline-btn" to={s.link}>Open</Link>}
          </div>
        </div>)}</div>}
    </div>
  </DashboardLayout>;
}

// ─── Trust scores ──────────────────────────────────────────────────────────
export function AdminTrust() {
  const { loading, data, error, reload } = useLoad(adminApi.getTrust, []);
  const rows = data?.data || [];
  return <DashboardLayout admin>
    <Head eyebrow="INSIGHTS" title="Seller trust scores" desc="Out of 100, from each seller's finished orders in the last 90 days: delivered (50), not refunded (20), no disputes (20) and buyer rating (10). Sellers with fewer than 3 finished orders show as New." />
    <div className="metric-grid">{["Trusted", "Watch", "At risk", "New"].map((b) => <Metric key={b} icon="shop" label={b} value={rows.filter((r) => r.band === b).length} sub={{ Trusted: "80 and above", Watch: "60 to 79", "At risk": "Below 60", New: "Not enough orders yet" }[b]} />)}</div>
    <div className="data-card">
      {loading ? <Loading what="trust scores" /> : error ? <Failed error={error} retry={reload} /> : <SmartTable rows={rows} rowKey={(r) => r.id} pageSize={20} searchPlaceholder="Search sellers…" exportName="mvec-trust-scores" empty="No sellers yet."
        columns={[
          { key: "name", label: "Seller", render: (r) => <b>{r.name}</b> },
          { key: "score", label: "Score", render: (r) => (r.score === null ? "—" : r.score) },
          { key: "band", label: "Band", render: (r) => <Status value={r.band} label={r.band} /> },
          { key: "orders", label: "Orders (90 days)", render: (r) => `${r.orders}${r.inProgress ? ` · ${r.inProgress} in progress` : ""}` },
          { key: "completion", label: "Delivered", render: (r) => (r.finished ? pct(r.completion) : "—") },
          { key: "refundRate", label: "Refunded", render: (r) => (r.finished ? pct(r.refundRate) : "—") },
          { key: "rating", label: "Rating", render: (r) => (r.rating ? `★ ${r.rating.toFixed(1)}` : "No reviews") },
        ]} />}
    </div>
  </DashboardLayout>;
}

// ─── Subscriptions ─────────────────────────────────────────────────────────
// The subscription program: off until MVEC has enough users. While off,
// nobody is charged and every seller/supplier has every tool.
function SubscriptionProgram() {
  const ops = useLoad(() => Promise.all([adminApi.getOperationsSettings(), adminApi.getPlanInfo()]), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  useEffect(() => { if (ops.data) { const s = ops.data[0].settings; setForm({ sellerPremiumPrice: s.sellerPremiumPrice, buyerPremiumPrice: s.buyerPremiumPrice, freeProductLimit: s.freeProductLimit }); } }, [ops.data]);
  if (ops.loading || !form) return <div className="data-card"><Loading what="the subscription program" /></div>;
  if (ops.error) return <div className="data-card"><Failed error={ops.error} retry={ops.reload} /></div>;
  const on = Boolean(ops.data[0].settings.subscriptionsEnabled);
  const info = ops.data[1];
  const save = async (patch, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setNotice(null);
    try { const r = await adminApi.updateOperationsSettings(patch); setNotice({ ok: true, text: r.message }); ops.reload(); }
    catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); }
    finally { setBusy(false); }
  };
  const field = (k, label, min, max) => <label className="field"><span>{label}</span><input type="number" min={min} max={max} step="1" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>;
  return <div className="data-card">
    <div className="data-card-head"><div><h3>Subscription program</h3><span>{on ? "On: sellers and suppliers on Free have the Free limits; Premium is paid monthly from their balance." : "Off: nobody is charged and every seller and supplier has every tool for free."}</span></div>
      <em className={"status " + (on ? "active" : "warning")}>{on ? "On" : "Off"}</em></div>
    {notice && <div className={`form-alert ${notice.ok ? "success" : "error"}`}>{notice.text}</div>}
    <div className="plan-compare">
      <div><h4>Free Seller</h4><strong>RWF 0</strong><small>For new and small sellers and suppliers</small><ul>{info.freeIncludes.map((x) => <li key={x}>{x}{x.startsWith("List products") ? ` (${form.freeProductLimit})` : ""}</li>)}</ul></div>
      <div className="recommended"><h4>Seller Premium <em>Recommended</em></h4><strong>{money(form.sellerPremiumPrice)}/month</strong><small>Paid from the seller's available balance</small><ul>{Object.values(info.premiumFeatures).map((x) => <li key={x}>{x}</li>)}</ul></div>
    </div>
    <div className="form-row">
      {field("sellerPremiumPrice", "Seller Premium (RWF / month)", 1000, 100000)}
      {field("buyerPremiumPrice", "Buyer ad-free (RWF / month)", 500, 100000)}
      {field("freeProductLimit", "Free listing limit (products)", 1, 10000)}
    </div>
    <div className="program-actions">
      <button type="button" className="outline-btn" disabled={busy} onClick={() => save({ sellerPremiumPrice: Number(form.sellerPremiumPrice), buyerPremiumPrice: Number(form.buyerPremiumPrice), freeProductLimit: Number(form.freeProductLimit) })}>{busy ? "Saving…" : "Save prices and limit"}</button>
      {on
        ? <button type="button" className="outline-btn" disabled={busy} onClick={() => save({ subscriptionsEnabled: false }, "Switch the subscription program off? Everyone gets every tool for free again and no renewals are charged. Active Premium plans keep their paid time.")}>Switch program off</button>
        : <button type="button" className="gradient-btn" disabled={busy} onClick={() => save({ subscriptionsEnabled: true }, `Switch the subscription program on? Free sellers and suppliers become limited to ${form.freeProductLimit} products and Premium tools need a ${money(form.sellerPremiumPrice)}/month plan. Tell your sellers before doing this.`)}>Switch program on</button>}
    </div>
  </div>;
}

export function AdminSubscriptionsPage() {
  const { loading, data, error, reload } = useLoad(() => Promise.all([adminApi.getVendorSubscriptions({ limit: 200 }), adminApi.getBuyerSubscriptions({ limit: 200 })]), []);
  const [vendors, buyers] = data ? [data[0].data || [], data[1].data || []] : [[], []];
  const paid = [...vendors, ...buyers].filter((s) => s.planKey === "PREMIUM" && s.status === "Active");
  const monthly = paid.reduce((sum, s) => sum + (s.billing === "Yearly" ? Number(s.price) / 12 : Number(s.price)), 0);
  const cols = [{ key: "holder", label: "Account" }, { key: "plan", label: "Plan" }, { key: "price", label: "Price", render: (r) => (r.price ? money(r.price) : "Free") }, { key: "billing", label: "Billing" }, { key: "renewal", label: "Renews" }, { key: "status", label: "Status", render: (r) => <Status value={r.status === "Active" ? "ACTIVE" : r.status} label={r.status} /> }];
  return <DashboardLayout admin>
    <Head eyebrow="GROWTH" title="Subscriptions" desc="Paid seller Premium and buyer ad-free plans. Plans renew and expire automatically." />
    <SubscriptionProgram />
    {loading ? <Loading what="subscriptions" /> : error ? <Failed error={error} retry={reload} /> : <>
      <div className="metric-grid">
        <Metric icon="shop" label="Sellers on Premium" value={vendors.filter((s) => s.planKey === "PREMIUM" && s.status === "Active").length} />
        <Metric icon="users" label="Buyers ad-free" value={buyers.filter((s) => s.planKey === "PREMIUM" && s.status === "Active").length} />
        <Metric icon="wallet" label="Monthly value" value={money(monthly)} sub="Active paid plans (yearly ÷ 12)" />
      </div>
      <div className="data-card"><div className="data-card-head"><div><h3>Sellers</h3><span>{vendors.length} subscriptions</span></div></div><SmartTable rows={vendors} rowKey={(r) => r.id} columns={cols} empty="No seller subscriptions yet." exportName="mvec-seller-subscriptions" /></div>
      <div className="data-card"><div className="data-card-head"><div><h3>Buyers</h3><span>{buyers.length} subscriptions</span></div></div><SmartTable rows={buyers} rowKey={(r) => r.id} columns={cols} empty="No buyer subscriptions yet." exportName="mvec-buyer-subscriptions" /></div>
    </>}
  </DashboardLayout>;
}

// ─── Platform settings (live) ──────────────────────────────────────────────
// Admin-set delay before sellers are paid automatically when the buyer stays silent.
function AutoReleaseSetting({ onSaved }) {
  const ops = useLoad(adminApi.getOperationsSettings, []);
  const [days, setDays] = useState("");
  const [replyDays, setReplyDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  useEffect(() => { if (ops.data?.settings) { setDays(String(ops.data.settings.autoReleaseDays)); setReplyDays(String(ops.data.settings.disputeResponseDays ?? 3)); } }, [ops.data]);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setNotice(null);
    try { await adminApi.updateOperationsSettings({ autoReleaseDays: Number(days), disputeResponseDays: Number(replyDays) }); setNotice({ ok: true, text: `Saved. ${Number(days) > 0 ? `Sellers are paid automatically ${days} day${Number(days) === 1 ? "" : "s"} after shipping if no problem is reported.` : "Automatic release is off."} Sellers have ${replyDays} day${Number(replyDays) === 1 ? "" : "s"} to answer a problem report before MVEC steps in.` }); onSaved?.(); }
    catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); }
    finally { setBusy(false); }
  };
  return <form className="data-card" onSubmit={save}>
    <h3>Paying sellers and problem reports</h3>
    <p className="tiny">If a buyer neither gives the delivery code nor reports a problem, the seller is paid automatically this many days after the order ships. Buyers are told when their order ships. A reported problem freezes the payment. Pickup orders wait for collection. 0 turns it off.</p>
    {notice && <div className={`form-alert ${notice.ok ? "success" : "error"}`}>{notice.text}</div>}
    {ops.loading ? <Loading what="the setting" /> : ops.error ? <Failed error={ops.error} retry={ops.reload} /> : <div className="form-row">
      <label className="field"><span>Pay sellers this many days after shipping</span><input type="number" min="0" max="30" step="1" value={days} onChange={(e) => setDays(e.target.value)} /></label>
      <label className="field"><span>Days a seller has to answer a problem report</span><input type="number" min="1" max="14" step="1" value={replyDays} onChange={(e) => setReplyDays(e.target.value)} /></label>
      <button className="gradient-btn" disabled={busy || days === "" || replyDays === ""}>{busy ? "Saving…" : "Save"}</button>
    </div>}
  </form>;
}

export function AdminPlatform() {
  const { loading, data, error, reload } = useLoad(adminApi.getPlatform, []);
  return <DashboardLayout admin>
    <Head eyebrow="PLATFORM" title="Platform settings" desc="How MVEC is set up right now, read live from the server." />
    {loading ? <Loading what="settings" /> : error ? <Failed error={error} retry={reload} /> : <>
      <div className="settings-grid">
        <div className="data-card"><h3>Fees</h3>{data.fees.map((f) => <div className="setting-line" key={f.label}><span><b>{f.label}</b><small>{f.detail}</small></span><strong>{f.value}</strong></div>)}</div>
        <div className="data-card"><h3>Rules</h3>{data.rules.map((f) => <div className="setting-line" key={f.label}><span><b>{f.label}</b></span><strong>{f.value}</strong></div>)}</div>
      </div>
      <div className="settings-grid"><AutoReleaseSetting onSaved={reload} /></div>
      <div className="settings-grid">
        <div className="data-card"><h3>Payment providers & messages</h3><p className="tiny">“Test mode” means payments succeed without real money. Add the keys to the server's .env to go live.</p>
          {data.integrations.map((i) => <div className="setting-line" key={i.label}><span><b>{i.label}</b><small>{i.env}</small></span><Status value={i.status} label={i.status} /></div>)}</div>
        <div className="data-card"><h3>Automatic jobs</h3><p className="tiny">Environment: {data.environment}</p>
          {data.jobs.map((j) => <div className="setting-line" key={j.label}><span><b>{j.label}</b>{j.detail && <small>{j.detail}</small>}</span><strong>{j.schedule}</strong></div>)}</div>
      </div>
      <div className="verified-box"><b>Change rates and shares</b><p>Commission per category, seller overrides, the affiliate share and who pays provider fees are all set on the Commission rules page.</p><Link className="gradient-btn" to="/admin/commission-rules">Open commission rules</Link></div>
    </>}
  </DashboardLayout>;
}

// ─── Audit log ─────────────────────────────────────────────────────────────
export function AdminAuditLog() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const { loading, data, error, reload } = useLoad(() => adminApi.getAuditLogs({ page, pageSize: 30, q: query, targetType: type }), [page, query, type]);
  const types = useMemo(() => data?.targetTypes || [], [data]);
  return <DashboardLayout admin>
    <Head eyebrow="PLATFORM" title="Audit log" desc="Every change an administrator makes is recorded here automatically: who, what and when. Entries cannot be edited or deleted." />
    <div className="data-card">
      <div className="data-card-head"><div><h3>Actions</h3><span>{data?.meta?.total ?? 0} recorded</span></div>
        <form className="filter-row" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }}>
          <input className="inline-table-input" placeholder="Search action or admin" aria-label="Search the audit log" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="inline-table-input" aria-label="About" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">Everything</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
          <button type="submit" className="outline-btn">Search</button>
        </form></div>
      {loading ? <Loading what="the audit log" /> : error ? <Failed error={error} retry={reload} /> : <SmartTable rows={data?.data || []} rowKey={(r) => r.id} pageSize={30} enableTools={false} empty="No admin actions recorded yet."
        columns={[
          { key: "at", label: "When", render: (r) => dateTime(r.at) },
          { key: "actor", label: "Admin" },
          { key: "action", label: "Action", render: (r) => <><b>{r.action}</b>{r.detail?.reason && <small className="block-small">“{r.detail.reason}”</small>}</> },
          { key: "targetType", label: "About", render: (r) => r.targetType || "—" },
        ]} />}
      {(data?.meta?.total || 0) > 30 && <Pagination page={page} setPage={setPage} total={data.meta.total} perPage={30} />}
    </div>
  </DashboardLayout>;
}

// ─── Commission rules ──────────────────────────────────────────────────────
const RULE_TYPES = [["CATEGORY", "Category rate"], ["VENDOR", "Seller override"], ["GLOBAL", "Default rate"]];
const typeLabel = (t, scope) => (t === "VENDOR" && scope === "WHOLESALE" ? "Supplier override" : RULE_TYPES.find(([v]) => v === t)?.[1]);
const EMPTY_RULE = { ruleType: "CATEGORY", scope: "RETAIL", targetCategory: "", targetVendor: "", rateValue: 5, priority: 0, name: "", isActive: true };

function useSellers() {
  return useLoad(() => adminApi.getVendors({ pageSize: 100 }).then((r) => (r.data || []).map((v) => ({ id: String(v.user?._id || v.user?.id || v.user), name: v.businessName })).filter((v) => v.id).sort((a, b) => a.name.localeCompare(b.name))), []);
}
function useSuppliers() {
  return useLoad(() => adminApi.getSuppliers({ pageSize: 100, verificationStatus: "VERIFIED" }).then((r) => (r.data || []).map((v) => ({ id: String(v.user?._id || v.user?.id || v.user), name: v.businessName })).filter((v) => v.id).sort((a, b) => a.name.localeCompare(b.name))), []);
}

function SellerSelect({ value, onChange, sellers, required, label = "Seller" }) {
  return <label className="field"><span>{label}{required ? " *" : ""}</span>
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{required ? "Choose a seller" : "Any seller"}</option>
      {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select></label>;
}

function RuleForm({ rule, sellers, maxRate, onClose, onSaved }) {
  const [form, setForm] = useState(rule ? { ...EMPTY_RULE, ...rule, targetCategory: rule.targetCategory?._id || rule.targetCategory || "", targetVendor: rule.targetVendor?._id || rule.targetVendor || "" } : EMPTY_RULE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    const payload = { ruleType: form.ruleType, scope: form.scope || "RETAIL", rateValue: Number(form.rateValue), priority: Number(form.priority) || 0, name: form.name, targetCategory: form.targetCategory || null, targetVendor: form.targetVendor || null, isActive: form.isActive };
    try {
      const res = rule?._id ? await adminApi.updateCommissionRule(rule._id, payload) : await adminApi.createCommissionRule(payload);
      onSaved(res.message);
    } catch (err) { setError(extractErrorMessage(err)); setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={save}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
      <span className="eyebrow">{form.scope === "WHOLESALE" ? "WHOLESALE COMMISSION RULE" : "RETAIL COMMISSION RULE"}</span><h2>{rule?._id ? "Edit rule" : "New rule"}</h2>
      {error && <div className="form-alert error" role="alert">{error}</div>}
      <label className="field"><span>Applies to</span><select value={form.ruleType} onChange={(e) => set("ruleType", e.target.value)}>{RULE_TYPES.map(([v]) => <option key={v} value={v}>{typeLabel(v, form.scope)}</option>)}</select></label>
      {form.ruleType === "VENDOR" && <SellerSelect required label={form.scope === "WHOLESALE" ? "Supplier" : "Seller"} sellers={sellers} value={form.targetVendor} onChange={(v) => set("targetVendor", v)} />}
      {form.ruleType !== "GLOBAL" && <CategorySelect label={form.ruleType === "VENDOR" ? "Only in this category (optional)" : "Category"} placeholder={form.ruleType === "VENDOR" ? "All categories" : "Choose a category"} value={form.targetCategory} onChange={(v) => set("targetCategory", v)} required={form.ruleType === "CATEGORY"} />}
      <div className="form-row">
        <label className="field"><span>MVEC commission (%) *</span><input type="number" min="0" max={maxRate} step="0.1" value={form.rateValue} onChange={(e) => set("rateValue", e.target.value)} required /></label>
        <label className="field"><span>Priority</span><input type="number" step="1" value={form.priority} onChange={(e) => set("priority", e.target.value)} /></label>
      </div>
      <p className="tiny">Most specific wins: a seller override for a category, then a seller override, then the category rate, then the default. When two rules are equally specific, the higher priority wins.</p>
      <label className="field"><span>Name (optional)</span><input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Phones launch rate" maxLength={150} /></label>
      <label className="program-switch"><input type="checkbox" role="switch" checked={form.isActive !== false} onChange={(e) => set("isActive", e.target.checked)} /><span><b>Active</b><small>Inactive rules are kept but not used.</small></span></label>
      <div className="modal-actions"><button type="button" className="outline-btn" onClick={onClose}>Cancel</button><button className="gradient-btn" disabled={busy}>{busy ? "Saving…" : "Save rule"}</button></div>
    </form>
  </div>;
}

function CommissionSettings({ settings, onSaved }) {
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  useEffect(() => setForm(settings), [settings]);
  const n = (k) => Number(form[k]) || 0;
  const example = 100000 * n("defaultCommissionPercent") / 100;
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setNotice(null);
    try { const res = await adminApi.updateCommissionSettings({ ...form, defaultCommissionPercent: n("defaultCommissionPercent"), defaultWholesaleCommissionPercent: n("defaultWholesaleCommissionPercent"), developerSharePercent: 0, affiliateSharePercent: n("affiliateSharePercent") }); setNotice({ ok: true, text: res.message }); onSaved(); }
    catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(false); }
  };
  return <form className="data-card" onSubmit={save}>
    <div className="data-card-head"><div><h3>How the commission is shared</h3><span>Applies to orders paid from now on. Paid orders keep the split they had.</span></div></div>
    <Notice notice={notice} />
    <div className="form-row">
      <label className="field"><span>Default retail commission (%)</span><input type="number" min="0" max="50" step="0.1" value={form.defaultCommissionPercent} onChange={(e) => setForm({ ...form, defaultCommissionPercent: e.target.value })} /></label>
      <label className="field"><span>Default wholesale commission (%)</span><input type="number" min="0" max="50" step="0.1" value={form.defaultWholesaleCommissionPercent ?? 0} onChange={(e) => setForm({ ...form, defaultWholesaleCommissionPercent: e.target.value })} /></label>
      <label className="field"><span>Payment provider fees paid by</span><select value={form.gatewayFeePayer} onChange={(e) => setForm({ ...form, gatewayFeePayer: e.target.value })}><option value="MVEC">MVEC (out of the commission)</option><option value="SELLER">The seller (out of their share)</option></select></label>
    </div>
    <div className="form-row">
      <label className="field"><span>Affiliate share (% of the commission)</span><input type="number" min="0" max="100" step="1" value={form.affiliateSharePercent} onChange={(e) => setForm({ ...form, affiliateSharePercent: e.target.value })} /></label>
    </div>
    <p className="tiny">Example, 100,000 RWF sale at the default rate: MVEC commission {money(example)} → affiliate {money(example * n("affiliateSharePercent") / 100)} (only if the buyer came through an affiliate link), MVEC keeps the rest{form.gatewayFeePayer === "MVEC" ? " minus the payment provider fee" : ""}.</p>
    <button className="gradient-btn" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
  </form>;
}

function SplitPreview({ sellers, scope }) {
  const [q, setQ] = useState({ vendorId: "", categoryId: "", amount: 100000, affiliate: false, gatewayFee: 0 });
  useEffect(() => setQ((x) => ({ ...x, vendorId: "", affiliate: false })), [scope]);
  const { data, error } = useLoad(() => adminApi.previewCommission({ ...q, scope, affiliate: q.affiliate && scope === "RETAIL" ? 1 : 0 }), [q.vendorId, q.categoryId, q.amount, q.affiliate, q.gatewayFee, scope]);
  return <div className="data-card">
    <div className="data-card-head"><div><h3>Try a sale</h3><span>See exactly how a sale would be split under the current rules.</span></div></div>
    <div className="form-row">
      <SellerSelect label={scope === "WHOLESALE" ? "Supplier" : "Seller"} sellers={sellers} value={q.vendorId} onChange={(v) => setQ({ ...q, vendorId: v })} />
      <CategorySelect allowCreate={false} placeholder="Any category" value={q.categoryId} onChange={(v) => setQ({ ...q, categoryId: v })} />
    </div>
    <div className="form-row">
      <label className="field"><span>Sale amount (RWF)</span><input type="number" min="0" value={q.amount} onChange={(e) => setQ({ ...q, amount: e.target.value })} /></label>
      <label className="field"><span>Payment provider fee (RWF)</span><input type="number" min="0" value={q.gatewayFee} onChange={(e) => setQ({ ...q, gatewayFee: e.target.value })} /></label>
    </div>
    {scope === "RETAIL" && <label className="filter-check"><input type="checkbox" checked={q.affiliate} onChange={(e) => setQ({ ...q, affiliate: e.target.checked })} /> The buyer came through an affiliate link</label>}
    {error && <p className="danger-text">{error}</p>}
    {data && <div className="split-preview">
      <p><b>{data.commissionPercent}% commission</b> · {data.source}{data.rule ? ` (“${data.rule.name}”)` : ""}</p>
      {[[scope === "WHOLESALE" ? "Supplier receives" : "Seller receives", data.vendorNet], ["MVEC commission", data.totalPlatformFee], ["  → Affiliate (paid by MVEC)", data.platformAffiliateShare], ["  → MVEC keeps", (Number(data.adminShare) || 0) + (Number(data.developerShare) || 0)], ["Payment provider fee", data.gatewayFee]].map(([k, v]) => <div className="setting-line" key={k}><span><b>{k.trim()}</b>{k.startsWith(" ") && <small>part of the commission</small>}</span><strong>{money(v)}</strong></div>)}
      <p className="tiny">Provider fee paid by {data.gatewayFeePayer === "SELLER" ? "the seller" : "MVEC"}.</p>
    </div>}
  </div>;
}

export function AdminCommissionRules() {
  const { loading, data, error, reload } = useLoad(adminApi.getCommissionRules, []);
  const sellers = useSellers();
  const suppliers = useSuppliers();
  const [scope, setScope] = useState("RETAIL");
  const [tab, setTab] = useState("CATEGORY");
  const parties = (scope === "WHOLESALE" ? suppliers.data : sellers.data) || [];
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");
  const rules = data?.rules || [];
  const inScope = rules.filter((r) => (r.scope || "RETAIL") === scope);
  const shown = inScope.filter((r) => r.ruleType === tab);
  const count = (t) => inScope.filter((r) => r.ruleType === t && r.isActive).length;
  const act = async (fn, okText, id) => {
    setBusy(id); setNotice(null);
    try { await fn(); setNotice({ ok: true, text: okText }); reload(); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(""); }
  };
  return <DashboardLayout admin>
    <Head eyebrow="MONEY" title="Commission rules" desc="MVEC's commission per category, with optional special rates for individual sellers (retail) or suppliers (wholesale). Changes apply to new orders; paid orders keep their rate." action={<button type="button" className="gradient-btn" onClick={() => setEditing({ scope })}><Icon name="plus" /> New rule</button>} />
    <Tabs label="Which sales" value={scope} onChange={(v) => { setScope(v); setTab("CATEGORY"); }} tabs={[["RETAIL", "Retail: buyers ← sellers"], ["WHOLESALE", "Wholesale: vendors ← suppliers"]]} />
    <Notice notice={notice} />
    {loading && !data ? <Loading what="commission rules" /> : error ? <Failed error={error} retry={reload} /> : <>
      <CommissionSettings settings={data.settings} onSaved={reload} />
      <div className="data-card">
        <Tabs label="Rule type" value={tab} onChange={setTab} tabs={RULE_TYPES.map(([v]) => [v, typeLabel(v, scope), count(v)])} />
        {shown.length === 0 ? <div className="empty-state"><h3>No {typeLabel(tab, scope).toLowerCase()}s yet</h3><p>{tab === "GLOBAL" ? `Without a default rule, ${scope === "WHOLESALE" ? "wholesale orders" : "sales"} use the ${scope === "WHOLESALE" ? data.settings.defaultWholesaleCommissionPercent ?? 0 : data.settings.defaultCommissionPercent}% default above.` : tab === "CATEGORY" ? "Every category uses the default until you set a rate." : `${scope === "WHOLESALE" ? "Suppliers" : "Sellers"} pay their category rates unless you give them an override.`}</p><button type="button" className="outline-btn" onClick={() => setEditing({ ruleType: tab, scope })}>Add one</button></div>
          : <div className="orders-list">{shown.map((r) => <div className={`order-row ${r.isActive ? "" : "inactive-row"}`} key={r.id}>
            <div className="order-row-main"><b>{r.ruleType === "VENDOR" ? r.sellerName : r.ruleType === "CATEGORY" ? r.categoryName : "All sales"}{r.ruleType === "VENDOR" && r.categoryName ? ` · ${r.categoryName}` : r.ruleType === "VENDOR" ? " · all categories" : ""}</b><small>{r.name} · priority {r.priority}</small></div>
            <div className="order-row-meta"><strong>{Number(r.rateValue)}%</strong><Status value={r.isActive ? "ACTIVE" : "Off"} label={r.isActive ? "Active" : "Off"} /></div>
            <div className="order-row-actions">
              <button type="button" className="outline-btn" onClick={() => setEditing(r)}>Edit</button>
              <button type="button" className="outline-btn" disabled={busy === r.id} onClick={() => act(() => adminApi.toggleCommissionRule(r._id, !r.isActive), r.isActive ? "Rule switched off." : "Rule switched on.", r.id)}>{r.isActive ? "Switch off" : "Switch on"}</button>
              <button type="button" className="danger-btn" disabled={busy === r.id} onClick={() => window.confirm("Delete this rule? Paid orders are not affected.") && act(() => adminApi.deleteCommissionRule(r._id), "Rule deleted.", r.id)}>Delete</button>
            </div>
          </div>)}</div>}
      </div>
      <SplitPreview sellers={parties} scope={scope} />
    </>}
    {editing && <RuleForm rule={editing._id ? editing : { ...EMPTY_RULE, ...editing }} sellers={((editing.scope || "RETAIL") === "WHOLESALE" ? suppliers.data : sellers.data) || []} maxRate={data?.maxRate || 50} onClose={() => setEditing(null)} onSaved={(text) => { setEditing(null); setNotice({ ok: true, text }); reload(); }} />}
  </DashboardLayout>;
}

// ─── Support inbox ─────────────────────────────────────────────────────────
// Requests from buyers, sellers, suppliers, affiliates and couriers. Admins
// answer here; the person is notified of every reply and status change.
const CASE_STATUS = [["OPEN", "New"], ["IN_PROGRESS", "In progress"], ["RESOLVED", "Resolved"], ["CLOSED", "Closed"]];
const ROLE_LABEL = { buyer: "Buyer", vendor: "Seller", supplier: "Supplier", affiliate: "Affiliate", delivery: "Courier" };
const PRIORITY_TONE = { URGENT: "danger", HIGH: "pending", MEDIUM: "", LOW: "" };

function CaseThread({ id, onChanged, onClose }) {
  const { loading, data, error, reload } = useLoad(() => supportApi.getCaseById(id), [id]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const c = data?.case;
  const send = async (e) => {
    e.preventDefault(); if (!reply.trim()) return;
    setBusy(true); setNotice(null);
    try { await supportApi.addComment(id, { message: reply.trim() }); setReply(""); await reload(true); onChanged(); setNotice({ ok: true, text: "Reply sent. They were notified." }); }
    catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(false); }
  };
  const setStatus = async (status) => {
    setBusy(true); setNotice(null);
    try { await supportApi.updateStatus(id, { status }); await reload(true); onChanged(); setNotice({ ok: true, text: `Marked ${CASE_STATUS.find(([v]) => v === status)[1].toLowerCase()}. They were notified.` }); }
    catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(false); }
  };
  if (loading && !c) return <div className="data-card"><Loading what="the request" /></div>;
  if (error) return <div className="data-card"><Failed error={error} retry={reload} /></div>;
  return <div className="data-card case-thread">
    <div className="data-card-head"><div><h3>{c.subject}</h3><span>{c.ticketNumber} · {c.openedBy?.Fullname} ({ROLE_LABEL[c.openedBy?.role] || c.openedBy?.role}) · {c.openedBy?.email} · {dateTime(c.createdAt)}</span></div>
      <button type="button" className="outline-btn" onClick={onClose}>Back to inbox</button></div>
    <Notice notice={notice} />
    <div className="case-meta"><Status value={c.status} label={CASE_STATUS.find(([v]) => v === c.status)?.[1]} /> <span className={`status ${PRIORITY_TONE[c.priority] || ""}`}>{statusLabel(c.priority)} priority</span> <span className="status">{statusLabel(c.category)}</span>{c.assignedTo && <small> · handled by {c.assignedTo.Fullname}</small>}</div>
    <div className="case-messages">
      <div className="case-message from-user"><b>{c.openedBy?.Fullname}</b><small>{dateTime(c.createdAt)}</small><p>{c.description}</p></div>
      {(c.comments || []).map((m, i) => { const mine = m.author?.role === "super_admin"; return <div key={i} className={`case-message ${mine ? "from-mvec" : "from-user"}`}><b>{mine ? `MVEC · ${m.author?.Fullname}` : m.author?.Fullname}</b><small>{dateTime(m.createdAt)}</small><p>{m.message}</p></div>; })}
    </div>
    {c.status !== "CLOSED" && <form onSubmit={send}>
      <label className="field"><span>Your reply</span><textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write the answer they will see…" /></label>
      <div className="row-actions"><button className="gradient-btn" disabled={busy || !reply.trim()}>Send reply</button>
        {c.status !== "RESOLVED" && <button type="button" className="outline-btn" disabled={busy} onClick={() => setStatus("RESOLVED")}>Mark resolved</button>}
        <button type="button" className="outline-btn" disabled={busy} onClick={() => setStatus("CLOSED")}>Close</button></div>
    </form>}
    {c.status === "CLOSED" && <button type="button" className="outline-btn" disabled={busy} onClick={() => setStatus("OPEN")}>Reopen</button>}
  </div>;
}

export function AdminSupportInbox() {
  const { search } = useLocation();
  const [open, setOpen] = useState(new URLSearchParams(search).get("case") || null);
  const [tab, setTab] = useState("ACTIVE");
  const { loading, data, error, reload } = useLoad(() => supportApi.listCases({ pageSize: 100 }), [], 60_000);
  const cases = data?.cases || [];
  const count = (pred) => cases.filter(pred).length;
  const active = (c) => ["OPEN", "IN_PROGRESS"].includes(c.status);
  const shown = cases.filter(tab === "ACTIVE" ? active : (c) => c.status === tab).sort((a, b) => (b.priority === "URGENT") - (a.priority === "URGENT") || new Date(b.updatedAt) - new Date(a.updatedAt));
  return <DashboardLayout admin>
    <Head eyebrow="COMMUNICATION" title="Support inbox" desc="Requests from buyers, sellers, suppliers, affiliates and couriers. Reply here; they are notified every time." />
    {open ? <CaseThread id={open} onChanged={() => reload(true)} onClose={() => setOpen(null)} /> : <div className="data-card">
      <Tabs label="Requests" value={tab} onChange={setTab} tabs={[["ACTIVE", "Needs an answer", count(active)], ["RESOLVED", "Resolved", count((c) => c.status === "RESOLVED")], ["CLOSED", "Closed", count((c) => c.status === "CLOSED")]]} />
      {loading && !data ? <Loading what="requests" /> : error ? <Failed error={error} retry={reload} /> : shown.length === 0 ? <div className="empty-state"><h3>{tab === "ACTIVE" ? "Inbox zero" : "Nothing here"}</h3><p>{tab === "ACTIVE" ? "New requests appear here and in your notifications." : ""}</p></div>
        : <div className="orders-list">{shown.map((c) => <button type="button" className="order-row case-row" key={c._id} onClick={() => setOpen(c._id)}>
          <div className="order-row-main"><b>{c.subject}</b><small>{c.openedBy?.Fullname} · {ROLE_LABEL[c.openedBy?.role] || c.openedBy?.role} · {statusLabel(c.category)} · {c.ticketNumber}</small><small>{(c.comments || []).length} repl{(c.comments || []).length === 1 ? "y" : "ies"} · updated {dateTime(c.updatedAt)}</small></div>
          <div className="order-row-meta">{c.priority === "URGENT" || c.priority === "HIGH" ? <span className={`status ${PRIORITY_TONE[c.priority]}`}>{statusLabel(c.priority)}</span> : null}<Status value={c.status} label={CASE_STATUS.find(([v]) => v === c.status)?.[1]} /></div>
        </button>)}</div>}
    </div>}
  </DashboardLayout>;
}
