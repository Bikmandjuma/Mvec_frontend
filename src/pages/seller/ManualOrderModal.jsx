import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../components/Icon';
import { productsApi } from '../../API/products';
import { ordersApi } from '../../API/orders';
import { shippingApi } from '../../API/shipping';
import { extractErrorMessage } from '../../API/client';
import { RWANDA_LOCATIONS, PROVINCES } from '../../data/rwandaLocations';
import { money, matches } from './shared';

const PAYMENTS = [
  ['COD', 'Cash on delivery', 'Customer pays when the order arrives.'],
  ['PAID_OFFLINE', 'Already paid', 'You received cash, MoMo or a bank transfer.'],
  ['LINK', 'MVEC payment link', 'Customer pays online; needs an MVEC account with this phone or email.'],
];

export default function ManualOrderModal({ onClose, onCreated }) {
  const [products, setProducts] = useState([]);
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [lines, setLines] = useState([]); // { product, qty, price }
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('STANDARD');
  const [address, setAddress] = useState({ province: 'Kigali City', district: 'Gasabo', sector: '', street: '' });
  const [manualFee, setManualFee] = useState(false);
  const [fee, setFee] = useState('');
  const [quote, setQuote] = useState(null);
  const [payment, setPayment] = useState('COD');
  const [offlineMethod, setOfflineMethod] = useState('CASH');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  useEffect(() => {
    productsApi.getVendorProducts().then(r => setProducts((r.products || []).filter(p => p.status !== 'INACTIVE'))).catch(() => {});
  }, []);
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const results = useMemo(() => (search.trim()
    ? products.filter(p => matches(search, p.name, p.sku, p.brand)).slice(0, 6)
    : []), [products, search]);

  const addLine = p => {
    setLines(ls => ls.some(l => l.product.id === p.id)
      ? ls.map(l => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l))
      : [...ls, { product: p, qty: 1, price: p.discountPrice || p.price }]);
    setSearch('');
  };
  const updateLine = (id, patch) => setLines(ls => ls.map(l => (l.product.id === id ? { ...l, ...patch } : l)));
  const removeLine = id => setLines(ls => ls.filter(l => l.product.id !== id));

  const subtotal = lines.reduce((s, l) => s + Number(l.price || 0) * Number(l.qty || 0), 0);
  const isPickup = method === 'PICKUP';
  const autoFee = quote?.deliverable ? quote.shippingFee : null;
  const deliveryFee = isPickup ? Number(fee || 0) : manualFee ? Number(fee || 0) : autoFee ?? 0;
  const total = subtotal + deliveryFee;

  // Live delivery quote from the seller's own zones.
  const quoteKey = JSON.stringify([address.province, address.district, method, lines.map(l => [l.product.id, l.qty])]);
  useEffect(() => {
    if (isPickup || !lines.length) { setQuote(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      shippingApi.quote({ address: { province: address.province, district: address.district }, method, items: lines.map(l => ({ productId: l.product.id, qty: l.qty })) })
        .then(q => alive && setQuote(q)).catch(() => alive && setQuote(null));
    }, 300);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const stockProblem = lines.find(l => Number(l.qty) > Number(l.product.stockQuantity));

  const submit = async e => {
    e.preventDefault();
    setError('');
    if (!lines.length) return setError('Add at least one product.');
    if (stockProblem) return setError(`Only ${stockProblem.product.stockQuantity} units of ${stockProblem.product.name} are in stock.`);
    if (!isPickup && !manualFee && quote && !quote.deliverable) return setError('Your shipping zones don’t cover this district. Set the delivery fee manually or choose pickup.');
    setBusy(true);
    try {
      const res = await ordersApi.createManual({
        customer,
        items: lines.map(l => ({ productId: l.product.id, qty: Number(l.qty), price: Number(l.price) })),
        shippingAddress: address,
        shippingMethod: method,
        deliveryFee: isPickup || manualFee ? Number(fee || 0) : undefined,
        payment,
        offlineMethod: payment === 'PAID_OFFLINE' ? offlineMethod : undefined,
        note,
      });
      if (res.paymentLink) setCreated(res);
      else onCreated(res);
    } catch (err) { setError(extractErrorMessage(err)); setBusy(false); }
  };

  const setAddr = (k, v) => setAddress(a => (k === 'province' ? { ...a, province: v, district: RWANDA_LOCATIONS[v][0] } : { ...a, [k]: v }));

  if (created) {
    const link = `${window.location.origin}${created.paymentLink}`;
    return createPortal(<div className="modal-backdrop" onMouseDown={() => onCreated(created)}>
      <div className="modal seller-modal" onMouseDown={e => e.stopPropagation()}>
        <h2>Order created</h2>
        <p>{created.message} Send this link to the customer; they pay after signing in to MVEC.</p>
        <div className="seller-link-box"><code>{link}</code>
          <button type="button" className="outline-btn" onClick={() => navigator.clipboard?.writeText(link)}><Icon name="copy" size={15} /> Copy</button>
        </div>
        <div className="modal-actions"><button type="button" className="gradient-btn" onClick={() => onCreated(created)}>View order</button></div>
      </div>
    </div>, document.body);
  }

  return createPortal(<div className="modal-backdrop" onMouseDown={onClose}>
    <form className="modal seller-modal seller-manual-order" onMouseDown={e => e.stopPropagation()} onSubmit={submit}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
      <h2>New manual order</h2>
      <p>Record a sale made in person, by phone or on WhatsApp. Stock is reserved straight away.</p>
      {error && <div className="form-error">{error}</div>}

      <section className="seller-zone-section">
        <h4>Customer</h4>
        <div className="seller-form-grid">
          <label className="field half"><span>Name *</span><input value={customer.name} onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))} required /></label>
          <label className="field half"><span>Phone *</span><input value={customer.phone} onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))} required placeholder="07xx xxx xxx" /></label>
          <label className="field"><span>Email</span><input type="email" value={customer.email} onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))} placeholder="Optional" /><small className="tiny">If the phone or email matches an MVEC buyer, the order appears in their account.</small></label>
        </div>
      </section>

      <section className="seller-zone-section">
        <h4>Products</h4>
        <div className="seller-product-search">
          <div className="dash-filter"><Icon name="search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your products by name or SKU" /></div>
          {results.length > 0 && <div className="seller-product-results">{results.map(p => <button type="button" key={p.id} onClick={() => addLine(p)} disabled={p.stockQuantity <= 0}>
            <span><b>{p.name}</b><small>{p.sku} · {p.stockQuantity} in stock</small></span><strong>{money(p.discountPrice || p.price)}</strong>
          </button>)}</div>}
          {search.trim() && !results.length && <p className="tiny">No products match.</p>}
        </div>
        {lines.length === 0 && <p className="tiny">Search above to add products.</p>}
        {lines.length > 0 && <div className="seller-order-lines">
          {lines.map(l => <div className="seller-order-line" key={l.product.id}>
            <span><b>{l.product.name}</b><small className={Number(l.qty) > l.product.stockQuantity ? 'seller-negative' : ''}>{l.product.stockQuantity} in stock</small></span>
            <label><small>Qty</small><input type="number" min="1" max={l.product.stockQuantity} value={l.qty} onChange={e => updateLine(l.product.id, { qty: Math.max(1, Number(e.target.value) || 1) })} /></label>
            <label><small>Unit price</small><input type="number" min="0" value={l.price} onChange={e => updateLine(l.product.id, { price: e.target.value })} /></label>
            <strong>{money(Number(l.price || 0) * Number(l.qty || 0))}</strong>
            <button type="button" className="seller-line-remove" onClick={() => removeLine(l.product.id)} aria-label={`Remove ${l.product.name}`}><Icon name="trash" size={15} /></button>
          </div>)}
        </div>}
      </section>

      <section className="seller-zone-section">
        <h4>Delivery</h4>
        <div className="seller-segment" role="radiogroup" aria-label="Delivery method">
          {[['STANDARD', 'Standard'], ['EXPRESS', 'Express'], ['PICKUP', 'Pickup']].map(([v, l]) =>
            <button type="button" role="radio" aria-checked={method === v} key={v} className={method === v ? 'active' : ''} onClick={() => setMethod(v)}>{l}</button>)}
        </div>
        {!isPickup && <div className="seller-form-grid">
          <label className="field half"><span>Province</span><select value={address.province} onChange={e => setAddr('province', e.target.value)}>{PROVINCES.map(p => <option key={p}>{p}</option>)}</select></label>
          <label className="field half"><span>District</span><select value={address.district} onChange={e => setAddr('district', e.target.value)}>{RWANDA_LOCATIONS[address.province].map(d => <option key={d}>{d}</option>)}</select></label>
          <label className="field half"><span>Sector</span><input value={address.sector} onChange={e => setAddr('sector', e.target.value)} placeholder="Optional" /></label>
          <label className="field half"><span>Street / landmark *</span><input value={address.street} onChange={e => setAddr('street', e.target.value)} required={!isPickup} /></label>
        </div>}
        {!isPickup && <div className="seller-fee-row">
          {!manualFee && <span className={quote && !quote.deliverable ? 'seller-negative' : ''}>
            {!lines.length ? 'Add products to calculate delivery.' : !quote ? 'Calculating…' : quote.deliverable
              ? <>From your zones: <b>{autoFee === 0 ? 'Free' : money(autoFee)}</b>{quote.groups?.[0]?.eta ? ` · ${quote.groups[0].eta}` : ''}</>
              : 'Your zones don’t cover this district.'}
          </span>}
          <label className="seller-switch"><input type="checkbox" checked={manualFee} onChange={e => { setManualFee(e.target.checked); if (e.target.checked && autoFee !== null) setFee(autoFee); }} /><span>Set fee manually</span></label>
          {manualFee && <label className="field"><span>Delivery fee (RWF)</span><input type="number" min="0" value={fee} onChange={e => setFee(e.target.value)} /></label>}
        </div>}
        {isPickup && <div className="seller-fee-row"><span>The customer collects the order from your store.</span>
          <label className="field"><span>Pickup fee (RWF)</span><input type="number" min="0" value={fee} onChange={e => setFee(e.target.value)} placeholder="0" /></label></div>}
      </section>

      <section className="seller-zone-section">
        <h4>Payment</h4>
        <div className="seller-pay-options">{PAYMENTS.map(([v, l, d]) => <label key={v} className={payment === v ? 'active' : ''}>
          <input type="radio" name="payment" checked={payment === v} onChange={() => setPayment(v)} />
          <span><b>{l}</b><small>{d}</small></span>
        </label>)}</div>
        {payment === 'PAID_OFFLINE' && <div className="seller-segment" role="radiogroup" aria-label="Paid with">
          {[['CASH', 'Cash'], ['MOMO', 'Mobile Money'], ['BANK', 'Bank transfer']].map(([v, l]) =>
            <button type="button" role="radio" aria-checked={offlineMethod === v} key={v} className={offlineMethod === v ? 'active' : ''} onClick={() => setOfflineMethod(v)}>{l}</button>)}
        </div>}
        {payment !== 'LINK' && <p className="tiny">You collect this payment yourself, so it isn't added to your MVEC balance.</p>}
        <label className="field"><span>Note</span><textarea rows="2" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional, e.g. gift wrap, call before delivery" maxLength={500} /></label>
      </section>

      <div className="seller-order-summary">
        <span>Products <b>{money(subtotal)}</b></span>
        <span>Delivery <b>{deliveryFee === 0 ? 'Free' : money(deliveryFee)}</b></span>
        <span className="grand">Total <b>{money(total)}</b></span>
      </div>
      <div className="modal-actions">
        <button type="button" className="outline-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="gradient-btn" disabled={busy || !lines.length}>{busy ? 'Creating…' : `Create order · ${money(total)}`}</button>
      </div>
    </form>
  </div>, document.body);
}
