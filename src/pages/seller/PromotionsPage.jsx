import { useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import SmartTable from '../../components/SmartTable';
import { promotionsApi } from '../../API/promotions';
import { storesApi } from '../../API/stores';
import { productsApi } from '../../API/products';
import { PageHead, Loading, Metric, StatusPill, FormModal, money, dateDMY, toInputDate, useLoader, useNotice } from './shared';

const TYPES = [['PERCENT', 'Percentage off'], ['FIXED', 'Fixed amount off'], ['FREE_SHIPPING', 'Free shipping']];
const STATUSES = [['DRAFT', 'Draft'], ['SCHEDULED', 'Scheduled'], ['ACTIVE', 'Active'], ['PAUSED', 'Paused']];

const FIELDS = [
  { name: 'name', label: 'Promotion name', required: true, placeholder: 'e.g. Back to School' },
  { name: 'code', label: 'Coupon code', required: true, half: true, placeholder: 'SCHOOL15' },
  { name: 'type', label: 'Discount type', type: 'select', options: TYPES, half: true },
  { name: 'value', label: 'Discount value', type: 'number', half: true, help: 'Percent (1–100) or RWF amount. Ignored for free shipping.' },
  { name: 'minOrderAmount', label: 'Minimum spend on your items (RWF)', type: 'number', half: true },
  { name: 'startsAt', label: 'Starts', type: 'date', half: true },
  { name: 'endsAt', label: 'Ends', type: 'date', half: true },
  { name: 'usageLimit', label: 'Usage limit', type: 'number', half: true, placeholder: 'Unlimited' },
  { name: 'status', label: 'Status', type: 'select', options: STATUSES, half: true },
];

const LIVE_LABEL = { ACTIVE: 'Live', SCHEDULED: 'Scheduled', EXPIRED: 'Expired', USED_UP: 'Used up', PAUSED: 'Paused', DRAFT: 'Draft', CANCELLED: 'Cancelled' };
const PROMO_TABS = [['ALL', 'All'], ['ACTIVE', 'Live'], ['SCHEDULED', 'Scheduled'], ['DRAFT', 'Drafts'], ['PAUSED', 'Paused'], ['ENDED', 'Ended']];
const inTab = (r, tab) => tab === 'ALL' || (tab === 'ENDED' ? ['EXPIRED', 'USED_UP', 'CANCELLED'].includes(r.liveStatus) : r.liveStatus === tab);

const toPayload = f => ({
  name: f.name,
  code: f.code,
  type: f.type,
  value: f.type === 'FREE_SHIPPING' ? 0 : Number(f.value || 0),
  minOrderAmount: Number(f.minOrderAmount || 0),
  usageLimit: f.usageLimit === '' || f.usageLimit == null ? null : Number(f.usageLimit),
  startsAt: f.startsAt || null,
  endsAt: f.endsAt || null,
  status: f.status,
});

export default function PromotionsPage() {
  const { data, loading, error, reload } = useLoader(() => promotionsApi.getAll().then(r => r.data || []));
  const [editing, setEditing] = useState(null);
  const notice = useNotice();
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState('ALL');
  useEffect(() => {
    storesApi.getMyStores().then(r => setStores(r.stores || [])).catch(() => {});
    productsApi.getVendorProducts().then(r => setProducts(r.products || [])).catch(() => {});
  }, []);
  const productField = { name: 'product', label: 'Applies to', type: 'select', options: [['', 'All my products'], ...products.map(p => [p.id || p._id, p.name])] };
  const storeField = { name: 'storeId', label: 'Store', type: 'select', options: stores.map(st => [st._id, st.storeName + (st.isPrimary ? ' (primary)' : '')]) };
  const storeColumn = { key: 'store', label: 'Store', render: r => stores.find(st => st._id === String(r.store))?.storeName || '—' };

  const run = async (fn, message) => {
    try { await fn(); notice.success(message); reload(); }
    catch (err) { notice.fail(err); }
  };

  const columns = [
    { key: 'name', label: 'Promotion', render: r => <b>{r.name}</b> },
    { key: 'code', label: 'Code', render: r => <button type="button" className="seller-code" title="Copy code" onClick={() => { navigator.clipboard?.writeText(r.code); notice.success(`${r.code} copied.`); }}>{r.code}</button> },
    { key: 'discount', label: 'Discount', render: r => <div>{r.discount}<small className="tiny seller-block">{r.minOrderAmount ? `Min. ${money(r.minOrderAmount)}` : 'No minimum'}{r.product ? ` · ${products.find(p => String(p.id || p._id) === String(r.product))?.name || 'one product'}` : ''}</small></div> },
    { key: 'usedCount', label: 'Used', render: r => `${r.usedCount || 0}${r.usageLimit ? ` / ${r.usageLimit}` : ''}` },
    { key: 'sales', label: 'Results', render: r => r.stats?.orders ? <div>{money(r.stats.sales)}<small className="tiny seller-block">{r.stats.orders} order{r.stats.orders === 1 ? '' : 's'} · {money(r.stats.discountGiven)} discount</small></div> : <span className="tiny">No orders yet</span> },
    { key: 'endsAt', label: 'Runs', render: r => <span>{r.startsAt ? dateDMY(r.startsAt) : 'Now'} → {r.endsAt ? dateDMY(r.endsAt) : 'no end'}</span> },
    ...(stores.length > 1 ? [storeColumn] : []),
    { key: 'status', label: 'Status', render: r => <StatusPill value={LIVE_LABEL[r.liveStatus] || r.liveStatus || r.status} /> },
  ];

  const rows = data || [];
  const shown = rows.filter(r => inTab(r, tab));
  const totals = rows.reduce((t, r) => ({ orders: t.orders + (r.stats?.orders || 0), sales: t.sales + (r.stats?.sales || 0), discount: t.discount + (r.stats?.discountGiven || 0) }), { orders: 0, sales: 0, discount: 0 });

  const actions = r => <span className="row-actions">
    <button type="button" title="Edit" onClick={() => setEditing(r)}><Icon name="edit" /></button>
    {['ACTIVE', 'PAUSED'].includes(r.status) && <button type="button" title={r.status === 'ACTIVE' ? 'Pause' : 'Activate'}
      onClick={() => run(() => promotionsApi.update(r.id, { status: r.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }), 'Promotion updated.')}>
      <Icon name={r.status === 'ACTIVE' ? 'eye' : 'check'} />
    </button>}
    <button type="button" title="Delete" onClick={() => window.confirm(`Delete promotion ${r.code}?`) && run(() => promotionsApi.remove(r.id), 'Promotion deleted.')}><Icon name="trash" /></button>
  </span>;

  const isNew = editing === 'new';
  return <>
    <PageHead title="Promotions" desc="Coupon codes buyers enter at checkout. Discounts apply only to your items and come out of your earnings for that order."
      action={<button type="button" className="gradient-btn" onClick={() => setEditing('new')}><Icon name="plus" /> New promotion</button>} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="Live codes" value={rows.filter(r => r.liveStatus === 'ACTIVE').length} icon="tag" sub={`${rows.filter(r => r.liveStatus === 'SCHEDULED').length} scheduled`} />
        <Metric label="Orders with a code" value={totals.orders} icon="cart" sub="Excluding cancelled orders" />
        <Metric label="Sales from codes" value={money(totals.sales)} icon="chart" sub="Your items, after discount" />
        <Metric label="Discount given" value={money(totals.discount)} icon="wallet" sub="Paid from your earnings" />
      </div>
      <div className="data-card">
        <div className="seller-view-tabs" role="tablist" aria-label="Promotion status">
          {PROMO_TABS.map(([k, label]) => <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label} <small>{rows.filter(r => inTab(r, k)).length}</small></button>)}
        </div>
        <SmartTable columns={columns} rows={shown} rowKey={r => r.id} actions={actions} searchPlaceholder="Search promotions…" exportName="mvec-promotions" empty="No promotions here. Create a code and share it with your buyers." />
      </div>
    </>}
    {editing && <FormModal title={isNew ? 'New promotion' : 'Edit promotion'} fields={isNew ? [...(stores.length > 1 ? [storeField] : []), productField, ...FIELDS] : FIELDS}
      initial={isNew ? { type: 'PERCENT', status: 'DRAFT', value: 10, storeId: stores.find(st => st.isPrimary)?._id || '' } : { ...editing, startsAt: toInputDate(editing.startsAt), endsAt: toInputDate(editing.endsAt), usageLimit: editing.usageLimit ?? '' }}
      submitLabel={isNew ? 'Create promotion' : 'Save changes'} onClose={() => setEditing(null)}
      onSubmit={async form => {
        if (isNew) await promotionsApi.create({ ...toPayload(form), storeId: form.storeId || undefined, product: form.product || undefined });
        else await promotionsApi.update(editing.id, toPayload(form));
        setEditing(null);
        notice.success(isNew ? 'Promotion created.' : 'Promotion saved.');
        reload();
      }} />}
  </>;
}
