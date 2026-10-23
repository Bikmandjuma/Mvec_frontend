import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import Icon from "../components/Icon";
import SmartTable from "../components/SmartTable";
import NotificationPanel from "../components/NotificationPanel";
import RestrictedOverview from "../components/dashboard/RestrictedOverview";
import { suppliersApi } from "../API/suppliers";
import { uploadsApi } from "../API/uploads";
import ProductImage from "../components/ProductImage";
import CategorySelect from "../components/CategorySelect";
import { WholesaleOrders, SupplierQuotes } from "./Wholesale";
import { quotesApi } from "../API/quotes";
import { wholesaleApi } from "../API/wholesale";
import { extractErrorMessage } from "../API/client";
import { useAuth } from "../context/AuthContext";
import AddTeamMemberModal from "../components/team/AddTeamMemberModal";
import SupplierInventory from "./SupplierInventory";
import SupplierProducts from "./SupplierProducts";
import StorePage from "./seller/StorePage";
import OrdersPage from "./seller/OrdersPage";

const money = n => new Intl.NumberFormat("en-RW").format(Number(n) || 0) + " RWF";
// Smallest supplier payout the backend accepts.
const PAYOUT_MINIMUM = 50000;
const date = v => v ? new Date(v).toLocaleDateString("en-GB") : "—";

// Supplier stores use the vendor "My Stores" page with the supplier API.
const STORE_API = { list: suppliersApi.getMyStores, create: suppliersApi.createStore, update: suppliersApi.updateStore, setPrimary: suppliersApi.setPrimaryStore, remove: suppliersApi.removeStore };
const STORE_COPY = {
  eyebrow: "SUPPLIER PLATFORM",
  desc: "Run several warehouses, depots or branches from one supplier account. Vendors see which store each product ships from.",
  newText: "Each store gets its own name, logo, location and contact details.",
  editText: "Update the details vendors see for this store.",
  placeholder: "e.g. Musanze Depot",
  emptyText: "Register your first store to start stocking products.",
  deleteText: name => `Delete ${name}? Its products and their stock move to your primary store.`,
  note: "Payouts, team and your supplier balance are shared across all your stores. Products without a store are stocked in the primary store.",
};
function Stores() { return <StorePage api={STORE_API} copy={STORE_COPY}/>; }
// Buyers' orders for published products: the vendor Orders page, without manual sales.
function Sales() { return <OrdersPage basePath="/supplier/sales" allowManual={false} eyebrow="SUPPLIER PLATFORM" title="Marketplace orders" desc="Buyers' orders for the products you publish. Prepare and ship them; you are paid when the buyer gives you the delivery code."/>; }

function Header({ eyebrow, title, description, action }) { return <div className="dash-page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
// CATALOG_MANAGER -> "Catalog manager"
const label = v => { const t = String(v || "").toLowerCase().replace(/_/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };
function Metric({ icon, label, value, sub }) { return <div className="metric"><div className="metric-icon"><Icon name={icon}/></div><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div></div>; }
function Remote({ load, children, deps = [] }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  // A reload (new filter, 30s refresh) keeps the last data on screen; a failed
  // background refresh does not replace a page that already loaded.
  useEffect(() => { let live = true; const refresh = () => load().then(data => live && setState({ loading: false, data, error: "" })).catch(error => live && setState(cur => ({ ...cur, loading: false, error: extractErrorMessage(error) }))); setState(cur => ({ ...cur, loading: true })); refresh(); const timer = window.setInterval(refresh, 30000); return () => { live = false; window.clearInterval(timer); }; }, deps);
  if (state.data === null) return state.error ? <div className="form-error">{state.error}</div> : <div className="empty-state"><h3>Loading…</h3></div>;
  return children(state.data);
}

function VerificationBanner() {
  const { user } = useAuth();
  if (user?.verificationStatus === "REJECTED") return <div className="form-alert error"><b>MVEC asked you to update your profile.</b> {user.verificationNote || "Check your details."} <Link to="/supplier/settings">Fix it in Settings</Link>; saving sends it back for review automatically.</div>;
  if (user?.verificationStatus === "PENDING") return <div className="form-alert">MVEC is reviewing your profile. You will get a message, SMS and email when it is done.</div>;
  return null;
}

// What needs doing now, worked out from orders, stock, payouts and requests.
function todoList({ orders, products, finance, requests }) {
  const toShip = orders.filter(o => o.status === "ESCROW_HELD");
  const disputed = orders.filter(o => o.status === "DISPUTED");
  const lowStock = products.filter(p => p.status !== "ARCHIVED" && Number(p.stockQuantity || 0) <= Math.max(Number(p.lowStockThreshold ?? 10), Number(p.moq || 0)));
  const toQuote = requests.filter(r => r.matchesMyCategory && !r.myQuote);
  const items = [];
  if (toShip.length) items.push({ text: `${toShip.length} paid order${toShip.length === 1 ? "" : "s"} to ship`, hint: "Ship within 7 days. MVEC holds the money until the vendor confirms receipt.", link: "/supplier/orders", urgent: true });
  if (disputed.length) items.push({ text: `${disputed.length} order${disputed.length === 1 ? "" : "s"} with a reported problem`, hint: "MVEC is reviewing; contact the vendor in Messages if you can fix it.", link: "/supplier/orders", urgent: true });
  if (lowStock.length) items.push({ text: `${lowStock.length} product${lowStock.length === 1 ? "" : "s"} running low`, hint: lowStock.slice(0, 3).map(p => p.name).join(", "), link: "/supplier/inventory" });
  if (Number(finance.availablePayout) >= PAYOUT_MINIMUM) items.push({ text: `${money(finance.availablePayout)} ready to withdraw`, hint: "Request a payout to mobile money or your bank.", link: "/supplier/payments" });
  if (toQuote.length) items.push({ text: `${toQuote.length} vendor${toQuote.length === 1 ? "" : "s"} asking for quotes in your category`, hint: toQuote.slice(0, 3).map(r => r.lines.map(l => `${l.units} ${l.unit} ${l.product}`).join(", ")).join(" · "), link: "/supplier/quotes" });
  if (!products.length) items.push({ text: "Add your first wholesale product", hint: "Vendors can only order what is in your catalog.", link: "/supplier/products", urgent: true });
  return items;
}

function Overview() { const { user } = useAuth(); const restricted = user?.isOnboarded === false; if (restricted) return <><Header eyebrow="SUPPLIER PLATFORM" title="Supplier dashboard" description="Complete onboarding to unlock live supplier operations."/><div className="metric-grid"><Metric icon="box" label="Wholesale products" value="—" sub="Available after onboarding"/><Metric icon="cart" label="Vendor orders" value="—" sub="Available after onboarding"/><Metric icon="chart" label="Sales" value="—" sub="Available after onboarding"/><Metric icon="wallet" label="Protected funds" value="—" sub="Available after onboarding"/></div></>; return <Remote load={async () => { const [finance, products, delivery, orders, requests] = await Promise.all([suppliersApi.getFinanceSummary(), suppliersApi.getMyProducts(), suppliersApi.getDeliverySummary(), wholesaleApi.getMine().catch(() => ({ orders: [] })), quotesApi.open().catch(() => ({ requests: [] }))]); return { finance: finance.summary || {}, products: products.products || [], delivery: delivery.summary || {}, orders: orders.orders || [], requests: requests.requests || [] }; }}>
  {(data) => { const { finance, products, delivery } = data; const todo = todoList(data); return <><Header eyebrow="SUPPLIER PLATFORM" title="Supplier dashboard" description="What needs your attention, and how your wholesale business is doing."/><VerificationBanner/>
    <div className="data-card attention-card"><div className="data-card-head"><div><h3>To do</h3><span>{todo.length ? "Updates every 30 seconds" : "You are all caught up"}</span></div></div>
      {todo.length === 0 ? <div className="empty-state"><h3>Nothing waiting</h3><p>New orders, low stock and payouts show up here.</p></div> : <div className="attention-list">{todo.map(it => <Link key={it.text} to={it.link} className={`attention-item ${it.urgent ? "urgent" : ""}`}><span><b>{it.text}</b>{it.hint && <small>{it.hint}</small>}</span><Icon name="arrow" size={14}/></Link>)}</div>}
    </div>
    <div className="metric-grid"><Metric icon="box" label="Wholesale products" value={products.length} sub={`${products.filter(p => p.retailProduct && typeof p.retailProduct === "object" && p.retailProduct.status !== "INACTIVE").length} also sold to buyers`}/><Metric icon="cart" label="Vendor orders" value={Number(delivery.activeShipments || 0) + Number(delivery.deliveredThisMonth || 0)} sub={`${delivery.activeShipments || 0} in progress`}/><Metric icon="chart" label="Sales" value={money(finance.grossSales)} sub="Total wholesale sales"/><Metric icon="wallet" label="Held by MVEC" value={money(finance.escrowHeld)} sub="Paid to you when vendors confirm receipt"/></div></>; }}
</Remote>; }

function Analytics() { const [range, setRange] = useState("30d"); return <Remote load={() => suppliersApi.getAnalytics({ range })} deps={[range]}>{({ analytics = {} }) => <><Header eyebrow="ANALYTICS" title="Analytics" description="How your wholesale sales are doing." action={<select className="period-select" value={range} onChange={e => setRange(e.target.value)} aria-label="Period"><option value="30d">Last 30 days</option><option value="3m">Last 3 months</option><option value="1y">Last 12 months</option></select>}/><div className="metric-grid"><Metric icon="chart" label="Sales" value={money(analytics.grossSales)} sub={`${analytics.orderCount || 0} order${analytics.orderCount === 1 ? "" : "s"}`}/><Metric icon="cart" label="Units sold" value={analytics.unitsSold || 0} sub="Across all products"/><Metric icon="users" label="Average order" value={money(analytics.averageOrderValue)} sub="Per vendor order"/></div><div className="data-card"><div className="data-card-head"><div><h3>Best-selling products</h3></div></div><SmartTable columns={[{ key: "name", label: "Product" }, { key: "units", label: "Units" }, { key: "revenue", label: "Revenue", render: r => money(r.revenue) }]} rows={analytics.topProducts || []} rowKey={r => r.name} searchPlaceholder="Search products…" empty="No sales in this period yet."/></div></>}</Remote>; }
const PAYOUT_METHODS = { MTN_MOMO: "MTN MoMo", AIRTEL_MONEY: "Airtel Money", BANK_TRANSFER: "Bank transfer" };
const PAYOUT_STATUS = { PENDING: "Waiting for MVEC", PROCESSING: "Being sent", PAID: "Sent", REJECTED: "Declined", FAILED: "Failed" };

function PayoutForm({ available, onDone }) {
  const [form, setForm] = useState({ amount: "", method: "MTN_MOMO", destination: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async e => {
    e.preventDefault(); setError("");
    const amount = Number(form.amount);
    if (!Number.isInteger(amount) || amount < PAYOUT_MINIMUM) { setError(`The minimum payout is ${money(PAYOUT_MINIMUM)}.`); return; }
    if (amount > available) { setError(`You can withdraw up to ${money(available)}.`); return; }
    setBusy(true);
    try { await suppliersApi.requestPayout({ ...form, amount }); setForm({ amount: "", method: form.method, destination: form.destination, note: "" }); onDone("Payout requested. MVEC sends it and you get a notification when it is on its way."); }
    catch (err) { setError(extractErrorMessage(err)); } finally { setBusy(false); }
  };
  if (available < PAYOUT_MINIMUM) return <p className="tiny">You can request a payout once you have {money(PAYOUT_MINIMUM)} available. Money becomes available when vendors confirm they received their orders.</p>;
  return <form className="payout-form" onSubmit={submit}>
    {error && <div className="form-alert error" role="alert">{error}</div>}
    <div className="form-row">
      <label className="field"><span>Amount (RWF)</span><input type="number" min={PAYOUT_MINIMUM} max={available} step="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder={`Up to ${available}`} required/></label>
      <label className="field"><span>Send to</span><select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>{Object.entries(PAYOUT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    </div>
    <label className="field"><span>{form.method === "BANK_TRANSFER" ? "Bank and account number" : "Mobile money number"}</span><input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder={form.method === "BANK_TRANSFER" ? "e.g. Bank of Kigali 000400012345" : "07…"} required/></label>
    <label className="field"><span>Note for MVEC (optional)</span><input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} maxLength={300}/></label>
    <div className="row-actions"><button type="button" className="outline-btn" onClick={() => setForm({ ...form, amount: String(available) })}>Withdraw all</button><button className="gradient-btn" disabled={busy}>{busy ? "Requesting…" : "Request payout"}</button></div>
  </form>;
}

function Payments() { const [notice, setNotice] = useState(""); const [tick, setTick] = useState(0); return <Remote deps={[tick]} load={async () => { const [summary, payouts] = await Promise.all([suppliersApi.getFinanceSummary(), suppliersApi.getPayouts()]); return { summary: summary.summary || {}, payouts: payouts.payouts || [] }; }}>{({ summary, payouts }) => <><Header eyebrow="PAYMENTS" title="Payments" description="Your balance, and payouts to mobile money or your bank."/>{notice && <div className="form-alert success" role="status">{notice}</div>}<div className="metric-grid"><Metric icon="wallet" label="Available to withdraw" value={money(summary.availablePayout)} sub="Released after vendors confirm receipt"/><Metric icon="chart" label="Payouts in progress" value={money(summary.pendingPayouts)} sub="Requested, not sent yet"/><Metric icon="box" label="Released this period" value={money(summary.releasedThisPeriod)} sub="Orders vendors confirmed"/></div><div className="data-card"><div className="data-card-head"><div><h3>Request a payout</h3><span>MVEC sends it and you get a notification at each step.</span></div></div><PayoutForm available={Number(summary.availablePayout) || 0} onDone={text => { setNotice(text); setTick(t => t + 1); }}/></div><div className="data-card"><div className="data-card-head"><div><h3>Payout history</h3></div></div><SmartTable columns={[{ key: "payoutNumber", label: "Reference", render: r => r.payoutNumber || r._id }, { key: "amount", label: "Amount", render: r => money(r.amount) }, { key: "method", label: "To", render: r => `${PAYOUT_METHODS[r.method] || r.method} · ${r.destination || ""}` }, { key: "status", label: "Status", render: r => <span className={`status ${r.status === "PAID" ? "active" : ["REJECTED", "FAILED"].includes(r.status) ? "danger" : "pending"}`}>{PAYOUT_STATUS[r.status] || r.status}</span> }, { key: "requestedAt", label: "Requested", render: r => date(r.requestedAt) }]} rows={payouts} rowKey={r => r._id} searchPlaceholder="Search payouts…" empty="No payouts yet."/>{payouts.some(p => p.rejectionReason) && <p className="tiny">Declined: {payouts.filter(p => p.rejectionReason).map(p => `${p.payoutNumber}: ${p.rejectionReason}`).join(" · ")}</p>}</div></>}</Remote>; }
function Reports() { return <Remote load={async () => { const [summary, analytics, ledger] = await Promise.all([suppliersApi.getFinanceSummary(), suppliersApi.getAnalytics({ range: "30d" }), suppliersApi.getFinanceLedger()]); return { summary: summary.summary || {}, analytics: analytics.analytics || {}, ledger: ledger.entries || [] }; }}>{({ summary, analytics, ledger }) => <><Header eyebrow="REPORTS" title="Reports" description="Every payment, release and payout on your account. Export it for your bookkeeping."/><div className="data-card"><SmartTable columns={[{ key: "description", label: "Record" }, { key: "kind", label: "Type", render: r => label(r.kind) }, { key: "amount", label: "Amount", render: r => money(r.amount) }, { key: "at", label: "Date", render: r => date(r.at) }]} rows={ledger} rowKey={r => r._id} searchPlaceholder="Search records…" empty="No payments or payouts yet." exportName="mvec-supplier-report"/><p className="tiny">Last 30 days: {money(analytics.grossSales)} in sales · All time: {money(summary.grossSales)}</p></div></>}</Remote>; }
function Team() { const [members,setMembers]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [editing,setEditing]=useState(null); const load=()=>{setLoading(true);return suppliersApi.getTeam().then(data=>setMembers(data.members||[])).catch(e=>setError(extractErrorMessage(e))).finally(()=>setLoading(false));}; useEffect(()=>{load();},[]); const save=async form=>{setError(""); const payload={fullName:form.name,phone:form.phone,email:form.email,password:form.password,role:form.role}; if(form.id){await suppliersApi.updateTeamMember(form.id,{...payload,status:form.status});setNotice("Team member updated.");}else{await suppliersApi.addTeamMember(payload);setNotice("Team member added.");}setEditing(null);await load();}; const remove=async row=>{if(!window.confirm(`Remove ${row.fullName||"this team member"}?`))return;try{await suppliersApi.removeTeamMember(row._id);setNotice("Team member removed.");await load();}catch(e){setError(extractErrorMessage(e));}}; return <><div className="dash-page-head"><div><span className="eyebrow">TEAM / STAFF</span><h1>Team & staff</h1><p>People who help run your supplier account, and what each can do.</p></div><button className="gradient-btn" onClick={()=>setEditing({})}><Icon name="plus"/> Add team member</button></div>{notice&&<div className="form-alert success">{notice}</div>}{error&&<div className="form-error">{error}</div>}<div className="data-card">{loading?<div className="empty-state"><h3>Loading team…</h3></div>:<SmartTable columns={[{ key: "fullName", label: "Member" }, { key: "role", label: "Role", render: r => label(r.role) }, { key: "phone", label: "Phone" }, { key: "status", label: "Status", render: r => <em className={`status ${r.status === "ACTIVE" ? "active" : "warning"}`}>{label(r.status)}</em> }]} rows={members} rowKey={r => r._id} searchPlaceholder="Search team…" empty="No team members yet. Add one to share the work." actions={row=>row.role!=="OWNER"&&<><button className="table-action-btn" onClick={()=>setEditing(row)}>Edit</button><button className="table-action-btn" onClick={()=>remove(row)}>Remove</button></>}/>}</div>{editing&&<AddTeamMemberModal mode="supplier" value={editing} onCancel={()=>setEditing(null)} onSave={save}/>}</>; }
const PROFILE_FIELDS = [["businessName", "Business name"], ["phone", "Phone"], ["email", "Email"], ["location", "Location (district, sector)"]];

function Settings() {
  const { refresh } = useAuth();
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState({});
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  useEffect(() => { suppliersApi.getMyProfile().then(result => { const p = result.supplier || result; setStatus({ verificationStatus: p.verificationStatus, verificationNote: p.verificationNote }); setForm({ businessName: p.businessName || "", category: p.category || "", phone: p.phone || "", email: p.email || "", location: typeof p.location === "object" && p.location ? Object.values(p.location).filter(Boolean).join(", ") : p.location || "", description: p.description || "", logoUrl: p.logoUrl || "" }); }).catch(err => setError(extractErrorMessage(err))); }, []);
  if (error) return <div className="form-error">{error}</div>;
  if (!form) return <div className="empty-state"><h3>Loading profile…</h3></div>;
  const upload = async e => { const file = e.target.files?.[0]; if (!file) return; setUploading(true); try { const { urls } = await uploadsApi.uploadImages([file]); setForm(f => ({ ...f, logoUrl: urls?.[0] || f.logoUrl })); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setUploading(false); } };
  const save = async e => { e.preventDefault(); setSaving(true); setNotice(null); try { const res = await suppliersApi.updateMyProfile(form); setStatus({ verificationStatus: res.supplier?.verificationStatus, verificationNote: res.supplier?.verificationNote }); setNotice({ ok: true, text: res.message || "Profile saved." }); refresh?.(); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setSaving(false); } };
  return <><Header eyebrow="SETTINGS" title="Supplier profile" description="Vendors see this profile. Keep it complete so MVEC can verify you."/>
    {status.verificationStatus === "REJECTED" && <div className="form-alert error"><b>MVEC asked for changes:</b> {status.verificationNote || "Check your details."} Saving sends your profile back for review.</div>}
    {notice && <div className={`form-alert ${notice.ok ? "success" : "error"}`} role="status">{notice.text}</div>}
    <form className="data-card" onSubmit={save}>
      <div className="logo-field"><ProductImage src={form.logoUrl} alt="Logo"/><label className="field"><span>{uploading ? "Uploading logo…" : "Logo"}</span><input type="file" accept="image/*" onChange={upload} disabled={uploading}/></label></div>
      <div className="form-row"><label className="field"><span>{PROFILE_FIELDS[0][1]}</span><input value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required/></label><CategorySelect valueKey="name" label="What you supply" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} required/></div>
      <div className="form-row">{PROFILE_FIELDS.slice(1, 3).map(([key, label]) => <label className="field" key={key}><span>{label}</span><input type={key === "email" ? "email" : "text"} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} required/></label>)}</div>
      <label className="field"><span>{PROFILE_FIELDS[3][1]}</span><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required/></label>
      <label className="field"><span>Description</span><textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What you supply, minimum orders, delivery areas…" required/></label>
      <button className="gradient-btn" disabled={saving || uploading}>{saving ? "Saving…" : "Save profile"}</button>
    </form></>;
}


export default function SupplierDashboard() { const path = useLocation().pathname; let page = <Overview/>; if (path.includes("/sales")) page = <Sales/>; else if (path.includes("/products")) page = <SupplierProducts/>; else if (path.includes("/stores")) page = <Stores/>; else if (path.includes("/orders")) page = <WholesaleOrders role="supplier"/>; else if (path.includes("/quotes")) page = <SupplierQuotes/>; else if (path.includes("/inventory")) page = <SupplierInventory/>; else if (path.includes("/analytics")) page = <Analytics/>; else if (path.includes("/payments")) page = <Payments/>;  else if (path.includes("/reports")) page = <Reports/>; else if (path.includes("/team")) page = <Team/>; else if (path.includes("/notifications")) page = <NotificationPanel/>; else if (path.includes("/settings")) page = <Settings/>; return <DashboardLayout><RestrictedOverview>{page}</RestrictedOverview></DashboardLayout>; }
