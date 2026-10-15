import { Link } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import SmartTable from "../components/SmartTable";
import { affiliatesApi } from "../API/affiliates";
import { PageHead, Loading, Metric, StatusPill, money, dateDMY, useLoader } from "./seller/shared";

const STEPS = [
  ["Affiliates pick your products", "MVEC affiliates and influencers create tracked links to your active products."],
  ["Buyers follow the link", "The referral is remembered for 30 days on the buyer's device."],
  ["The order is paid through MVEC", "It appears in your Orders as usual, marked as an affiliate sale."],
  ["Commission after delivery", "The affiliate earns once the buyer confirms delivery, paid by MVEC from its platform fee."],
];

// Seller view of affiliate marketing: referred sales, the affiliates and
// products behind them, and link clicks. Commission costs the seller nothing.
export default function VendorAffiliate() {
  const { data, loading, error } = useLoader(() => affiliatesApi.getVendorSummary());
  const t = data?.totals || {};

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

  return <DashboardLayout>
    <PageHead eyebrow="MARKETING" title="Affiliate marketing"
      desc="Affiliates and influencers promote your products with tracked links. You pay nothing extra: their commission comes out of MVEC's platform fee."
      action={<Link className="outline-btn" to="/vendor/products">Review my products</Link>} />
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="Referred sales" value={money(t.sales)} icon="chart" sub={`${t.orders || 0} orders · ${t.paidOrders || 0} paid`} />
        <Metric label="Affiliates" value={t.affiliates || 0} icon="users" sub={`${t.links || 0} links to your products`} />
        <Metric label="Link clicks" value={Number(t.clicks || 0).toLocaleString()} icon="eye" sub={t.conversionRate != null ? `${t.conversionRate}% became orders` : "No clicks yet"} />
        <Metric label="Cost to you" value={money(0)} icon="wallet" sub={`MVEC pays affiliates ${data.commissionPercent}% of the sale`} />
      </div>
      {!t.orders && !t.links && <div className="verified-box"><b>No affiliate activity yet</b><p>Affiliates choose products that are active, in stock and well presented. Good photos, clear descriptions and competitive prices make your products easier to promote.</p></div>}
      {data.affiliates.length > 0 && <div className="data-card"><div className="data-card-head"><div><h3>Top affiliates</h3><span>Who brings you buyers</span></div></div>
        <SmartTable columns={affiliateCols} rows={data.affiliates} rowKey={r => r.affiliateId} searchPlaceholder="Search affiliates…" exportName="mvec-affiliates" />
      </div>}
      <div className="dash-grid">
        <div className="data-card"><div className="data-card-head"><div><h3>Products affiliates promote</h3><span>Links, clicks and sales per product</span></div></div>
          <SmartTable columns={productCols} rows={data.products} rowKey={r => r.productId} pageSize={5} searchPlaceholder="Search products…" exportName="mvec-affiliate-products" empty="None of your products has an affiliate link yet." />
        </div>
        <div className="data-card">
          <div className="data-card-head"><div><h3>How it works</h3><span>Commission is earned only on delivered orders</span></div></div>
          <div className="timeline">
            {STEPS.map(([title, text], i) => <div className="timeline-item done" key={title}><i /><div><b>{i + 1}. {title}</b><small>{text}</small></div></div>)}
          </div>
        </div>
      </div>
      {data.recent.length > 0 && <div className="data-card"><div className="data-card-head"><div><h3>Recent referred orders</h3><span>Latest 20</span></div></div>
        <SmartTable columns={orderCols} rows={data.recent} rowKey={r => r.orderId} searchPlaceholder="Search orders…" exportName="mvec-affiliate-orders" />
      </div>}
    </>}
  </DashboardLayout>;
}
