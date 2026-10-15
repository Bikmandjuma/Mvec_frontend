import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import ProductImage from "../components/ProductImage";
import SmartTable from "../components/SmartTable";
import { affiliatesApi } from "../API/affiliates";
import { PageHead, StatusPill, money, dateDMY } from "./seller/shared";
import { client, extractErrorMessage } from "../API/client";
import { productsApi } from "../API/products";

const STEPS = [
  ["You open your products", "Turn the program on for all your products or only the ones you choose, and set the commission you add."],
  ["Affiliates share tracked links", "Each affiliate gets a unique link. A visitor who clicks it is remembered for 30 days (the last link clicked wins)."],
  ["A buyer orders and pays", "The affiliate's commission is recorded as pending. Nothing is taken from you yet."],
  ["The buyer confirms delivery", "Only then is the commission earned: your share is deducted from that sale, together with MVEC's fee."],
  ["Refunds reverse it", "If the order is cancelled or refunded, the affiliate's commission is taken back."],
];

// Who brings you buyers: affiliates, promoted products and referred orders.
// Hidden when the summary endpoint is not available on this server.
function ReferredSales() {
  const [data, setData] = useState(null);
  useEffect(() => { affiliatesApi.getVendorSummary().then(setData).catch(() => setData(null)); }, []);
  if (!data) return null;

  const affiliateCols = [
    { key: "name", label: "Affiliate", render: r => <b>{r.name}</b> },
    { key: "links", label: "Links", render: r => r.links || "—" },
    { key: "clicks", label: "Clicks", render: r => Number(r.clicks || 0).toLocaleString() },
    { key: "orders", label: "Orders", render: r => r.orders },
    { key: "sales", label: "Your sales", render: r => <b>{money(r.sales)}</b> },
    { key: "lastOrderAt", label: "Last order", render: r => dateDMY(r.lastOrderAt) },
  ];
  const productCols = [
    { key: "name", label: "Product", render: r => <Link to={`/product/${r.productId}`}><b>{r.name}</b></Link> },
    { key: "links", label: "Affiliate links", render: r => r.links || "—" },
    { key: "clicks", label: "Clicks", render: r => Number(r.clicks || 0).toLocaleString() },
    { key: "units", label: "Units sold", render: r => r.units || 0 },
    { key: "sales", label: "Sales", render: r => <b>{money(r.sales)}</b> },
  ];
  const orderCols = [
    { key: "date", label: "Date", render: r => dateDMY(r.date) },
    { key: "orderNumber", label: "Order", render: r => <Link to={`/vendor/orders/${r.orderId}`}>{r.orderNumber}</Link> },
    { key: "affiliate", label: "Referred by", render: r => <span>{r.affiliate}<small className="tiny seller-block">{r.code}</small></span> },
    { key: "sales", label: "Your items", render: r => money(r.sales) },
    { key: "status", label: "Status", render: r => <StatusPill value={r.paymentStatus === "PAID" ? r.orderStatus : r.paymentStatus} /> },
  ];

  return <>
    {data.affiliates?.length > 0 && <div className="data-card"><div className="data-card-head"><div><h3>Top affiliates</h3><span>Who brings you buyers</span></div></div>
      <SmartTable columns={affiliateCols} rows={data.affiliates} rowKey={r => r.affiliateId} searchPlaceholder="Search affiliates…" exportName="mvec-affiliates" />
    </div>}
    {data.products?.length > 0 && <div className="data-card"><div className="data-card-head"><div><h3>Products affiliates promote</h3><span>Links, clicks and sales per product</span></div></div>
      <SmartTable columns={productCols} rows={data.products} rowKey={r => r.productId} pageSize={5} searchPlaceholder="Search products…" exportName="mvec-affiliate-products" />
    </div>}
    {data.recent?.length > 0 && <div className="data-card"><div className="data-card-head"><div><h3>Recent referred orders</h3><span>Latest 20</span></div></div>
      <SmartTable columns={orderCols} rows={data.recent} rowKey={r => r.orderId} searchPlaceholder="Search orders…" exportName="mvec-affiliate-orders" />
    </div>}
  </>;
}

export default function VendorAffiliate() {
  const [program, setProgram] = useState(null);
  const [stats, setStats] = useState(null);
  const [maxRate, setMaxRate] = useState(30);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ enabled: false, ratePercent: 0, scope: "ALL", productIds: [] });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setError("");
    try {
      const [p, list] = await Promise.all([client.get("/vendors/me/affiliate-program").then((r) => r.data), productsApi.getVendorProducts()]);
      setProgram(p.program);
      setStats(p.stats);
      setMaxRate(p.maxRatePercent || 30);
      setForm({ enabled: p.program.enabled, ratePercent: p.program.ratePercent, scope: p.program.scope, productIds: p.program.selectedProductIds || [] });
      setProducts((list.products || []).filter((x) => ["ACTIVE", "OUT_OF_STOCK"].includes(x.status)));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const platformPercent = program?.platformPercent ?? 0.5;
  const rate = Math.max(0, Number(form.ratePercent) || 0);
  const total = Math.round((platformPercent + rate) * 100) / 100;
  const shown = useMemo(() => products.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())), [products, q]);
  const toggleProduct = (id) => setForm((f) => ({ ...f, productIds: f.productIds.includes(id) ? f.productIds.filter((x) => x !== id) : [...f.productIds, id] }));

  const save = async (e) => {
    e?.preventDefault();
    setError(""); setNotice("");
    if (rate > maxRate) { setError(`Choose a commission between 0% and ${maxRate}%.`); return; }
    if (form.enabled && form.scope === "SELECTED" && form.productIds.length === 0) { setError("Choose at least one product, or open all your products to affiliates."); return; }
    setSaving(true);
    try {
      const res = await client.put("/vendors/me/affiliate-program", { enabled: form.enabled, ratePercent: rate, scope: form.scope, productIds: form.scope === "SELECTED" ? form.productIds : undefined }).then((r) => r.data);
      setNotice(res.message);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return <DashboardLayout>
    <PageHead eyebrow="MARKETING" title="Affiliate program"
      desc="Let affiliates and influencers promote your products for a commission. It is off until you turn it on, and you choose which products and how much you add." />
    {error && <div className="form-alert error" role="alert">{error}</div>}
    {notice && <div className="form-alert success" role="status">{notice}</div>}
    {loading ? <div className="empty-state"><h3>Loading…</h3></div> : program && <>
      <form className="data-card affiliate-program-card" onSubmit={save}>
        <div className="data-card-head"><div><h3>Program settings</h3><span>{program.enabled ? `On · affiliates earn ${program.totalPercent}%` : "Off · affiliates cannot promote your products"}</span></div></div>

        <label className="program-switch">
          <input type="checkbox" role="switch" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          <span><b>Let affiliates promote my products</b><small>When off, your products are not offered to affiliates and existing links stop earning. Orders already placed keep their commission.</small></span>
        </label>

        <fieldset className="program-section" disabled={!form.enabled}>
          <legend>Commission you add</legend>
          <div className="program-rate">
            <label className="field"><span>Your commission (%)</span>
              <input type="number" min="0" max={maxRate} step="0.5" value={form.ratePercent} onChange={(e) => setForm({ ...form, ratePercent: e.target.value })} />
            </label>
            <div className="program-example">
              <b>Affiliates earn {total}% per delivered sale</b>
              <small>MVEC pays {platformPercent}% from its fee; you pay {rate}% from your earnings on that sale.</small>
              <small>Example: on a {money(100000)} sale the affiliate earns {money(1000 * total)}; you pay {money(1000 * rate)}.</small>
            </div>
          </div>
        </fieldset>

        <fieldset className="program-section" disabled={!form.enabled}>
          <legend>Which products</legend>
          <label className="filter-check"><input type="radio" name="scope" checked={form.scope === "ALL"} onChange={() => setForm({ ...form, scope: "ALL" })} /> All my products (including new ones)</label>
          <label className="filter-check"><input type="radio" name="scope" checked={form.scope === "SELECTED"} onChange={() => setForm({ ...form, scope: "SELECTED" })} /> Only the products I choose</label>
          {form.scope === "SELECTED" && <div className="program-products">
            <div className="dash-filter"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your products…" aria-label="Search your products" /></div>
            {shown.length === 0 && <p className="tiny">No products for sale yet.</p>}
            {shown.map((p) => {
              const id = String(p.id || p._id);
              return <label key={id} className={`program-product ${form.productIds.includes(id) ? "selected" : ""}`}>
                <input type="checkbox" checked={form.productIds.includes(id)} onChange={() => toggleProduct(id)} />
                <ProductImage src={p.media?.mainImage || p.mainImage} alt="" />
                <span><b>{p.name}</b><small>{money(p.discountPrice || p.price)} · affiliate earns {money(((Number(p.discountPrice || p.price) || 0) * total) / 100)}</small></span>
              </label>;
            })}
            <small className="tiny">{form.productIds.length} product{form.productIds.length === 1 ? "" : "s"} chosen</small>
          </div>}
        </fieldset>

        <button className="gradient-btn" type="submit" disabled={saving}>{saving ? "Saving…" : "Save program"}</button>
      </form>

      {stats && <div className="metric-grid">
        {[["Active links", stats.activeLinks, `${stats.affiliates} affiliate${stats.affiliates === 1 ? "" : "s"}`], ["Clicks", stats.clicks, "Visits from affiliate links"], ["Affiliate orders", stats.orders, money(stats.sales) + " in sales"], ["Commission", money(stats.commission), `${money(stats.paidByYou)} paid by you`]].map(([label, value, sub]) =>
          <div className="metric" key={label}><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div></div>)}
      </div>}

      <ReferredSales />

      <div className="data-card">
        <div className="data-card-head"><div><h3>How it works</h3><span>Commission is only earned on delivered orders</span></div></div>
        <div className="timeline">
          {STEPS.map(([title, text], i) => <div className="timeline-item done" key={title}><i /><div><b>{i + 1}. {title}</b><small>{text}</small></div></div>)}
        </div>
      </div>
    </>}
  </DashboardLayout>;
}
