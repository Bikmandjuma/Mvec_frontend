import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";
import SmartTable from "../components/SmartTable";
import { adminApi } from "../API/admin";
import { AttentionQueue } from "./AdminOps";
import { useAuth } from "../context/AuthContext";

// Kigali time of day for the greeting.
const greeting = () => { const h = new Date(Date.now() + 2 * 3600e3).getUTCHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
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


// -----------------------------------------------------------------------------
// Admin Dashboard
// -----------------------------------------------------------------------------

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [categoryHealth, setCategoryHealth] = useState([]);
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState("");
  const location = useLocation();
  const path = location.pathname;
  const { user } = useAuth();

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
            {greeting()}, {user?.fullName?.split(" ")[0] || "Administrator"}
          </h1>

          <p>
            What needs doing first, then how the marketplace is doing today.
          </p>
        </div>

      </div>

      <AttentionQueue />

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
          <div className="data-card-head"><div><h3>Today</h3><span>Live operational snapshot</span></div></div>
          {overview && [
            ["Orders on the way", `${overview.pendingDeliveries}`, "/admin/deliveries"],
            ["Disputes under review", `${overview.pendingRefunds}`, "/admin/disputes"],
          ].map(([label, value, link]) => <Link className="activity-row" key={label} to={link}><div><b>{label}</b></div><em className="status active">{value}</em></Link>)}
          <Link className="activity-row" to="/admin/analytics"><div><b>Full analytics</b><small>Sales, top sellers and products, payment mix</small></div><Icon name="arrow" size={14} /></Link>
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

    </DashboardLayout>
  );
}
