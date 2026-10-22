import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { ordersApi } from '../API/orders';
import { payoutsApi } from '../API/payouts';
import { extractErrorMessage } from '../API/client';
import { useAuth } from '../context/AuthContext';
import { money, dateDMY, personName, titleCase, parsePercent, sellerNextStatuses, canRecordCash, stepLabelFor, orderFlowFor, flowIndexOf, flowStepLabel, StatusPill, FormModal } from './seller/shared';
import ProductImage from '../components/ProductImage';

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

  const [cancelling, setCancelling] = useState(false);
  const [done, setDone] = useState('');
  const updateStatus = async (body) => {
    setUpdating(true);
    setError('');
    setDone('');
    try { const res = await ordersApi.updateVendorOrderStatus({ orderId: order._id, ...body }); setDone(res.message || 'Order updated.'); await load(); }
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
  const gross = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
  // Coupon discounts on this seller's lines are paid by the seller.
  const couponDiscount = items.reduce((s, it) => s + Number(it.discount || 0), 0);
  const subtotal = gross - couponDiscount;
  const fee = (subtotal * commission) / 100;
  // Delivery fees for this seller's parcels are paid in full, with no commission.
  const parcels = isAdmin ? order.shippingBreakdown || [] : (order.shippingBreakdown || []).filter(p => idOf(p.vendor) === idOf(user));
  const delivery = parcels.reduce((s, p) => s + Number(p.fee || 0), 0);
  const address = order.shippingAddress || {};
  const flow = orderFlowFor(order);
  const flowIndex = flowIndexOf(order);
  const offFlow = flowIndex === -1;
  const allNext = isAdmin ? [] : sellerNextStatuses(order);
  const next = allNext.filter(s => s !== 'CANCELLED');

  return (
    <DashboardLayout admin={isAdmin}>
      <div className="dash-page-head">
        <div><span className="eyebrow">{order.source === 'MANUAL' ? 'MANUAL ORDER' : 'ORDER'}</span><h1>{order.orderNumber}</h1><p>{order.source === 'MANUAL' ? 'Recorded' : 'Placed'} {dateDMY(order.createdAt)} · {order.paidOffline ? `Paid offline (${titleCase(order.offlinePaymentMethod || '')})` : titleCase(order.paymentMethod || '')}</p></div>
        <Link className="outline-btn" to={isAdmin ? '/admin/orders' : '/vendor/orders'}>← Orders</Link>
      </div>
      {error && <div className="form-error">{error}</div>}
      {done && <div className="form-alert success">{done}</div>}
      <div className="detail-grid">
        <section className="data-card">
          <div className="data-card-head"><div><h3>{isAdmin ? 'Order items' : 'Your items'}</h3><span>{items.length} item{items.length === 1 ? '' : 's'}</span></div><StatusPill value={order.orderStatus} /></div>
          {items.map(it => (
            <div className="order-product" key={it._id || it.id || it.name}>
              {it.image && <ProductImage src={it.image} alt="" />}
              <div><b>{it.name}</b><small>{it.quantity} × {money(it.price)}</small><strong>{money(it.price * it.quantity)}</strong></div>
            </div>
          ))}
          <div className="order-summary-lines">
            <span>Subtotal <b>{money(gross)}</b></span>
            {couponDiscount > 0 && <span>Coupon {order.coupon?.code} <b>-{money(couponDiscount)}</b></span>}
            <span>MVEC platform fee ({commission}%) <b>-{money(fee)}</b></span>
            <span>Delivery{parcels[0]?.method ? ` · ${titleCase(parcels[0].method)}` : ''}{parcels[0]?.zoneName ? ` · ${parcels[0].zoneName}` : ''} <b>{delivery ? `+${money(delivery)}` : parcels.some(p => p.originalFee > 0) ? `Free (coupon, ${money(parcels.reduce((s, p) => s + Number(p.originalFee || 0), 0))} waived)` : 'Free'}</b></span>
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
            <span>{order.shippingMethod === 'PICKUP' ? 'The buyer collects this order from your store. Ask for their delivery code when you hand it over.' : [address.street, address.sector, address.district || address.city, address.province || address.state, address.country].filter(Boolean).join(', ') || 'No address provided'}</span>
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
            {(next.length || canRecordCash(order) || allNext.includes('CANCELLED'))
              ? <div className="seller-next-actions">
                  {next.map(s => <button type="button" key={s} className="gradient-btn seller-next-primary" disabled={updating} onClick={() => updateStatus({ status: s })}>
                    <Icon name={s === 'SHIPPED' || s === 'READY_FOR_SHIPMENT' ? 'box' : 'check'} size={17} />
                    {updating ? 'Updating…' : stepLabelFor(order, s) || titleCase(s)}
                    <Icon name="arrow" size={16} />
                  </button>)}
                  {canRecordCash(order) && <button type="button" className="outline-btn" disabled={updating} onClick={() => updateStatus({ paymentStatus: 'PAID' })}>Cash received</button>}
                  {allNext.includes('CANCELLED') && <button type="button" className="seller-next-cancel" disabled={updating} onClick={() => setCancelling(true)}>Cancel order</button>}
                </div>
              : <p className="tiny">{['SHIPPED', 'OUT_FOR_DELIVERY'].includes(order.orderStatus) ? 'Delivery is confirmed when the courier verifies the buyer’s delivery code. Your funds are released then.' : 'No further action needed.'}</p>}
            {order.cancellationReason && order.orderStatus === 'CANCELLED' && <p className="tiny">Cancelled: {order.cancellationReason}</p>}
          </>}
        </section>
      </div>
      <section className="data-card">
        <div className="data-card-head"><div><h3>Order progress</h3><span>From placement to delivery</span></div></div>
        {offFlow && <p className="tiny">This order is <b>{titleCase(order.orderStatus).toLowerCase()}</b>.</p>}
        <div className="timeline">
          {flow.map((s, i) => (
            <div className={'timeline-item ' + (!offFlow && i <= flowIndex ? 'done' : '')} key={s}>
              <i /><div><b>{flowStepLabel(order, s)}</b><small>{!offFlow && i === flowIndex ? 'Current status' : !offFlow && i < flowIndex ? 'Completed' : 'Upcoming'}</small></div>
            </div>
          ))}
        </div>
      </section>
      {cancelling && <FormModal title={`Cancel ${order.orderNumber}?`}
        subtitle={order.paymentStatus === 'PAID' && !order.paidOffline ? 'The buyer paid through MVEC: they get a full refund, and your items go back into stock.' : 'Your items go back into stock.'}
        fields={[
          { name: 'reason', label: 'Reason', type: 'select', required: true, options: ['Out of stock', 'Customer asked to cancel', 'Cannot deliver to this address', 'Pricing error', 'Other'].map(r => [r, r]) },
          { name: 'note', label: 'Note for the customer', placeholder: 'Optional' },
        ]}
        initial={{ reason: 'Out of stock', note: '' }} submitLabel="Cancel order" onClose={() => setCancelling(false)}
        onSubmit={async (form) => { setCancelling(false); await updateStatus({ status: 'CANCELLED', reason: form.note ? `${form.reason}: ${form.note}` : form.reason }); }} />}
    </DashboardLayout>
  );
}
