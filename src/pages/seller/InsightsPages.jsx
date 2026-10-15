// Seller pages derived from the vendor's own orders, products and payouts:
// Analytics and Reports.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SmartTable from '../../components/SmartTable';
import { ordersApi } from '../../API/orders';
import { productsApi } from '../../API/products';
import { payoutsApi } from '../../API/payouts';
import { vendorServicesApi } from '../../API/vendorServices';
import {
  PageHead, Loading, Metric, StatusPill, BarChart, money, dateDMY, titleCase, personName,
  parsePercent, summarizeOrders, monthlyRevenue, isRevenueOrder, useLoader,
} from './shared';

const loadVendorData = () => Promise.all([
  ordersApi.getVendorOrders().then(r => r.orders || []),
  productsApi.getVendorProducts().then(r => r.products || []).catch(() => []),
  payoutsApi.getBalance().catch(() => null),
]).then(([orders, products, balance]) => ({ orders, products, commission: parsePercent(balance?.commissionRate), balance: balance?.balance }));

// Where each counted order came from. An order can carry both a coupon and
// an affiliate referral; affiliate wins so channels add up to the total.
const CHANNELS = [['AFFILIATE', 'Affiliate referral'], ['COUPON', 'Coupon code'], ['MANUAL', 'Manual order'], ['ONLINE', 'Direct online']];
const channelOf = o => (o.affiliateCode ? 'AFFILIATE' : o.coupon?.code ? 'COUPON' : o.source === 'MANUAL' ? 'MANUAL' : 'ONLINE');

export function AnalyticsPage() {
  const { data, loading, error } = useLoader(() => Promise.all([
    loadVendorData(),
    vendorServicesApi.getAdvertisements().then(r => r.data || []).catch(() => []),
  ]).then(([vendor, ads]) => ({ ...vendor, ads })));
  const channels = useMemo(() => {
    if (!data) return [];
    const counted = data.orders.filter(isRevenueOrder);
    const total = counted.reduce((t, o) => t + Number(o.vendorSubtotal || 0), 0);
    return CHANNELS.map(([k, label]) => {
      const list = counted.filter(o => channelOf(o) === k);
      const sales = list.reduce((t, o) => t + Number(o.vendorSubtotal || 0), 0);
      return { k, label, orders: list.length, sales, share: total ? (sales / total) * 100 : 0 };
    });
  }, [data]);
  const growth = useMemo(() => data && {
    discount: data.orders.filter(isRevenueOrder).reduce((t, o) => t + Number(o.vendorDiscount || 0), 0),
    adSpend: data.ads.reduce((t, a) => t + Number(a.spent || 0), 0),
    adClicks: data.ads.reduce((t, a) => t + Number(a.clicks || 0), 0),
    liveAds: data.ads.filter(a => a.statusKey === 'ACTIVE').length,
  }, [data]);
  const stats = useMemo(() => data && summarizeOrders(data.orders, data.commission), [data]);
  const months = useMemo(() => data ? monthlyRevenue(data.orders, 6) : [], [data]);
  const lowStock = data ? data.products.filter(p => Number(p.stockQuantity) <= Number(p.lowStockThreshold || 5)).length : 0;

  return <>
    <PageHead title="Analytics" desc="Sales performance across your orders and catalog." />
    {loading && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {stats && <>
      <div className="metric-grid">
        <Metric label="Gross sales" value={money(stats.gross)} icon="chart" sub={`${stats.countedOrders} orders`} />
        <Metric label="Average order" value={money(stats.averageOrder)} icon="cart" sub="Your items per order" />
        <Metric label="Customers" value={stats.customers} icon="users" sub="Unique buyers" />
        <Metric label="Active products" value={data.products.filter(p => p.status === 'ACTIVE').length} icon="box" sub={`${lowStock} low on stock`} />
      </div>
      <div className="dash-grid">
        <div className="data-card">
          <div className="data-card-head"><div><h3>Revenue</h3><span>Last 6 months, excluding cancelled orders</span></div></div>
          <BarChart data={months} format={v => `${Math.round(v / 1000)}k`} />
        </div>
        <div className="data-card">
          <div className="data-card-head"><div><h3>Orders by status</h3><span>{stats.orders} total</span></div></div>
          {Object.keys(stats.byStatus).length === 0 && <p className="tiny">No orders yet.</p>}
          {Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) =>
            <div className="progress-row" key={status}><span>{titleCase(status)}</span><div><i style={{ width: `${(count / stats.orders) * 100}%` }} /></div><b>{count}</b></div>)}
        </div>
      </div>
      <div className="dash-grid">
        <div className="data-card">
          <div className="data-card-head"><div><h3>Sales by channel</h3><span>Where your orders come from</span></div></div>
          {channels.map(c => <div className="progress-row" key={c.k} title={`${c.orders} orders`}><span>{c.label}</span><div><i style={{ width: `${c.share}%` }} /></div><b>{Math.round(c.share)}%</b></div>)}
          <p className="tiny">{channels.map(c => `${c.label}: ${money(c.sales)} (${c.orders})`).join(' · ')}</p>
        </div>
        <div className="data-card">
          <div className="data-card-head"><div><h3>Growth spend</h3><span>What marketing cost you</span></div><Link to="/vendor/advertisements">Advertisements</Link></div>
          <div className="activity-row"><div><b>Coupon discounts</b><small>Given on your items</small></div><strong>{money(growth.discount)}</strong></div>
          <div className="activity-row"><div><b>Ad spend</b><small>{growth.adClicks.toLocaleString()} clicks · {growth.liveAds} live campaign{growth.liveAds === 1 ? '' : 's'}</small></div><strong>{money(growth.adSpend)}</strong></div>
          <div className="activity-row"><div><b>Affiliate commission</b><small>Paid by MVEC, not you</small></div><strong>{money(0)}</strong></div>
        </div>
      </div>
      <div className="data-card">
        <div className="data-card-head"><div><h3>Top products</h3><span>By revenue</span></div><Link to="/vendor/products">Manage products</Link></div>
        {stats.topProducts.length === 0 && <p className="tiny">Sales by product will appear after your first order.</p>}
        {stats.topProducts.slice(0, 6).map(p => <div className="activity-row" key={p.name}><div><b>{p.name}</b><small>{p.units} units sold</small></div><strong>{money(p.revenue)}</strong></div>)}
      </div>
    </>}
  </>;
}

const RANGES = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['365', 'Last 12 months'], ['all', 'All time']];

export function ReportsPage() {
  const { data, loading, error } = useLoader(loadVendorData);
  const [range, setRange] = useState('30');

  const orders = useMemo(() => {
    if (!data) return [];
    if (range === 'all') return data.orders;
    const since = Date.now() - Number(range) * 86400000;
    return data.orders.filter(o => new Date(o.createdAt).getTime() >= since);
  }, [data, range]);
  const stats = useMemo(() => data && summarizeOrders(orders, data.commission), [data, orders]);

  const columns = [
    { key: 'orderNumber', label: 'Order', render: r => <Link to={`/vendor/orders/${r._id}`}><b>{r.orderNumber}</b></Link> },
    { key: 'buyer', label: 'Buyer' },
    { key: 'date', label: 'Date', render: r => dateDMY(r.createdAt) },
    { key: 'vendorSubtotal', label: 'Amount', render: r => money(r.vendorSubtotal) },
    { key: 'payment', label: 'Payment', render: r => <StatusPill value={r.paymentStatus} /> },
    { key: 'status', label: 'Status', render: r => <StatusPill value={r.orderStatus} /> },
  ];
  const rows = orders.map(o => ({ ...o, buyer: personName(o.user), payment: o.paymentStatus, status: o.orderStatus }));

  return <>
    <PageHead title="Reports" desc="Sales summary for a chosen period, with an order-level export."
      action={<select className="table-filter-select" value={range} onChange={e => setRange(e.target.value)} aria-label="Report period">
        {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>} />
    {loading && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {stats && <>
      <div className="metric-grid">
        <Metric label="Gross sales" value={money(stats.gross)} icon="chart" sub={`${stats.countedOrders} orders`} />
        <Metric label="Paid sales" value={money(stats.paidGross)} icon="wallet" sub={`${stats.paidOrders} paid orders`} />
        <Metric label={`Platform fee (${data.commission}%)`} value={money(stats.commission)} icon="tag" sub="On paid sales" />
        <Metric label="Net earnings" value={money(stats.net)} icon="check" sub="Paid sales after fee" />
      </div>
      <div className="data-card">
        <div className="data-card-head"><div><h3>Orders in period</h3><span>Use Export for a CSV copy</span></div></div>
        <SmartTable columns={columns} rows={rows} rowKey={r => r._id} searchPlaceholder="Search orders…" exportName={`mvec-sales-report-${range}`} empty="No orders in this period." />
      </div>
    </>}
  </>;
}

