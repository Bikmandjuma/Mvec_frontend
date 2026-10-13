import { useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import SmartTable from '../../components/SmartTable';
import { storesApi } from '../../API/stores';
import { uploadsApi } from '../../API/uploads';
import { extractErrorMessage } from '../../API/client';
import { PageHead, Loading, EmptyState, StatusPill, dateDMY, useLoader, useNotice } from './shared';

const EMPTY = { storeName: '', businessCategory: '', description: '', contactEmail: '', contactPhone: '', city: '', businessAddress: '', logo: '' };

const fromStore = s => ({
  storeName: s.storeName || '',
  businessCategory: s.businessCategory || '',
  description: s.description || '',
  contactEmail: s.contactEmail || '',
  contactPhone: s.contactPhone || '',
  city: s.address?.city || (typeof s.location === 'string' ? s.location : '') || '',
  businessAddress: s.businessAddress || s.address?.street || '',
  logo: s.logo || '',
});

function StoreFormModal({ store, onClose, onSaved }) {
  const [form, setForm] = useState(() => (store ? fromStore(store) : { ...EMPTY }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const uploadLogo = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const res = await uploadsApi.uploadImages([file]);
      setForm(f => ({ ...f, logo: res.urls?.[0] || f.logo }));
    } catch (err) { setError(extractErrorMessage(err)); }
    finally { setUploading(false); }
  };

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = store ? await storesApi.updateById(store._id, form) : await storesApi.create(form);
      onSaved(res.store, !store);
    } catch (err) { setError(extractErrorMessage(err)); setSaving(false); }
  };

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <form className="modal seller-modal" onMouseDown={e => e.stopPropagation()} onSubmit={submit} aria-label={store ? 'Edit store' : 'Register store'}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
      <h2>{store ? `Edit ${store.storeName}` : 'Register a store'}</h2>
      <p>{store ? 'Update how this storefront appears to buyers.' : 'Each store gets its own name, logo and contact details on MVEC.'}</p>
      {error && <div className="form-error">{error}</div>}
      <div className="seller-store-identity">
        <label className="seller-logo-upload" title="Upload store logo">
          {form.logo ? <img src={form.logo} alt="Store logo" /> : <Icon name="shop" size={24} />}
          <span>{uploading ? 'Uploading…' : form.logo ? 'Change' : 'Add logo'}</span>
          <input type="file" accept="image/*" onChange={uploadLogo} disabled={uploading} />
        </label>
        <div className="seller-store-name seller-form-grid">
          <label className="field"><span>Store name *</span><input name="storeName" value={form.storeName} onChange={update} required placeholder="e.g. Kigali Tech Store" /></label>
          <label className="field half"><span>Business category</span><input name="businessCategory" value={form.businessCategory} onChange={update} placeholder="Electronics" /></label>
          <label className="field half"><span>City</span><input name="city" value={form.city} onChange={update} placeholder="Kigali" /></label>
        </div>
      </div>
      <div className="seller-form-grid">
        <label className="field"><span>Description</span><textarea name="description" rows="3" value={form.description} onChange={update} placeholder="Tell buyers what your store offers" /></label>
        <label className="field half"><span>Contact email *</span><input type="email" name="contactEmail" value={form.contactEmail} onChange={update} required /></label>
        <label className="field half"><span>Contact phone *</span><input name="contactPhone" value={form.contactPhone} onChange={update} required placeholder="07xx xxx xxx" /></label>
        <label className="field"><span>Business address</span><input name="businessAddress" value={form.businessAddress} onChange={update} placeholder="Street, building" /></label>
      </div>
      <div className="modal-actions">
        <button type="button" className="outline-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="gradient-btn" disabled={saving || uploading}>{saving ? 'Saving…' : store ? 'Save changes' : 'Register store'}</button>
      </div>
    </form>
  </div>;
}

export default function StorePage() {
  const { data, loading, error, reload } = useLoader(() => storesApi.getMyStores());
  const [modal, setModal] = useState(null);
  const [busyId, setBusyId] = useState('');
  const notice = useNotice();

  const stores = data?.stores || [];
  const maxStores = data?.maxStores;
  const atLimit = maxStores != null && stores.length >= maxStores;

  const act = async (store, fn) => {
    setBusyId(store._id);
    try { const res = await fn(); notice.success(res.message); await reload(); }
    catch (err) { notice.fail(err); }
    finally { setBusyId(''); }
  };

  const columns = [
    { key: 'storeName', label: 'Store', render: s => <div className="seller-store-cell">
      {s.logo ? <img src={s.logo} alt="" /> : <span><Icon name="shop" size={16} /></span>}
      <div><b>{s.storeName}</b>{s.isPrimary && <em className="seller-primary-tag">Primary</em>}<small className="tiny seller-block">/{s.slug}</small></div>
    </div> },
    { key: 'businessCategory', label: 'Category', render: s => s.businessCategory || '—' },
    { key: 'city', label: 'City', render: s => s.address?.city || s.location || '—' },
    { key: 'contactPhone', label: 'Contact', render: s => <div>{s.contactPhone}<small className="tiny seller-block">{s.contactEmail}</small></div> },
    { key: 'productCount', label: 'Products', render: s => s.productCount ?? 0 },
    { key: 'createdAt', label: 'Since', render: s => dateDMY(s.createdAt) },
    { key: 'status', label: 'Status', render: s => <StatusPill value={s.status} /> },
  ];
  const actions = s => <span className="row-actions">
    <button type="button" title="Edit store" disabled={busyId === s._id} onClick={() => setModal({ store: s })}><Icon name="edit" /></button>
    {!s.isPrimary && <button type="button" title="Make primary store" disabled={busyId === s._id}
      onClick={() => act(s, () => storesApi.setPrimary(s._id))}><Icon name="check" /></button>}
    {!s.isPrimary && <button type="button" title="Delete store" disabled={busyId === s._id}
      onClick={() => window.confirm(`Delete ${s.storeName}? Its products, promotions and shipping zones move to your primary store.`) && act(s, () => storesApi.remove(s._id))}><Icon name="trash" /></button>}
  </span>;

  const registerBtn = <button type="button" className="gradient-btn" disabled={atLimit} title={atLimit ? `You can own up to ${maxStores} stores` : ''} onClick={() => setModal({ store: null })}>
    <Icon name="plus" /> Register store
  </button>;

  return <>
    <PageHead title="My Stores" desc="Run several storefronts from one seller account. Your primary store is shown on your vendor profile."
      action={!loading && !error && registerBtn} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && !stores.length && <EmptyState title="You don't have a store yet" text="Register your first store to start listing products and receiving orders." action={registerBtn} />}
    {stores.length > 0 && <div className="data-card">
      <div className="data-card-head"><div><h3>Your stores</h3><span>{stores.length}{maxStores ? ` of ${maxStores}` : ''} stores</span></div></div>
      <SmartTable columns={columns} rows={stores} rowKey={s => s._id} actions={actions} searchPlaceholder="Search stores…" exportName="mvec-stores" />
      <p className="tiny seller-store-note">Payouts, staff and your seller balance are shared across all your stores. Products without a store are listed under the primary store.</p>
    </div>}
    {modal && <StoreFormModal store={modal.store} onClose={() => setModal(null)}
      onSaved={(saved, created) => { setModal(null); notice.success(created ? `${saved.storeName} has been registered.` : 'Store details saved.'); reload(); }} />}
  </>;
}
