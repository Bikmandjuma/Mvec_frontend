import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import useUrlQuery from '../../components/useUrlQuery';
import Pagination from '../../components/Pagination';
import { ordersApi } from '../../API/orders';
import ManualOrderModal from './ManualOrderModal';
import {
  PageHead, Loading, EmptyState, Metric, StatusPill, FormModal, money, dateDMY, matches, personName, titleCase,
  sellerNextStatuses, canRecordCash, stepLabelFor, ORDER_TABS, isRevenueOrder, useLoader, useNotice,
} from './shared';

const PER_PAGE = 10;
const RANGES = [['all', 'All time'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']];
const CANCEL_REASONS = [
  ['Out of stock', 'Out of stock'],
  ['Customer asked to cancel', 'Customer asked to cancel'],
  ['Cannot deliver to this address', 'Cannot deliver to this address'],
  ['Pricing error', 'Pricing error'],
  ['Other', 'Other'],
];

const customerOf = (o) => o.customer?.name || personName(o.user);
const orderTotal = (o) => Number(o.vendorSubtotal || 0) + Number(o.vendorShippingFee || 0);
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function exportOrdersCsv(rows) {
  const header = ['Order', 'Date', 'Customer', 'Phone', 'Source', 'Items', 'Products (RWF)', 'Delivery (RWF)', 'Payment', 'Status'];
  const lines = rows.map((o) => [
    o.orderNumber, new Date(o.createdAt).toISOString().slice(0, 10), customerOf(o), o.customer?.phone || o.user?.phone || '',
    o.source || 'ONLINE', (o.items || []).map((i) => `${i.quantity}x ${i.name}`).join('; '), o.vendorSubtotal || 0, o.vendorShippingFee || 0,
    o.paymentStatus, o.orderStatus,
  ].map(csvCell).join(','));
  const blob = new Blob(['﻿' + [header.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mvec-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useLoader(() => ordersApi.getVendorOrders().then((r) => r.orders || []));
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  useUrlQuery((v) => { setQ(v); setPage(1); });
  const [source, setSource] = useState('');
  const [range, setRange] = useState('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const [cancelling, setCancelling] = useState(null);
  const [creating, setCreating] = useState(false);
  const notice = useNotice();

  const orders = data || [];
  const inRange = useMemo(() => {
    if (range === 'all') return orders;
    const since = Date.now() - Number(range) * 86400000;
    return orders.filter((o) => new Date(o.createdAt).getTime() >= since);
  }, [orders, range]);
  const base = useMemo(() => inRange.filter((o) => (!source || (o.source || 'ONLINE') === source)
    && matches(q, o.orderNumber, customerOf(o), o.user?.email, o.customer?.phone, o.shippingAddress?.district, o.shippingAddress?.city, ...(o.items || []).map((i) => i.name))), [inRange, source, q]);
  const counts = useMemo(() => Object.fromEntries(ORDER_TABS.map(([k, , statuses]) => [k, statuses ? base.filter((o) => statuses.includes(o.orderStatus)).length : base.length])), [base]);
  const filtered = useMemo(() => {
    const statuses = ORDER_TABS.find(([k]) => k === tab)?.[2];
    return statuses ? base.filter((o) => statuses.includes(o.orderStatus)) : base;
  }, [base, tab]);
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / PER_PAGE)));
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const stats = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const month = orders.filter((o) => new Date(o.createdAt) >= monthStart && isRevenueOrder(o) && o.paymentStatus === 'PAID');
    return {
      toAccept: orders.filter((o) => o.orderStatus === 'PENDING').length,
      toPrepare: orders.filter((o) => ['CONFIRMED', 'PROCESSING', 'READY_FOR_SHIPMENT'].includes(o.orderStatus)).length,
      onTheWay: orders.filter((o) => ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.orderStatus)).length,
      month: month.reduce((s, o) => s + orderTotal(o), 0),
      monthCount: month.length,
    };
  }, [orders]);

  const update = async (order, body, message) => {
    setBusy(order._id);
    try {
      const res = await ordersApi.updateVendorOrderStatus({ orderId: order._id, ...body });
      notice.success(message || res.message || 'Order updated.');
      await reload();
    } catch (err) { notice.fail(err); }
    finally { setBusy(''); }
  };

  return <>
    <PageHead title="Orders" desc="Online orders for your products and the sales you record yourself."
      action={<div className="row-actions">
        <button type="button" className="outline-btn" onClick={() => exportOrdersCsv(filtered)} disabled={!filtered.length}><Icon name="copy" size={15} /> Export</button>
        <button type="button" className="gradient-btn" onClick={() => setCreating(true)}><Icon name="plus" /> New order</button>
      </div>} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="To accept" value={stats.toAccept} icon="bell" sub="New orders waiting for you" />
        <Metric label="To prepare" value={stats.toPrepare} icon="box" sub="Accepted, not shipped yet" />
        <Metric label="On the way" value={stats.onTheWay} icon="cart" sub="Delivered with the buyer's code" />
        <Metric label="Paid this month" value={money(stats.month)} icon="wallet" sub={`${stats.monthCount} orders`} />
      </div>

      <div className="seller-view-tabs" role="tablist" aria-label="Order status">
        {ORDER_TABS.map(([k, label]) => <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => { setTab(k); setPage(1); }}>
          {label} <small>{counts[k]}</small>
        </button>)}
      </div>

      <div className="dash-toolbar">
        <div className="dash-filter"><Icon name="search" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search order, customer, phone, district or product" /></div>
        <select className="table-filter-select" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} aria-label="Order source">
          <option value="">All sources</option><option value="ONLINE">Online</option><option value="MANUAL">Manual</option>
        </select>
        <select className="table-filter-select" value={range} onChange={(e) => { setRange(e.target.value); setPage(1); }} aria-label="Period">
          {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="data-card seller-ord-card">
        {!orders.length
          ? <EmptyState title="No orders yet" text="Orders for your products appear here. You can also record a sale yourself." action={<button type="button" className="gradient-btn" onClick={() => setCreating(true)}><Icon name="plus" /> New order</button>} />
          : !filtered.length ? <p className="tiny seller-cat-empty">No orders match these filters.</p>
          : <div className="data-table">
            <div className="seller-ord-row seller-ord-head"><span>Order</span><span>Customer</span><span>Items</span><span>Total</span><span>Payment</span><span>Status</span><span /></div>
            {shown.map((o) => {
              const next = sellerNextStatuses(o).filter((s) => s !== 'CANCELLED');
              const canCancel = sellerNextStatuses(o).includes('CANCELLED');
              return <div className="seller-ord-row" key={o._id}>
                <span>
                  <Link to={`/vendor/orders/${o._id}`}><b>{o.orderNumber}</b></Link>
                  {o.source === 'MANUAL' && <em className="seller-manual-tag">Manual</em>}
                  <small className="tiny seller-block">{dateDMY(o.createdAt)}</small>
                </span>
                <span>{customerOf(o)}<small className="tiny seller-block">{o.customer?.phone || o.shippingAddress?.district || o.shippingAddress?.city || ''}</small></span>
                <span className="seller-ord-items">{(o.items || [])[0]?.name}{o.items?.length > 1 && <small className="tiny seller-block">+{o.items.length - 1} more</small>}</span>
                <span><b>{money(orderTotal(o))}</b>{o.vendorShippingFee > 0 && <small className="tiny seller-block">incl. {money(o.vendorShippingFee)} delivery</small>}</span>
                <span><StatusPill value={o.paymentStatus} /></span>
                <span><StatusPill value={o.orderStatus} /></span>
                <span className="seller-ord-actions">
                  {next.map((s) => <button type="button" key={s} className="table-action-btn primary" disabled={busy === o._id} onClick={() => update(o, { status: s }, `${o.orderNumber}: ${titleCase(s).toLowerCase()}.`)}>{stepLabelFor(o, s) || titleCase(s)}</button>)}
                  {canRecordCash(o) && <button type="button" className="table-action-btn" disabled={busy === o._id} onClick={() => update(o, { paymentStatus: 'PAID' }, `Cash recorded for ${o.orderNumber}.`)}>Cash received</button>}
                  {!next.length && !canRecordCash(o) && ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.orderStatus) && <small className="tiny">Awaiting delivery code</small>}
                  {canCancel && <button type="button" className="seller-icon-btn" title="Cancel order" disabled={busy === o._id} onClick={() => setCancelling(o)}><Icon name="trash" size={15} /></button>}
                </span>
              </div>;
            })}
          </div>}
        {filtered.length > PER_PAGE && <Pagination page={current} setPage={setPage} total={filtered.length} perPage={PER_PAGE} />}
      </div>
    </>}

    {creating && <ManualOrderModal onClose={() => setCreating(false)} onCreated={(res) => { setCreating(false); navigate(`/vendor/orders/${res.order._id || res.order.id}`); }} />}
    {cancelling && <FormModal title={`Cancel ${cancelling.orderNumber}?`}
      subtitle={cancelling.paymentStatus === 'PAID' && !cancelling.paidOffline ? 'The buyer paid through MVEC: they get a full refund, and your items go back into stock.' : 'Your items go back into stock. The customer is notified.'}
      fields={[
        { name: 'reason', label: 'Reason', type: 'select', options: CANCEL_REASONS, required: true },
        { name: 'note', label: 'Note for the customer', placeholder: 'Optional' },
      ]}
      initial={{ reason: CANCEL_REASONS[0][0], note: '' }} submitLabel="Cancel order" onClose={() => setCancelling(null)}
      onSubmit={async (form) => {
        const o = cancelling;
        await ordersApi.updateVendorOrderStatus({ orderId: o._id, status: 'CANCELLED', reason: form.note ? `${form.reason}: ${form.note}` : form.reason });
        setCancelling(null);
        notice.success(`${o.orderNumber} cancelled.`);
        reload();
      }} />}
  </>;
}
