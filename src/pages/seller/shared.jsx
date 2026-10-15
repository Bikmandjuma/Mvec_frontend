import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../components/Icon';
import { extractErrorMessage } from '../../API/client';

export const money = n => new Intl.NumberFormat('en-RW').format(Math.round(Number(n) || 0)) + ' RWF';
export const dateDMY = d => (d ? new Date(d).toLocaleDateString('en-GB') : '—');
export const toInputDate = d => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const titleCase = s => String(s || '').toLowerCase().replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

// The backend populates users as { Fullname, email }; mapped users use fullName.
export const personName = (u, fallback = 'Buyer') => u?.fullName || u?.Fullname || u?.name || fallback;

// Matches on the given fields only, instead of stringifying whole records.
export const matches = (q, ...fields) => {
  const term = q.trim().toLowerCase();
  return !term || fields.some(f => String(f ?? '').toLowerCase().includes(term));
};

// Platform fee taken from each sale; the backend reports it on /payouts/balance.
export const DEFAULT_COMMISSION_PERCENT = 5;
export const parsePercent = value => {
  const n = parseFloat(String(value ?? '').replace('%', ''));
  return Number.isFinite(n) ? n : DEFAULT_COMMISSION_PERCENT;
};

// Seller order flow — mirrors updateVendorOrderStatus in the backend.
// DELIVERED on MVEC-paid orders is confirmed with the buyer's delivery OTP
// (that releases the held funds); sellers close only orders whose payment
// they collect themselves (manual cash-on-delivery / paid-offline orders).
export const ORDER_FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY_FOR_SHIPMENT', 'SHIPPED', 'DELIVERED'];
const SELLER_NEXT = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY_FOR_SHIPMENT', 'CANCELLED'],
  READY_FOR_SHIPMENT: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: [],
};
export const sellerCollectsPayment = (o) => o?.source === 'MANUAL' && (o.paidOffline || o.paymentMethod === 'CASH_ON_DELIVERY');
// Accepts an order (preferred) or a bare status string.
export const sellerNextStatuses = (orderOrStatus) => {
  const order = typeof orderOrStatus === 'string' ? { orderStatus: orderOrStatus } : orderOrStatus || {};
  const next = [...(SELLER_NEXT[order.orderStatus] || [])];
  if (sellerCollectsPayment(order)) {
    const from = order.shippingMethod === 'PICKUP' ? ['CONFIRMED', 'PROCESSING', 'READY_FOR_SHIPMENT'] : ['READY_FOR_SHIPMENT', 'SHIPPED', 'OUT_FOR_DELIVERY'];
    if (from.includes(order.orderStatus)) next.push('DELIVERED');
  }
  return [...new Set(next)];
};
// Cash-on-delivery manual orders: the seller records the cash they received.
export const canRecordCash = (o) => o?.source === 'MANUAL' && o.paymentMethod === 'CASH_ON_DELIVERY' && o.paymentStatus !== 'PAID' && !['CANCELLED', 'REFUNDED'].includes(o.orderStatus);
export const STEP_LABEL = {
  CONFIRMED: 'Accept order', PROCESSING: 'Start preparing', READY_FOR_SHIPMENT: 'Ready to ship', SHIPPED: 'Mark shipped',
  OUT_FOR_DELIVERY: 'Out for delivery', DELIVERED: 'Mark delivered', CANCELLED: 'Cancel order',
};
export const ORDER_TABS = [
  ['all', 'All', null],
  ['new', 'New', ['PENDING', 'CONFIRMED']],
  ['preparing', 'Preparing', ['PROCESSING', 'READY_FOR_SHIPMENT']],
  ['shipping', 'On the way', ['SHIPPED', 'OUT_FOR_DELIVERY']],
  ['done', 'Completed', ['DELIVERED', 'COMPLETED']],
  ['closed', 'Cancelled', ['CANCELLED', 'REFUNDED', 'RETURNED', 'FAILED']],
];

const COUNTED_OUT = ['CANCELLED', 'REFUNDED', 'FAILED', 'RETURNED'];
export const isRevenueOrder = o => !COUNTED_OUT.includes(o.orderStatus);

const GOOD = ['ACTIVE', 'PAID', 'DELIVERED', 'COMPLETED', 'PUBLISHED', 'VERIFIED', 'RELEASED', 'OWNER'];
const BAD = ['CANCELLED', 'FAILED', 'REJECTED', 'SUSPENDED', 'EXPIRED', 'REFUNDED'];
export function StatusPill({ value }) {
  const key = String(value || '').toUpperCase().replace(/\s+/g, '_');
  const tone = GOOD.includes(key) ? 'active' : BAD.includes(key) ? 'danger' : 'warning';
  return <em className={`status ${tone}`}>{titleCase(value)}</em>;
}

export function PageHead({ title, desc, action, eyebrow = 'SELLER PLATFORM' }) {
  return <div className="dash-page-head">
    <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{desc && <p>{desc}</p>}</div>
    {action}
  </div>;
}

export function Metric({ label, value, icon, sub }) {
  return <div className="metric">
    <div className="metric-icon"><Icon name={icon} /></div>
    <div><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div>
  </div>;
}

export function Loading({ label = 'Loading…' }) {
  return <div className="empty-state"><h3>{label}</h3></div>;
}

export function EmptyState({ title, text, action }) {
  return <div className="empty-state"><h3>{title}</h3>{text && <p>{text}</p>}{action}</div>;
}

// Runs an async loader and exposes { data, loading, error, reload, setData }.
// A 404 is reported through `notFound` so pages can offer a "create" state.
export function useLoader(load, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '', notFound: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  const reload = useCallback(() => {
    setState(s => ({ ...s, loading: true, error: '' }));
    return run()
      .then(data => setState({ data, loading: false, error: '', notFound: false }))
      .catch(err => setState({ data: null, loading: false, error: extractErrorMessage(err), notFound: err?.response?.status === 404 }));
  }, [run]);
  useEffect(() => { reload(); }, [reload]);
  const setData = updater => setState(s => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  return { ...state, reload, setData };
}

// Brief success / error banner shared by the seller modules.
export function useNotice() {
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!notice || notice.type === 'error') return undefined;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);
  const banner = notice && <div className={notice.type === 'error' ? 'form-error' : 'form-alert success'}>{notice.text}</div>;
  return {
    banner,
    success: text => setNotice({ type: 'success', text }),
    fail: err => setNotice({ type: 'error', text: typeof err === 'string' ? err : extractErrorMessage(err) }),
    clear: () => setNotice(null),
  };
}

/**
 * Generic modal form.
 * fields: [{ name, label, type?: 'text'|'number'|'email'|'date'|'select'|'textarea'|'password'|'checkboxes',
 *            options?: [[value,label]], required?, placeholder?, half? }]
 * stacked: render above another open modal (e.g. the product editor) without
 * closing or submitting it.
 * onFieldChange(name, value): may return extra field values to merge in.
 */
export function FormModal({ title, subtitle, fields, initial, submitLabel = 'Save', onSubmit, onClose, onFieldChange, stacked = false }) {
  const [form, setForm] = useState(() => ({ ...initial }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Capture phase + stopImmediatePropagation so Esc only closes this modal,
    // not one underneath that also listens on document.
    const onKey = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const set = (name, value) => {
    const patch = onFieldChange?.(name, value) || {};
    setForm(f => ({ ...f, [name]: value, ...patch }));
  };
  const submit = async e => {
    e.preventDefault();
    e.stopPropagation(); // portal events still bubble to parent forms in React
    setBusy(true);
    setError('');
    try { await onSubmit(form); }
    catch (err) { setError(extractErrorMessage(err)); setBusy(false); }
  };

  const renderField = f => {
    const value = form[f.name] ?? '';
    if (f.type === 'select') {
      return <select value={value} onChange={e => set(f.name, e.target.value)} required={f.required}>
        {f.placeholder && <option value="">{f.placeholder}</option>}
        {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>;
    }
    if (f.type === 'textarea') {
      return <textarea rows={f.rows || 3} value={value} onChange={e => set(f.name, e.target.value)} required={f.required} placeholder={f.placeholder} />;
    }
    if (f.type === 'checkboxes') {
      const list = Array.isArray(value) ? value : [];
      return <div className="seller-checks">{f.options.map(([v, l]) =>
        <label key={v}><input type="checkbox" checked={list.includes(v)} onChange={e => set(f.name, e.target.checked ? [...list, v] : list.filter(x => x !== v))} />{l}</label>
      )}</div>;
    }
    return <input type={f.type || 'text'} min={f.type === 'number' ? 0 : undefined} value={value} onChange={e => set(f.name, e.target.value)} required={f.required} placeholder={f.placeholder} minLength={f.minLength} />;
  };

  const modal = <div className={'modal-backdrop' + (stacked ? ' modal-stacked' : '')} onMouseDown={e => { e.stopPropagation(); onClose(); }}>
    <form className="modal seller-modal" onMouseDown={e => e.stopPropagation()} onSubmit={submit}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
      {error && <div className="form-error">{error}</div>}
      <div className="seller-form-grid">
        {fields.map(f => <label className={'field' + (f.half ? ' half' : '')} key={f.name}>
          <span>{f.label}{f.required ? ' *' : ''}</span>
          {renderField(f)}
          {f.help && <small className="tiny">{f.help}</small>}
        </label>)}
      </div>
      <div className="modal-actions">
        <button type="button" className="outline-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="gradient-btn" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  </div>;
  return stacked ? createPortal(modal, document.body) : modal;
}

// Aggregates vendor orders into the figures used by Analytics and Reports.
export function summarizeOrders(orders, commissionPercent = DEFAULT_COMMISSION_PERCENT) {
  const counted = orders.filter(isRevenueOrder);
  const gross = counted.reduce((s, o) => s + Number(o.vendorSubtotal || 0), 0);
  const paid = counted.filter(o => o.paymentStatus === 'PAID');
  const paidGross = paid.reduce((s, o) => s + Number(o.vendorSubtotal || 0), 0);
  const byStatus = {};
  orders.forEach(o => { byStatus[o.orderStatus] = (byStatus[o.orderStatus] || 0) + 1; });
  const products = {};
  counted.forEach(o => (o.items || []).forEach(it => {
    const key = String(it.product || it.name);
    const row = products[key] || (products[key] = { name: it.name, units: 0, revenue: 0 });
    row.units += Number(it.quantity || 0);
    row.revenue += Number(it.price || 0) * Number(it.quantity || 0);
  }));
  const customers = new Set(counted.map(o => o.user?._id || o.user?.id || o.user).filter(Boolean));
  return {
    orders: orders.length,
    countedOrders: counted.length,
    gross,
    paidGross,
    paidOrders: paid.length,
    commission: (paidGross * commissionPercent) / 100,
    net: paidGross - (paidGross * commissionPercent) / 100,
    averageOrder: counted.length ? gross / counted.length : 0,
    customers: customers.size,
    byStatus,
    topProducts: Object.values(products).sort((a, b) => b.revenue - a.revenue),
  };
}

// Revenue per calendar month for the last `months` months (oldest first).
export function monthlyRevenue(orders, months = 6) {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-GB', { month: 'short' }), value: 0 };
  });
  const index = Object.fromEntries(buckets.map((b, i) => [b.key, i]));
  orders.filter(isRevenueOrder).forEach(o => {
    const d = new Date(o.createdAt);
    const i = index[`${d.getFullYear()}-${d.getMonth()}`];
    if (i !== undefined) buckets[i].value += Number(o.vendorSubtotal || 0);
  });
  return buckets;
}

export function BarChart({ data, format = money }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return <div className="seller-bars" role="img" aria-label="Revenue by month">
    {data.map(d => <div className="seller-bar" key={d.key}>
      <span className="seller-bar-value">{d.value ? format(d.value) : ''}</span>
      <div className="seller-bar-track"><i style={{ height: `${(d.value / max) * 100}%` }} /></div>
      <small>{d.label}</small>
    </div>)}
  </div>;
}
