import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";
import SmartTable from "../components/SmartTable";

// -----------------------------------------------------------------------------
// Demo data
// -----------------------------------------------------------------------------

const users = [
  {
    name: "Aline Uwase",
    email: "buyer@mvec.rw",
    role: "Buyer",
    status: "Active",
  },
  {
    name: "Eric Mugabo",
    email: "vendor@mvec.rw",
    role: "Vendor",
    status: "Active",
  },
  {
    name: "Jean Paul",
    email: "jean@mvec.rw",
    role: "Buyer",
    status: "Active",
  },
  {
    name: "MVEC Administrator",
    email: "admin@mvec.rw",
    role: "Super Admin",
    status: "Active",
  },
];

const vendors = [
  {
    id: 1,
    name: "Kigali Tech Store",
    category: "Electronics",
    products: 48,
    rating: 4.8,
  },
  {
    id: 2,
    name: "Fashion Rwanda",
    category: "Fashion",
    products: 36,
    rating: 4.6,
  },
  {
    id: 3,
    name: "Home & Living RW",
    category: "Home",
    products: 29,
    rating: 4.7,
  },
  {
    id: 4,
    name: "Smart Gadgets",
    category: "Electronics",
    products: 21,
    rating: 4.5,
  },
];

const products = [
  {
    id: 1,
    name: "Samsung Galaxy S25",
    vendor: "Kigali Tech Store",
    price: 850000,
    stock: 25,
  },
  {
    id: 2,
    name: "iPhone 16 Pro",
    vendor: "Kigali Tech Store",
    price: 1450000,
    stock: 12,
  },
  {
    id: 3,
    name: "Nike Air Max",
    vendor: "Fashion Rwanda",
    price: 95000,
    stock: 32,
  },
  {
    id: 4,
    name: "Wireless Headphones",
    vendor: "Smart Gadgets",
    price: 65000,
    stock: 18,
  },
  {
    id: 5,
    name: "Smart Watch",
    vendor: "Smart Gadgets",
    price: 120000,
    stock: 9,
  },
];

const categories = [
  "Electronics",
  "Fashion",
  "Home & Living",
  "Beauty",
  "Phones",
  "Computers",
  "Sports",
  "Automotive",
];

const demoOrders = [
  {
    id: "MVEC-10452",
    buyer: "Aline Uwase",
    vendor: "Kigali Tech Store",
    total: 850000,
    payment: "SUCCESS",
    status: "Delivered",
  },
  {
    id: "MVEC-10451",
    buyer: "Jean Paul",
    vendor: "Fashion Rwanda",
    total: 190000,
    payment: "SUCCESS",
    status: "Shipped",
  },
  {
    id: "MVEC-10450",
    buyer: "Diane Mukamana",
    vendor: "Smart Gadgets",
    total: 185000,
    payment: "PENDING",
    status: "Processing",
  },
  {
    id: "MVEC-10449",
    buyer: "Patrick Niyonzima",
    vendor: "Home & Living RW",
    total: 320000,
    payment: "SUCCESS",
    status: "Confirmed",
  },
  {
    id: "MVEC-10448",
    buyer: "Grace Uwimana",
    vendor: "Fashion Rwanda",
    total: 145000,
    payment: "SUCCESS",
    status: "Delivered",
  },
];

const adminStats = {
  orders: 428,
  vendors: 86,
};

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
  let rows;

  if (type === "users") {
    rows = users;
  } else if (type === "vendors") {
    rows = vendors;
  } else if (type === "products") {
    rows = products;
  } else if (type === "categories") {
    rows = categories.map((name, index) => ({
      id: index + 1,
      name,
      products:
        [148, 122, 98, 86, 72, 64, 54, 41][index] || 35,
      status: "Active",
    }));
  } else if (type === "orders") {
    rows = demoOrders;
  } else {
    rows = users;
  }

  const storageKey = `mvec_admin_${type}`;
  const [list, setList] = useState(() => { try { return JSON.parse(localStorage.getItem(storageKey)) || rows; } catch { return rows; } });
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [page, setPage] = useState(1);

  const perPage = 6;

  const filtered = list.filter((item) =>
    JSON.stringify(item)
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / perPage)
  );

  const currentPage = Math.min(page, totalPages);

  const shown = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  function deleteItem(item) {
    const next = list.filter((entry) => entry !== item); setList(next); localStorage.setItem(storageKey, JSON.stringify(next));
    setDeleting(null);
    if (shown.length === 1 && currentPage > 1) setPage(currentPage - 1);
  }

  return (
    <DashboardLayout admin>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SUPER ADMIN</span>

          <h1>{title}</h1>

          <p>{subtitle}</p>
        </div>

        <button className="gradient-btn" onClick={() => setEditing({id:`NEW-${Date.now()}`, name:"", email:"", role:type==="vendors"?"Vendor":type==="users"?"Buyer":"", status:"Active"})}>
          <Icon name="plus" /> Add new
        </button>
      </div>

      <div className="dash-toolbar">
        <div className="dash-filter">
          <Icon name="search" />

          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={`Search ${title.toLowerCase()}...`}
          />
        </div>

        <button className="filter-btn">
          Filter ▾
        </button>

        <button className="filter-btn">
          Export CSV
        </button>
      </div>

      <div className="data-card">
        <div className="data-card-head">
          <div>
            <h3>{title}</h3>
            <span>{filtered.length} records</span>
          </div>

          <span className="muted">
            Create · Read · Update · Delete
          </span>
        </div>

        <div className="data-table">
          {/* USERS */}
          {type === "users" && (
            <>
              <div className="data-row table-label">
                <span>User</span>
                <span>Email</span>
                <span>Role</span>
                <span>Status</span>
                <span>Actions</span>
              </div>

              {shown.map((item, index) => (
                <div className="data-row" key={index}>
                  <span>
                    <b>{item.name}</b>
                  </span>

                  <span>{item.email}</span>

                  <span>{item.role}</span>

                  <span>
                    <em className="status active">
                      {item.status}
                    </em>
                  </span>

                  <span className="row-actions">
                    <button type="button" onClick={() => setEditing(item)}>
                      <Icon name="edit" />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteItem(item)}
                    >
                      <Icon name="trash" />
                    </button>
                  </span>
                </div>
              ))}
            </>
          )}

          {/* VENDORS */}
          {type === "vendors" && (
            <>
              <div className="data-row table-label">
                <span>Store</span>
                <span>Category</span>
                <span>Products</span>
                <span>Rating</span>
                <span>Status</span>
                <span>Actions</span>
              </div>

              {shown.map((item) => (
                <div className="data-row" key={item.id}>
                  <span>
                    <b>{item.name}</b>
                  </span>

                  <span>{item.category}</span>

                  <span>{item.products}</span>

                  <span>★ {item.rating}</span>

                  <span>
                    <em className="status active">
                      Approved
                    </em>
                  </span>

                  <span className="row-actions">
                    <button type="button" title="View vendor" onClick={() => setViewing(item)}>
                      <Icon name="eye" />
                    </button>
                    <button type="button" title="Edit vendor" onClick={() => setEditing(item)}>
                      <Icon name="edit" />
                    </button>
                    <button type="button" title="Delete vendor" onClick={() => setDeleting(item)}>
                      <Icon name="trash" />
                    </button>
                  </span>
                </div>
              ))}
            </>
          )}

          {/* PRODUCTS */}
          {type === "products" && (
            <>
              <div className="data-row table-label">
                <span>Product</span>
                <span>Vendor</span>
                <span>Price</span>
                <span>Stock</span>
                <span>Status</span>
                <span>Actions</span>
              </div>

              {shown.map((item) => (
                <div className="data-row" key={item.id}>
                  <span>
                    <b>{item.name}</b>
                  </span>

                  <span>{item.vendor}</span>

                  <span>{money(item.price)}</span>

                  <span>{item.stock}</span>

                  <span>
                    <em className="status active">
                      Published
                    </em>
                  </span>

                  <span className="row-actions">
                    <button type="button" onClick={() => setEditing(item)}>
                      <Icon name="edit" />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteItem(item)}
                    >
                      <Icon name="trash" />
                    </button>
                  </span>
                </div>
              ))}
            </>
          )}

          {/* ORDERS */}
          {type === "orders" && (
            <>
              <div className="data-row table-label">
                <span>Order</span>
                <span>Buyer</span>
                <span>Vendor</span>
                <span>Total</span>
                <span>Payment</span>
                <span>Action</span>
              </div>

              {shown.map((item) => (
                <div className="data-row" key={item.id}>
                  <span>
                    <b>{item.id}</b>
                  </span>

                  <span>{item.buyer}</span>

                  <span>{item.vendor}</span>

                  <span>{money(item.total)}</span>

                  <span>
                    <em
                      className={`status ${
                        item.payment === "SUCCESS"
                          ? "active"
                          : "warning"
                      }`}
                    >
                      {item.payment}
                    </em>
                  </span>

                  <span className="row-actions">
                    <button type="button" onClick={() => setEditing(item)}>
                      <Icon name="edit" />
                    </button>
                  </span>
                </div>
              ))}
            </>
          )}

          {/* CATEGORIES */}
          {type === "categories" && (
            <>
              <div className="data-row table-label">
                <span>Category</span>
                <span>Products</span>
                <span>Status</span>
                <span>Actions</span>
              </div>

              {shown.map((item) => (
                <div className="data-row" key={item.id}>
                  <span>
                    <b>{item.name}</b>
                  </span>

                  <span>{item.products}</span>

                  <span>
                    <em className="status active">
                      {item.status}
                    </em>
                  </span>

                  <span className="row-actions">
                    <button type="button" onClick={() => setEditing(item)}>
                      <Icon name="edit" />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteItem(item)}
                    >
                      <Icon name="trash" />
                    </button>
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        <Pagination
          page={currentPage}
          setPage={setPage}
          total={filtered.length}
          perPage={perPage}
        />
      </div>
      {editing && <AdminEditModal value={editing} isNew={String(editing.id).startsWith("NEW-")} onCancel={() => setEditing(null)} onSave={(next) => {
        const isNew = String(editing.id).startsWith("NEW-");
        const saved = isNew ? [{...next, id: Date.now()} , ...list] : list.map(x => x.id === editing.id ? next : x);
        setList(saved); localStorage.setItem(storageKey, JSON.stringify(saved)); setEditing(null);
      }} />}
      {viewing && type === "vendors" && <VendorQuickView vendor={viewing} onClose={() => setViewing(null)} />}
      {deleting && type === "vendors" && <DeleteVendorModal vendor={deleting} onCancel={() => setDeleting(null)} onDelete={() => deleteItem(deleting)} />}
    </DashboardLayout>
  );
}

function VendorQuickView({vendor,onClose}){return <div className="modal-backdrop"><div className="modal vendor-view-modal"><button className="modal-close" onClick={onClose}>×</button><span className="eyebrow">VENDOR PROFILE</span><h2>{vendor.name}</h2><p>MVEC marketplace vendor overview.</p><div className="vendor-detail-grid"><div><span>Category</span><b>{vendor.category}</b></div><div><span>Products</span><b>{vendor.products}</b></div><div><span>Rating</span><b>★ {vendor.rating}</b></div><div><span>Status</span><b className="status active">Approved</b></div><div><span>Vendor ID</span><b>VND-{String(vendor.id).padStart(4,'0')}</b></div><div><span>Trust</span><b>Verified ✓</b></div></div><div className="verified-box"><b>🔒 Protected settlement</b><p>Eligible order funds are shown as held by MVEC until delivery confirmation and release according to the marketplace workflow.</p></div><button className="gradient-btn" onClick={onClose}>Done</button></div></div>}
function DeleteVendorModal({vendor,onCancel,onDelete}){return <div className="modal-backdrop"><div className="modal confirm-modal"><button className="modal-close" onClick={onCancel}>×</button><div className="danger-icon">!</div><h2>Delete this vendor?</h2><p>You are about to delete <strong>{vendor.name}</strong>. This action removes the vendor from the current frontend dataset. Are you sure you want to continue?</p><div className="modal-actions"><button className="outline-btn" onClick={onCancel}>Cancel</button><button className="danger-btn" onClick={onDelete}>Yes, delete vendor</button></div></div></div>}

function AdminEditModal({value,isNew,onCancel,onSave}){
 const [row,setRow]=useState(value);
 const fields=Object.keys(row).filter(k=>k!=="id" && k!=="image");
 return <div className="modal-backdrop"><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onCancel}>×</button><h2>{isNew?"Add":"Edit"} record</h2><p>Changes are saved to the current MVEC frontend data set.</p>{fields.map(k=><label className="field" key={k}><span>{k.replace(/([A-Z])/g," $1")}</span><input value={row[k]??""} onChange={e=>setRow({...row,[k]:e.target.value})}/></label>)}<div className="modal-actions"><button className="outline-btn" onClick={onCancel}>Cancel</button><button className="gradient-btn" onClick={()=>onSave(row)}>Save changes</button></div></div></div>;
}

function AdminReports(){const rows=[['Marketplace revenue','01 Aug – 27 Aug','18,450,000 RWF'],['Vendor sales','01 Aug – 27 Aug','12,840,000 RWF'],['Transactions','01 Aug – 27 Aug','428'],['Refunds','01 Aug – 27 Aug','14'],['Platform commission','01 Aug – 27 Aug','2,760,000 RWF']];return <DashboardLayout admin><div className="dash-page-head"><div><span className="eyebrow">ADMIN CONTROL</span><h1>Reports</h1><p>Platform-wide revenue, vendors, orders, payments and marketplace performance.</p></div><button className="gradient-btn">Export report</button></div><div className="metric-grid"><Metric label="Revenue" value="18.45M RWF" change="+12.4%" icon="chart"/><Metric label="Orders" value="428" change="+8.2%" icon="cart"/><Metric label="Vendors" value="86" change="+6.1%" icon="shop"/><Metric label="Commission" value="2.76M RWF" change="+10.3%" icon="wallet"/></div><div className="data-card"><div className="data-card-head"><div><h3>Platform reports</h3><span>Frontend demo data · ready for API</span></div><select><option>30 Days</option><option>3 Months</option><option>1 Year</option></select></div><SmartTable columns={[{key:'report',label:'Report',render:r=><b>{r.report}</b>},{key:'range',label:'Range'},{key:'summary',label:'Summary'}]} rows={rows.map(r=>({report:r[0],range:r[1],summary:r[2]}))} rowKey={r=>r.report} searchPlaceholder="Search reports…" actions={r=><button className="filter-btn">Export</button>}/></div></DashboardLayout>}
function AdminSettings(){return <DashboardLayout admin><div className="dash-page-head"><div><span className="eyebrow">ADMIN CONTROL</span><h1>Platform Settings</h1><p>Configure marketplace-wide rules and system behavior.</p></div><button className="gradient-btn">Save changes</button></div><div className="settings-grid"><div className="data-card"><h3>Marketplace</h3><label className="field"><span>Marketplace name</span><input defaultValue="MVEC"/></label><label className="field"><span>Default currency</span><select defaultValue="RWF"><option>RWF</option><option>USD</option></select></label><label className="field"><span>Vendor approval</span><select defaultValue="Manual"><option>Manual</option><option>Automatic</option></select></label></div><div className="data-card"><h3>Commerce rules</h3><label className="field"><span>Platform commission</span><input defaultValue="10%"/></label><label className="field"><span>Order cancellation window</span><input defaultValue="24 hours"/></label><label className="field"><span>Reviews moderation</span><select defaultValue="Required"><option>Required</option><option>Optional</option></select></label></div><div className="data-card"><h3>Notifications</h3><label className="field"><span>Order notifications</span><select defaultValue="Enabled"><option>Enabled</option><option>Disabled</option></select></label><label className="field"><span>Shipping notifications</span><select defaultValue="Enabled"><option>Enabled</option><option>Disabled</option></select></label><label className="field"><span>Payout notifications</span><select defaultValue="Enabled"><option>Enabled</option><option>Disabled</option></select></label></div></div></DashboardLayout>}

// -----------------------------------------------------------------------------
// Admin Dashboard
// -----------------------------------------------------------------------------

export default function AdminDashboard() {
  const location = useLocation();
  const path = location.pathname;

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

        <button className="gradient-btn">
          <Icon name="plus" />
          Create record
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="metric-grid">
        <Metric
          label="Gross sales"
          value="18.45M RWF"
          change="+12.4% this month"
          icon="chart"
        />

        <Metric
          label="Orders"
          value={adminStats.orders}
          change="+8.2% this month"
          icon="cart"
        />

        <Metric
          label="Customers"
          value="1,842"
          change="+14.8% this month"
          icon="users"
        />

        <Metric
          label="Vendors"
          value={adminStats.vendors}
          change="6 awaiting review"
          icon="shop"
        />
      </div>

      {/* CHART + PLATFORM ACTIVITY */}
      <div className="dash-grid">
        <div className="data-card chart-card">
          <div className="data-card-head">
            <div>
              <h3>Marketplace revenue</h3>

              <span>
                All sellers · last 30 days
              </span>
            </div>

            <select defaultValue="30">
              <option value="7">
                7 days
              </option>

              <option value="30">
                30 days
              </option>

              <option value="90">
                3 months
              </option>

              <option value="365">
                1 year
              </option>
            </select>
          </div>

          <div className="fake-chart">
            {[
              36,
              48,
              44,
              61,
              55,
              68,
              63,
              75,
              69,
              83,
              78,
              95,
            ].map((height, index) => (
              <div
                key={index}
                style={{
                  height: `${height}%`,
                }}
              >
                <span>{index + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="data-card">
          <div className="data-card-head">
            <div>
              <h3>Platform activity</h3>

              <span>
                Live operational snapshot
              </span>
            </div>
          </div>

          {[
            [
              "Vendor approvals",
              "6 pending",
              "warning",
            ],
            [
              "Product moderation",
              "14 pending",
              "warning",
            ],
            [
              "Payment success",
              "96.8%",
              "active",
            ],
            [
              "Disputes",
              "3 open",
              "warning",
            ],
          ].map((item) => (
            <div
              className="activity-row"
              key={item[0]}
            >
              <div>
                <b>{item[0]}</b>

                <small>
                  Marketplace operations
                </small>
              </div>

              <em
                className={`status ${item[2]}`}
              >
                {item[1]}
              </em>
            </div>
          ))}
        </div>
      </div>

      {/* RECENT ORDERS */}
      <div className="data-card">
        <div className="data-card-head">
          <div>
            <h3>Recent orders</h3>

            <span>
              Across all vendors
            </span>
          </div>

          <Link to="/admin/orders">
            View all
          </Link>
        </div>

        {demoOrders.map((order) => (
          <div
            className="activity-row"
            key={order.id}
          >
            <div>
              <b>
                <Link
                  to={`/orders/${order.id}`}
                >
                  {order.id}
                </Link>
              </b>

              <small>
                {order.buyer} · {order.vendor}
              </small>
            </div>

            <div>
              <strong>
                {money(order.total)}
              </strong>

              <em
                className={`status ${
                  order.payment === "SUCCESS"
                    ? "active"
                    : "warning"
                }`}
              >
                {order.status}
              </em>
            </div>
          </div>
        ))}
      </div>

      {/* CATEGORY HEALTH */}
      <div className="data-card">
        <div className="data-card-head">
          <div>
            <h3>Category health</h3>

            <span>
              Products by category
            </span>
          </div>

          <Link to="/admin/categories">
            Manage
          </Link>
        </div>

        {categories
          .slice(0, 6)
          .map((category, index) => {
            const percentages = [
              84,
              72,
              61,
              55,
              44,
              38,
            ];

            const productCounts = [
              148,
              122,
              98,
              86,
              72,
              64,
            ];

            return (
              <div
                className="progress-row"
                key={category}
              >
                <span>{category}</span>

                <div>
                  <i
                    style={{
                      width: `${percentages[index]}%`,
                    }}
                  />
                </div>

                <b>
                  {productCounts[index]}
                </b>
              </div>
            );
          })}
      </div>
    </DashboardLayout>
  );
}