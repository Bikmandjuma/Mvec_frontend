import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";
import SmartTable from "../components/SmartTable";
import { useAuth } from "../context/AuthContext";
import { affiliatesApi } from "../API/affiliates";
import { productsApi } from "../API/products";
import { mapBackendProduct } from "../services/catalogApi";
import { extractErrorMessage } from "../API/client";
import ProductImage from "../components/ProductImage";

const money = n => new Intl.NumberFormat("en-RW").format(Number(n) || 0) + " RWF";
const affiliateUrl = code => `${window.location.origin}/track/${code}`;

async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const el = document.createElement("textarea");
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  el.remove();
}

function Overview() {
  const [wallet, setWallet] = useState(null);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([affiliatesApi.getMyWallet(), affiliatesApi.getMyLinks()]).then(([w, l]) => {
      if (w.status === "fulfilled") setWallet(w.value.data);
      if (l.status === "fulfilled") setLinks(l.value.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const totalClicks = links.reduce((s, l) => s + (l.clickCount || 0), 0);
  const totalConversions = links.reduce((s, l) => s + (l.conversionCount || 0), 0);
  const rate = totalClicks ? ((totalConversions / totalClicks) * 100).toFixed(2) : "0.00";

  return <>
    <div className="dash-page-head"><div><span className="eyebrow">AFFILIATE PLATFORM</span><h1>Affiliate dashboard</h1><p>Promote MVEC products and earn when qualifying orders are completed.</p></div></div>
    <div className="metric-grid">
      <div className="metric"><div className="metric-icon"><Icon name="chart" /></div><div><span>Clicks</span><strong>{loading ? "..." : totalClicks}</strong><small>Across all your links</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="cart" /></div><div><span>Completed orders</span><strong>{loading ? "..." : totalConversions}</strong><small>{rate}% conversion</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="wallet" /></div><div><span>Pending commission</span><strong>{loading ? "..." : money(wallet?.pendingBalance)}</strong><small>Awaiting completion</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="wallet" /></div><div><span>Available wallet</span><strong>{loading ? "..." : money(wallet?.availableBalance)}</strong><small>Minimum withdrawal RWF 10,000</small></div></div>
    </div>
    <div className="verified-box"><b>✓ Protected commission workflow</b><p>Commission follows purchase, payment, delivery, refund window, then confirmation. Once available, it moves into your wallet. You can request a withdrawal from RWF 10,000 upward.</p></div>
  </>;
}

function Products() {
  const [catalog, setCatalog] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(null);
  const [creating, setCreating] = useState("");
  const [terminating, setTerminating] = useState("");
  const [error, setError] = useState("");
  const perPage = 6;

  useEffect(() => {
    Promise.allSettled([productsApi.getAll(), affiliatesApi.getMyLinks()]).then(([p, l]) => {
      if (p.status === "fulfilled") setCatalog((p.value.products || []).map(mapBackendProduct));
      if (l.status === "fulfilled") setLinks(l.value.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => catalog.filter(p => `${p.name} ${p.vendor || ""} ${p.category || ""}`.toLowerCase().includes(q.trim().toLowerCase())),
    [catalog, q],
  );
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / perPage)));
  const shown = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const linkFor = productId => links.find(l => String(l.targetProductId) === String(productId));

  const makeLink = async p => {
    setError("");
    setCreating(p.id);
    try {
      const res = await affiliatesApi.generateLink({ productId: p.id });
      setLinks(prev => [res.data, ...prev]);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setCreating("");
    }
  };

  const copyFor = async p => {
    let link = linkFor(p.id);
    if (!link) {
      const res = await affiliatesApi.generateLink({ productId: p.id }).catch(() => null);
      if (res) { link = res.data; setLinks(prev => [res.data, ...prev]); }
    }
    if (!link) return;
    await copyText(affiliateUrl(link.affiliateCode));
    setCopied(String(p.id));
    setTimeout(() => setCopied(""), 1600);
  };

  const terminateLink = async p => {
    const link = linkFor(p.id);
    if (!link) return;
    setShowConfirmModal(p);
  };

  const confirmTermination = async p => {
    const link = linkFor(p.id);
    if (!link) return;
    setError("");
    setTerminating(p.id);
    try {
      await affiliatesApi.deleteLink(link.id || link._id);
      setLinks(prev => prev.filter(item => String(item.id || item._id) !== String(link.id || link._id)));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setTerminating("");
      setShowConfirmModal(null);
    }
  };

  return <>
    <div className="dash-page-head"><div><span className="eyebrow">AFFILIATE PRODUCTS</span><h1>Choose products to promote</h1><p>Search the marketplace and create a unique promotion link for any product.</p></div></div>
    {error && <div className="form-error">{error}</div>}
    <div className="dash-toolbar"><div className="dash-filter"><Icon name="search" /><input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search products, vendors or categories…" /></div><span className="table-count">{filtered.length} products</span></div>
    {loading && <div className="empty-state"><h3>Loading products…</h3></div>}
     {!loading && (
       <div className="dash-grid affiliate-product-grid">
         {shown.map(p => {
           const hasLink = linkFor(p.id);
           return (
             <div className="data-card" key={p.id}>
               <div className="admin-product-main"><ProductImage src={p.image} alt="" /><div><b>{p.name}</b><small>{money(p.price)} · {p.vendor}</small></div></div>
               <div className="affiliate-product-meta"><span>Available stock <b>{p.stock} units</b></span></div>
<div className="affiliate-link-actions">
{hasLink ? (
    <>
      {/* Red Outlined Terminate Button */}
      <button
        onClick={() => terminateLink(p)}
        disabled={terminating === p.id}
        className="px-4 py-2 text-sm font-medium text-red-600 border border-red-600 bg-transparent hover:bg-red-50 rounded transition-colors"
      >
        {terminating === p.id ? "Terminating…" : "Terminate Link"}
      </button>

      {/* Copy Link Button placed directly adjacent */}
      <button
        onClick={() => copyFor(p)}
        className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 rounded transition"
      >
        {copied === String(p.id) ? "Copied!" : "Copy Link"}
      </button>
    </>
  ) : (
   <button 
     className="gradient-btn" 
     onClick={() => makeLink(p)} 
     disabled={creating === p.id}
   >
     {creating === p.id ? "Creating…" : "Create affiliate link"}
   </button>
 )}
</div>
             </div>
           );
         })}
       </div>
     )}
{showConfirmModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 className="modal-title">Terminate Link</h3>
            <p className="modal-text">
              Do you want to terminate the affiliate link for {showConfirmModal.name}? This will stop tracking commissions for this product.
            </p>
            <div className="modal-actions">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="outline-btn"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmTermination(showConfirmModal)}
                className="danger-btn"
              >
                Yes, Terminate
              </button>
            </div>
          </div>
        </div>
      )}
     {!loading && !shown.length && <div className="data-card table-empty">No products match your search.</div>}

    <Pagination page={safePage} setPage={setPage} total={filtered.length} perPage={perPage} />
  </>;
}

function Links() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    affiliatesApi.getMyLinks().then(res => setLinks(res.data || [])).finally(() => setLoading(false));
  }, []);

  const rows = links.map(l => ({
    id: l.id,
    product: l.targetProduct?.name || "General link",
    code: l.affiliateCode,
    clicks: l.clickCount || 0,
    orders: l.conversionCount || 0,
  }));

  return <>
    <div className="dash-page-head"><div><span className="eyebrow">MY LINKS</span><h1>Affiliate links</h1><p>Track links and conversions generated from your marketing.</p></div></div>
    <div className="data-card">
      {loading && <div className="empty-state"><h3>Loading…</h3></div>}
      {!loading && <SmartTable
        columns={[
          { key: "product", label: "Product" },
          { key: "link", label: "Link", render: r => <small>{affiliateUrl(r.code)}</small> },
          { key: "clicks", label: "Clicks" },
          { key: "orders", label: "Orders" },
        ]}
        rows={rows}
        rowKey={r => r.id}
        searchPlaceholder="Search affiliate links…"
        empty="No links yet. Create one from the Products tab."
        exportName="affiliate-links"
      />}
    </div>
  </>;
}

function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    affiliatesApi.getMyWallet().then(res => setWallet(res.data)).finally(() => setLoading(false));
  }, []);

  return <>
    <div className="dash-page-head"><div><span className="eyebrow">AFFILIATE WALLET</span><h1>Wallet</h1><p>View your commission balance.</p></div><Link className="gradient-btn" to="/affiliate/withdrawals">Request withdrawal</Link></div>
    {loading && <div className="empty-state"><h3>Loading…</h3></div>}
    {!loading && <div className="metric-grid">
      <div className="metric"><div className="metric-icon"><Icon name="chart" /></div><div><span>Total earned</span><strong>{money(wallet?.totalEarned)}</strong><small>Lifetime commission</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="wallet" /></div><div><span>Available balance</span><strong>{money(wallet?.availableBalance)}</strong><small>Ready for withdrawal</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="wallet" /></div><div><span>Pending commission</span><strong>{money(wallet?.pendingBalance)}</strong><small>Awaiting qualifying completion</small></div></div>
    </div>}
  </>;
}

function Withdrawals() {
  const [wallet, setWallet] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("MTN_MOMO");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    Promise.allSettled([affiliatesApi.getMyWallet(), affiliatesApi.getMyPayouts()]).then(([w, h]) => {
      if (w.status === "fulfilled") setWallet(w.value.data);
      if (h.status === "fulfilled") setHistory(h.value.data || []);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const submit = async () => {
    setMsg("");
    if (!amount || !phoneNumber) { setMsg("Please enter an amount and phone number."); return; }
    setBusy(true);
    try {
      const res = await affiliatesApi.requestPayout({ amount: Number(amount), paymentMethod: method, accountDetails: { phoneNumber } });
      setMsg(`Withdrawal request for ${money(amount)} submitted successfully.`);
      setAmount("");
      load();
    } catch (err) {
      setMsg(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return <>
    <div className="dash-page-head"><div><span className="eyebrow">AFFILIATE PAYOUTS</span><h1>Withdrawals</h1><p>Request a payout and track the status of previous withdrawal requests.</p></div><Link className="outline-btn" to="/affiliate/wallet">View wallet</Link></div>
    <div className="wallet-grid">
      <div className="data-card"><h3>Request a withdrawal</h3>
        <p className="tiny">Available balance: <b>{loading ? "…" : money(wallet?.availableBalance)}</b>. Minimum withdrawal is RWF 10,000.</p>
        <label className="field"><span>Amount (RWF)</span><input type="number" min="10000" step="1000" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <label className="field"><span>Payment method</span><select value={method} onChange={e => setMethod(e.target.value)}><option value="MTN_MOMO">MTN MoMo</option><option value="AIRTEL_MONEY">Airtel Money</option><option value="BANK_TRANSFER">Bank account</option></select></label>
        <label className="field"><span>Phone number</span><input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+250 788 100 005" /></label>
        <button className="gradient-btn" onClick={submit} disabled={busy || !wallet || wallet.availableBalance < 10000}>{busy ? "Submitting…" : "Submit withdrawal request"}</button>
        {msg && <p className={msg.includes("successfully") ? "success-text" : "form-alert error"}>{msg}</p>}
      </div>
      <div className="data-card"><h3>Payout process</h3><div className="timeline">{["Submit a withdrawal request.", "MVEC validates the destination and available balance.", "The payout is processed through the selected payment channel.", "The request status changes to completed when the transfer is confirmed."].map((x, i) => <div className="timeline-item done" key={x}><i /><div><b>{i + 1}. {x}</b></div></div>)}</div></div>
    </div>
    <div className="data-card"><h3>Withdrawal history</h3>
      {loading && <div className="empty-state"><h3>Loading…</h3></div>}
      {!loading && <SmartTable
        columns={[
          { key: "payoutNumber", label: "Request" },
          { key: "amount", label: "Amount", render: r => money(r.amount) },
          { key: "paymentMethod", label: "Method" },
          { key: "createdAt", label: "Requested", render: r => new Date(r.createdAt).toLocaleDateString("en-GB") },
          { key: "status", label: "Status" },
        ]}
        rows={history}
        rowKey={r => r.id}
        searchPlaceholder="Search withdrawals…"
        empty="No withdrawal requests yet."
        exportName="affiliate-withdrawals"
      />}
    </div>
  </>;
}

function Profile() {
  const { user } = useAuth();
  return <>
    <div className="dash-page-head"><div><span className="eyebrow">AFFILIATE PROFILE</span><h1>Profile</h1><p>Your affiliate account details.</p></div></div>
    <div className="profile-grid">
      <div className="data-card">
        <div className="profile-avatar-wrap"><div className="profile-avatar">{user?.fullName?.charAt(0) || "A"}</div></div>
        <h2>{user?.fullName || "Affiliate"}</h2>
        <p className="muted">Affiliate marketer, MVEC account</p>
        <span className="role-chip">Affiliate</span>
      </div>
      <div className="data-card"><h3>Account details</h3>
        <label className="field"><span>Full name</span><input defaultValue={user?.fullName || ""} disabled /></label>
        <label className="field"><span>Phone number</span><input defaultValue={user?.phone || ""} disabled /></label>
        <label className="field"><span>Email</span><input defaultValue={user?.email || ""} disabled /></label>
        <p className="tiny">Update your name, phone or email from your account settings.</p>
      </div>
    </div>
  </>;
}

function AffiliateDashboard() {
  const path = useLocation().pathname;
  let page = path.includes("/products") ? <Products />
    : path.includes("/links") ? <Links />
    : path.includes("/withdrawals") ? <Withdrawals />
    : path.includes("/wallet") ? <Wallet />
    : path.includes("/profile") ? <Profile />
    : <Overview />;
  return <DashboardLayout>{page}</DashboardLayout>;
}
export default AffiliateDashboard;
