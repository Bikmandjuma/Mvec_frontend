// Supplier wholesale catalog, laid out like the vendor's Products page
// (VendorDashboard ProductModule): same list, filters and product editor modal,
// with wholesale fields (unit, minimum order, bulk discount) instead of retail ones.
// A product can also be published to the marketplace so buyers see and buy it.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import Pagination from '../components/Pagination';
import ProductImage from '../components/ProductImage';
import useUrlQuery from '../components/useUrlQuery';
import { UnitSelect } from '../components/CategorySelect';
import { suppliersApi } from '../API/suppliers';
import { categoriesApi } from '../API/categories';
import { uploadsApi } from '../API/uploads';
import { extractErrorMessage } from '../API/client';
import { money, matches, FormModal } from './seller/shared';
import { buildCategoryTree } from './seller/CategoriesPage';

const idOf = v => String(v?._id || v?.id || v || '');
const emptyProduct = { name: '', category: '', unit: 'piece', storeId: '', shortDescription: '', wholesalePrice: '', bulkDiscount: 0, retailPrice: '', moq: 1, stockQuantity: '', lowStockThreshold: 10, status: 'ACTIVE', gallery: [], mainImage: '', sellToBuyers: false, buyerPrice: '', buyerUnits: '' };
const STATUS_LABEL = { ACTIVE: 'Active', OUT_OF_STOCK: 'Out of stock', ARCHIVED: 'Archived' };
const onMarketplace = p => p.retailProduct && typeof p.retailProduct === 'object' && p.retailProduct.status !== 'INACTIVE';
const unitPrice = f => Math.round((Number(f.wholesalePrice) || 0) * (1 - (Number(f.bulkDiscount) || 0) / 100));

function ProductForm({ product, stores = [], onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => {
    if (!product) return { ...emptyProduct, storeId: idOf(stores.find(s => s.isPrimary)) };
    const gallery = product.media?.gallery?.length ? product.media.gallery : product.media?.mainImage ? [product.media.mainImage] : [];
    return { ...emptyProduct, ...product, storeId: idOf(product.store) || idOf(stores.find(s => s.isPrimary)), gallery, mainImage: product.media?.mainImage || gallery[0] || '' };
  });
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const listing = product && onMarketplace(product) ? product.retailProduct : null;
  const listed = Boolean(listing);

  useEffect(() => { categoriesApi.getAll().then(res => setCategories(res.categories || [])).catch(() => {}); }, []);

  const update = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const addImages = async e => {
    const files = [...e.target.files || []];
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      const res = await uploadsApi.uploadImages(files);
      const urls = res.urls || [];
      setForm(f => ({ ...f, mainImage: f.mainImage || urls[0] || '', gallery: [...f.gallery, ...urls] }));
    } catch (err) { setError(extractErrorMessage(err)); }
    finally { setUploading(false); }
  };
  const removeImage = i => setForm(f => {
    const nextGallery = f.gallery.filter((_, x) => x !== i);
    return { ...f, gallery: nextGallery, mainImage: nextGallery[0] || '' };
  });

  const submit = e => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.category || form.wholesalePrice === '' || form.stockQuantity === '' || !form.moq) {
      setError('Please complete the required fields.');
      return;
    }
    if (Number(form.bulkDiscount) < 0 || Number(form.bulkDiscount) >= 100) { setError('The bulk discount must be between 0 and 99%.'); return; }
    const buyerUnits = Number(form.buyerUnits);
    if (form.sellToBuyers) {
      if (!(Number(form.buyerPrice) >= 1)) { setError('Enter the price buyers pay.'); return; }
      if (!Number.isInteger(buyerUnits) || buyerUnits < 1) { setError('Put at least 1 unit on sale for buyers.'); return; }
      if (buyerUnits > Number(form.stockQuantity)) { setError(`You can put at most ${form.stockQuantity} units on sale (your stock quantity).`); return; }
    }
    Promise.resolve(onSave({
      name: form.name, category: form.category, unit: form.unit, shortDescription: form.shortDescription,
      storeId: form.storeId || '',
      wholesalePrice: Number(form.wholesalePrice),
      bulkDiscount: Number(form.bulkDiscount || 0),
      retailPrice: form.retailPrice === '' ? 0 : Number(form.retailPrice),
      moq: Number(form.moq),
      stockQuantity: Number(form.stockQuantity),
      lowStockThreshold: Number(form.lowStockThreshold || 0),
      status: form.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
      media: { mainImage: form.mainImage || form.gallery[0] || '', gallery: form.gallery },
    }, form.sellToBuyers ? { price: Number(form.buyerPrice), units: buyerUnits } : null)).catch(err => setError(extractErrorMessage(err)));
  };

  const tree = buildCategoryTree(categories);
  const known = categories.some(c => c.name === form.category);
  return <div className="product-editor"><div className="editor-head"><div><span className="eyebrow">WHOLESALE CATALOG</span><h2>{product ? 'Edit wholesale product' : 'Add wholesale product'}</h2><p>Complete the product details before vendors can order it from your catalog.</p></div><button className="outline-btn" type="button" onClick={onCancel}>Cancel</button></div>
    {error && <div className="form-error">{error}</div>}
    <form onSubmit={submit} className="product-form">
      <section className="editor-section"><h3>Basic information</h3>
        <div className="two-col"><label className="field"><span>Product name *</span><input name="name" value={form.name} onChange={update} required placeholder="e.g. Rice 25kg bag" /></label>
          <label className="field"><span>Category *</span><select name="category" value={form.category} onChange={update} required><option value="">Select category</option>{!known && form.category && <option value={form.category}>{form.category}</option>}{tree.map(root => root.children.length ? <optgroup key={root.id} label={root.name}><option value={root.name}>{root.name} (general)</option>{root.children.map(ch => <option key={ch.id} value={ch.name}>{ch.name}</option>)}</optgroup> : <option key={root.id} value={root.name}>{root.name}</option>)}</select></label></div>
        <div className="two-col"><UnitSelect value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} label="Sold per" />
          {stores.length > 1 ? <label className="field"><span>Store</span><select name="storeId" value={form.storeId} onChange={update}>{stores.map(st => <option key={idOf(st)} value={idOf(st)}>{st.storeName}{st.isPrimary ? ' (primary)' : ''}</option>)}</select></label> : <span />}</div>
        <label className="field"><span>Short description</span><textarea name="shortDescription" value={form.shortDescription || ''} onChange={update} rows="4" maxLength="500" placeholder="Grade, packaging, origin, delivery areas…" /></label>
      </section>
      <section className="editor-section"><h3>Pricing & inventory</h3>
        <div className="three-col"><label className="field"><span>Wholesale price (RWF) *</span><input type="number" min="0" name="wholesalePrice" value={form.wholesalePrice} onChange={update} required /></label>
          <label className="field"><span>Bulk discount (%)</span><input type="number" min="0" max="99" step="0.1" name="bulkDiscount" value={form.bulkDiscount} onChange={update} />
            {Number(form.bulkDiscount) > 0 && Number(form.wholesalePrice) > 0 && <small className="seller-discount-hint">Vendors pay <b>{money(unitPrice(form))}</b> per {form.unit || 'unit'}</small>}</label>
          <label className="field"><span>Suggested retail price</span><input type="number" min="0" name="retailPrice" value={form.retailPrice || ''} onChange={update} placeholder="Shown to vendors" /></label></div>
        <div className="three-col"><label className="field"><span>Minimum order (units) *</span><input type="number" min="1" name="moq" value={form.moq} onChange={update} required /></label>
          <label className="field"><span>Stock quantity *</span><input type="number" min="0" name="stockQuantity" value={form.stockQuantity} onChange={update} required /></label>
          <label className="field"><span>Low stock threshold</span><input type="number" min="0" name="lowStockThreshold" value={form.lowStockThreshold} onChange={update} /></label></div>
        <div className="three-col"><label className="field"><span>Status</span><select name="status" value={form.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'} onChange={update}><option value="ACTIVE">Active: vendors can order it</option><option value="ARCHIVED">Archived: hidden from vendors</option></select></label></div>
      </section>
      <section className="editor-section"><h3>Who can buy it</h3>
        {listed
          ? <p className="editor-help">Vendors and buyers. {listing.stockQuantity} units are on the marketplace at {money(listing.price)}; change that with <b>Manage on marketplace</b> in the product list.</p>
          : <>
            <div className="sell-to-options" role="radiogroup" aria-label="Who can buy it">
              <label className={'sell-to-option' + (!form.sellToBuyers ? ' selected' : '')}><input type="radio" name="sellToBuyers" checked={!form.sellToBuyers} onChange={() => setForm(f => ({ ...f, sellToBuyers: false }))} /><span><b>Vendors only</b><small>Wholesale: vendors order in bulk from your catalog.</small></span></label>
              <label className={'sell-to-option' + (form.sellToBuyers ? ' selected' : '')}><input type="radio" name="sellToBuyers" checked={form.sellToBuyers} onChange={() => setForm(f => ({ ...f, sellToBuyers: true, buyerPrice: f.buyerPrice || f.retailPrice || '' }))} /><span><b>Vendors and buyers</b><small>Also listed on the marketplace, so buyers can buy single units from you.</small></span></label>
            </div>
            {form.sellToBuyers && <div className="two-col">
              <label className="field"><span>Price buyers pay (RWF) *</span><input type="number" min="1" name="buyerPrice" value={form.buyerPrice} onChange={update} /></label>
              <label className="field"><span>Units for buyers *</span><input type="number" min="1" max={form.stockQuantity || undefined} name="buyerUnits" value={form.buyerUnits} onChange={update} placeholder={form.stockQuantity ? `Up to ${form.stockQuantity}` : ''} />
                <small className="seller-discount-hint">These units leave wholesale stock so vendors can't order them too. Move them back any time.</small></label>
            </div>}
          </>}
      </section>
      <section className="editor-section"><h3>Media</h3><p className="editor-help">Upload product images. The first image becomes the main product image.</p>
        <label className="upload-zone"><Icon name="box" /><b>{uploading ? 'Uploading…' : 'Upload product images'}</b><small>PNG, JPG or WEBP, multiple files supported (max 8MB each)</small><input type="file" accept="image/*" multiple onChange={addImages} disabled={uploading} /></label>
        {form.gallery.length > 0 && <div className="media-grid">{form.gallery.map((src, i) => <div className="media-thumb" key={i}><ProductImage src={src} alt={`Product ${i + 1}`} /><button type="button" onClick={() => removeImage(i)}>×</button>{i === 0 && <span>Main image</span>}</div>)}</div>}
      </section>
      <div className="editor-actions"><button type="button" className="outline-btn" onClick={onCancel}>Cancel</button><button className="gradient-btn" type="submit" disabled={saving || uploading}>{saving ? 'Saving...' : product ? 'Save changes' : 'Create product'}</button></div>
    </form>
  </div>;
}

// Publish to buyers, or change the listing: buyer price, and units moved
// between wholesale stock and the marketplace.
function MarketplaceModal({ product, onClose, onDone }) {
  const listing = product.retailProduct && typeof product.retailProduct === 'object' ? product.retailProduct : null;
  const live = listing && listing.status !== 'INACTIVE';
  const [mode, setMode] = useState('add');
  const fields = [
    { name: 'price', label: 'Price buyers pay (RWF)', type: 'number', required: true, half: true },
    ...(live ? [{ name: 'mode', label: 'Stock', type: 'select', half: true, options: [['add', 'Add units from wholesale stock'], ['remove', 'Move units back to wholesale']] }] : []),
    { name: 'units', label: mode === 'remove' ? `Units to move back (up to ${listing?.stockQuantity ?? 0})` : `Units to put on sale (up to ${product.stockQuantity} in wholesale stock)`, type: 'number', required: !live, half: !live },
  ];
  return <FormModal title={live ? `Marketplace · ${product.name}` : `Sell ${product.name} to buyers`}
    subtitle={live ? `${listing.stockQuantity} units on the marketplace at ${money(listing.price)}. Buyers order and pay online; you ship and are paid on delivery.` : 'Buyers see it in the marketplace as a product from your shop. The units you choose leave wholesale stock so vendors can\'t order them too; move them back any time.'}
    fields={fields}
    initial={{ price: listing?.price || product.retailPrice || '', units: '', mode }}
    submitLabel={live ? 'Save listing' : 'Publish'} onClose={onClose}
    onFieldChange={(name, value) => { if (name === 'mode') setMode(value); return null; }}
    onSubmit={async form => {
      const units = Number(form.units || 0);
      let res;
      if (live && form.mode === 'remove') {
        if (Number(form.price) !== Number(listing.price)) await suppliersApi.publish(idOf(product), { price: Number(form.price), units: 0 });
        res = units ? await suppliersApi.moveListingStock(idOf(product), { mode: 'remove', units }) : { message: 'Listing saved.' };
      } else {
        res = await suppliersApi.publish(idOf(product), { price: Number(form.price), units });
      }
      onDone(res.message);
    }} />;
}

export default function SupplierProducts() {
  const location = useLocation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  useUrlQuery(setQ);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [selling, setSelling] = useState(null);
  const [notice, setNotice] = useState('');
  const per = 6;

  // Reloads after an action keep the list on screen; only the first load shows a placeholder.
  const load = () => {
    suppliersApi.getMyProducts()
      .then(res => setRows(res.products || []))
      .catch(err => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => { suppliersApi.getMyStores().then(res => setStores(res.stores || [])).catch(() => {}); }, []);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('add') === '1') { setEditing({ mode: 'create' }); navigate('/supplier/products', { replace: true }); }
  }, [location.search, navigate]);
  useEffect(() => {
    if (!editing) return;
    const onKeyDown = e => { if (e.key === 'Escape') setEditing(null); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editing]);

  const primaryId = idOf(stores.find(st => st.isPrimary));
  const storeIdOf = p => idOf(p.store) || primaryId;
  const storeName = p => p.store?.storeName || stores.find(st => idOf(st) === storeIdOf(p))?.storeName || '';
  const categories = useMemo(() => [...new Set(rows.map(p => p.category).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => rows.filter(p => matches(q, p.name, p.category, p.unit) && (!statusFilter || p.status === statusFilter) && (!categoryFilter || p.category === categoryFilter) && (!storeFilter || storeIdOf(p) === storeFilter)), [rows, q, statusFilter, categoryFilter, storeFilter, primaryId]);
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / per)));
  const shown = filtered.slice((current - 1) * per, current * per);

  const saveProduct = async (payload, sellToBuyers) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = editing?.mode === 'create'
        ? await suppliersApi.createProduct(payload)
        : await suppliersApi.updateProduct(idOf(editing.product), payload);
      const saved = res.product || res.data || editing?.product;
      setEditing(null);
      if (sellToBuyers) {
        // The product is saved either way; a failed publish is retried from the list.
        try { setNotice((await suppliersApi.publish(idOf(saved), sellToBuyers)).message); }
        catch (err) { setError(`${payload.name} was saved for vendors, but not put on the marketplace: ${extractErrorMessage(err)} Use "Sell to buyers" to try again.`); }
      }
      load();
    } finally { setSaving(false); } // errors are shown inside the product form
  };
  const toggleArchive = async p => {
    try { await suppliersApi.updateProduct(idOf(p), { status: p.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED' }); load(); }
    catch (err) { setError(extractErrorMessage(err)); }
  };
  const takeOff = async p => {
    if (!window.confirm(`Take ${p.name} off the marketplace? Unsold units go back to wholesale stock.`)) return;
    try { const res = await suppliersApi.unpublish(idOf(p)); setNotice(res.message); load(); }
    catch (err) { setError(extractErrorMessage(err)); }
  };
  const removeProduct = async p => {
    if (!window.confirm(`Delete ${p.name}? Vendors can no longer order it${onMarketplace(p) ? ' and it leaves the marketplace' : ''}. This cannot be undone.`)) return;
    try { await suppliersApi.deleteProduct(idOf(p)); load(); }
    catch (err) { setError(extractErrorMessage(err)); }
  };

  return <>
    <div className="dash-page-head">
      <div><span className="eyebrow">SUPPLIER PLATFORM</span><h1>Wholesale products</h1><p>Vendors order these in bulk from your catalog. Choose <b>Sell to buyers</b> on a product to list it on the marketplace too.</p></div>
      <button type="button" className="gradient-btn" onClick={() => setEditing({ mode: 'create' })}><Icon name="plus" /> Add product</button>
    </div>
    {error && <div className="form-error">{error}</div>}
    {notice && <div className="form-alert success" role="status">{notice}</div>}
    <div className="dash-toolbar">
      <div className="dash-filter"><Icon name="search" /><input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search products, category or unit" /></div>
      <select className="table-filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}><option value="">All statuses</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <select className="table-filter-select" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} aria-label="Filter by category"><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
      {stores.length > 1 && <select className="table-filter-select" value={storeFilter} onChange={e => { setStoreFilter(e.target.value); setPage(1); }} aria-label="Filter by store"><option value="">All stores</option>{stores.map(st => <option key={idOf(st)} value={idOf(st)}>{st.storeName}</option>)}</select>}
    </div>
    <div className="data-card">
      <div className="data-card-head"><div><h3>Wholesale catalog</h3><span>{filtered.length} products</span></div><span className="muted">{rows.filter(onMarketplace).length} also on the marketplace</span></div>
      {loading && <div className="empty-state"><h3>Loading products…</h3></div>}
      {!loading && shown.length === 0 && (rows.length
        ? <div className="empty-state"><h3>No products match</h3><p>Try another search or filter.</p><button type="button" className="outline-btn" onClick={() => { setQ(''); setStatusFilter(''); setCategoryFilter(''); setStoreFilter(''); setPage(1); }}>Clear filters</button></div>
        : <div className="empty-state"><h3>No products yet</h3><p>Add your first wholesale product so vendors can order it.</p><button type="button" className="gradient-btn" onClick={() => setEditing({ mode: 'create' })}><Icon name="plus" /> Add product</button></div>)}
      {!loading && shown.length > 0 && <div className="sp-table" role="table" aria-label="Wholesale products">
        <div className="sp-row sp-head" role="row"><span>Product</span><span>Wholesale price</span><span>Stock</span><span>Sold to</span><span>Status</span><span className="sp-head-actions">Actions</span></div>
        {shown.map(p => {
          const low = p.status !== 'ARCHIVED' && Number(p.stockQuantity) <= Number(p.lowStockThreshold ?? 10);
          const listed = onMarketplace(p);
          return <div className={'sp-row' + (p.status === 'ARCHIVED' ? ' archived' : '')} role="row" key={idOf(p)}>
            <div className="sp-product">
              {p.media?.mainImage ? <ProductImage src={p.media.mainImage} alt="" /> : <span className="sp-thumb"><Icon name="box" size={20} /></span>}
              <div><b>{p.name}</b><small>{p.category} · per {p.unit} · min. {p.moq}{stores.length > 1 && storeName(p) ? ` · ${storeName(p)}` : ''}</small></div>
            </div>
            <div className="sp-cell" data-label="Wholesale price">
              <b>{money(unitPrice(p))}</b>
              {Number(p.bulkDiscount) > 0 && <small><s>{money(p.wholesalePrice)}</s> <em className="seller-discount-badge">-{p.bulkDiscount}%</em></small>}
            </div>
            <div className="sp-cell" data-label="Stock"><b className={low ? 'sp-low' : ''}>{p.stockQuantity}</b>{low && <small className="sp-low">Running low</small>}</div>
            <div className="sp-cell" data-label="Sold to">
              {listed
                ? <><span className="sp-channel buyers">Vendors + buyers</span><small>{p.retailProduct.stockQuantity} at {money(p.retailProduct.price)} · <button type="button" className="sp-link" onClick={() => takeOff(p)}>Take off</button></small></>
                : <span className="sp-channel">Vendors only</span>}
            </div>
            <div className="sp-cell" data-label="Status"><em className={'status ' + (p.status === 'ACTIVE' ? 'active' : 'warning')}>{STATUS_LABEL[p.status] || p.status}</em></div>
            <div className="sp-actions">
              <button type="button" className={'table-action-btn' + (listed ? '' : ' primary')} disabled={p.status === 'ARCHIVED'} onClick={() => { setNotice(''); setSelling(p); }}><Icon name="shop" size={14} />{listed ? 'Manage' : 'Sell to buyers'}</button>
              <button type="button" className="sp-icon" title="Edit product" aria-label={`Edit ${p.name}`} onClick={() => setEditing({ mode: 'edit', product: p })}><Icon name="edit" size={16} /></button>
              <button type="button" className="sp-icon" title={p.status === 'ARCHIVED' ? 'Restore product' : 'Archive product'} aria-label={`${p.status === 'ARCHIVED' ? 'Restore' : 'Archive'} ${p.name}`} onClick={() => toggleArchive(p)}><Icon name={p.status === 'ARCHIVED' ? 'check' : 'box'} size={16} /></button>
              <button type="button" className="sp-icon danger" title="Delete product" aria-label={`Delete ${p.name}`} onClick={() => removeProduct(p)}><Icon name="trash" size={16} /></button>
            </div>
          </div>;
        })}
      </div>}
      <Pagination page={current} setPage={setPage} total={filtered.length} perPage={per} />
    </div>
    {selling && <MarketplaceModal product={selling} onClose={() => setSelling(null)} onDone={message => { setSelling(null); setNotice(message); load(); }} />}
    {editing && createPortal(
      <div className="product-editor-backdrop" role="dialog" aria-modal="true" aria-label={editing.mode === 'create' ? 'Add product' : 'Edit product'} onMouseDown={e => { if (e.target === e.currentTarget) setEditing(null); }}>
        <div className="product-editor-modal" onMouseDown={e => e.stopPropagation()}>
          <ProductForm product={editing.mode === 'edit' ? editing.product : null} stores={stores} onCancel={() => setEditing(null)} onSave={saveProduct} saving={saving} />
        </div>
      </div>,
      document.body
    )}
  </>;
}
