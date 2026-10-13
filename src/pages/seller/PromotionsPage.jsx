import { useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import SmartTable from '../../components/SmartTable';
import { promotionsApi } from '../../API/promotions';
import { storesApi } from '../../API/stores';
import { PageHead, Loading, StatusPill, FormModal, money, dateDMY, toInputDate, useLoader, useNotice } from './shared';

const TYPES = [['PERCENT', 'Percentage off'], ['FIXED', 'Fixed amount off'], ['FREE_SHIPPING', 'Free shipping']];
const STATUSES = [['DRAFT', 'Draft'], ['SCHEDULED', 'Scheduled'], ['ACTIVE', 'Active'], ['PAUSED', 'Paused']];

const FIELDS = [
  { name: 'name', label: 'Promotion name', required: true, placeholder: 'e.g. Back to School' },
  { name: 'code', label: 'Coupon code', required: true, half: true, placeholder: 'SCHOOL15' },
  { name: 'type', label: 'Discount type', type: 'select', options: TYPES, half: true },
  { name: 'value', label: 'Discount value', type: 'number', half: true, help: 'Percent (0–100) or RWF amount. Ignored for free shipping.' },
  { name: 'minOrderAmount', label: 'Minimum order (RWF)', type: 'number', half: true },
  { name: 'startsAt', label: 'Starts', type: 'date', half: true },
  { name: 'endsAt', label: 'Ends', type: 'date', half: true },
  { name: 'usageLimit', label: 'Usage limit', type: 'number', half: true, placeholder: 'Unlimited' },
  { name: 'status', label: 'Status', type: 'select', options: STATUSES, half: true },
];

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
  useEffect(() => { storesApi.getMyStores().then(r => setStores(r.stores || [])).catch(() => {}); }, []);
  const storeField = { name: 'storeId', label: 'Store', type: 'select', options: stores.map(st => [st._id, st.storeName + (st.isPrimary ? ' (primary)' : '')]) };
  const storeColumn = { key: 'store', label: 'Store', render: r => stores.find(st => st._id === String(r.store))?.storeName || '—' };

  const run = async (fn, message) => {
    try { await fn(); notice.success(message); reload(); }
    catch (err) { notice.fail(err); }
  };

  const columns = [
    { key: 'name', label: 'Promotion', render: r => <b>{r.name}</b> },
    { key: 'code', label: 'Code', render: r => <code className="seller-code">{r.code}</code> },
    { key: 'discount', label: 'Discount' },
    { key: 'minOrderAmount', label: 'Min. order', render: r => r.minOrderAmount ? money(r.minOrderAmount) : '—' },
    { key: 'usedCount', label: 'Used', render: r => `${r.usedCount || 0}${r.usageLimit ? ` / ${r.usageLimit}` : ''}` },
    { key: 'endsAt', label: 'Ends', render: r => dateDMY(r.endsAt) },
    ...(stores.length > 1 ? [storeColumn] : []),
    { key: 'status', label: 'Status', render: r => <StatusPill value={r.status} /> },
  ];

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
    <PageHead title="Promotions" desc="Coupon codes for percentage, fixed-amount and free-shipping discounts."
      action={<button type="button" className="gradient-btn" onClick={() => setEditing('new')}><Icon name="plus" /> New promotion</button>} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <div className="data-card">
      <SmartTable columns={columns} rows={data} rowKey={r => r.id} actions={actions} searchPlaceholder="Search promotions…" exportName="mvec-promotions" empty="No promotions yet. Create one to reward your buyers." />
    </div>}
    {editing && <FormModal title={isNew ? 'New promotion' : 'Edit promotion'} fields={isNew && stores.length > 1 ? [storeField, ...FIELDS] : FIELDS}
      initial={isNew ? { type: 'PERCENT', status: 'DRAFT', value: 10, storeId: stores.find(st => st.isPrimary)?._id || '' } : { ...editing, startsAt: toInputDate(editing.startsAt), endsAt: toInputDate(editing.endsAt), usageLimit: editing.usageLimit ?? '' }}
      submitLabel={isNew ? 'Create promotion' : 'Save changes'} onClose={() => setEditing(null)}
      onSubmit={async form => {
        if (isNew) await promotionsApi.create({ ...toPayload(form), storeId: form.storeId || undefined });
        else await promotionsApi.update(editing.id, toPayload(form));
        setEditing(null);
        notice.success(isNew ? 'Promotion created.' : 'Promotion saved.');
        reload();
      }} />}
  </>;
}
