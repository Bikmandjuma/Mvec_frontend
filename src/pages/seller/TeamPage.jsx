import { useState } from 'react';
import Icon from '../../components/Icon';
import SmartTable from '../../components/SmartTable';
import { staffApi } from '../../API/staff';
import { PageHead, Loading, StatusPill, FormModal, titleCase, useLoader, useNotice } from './shared';

const ROLES = [
  ['STORE_MANAGER', 'Store manager · products, orders, analytics'],
  ['ORDER_MANAGER', 'Order manager · orders'],
  ['CATALOG_MANAGER', 'Catalog manager · products'],
];

const ADD_FIELDS = [
  { name: 'name', label: 'Full name', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true, half: true },
  { name: 'phone', label: 'Phone', half: true, placeholder: '07xx xxx xxx' },
  { name: 'role', label: 'Role', type: 'select', options: ROLES, required: true },
  { name: 'password', label: 'Temporary password', type: 'password', required: true, minLength: 8, help: 'At least 8 characters. Share it securely; they can change it after signing in.' },
];

export default function TeamPage() {
  const { data, loading, error, reload } = useLoader(() => staffApi.getAll().then(r => r.staff || []));
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState('');
  const notice = useNotice();

  const act = async (row, fn, message) => {
    setBusyId(row._id);
    try { await fn(); notice.success(message); await reload(); }
    catch (err) { notice.fail(err); }
    finally { setBusyId(''); }
  };

  const columns = [
    { key: 'name', label: 'Member', render: r => <div><b>{r.name}</b><small className="tiny seller-block">{r.email}</small></div> },
    { key: 'role', label: 'Role', render: r => r.role === 'OWNER'
      ? <b>Owner</b>
      : <select className="inline-table-input" value={r.role} disabled={busyId === r._id}
          onChange={e => act(r, () => staffApi.update(r._id, { role: e.target.value }), 'Role updated.')}>
          {ROLES.map(([v]) => <option key={v} value={v}>{titleCase(v)}</option>)}
        </select> },
    { key: 'permissions', label: 'Access', render: r => <span className="tiny">{(r.permissions || []).map(titleCase).join(', ') || '—'}</span> },
    { key: 'status', label: 'Status', render: r => <StatusPill value={r.role === 'OWNER' ? 'OWNER' : r.status || (r.active ? 'ACTIVE' : 'SUSPENDED')} /> },
  ];

  const actions = r => r.role === 'OWNER' ? null : <span className="row-actions">
    <button type="button" disabled={busyId === r._id} title={r.active ? 'Suspend access' : 'Restore access'}
      onClick={() => act(r, () => staffApi.update(r._id, { active: !r.active }), r.active ? 'Access suspended.' : 'Access restored.')}>
      <Icon name={r.active ? 'eye' : 'check'} />
    </button>
    <button type="button" disabled={busyId === r._id} title="Remove member"
      onClick={() => window.confirm(`Remove ${r.name} from your team?`) && act(r, () => staffApi.remove(r._id), 'Team member removed.')}>
      <Icon name="trash" />
    </button>
  </span>;

  return <>
    <PageHead title="Team / Staff" desc="Give employees their own login with only the access their role needs."
      action={<button type="button" className="gradient-btn" onClick={() => setAdding(true)}><Icon name="plus" /> Add member</button>} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <div className="data-card">
      <SmartTable columns={columns} rows={data} rowKey={r => r._id} actions={actions} searchPlaceholder="Search team…" exportName="mvec-team" empty="No team members yet." />
    </div>}
    {adding && <FormModal title="Add team member" subtitle="This creates a separate staff login for your store." fields={ADD_FIELDS}
      initial={{ role: 'ORDER_MANAGER' }} submitLabel="Create account" onClose={() => setAdding(false)}
      onSubmit={async form => { await staffApi.add(form); setAdding(false); notice.success('Staff account created.'); reload(); }} />}
  </>;
}
