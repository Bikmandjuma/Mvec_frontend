import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { ordersApi } from '../API/orders';
import { payoutsApi } from '../API/payouts';
import { extractErrorMessage } from '../API/client';
import { useAuth } from '../context/AuthContext';
import { money, dateDMY, personName, titleCase, parsePercent, sellerNextStatuses, ORDER_FLOW, StatusPill } from './seller/shared';

const idOf = v => String(v?._id || v?.id || v || '');

export default function SellerOrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = location.pathname.startsWith('/admin');

  const [order, setOrder] = useState(null);
  const [commission, setCommission] = useState(parsePercent());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  const load = useCallback(() => ordersApi.getById(id)
    .then(res => setOrder(res.order))
    .catch(err => setError(extractErrorMessage(err)))
    .finally(() => setLoading(false)), [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isAdmin) payoutsApi.getBalance().then(b => setCommission(parsePercent(b?.commissionRate))).catch(() => {});
  }, [isAdmin]);

  const updateStatus = async status => {
    if (status === 'CANCELLED' && !window.confirm(`Cancel order ${order.orderNumber}?`)) return;
    setUpdating(true);
    setError('');
    try { await ordersApi.updateVendorOrderStatus({ orderId: order._id, status }); await load(); }
    catch (err) { setError(extractErrorMessage(err)); }
    finally { setUpdating(false); }
  };

  if (loading) {
    return <DashboardLayout admin={isAdmin}><div className="empty-state"><h3>Loading order…</h3></div></DashboardLayout>;
  }
  if (!order) {
    return <DashboardLayout admin={isAdmin}><div className="form-error">{error || 'Order not found.'}</div></DashboardLayout>;
  }

  // Sellers only see, and are paid for, their own items in a multi-vendor order.
  const items = isAdmin ? order.items || [] : (order.items || []).filter(it => idOf(it.vendor) === idOf(user));
  const subtotal = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
  const fee = (subtotal * commission) / 100;
  // Delivery fees for this seller's parcels are paid in full, with no commission.
  const parcels = isAdmin ? order.shippingBreakdown || [] : (order.shippingBreakdown || []).filter(p => idOf(p.vendor) === idOf(user));
  const delivery = parcels.reduce((s, p) => s + Number(p.fee || 0), 0);
  const address = order.shippingAddress || {};
  const flowIndex = ORDER_FLOW.indexOf(order.orderStatus);
  const offFlow = flowIndex === -1;
  const next = isAdmin ? [] : sellerNextStatuses(order.orderStatus);

  return (
    <DashboardLayout admin={isAdmin}>
      <div className="dash-page-head">
        <div><span className="eyebrow">{order.source === 'MANUAL' ? 'MANUAL ORDER' : 'ORDER'}</span><h1>{order.orderNumber}</h1><p>{order.source === 'MANUAL' ? 'Recorded' : 'Placed'} {dateDMY(order.createdAt)} · {order.paidOffline ? `Paid offline (${titleCase(order.offlinePaymentMethod || '')})` : titleCase(order.paymentMethod || '')}</p></div>
        <Link className="outline-btn" to={isAdmin ? '/admin/orders' : '/vendor/orders'}>← Orders</Link>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="detail-grid">
        <section className="data-card">
          <div className="data-card-head"><div><h3>{isAdmin ? 'Order items' : 'Your items'}</h3><span>{items.length} item{items.length === 1 ? '' : 's'}</span></div><StatusPill value={order.orderStatus} /></div>
          {items.map(it => (
            <div className="order-product" key={it._id || it.id || it.name}>
              {it.image && <img src={it.image} alt="" />}
              <div><b>{it.name}</b><small>{it.quantity} × {money(it.price)}</small><strong>{money(it.price * it.quantity)}</strong></div>
            </div>
          ))}
          <div className="order-summary-lines">
            <span>Subtotal <b>{money(subtotal)}</b></span>
            <span>MVEC platform fee ({commission}%) <b>-{money(fee)}</b></span>
            <span>Delivery{parcels[0]?.method ? ` · ${titleCase(parcels[0].method)}` : ''}{parcels[0]?.zoneName ? ` · ${parcels[0].zoneName}` : ''} <b>{delivery ? `+${money(delivery)}` : 'Free'}</b></span>
            <span className="grand">{isAdmin ? 'Vendor settlement' : 'You receive'} <b>{money(Math.max(0, subtotal - fee) + delivery)}</b></span>
          </div>
          {!isAdmin && order.items?.length > items.length && <p className="tiny">This order also contains items from other sellers, which are not shown.</p>}
        </section>
        <section className="data-card">
          <h3>Customer</h3>
          <div className="profile-detail">
            <b>{order.customer?.name || personName(order.user)}</b>
            {order.customer?.phone && <span>{order.customer.phone}</span>}
            {(order.customer?.email || order.user?.email) && <span>{order.customer?.email || order.user.email}</span>}
            {order.source === 'MANUAL' && <span className="tiny">{order.user ? 'Linked to the customer\u2019s MVEC account' : 'Guest customer (no MVEC account)'}</span>}
            <span>{[address.street, address.sector, address.district || address.city, address.province || address.state, address.country].filter(Boolean).join(', ') || 'No address provided'}</span>
            {parcels[0]?.eta && <span>Delivery promised: {parcels[0].eta}</span>}
          </div>
          <h3 className="subhead">Payment</h3>
          <StatusPill value={order.paymentStatus} />
          {order.source === 'MANUAL' && order.paymentStatus !== 'PAID' && order.paymentMethod !== 'CASH_ON_DELIVERY' && order.user && <div className="seller-link-box">
            <code>{`${window.location.origin}/payment/${order._id}`}</code>
            <button type="button" className="outline-btn" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/payment/${order._id}`)}>Copy link</button>
          </div>}
          {order.sellerNote && <><h3 className="subhead">Note</h3><p className="tiny">{order.sellerNote}</p></>}
          {!isAdmin && <>
            <h3 className="subhead">Next step</h3>
            {next.length
              ? <div className="seller-next-actions">{next.map(s => s === 'CANCELLED'
                  ? <button type="button" key={s} className="seller-next-cancel" disabled={updating} onClick={() => updateStatus(s)}>Cancel order</button>
                  : <button type="button" key={s} className="gradient-btn seller-next-primary" disabled={updating} onClick={() => updateStatus(s)}>
                      <Icon name={s === 'SHIPPED' || s === 'READY_FOR_SHIPMENT' ? 'box' : 'check'} size={17} />
                      {updating ? 'Updating…' : `Mark as ${titleCase(s).toLowerCase()}`}
                      <Icon name="arrow" size={16} />
                    </button>)}</div>
              : <p className="tiny">{order.orderStatus === 'SHIPPED' ? 'Delivery is confirmed when the courier verifies the buyer’s OTP. Funds are released to you then.' : 'No further action needed.'}</p>}
          </>}
        </section>
      </div>
      <section className="data-card">
        <div className="data-card-head"><div><h3>Order progress</h3><span>From placement to delivery</span></div></div>
        {offFlow && <p className="tiny">This order is <b>{titleCase(order.orderStatus).toLowerCase()}</b>.</p>}
        <div className="timeline">
          {ORDER_FLOW.map((s, i) => (
            <div className={'timeline-item ' + (!offFlow && i <= flowIndex ? 'done' : '')} key={s}>
              <i /><div><b>{titleCase(s)}</b><small>{!offFlow && i === flowIndex ? 'Current status' : !offFlow && i < flowIndex ? 'Completed' : 'Upcoming'}</small></div>
            </div>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}
