import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import SmartTable from '../../components/SmartTable';
import { customersApi } from '../../API/customers';
import { conversationsApi } from '../../API/conversations';
import { extractErrorMessage } from '../../API/client';
import { PageHead, Loading, EmptyState, Metric, StatusPill, money, dateDMY, useLoader } from './shared';

const waLink = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  const intl = digits.startsWith('250') ? digits : digits.startsWith('0') ? `25${digits}` : digits;
  return intl ? `https://wa.me/${intl}` : null;
};

function CustomerDrawer({ customerKey, onClose }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    let alive = true;
    customersApi.getOne(customerKey).then((d) => alive && setData(d)).catch((e) => alive && setError(extractErrorMessage(e)));
    return () => { alive = false; };
  }, [customerKey]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const message = async () => {
    setMessaging(true);
    try {
      await conversationsApi.create({ recipientId: data.customer.id });
      navigate('/vendor/messages');
    } catch (e) { setError(extractErrorMessage(e)); setMessaging(false); }
  };

  const c = data?.customer;
  return createPortal(<div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal seller-modal seller-customer-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Customer details">
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
      {error && <div className="form-error">{error}</div>}
      {!data && !error && <Loading />}
      {c && <>
        <div className="seller-customer-head">
          <span className="seller-customer-avatar">{(c.name || '?').charAt(0).toUpperCase()}</span>
          <div>
            <h2>{c.name}</h2>
            <p>{c.guest ? 'Guest customer (no MVEC account)' : 'MVEC buyer'}{c.city ? ` · ${c.city}` : ''}</p>
          </div>
        </div>
        <div className="seller-customer-contact">
          {c.phone && <a href={`tel:${c.phone}`}><Icon name="bell" size={14} /> {c.phone}</a>}
          {c.email && <a href={`mailto:${c.email}`}><Icon name="user" size={14} /> {c.email}</a>}
          {c.phone && waLink(c.phone) && <a href={waLink(c.phone)} target="_blank" rel="noreferrer"><Icon name="arrow" size={14} /> WhatsApp</a>}
        </div>
        <div className="seller-customer-stats">
          <span><small>Orders</small><b>{c.orders}</b></span>
          <span><small>Total spent</small><b>{money(c.totalSpent)}</b></span>
          <span><small>Average order</small><b>{money(c.averageOrder)}</b></span>
          <span><small>Customer since</small><b>{dateDMY(c.firstPurchase)}</b></span>
        </div>
        <h3 className="subhead">Order history</h3>
        <div className="seller-customer-orders">
          {data.orders.map((o) => <Link key={o._id} to={`/vendor/orders/${o._id}`} onClick={onClose}>
            <span>
              <b>{o.orderNumber}</b>{o.source === 'MANUAL' && <em className="seller-manual-tag">Manual</em>}
              <small>{dateDMY(o.createdAt)} · {o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</small>
            </span>
            <span className="seller-customer-order-right"><b>{money(o.subtotal + o.delivery)}</b><StatusPill value={o.orderStatus} /></span>
          </Link>)}
        </div>
        <div className="modal-actions">
          <button type="button" className="outline-btn" onClick={onClose}>Close</button>
          {!c.guest && <button type="button" className="gradient-btn" disabled={messaging} onClick={message}><Icon name="users" size={15} /> {messaging ? 'Opening chat…' : 'Message customer'}</button>}
        </div>
      </>}
    </div>
  </div>, document.body);
}

export default function CustomersPage() {
  const { data, loading, error } = useLoader(() => customersApi.getAll());
  const [type, setType] = useState('');
  const [open, setOpen] = useState(null);

  const all = data?.data || [];
  const rows = useMemo(() => all.filter((c) => !type || (type === 'guest' ? c.guest : !c.guest)).map((c) => ({ ...c, kind: c.guest ? 'Guest' : 'Buyer' })), [all, type]);
  const stats = useMemo(() => {
    const repeat = all.filter((c) => c.orders > 1).length;
    const orders = all.reduce((s, c) => s + c.orders, 0);
    const spent = all.reduce((s, c) => s + c.totalSpent, 0);
    return { repeat, rate: all.length ? Math.round((repeat / all.length) * 100) : 0, avg: orders ? Math.round(spent / orders) : 0, top: all[0] };
  }, [all]);

  const columns = [
    { key: 'name', label: 'Customer', render: (c) => <button type="button" className="seller-link-btn" onClick={() => setOpen(c.key || c.id)}><b>{c.name}</b><small className="tiny seller-block">{c.phone || c.email || ''}</small></button> },
    { key: 'kind', label: 'Type', render: (c) => <em className={`status ${c.guest ? 'warning' : 'active'}`}>{c.kind}</em> },
    { key: 'city', label: 'City', render: (c) => c.city || '—' },
    { key: 'orders', label: 'Orders', render: (c) => <span>{c.orders}{c.cancelledOrders > 0 && <small className="tiny seller-block">{c.cancelledOrders} cancelled</small>}</span> },
    { key: 'totalSpent', label: 'Total spent', render: (c) => <b>{money(c.totalSpent)}</b> },
    { key: 'lastPurchase', label: 'Last purchase', render: (c) => dateDMY(c.lastPurchase) },
  ];

  return <>
    <PageHead title="Customers" desc="Everyone who bought from you: MVEC buyers and the guest customers from your manual orders." />
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="Customers" value={all.length} icon="users" sub={`${all.filter((c) => c.guest).length} guests`} />
        <Metric label="Repeat customers" value={stats.repeat} icon="heart" sub={all.length ? `${stats.rate}% bought again` : 'No customers yet'} />
        <Metric label="Average order" value={money(stats.avg)} icon="cart" sub="Your items per order" />
        <Metric label="Top customer" value={stats.top ? money(stats.top.totalSpent) : '—'} icon="wallet" sub={stats.top?.name || ''} />
      </div>
      {!all.length
        ? <EmptyState title="No customers yet" text="Customers appear here after their first order with you." />
        : <div className="data-card">
          <div className="dash-toolbar">
            <select className="table-filter-select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Customer type">
              <option value="">All customers</option><option value="buyer">MVEC buyers</option><option value="guest">Guests</option>
            </select>
          </div>
          <SmartTable columns={columns} rows={rows} rowKey={(c) => c.key || c.id} searchPlaceholder="Search name, phone, email or city…" exportName="mvec-customers"
            actions={(c) => <button type="button" className="table-action-btn" onClick={() => setOpen(c.key || c.id)}>View</button>} />
        </div>}
    </>}
    {open && <CustomerDrawer customerKey={open} onClose={() => setOpen(null)} />}
  </>;
}
