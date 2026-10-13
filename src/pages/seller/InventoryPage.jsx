import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import Pagination from '../../components/Pagination';
import { productsApi } from '../../API/products';
import { storesApi } from '../../API/stores';
import { PageHead, Loading, EmptyState, Metric, FormModal, money, matches, personName, useLoader, useNotice } from './shared';

const PER_PAGE = 10;
const idOf = v => String(v?._id || v?.id || v || '');
const threshold = p => Number(p.lowStockThreshold ?? 5);
const stockState = p => (Number(p.stockQuantity) <= 0 ? 'out' : Number(p.stockQuantity) <= threshold(p) ? 'low' : 'ok');
const STATE_LABEL = { ok: 'In stock', low: 'Low stock', out: 'Out of stock' };
const STATE_TONE = { ok: 'active', low: 'warning', out: 'danger' };

const MODES = [['add', 'Add stock (restock)'], ['remove', 'Remove stock'], ['set', 'Set exact count']];
const DEFAULT_REASONS = {
  add: ['Restock', 'Received from supplier', 'Customer return', 'Other'],
  remove: ['Damaged', 'Lost or stolen', 'Expired', 'Sold offline', 'Other'],
  set: ['Stock count correction', 'Other'],
};
const MOVEMENT_LABEL = { RESTOCK: 'Restock', REMOVE: 'Removed', COUNT: 'Count', TRANSFER: 'Moved' };

function AdjustModal({ product, reasons, onClose, onDone }) {
  const [mode, setMode] = useState('add');
  const fields = [
    { name: 'mode', label: 'Operation', type: 'select', options: MODES },
    { name: 'quantity', label: mode === 'set' ? 'New stock count' : 'Units', type: 'number', required: true, half: true },
    { name: 'reason', label: 'Reason', type: 'select', half: true, options: (reasons[mode] || DEFAULT_REASONS[mode]).map(r => [r, r]) },
    { name: 'note', label: 'Note', placeholder: 'Optional, e.g. supplier invoice number' },
  ];
  return <FormModal title={`Adjust stock · ${product.name}`} subtitle={`Currently ${product.stockQuantity} units on hand.`}
    fields={fields} initial={{ mode, quantity: '', reason: (reasons[mode] || DEFAULT_REASONS[mode])[0], note: '' }}
    submitLabel="Update stock" onClose={onClose}
    onFieldChange={(name, value) => {
      if (name !== 'mode') return null;
      setMode(value);
      return { reason: (reasons[value] || DEFAULT_REASONS[value])[0] };
    }}
    onSubmit={async form => {
      const res = await productsApi.adjustStock(product.id, { mode: form.mode, quantity: Number(form.quantity), reason: form.reason, note: form.note });
      onDone(res);
    }} />;
}

export default function InventoryPage() {
  const { data, loading, error, reload } = useLoader(() => Promise.all([
    productsApi.getVendorProducts().then(r => r.products || []),
    storesApi.getMyStores().then(r => r.stores || []).catch(() => []),
    productsApi.getStockMovements({ limit: 200 }).catch(() => ({ movements: [], reasons: null })),
  ]).then(([products, stores, history]) => ({ products, stores, movements: history.movements || [], reasons: history.reasons })));

  const [storeTab, setStoreTab] = useState('');
  const [q, setQ] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [adjusting, setAdjusting] = useState(null);
  const [moving, setMoving] = useState(null); // array of product ids
  const [view, setView] = useState('products');
  const [activityQ, setActivityQ] = useState('');
  const [activityType, setActivityType] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const notice = useNotice();

  const stores = data?.stores || [];
  const multiStore = stores.length > 1;
  const primaryId = idOf(stores.find(s => s.isPrimary));
  const storeOf = p => idOf(p.store) || primaryId;
  const storeName = id => stores.find(s => idOf(s) === id)?.storeName || '—';

  const reasons = useMemo(() => {
    const r = data?.reasons;
    return r ? { add: r.RESTOCK, remove: r.REMOVE, set: r.COUNT } : DEFAULT_REASONS;
  }, [data]);

  const inScope = useMemo(() => (data?.products || []).filter(p => !storeTab || storeOf(p) === storeTab), [data, storeTab, primaryId]);
  const filtered = useMemo(() => inScope.filter(p => matches(q, p.name, p.sku, p.brand, p.category?.name) && (!stateFilter || stockState(p) === stateFilter)), [inScope, q, stateFilter]);
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / PER_PAGE)));
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const stats = useMemo(() => {
    const units = inScope.reduce((s, p) => s + Number(p.stockQuantity || 0), 0);
    const value = inScope.reduce((s, p) => s + Number(p.stockQuantity || 0) * Number(p.costPrice || p.discountPrice || p.price || 0), 0);
    return { units, value, low: inScope.filter(p => stockState(p) === 'low').length, out: inScope.filter(p => stockState(p) === 'out').length };
  }, [inScope]);

  const storeCounts = useMemo(() => {
    const counts = {};
    (data?.products || []).forEach(p => {
      const k = storeOf(p);
      const c = counts[k] || (counts[k] = { items: 0, alerts: 0 });
      c.items += 1;
      if (stockState(p) !== 'ok') c.alerts += 1;
    });
    return counts;
  }, [data, primaryId]);

  const storeMovements = useMemo(() => (data?.movements || []).filter(m => !storeTab || idOf(m.store) === storeTab || idOf(m.fromStore) === storeTab), [data, storeTab]);
  const movements = useMemo(() => storeMovements.filter(m =>
    (!activityType || m.type === activityType) &&
    matches(activityQ, m.productName, m.reason, m.note, m.performedBy?.Fullname, m.fromStore?.storeName, m.toStore?.storeName)
  ), [storeMovements, activityType, activityQ]);
  const activityCurrent = Math.min(activityPage, Math.max(1, Math.ceil(movements.length / PER_PAGE)));
  const shownMovements = movements.slice((activityCurrent - 1) * PER_PAGE, activityCurrent * PER_PAGE);

  const toggle = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShownSelected = shown.length > 0 && shown.every(p => selected.has(p.id));
  const toggleAll = () => setSelected(s => {
    const n = new Set(s);
    shown.forEach(p => (allShownSelected ? n.delete(p.id) : n.add(p.id)));
    return n;
  });

  const afterOperation = async message => { notice.success(message); setSelected(new Set()); await reload(); };

  return <>
    <PageHead title="Inventory" desc={multiStore ? 'Stock levels per store, with restock, removal, stock counts and transfers between stores.' : 'Stock levels with restock, removal and stock-count operations.'}
      action={<Link className="outline-btn" to="/vendor/products?add=1"><Icon name="plus" /> New product</Link>} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      {multiStore && <div className="seller-store-tabs" role="tablist" aria-label="Stores">
        <button type="button" role="tab" aria-selected={!storeTab} className={!storeTab ? 'active' : ''} onClick={() => { setStoreTab(''); setPage(1); setActivityPage(1); }}>
          All stores <small>{data.products.length}</small>
        </button>
        {stores.map(s => { const c = storeCounts[idOf(s)] || { items: 0, alerts: 0 }; return <button type="button" role="tab" key={idOf(s)}
          aria-selected={storeTab === idOf(s)} className={storeTab === idOf(s) ? 'active' : ''} onClick={() => { setStoreTab(idOf(s)); setPage(1); setActivityPage(1); }}>
          {s.storeName}{s.isPrimary && <em>Primary</em>} <small>{c.items}</small>{c.alerts > 0 && <i title={`${c.alerts} need attention`}>{c.alerts}</i>}
        </button>; })}
      </div>}

      <div className="metric-grid">
        <Metric label="Units on hand" value={stats.units.toLocaleString()} icon="box" sub={`${inScope.length} products`} />
        <Metric label="Stock value" value={money(stats.value)} icon="wallet" sub="At cost (or selling price)" />
        <Metric label="Low stock" value={stats.low} icon="bell" sub="At or below threshold" />
        <Metric label="Out of stock" value={stats.out} icon="cart" sub="Hidden from buyers" />
      </div>

      <div className="seller-view-tabs" role="tablist" aria-label="Inventory views">
        <button type="button" role="tab" id="inv-tab-products" aria-controls="inv-panel-products" aria-selected={view === 'products'} className={view === 'products' ? 'active' : ''} onClick={() => setView('products')}>
          <Icon name="box" size={16} /> Products <small>{inScope.length}</small>
        </button>
        <button type="button" role="tab" id="inv-tab-activity" aria-controls="inv-panel-activity" aria-selected={view === 'activity'} className={view === 'activity' ? 'active' : ''} onClick={() => setView('activity')}>
          <Icon name="chart" size={16} /> Recent stock activity <small>{storeMovements.length}</small>
        </button>
      </div>

      {view === 'products' && <div role="tabpanel" id="inv-panel-products" aria-labelledby="inv-tab-products">
      <div className="dash-toolbar">
        <div className="dash-filter"><Icon name="search" /><input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search name, SKU, brand or category" /></div>
        <select className="table-filter-select" value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPage(1); }} aria-label="Stock status">
          <option value="">All stock levels</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="ok">In stock</option>
        </select>
      </div>

      {selected.size > 0 && <div className="seller-bulk-bar">
        <b>{selected.size} selected</b>
        {multiStore && <button type="button" className="gradient-btn" onClick={() => setMoving([...selected])}><Icon name="shop" /> Move to store…</button>}
        <button type="button" className="outline-btn" onClick={() => setSelected(new Set())}>Clear</button>
      </div>}

      <div className="data-card">
        {data.products.length === 0
          ? <EmptyState title="No products yet" text="Add products to start tracking stock." action={<Link className="gradient-btn" to="/vendor/products?add=1">Add product</Link>} />
          : <div className="data-table">
            <div className={'seller-inv-row seller-inv-head' + (multiStore ? ' multi' : '')}>
              <span><input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select all on this page" /></span>
              <span>Product</span>{multiStore && <span>Store</span>}<span>On hand</span><span>Status</span><span />
            </div>
            {shown.length === 0 && <p className="tiny seller-cat-empty">No products match these filters.</p>}
            {shown.map(p => { const st = stockState(p); const pct = Math.min(100, (Number(p.stockQuantity) / Math.max(1, threshold(p) * 3)) * 100);
              return <div className={'seller-inv-row' + (multiStore ? ' multi' : '') + (selected.has(p.id) ? ' selected' : '')} key={p.id}>
                <span><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} /></span>
                <span className="seller-inv-product">
                  {p.media?.mainImage || p.mainImage ? <img src={p.media?.mainImage || p.mainImage} alt="" /> : <i><Icon name="box" size={15} /></i>}
                  <span><b>{p.name}</b><small>{p.sku}{p.category?.name ? ` · ${p.category.name}` : ''}</small></span>
                </span>
                {multiStore && <span className="tiny">{storeName(storeOf(p))}</span>}
                <span className="seller-inv-qty">
                  <b>{p.stockQuantity}</b><small>min {threshold(p)}</small>
                  <span className={'seller-inv-bar ' + st}><i style={{ width: `${pct}%` }} /></span>
                </span>
                <span><em className={`status ${STATE_TONE[st]}`}>{STATE_LABEL[st]}</em></span>
                <span className="seller-inv-actions">
                  <button type="button" className="table-action-btn" onClick={() => setAdjusting(p)}>Adjust</button>
                  {multiStore && <button type="button" className="table-action-btn" onClick={() => setMoving([p.id])} title="Move to another store"><Icon name="shop" size={14} /></button>}
                </span>
              </div>; })}
          </div>}
        {filtered.length > PER_PAGE && <Pagination page={current} setPage={setPage} total={filtered.length} perPage={PER_PAGE} />}
      </div>
      </div>}

      {view === 'activity' && <div role="tabpanel" id="inv-panel-activity" aria-labelledby="inv-tab-activity">
      <div className="dash-toolbar">
        <div className="dash-filter"><Icon name="search" /><input value={activityQ} onChange={e => { setActivityQ(e.target.value); setActivityPage(1); }} placeholder="Search product, reason, note or person" /></div>
        <select className="table-filter-select" value={activityType} onChange={e => { setActivityType(e.target.value); setActivityPage(1); }} aria-label="Operation type">
          <option value="">All operations</option>{Object.entries(MOVEMENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div className="data-card">
        <div className="data-card-head"><div><h3>Stock activity</h3><span>Manual operations{storeTab ? ` in ${storeName(storeTab)}` : ''}; order sales are not listed</span></div></div>
        {storeMovements.length === 0 && <p className="tiny">No stock operations yet. Use Adjust on a product to restock, remove or count stock.</p>}
        {storeMovements.length > 0 && movements.length === 0 && <p className="tiny">No activity matches these filters.</p>}
        {shownMovements.map(m => <div className="activity-row seller-move-row" key={m.id || m._id}>
          <div>
            <b>{m.productName || 'Product'}</b>
            <small>
              {MOVEMENT_LABEL[m.type]} · {m.type === 'TRANSFER' ? `${m.fromStore?.storeName || '—'} → ${m.toStore?.storeName || '—'}` : m.reason}
              {m.note ? ` · ${m.note}` : ''} · {personName(m.performedBy, 'Seller')} · {new Date(m.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
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
      subtitle="Products keep their stock and price; only the store they are listed under changes."
      fields={[
        { name: 'storeId', label: 'Destination store', type: 'select', required: true, placeholder: 'Select a store', options: stores.map(s => [idOf(s), s.storeName + (s.isPrimary ? ' (primary)' : '')]) },
        { name: 'note', label: 'Note', placeholder: 'Optional' },
      ]}
      initial={{ storeId: '', note: '' }} submitLabel="Move products" onClose={() => setMoving(null)}
      onSubmit={async form => { const res = await productsApi.moveToStore(moving, form.storeId, form.note); setMoving(null); afterOperation(res.message); }} />}
  </>;
}
