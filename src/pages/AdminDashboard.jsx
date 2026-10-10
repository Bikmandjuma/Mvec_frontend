import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";
import SmartTable from "../components/SmartTable";
import { adminApi } from "../API/admin";
import { categoriesApi } from "../API/categories";
import { extractErrorMessage } from "../API/client";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function money(value) {
  return new Intl.NumberFormat("en-RW").format(value) + " RWF";
}

// -----------------------------------------------------------------------------
// Metric
// -----------------------------------------------------------------------------

function Metric({ label, value, change, icon }) {
  return (
    <div className="metric">
      <div className="metric-icon">
        <Icon name={icon} />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small className="positive">{change}</small>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Generic Admin Table
// -----------------------------------------------------------------------------

function GenericAdminTable({ title, subtitle, type }) {
  const [list, setList] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const params = { page, pageSize: 20, limit: 20 };
    if (type === "users" && roleFilter) params.role = roleFilter;

    const call =
      type === "users" ? adminApi.getUsers(params) :
      type === "vendors" ? adminApi.getVendors(params) :
      type === "products" ? adminApi.getProducts(params) :
      type === "orders" ? adminApi.getOrders(params) :
      type === "categories" ? Promise.resolve(null) :
      Promise.resolve(null);

    if (type === "categories") {
      // Categories are public and unpaginated
      categoriesApi.getAll().then((res) => {
        if (!alive) return;
        setList(res.categories || []);
        setMeta({ total: (res.categories || []).length });
      }).catch((err) => alive && setError(extractErrorMessage(err))).finally(() => alive && setLoading(false));
      return () => { alive = false; };
    }

    call.then((res) => {
      if (!alive) return;
      setList(res.data || res.users?.data || []);
      setMeta(res.meta || { total: (res.data || []).length });
    }).catch((err) => alive && setError(extractErrorMessage(err)))
      .finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [type, page, roleFilter]);

  const rows = (() => {
    if (type === "users") {
      return list.map((u) => { const rawStatus=String(u.status||"ACTIVE").toUpperCase(); return { id: u.id, name: u.name || u.fullName || u.Fullname || "Unnamed user", email: u.email || "—", role: u.role, rawStatus, status: ["BLOCK", "BLOCKED"].includes(rawStatus) ? "Blocked" : ["SUSPEND", "SUSPENDED"].includes(rawStatus) ? "Suspended" : rawStatus === "INVESTIGATE" ? "Investigate" : "Active" }; });
    }
    if (type === "vendors") {
      return list.map((v) => ({
        id: v.id || v._id, name: v.businessName,
        category: v.user?.companyName ? "Registered business" : "Marketplace vendor",
        products: v.productCount ?? 0, rating: v.ratingAvg || 0, status: v.verificationStatus,
      }));
    }
    if (type === "products") {
      return list.map((p) => ({
        id: p.id || p._id, name: p.name, vendor: p.vendor?.companyName || p.vendor?.fullName || p.vendor?.Fullname || "Unknown vendor",
        price: p.price, stock: p.stockQuantity, status: p.status,
      }));
    }
    if (type === "categories") {
      return list.map((c) => ({
        id: c.id,
        name: c.name,
        products: c.productCount ?? c._count?.products ?? 0,
        status: c.active ? "Active" : "Inactive",
        productCount: c.productCount ?? c._count?.products ?? 0,
        hasSubcategories: false, // Will be checked on delete
      }));
    }
    if (type === "orders") {
      return list.map((o) => ({
        id: o.orderNumber, buyer: o.user?.fullName || o.user?.Fullname || "Unknown buyer",
        vendor: o.items?.[0]?.vendor?.companyName || o.items?.[0]?.vendor?.fullName || o.items?.[0]?.vendor?.Fullname || "Multiple vendors",
        total: o.totalAmount, payment: o.paymentStatus, status: o.orderStatus,
      }));
    }
    return [];
  })();

  const columns = type==='users' ? [
    {key:'name',label:'User'},{key:'email',label:'Email'},{key:'role',label:'Role'},{key:'status',label:'Status',render:r=><em className={'status '+(r.status==='Blocked'?'warning':'active')}>{r.status}</em>}
  ] : type==='vendors' ? [
    {key:'name',label:'Store'},{key:'category',label:'Category'},{key:'products',label:'Products'},{key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},{key:'status',label:'Status',render:r=><em className={'status '+(r.status==='VERIFIED'?'active':'warning')}>{r.status}</em>}
  ] : type==='products' ? [
    {key:'name',label:'Product'},{key:'vendor',label:'Vendor'},{key:'price',label:'Price',render:r=>money(r.price)},{key:'stock',label:'Stock'},{key:'status',label:'Status',render:r=><em className={'status '+(r.status==='ACTIVE'?'active':'warning')}>{r.status}</em>}
  ] : type==='orders' ? [
    {key:'id',label:'Order'},{key:'buyer',label:'Buyer'},{key:'vendor',label:'Vendor'},{key:'total',label:'Total',render:r=>money(r.total)},{key:'payment',label:'Payment',render:r=><em className={'status '+(r.payment==='PAID'?'active':'warning')}>{r.payment}</em>},{key:'status',label:'Status'}
  ] : [
    {key:'name',label:'Category'},{key:'products',label:'Products'},{key:'status',label:'Status',render:r=><em className={'status '+(r.status==='Active'?'active':'warning')}>{r.status}</em>}
  ];

  const [busyId, setBusyId] = useState(null);
  const toggleUserBlock = async (row) => {
    const nextStatus = row.status === "Active" ? "BLOCK" : "ACTIVE";
    const confirmMsg = nextStatus === "BLOCK"
      ? `Block ${row.name || row.email}? They will not be able to log in.`
      : `Unblock ${row.name || row.email}?`;
    if (!window.confirm(confirmMsg)) return;
    setBusyId(row.id);
    try {
      await adminApi.updateUserStatus(row.id, { status: nextStatus });
      setList((current) => current.map((u) => (u.id === row.id ? { ...u, status: nextStatus } : u)));
    } catch (err) {
      window.alert(extractErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  function deleteCategory(category) {
    if (category.products && category.products > 0) {
      window.alert(`Cannot delete category "${category.name}": It has ${category.products} product(s). Please reassign or remove all products before deleting.`);
      return;
    }
    if (window.confirm(`Delete category "${category.name}"? This will soft-delete the category (set it as inactive).`)) {
      setBusyId(category.id);
      categoriesApi.delete(category.id).then((res) => {
        const message = res?.message || "Operation completed";
        setList((current) => current.map((c) => (c.id === category.id ? { ...c, active: false, status: "Inactive" } : c)));
        window.alert(message || "Category successfully disabled");
        setBusyId(null);
      }).catch((err) => {
        window.alert(extractErrorMessage(err));
        setBusyId(null);
      });
    }
  };

  return (
    <DashboardLayout admin>
      <div className="dash-page-head"><div><span className="eyebrow">SUPER ADMIN</span><h1>{title}</h1><p>{subtitle}</p></div></div>
      <div className="verified-box"><b>Live marketplace data</b><p>This list is read directly from the MVEC database. User actions update the account record and take effect across the marketplace.</p></div>
      <div className="data-card">
        <div className="data-card-head">
          <div><h3>{title}</h3><span>{meta.total} records</span></div>
          {type === "users" && <label className="field"><span>Filter by role</span><select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}><option value="">All roles</option><option value="buyer">Buyers</option><option value="vendor">Vendors</option><option value="affiliate">Affiliates</option><option value="supplier">Suppliers</option><option value="super_admin">Administrators</option><option value="developer">Developers</option></select></label>}
        </div>
        <span className="muted">Marketplace records from the database</span>
        {loading && <div className="empty-state"><h3>Loading…</h3></div>}
        {!loading && error && <div className="empty-state"><h3>Couldn't load {title.toLowerCase()}</h3><p>{error}</p></div>}
        {!loading && !error && <SmartTable columns={columns} rows={rows} rowKey={(r, i) => r.id || r.email || r.name || i} searchPlaceholder={`Search ${title.toLowerCase()}…`} exportName={`admin-${type}`} actions={item => <>
          {type === "users" && item.role !== "super_admin" && <button className="table-action-btn" disabled={busyId === item.id} onClick={() => toggleUserBlock(item)}>{item.status === "Active" ? "Block" : "Unblock"}</button>}
          <button className="table-action-btn" onClick={() => setViewing(item)}><Icon name="eye" /> View</button>
          {type === "categories" && <button className="table-action-btn" onClick={() => deleteCategory(item)}><Icon name="trash" /> Delete</button>}
        </>} />}
        {!loading && !error && meta.total > 20 && <Pagination page={page} setPage={setPage} total={meta.total} perPage={20} />}
      </div>
      {viewing && <AdminRecordView title={`${title.slice(0, -1)} record`} record={viewing} onClose={() => setViewing(null)} />}
    </DashboardLayout>
  );
}
function AdminRecordView({title,record,onClose}){return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><span className="eyebrow">ACCOUNT REVIEW</span><h2>{title}</h2><div className="vendor-detail-grid">{Object.entries(record).filter(([k])=>k!=='id').map(([k,v])=><div key={k}><span>{k.replace(/([A-Z])/g,' $1')}</span><b>{String(v)}</b></div>)}</div><button className="gradient-btn" onClick={onClose}>Done</button></div></div>}

function VendorQuickView({vendor,onClose}){return <div className="modal-backdrop"><div className="modal vendor-view-modal"><button className="modal-close" onClick={onClose}>×</button><span className="eyebrow">VENDOR PROFILE</span><h2>{vendor.name}</h2><p>MVEC marketplace vendor overview.</p><div className="vendor-detail-grid"><div><span>Category</span><b>{vendor.category}</b></div><div><span>Products</span><b>{vendor.products}</b></div><div><span>Rating</span><b>★ {vendor.rating}</b></div><div><span>Status</span><b className="status active">Approved</b></div><div><span>Vendor ID</span><b>VND-{String(vendor.id).padStart(4,'0')}</b></div><div><span>Trust</span><b>Verified ✓</b></div></div><div className="verified-box"><b>🔒 Protected settlement</b><p>Eligible order funds are shown as held by MVEC until delivery confirmation and release according to the marketplace workflow.</p></div><button className="gradient-btn" onClick={onClose}>Done</button></div></div>}
function DeleteVendorModal({vendor,onCancel,onDelete}){return <div className="modal-backdrop"><div className="modal confirm-modal"><button className="modal-close" onClick={onCancel}>×</button><div className="danger-icon">!</div><h2>Delete this vendor?</h2><p>You are about to delete <strong>{vendor.name}</strong>. This action removes the vendor from the marketplace records. Are you sure you want to continue?</p><div className="modal-actions"><button className="outline-btn" onClick={onCancel}>Cancel</button><button className="danger-btn" onClick={onDelete}>Yes, delete vendor</button></div></div></div>}

function DeleteCategoryModal({category,onCancel,onDelete}) {
  const productCount = category.products || 0;
  return <div className="modal-backdrop">
    <div className="modal confirm-modal">
      <button className="modal-close" onClick={onCancel}>×</button>
      <div className="danger-icon">!</div>
      <h2>Delete this category?</h2>
      <p>
        This category has {productCount} product(s).{productCount > 0 ? ' Please reassign or remove all products before deleting.' : ' You may proceed with deletion.'}
      </p>
      <div className="modal-actions">
        <button className="outline-btn" onClick={onCancel}>Cancel</button>
        <button className="danger-btn" onClick={onDelete}>Yes, delete category</button>
      </div>
    </div>
  </div>;
}

function AdminEditModal({value,isNew,onCancel,onSave}){
 const [row,setRow]=useState(value);
 const fields=Object.keys(row).filter(k=>k!=="id" && k!=="image");
 return <div className="modal-backdrop"><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onCancel}>×</button><h2>{isNew?"Add":"Edit"} record</h2><p>Update the marketplace record and save your changes.</p>{fields.map(k=><label className="field" key={k}><span>{k.replace(/([A-Z])/g," $1")}</span><input value={row[k]??""} onChange={e=>setRow({...row,[k]:e.target.value})}/></label>)}<div className="modal-actions"><button className="outline-btn" onClick={onCancel}>Cancel</button><button className="gradient-btn" onClick={()=>onSave(row)}>Save changes</button></div></div></div>;
}

function AdminReports(){
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    adminApi.getOverview().then((res) => alive && setOverview(res.overview)).catch((err) => alive && setError(extractErrorMessage(err))).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);
  const rows = overview ? [
    ['Gross sales today', 'Today', money(overview.gmvToday)],
    ['Orders today', 'Today', overview.ordersToday],
    ['MVEC commission today', 'Today', money(overview.mvecRevenueToday)],
    ['Open disputes', 'Live', overview.pendingDisputes],
    ['Disputes under review', 'Live', overview.pendingRefunds],
    ['Orders in transit', 'Live', overview.pendingDeliveries],
    ['Pending vendor verifications', 'Live', overview.pendingVendorVerifications],
  ].map(r=>({report:r[0],range:r[1],summary:r[2]})) : [];
  return <DashboardLayout admin><div className="dash-page-head"><div><span className="eyebrow">ADMIN CONTROL</span><h1>Reports</h1><p>Platform-wide revenue, vendors, orders, payments and marketplace performance.</p></div></div>{error&&<div className="form-error">Reports are unavailable: {error}</div>}<div className="metric-grid"><Metric label="Gross sales" value={overview?money(overview.gmvToday):loading?'...':'Unavailable'} change="Today" icon="chart"/><Metric label="Orders" value={overview?overview.ordersToday:loading?'...':'Unavailable'} change="Today" icon="cart"/><Metric label="Vendors" value={overview?overview.totalVendors:loading?'...':'Unavailable'} change="Marketplace vendor accounts" icon="shop"/><Metric label="Commission" value={overview?money(overview.mvecRevenueToday):loading?'...':'Unavailable'} change="Today" icon="wallet"/></div><div className="data-card"><div className="data-card-head"><div><h3>Platform reports</h3><span>Live reporting data</span></div></div>{loading && <div className="empty-state"><h3>Loading…</h3></div>}{!loading && !error && <SmartTable columns={[{key:'report',label:'Report',render:r=><b>{r.report}</b>},{key:'range',label:'Range'},{key:'summary',label:'Summary'}]} rows={rows} rowKey={r=>r.report} searchPlaceholder="Search reports…" exportName="admin-platform-reports"/>}</div></DashboardLayout>}
function AdminSettings(){const initial={marketplaceName:'MVEC',currency:'RWF',vendorApproval:'Manual',commission:'10%',cancellation:'24 hours',reviews:'Required',orders:'Enabled',shipping:'Enabled',payouts:'Enabled'};const [settings,setSettings]=useState(()=>{try{return JSON.parse(localStorage.getItem('mvec_admin_settings'))||initial}catch{return initial}});const [saved,setSaved]=useState(false);const u=(key,value)=>setSettings(s=>({...s,[key]:value}));const save=()=>{localStorage.setItem('mvec_admin_settings',JSON.stringify(settings));setSaved(true);setTimeout(()=>setSaved(false),1800)};return <DashboardLayout admin><div className="dash-page-head"><div><span className="eyebrow">ADMIN CONTROL</span><h1>Platform Settings</h1><p>Configure marketplace-wide rules and system behavior.</p></div><button className="gradient-btn" onClick={save}>Save changes</button></div>{saved&&<div className="success-text">Platform settings saved.</div>}<div className="settings-grid"><div className="data-card"><h3>Marketplace</h3><label className="field"><span>Marketplace name</span><input value={settings.marketplaceName} onChange={e=>u('marketplaceName',e.target.value)}/></label><label className="field"><span>Default currency</span><select value={settings.currency} onChange={e=>u('currency',e.target.value)}><option>RWF</option><option>USD</option></select></label><label className="field"><span>Vendor approval</span><select value={settings.vendorApproval} onChange={e=>u('vendorApproval',e.target.value)}><option>Manual</option><option>Automatic</option></select></label></div><div className="data-card"><h3>Commerce rules</h3><label className="field"><span>Platform commission</span><input value={settings.commission} onChange={e=>u('commission',e.target.value)}/></label><label className="field"><span>Order cancellation window</span><input value={settings.cancellation} onChange={e=>u('cancellation',e.target.value)}/></label><label className="field"><span>Reviews moderation</span><select value={settings.reviews} onChange={e=>u('reviews',e.target.value)}><option>Required</option><option>Optional</option></select></label></div><div className="data-card"><h3>Notifications</h3><label className="field"><span>Order notifications</span><select value={settings.orders} onChange={e=>u('orders',e.target.value)}><option>Enabled</option><option>Disabled</option></select></label><label className="field"><span>Shipping notifications</span><select value={settings.shipping} onChange={e=>u('shipping',e.target.value)}><option>Enabled</option><option>Disabled</option></select></label><label className="field"><span>Payout notifications</span><select value={settings.payouts} onChange={e=>u('payouts',e.target.value)}><option>Enabled</option><option>Disabled</option></select></label></div></div></DashboardLayout>}

// -----------------------------------------------------------------------------
// Admin Dashboard
// -----------------------------------------------------------------------------

export default function AdminDashboard() {const [createOpen,setCreateOpen]=useState(false);
  const [overview, setOverview] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [categoryHealth, setCategoryHealth] = useState([]);
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState("");
  const location = useLocation();
  const path = location.pathname;

  useEffect(() => {
    if (path !== "/admin") return;
    let alive = true;
    const refresh = async (initial = false) => {
      if (initial) setDashLoading(true);
      const [overviewRes, ordersRes] = await Promise.allSettled([
        adminApi.getOverview(),
        adminApi.getOrders({ page: 1, pageSize: 5 }),
      ]);
      if (!alive) return;
      if (overviewRes.status === "fulfilled") {
        const data = overviewRes.value.overview;
        setOverview(data);
        setDashError("");
        const categories = data.topCategories || [];
        const maxCount = Math.max(1, ...categories.map((category) => category.products || 0));
        setCategoryHealth(categories.map((category) => ({ ...category, percent: Math.round((category.products / maxCount) * 100) })));
      } else {
        setOverview(null);
        setDashError(extractErrorMessage(overviewRes.reason));
      }
      if (ordersRes.status === "fulfilled") setRecentOrders(ordersRes.value.data || []);
      if (initial) setDashLoading(false);
    };
    refresh(true);
    const timer = setInterval(() => refresh(false), 30_000);
    return () => { alive = false; clearInterval(timer); };
  }, [path]);

  // ---------------------------------------------------------------------------
  // Admin management pages
  // ---------------------------------------------------------------------------

  if (path.includes("/reports")) return <AdminReports />;
  if (path.includes("/settings")) return <AdminSettings />;

  if (path !== "/admin") {
    let type = "users";
    let title = "Users";

    if (path.includes("users")) {
      type = "users";
      title = "Users";
    } else if (path.includes("vendors")) {
      type = "vendors";
      title = "Vendors";
    } else if (path.includes("products")) {
      type = "products";
      title = "Products";
    } else if (path.includes("categories")) {
      type = "categories";
      title = "Categories";
    } else if (path.includes("orders")) {
      type = "orders";
      title = "Orders";
    } else {
      type = "users";
      title = "Settings";
    }

    return (
      <GenericAdminTable
        type={type}
        title={title}
        subtitle="Manage marketplace records and platform operations."
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Main admin dashboard
  // ---------------------------------------------------------------------------

  return (
    <DashboardLayout admin>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">
            SUPER ADMIN DASHBOARD
          </span>

          <h1>
            Good morning, Administrator 👋
          </h1>

          <p>
            Monitor the entire MVEC marketplace from
            one control center.
          </p>
        </div>

        <button className="gradient-btn" onClick={()=>setCreateOpen(true)}>
          <Icon name="plus" />
          Create record
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="metric-grid">
        <Metric
          label="Gross sales today"
          value={overview ? money(overview.gmvToday) : dashLoading ? "..." : "Unavailable"}
          change="Paid orders today"
          icon="chart"
        />

        <Metric
          label="Orders today"
          value={overview ? overview.ordersToday : dashLoading ? "..." : "Unavailable"}
          change="Placed in the last 24h"
          icon="cart"
        />

        <Metric
          label="Users"
          value={overview ? overview.totalUsers : dashLoading ? "..." : "Unavailable"}
          change="Total registered accounts"
          icon="users"
        />

        <Metric
          label="Vendors"
          value={overview ? overview.totalVendors : dashLoading ? "..." : "Unavailable"}
          change="Marketplace vendor accounts"
          icon="shop"
        />
      </div>

      <div className="metric-grid">
        <Metric label="Suppliers" value={overview ? overview.totalSuppliers : dashLoading ? "..." : "Unavailable"} change="Supplier accounts" icon="shop" />
        <Metric label="Affiliates" value={overview ? overview.totalAffiliates : dashLoading ? "..." : "Unavailable"} change="Affiliate accounts" icon="users" />
        <Metric label="Buyers" value={overview ? overview.totalBuyers : dashLoading ? "..." : "Unavailable"} change="Buyer accounts" icon="users" />
        <Metric label="Total products" value={overview ? overview.totalProducts : dashLoading ? "..." : "Unavailable"} change="All catalog statuses" icon="box" />
      </div>
      {!overview && !dashLoading && <div className="form-error">Marketplace overview is unavailable: {dashError || "No data was returned."}</div>}

      {/* MVEC REVENUE + PLATFORM ACTIVITY */}
      <div className="dash-grid">
        <div className="data-card chart-card">
          <div className="data-card-head">
            <div>
              <h3>MVEC revenue</h3>
              <span>Platform commission earned across all vendors</span>
            </div>
          </div>

          <div className="metric-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Metric label="Commission earned" value={overview ? money(overview.mvecRevenueToday) : dashLoading ? "..." : "Unavailable"} change="Today" icon="wallet" />
            <Metric label="Orders total" value={overview ? overview.totalOrders : dashLoading ? "..." : "Unavailable"} change="All marketplace orders" icon="cart" />
          </div>
        </div>

        <div className="data-card">
          <div className="data-card-head">
            <div>
              <h3>Platform activity</h3>
              <span>Live operational snapshot</span>
            </div>
          </div>

          {overview && [
            ["Vendor verifications", `${overview.pendingVendorVerifications} pending`, overview.pendingVendorVerifications > 0 ? "warning" : "active"],
            ["Open disputes", `${overview.pendingDisputes} open`, overview.pendingDisputes > 0 ? "warning" : "active"],
            ["Disputes under review", `${overview.pendingRefunds} in review`, overview.pendingRefunds > 0 ? "warning" : "active"],
            ["Orders in transit", `${overview.pendingDeliveries} pending`, overview.pendingDeliveries > 0 ? "warning" : "active"],
          ].map((item) => (
            <div className="activity-row" key={item[0]}>
              <div>
                <b>{item[0]}</b>
                <small>Marketplace operations</small>
              </div>
              <em className={`status ${item[2]}`}>{item[1]}</em>
            </div>
          ))}
          {!overview && dashLoading && <div className="activity-row"><div><b>Loading...</b></div></div>}
        </div>
      </div>

      {/* RECENT ORDERS */}
      <div className="data-card">
        <div className="data-card-head">
          <div>
            <h3>Recent orders</h3>
            <span>Across all vendors</span>
          </div>
          <Link to="/admin/orders">View all</Link>
        </div>

        {recentOrders.length === 0 && !dashLoading && <div className="empty-state"><h3>No orders yet</h3><p>Orders will appear here once buyers start checking out.</p></div>}

        {recentOrders.map((order) => (
          <div className="activity-row" key={order.id}>
            <div>
              <b><Link to={`/orders/${order.id}`}>{order.orderNumber}</Link></b>
              <small>{order.user?.fullName || order.user?.Fullname || "Unknown buyer"}</small>
            </div>
            <div>
              <strong>{money(order.totalAmount)}</strong>
              <em className={`status ${order.paymentStatus === "PAID" ? "active" : "warning"}`}>{order.orderStatus}</em>
            </div>
          </div>
        ))}
      </div>

      {/* CATEGORY HEALTH */}
      <div className="data-card">
        <div className="data-card-head">
          <div>
            <h3>Category health</h3>
            <span>Products by category</span>
          </div>
          <Link to="/admin/categories">Manage</Link>
        </div>

        {categoryHealth.length === 0 && !dashLoading && <div className="empty-state"><h3>No categories yet</h3><p>Create categories to organize the catalog.</p></div>}

        {categoryHealth.map((category) => (
          <div className="progress-row" key={category.name}>
            <span>{category.name}</span>
            <div><i style={{ width: `${category.percent}%` }} /></div>
            <b>{category.products}</b>
          </div>
        ))}
      </div>

      {createOpen&&<div className="modal-backdrop" onMouseDown={()=>setCreateOpen(false)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setCreateOpen(false)}>×</button><span className="eyebrow">CREATE RECORD</span><h2>Choose a record type</h2><p>Create marketplace records from the correct management area.</p><div className="quick-actions"><Link to="/admin/products" onClick={()=>setCreateOpen(false)}><span><Icon name="box"/></span><div><b>Product</b><small>Add or manage a product record</small></div></Link><Link to="/admin/categories" onClick={()=>setCreateOpen(false)}><span><Icon name="tag"/></span><div><b>Category</b><small>Add or manage a category</small></div></Link><Link to="/admin/orders" onClick={()=>setCreateOpen(false)}><span><Icon name="cart"/></span><div><b>Order</b><small>Review order records</small></div></Link></div></div></div>}
    </DashboardLayout>
  );
}
