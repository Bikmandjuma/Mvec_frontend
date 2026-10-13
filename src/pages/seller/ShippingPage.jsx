import { useEffect, useMemo, useState } from 'react';
import Icon from '../../components/Icon';
import { shippingApi } from '../../API/shipping';
import { storesApi } from '../../API/stores';
import { extractErrorMessage } from '../../API/client';
import { RWANDA_LOCATIONS, PROVINCES } from '../../data/rwandaLocations';
import { PageHead, Loading, EmptyState, StatusPill, money, useLoader, useNotice } from './shared';

const idOf = v => String(v?._id || v?.id || v || '');
const lc = v => String(v || '').toLowerCase();

// Mirrors services/shipping.service.js: district match > province match > nationwide.
const coverageScore = (zone, province, district) => {
  if (zone.districts?.length) return zone.districts.map(lc).includes(lc(district)) ? 3 : 0;
  if (zone.provinces?.length) return zone.provinces.map(lc).includes(lc(province)) ? 2 : 0;
  return 1;
};
const zoneFor = (zones, province, district) => {
  let best = null; let score = 0;
  zones.forEach(z => {
    const s = coverageScore(z, province, district);
    if (s > score || (s === score && s > 0 && Number(z.fee) < Number(best.fee))) { best = z; score = s; }
  });
  return best;
};

const EMPTY_ZONE = { name: '', scope: 'PROVINCES', provinces: [], districts: [], fee: '', express: false, expressFee: '', pickup: false, pickupFee: 0, freeOverAmount: '', eta: '1–3 days', status: 'ACTIVE' };

const fromZone = z => ({
  name: z.name,
  scope: z.districts?.length ? 'DISTRICTS' : z.provinces?.length ? 'PROVINCES' : 'ALL',
  provinces: z.provinces || [],
  districts: z.districts || [],
  fee: z.fee ?? '',
  express: (z.methods || []).includes('EXPRESS'),
  expressFee: z.expressFee ?? '',
  pickup: (z.methods || []).includes('PICKUP'),
  pickupFee: z.pickupFee ?? 0,
  freeOverAmount: z.freeOverAmount || '',
  eta: z.eta || '',
  status: z.status || 'ACTIVE',
});

function ZoneModal({ zone, storeId, onClose, onSaved }) {
  const [form, setForm] = useState(() => (zone ? fromZone(zone) : { ...EMPTY_ZONE }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleIn = (k, v) => setForm(f => ({ ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v] }));
  const toggleProvinceDistricts = p => setForm(f => {
    const all = RWANDA_LOCATIONS[p];
    const has = all.every(d => f.districts.includes(d));
    return { ...f, districts: has ? f.districts.filter(d => !all.includes(d)) : [...new Set([...f.districts, ...all])] };
  });

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async e => {
    e.preventDefault();
    setError('');
    if (form.scope === 'PROVINCES' && !form.provinces.length) return setError('Select at least one province.');
    if (form.scope === 'DISTRICTS' && !form.districts.length) return setError('Select at least one district.');
    if (form.express && form.expressFee !== '' && Number(form.expressFee) < Number(form.fee || 0)) return setError('Express delivery should not cost less than standard.');
    const payload = {
      name: form.name,
      provinces: form.scope === 'PROVINCES' ? form.provinces : [],
      districts: form.scope === 'DISTRICTS' ? form.districts : [],
      fee: Number(form.fee || 0),
      expressFee: form.express && form.expressFee !== '' ? Number(form.expressFee) : null,
      pickupFee: form.pickup ? Number(form.pickupFee || 0) : 0,
      methods: ['STANDARD', ...(form.express ? ['EXPRESS'] : []), ...(form.pickup ? ['PICKUP'] : [])],
      freeOverAmount: Number(form.freeOverAmount || 0),
      eta: form.eta || '1–3 days',
      status: form.status,
      ...(zone ? {} : { storeId: storeId || undefined }),
    };
    setBusy(true);
    try {
      if (zone) await shippingApi.updateZone(zone.id, payload);
      else await shippingApi.createZone(payload);
      onSaved(zone ? 'Shipping zone saved.' : 'Shipping zone added.');
    } catch (err) { setError(extractErrorMessage(err)); setBusy(false); }
  };

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <form className="modal seller-modal seller-zone-modal" onMouseDown={e => e.stopPropagation()} onSubmit={submit}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
      <h2>{zone ? 'Edit shipping zone' : 'Add shipping zone'}</h2>
      <p>Buyers in these areas pay these fees for items from this store.</p>
      {error && <div className="form-error">{error}</div>}
      <div className="seller-form-grid">
        <label className="field"><span>Zone name *</span><input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Kigali City" /></label>
      </div>

      <div className="seller-zone-section">
        <h4>Where you deliver</h4>
        <div className="seller-segment" role="radiogroup" aria-label="Coverage">
          {[['ALL', 'All of Rwanda'], ['PROVINCES', 'Provinces'], ['DISTRICTS', 'Districts']].map(([v, l]) =>
            <button type="button" role="radio" aria-checked={form.scope === v} key={v} className={form.scope === v ? 'active' : ''} onClick={() => set('scope', v)}>{l}</button>)}
        </div>
        {form.scope === 'ALL' && <p className="tiny">Used for any address not covered by a more specific province or district zone.</p>}
        {form.scope === 'PROVINCES' && <div className="seller-checks">{PROVINCES.map(p =>
          <label key={p}><input type="checkbox" checked={form.provinces.includes(p)} onChange={() => toggleIn('provinces', p)} />{p}</label>)}</div>}
        {form.scope === 'DISTRICTS' && <div className="seller-district-picker">{PROVINCES.map(p => {
          const all = RWANDA_LOCATIONS[p]; const n = all.filter(d => form.districts.includes(d)).length;
          return <div key={p}>
            <button type="button" className="seller-district-province" onClick={() => toggleProvinceDistricts(p)}>
              <input type="checkbox" readOnly tabIndex={-1} checked={n === all.length} ref={el => { if (el) el.indeterminate = n > 0 && n < all.length; }} />{p} <small>{n}/{all.length}</small>
            </button>
            <div className="seller-checks">{all.map(d => <label key={d}><input type="checkbox" checked={form.districts.includes(d)} onChange={() => toggleIn('districts', d)} />{d}</label>)}</div>
          </div>; })}</div>}
      </div>

      <div className="seller-zone-section">
        <h4>Fees</h4>
        <div className="seller-form-grid">
          <label className="field half"><span>Standard fee (RWF) *</span><input type="number" min="0" value={form.fee} onChange={e => set('fee', e.target.value)} required /></label>
          <label className="field half"><span>Delivery time</span><input value={form.eta} onChange={e => set('eta', e.target.value)} placeholder="1–3 days" /></label>
          <label className="field half"><span>Free standard delivery from (RWF)</span><input type="number" min="0" value={form.freeOverAmount} onChange={e => set('freeOverAmount', e.target.value)} placeholder="No free delivery" /><small className="tiny">Order subtotal from this store.</small></label>
          <label className="field half"><span>Status</span><select value={form.status} onChange={e => set('status', e.target.value)}><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option></select></label>
        </div>
        <div className="seller-method-row">
          <label className="seller-switch"><input type="checkbox" checked={form.express} onChange={e => set('express', e.target.checked)} /><span>Offer express delivery</span></label>
          {form.express && <label className="field"><span>Express fee (RWF)</span><input type="number" min="0" value={form.expressFee} onChange={e => set('expressFee', e.target.value)} placeholder="Same as standard" /></label>}
        </div>
        <div className="seller-method-row">
          <label className="seller-switch"><input type="checkbox" checked={form.pickup} onChange={e => set('pickup', e.target.checked)} /><span>Allow pickup</span></label>
          {form.pickup && <label className="field"><span>Pickup fee (RWF)</span><input type="number" min="0" value={form.pickupFee} onChange={e => set('pickupFee', e.target.value)} /></label>}
        </div>
      </div>

      <div className="modal-actions">
        <button type="button" className="outline-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="gradient-btn" disabled={busy}>{busy ? 'Saving…' : zone ? 'Save changes' : 'Add zone'}</button>
      </div>
    </form>
  </div>;
}

function PreviewCard({ storeId }) {
  const [form, setForm] = useState({ province: 'Kigali City', district: 'Gasabo', subtotal: 20000, method: 'STANDARD' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      shippingApi.preview({ ...form, storeId: storeId || undefined })
        .then(r => { if (alive) { setResult(r); setError(''); } })
        .catch(err => alive && setError(extractErrorMessage(err)));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [form, storeId]);
  const set = (k, v) => setForm(f => (k === 'province' ? { ...f, province: v, district: RWANDA_LOCATIONS[v][0] } : { ...f, [k]: v }));
  return <div className="data-card seller-preview">
    <div className="data-card-head"><div><h3>Test an address</h3><span>What a buyer pays for delivery from this store</span></div></div>
    <div className="seller-form-grid">
      <label className="field half"><span>Province</span><select value={form.province} onChange={e => set('province', e.target.value)}>{PROVINCES.map(p => <option key={p}>{p}</option>)}</select></label>
      <label className="field half"><span>District</span><select value={form.district} onChange={e => set('district', e.target.value)}>{RWANDA_LOCATIONS[form.province].map(d => <option key={d}>{d}</option>)}</select></label>
      <label className="field half"><span>Order subtotal (RWF)</span><input type="number" min="0" value={form.subtotal} onChange={e => set('subtotal', e.target.value)} /></label>
      <label className="field half"><span>Method</span><select value={form.method} onChange={e => set('method', e.target.value)}><option value="STANDARD">Standard</option><option value="EXPRESS">Express</option><option value="PICKUP">Pickup</option></select></label>
    </div>
    {error && <div className="form-error">{error}</div>}
    {result && (result.deliverable
      ? <div className="seller-preview-result ok">
          <strong>{result.fee === 0 ? 'Free delivery' : money(result.fee)}</strong>
          <span>{result.method !== form.method ? `${form.method.toLowerCase()} not offered, ${result.method.toLowerCase()} used · ` : ''}{result.zoneName} · {result.eta}</span>
          {result.source !== 'seller' && <small>You have no zones yet, so MVEC standard rates apply.</small>}
        </div>
      : <div className="seller-preview-result no"><strong>Not delivered</strong><span>No active zone covers {result.address?.district}. Buyers there can't order from this store.</span></div>)}
  </div>;
}

export default function ShippingPage() {
  const { data, loading, error, reload } = useLoader(() => Promise.all([
    shippingApi.getMyZones().then(r => r.data || []),
    storesApi.getMyStores().then(r => r.stores || []).catch(() => []),
  ]).then(([zones, stores]) => ({ zones, stores })));
  const [storeTab, setStoreTab] = useState('');
  const [editing, setEditing] = useState(null);
  const notice = useNotice();

  const stores = data?.stores || [];
  const primary = stores.find(s => s.isPrimary) || stores[0];
  const activeStoreId = storeTab || idOf(primary);
  const allZones = data?.zones || [];
  const storeZones = allZones.filter(z => idOf(z.store) === activeStoreId);
  // Same fallback as checkout: a store without zones uses the seller's other zones.
  const effectiveZones = (storeZones.length ? storeZones : allZones).filter(z => z.status === 'ACTIVE');
  const usingOtherStores = !storeZones.length && allZones.length > 0;

  const coverage = useMemo(() => PROVINCES.map(p => ({
    province: p,
    districts: RWANDA_LOCATIONS[p].map(d => ({ district: d, zone: zoneFor(effectiveZones, p, d) })),
  })), [effectiveZones]);
  const uncovered = coverage.flatMap(c => c.districts).filter(d => !d.zone).length;

  const run = async (fn, message) => {
    try { await fn(); notice.success(message); reload(); }
    catch (err) { notice.fail(err); }
  };

  return <>
    <PageHead title="Shipping" desc="Delivery zones and fees per store. Checkout charges buyers these fees for their district, and the fees are paid to you in full."
      action={stores.length > 0 && <button type="button" className="gradient-btn" onClick={() => setEditing('new')}><Icon name="plus" /> Add zone</button>} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && !stores.length && <EmptyState title="Register a store first" text="Shipping zones belong to a store." />}
    {data && stores.length > 0 && <>
      {stores.length > 1 && <div className="seller-store-tabs" role="tablist" aria-label="Stores">
        {stores.map(s => <button type="button" role="tab" key={idOf(s)} aria-selected={activeStoreId === idOf(s)} className={activeStoreId === idOf(s) ? 'active' : ''} onClick={() => setStoreTab(idOf(s))}>
          {s.storeName}{s.isPrimary && <em>Primary</em>} <small>{allZones.filter(z => idOf(z.store) === idOf(s)).length}</small>
        </button>)}
      </div>}

      {!allZones.length && <div className="verified-box"><b>Using MVEC standard rates</b><p>Until you add a zone, buyers pay MVEC standard delivery: free in Kigali City and 5,000 RWF elsewhere (express 10,000 RWF). Add zones to set your own fees and coverage.</p></div>}
      {usingOtherStores && <div className="verified-box"><b>No zones for this store yet</b><p>Checkout uses your other stores' zones for its items until you add zones here.</p></div>}

      <div className="data-card">
        <div className="data-card-head"><div><h3>Zones</h3><span>{storeZones.length} zone{storeZones.length === 1 ? '' : 's'} for this store</span></div></div>
        {storeZones.length === 0 && <p className="tiny">No zones yet. Add one for each area you deliver to, e.g. Kigali City and a nationwide fallback.</p>}
        <div className="seller-zone-list">
          {storeZones.map(z => <div className="seller-zone-item" key={z.id}>
            <div className="seller-zone-main">
              <b>{z.name}</b>
              <small><Icon name="shop" size={12} /> {z.coverage}</small>
            </div>
            <div className="seller-zone-fees">
              <span><small>Standard</small><b>{Number(z.fee) === 0 ? 'Free' : money(z.fee)}</b></span>
              {(z.methods || []).includes('EXPRESS') && <span><small>Express</small><b>{money(z.expressFee ?? z.fee)}</b></span>}
              {(z.methods || []).includes('PICKUP') && <span><small>Pickup</small><b>{Number(z.pickupFee) ? money(z.pickupFee) : 'Free'}</b></span>}
              {z.freeOverAmount > 0 && <span><small>Free from</small><b>{money(z.freeOverAmount)}</b></span>}
              <span><small>Time</small><b>{z.eta}</b></span>
            </div>
            <StatusPill value={z.status} />
            <span className="row-actions">
              <button type="button" title="Edit" onClick={() => setEditing(z)}><Icon name="edit" /></button>
              <button type="button" title={z.status === 'ACTIVE' ? 'Pause zone' : 'Activate zone'} onClick={() => run(() => shippingApi.updateZone(z.id, { status: z.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }), 'Zone updated.')}><Icon name={z.status === 'ACTIVE' ? 'eye' : 'check'} /></button>
              <button type="button" title="Delete" onClick={() => window.confirm(`Delete zone ${z.name}?`) && run(() => shippingApi.removeZone(z.id), 'Zone deleted.')}><Icon name="trash" /></button>
            </span>
          </div>)}
        </div>
      </div>

      <div className="dash-grid">
        <div className="data-card">
          <div className="data-card-head"><div><h3>Coverage</h3><span>{allZones.length ? (uncovered ? `${uncovered} of 30 districts not delivered` : 'All 30 districts delivered') : 'MVEC standard rates apply'}</span></div></div>
          <div className="seller-coverage">
            {coverage.map(c => <div key={c.province}>
              <h5>{c.province}</h5>
              <div>{c.districts.map(d => <span key={d.district} className={!allZones.length ? 'default' : d.zone ? 'yes' : 'no'}
                title={d.zone ? `${d.zone.name}: ${Number(d.zone.fee) === 0 ? 'free' : money(d.zone.fee)}` : allZones.length ? 'Not delivered' : 'MVEC standard rate'}>
                {d.district}{d.zone && <small>{Number(d.zone.fee) === 0 ? 'Free' : `${Math.round(d.zone.fee / 1000 * 10) / 10}k`}</small>}
              </span>)}</div>
            </div>)}
          </div>
        </div>
        <PreviewCard storeId={activeStoreId} />
      </div>
    </>}
    {editing && <ZoneModal zone={editing === 'new' ? null : editing} storeId={activeStoreId} onClose={() => setEditing(null)}
      onSaved={message => { setEditing(null); notice.success(message); reload(); }} />}
  </>;
}
