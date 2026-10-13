import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";
import SmartTable from "../components/SmartTable";
import { useAuth } from "../context/AuthContext";
import { affiliatesApi } from "../API/affiliates";
import { authApi } from "../API/auth";
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

const dateFmt = d => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
const statusLabel = { PENDING: "Pending", APPROVED: "Approved", REVERSED: "Reversed" };

function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return <div className="form-error">{message} {onRetry && <button className="outline-btn" onClick={onRetry}>Retry</button>}</div>;
}

function ClicksChart({ stats }) {
  const clicks = stats?.series?.clicks || [];
  const max = Math.max(1, ...clicks);
  if (!clicks.some(Boolean)) return <div className="table-empty">No clicks in the last {stats?.days || 30} days yet.</div>;
  return (
    <svg viewBox={`0 0 ${clicks.length * 10} 60`} role="img" aria-label="Clicks per day" style={{ width: "100%", height: 120 }} preserveAspectRatio="none">
      {clicks.map((v, i) => <rect key={i} x={i * 10 + 1} y={60 - (v / max) * 58} width="8" height={(v / max) * 58} fill="currentColor" opacity="0.75"><title>{`${stats.labels[i]}: ${v} clicks`}</title></rect>)}
    </svg>
  );
}

function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    affiliatesApi.getOverview()
      .then(res => setData(res))
      .catch(err => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const v = (x, fmt = n => n) => (loading ? "..." : fmt(x ?? 0));
  const c = data?.commission || {};
  const recent = data?.recent || [];
  const top = data?.stats?.topLinks || [];

  return <>
    <div className="dash-page-head"><div><span className="eyebrow">AFFILIATE PLATFORM</span><h1>Affiliate dashboard</h1><p>Live performance of your links, attributed orders and commissions.</p></div><button className="outline-btn" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
    {error && <div className="form-error">{error} <button className="outline-btn" onClick={load}>Retry</button></div>}
    <div className="metric-grid">
      <div className="metric"><div className="metric-icon"><Icon name="tag" /></div><div><span>Created links</span><strong>{v(data?.links?.created)}</strong><small>{v(data?.links?.active)} active · {v(data?.links?.terminated)} terminated</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="chart" /></div><div><span>Clicked links</span><strong>{v(data?.links?.clicked)}</strong><small>Visited, whether or not they led to a sale</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="cart" /></div><div><span>Successful links</span><strong>{v(data?.links?.successful)}</strong><small>Clicked, ordered and delivered</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="chart" /></div><div><span>Clicks</span><strong>{v(data?.clicks)}</strong><small>{v(data?.uniqueVisitors)} unique visitors</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="cart" /></div><div><span>Attributed orders</span><strong>{v(data?.attributedOrders)}</strong><small>{v(data?.conversionRate)}% of clicks · {v(data?.conversions)} items</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="wallet" /></div><div><span>Net commission</span><strong>{v(c.net, money)}</strong><small>{v(c.reversed, money)} reversed by refunds</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="wallet" /></div><div><span>Pending</span><strong>{v(c.pending, money)}</strong><small>Held until delivery is confirmed</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="wallet" /></div><div><span>Approved / available</span><strong>{v(data?.wallet?.availableBalance, money)}</strong><small>Minimum withdrawal RWF 10,000</small></div></div>
      <div className="metric"><div className="metric-icon"><Icon name="wallet" /></div><div><span>Withdrawn</span><strong>{v(c.paid, money)}</strong><small>Paid out to you</small></div></div>
    </div>

    <div className="data-card"><h3>Recent attributed orders</h3>
      {!loading && !recent.length && <div className="empty-state"><h3>No attributed orders yet</h3><p>Orders placed after a visitor clicks your link will appear here once paid.</p></div>}
      {!!recent.length && <SmartTable
        columns={[
          { key: "orderNumber", label: "Order" },
          { key: "product", label: "Product" },
          { key: "orderTotal", label: "Item total", render: r => money(r.orderTotal) },
          { key: "amount", label: "Commission", render: r => money(r.amount) },
          { key: "status", label: "Status" },
          { key: "createdAt", label: "Date", render: r => new Date(r.createdAt).toLocaleDateString("en-GB") },
        ]}
        rows={recent}
        rowKey={r => r.id}
        exportName="affiliate-recent-orders"
      />}
    </div>

    <div className="data-card"><h3>Top links (last 30 days)</h3>
      {!loading && !top.length && <div className="empty-state"><h3>No links yet</h3><p>Create one from the Promote Products tab.</p></div>}
      {!!top.length && <SmartTable
        columns={[
          { key: "product", label: "Product", render: r => r.targetProduct?.name || "—" },
          { key: "clickCount", label: "Clicks" },
          { key: "conversionCount", label: "Orders" },
          { key: "commissionEarned", label: "Commission", render: r => money(r.commissionEarned) },
          { key: "status", label: "Status" },
        ]}
        rows={top}
        rowKey={r => r.id}
        exportName="affiliate-top-links"
      />}
    </div>
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
      else setError(extractErrorMessage(p.reason));
      if (l.status === "fulfilled") setLinks(l.value.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => catalog.filter(p => `${p.name} ${p.vendor || ""} ${p.category || ""}`.toLowerCase().includes(q.trim().toLowerCase())),
    [catalog, q],
  );
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / perPage)));
  const shown = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const linkFor = productId => links.find(l => l.status !== "TERMINATED" && String(l.targetProductId) === String(productId));

  const makeLink = async p => {
    setError("");
    setCreating(p.id);
    try {
      const res = await affiliatesApi.generateLink({ productId: p.id });
      setLinks(prev => [res.link || res.data, ...prev]);
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
      if (res) { link = res.link || res.data; setLinks(prev => [link, ...prev]); }
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
      await affiliatesApi.terminateLink(link.id || link._id);
      setLinks(prev => prev.map(item => String(item.id || item._id) === String(link.id || link._id) ? { ...item, status: "TERMINATED", isActive: false } : item));
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
               <div className="affiliate-product-meta"><span>Available stock <b>{p.stock} units</b></span>{hasLink && <div className="affiliate-link-box"><code>{affiliateUrl(hasLink.affiliateCode)}</code></div>}</div>
<div className="affiliate-link-actions">
{hasLink ? (
    <>
      {/* Red Outlined Terminate Button */}
      <button
        onClick={() => terminateLink(p)}
        disabled={terminating === p.id}
        className="terminate-btn"
      >
        {terminating === p.id ? "Terminating…" : "Terminate Link"}
      </button>

      {/* Copy Link Button placed directly adjacent */}
      <button
        onClick={() => copyFor(p)}
        className="gradient-btn"
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
              Terminate the affiliate link for {showConfirmModal.name}? New visitors will no longer be tracked through it. Your past clicks, orders and commissions are kept.
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
  const [error, setError] = useState("");
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null);

  const load = () => {
    setLoading(true);
    setError("");
    affiliatesApi.getMyLinks({ status: status === "ALL" ? undefined : status, q: q.trim() || undefined })
      .then(res => setLinks(res.data || []))
      .catch(err => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [status, q]);

  const copy = async l => {
    await copyText(affiliateUrl(l.affiliateCode));
    setCopied(String(l.id));
    setTimeout(() => setCopied(""), 1600);
  };
  const terminate = async l => {
    setBusy(String(l.id));
    try {
      await affiliatesApi.terminateLink(l.id);
      setConfirm(null);
      load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy("");
    }
  };

  return <>
    <div className="dash-page-head"><div><span className="eyebrow">MY LINKS</span><h1>Affiliate links</h1><p>Every link you created, with its clicks and successful (delivered) orders.</p></div>
      <button className="outline-btn" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
    {error && <div className="form-error">{error}</div>}
    <div className="dash-toolbar">
      <div className="dash-filter"><Icon name="search" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by product, label or code…" /></div>
      <select className="table-filter-select" aria-label="Filter links" value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">All links</option><option value="ACTIVE">Active</option><option value="TERMINATED">Terminated</option></select>
      <span className="table-count">{links.length} links</span>
    </div>
    {loading && !links.length && <div className="empty-state"><h3>Loading…</h3></div>}
    {!loading && !links.length && !error && <div className="empty-state"><h3>No links yet</h3><p>Create one from the Promote Products tab.</p></div>}
    <div className="affiliate-links-list">
      {links.map(l => {
        const active = l.status === "ACTIVE";
        return <div className="affiliate-link-card" key={l.id}>
          <div className="affiliate-link-main">
            <div className="affiliate-link-title">
              <b>{l.targetProduct?.name || "Product"}</b>
              <span className={`status ${active ? "active" : ""}`}>{active ? "Active" : "Terminated"}</span>
            </div>
            <div className="affiliate-link-box">
              <code>{affiliateUrl(l.affiliateCode)}</code>
              <div className="affiliate-link-stats">
                <span>Clicks <strong>{l.clickCount || 0}</strong></span>
                <span>Successful <strong>{l.successfulCount || 0}</strong></span>
                <span>Ordered <strong>{l.conversionCount || 0}</strong></span>
                <span>Commission <strong>{money(l.commissionEarned)}</strong></span>
              </div>
            </div>
          </div>
          <div className="affiliate-link-actions">
            {active ? <>
              <button className="gradient-btn" onClick={() => copy(l)}>{copied === String(l.id) ? "Copied!" : "Copy link"}</button>
              <button className="terminate-btn" disabled={busy === String(l.id)} onClick={() => setConfirm(l)}>Terminate link</button>
            </> : <small className="muted">Terminated {l.terminatedAt ? new Date(l.terminatedAt).toLocaleDateString("en-GB") : ""}</small>}
          </div>
        </div>;
      })}
    </div>
    {confirm && <div className="modal-backdrop"><div className="modal">
      <h3 className="modal-title">Terminate link</h3>
      <p className="modal-text">Terminate the link for {confirm.targetProduct?.name || "this product"}? New clicks will no longer be tracked. Past clicks, orders and commissions are kept.</p>
      <div className="modal-actions">
        <button className="outline-btn" onClick={() => setConfirm(null)}>Cancel</button>
        <button className="terminate-btn" disabled={busy === String(confirm.id)} onClick={() => terminate(confirm)}>{busy === String(confirm.id) ? "Terminating…" : "Yes, terminate"}</button>
      </div>
    </div></div>}
  </>;
}

function Commissions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    affiliatesApi.getCommissions()
      .then(res => setRows(res.data || []))
      .catch(err => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return <>
    <div className="dash-page-head"><div><span className="eyebrow">COMMISSIONS</span><h1>Commission activity</h1><p>One line per attributed order item. Refunds show as reversed amounts.</p></div></div>
    {error && <div className="form-error">{error}</div>}
    <div className="data-card">
      {loading && <div className="empty-state"><h3>Loading…</h3></div>}
      {!loading && <SmartTable
        columns={[
          { key: "orderNumber", label: "Order" },
          { key: "product", label: "Product" },
          { key: "orderTotal", label: "Item total", render: r => money(r.orderTotal) },
          { key: "commissionAmount", label: "Earned", render: r => money(r.commissionAmount) },
          { key: "reversedAmount", label: "Reversed", render: r => money(r.reversedAmount) },
          { key: "amount", label: "Net", render: r => money(r.amount) },
          { key: "status", label: "Status" },
          { key: "createdAt", label: "Date", render: r => new Date(r.createdAt).toLocaleDateString("en-GB") },
        ]}
        rows={rows}
        rowKey={r => r.id}
        searchPlaceholder="Search commissions…"
        empty="No commissions yet."
        exportName="affiliate-commissions"
      />}
    </div>
  </>;
}

function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    affiliatesApi.getMyWallet().then(setWallet).finally(() => setLoading(false));
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
  const [bank, setBank] = useState({ bankName: "", accountNumber: "", accountName: "" });
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    Promise.allSettled([affiliatesApi.getMyWallet(), affiliatesApi.getMyPayouts()]).then(([w, h]) => {
      if (w.status === "fulfilled") setWallet(w.value);
      if (h.status === "fulfilled") setHistory(h.value.data || []);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Pick the network from the number so MTN / Airtel always match.
  const onPhone = (value) => {
    setPhoneNumber(value);
    const digits = value.replace(/\D/g, "");
    const local = digits.startsWith("250") ? `0${digits.slice(3)}` : digits;
    if (/^07[89]/.test(local)) setMethod("MTN_MOMO");
    if (/^07[23]/.test(local)) setMethod("AIRTEL_MONEY");
  };

  const submit = async () => {
    setMsg("");
    setMsgOk(false);
    const value = Number(amount);
    if (!value || value < 10000) { setMsg("Enter at least RWF 10,000."); return; }
    if (wallet && value > Number(wallet.availableBalance || 0)) { setMsg("That is more than your available balance."); return; }
    const isBank = method === "BANK_TRANSFER";
    if (!isBank && !phoneNumber.trim()) { setMsg("Enter the mobile money number to receive the money."); return; }
    if (isBank && (!bank.bankName.trim() || !bank.accountNumber.trim() || !bank.accountName.trim())) { setMsg("Enter the bank name, account number and account name."); return; }
    setBusy(true);
    try {
      const res = await affiliatesApi.requestPayout({
        amount: value,
        paymentMethod: method,
        accountDetails: isBank ? bank : { phoneNumber: phoneNumber.trim() },
      });
      const status = res?.data?.status || res?.payout?.status;
      setMsgOk(true);
      setMsg(status === "COMPLETED"
        ? `${money(value)} was sent to your mobile money.`
        : status === "PROCESSING"
          ? `${money(value)} is being sent to your mobile money. You will get a notification when it arrives.`
          : `Your ${money(value)} withdrawal is waiting for MVEC approval. You will get a notification when it is sent.`);
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
        {method === "BANK_TRANSFER" ? <>
          <label className="field"><span>Bank name</span><input value={bank.bankName} onChange={e => setBank({ ...bank, bankName: e.target.value })} /></label>
          <label className="field"><span>Account number</span><input value={bank.accountNumber} onChange={e => setBank({ ...bank, accountNumber: e.target.value })} /></label>
          <label className="field"><span>Account name</span><input value={bank.accountName} onChange={e => setBank({ ...bank, accountName: e.target.value })} /></label>
        </> : <label className="field"><span>Mobile money number</span><input type="tel" value={phoneNumber} onChange={e => onPhone(e.target.value)} placeholder="07xx xxx xxx" /></label>}
        <button className="gradient-btn" onClick={submit} disabled={busy || !wallet || Number(wallet.availableBalance || 0) < 10000}>{busy ? "Submitting…" : "Withdraw"}</button>
        {wallet && Number(wallet.availableBalance || 0) < 10000 && <p className="tiny">You can withdraw once your available balance reaches RWF 10,000. Commissions become available after the buyer confirms delivery.</p>}
        {msg && <p className={msgOk ? "success-text" : "form-alert error"} role="status">{msg}</p>}
      </div>
      <div className="data-card"><h3>Payout process</h3><div className="timeline">{["Request a withdrawal to MTN MoMo, Airtel Money or a bank account.", "Up to RWF 100,000 to mobile money is sent automatically within minutes.", "Larger amounts and bank transfers are sent after MVEC approval.", "You get a notification and SMS when the money is sent. A failed transfer returns to your balance."].map((x, i) => <div className="timeline-item done" key={x}><i /><div><b>{i + 1}. {x}</b></div></div>)}</div></div>
    </div>
    <div className="data-card"><h3>Withdrawal history</h3>
      {loading && <div className="empty-state"><h3>Loading…</h3></div>}
      {!loading && <SmartTable
        columns={[
          { key: "payoutNumber", label: "Request" },
          { key: "amount", label: "Amount", render: r => money(r.amount) },
          { key: "paymentMethod", label: "Method", render: r => ({ MTN_MOMO: "MTN MoMo", AIRTEL_MONEY: "Airtel Money", BANK_TRANSFER: "Bank" }[r.paymentMethod] || r.paymentMethod) },
          { key: "createdAt", label: "Requested", render: r => new Date(r.createdAt).toLocaleDateString("en-GB") },
          { key: "status", label: "Status", render: r => ({ PENDING: "Waiting for approval", APPROVED: "Approved", PROCESSING: "Sending", COMPLETED: "Sent", REJECTED: r.rejectionReason ? `Not sent · ${r.rejectionReason}` : "Not sent" }[r.status] || r.status) },
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
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", displayName: "", bio: "", website: "" });
  const [profileMsg, setProfileMsg] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwMsg, setPwMsg] = useState(null);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    affiliatesApi.getProfile()
      .then(p => setForm({
        fullName: p.Fullname || p.fullname || "",
        phone: p.phone || "",
        email: p.email || "",
        displayName: p.displayName || "",
        bio: p.bio || "",
        website: p.website || "",
      }))
      .catch(err => setLoadError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));
  const setPass = key => e => setPw(prev => ({ ...prev, [key]: e.target.value }));

  const saveProfile = async e => {
    e.preventDefault();
    setProfileMsg(null);
    if (form.fullName.trim().length < 2) return setProfileMsg({ ok: false, text: "Full name is required." });
    if (!form.phone.trim()) return setProfileMsg({ ok: false, text: "Phone number is required." });
    setSavingProfile(true);
    try {
      await affiliatesApi.updateProfile({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        displayName: form.displayName,
        bio: form.bio,
        website: form.website,
      });
      await refresh?.();
      setProfileMsg({ ok: true, text: "Profile updated." });
    } catch (err) {
      setProfileMsg({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async e => {
    e.preventDefault();
    setPwMsg(null);
    if (!pw.currentPassword) return setPwMsg({ ok: false, text: "Enter your current password." });
    if (pw.newPassword.length < 8) return setPwMsg({ ok: false, text: "New password must be at least 8 characters." });
    if (pw.newPassword !== pw.confirmPassword) return setPwMsg({ ok: false, text: "New password and confirmation do not match." });
    setSavingPw(true);
    try {
      await authApi.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwMsg({ ok: true, text: "Password updated." });
    } catch (err) {
      setPwMsg({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setSavingPw(false);
    }
  };

  const Msg = ({ m }) => m ? <p className={m.ok ? "success-text" : "form-alert error"}>{m.text}</p> : null;

  return <>
    <div className="dash-page-head"><div><span className="eyebrow">AFFILIATE PROFILE</span><h1>Profile</h1><p>Manage your account details and password without leaving the dashboard.</p></div></div>
    {loadError && <div className="form-error">{loadError}</div>}
    {loading ? <div className="empty-state"><h3>Loading…</h3></div> : <div className="profile-grid">
      <form className="data-card" onSubmit={saveProfile}>
        <h3>Account details</h3>
        <label className="field"><span>Full name *</span><input value={form.fullName} onChange={set("fullName")} required /></label>
        <label className="field"><span>Phone number *</span><input value={form.phone} onChange={set("phone")} placeholder="0788123456" required /></label>
        <label className="field"><span>Email (optional)</span><input type="email" value={form.email} onChange={set("email")} /></label>
        <label className="field"><span>Public display name</span><input value={form.displayName} onChange={set("displayName")} /></label>
        <label className="field"><span>Website</span><input value={form.website} onChange={set("website")} /></label>
        <label className="field"><span>Bio</span><textarea rows={3} value={form.bio} onChange={set("bio")} /></label>
        <Msg m={profileMsg} />
        <button className="gradient-btn" type="submit" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save changes"}</button>
      </form>
      <form className="data-card" onSubmit={savePassword}>
        <h3>Change password</h3>
        <label className="field"><span>Current password</span><input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={setPass("currentPassword")} /></label>
        <label className="field"><span>New password</span><input type="password" autoComplete="new-password" value={pw.newPassword} onChange={setPass("newPassword")} /></label>
        <label className="field"><span>Confirm new password</span><input type="password" autoComplete="new-password" value={pw.confirmPassword} onChange={setPass("confirmPassword")} /></label>
        <Msg m={pwMsg} />
        <button className="gradient-btn" type="submit" disabled={savingPw}>{savingPw ? "Updating…" : "Update password"}</button>
      </form>
    </div>}
  </>;
}

function AffiliateDashboard() {
  const path = useLocation().pathname;
  let page = path.includes("/products") ? <Products />
    : path.includes("/links") ? <Links />
    : path.includes("/commissions") ? <Commissions />
    : path.includes("/commissions") ? <Commissions />
    : path.includes("/withdrawals") ? <Withdrawals />
    : path.includes("/wallet") ? <Wallet />
    : path.includes("/profile") ? <Profile />
    : <Overview />;
  return <DashboardLayout>{page}</DashboardLayout>;
}
export default AffiliateDashboard;
