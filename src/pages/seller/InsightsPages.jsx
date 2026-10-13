// Seller pages derived from the vendor's own orders, products and payouts:
// Customers, Analytics, Reports and Transactions.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SmartTable from '../../components/SmartTable';
import { ordersApi } from '../../API/orders';
import { productsApi } from '../../API/products';
import { payoutsApi } from '../../API/payouts';
import {
  PageHead, Loading, Metric, StatusPill, BarChart, money, dateDMY, titleCase, personName,
  parsePercent, summarizeOrders, monthlyRevenue, isRevenueOrder, useLoader,
} from './shared';

const loadVendorData = () => Promise.all([
  ordersApi.getVendorOrders().then(r => r.orders || []),
  productsApi.getVendorProducts().then(r => r.products || []).catch(() => []),
  payoutsApi.getBalance().catch(() => null),
]).then(([orders, products, balance]) => ({ orders, products, commission: parsePercent(balance?.commissionRate), balance: balance?.balance }));

export function CustomersPage() {
  const { data: orders, loading, error } = useLoader(() => ordersApi.getVendorOrders().then(r => r.orders || []));

  const rows = useMemo(() => {
    const map = {};
    (orders || []).filter(isRevenueOrder).forEach(o => {
      const id = o.user?._id || o.user?.id || personName(o.user);
      const row = map[id] || (map[id] = { id, name: personName(o.user), email: o.user?.email || '', city: o.shippingAddress?.city || '', orders: 0, spent: 0, last: null });
      row.orders += 1;
      row.spent += Number(o.vendorSubtotal || 0);
      if (!row.last || new Date(o.createdAt) > new Date(row.last)) row.last = o.createdAt;
    });
    return Object.values(map).sort((a, b) => b.spent - a.spent);
  }, [orders]);

  const repeat = rows.filter(r => r.orders > 1).length;
  const columns = [
    { key: 'name', label: 'Customer', render: r => <div><b>{r.name}</b><small className="tiny seller-block">{r.email}</small></div> },
    { key: 'city', label: 'City', render: r => r.city || '—' },
    { key: 'orders', label: 'Orders' },
    { key: 'spent', label: 'Total spent', render: r => money(r.spent) },
    { key: 'last', label: 'Last purchase', render: r => dateDMY(r.last) },
  ];

  return <>
    <PageHead title="Customers" desc="Buyers who have ordered your products, ranked by what they spent with you." />
    {loading && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {orders && <>
      <div className="metric-grid">
        <Metric label="Customers" value={rows.length} icon="users" sub="Unique buyers" />
        <Metric label="Repeat customers" value={repeat} icon="heart" sub={rows.length ? `${Math.round((repeat / rows.length) * 100)}% came back` : 'No buyers yet'} />
        <Metric label="Top customer" value={rows[0] ? money(rows[0].spent) : '—'} icon="wallet" sub={rows[0]?.name || ''} />
      </div>
      <div className="data-card">
        <SmartTable columns={columns} rows={rows} rowKey={r => r.id} searchPlaceholder="Search customers…" exportName="mvec-customers" empty="No customers yet. Buyers appear here after their first order." />
      </div>
    </>}
  </>;
}

export function AnalyticsPage() {
  const { data, loading, error } = useLoader(loadVendorData);
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

export function TransactionsPage() {
  const { data, loading, error } = useLoader(() => Promise.all([
    loadVendorData(),
    payoutsApi.getHistory().then(r => r.payouts || []).catch(() => []),
  ]).then(([vendor, payouts]) => ({ ...vendor, payouts })));

  const rows = useMemo(() => {
    if (!data) return [];
    const rate = data.commission / 100;
    const sales = data.orders.filter(o => o.paymentStatus === 'PAID' && isRevenueOrder(o)).map(o => {
      const gross = Number(o.vendorSubtotal || 0);
      const delivery = Number(o.vendorShippingFee || 0); // paid in full, no commission
      return {
        id: `sale-${o._id}`, date: o.createdAt, type: 'Sale', reference: o.orderNumber, orderId: o._id,
        gross: gross + delivery, fee: gross * rate, net: gross - gross * rate + delivery, delivery,
        status: o.orderStatus === 'DELIVERED' || o.orderStatus === 'COMPLETED' ? 'RELEASED' : 'HELD',
      };
    });
    const payouts = data.payouts.map(p => ({
      id: `payout-${p._id || p.id}`, date: p.createdAt, type: 'Payout', reference: p.payoutNumber,
      gross: -Number(p.amount || 0), fee: 0, net: -Number(p.amount || 0), status: p.status,
      detail: p.payoutDetails?.bankName,
    }));
    return [...sales, ...payouts].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [data]);

  const columns = [
    { key: 'date', label: 'Date', render: r => dateDMY(r.date) },
    { key: 'type', label: 'Type', render: r => <b>{r.type}</b> },
    { key: 'reference', label: 'Reference', render: r => r.orderId ? <Link to={`/vendor/orders/${r.orderId}`}>{r.reference}</Link> : <span>{r.reference}{r.detail && <small className="tiny seller-block">{r.detail}</small>}</span> },
    { key: 'gross', label: 'Amount', render: r => <span className={r.gross < 0 ? 'seller-negative' : ''}>{money(r.gross)}{r.delivery > 0 && <small className="tiny seller-block">incl. {money(r.delivery)} delivery</small>}</span> },
    { key: 'fee', label: 'Fee', render: r => r.fee ? `-${money(r.fee)}` : '—' },
    { key: 'net', label: 'Net', render: r => <b className={r.net < 0 ? 'seller-negative' : ''}>{money(r.net)}</b> },
    { key: 'status', label: 'Status', render: r => <StatusPill value={r.status} /> },
  ];

  const balance = data?.balance;
  return <>
    <PageHead title="Transactions" desc="Every paid sale, platform fee and payout on your account."
      action={<Link className="outline-btn" to="/vendor/payouts">Request payout</Link>} />
    {loading && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="Available" value={money(balance?.availableBalance)} icon="wallet" sub="Ready to withdraw" />
        <Metric label="Held" value={money(balance?.pendingBalance)} icon="shield" sub="Released after delivery OTP" />
        <Metric label="Fees paid" value={money(balance?.commissionPaid)} icon="tag" sub={`${data.commission}% per sale`} />
      </div>
      <div className="data-card">
        <SmartTable columns={columns} rows={rows} rowKey={r => r.id} searchPlaceholder="Search transactions…" exportName="mvec-transactions" empty="No transactions yet." />
      </div>
    </>}
  </>;
}
