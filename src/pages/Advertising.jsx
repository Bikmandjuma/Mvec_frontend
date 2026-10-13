import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { client, extractErrorMessage } from '../API/client';
import { productsApi } from '../API/products';
import { money } from '../utils/format';

// Where a campaign can appear on the storefront. The home page hero and the
// scrolling "featured" strip only show campaigns an admin has approved.
const PLACEMENTS = [
  ['HOMEPAGE_HERO', 'Home page hero'],
  ['FEATURED', 'Home page featured strip'],
];

const STATUS_STYLE = { ACTIVE: 'active', PAUSED: 'pending', PENDING: 'pending', REJECTED: 'failed', COMPLETED: 'completed' };
const statusText = { ACTIVE: 'Live', PAUSED: 'Paused', PENDING: 'Waiting for approval', REJECTED: 'Rejected', COMPLETED: 'Completed' };
const today = () => new Date().toISOString().slice(0, 10);

function Notice({ notice }) {
  if (!notice) return null;
  return <div className={`form-alert ${notice.ok ? 'success' : 'error'}`} role={notice.ok ? 'status' : 'alert'}>{notice.text}</div>;
}

function CampaignTable({ ads, actions, showVendor = false }) {
  if (!ads.length) return <div className="empty-state"><h3>No campaigns yet</h3></div>;
  return (
    <div className="orders-list">
      {ads.map((ad) => (
        <div className="order-row" key={ad._id}>
          <div className="order-row-main">
            <b>{ad.product}</b>
            <small>{ad.placement}{showVendor ? ` · ${ad.vendor}` : ''}</small>
            <small>{ad.startDate} → {ad.endDate}</small>
          </div>
          <div className="order-row-meta">
            <strong>{money(ad.budget)}</strong>
            <span className={`status ${STATUS_STYLE[ad.statusKey] || ''}`}>{statusText[ad.statusKey] || ad.status}</span>
            <small>{ad.impressions} views · {ad.clicks} clicks</small>
          </div>
          <div className="order-row-actions">{actions(ad)}</div>
        </div>
      ))}
    </div>
  );
}

export function VendorAdvertising() {
  const [ads, setAds] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState({ productId: '', placement: 'HOMEPAGE_HERO', budget: '', startDate: today(), endDate: '' });

  useEffect(() => {
    Promise.all([
      client.get('/vendor/advertisements').then((r) => r.data.data || []),
      productsApi.getVendorProducts().then((r) => (r.products || []).filter((p) => p.status === 'ACTIVE')),
    ])
      .then(([adRows, own]) => { setAds(adRows); setProducts(own); })
      .catch((err) => setNotice({ ok: false, text: extractErrorMessage(err) }))
      .finally(() => setLoading(false));
  }, []);

  const create = async (e) => {
    e.preventDefault();
    const product = products.find((p) => p.id === form.productId);
    if (!product) { setNotice({ ok: false, text: 'Choose one of your live products.' }); return; }
    if (!(Number(form.budget) > 0)) { setNotice({ ok: false, text: 'Enter a budget greater than zero.' }); return; }
    setBusy('create');
    setNotice(null);
    try {
      const res = await client.post('/vendor/advertisements', {
        product: product.name,
        productId: product.id,
        placement: form.placement,
        budget: Number(form.budget),
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      setAds((prev) => [res.data.advertisement, ...prev]);
      setForm((f) => ({ ...f, productId: '', budget: '', endDate: '' }));
      setNotice({ ok: true, text: 'Campaign submitted. It goes live once MVEC approves it.' });
    } catch (err) {
      setNotice({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setBusy('');
    }
  };

  const setStatus = async (ad, status) => {
    setBusy(ad._id);
    setNotice(null);
    try {
      const res = await client.patch(`/vendor/advertisements/${ad._id}/status`, { status });
      setAds((prev) => prev.map((x) => (x._id === ad._id ? res.data.advertisement : x)));
      setNotice({ ok: true, text: res.data.message });
    } catch (err) {
      setNotice({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setBusy('');
    }
  };

  return <>
    <div className="dash-page-head"><div><span className="eyebrow">VENDOR · ADVERTISING</span><h1>Advertising</h1><p>Promote your products on the MVEC home page. Campaigns go live after MVEC approval.</p></div></div>
    <Notice notice={notice} />
    <div className="data-card">
      <h3>New campaign</h3>
      {!loading && products.length === 0
        ? <p className="tiny">You need at least one live product to advertise. <Link to="/vendor/products">Add a product</Link>.</p>
        : (
          <form onSubmit={create}>
            <div className="two-col">
              <label className="field"><span>Product</span>
                <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                  <option value="">Choose a product</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="field"><span>Placement</span>
                <select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>
                  {PLACEMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>
            <div className="two-col">
              <label className="field"><span>Budget (RWF)</span><input type="number" min="1" step="1" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></label>
              <label className="field"><span>Start date</span><input type="date" min={today()} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            </div>
            <label className="field"><span>End date (optional)</span><input type="date" min={form.startDate || today()} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
            <button type="submit" className="gradient-btn" disabled={busy === 'create'}>{busy === 'create' ? 'Submitting…' : 'Submit for approval'}</button>
          </form>
        )}
    </div>
    <div className="data-card">
      <h3>Your campaigns</h3>
      {loading ? <p className="tiny">Loading…</p> : (
        <CampaignTable ads={ads} actions={(ad) => (
          ad.statusKey === 'ACTIVE'
            ? <button type="button" className="outline-btn" disabled={busy === ad._id} onClick={() => setStatus(ad, 'PAUSED')}>Pause</button>
            : ad.statusKey === 'PAUSED'
              ? <button type="button" className="outline-btn" disabled={busy === ad._id} onClick={() => setStatus(ad, 'ACTIVE')}>Resume</button>
              : null
        )} />
      )}
    </div>
  </>;
}

export function AdminAdvertising() {
  const [ads, setAds] = useState([]);
  const [filter, setFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    setLoading(true);
    client.get('/admin/advertisements', { params: filter ? { status: filter } : {} })
      .then((r) => setAds(r.data.data || []))
      .catch((err) => setNotice({ ok: false, text: extractErrorMessage(err) }))
      .finally(() => setLoading(false));
  }, [filter]);

  const setStatus = async (ad, status) => {
    setBusy(ad._id);
    setNotice(null);
    try {
      const res = await client.patch(`/admin/advertisements/${ad._id}/status`, { status });
      const updated = { ...res.data.advertisement, vendor: ad.vendor };
      setAds((prev) => (filter && filter !== status ? prev.filter((x) => x._id !== ad._id) : prev.map((x) => (x._id === ad._id ? updated : x))));
      setNotice({ ok: true, text: res.data.message });
    } catch (err) {
      setNotice({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setBusy('');
    }
  };

  return <>
    <div className="dash-page-head"><div><span className="eyebrow">ADMIN · ADVERTISING</span><h1>Advertising</h1><p>Approve vendor campaigns before they appear in the home page hero and featured strip.</p></div></div>
    <Notice notice={notice} />
    <div className="data-card">
      <label className="field"><span>Show</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="PENDING">Waiting for approval</option>
          <option value="ACTIVE">Live</option>
          <option value="PAUSED">Paused</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All campaigns</option>
        </select>
      </label>
      {loading ? <p className="tiny">Loading…</p> : (
        <CampaignTable showVendor ads={ads} actions={(ad) => <>
          {ad.productId && <Link className="text-btn" to={`/product/${ad.productId}`} target="_blank" rel="noreferrer">View product</Link>}
          {ad.statusKey !== 'ACTIVE' && ad.statusKey !== 'COMPLETED' && <button type="button" className="gradient-btn" disabled={busy === ad._id} onClick={() => setStatus(ad, 'ACTIVE')}>Approve</button>}
          {ad.statusKey === 'ACTIVE' && <button type="button" className="outline-btn" disabled={busy === ad._id} onClick={() => setStatus(ad, 'PAUSED')}>Pause</button>}
          {ad.statusKey === 'PENDING' && <button type="button" className="outline-btn" disabled={busy === ad._id} onClick={() => setStatus(ad, 'REJECTED')}>Reject</button>}
          {['ACTIVE', 'PAUSED'].includes(ad.statusKey) && <button type="button" className="outline-btn" disabled={busy === ad._id} onClick={() => setStatus(ad, 'COMPLETED')}>End</button>}
        </>} />
      )}
    </div>
  </>;
}
