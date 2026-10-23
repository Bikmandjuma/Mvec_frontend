// Supplier inventory: the same stock operations vendors have (store tabs,
// restock, remove, stock count, moving products between stores, with a
// history), for wholesale products. Stock reserved by
// unpaid vendor orders is already taken out of "On hand" and shown apart.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import Pagination from '../components/Pagination';
import ProductImage from '../components/ProductImage';
import { suppliersApi } from '../API/suppliers';
import { wholesaleApi } from '../API/wholesale';
import { PageHead, Loading, EmptyState, Metric, FormModal, money, matches, personName, useLoader, useNotice } from './seller/shared';
import useUrlQuery from '../components/useUrlQuery';

const PER_PAGE = 10;
const idOf = v => String(v?._id || v?.id || v || '');
const threshold = p => Number(p.lowStockThreshold ?? 10);
// Units moved onto the product's marketplace listing (not counted in On hand).
const onSale = p => (p.retailProduct?.status && p.retailProduct.status !== 'INACTIVE' ? Number(p.retailProduct.stockQuantity) || 0 : 0);
// Below the minimum order vendors can't order it at all, so it counts with "out".
const stockState = p => {
  const n = Number(p.stockQuantity) || 0;
  if (n <= 0) return 'out';
  if (n < Number(p.moq || 1)) return 'moq';
  return n <= threshold(p) ? 'low' : 'ok';
};
const STATE_LABEL = { ok: 'In stock', low: 'Low stock', moq: 'Below minimum order', out: 'Out of stock' };
const STATE_TONE = { ok: 'active', low: 'warning', moq: 'danger', out: 'danger' };

const MODES = [['add', 'Add stock (restock)'], ['remove', 'Remove stock'], ['set', 'Set exact count']];
const DEFAULT_REASONS = {
  add: ['Restock', 'Produced or harvested', 'Vendor return', 'Other'],
  remove: ['Damaged', 'Lost or stolen', 'Expired', 'Sold outside MVEC', 'Other'],
  set: ['Stock count correction', 'Other'],
};
const MOVEMENT_LABEL = { RESTOCK: 'Restock', REMOVE: 'Removed', COUNT: 'Count', TRANSFER: 'Moved' };

function AdjustModal({ product, reasons, onClose, onDone }) {
  const [mode, setMode] = useState('add');
  const fields = [
    { name: 'mode', label: 'Operation', type: 'select', options: MODES },
    { name: 'quantity', label: mode === 'set' ? 'New stock count' : `Units (${product.unit || 'piece'})`, type: 'number', required: true, half: true },
    { name: 'reason', label: 'Reason', type: 'select', half: true, options: (reasons[mode] || DEFAULT_REASONS[mode]).map(r => [r, r]) },
    { name: 'note', label: 'Note', placeholder: 'Optional, e.g. batch or delivery note number' },
  ];
  return <FormModal title={`Adjust stock · ${product.name}`} subtitle={`Currently ${product.stockQuantity} units on hand. Vendors must order at least ${product.moq || 1}.`}
    fields={fields} initial={{ mode, quantity: '', reason: (reasons[mode] || DEFAULT_REASONS[mode])[0], note: '' }}
    submitLabel="Update stock" onClose={onClose}
    onFieldChange={(name, value) => {
      if (name !== 'mode') return null;
      setMode(value);
      return { reason: (reasons[value] || DEFAULT_REASONS[value])[0] };
    }}
    onSubmit={async form => {
      const res = await suppliersApi.adjustStock(idOf(product), { mode: form.mode, quantity: Number(form.quantity), reason: form.reason, note: form.note });
      onDone(res);
    }} />;
}

export default function SupplierInventory() {
  const { data, loading, error, reload } = useLoader(() => Promise.all([
    suppliersApi.getMyProducts().then(r => r.products || []),
    suppliersApi.getStockMovements({ limit: 200 }).catch(() => ({ movements: [], reasons: null })),
    wholesaleApi.getMine({ status: 'PENDING_PAYMENT', limit: 100 }).then(r => r.orders || []).catch(() => []),
    suppliersApi.getMyStores().then(r => r.stores || []).catch(() => []),
  ]).then(([products, history, unpaid, stores]) => ({ products, movements: history.movements || [], reasons: history.reasons, unpaid, stores })));

  const [storeTab, setStoreTab] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [moving, setMoving] = useState(null); // array of product ids

  const [q, setQ] = useState('');
  useUrlQuery(setQ);
  const [stateFilter, setStateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState(null);
  const [view, setView] = useState('products');
  const [activityQ, setActivityQ] = useState('');
  const [activityType, setActivityType] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const notice = useNotice();

  const reasons = useMemo(() => {
    const r = data?.reasons;
    return r ? { add: r.RESTOCK, remove: r.REMOVE, set: r.COUNT } : DEFAULT_REASONS;
  }, [data]);

  // Units held for vendors who have not paid yet, per product.
  const reserved = useMemo(() => {
    const map = {};
    (data?.unpaid || []).forEach(o => (o.items || []).forEach(i => { if (i.product) map[idOf(i.product)] = (map[idOf(i.product)] || 0) + Number(i.quantity || 0); }));
    return map;
  }, [data]);

  const stores = data?.stores || [];
  const multiStore = stores.length > 1;
  const primaryId = idOf(stores.find(s => s.isPrimary));
  const storeOf = p => idOf(p.store) || primaryId;
  const storeName = id => stores.find(s => idOf(s) === id)?.storeName || '—';
  const storeCounts = useMemo(() => {
    const counts = {};
    (data?.products || []).forEach(p => {
      const c = counts[storeOf(p)] || (counts[storeOf(p)] = { items: 0, alerts: 0 });
      c.items += 1;
      if (stockState(p) !== 'ok') c.alerts += 1;
    });
    return counts;
  }, [data, primaryId]);

  const products = useMemo(() => (data?.products || []).filter(p => !storeTab || storeOf(p) === storeTab), [data, storeTab, primaryId]);
  const filtered = useMemo(() => products.filter(p => matches(q, p.name, p.category, p.unit) && (!stateFilter || stockState(p) === stateFilter || (stateFilter === 'out' && stockState(p) === 'moq'))), [products, q, stateFilter]);
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / PER_PAGE)));
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const stats = useMemo(() => ({
    units: products.reduce((s, p) => s + Number(p.stockQuantity || 0), 0),
    value: products.reduce((s, p) => s + Number(p.stockQuantity || 0) * Number(p.wholesalePrice || 0), 0),
    reserved: products.reduce((s, p) => s + (reserved[idOf(p)] || 0), 0),
    low: products.filter(p => stockState(p) === 'low').length,
    out: products.filter(p => ['out', 'moq'].includes(stockState(p))).length,
  }), [products, reserved]);

  // Supplier movements carry no store link, so a store tab shows its products' history.
  const inTab = useMemo(() => new Set(products.map(idOf)), [products]);
  const allMovements = useMemo(() => (data?.movements || []).filter(m => !storeTab || inTab.has(idOf(m.product))), [data, storeTab, inTab]);
  const movements = useMemo(() => allMovements.filter(m =>
    (!activityType || m.type === activityType) && matches(activityQ, m.productName, m.reason, m.note, m.performedBy?.Fullname)
  ), [allMovements, activityType, activityQ]);
  const activityCurrent = Math.min(activityPage, Math.max(1, Math.ceil(movements.length / PER_PAGE)));
  const shownMovements = movements.slice((activityCurrent - 1) * PER_PAGE, activityCurrent * PER_PAGE);

  const toggle = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShownSelected = shown.length > 0 && shown.every(p => selected.has(idOf(p)));
  const toggleAll = () => setSelected(s => {
    const n = new Set(s);
    shown.forEach(p => (allShownSelected ? n.delete(idOf(p)) : n.add(idOf(p))));
    return n;
  });
  const afterOperation = async message => { notice.success(message); setSelected(new Set()); await reload(); };
  const pickStore = id => { setStoreTab(id); setPage(1); setActivityPage(1); };

  return <>
    <PageHead eyebrow="INVENTORY" title="Inventory" desc="Stock vendors can order, with restock, removal and stock-count operations. Stock in unpaid orders is held for 48 hours."
      action={<Link className="outline-btn" to="/supplier/products?add=1"><Icon name="plus" /> New product</Link>} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      {multiStore && <div className="seller-store-tabs" role="tablist" aria-label="Stores">
        <button type="button" role="tab" aria-selected={!storeTab} className={!storeTab ? 'active' : ''} onClick={() => pickStore('')}>
          All stores <small>{data.products.length}</small>
        </button>
        {stores.map(s => { const c = storeCounts[idOf(s)] || { items: 0, alerts: 0 }; return <button type="button" role="tab" key={idOf(s)}
          aria-selected={storeTab === idOf(s)} className={storeTab === idOf(s) ? 'active' : ''} onClick={() => pickStore(idOf(s))}>
          {s.storeName}{s.isPrimary && <em>Primary</em>} <small>{c.items}</small>{c.alerts > 0 && <i title={`${c.alerts} need attention`}>{c.alerts}</i>}
        </button>; })}
      </div>}

      <div className="metric-grid">
        <Metric label="Units on hand" value={stats.units.toLocaleString()} icon="box" sub={`${products.length} products`} />
        <Metric label="Stock value" value={money(stats.value)} icon="wallet" sub="At wholesale price" />
        <Metric label="Reserved" value={stats.reserved.toLocaleString()} icon="cart" sub="In orders waiting for payment" />
        <Metric label="Low stock" value={stats.low} icon="bell" sub="At or below threshold" />
        <Metric label="Can't be ordered" value={stats.out} icon="grid" sub="Out of stock or below the minimum order" />
      </div>

      <div className="seller-view-tabs" role="tablist" aria-label="Inventory views">
        <button type="button" role="tab" id="sinv-tab-products" aria-controls="sinv-panel-products" aria-selected={view === 'products'} className={view === 'products' ? 'active' : ''} onClick={() => setView('products')}>
          <Icon name="box" size={16} /> Products <small>{products.length}</small>
        </button>
        <button type="button" role="tab" id="sinv-tab-activity" aria-controls="sinv-panel-activity" aria-selected={view === 'activity'} className={view === 'activity' ? 'active' : ''} onClick={() => setView('activity')}>
          <Icon name="chart" size={16} /> Recent stock activity <small>{allMovements.length}</small>
        </button>
      </div>

      {view === 'products' && <div role="tabpanel" id="sinv-panel-products" aria-labelledby="sinv-tab-products">
        <div className="dash-toolbar">
          <div className="dash-filter"><Icon name="search" /><input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search name, category or unit" /></div>
          <select className="table-filter-select" value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPage(1); }} aria-label="Stock status">
            <option value="">All stock levels</option><option value="low">Low stock</option><option value="out">Can't be ordered</option><option value="ok">In stock</option>
          </select>
        </div>

        {selected.size > 0 && <div className="seller-bulk-bar">
          <b>{selected.size} selected</b>
          {multiStore && <button type="button" className="gradient-btn" onClick={() => setMoving([...selected])}><Icon name="shop" /> Move to store…</button>}
          <button type="button" className="outline-btn" onClick={() => setSelected(new Set())}>Clear</button>
        </div>}

        <div className="data-card">
          {data.products.length === 0
            ? <EmptyState title="No wholesale products yet" text="Add products to your catalog to start tracking stock." action={<Link className="gradient-btn" to="/supplier/products?add=1">Add product</Link>} />
            : <div className="data-table">
              <div className={'seller-inv-row supplier seller-inv-head' + (multiStore ? ' multi' : '')}>
                <span><input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select all on this page" /></span>
                <span>Product</span>{multiStore && <span>Store</span>}<span>Min. order</span><span>On hand</span><span>Status</span><span /></div>
              {shown.length === 0 && <p className="tiny seller-cat-empty">No products match these filters.</p>}
              {shown.map(p => {
                const st = stockState(p);
                const pct = Math.min(100, (Number(p.stockQuantity) / Math.max(1, threshold(p) * 3)) * 100);
                const held = reserved[idOf(p)] || 0;
                return <div className={'seller-inv-row supplier' + (multiStore ? ' multi' : '') + (selected.has(idOf(p)) ? ' selected' : '')} key={idOf(p)}>
                  <span><input type="checkbox" checked={selected.has(idOf(p))} onChange={() => toggle(idOf(p))} aria-label={`Select ${p.name}`} /></span>
                  <span className="seller-inv-product">
                    {p.media?.mainImage ? <ProductImage src={p.media.mainImage} alt="" /> : <i><Icon name="box" size={15} /></i>}
                    <span><b>{p.name}</b><small>{p.category}{p.status === 'ARCHIVED' ? ' · Archived' : ''}</small></span>
                  </span>
                  {multiStore && <span className="tiny">{storeName(storeOf(p))}</span>}
                  <span className="tiny">{p.moq} {p.unit}{Number(p.moq) === 1 ? '' : 's'}</span>
                  <span className="seller-inv-qty">
                    <b>{p.stockQuantity}</b><small>min {threshold(p)}{held ? ` · ${held} reserved` : ''}{onSale(p) ? ` · ${onSale(p)} on marketplace` : ''}</small>
                    <span className={'seller-inv-bar ' + (st === 'moq' ? 'out' : st)}><i style={{ width: `${pct}%` }} /></span>
                  </span>
                  <span><em className={`status ${STATE_TONE[st]}`}>{STATE_LABEL[st]}</em></span>
                  <span className="seller-inv-actions">
                    <button type="button" className="table-action-btn" onClick={() => setAdjusting(p)}>Adjust</button>
                    {multiStore && <button type="button" className="table-action-btn" onClick={() => setMoving([idOf(p)])} title="Move to another store"><Icon name="shop" size={14} /></button>}
                  </span>
                </div>;
              })}
            </div>}
          {filtered.length > PER_PAGE && <Pagination page={current} setPage={setPage} total={filtered.length} perPage={PER_PAGE} />}
        </div>
      </div>}

      {view === 'activity' && <div role="tabpanel" id="sinv-panel-activity" aria-labelledby="sinv-tab-activity">
        <div className="dash-toolbar">
          <div className="dash-filter"><Icon name="search" /><input value={activityQ} onChange={e => { setActivityQ(e.target.value); setActivityPage(1); }} placeholder="Search product, reason, note or person" /></div>
          <select className="table-filter-select" value={activityType} onChange={e => { setActivityType(e.target.value); setActivityPage(1); }} aria-label="Operation type">
            <option value="">All operations</option>{Object.entries(MOVEMENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="data-card">
          <div className="data-card-head"><div><h3>Stock activity</h3><span>Manual operations, stock edits and moves{storeTab ? ` for ${storeName(storeTab)}` : ''}; vendor orders are not listed</span></div></div>
          {allMovements.length === 0 && <p className="tiny">No stock operations yet. Use Adjust on a product to restock, remove or count stock.</p>}
          {allMovements.length > 0 && movements.length === 0 && <p className="tiny">No activity matches these filters.</p>}
          {shownMovements.map(m => <div className="activity-row seller-move-row" key={m.id || m._id}>
            <div>
              <b>{m.productName || 'Product'}</b>
              <small>
                {MOVEMENT_LABEL[m.type] || m.type} · {m.reason}{m.note ? ` · ${m.note}` : ''} · {personName(m.performedBy, 'Supplier')} · {new Date(m.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
              </small>
            </div>
            <div className="seller-move-qty">
              {m.type === 'TRANSFER'
                ? <em className="status">{m.after} units</em>
                : <><strong className={m.quantity > 0 ? 'positive' : m.quantity < 0 ? 'seller-negative' : ''}>{m.quantity > 0 ? '+' : ''}{m.quantity}</strong><small>{m.before} → {m.after}</small></>}
            </div>
          </div>)}
          {movements.length > PER_PAGE && <Pagination page={activityCurrent} setPage={setActivityPage} total={movements.length} perPage={PER_PAGE} />}
        </div>
      </div>}
    </>}

    {adjusting && <AdjustModal product={adjusting} reasons={reasons} onClose={() => setAdjusting(null)}
      onDone={res => { setAdjusting(null); afterOperation(`${res.product.name}: ${res.movement.before} → ${res.movement.after} units.`); }} />}
    {moving && <FormModal title={`Move ${moving.length} product${moving.length === 1 ? '' : 's'} to another store`}
      subtitle="Products keep their stock and price; only the store they ship from changes."
      fields={[
        { name: 'storeId', label: 'Destination store', type: 'select', required: true, placeholder: 'Select a store', options: stores.map(s => [idOf(s), s.storeName + (s.isPrimary ? ' (primary)' : '')]) },
        { name: 'note', label: 'Note', placeholder: 'Optional' },
      ]}
      initial={{ storeId: '', note: '' }} submitLabel="Move products" onClose={() => setMoving(null)}
      onSubmit={async form => { const res = await suppliersApi.moveToStore(moving, form.storeId, form.note); setMoving(null); afterOperation(res.message); }} />}
  </>;
}
