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
import CategorySelect, { UnitSelect } from "../components/CategorySelect";
import { wholesaleApi } from "../API/wholesale";
import { extractErrorMessage } from "../API/client";
import { useAuth } from "../context/AuthContext";
import AddTeamMemberModal from "../components/team/AddTeamMemberModal";

const money = n => new Intl.NumberFormat("en-RW").format(Number(n) || 0) + " RWF";
// Smallest supplier payout the backend accepts.
const PAYOUT_MINIMUM = 50000;
const date = v => v ? new Date(v).toLocaleDateString("en-GB") : "—";

function Header({ eyebrow, title, description }) { return <div className="dash-page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div>; }
function Metric({ icon, label, value, sub }) { return <div className="metric"><div className="metric-icon"><Icon name={icon}/></div><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div></div>; }
function Remote({ load, children, deps = [] }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  useEffect(() => { let live = true; const refresh = () => load().then(data => live && setState({ loading: false, data, error: "" })).catch(error => live && setState({ loading: false, data: null, error: extractErrorMessage(error) })); setState({ loading: true, data: null, error: "" }); refresh(); const timer = window.setInterval(refresh, 30000); return () => { live = false; window.clearInterval(timer); }; }, deps);
  if (state.loading) return <div className="empty-state"><h3>Loading live supplier data…</h3></div>;
  if (state.error) return <div className="form-error">{state.error}</div>;
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
  const lowStock = products.filter(p => Number(p.stockQuantity || 0) < Math.max(10, Number(p.moq || 0)));
  const updated = requests.filter(r => ["APPROVED", "IN_TRANSIT", "REJECTED"].includes(r.status) && Date.now() - new Date(r.updatedAt).getTime() < 7 * 864e5);
  const items = [];
  if (toShip.length) items.push({ text: `${toShip.length} paid order${toShip.length === 1 ? "" : "s"} to ship`, hint: "The vendor has paid; MVEC holds the money until they confirm receipt.", link: "/supplier/delivery", urgent: true });
  if (lowStock.length) items.push({ text: `${lowStock.length} product${lowStock.length === 1 ? "" : "s"} running low`, hint: lowStock.slice(0, 3).map(p => p.name).join(", "), link: "/supplier/inventory" });
  if (Number(finance.availablePayout) >= PAYOUT_MINIMUM) items.push({ text: `${money(finance.availablePayout)} ready to withdraw`, hint: "Request a payout to mobile money or your bank.", link: "/supplier/payments" });
  if (updated.length) items.push({ text: `${updated.length} supply request${updated.length === 1 ? "" : "s"} updated by MVEC`, hint: updated.map(r => `${r.reference}: ${r.status.toLowerCase().replaceAll("_", " ")}`).join(" · "), link: "/supplier/supply-requests" });
  if (!products.length) items.push({ text: "Add your first wholesale product", hint: "Vendors can only order what is in your catalog.", link: "/supplier/products", urgent: true });
  return items;
}

function Overview() { const { user } = useAuth(); const restricted = user?.isOnboarded === false; if (restricted) return <><Header eyebrow="SUPPLIER PLATFORM" title="Supplier dashboard" description="Complete onboarding to unlock live supplier operations."/><div className="metric-grid"><Metric icon="box" label="Wholesale products" value="—" sub="Available after onboarding"/><Metric icon="cart" label="Vendor orders" value="—" sub="Available after onboarding"/><Metric icon="chart" label="Sales" value="—" sub="Available after onboarding"/><Metric icon="wallet" label="Protected funds" value="—" sub="Available after onboarding"/></div></>; return <Remote load={async () => { const [finance, products, delivery, orders, requests] = await Promise.all([suppliersApi.getFinanceSummary(), suppliersApi.getMyProducts(), suppliersApi.getDeliverySummary(), wholesaleApi.getMine().catch(() => ({ orders: [] })), suppliersApi.getSupplyRequests().catch(() => ({ requests: [] }))]); return { finance: finance.summary || {}, products: products.products || [], delivery: delivery.summary || {}, orders: orders.orders || [], requests: requests.requests || [] }; }}>
  {(data) => { const { finance, products, delivery } = data; const todo = todoList(data); return <><Header eyebrow="SUPPLIER PLATFORM" title="Supplier dashboard" description="What needs your attention, and how your wholesale business is doing."/><VerificationBanner/>
    <div className="data-card attention-card"><div className="data-card-head"><div><h3>To do</h3><span>{todo.length ? "Updates every 30 seconds" : "You are all caught up"}</span></div></div>
      {todo.length === 0 ? <div className="empty-state"><h3>Nothing waiting</h3><p>New orders, low stock and payouts show up here.</p></div> : <div className="attention-list">{todo.map(it => <Link key={it.text} to={it.link} className={`attention-item ${it.urgent ? "urgent" : ""}`}><span><b>{it.text}</b>{it.hint && <small>{it.hint}</small>}</span><Icon name="arrow" size={14}/></Link>)}</div>}
    </div>
    <div className="metric-grid"><Metric icon="box" label="Wholesale products" value={products.length} sub="In your catalog"/><Metric icon="cart" label="Vendor orders" value={Number(delivery.activeShipments || 0) + Number(delivery.deliveredThisMonth || 0)} sub={`${delivery.activeShipments || 0} in progress`}/><Metric icon="chart" label="Sales" value={money(finance.grossSales)} sub="Total wholesale sales"/><Metric icon="wallet" label="Held by MVEC" value={money(finance.escrowHeld)} sub="Paid to you when vendors confirm receipt"/></div></>; }}
</Remote>; }

const WHOLESALE_STATUS = [["ACTIVE", "Active: vendors can order it"], ["ARCHIVED", "Archived: hidden from vendors"]];

function ProductForm({ value, onCancel, onSave }) {
  const [form, setForm] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = e => setForm({ ...form, [e.target.name]: e.target.value });
  const number = (key, label, extra = {}) => <label className="field"><span>{label}</span><input type="number" min="0" name={key} value={form[key] ?? ""} onChange={update} {...extra}/></label>;
  const submit = async e => { e.preventDefault(); setSaving(true); setError(""); try { await onSave(form); } catch (err) { setError(extractErrorMessage(err)); } finally { setSaving(false); } };
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}><button type="button" className="modal-close" onClick={onCancel} aria-label="Close">×</button><h2>{value._id ? "Edit" : "Add"} wholesale product</h2>
    {error && <div className="form-alert error" role="alert">{error}</div>}
    <label className="field"><span>Product name *</span><input name="name" value={form.name || ""} onChange={update} required/></label>
    <div className="form-row"><CategorySelect valueKey="name" label="Category" name="category" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} required/><UnitSelect value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} label="Sold per"/></div>
    <div className="form-row">{number("wholesalePrice", "Wholesale price (RWF) *", { required: true })}{number("retailPrice", "Suggested retail price (RWF)")}</div>
    <div className="form-row">{number("moq", "Minimum order (units) *", { min: 1, required: true })}{number("stockQuantity", "Units in stock *", { required: true })}</div>
    <div className="form-row">{number("bulkDiscount", "Bulk discount (%)", { max: 100 })}<label className="field"><span>Status</span><select name="status" value={form.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE"} onChange={update}>{WHOLESALE_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label></div>
    <label className="field"><span>Short description</span><textarea name="shortDescription" rows={3} value={form.shortDescription || ""} onChange={update}/></label>
    <div className="modal-actions"><button type="button" className="outline-btn" onClick={onCancel}>Cancel</button><button className="gradient-btn" disabled={saving}>{saving ? "Saving…" : "Save"}</button></div>
  </form></div>;
}

function ProductTable({ products }) {
  const [edit, setEdit] = useState(null);
  const [rows, setRows] = useState(products);
  const [notice, setNotice] = useState("");
  useEffect(() => setRows(products), [products]);
  // Errors are shown inside the form (ProductForm catches them).
  const save = async value => { const result = value._id ? await suppliersApi.updateProduct(value._id, value) : await suppliersApi.createProduct(value); setRows(current => value._id ? current.map(row => row._id === value._id ? result.product : row) : [result.product, ...current]); setEdit(null); };
  const remove = async row => { try { await suppliersApi.deleteProduct(row._id); setRows(current => current.filter(item => item._id !== row._id)); } catch (error) { setNotice(extractErrorMessage(error)); } };
  return <><Header eyebrow="SUPPLIER PLATFORM" title="Wholesale products" description="Manage products stored in the supplier catalog."/><button className="gradient-btn" onClick={() => setEdit({ name: "", category: "General", unit: "piece", wholesalePrice: 0, moq: 1, stockQuantity: 0, bulkDiscount: 0, shortDescription: "" })}><Icon name="plus"/> Add wholesale product</button>{notice && <div className="form-error">{notice}</div>}<div className="data-card"><SmartTable columns={[{ key: "name", label: "Product" }, { key: "category", label: "Category" }, { key: "wholesalePrice", label: "Wholesale price", render: r => money(r.wholesalePrice) }, { key: "stockQuantity", label: "Stock" }, { key: "status", label: "Status" }]} rows={rows} rowKey={r => r._id} searchPlaceholder="Search wholesale products…" empty="No wholesale products in the database." actions={r => <><button onClick={() => setEdit(r)} title="Edit"><Icon name="edit"/></button><button onClick={() => remove(r)} title="Delete"><Icon name="trash"/></button></>}/></div>{edit && <ProductForm value={edit} onCancel={() => setEdit(null)} onSave={save}/>}</>;
}
function Products() { return <Remote load={suppliersApi.getMyProducts}>{({ products = [] }) => <ProductTable products={products}/>}</Remote>; }

function Orders() { return <Remote load={wholesaleApi.getMine}>{data => <><Header eyebrow="B2B ORDERS" title="Vendor orders" description="Wholesale orders stored for this supplier account."/><div className="data-card"><SmartTable columns={[{ key: "orderNumber", label: "Order" }, { key: "vendor", label: "Vendor", render: r => r.vendor?.companyName || r.vendor?.Fullname || "Vendor" }, { key: "totalAmount", label: "Total", render: r => money(r.totalAmount) }, { key: "status", label: "Status" }, { key: "createdAt", label: "Created", render: r => date(r.createdAt) }]} rows={data.orders || []} rowKey={r => r._id} searchPlaceholder="Search vendor orders…" empty="No wholesale orders in the database."/></div></>}</Remote>; }
function Inventory() { return <Remote load={suppliersApi.getMyProducts}>{({ products = [] }) => <><Header eyebrow="INVENTORY" title="Inventory" description="Stock quantities from supplier product records."/><div className="metric-grid"><Metric icon="box" label="Stock units" value={products.reduce((sum, p) => sum + Number(p.stockQuantity || 0), 0)} sub="Across database products"/><Metric icon="grid" label="Low stock" value={products.filter(p => Number(p.stockQuantity || 0) < 10).length} sub="Below 10 units"/><Metric icon="cart" label="Catalog items" value={products.length} sub="Supplier products"/></div><div className="data-card"><SmartTable columns={[{ key: "name", label: "Product" }, { key: "stockQuantity", label: "Available" }, { key: "moq", label: "MOQ" }, { key: "status", label: "Status" }]} rows={products} rowKey={r => r._id} searchPlaceholder="Search inventory…" empty="No inventory records in the database."/></div></>}</Remote>; }
function Analytics() { const [range, setRange] = useState("30d"); return <Remote load={() => suppliersApi.getAnalytics({ range })} deps={[range]}>{({ analytics = {} }) => <><Header eyebrow="ANALYTICS" title="Analytics" description="Wholesale performance calculated from stored orders."/><select className="period-select" value={range} onChange={e => setRange(e.target.value)}><option value="30d">30 days</option><option value="3m">3 months</option><option value="1y">1 year</option></select><div className="metric-grid"><Metric icon="chart" label="Sales" value={money(analytics.grossSales)} sub={`${analytics.orderCount || 0} database orders`}/><Metric icon="cart" label="Units sold" value={analytics.unitsSold || 0} sub="Recorded order items"/><Metric icon="users" label="Average order" value={money(analytics.averageOrderValue)} sub="Calculated from orders"/></div><div className="data-card"><SmartTable columns={[{ key: "name", label: "Product" }, { key: "units", label: "Units" }, { key: "revenue", label: "Revenue", render: r => money(r.revenue) }]} rows={analytics.topProducts || []} rowKey={r => r.name} searchPlaceholder="Search product performance…" empty="No analytics records for this period."/></div></>}</Remote>; }
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
function Reports() { return <Remote load={async () => { const [summary, analytics, ledger] = await Promise.all([suppliersApi.getFinanceSummary(), suppliersApi.getAnalytics({ range: "30d" }), suppliersApi.getFinanceLedger()]); return { summary: summary.summary || {}, analytics: analytics.analytics || {}, ledger: ledger.entries || [] }; }}>{({ summary, analytics, ledger }) => <><Header eyebrow="REPORTS" title="Reports" description="Reports generated from supplier financial and order records."/><div className="data-card"><SmartTable columns={[{ key: "description", label: "Record" }, { key: "kind", label: "Type" }, { key: "amount", label: "Amount", render: r => money(r.amount) }, { key: "at", label: "Date", render: r => date(r.at) }]} rows={ledger} rowKey={r => r._id} searchPlaceholder="Search report records…" empty="No report records in the database."/><p className="tiny">30 day sales: {money(analytics.grossSales)} · Total recorded sales: {money(summary.grossSales)}</p></div></>}</Remote>; }
function Team() { const [members,setMembers]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [editing,setEditing]=useState(null); const load=()=>{setLoading(true);return suppliersApi.getTeam().then(data=>setMembers(data.members||[])).catch(e=>setError(extractErrorMessage(e))).finally(()=>setLoading(false));}; useEffect(()=>{load();},[]); const save=async form=>{setError(""); const payload={fullName:form.name,phone:form.phone,email:form.email,password:form.password,role:form.role}; if(form.id){await suppliersApi.updateTeamMember(form.id,{...payload,status:form.status});setNotice("Team member updated.");}else{await suppliersApi.addTeamMember(payload);setNotice("Team member added.");}setEditing(null);await load();}; const remove=async row=>{if(!window.confirm(`Remove ${row.fullName||"this team member"}?`))return;try{await suppliersApi.removeTeamMember(row._id);setNotice("Team member removed.");await load();}catch(e){setError(extractErrorMessage(e));}}; return <><div className="dash-page-head"><div><span className="eyebrow">TEAM / STAFF</span><h1>Team & staff</h1><p>Live supplier team records from the database.</p></div><button className="gradient-btn" onClick={()=>setEditing({})}><Icon name="plus"/> Add team member</button></div>{notice&&<div className="form-alert success">{notice}</div>}{error&&<div className="form-error">{error}</div>}<div className="data-card">{loading?<div className="empty-state"><h3>Loading team…</h3></div>:<SmartTable columns={[{ key: "fullName", label: "Member" }, { key: "role", label: "Role" }, { key: "phone", label: "Phone" }, { key: "status", label: "Status" }]} rows={members} rowKey={r => r._id} searchPlaceholder="Search team…" empty="No team members in the database." actions={row=>row.role!=="OWNER"&&<><button className="table-action-btn" onClick={()=>setEditing(row)}>Edit</button><button className="table-action-btn" onClick={()=>remove(row)}>Remove</button></>}/>}</div>{editing&&<AddTeamMemberModal mode="supplier" value={editing} onCancel={()=>setEditing(null)} onSave={save}/>}</>; }
const PROFILE_FIELDS = [["businessName", "Business name"], ["phone", "Phone"], ["email", "Email"], ["location", "Location (district, sector)"]];

function Settings() {
  const { refresh } = useAuth();
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState({});
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { suppliersApi.getMyProfile().then(result => { const p = result.supplier || result; setStatus({ verificationStatus: p.verificationStatus, verificationNote: p.verificationNote }); setForm({ businessName: p.businessName || "", category: p.category || "", phone: p.phone || "", email: p.email || "", location: typeof p.location === "object" && p.location ? Object.values(p.location).filter(Boolean).join(", ") : p.location || "", description: p.description || "", logoUrl: p.logoUrl || "" }); }).catch(err => setError(extractErrorMessage(err))); }, []);
  if (error) return <div className="form-error">{error}</div>;
  if (!form) return <div className="empty-state"><h3>Loading profile…</h3></div>;
  const upload = async e => { const file = e.target.files?.[0]; if (!file) return; try { const { urls } = await uploadsApi.uploadImages([file]); setForm(f => ({ ...f, logoUrl: urls?.[0] || f.logoUrl })); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } };
  const save = async e => { e.preventDefault(); setSaving(true); setNotice(null); try { const res = await suppliersApi.updateMyProfile(form); setStatus({ verificationStatus: res.supplier?.verificationStatus, verificationNote: res.supplier?.verificationNote }); setNotice({ ok: true, text: res.message || "Profile saved." }); refresh?.(); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setSaving(false); } };
  return <><Header eyebrow="SETTINGS" title="Supplier profile" description="Vendors see this profile. Keep it complete so MVEC can verify you."/>
    {status.verificationStatus === "REJECTED" && <div className="form-alert error"><b>MVEC asked for changes:</b> {status.verificationNote || "Check your details."} Saving sends your profile back for review.</div>}
    {notice && <div className={`form-alert ${notice.ok ? "success" : "error"}`} role="status">{notice.text}</div>}
    <form className="data-card" onSubmit={save}>
      <div className="logo-field"><ProductImage src={form.logoUrl} alt="Logo"/><label className="field"><span>Logo</span><input type="file" accept="image/*" onChange={upload}/></label></div>
      <div className="form-row"><label className="field"><span>{PROFILE_FIELDS[0][1]}</span><input value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required/></label><CategorySelect valueKey="name" label="What you supply" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} required/></div>
      <div className="form-row">{PROFILE_FIELDS.slice(1, 3).map(([key, label]) => <label className="field" key={key}><span>{label}</span><input type={key === "email" ? "email" : "text"} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} required/></label>)}</div>
      <label className="field"><span>{PROFILE_FIELDS[3][1]}</span><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required/></label>
      <label className="field"><span>Description</span><textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What you supply, minimum orders, delivery areas…" required/></label>
      <button className="gradient-btn" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
    </form></>;
}

const REQUEST_STATUS = { SUBMITTED: "Sent to MVEC", UNDER_REVIEW: "MVEC is reviewing", APPROVED: "Approved", SOURCING: "Being sourced", IN_TRANSIT: "On the way", RECEIVED: "Received", REJECTED: "Declined", CANCELLED: "Withdrawn" };
const emptyLine = () => ({ product: "", units: 1, unit: "piece", unitPrice: 0 });

function SupplyRequests() {
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setNotice(null);
    try { await suppliersApi.createSupplyRequest({ ...form, lines: form.lines.map(l => ({ ...l, units: Number(l.units), unitPrice: Number(l.unitPrice) })) }); setForm(null); setNotice({ ok: true, text: "Request sent. MVEC reviews it and you get a notification at every step." }); setTick(t => t + 1); }
    catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(false); }
  };
  const withdraw = async r => { const reason = window.prompt("Why are you withdrawing this request? (optional)"); if (reason === null) return; try { await suppliersApi.cancelSupplyRequest(r._id, reason); setNotice({ ok: true, text: `${r.reference} withdrawn.` }); setTick(t => t + 1); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } };
  const setLine = (i, key, value) => setForm(f => ({ ...f, lines: f.lines.map((l, n) => n === i ? { ...l, [key]: value } : l) }));
  return <><Header eyebrow="SUPPLY" title="Supply requests" description="Ask MVEC to source goods for you. MVEC reviews, approves, sources and delivers; you are told at each step."/>
    {notice && <div className={`form-alert ${notice.ok ? "success" : "error"}`} role="status">{notice.text}</div>}
    {!form ? <button type="button" className="gradient-btn" onClick={() => setForm({ neededBy: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), note: "", lines: [emptyLine()] })}><Icon name="plus"/> New request</button>
      : <form className="data-card" onSubmit={submit}><h3>New supply request</h3>
        {form.lines.map((l, i) => <div className="form-row supply-line" key={i}>
          <label className="field"><span>Item</span><input value={l.product} onChange={e => setLine(i, "product", e.target.value)} required/></label>
          <label className="field"><span>Quantity</span><input type="number" min="1" value={l.units} onChange={e => setLine(i, "units", e.target.value)} required/></label>
          <UnitSelect value={l.unit} onChange={v => setLine(i, "unit", v)}/>
          <label className="field"><span>Target price per unit</span><input type="number" min="0" value={l.unitPrice} onChange={e => setLine(i, "unitPrice", e.target.value)} required/></label>
          {form.lines.length > 1 && <button type="button" className="outline-btn" aria-label="Remove item" onClick={() => setForm(f => ({ ...f, lines: f.lines.filter((_, n) => n !== i) }))}>Remove</button>}
        </div>)}
        <button type="button" className="outline-btn" onClick={() => setForm(f => ({ ...f, lines: [...f.lines, emptyLine()] }))}>Add another item</button>
        <div className="form-row"><label className="field"><span>Needed by</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={form.neededBy} onChange={e => setForm({ ...form, neededBy: e.target.value })} required/></label>
          <label className="field"><span>Note (optional)</span><input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}/></label></div>
        <div className="row-actions"><button type="button" className="outline-btn" onClick={() => setForm(null)}>Cancel</button><button className="gradient-btn" disabled={busy}>{busy ? "Sending…" : "Send to MVEC"}</button></div>
      </form>}
    <Remote deps={[tick]} load={() => suppliersApi.getSupplyRequests()}>{({ requests = [] }) => <div className="data-card">{requests.length === 0 ? <div className="empty-state"><h3>No supply requests yet</h3></div> : <div className="orders-list">{requests.map(r => <div className="order-row" key={r._id}>
      <div className="order-row-main"><b>{r.reference}</b>{(r.lines || []).map((l, i) => <small key={i}>{l.units} {l.unit} × {l.product}</small>)}<small>Needed by {date(r.neededBy)}</small>{r.decision && <small>MVEC: {r.decision}</small>}</div>
      <div className="order-row-meta"><span className={`status ${["RECEIVED", "APPROVED"].includes(r.status) ? "active" : ["REJECTED", "CANCELLED"].includes(r.status) ? "danger" : "pending"}`}>{REQUEST_STATUS[r.status] || r.status}</span><small>Updated {date(r.updatedAt)}</small></div>
      <div className="order-row-actions">{["SUBMITTED", "UNDER_REVIEW", "SOURCING"].includes(r.status) && <button type="button" className="outline-btn" onClick={() => withdraw(r)}>Withdraw</button>}</div>
    </div>)}</div>}</div>}</Remote></>;
}

export default function SupplierDashboard() { const path = useLocation().pathname; let page = <Overview/>; if (path.includes("/products")) page = <Products/>; else if (path.includes("/orders")) page = <Orders/>; else if (path.includes("/inventory")) page = <Inventory/>; else if (path.includes("/analytics")) page = <Analytics/>; else if (path.includes("/payments")) page = <Payments/>; else if (path.includes("/supply-requests")) page = <SupplyRequests/>; else if (path.includes("/reports")) page = <Reports/>; else if (path.includes("/team")) page = <Team/>; else if (path.includes("/notifications")) page = <NotificationPanel/>; else if (path.includes("/settings")) page = <Settings/>; return <DashboardLayout><RestrictedOverview>{page}</RestrictedOverview></DashboardLayout>; }
