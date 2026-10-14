// Wholesale between vendors (buying stock) and suppliers (selling it):
//  - WholesaleOrders: one list for both sides, with exactly the actions each
//    side can take at each step (pay, cancel, ship, confirm, report a problem)
//  - VendorQuotes: a vendor asks suppliers for goods and picks a quote
//  - SupplierQuotes: a supplier sees open requests and sends quotes
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import SmartTable from "../components/SmartTable";
import CategorySelect, { UnitSelect } from "../components/CategorySelect";
import { wholesaleApi } from "../API/wholesale";
import { quotesApi } from "../API/quotes";
import { paymentsApi } from "../API/payments";
import { extractErrorMessage } from "../API/client";
import { money, formatDate } from "../utils/format";

const partyName = (p) => p?.companyName || p?.Fullname || p?.fullName || p?.email || "—";
const itemCount = (o) => (o.items || []).reduce((n, i) => n + (Number(i.quantity) || 0), 0);
// label, tone, what it means for the vendor, what it means for the supplier
const STATUS = {
  PENDING_PAYMENT: ["Waiting for payment", "pending", "Pay within 48 hours or the order expires and the stock is released.", "The vendor has not paid yet. Do not ship."],
  ESCROW_HELD: ["Paid · MVEC holds the money", "pending", "The supplier has 7 days to ship. You can still cancel for a full refund.", "Paid. Ship within 7 days or the order is cancelled and refunded."],
  SHIPPED: ["Shipped", "pending", "Confirm when the goods arrive, or report a problem. After 7 days the supplier is paid automatically.", "Waiting for the vendor to confirm. You are paid automatically after 7 days if no problem is reported."],
  DELIVERED: ["Delivered", "pending", "Confirm receipt to pay the supplier.", "Waiting for the vendor to confirm receipt."],
  CONFIRMED_RELEASED: ["Completed", "active", "Received. The supplier was paid.", "Completed. The money (minus MVEC's commission) is in your balance."],
  DISPUTED: ["Problem reported", "danger", "MVEC is reviewing the problem; the money stays on hold.", "The vendor reported a problem. MVEC will decide; the money stays on hold."],
  CANCELLED: ["Cancelled", "danger", "Cancelled. If you had paid, the money is being refunded.", "Cancelled."],
};
const Status = ({ value }) => <em className={`status ${STATUS[value]?.[1] || "warning"}`}>{STATUS[value]?.[0] || value}</em>;
const Head = ({ eyebrow, title, desc, action }) => <div className="dash-page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{desc && <p>{desc}</p>}</div>{action}</div>;
const Notice = ({ notice }) => (notice ? <div className={`form-alert ${notice.ok ? "success" : "error"}`} role="status">{notice.text}</div> : null);

// Ask for a short text (reason) in a small modal instead of window.prompt.
function ReasonModal({ title, label, hint, confirm, danger, required = 5, onCancel, onConfirm }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (text.trim().length < required) { setError(required ? `Write at least ${required} characters.` : ""); return; }
    setBusy(true); setError("");
    try { await onConfirm(text.trim()); } catch (err) { setError(extractErrorMessage(err)); setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={onCancel}><form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
    <button type="button" className="modal-close" onClick={onCancel} aria-label="Close">×</button>
    <h2>{title}</h2>{hint && <p>{hint}</p>}
    {error && <div className="form-alert error" role="alert">{error}</div>}
    <label className="field"><span>{label}</span><textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus /></label>
    <div className="modal-actions"><button type="button" className="outline-btn" onClick={onCancel}>Back</button><button className={danger ? "danger-btn" : "gradient-btn"} disabled={busy}>{busy ? "Working…" : confirm}</button></div>
  </form></div>;
}

// Vendor pays by mobile money or card; MVEC holds the money until receipt.
export function PayWholesale({ order, onClose, onPaid }) {
  const [method, setMethod] = useState("momo");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState("");
  useEffect(() => {
    if (!waiting) return undefined;
    let tries = 0;
    const t = setInterval(async () => {
      tries += 1;
      try {
        const r = await paymentsApi.getStatus(waiting);
        const st = r.status || r.payment?.status;
        if (st === "SUCCESS") { clearInterval(t); onPaid(`${order.orderNumber} is paid. The supplier has been told to ship.`); }
        else if (st === "FAILED") { clearInterval(t); setWaiting(""); setBusy(false); setError("The payment was declined or cancelled. No money was taken."); }
      } catch { /* keep waiting */ }
      if (tries > 45) { clearInterval(t); setWaiting(""); setBusy(false); setError("No confirmation yet. If you approved it, the order updates by itself in a few minutes."); }
    }, 4000);
    return () => clearInterval(t);
  }, [waiting]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await wholesaleApi.pay(order._id || order.id, { method, phoneNumber: phone });
      if (r.checkoutUrl) { window.location.assign(r.checkoutUrl); return; }
      if (r.status === "SUCCESS") { onPaid(`${order.orderNumber} is paid. The supplier has been told to ship.`); return; }
      setWaiting(r.paymentId);
    } catch (err) { setError(extractErrorMessage(err)); setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
    <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
    <span className="eyebrow">PAY WHOLESALE ORDER</span><h2>{money(order.totalAmount)}</h2>
    <p>{order.orderNumber} · {partyName(order.supplier)}. MVEC holds the money and pays the supplier only after you confirm the goods arrived.</p>
    {error && <div className="form-alert error" role="alert">{error}</div>}
    {waiting ? <div className="form-alert">Approve the prompt on your phone. This page updates when the payment is confirmed…</div> : <>
      <label className={`payment-option ${method === "momo" ? "selected" : ""}`}><input type="radio" name="wh-method" checked={method === "momo"} onChange={() => setMethod("momo")} /><span className="payment-logo" aria-hidden="true">📱</span><span><b>Mobile money</b><small>MTN MoMo or Airtel Money</small></span></label>
      <label className={`payment-option ${method === "card" ? "selected" : ""}`}><input type="radio" name="wh-method" checked={method === "card"} onChange={() => setMethod("card")} /><span className="payment-logo" aria-hidden="true">💳</span><span><b>Card</b><small>Visa or Mastercard on a secure page</small></span></label>
      {method === "momo" && <label className="field"><span>Mobile money number</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" required inputMode="tel" /></label>}
    </>}
    <div className="modal-actions"><button type="button" className="outline-btn" onClick={onClose}>Close</button>{!waiting && <button className="gradient-btn" disabled={busy}>{busy ? "Starting…" : `Pay ${money(order.totalAmount)}`}</button>}</div>
  </form></div>;
}

// ─── Orders (both sides) ───────────────────────────────────────────────────
export function WholesaleOrders({ role }) {
  const supplier = role === "supplier";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [notice, setNotice] = useState(location.state?.notice ? { ok: true, text: location.state.notice } : null);
  const [busy, setBusy] = useState("");
  const [details, setDetails] = useState(null);
  const [paying, setPaying] = useState(null);
  const [asking, setAsking] = useState(null); // { kind: "cancel" | "problem", order }
  const [tab, setTab] = useState("ACTIVE");
  const load = useCallback(() => wholesaleApi.getMine({ limit: 100 }).then((res) => setRows(res.orders || [])).catch((err) => setNotice({ ok: false, text: extractErrorMessage(err) })).finally(() => setLoading(false)), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const run = async (o, fn, text) => {
    setBusy(o._id); setNotice(null);
    try { await fn(); setNotice({ ok: true, text }); setDetails(null); await load(); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(""); }
  };
  const confirmReceipt = (o) => window.confirm(`Confirm you received everything in ${o.orderNumber}? ${money(o.totalAmount)} is released to ${partyName(o.supplier)}. This cannot be undone.`)
    && run(o, () => wholesaleApi.confirmReceipt(o._id), `${o.orderNumber} confirmed. The supplier has been paid.`);
  const ship = (o) => run(o, () => wholesaleApi.markShipped(o._id), `${o.orderNumber} marked as shipped. The vendor was notified.`);
  const vendorCancel = (o) => window.confirm(o.status === "PENDING_PAYMENT" ? `Cancel ${o.orderNumber}? The reserved stock goes back to the supplier.` : `Cancel ${o.orderNumber}? Your ${money(o.totalAmount)} is refunded the way you paid.`)
    && run(o, () => wholesaleApi.cancel(o._id, ""), `${o.orderNumber} cancelled.${o.status === "ESCROW_HELD" ? " Your refund is on its way." : ""}`);

  const actionsFor = (o) => {
    const b = busy === o._id;
    const out = [];
    if (!supplier) {
      if (o.status === "PENDING_PAYMENT") out.push(<button key="pay" type="button" className="table-action-btn primary" onClick={() => setPaying(o)}><Icon name="wallet" size={15} />Pay now</button>);
      if (["SHIPPED", "DELIVERED", "ESCROW_HELD"].includes(o.status)) out.push(<button key="ok" type="button" className="table-action-btn primary" disabled={b} onClick={() => confirmReceipt(o)}><Icon name="check" size={15} />Confirm receipt</button>);
      if (["SHIPPED", "DELIVERED", "ESCROW_HELD"].includes(o.status)) out.push(<button key="pb" type="button" className="table-action-btn" disabled={b} onClick={() => setAsking({ kind: "problem", order: o })}>Report a problem</button>);
      if (["PENDING_PAYMENT", "ESCROW_HELD"].includes(o.status)) out.push(<button key="cx" type="button" className="table-action-btn" disabled={b} onClick={() => vendorCancel(o)}>Cancel</button>);
    } else {
      if (o.status === "ESCROW_HELD") out.push(<button key="ship" type="button" className="table-action-btn primary" disabled={b} onClick={() => ship(o)}><Icon name="box" size={15} />Mark shipped</button>);
      if (["PENDING_PAYMENT", "ESCROW_HELD"].includes(o.status)) out.push(<button key="cx" type="button" className="table-action-btn" disabled={b} onClick={() => setAsking({ kind: "cancel", order: o })}>{o.status === "ESCROW_HELD" ? "Can't fulfil" : "Decline"}</button>);
    }
    return out;
  };

  const ACTIVE = ["PENDING_PAYMENT", "ESCROW_HELD", "SHIPPED", "DELIVERED", "DISPUTED"];
  const shown = rows.filter((o) => (tab === "ACTIVE" ? ACTIVE.includes(o.status) : !ACTIVE.includes(o.status)));
  const stats = useMemo(() => {
    const sum = (list) => list.reduce((n, o) => n + (Number(o.totalAmount) || 0), 0);
    const held = rows.filter((o) => ["ESCROW_HELD", "SHIPPED", "DELIVERED", "DISPUTED"].includes(o.status));
    const toAct = rows.filter((o) => (supplier ? o.status === "ESCROW_HELD" : ["SHIPPED", "DELIVERED", "PENDING_PAYMENT"].includes(o.status)));
    return { held: sum(held), heldCount: held.length, toAct: toAct.length, done: sum(rows.filter((o) => o.status === "CONFIRMED_RELEASED")) };
  }, [rows, supplier]);
  const counterpart = supplier ? "vendor" : "supplier";
  const columns = [
    { key: "orderNumber", label: "Order", render: (r) => <div><b>{r.orderNumber}</b><small className="tiny seller-block">{formatDate(r.createdAt)}{r.quote ? " · from a quote" : ""}</small></div> },
    { key: counterpart, label: supplier ? "Vendor" : "Supplier", render: (r) => partyName(r[counterpart]) },
    { key: "items", label: "Items", render: (r) => <div>{r.items?.[0]?.productName || "—"}<small className="tiny seller-block">{r.items?.length > 1 ? `+${r.items.length - 1} more · ` : ""}{itemCount(r)} units</small></div> },
    { key: "totalAmount", label: "Total", render: (r) => <b>{money(r.totalAmount)}</b> },
    { key: "status", label: "Status", render: (r) => <Status value={r.status} /> },
  ];
  const actions = (r) => <span className="row-actions">{actionsFor(r)}<button type="button" className="table-action-btn icon-only" title="View details" aria-label="View details" onClick={() => setDetails(r)}><Icon name="eye" size={16} /></button></span>;
  const newPurchase = !supplier && <div className="row-actions"><Link className="outline-btn" to="/vendor/quotes">Ask for quotes</Link><Link className="gradient-btn" to="/vendor/suppliers"><Icon name="plus" size={16} /> Buy from a catalog</Link></div>;

  return <>
    <Head eyebrow={supplier ? "SUPPLIER · ORDERS" : "VENDOR · PURCHASES"} title={supplier ? "Orders from vendors" : "Purchases"}
      desc={supplier ? "Ship paid orders within 7 days. You are paid when the vendor confirms receipt (or automatically 7 days after shipping)." : "Stock you buy from suppliers. MVEC holds your payment until you confirm the goods arrived."} action={newPurchase} />
    <Notice notice={notice} />
    {!loading && rows.length > 0 && <div className="metric-grid">
      <div className="metric"><div className="metric-icon"><Icon name="bell" /></div><div><span>{supplier ? "To ship" : "Needs you"}</span><strong>{stats.toAct}</strong><small>{supplier ? "Paid and waiting" : "To pay or confirm"}</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="wallet" /></div><div><span>Held by MVEC</span><strong>{money(stats.held)}</strong><small>{stats.heldCount} order{stats.heldCount === 1 ? "" : "s"}</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="chart" /></div><div><span>{supplier ? "Completed sales" : "Completed purchases"}</span><strong>{money(stats.done)}</strong><small>Before MVEC's commission</small></div></div>
    </div>}
    <div className="data-card">
      <div className="dlv-tabs admin-tabs" role="tablist" aria-label="Orders">{[["ACTIVE", "In progress"], ["DONE", "Completed & cancelled"]].map(([k, l]) => <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      {loading ? <div className="empty-state"><h3>Loading…</h3></div> : shown.length === 0
        ? <div className="empty-state"><h3>{tab === "ACTIVE" ? "Nothing in progress" : "Nothing here yet"}</h3><p>{supplier ? "Orders from vendors and accepted quotes appear here." : "Buy from a supplier's catalog, or ask several suppliers for quotes."}</p>{newPurchase}</div>
        : <SmartTable columns={columns} rows={shown} rowKey={(r) => r._id || r.id} actions={actions} searchPlaceholder="Search by order, name or product…" empty="No orders match." exportName={supplier ? "mvec-wholesale-sales" : "mvec-purchases"} />}
    </div>

    {paying && <PayWholesale order={paying} onClose={() => setPaying(null)} onPaid={(text) => { setPaying(null); setNotice({ ok: true, text }); load(); }} />}
    {asking?.kind === "problem" && <ReasonModal title={`Report a problem with ${asking.order.orderNumber}`} label="What is wrong?" hint="MVEC holds the payment while it reviews. Describe what you received and what you expected." confirm="Report problem" required={10}
      onCancel={() => setAsking(null)} onConfirm={async (reason) => { await wholesaleApi.reportProblem(asking.order._id, reason); setAsking(null); setNotice({ ok: true, text: "Problem reported. MVEC will review it; the payment stays on hold." }); load(); }} />}
    {asking?.kind === "cancel" && <ReasonModal title={`Cancel ${asking.order.orderNumber}`} label="Why can't you fulfil it? The vendor sees this." hint={asking.order.status === "ESCROW_HELD" ? "The vendor is refunded in full." : "The vendor has not paid yet."} confirm="Cancel order" danger
      onCancel={() => setAsking(null)} onConfirm={async (reason) => { await wholesaleApi.cancel(asking.order._id, reason); setAsking(null); setNotice({ ok: true, text: "Order cancelled. The vendor was told." }); load(); }} />}
    {details && <div className="modal-backdrop" onMouseDown={() => setDetails(null)}><div className="modal seller-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={`Order ${details.orderNumber}`}>
      <button type="button" className="modal-close" onClick={() => setDetails(null)} aria-label="Close">×</button>
      <h2>{details.orderNumber}</h2>
      <p>{supplier ? "Vendor" : "Supplier"}: <b>{partyName(details[counterpart])}</b>{details[counterpart]?.phone ? ` · ${details[counterpart].phone}` : ""} · placed {formatDate(details.createdAt)}</p>
      <div className="purchase-status-note"><Status value={details.status} /><span>{STATUS[details.status]?.[supplier ? 3 : 2]}</span></div>
      {details.cancelReason && <p className="tiny">Reason: {details.cancelReason}</p>}
      {details.disputeReason && <p className="tiny">Problem reported: {details.disputeReason}</p>}
      <div className="purchase-items">
        {(details.items || []).map((i, k) => <div key={k}><span><b>{i.productName}</b><small>{i.quantity} {i.unit || ""} × {money(i.unitPrice)}</small></span><b>{money(i.quantity * i.unitPrice)}</b></div>)}
        <div className="purchase-total"><span>Total</span><b>{money(details.totalAmount)}</b></div>
      </div>
      <div className="purchase-dates tiny">{[["Paid", details.paidAt], ["Shipped", details.shippedAt], ["Completed", details.confirmedAt]].filter((d) => d[1]).map((d) => <span key={d[0]}>{d[0]} {formatDate(d[1])}</span>)}</div>
      <div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setDetails(null)}>Close</button>{actionsFor(details)}</div>
    </div></div>}
  </>;
}

// ─── Vendor: quote requests ────────────────────────────────────────────────
const emptyLine = () => ({ product: "", units: 1, unit: "piece", targetPrice: "" });
const REQ_STATUS = { OPEN: ["Waiting for quotes", "pending"], AWARDED: ["Quote accepted", "active"], CANCELLED: ["Cancelled", "danger"], EXPIRED: ["Expired", "danger"] };

export function VendorQuotes() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => quotesApi.myRequests().then((r) => setRequests(r.requests || [])).catch((err) => setNotice({ ok: false, text: extractErrorMessage(err) })).finally(() => setLoading(false)), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  const setLine = (i, k, v) => setForm((f) => ({ ...f, lines: f.lines.map((l, n) => (n === i ? { ...l, [k]: v } : l)) }));
  const submit = async (e) => {
    e.preventDefault(); setBusy("new"); setNotice(null);
    try { const r = await quotesApi.createRequest({ ...form, lines: form.lines.map((l) => ({ ...l, units: Number(l.units) })) }); setForm(null); setNotice({ ok: true, text: r.message }); load(); }
    catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(""); }
  };
  const accept = async (q, r) => {
    if (!window.confirm(`Accept ${q.supplierName}'s quote for ${money(q.totalAmount)}? The other quotes are declined, and you then pay into escrow.`)) return;
    setBusy(q.id);
    try { const res = await quotesApi.accept(q.id); navigate("/vendor/purchases", { state: { notice: res.message } }); }
    catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); setBusy(""); }
    return r;
  };
  const cancel = async (r) => {
    if (!window.confirm(`Cancel ${r.reference}? Suppliers who quoted are told.`)) return;
    setBusy(r.id);
    try { const res = await quotesApi.cancelRequest(r.id); setNotice({ ok: true, text: res.message }); load(); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(""); }
  };
  return <>
    <Head eyebrow="VENDOR · QUOTE REQUESTS" title="Quote requests" desc="Need stock that isn't in a supplier's catalog, or want the best price? Describe it once; verified suppliers send quotes; you accept one and pay into escrow."
      action={!form && <button type="button" className="gradient-btn" onClick={() => setForm({ category: "", neededBy: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), deliverTo: "", note: "", lines: [emptyLine()] })}><Icon name="plus" /> New request</button>} />
    <Notice notice={notice} />
    {form && <form className="data-card" onSubmit={submit}>
      <h3>What do you need?</h3>
      <div className="form-row"><CategorySelect valueKey="name" label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} required />
        <label className="field"><span>Needed by *</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={form.neededBy} onChange={(e) => setForm({ ...form, neededBy: e.target.value })} required /></label></div>
      {form.lines.map((l, i) => <div className="form-row quote-line" key={i}>
        <label className="field"><span>Item *</span><input value={l.product} onChange={(e) => setLine(i, "product", e.target.value)} placeholder="e.g. Maize flour 25kg" required /></label>
        <label className="field"><span>Quantity *</span><input type="number" min="1" value={l.units} onChange={(e) => setLine(i, "units", e.target.value)} required /></label>
        <UnitSelect value={l.unit} onChange={(v) => setLine(i, "unit", v)} />
        <label className="field"><span>Target price per unit (optional)</span><input type="number" min="0" value={l.targetPrice} onChange={(e) => setLine(i, "targetPrice", e.target.value)} /></label>
        {form.lines.length > 1 && <button type="button" className="outline-btn" onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, n) => n !== i) }))}>Remove</button>}
      </div>)}
      <button type="button" className="outline-btn" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}>Add another item</button>
      <div className="form-row"><label className="field"><span>Deliver to</span><input value={form.deliverTo} onChange={(e) => setForm({ ...form, deliverTo: e.target.value })} placeholder="District, sector or address" /></label>
        <label className="field"><span>Note for suppliers</span><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Brand, quality, packaging…" /></label></div>
      <div className="row-actions"><button type="button" className="outline-btn" onClick={() => setForm(null)}>Cancel</button><button className="gradient-btn" disabled={busy === "new"}>{busy === "new" ? "Sending…" : "Send to suppliers"}</button></div>
    </form>}
    {loading ? <div className="data-card"><div className="empty-state"><h3>Loading…</h3></div></div> : requests.length === 0 && !form
      ? <div className="data-card"><div className="empty-state"><h3>No quote requests yet</h3><p>Suppliers in the category you choose are notified straight away.</p></div></div>
      : requests.map((r) => <div className="data-card" key={r.id}>
        <div className="data-card-head"><div><h3>{r.reference} · {r.category}</h3><span>{r.lines.map((l) => `${l.units} ${l.unit} ${l.product}`).join(", ")} · needed by {formatDate(r.neededBy)}</span></div>
          <div className="row-actions"><em className={`status ${REQ_STATUS[r.status]?.[1]}`}>{REQ_STATUS[r.status]?.[0]}</em>{r.status === "OPEN" && <button type="button" className="outline-btn" disabled={busy === r.id} onClick={() => cancel(r)}>Cancel request</button>}</div></div>
        {r.quotes.length === 0 ? <p className="tiny">{r.status === "OPEN" ? "No quotes yet. You will get a notification when one arrives." : "No quotes were received."}</p>
          : <div className="orders-list">{r.quotes.map((q, i) => <div className="order-row" key={q.id}>
            <div className="order-row-main"><b>{q.supplierName}{i === 0 && r.quotes.length > 1 && q.status === "SUBMITTED" ? " · lowest price" : ""}</b>
              {(q.lines || []).map((l, k) => <small key={k}>{l.units} {l.unit} {l.product} × {money(l.unitPrice)}</small>)}
              <small>Delivery in {q.deliveryDays} day{q.deliveryDays === 1 ? "" : "s"}{q.validUntil ? ` · valid until ${formatDate(q.validUntil)}` : ""}{q.note ? ` · “${q.note}”` : ""}</small></div>
            <div className="order-row-meta"><strong>{money(q.totalAmount)}</strong><em className={`status ${q.status === "ACCEPTED" ? "active" : q.status === "DECLINED" ? "danger" : "pending"}`}>{{ SUBMITTED: "Offered", ACCEPTED: "Accepted", DECLINED: "Declined" }[q.status] || q.status}</em></div>
            <div className="order-row-actions">{r.status === "OPEN" && q.status === "SUBMITTED" && <button type="button" className="gradient-btn" disabled={busy === q.id} onClick={() => accept(q, r)}>Accept</button>}
              {q.status === "ACCEPTED" && <Link className="outline-btn" to="/vendor/purchases">Go to order</Link>}</div>
          </div>)}</div>}
      </div>)}
  </>;
}

// ─── Supplier: quotes ──────────────────────────────────────────────────────
function QuoteForm({ request, onClose, onSent }) {
  const mine = request.myQuote;
  const [prices, setPrices] = useState(request.lines.map((_, i) => mine?.lines?.[i]?.unitPrice || ""));
  const [days, setDays] = useState(mine?.deliveryDays ?? 2);
  const [valid, setValid] = useState(7);
  const [note, setNote] = useState(mine?.note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = request.lines.reduce((s, l, i) => s + (Number(prices[i]) || 0) * l.units, 0);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await quotesApi.submit(request.id, { lines: prices.map((p) => ({ unitPrice: Number(p) })), deliveryDays: Number(days), validDays: Number(valid), note }); onSent(`Quote sent to ${request.vendorName}.`); }
    catch (err) { setError(extractErrorMessage(err)); setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
    <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
    <span className="eyebrow">{mine ? "UPDATE YOUR QUOTE" : "SEND A QUOTE"}</span><h2>{request.reference}</h2>
    <p>{request.vendorName} · needed by {formatDate(request.neededBy)}{request.deliverTo ? ` · deliver to ${request.deliverTo}` : ""}{request.note ? ` · “${request.note}”` : ""}</p>
    {error && <div className="form-alert error" role="alert">{error}</div>}
    {request.lines.map((l, i) => <label className="field" key={i}><span>{l.units} {l.unit} {l.product}: your price per {l.unit}{l.targetPrice ? ` (vendor's target ${money(l.targetPrice)})` : ""}</span>
      <input type="number" min="1" value={prices[i]} onChange={(e) => setPrices(prices.map((p, n) => (n === i ? e.target.value : p)))} required /></label>)}
    <div className="form-row"><label className="field"><span>Delivery takes (days)</span><input type="number" min="0" max="90" value={days} onChange={(e) => setDays(e.target.value)} required /></label>
      <label className="field"><span>Offer valid for</span><select value={valid} onChange={(e) => setValid(e.target.value)}>{[3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} days</option>)}</select></label></div>
    <label className="field"><span>Note (optional)</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Brand, delivery terms…" /></label>
    <p className="tiny">Total: <b>{money(total)}</b>. If accepted, the vendor pays MVEC, you ship, and you are paid when they confirm receipt (minus MVEC's wholesale commission).</p>
    <div className="modal-actions"><button type="button" className="outline-btn" onClick={onClose}>Cancel</button><button className="gradient-btn" disabled={busy}>{busy ? "Sending…" : mine ? "Update quote" : "Send quote"}</button></div>
  </form></div>;
}

export function SupplierQuotes() {
  const [tab, setTab] = useState("open");
  const [open, setOpen] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [quoting, setQuoting] = useState(null);
  const load = useCallback(() => Promise.all([quotesApi.open(), quotesApi.myQuotes()]).then(([o, m]) => { setOpen(o.requests || []); setMine(m.quotes || []); }).catch((err) => setNotice({ ok: false, text: extractErrorMessage(err) })).finally(() => setLoading(false)), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  const withdraw = async (q) => {
    if (!window.confirm("Withdraw this quote?")) return;
    try { await quotesApi.withdraw(q.id); setNotice({ ok: true, text: "Quote withdrawn." }); load(); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); }
  };
  const matching = open.filter((r) => r.matchesMyCategory).length;
  return <>
    <Head eyebrow="SUPPLIER · QUOTES" title="Quote requests" desc="Vendors describe what they need; send a price. If they accept, it becomes an order they pay into escrow before you ship." />
    <Notice notice={notice} />
    <div className="data-card">
      <div className="dlv-tabs admin-tabs" role="tablist" aria-label="Quotes">{[["open", "Open requests", open.length], ["mine", "My quotes", mine.length]].map(([k, l, n]) => <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}<em>{n}</em></button>)}</div>
      {loading ? <div className="empty-state"><h3>Loading…</h3></div> : tab === "open"
        ? (open.length === 0 ? <div className="empty-state"><h3>No open requests</h3><p>You are notified when a vendor asks for goods in your category.</p></div>
          : <><p className="tiny">{matching} in your category.</p><div className="orders-list">{open.map((r) => <div className="order-row" key={r.id}>
            <div className="order-row-main"><b>{r.category} · {r.vendorName}{r.matchesMyCategory ? " · your category" : ""}</b>
              {r.lines.map((l, k) => <small key={k}>{l.units} {l.unit} {l.product}{l.targetPrice ? ` (target ${money(l.targetPrice)} each)` : ""}</small>)}
              <small>Needed by {formatDate(r.neededBy)}{r.deliverTo ? ` · ${r.deliverTo}` : ""} · {r.quoteCount} quote{r.quoteCount === 1 ? "" : "s"} so far</small></div>
            <div className="order-row-meta">{r.myQuote && <em className="status pending">You quoted {money(r.myQuote.totalAmount)}</em>}</div>
            <div className="order-row-actions"><button type="button" className={r.myQuote ? "outline-btn" : "gradient-btn"} onClick={() => setQuoting(r)}>{r.myQuote ? "Update quote" : "Send a quote"}</button></div>
          </div>)}</div></>)
        : (mine.length === 0 ? <div className="empty-state"><h3>No quotes yet</h3></div>
          : <div className="orders-list">{mine.map((q) => <div className="order-row" key={q.id}>
            <div className="order-row-main"><b>{q.request?.reference} · {q.request?.category}</b><small>{(q.lines || []).map((l) => `${l.units} ${l.unit} ${l.product} × ${money(l.unitPrice)}`).join(" · ")}</small><small>Sent {formatDate(q.updatedAt)}</small></div>
            <div className="order-row-meta"><strong>{money(q.totalAmount)}</strong><em className={`status ${q.status === "ACCEPTED" ? "active" : ["DECLINED", "WITHDRAWN"].includes(q.status) ? "danger" : "pending"}`}>{{ SUBMITTED: "Waiting for the vendor", ACCEPTED: "Accepted", DECLINED: "Not chosen", WITHDRAWN: "Withdrawn" }[q.status]}</em></div>
            <div className="order-row-actions">{q.status === "SUBMITTED" && <button type="button" className="outline-btn" onClick={() => withdraw(q)}>Withdraw</button>}{q.status === "ACCEPTED" && <Link className="outline-btn" to="/supplier/orders">See order</Link>}</div>
          </div>)}</div>)}
    </div>
    {quoting && <QuoteForm request={quoting} onClose={() => setQuoting(null)} onSent={(text) => { setQuoting(null); setNotice({ ok: true, text }); load(); }} />}
  </>;
}
