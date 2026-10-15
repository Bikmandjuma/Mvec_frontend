// Team / Staff: employees get their own login into this store, limited to
// what their role (or custom access) allows. The server enforces the same
// permissions on every request and logs what staff change.
import { useMemo, useState } from 'react';
import Icon from '../../components/Icon';
import SmartTable from '../../components/SmartTable';
import { staffApi } from '../../API/staff';
import { STAFF_ROLE_LABEL } from '../../data/staffAccess';
import { PageHead, Loading, Metric, StatusPill, FormModal, dateDMY, useLoader, useNotice } from './shared';

const ROLE_HELP = {
  STORE_MANAGER: 'Runs the store day to day: products, orders, marketing, analytics, settings.',
  ORDER_MANAGER: 'Handles orders, customers and disputes.',
  CATALOG_MANAGER: 'Manages products, categories, inventory and stock purchases.',
  MARKETING_MANAGER: 'Runs promotions, ads, reviews and affiliates; sees analytics.',
  FINANCE_MANAGER: 'Handles payouts, the statement and the subscription; sees analytics.',
};

const ago = d => {
  if (!d) return 'Never';
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 5) return 'Online now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return m < 10080 ? `${Math.round(m / 1440)} days ago` : dateDMY(d);
};

export default function TeamPage() {
  const { data, loading, error, reload } = useLoader(() => staffApi.getAll());
  const [modal, setModal] = useState(null); // { kind: 'add'|'access'|'details'|'password', row }
  const [tab, setTab] = useState('MEMBERS');
  const [activityFor, setActivityFor] = useState('');
  const [busyId, setBusyId] = useState('');
  const notice = useNotice();
  const activity = useLoader(() => (tab === 'ACTIVITY' ? staffApi.activity({ staffId: activityFor || undefined, limit: 100 }) : Promise.resolve(null)), [tab, activityFor]);

  const members = data?.staff || [];
  const staff = members.filter(m => m.role !== 'OWNER');
  const permissions = data?.permissions || [];
  const roles = data?.roles || [];
  const viewer = data?.viewer || { owner: true };
  const isSelf = r => viewer.staffId && String(viewer.staffId) === String(r._id);
  // A team manager can only hand out access they have themselves.
  const grantable = key => viewer.owner || viewer.permissionsMap?.[key];
  const roleOptions = roles.filter(r => r.permissions.every(grantable)).map(r => [r.key, STAFF_ROLE_LABEL[r.key] || r.key]);
  const presetOf = key => roles.find(r => r.key === key)?.permissions || [];

  const act = async (row, fn, message) => {
    setBusyId(row._id);
    try { const res = await fn(); notice.success(res?.message || message); await reload(); }
    catch (err) { notice.fail(err); }
    finally { setBusyId(''); }
  };

  const stats = useMemo(() => ({
    active: staff.filter(m => m.active).length,
    suspended: staff.filter(m => !m.active).length,
    recent: staff.filter(m => m.lastActiveAt && Date.now() - new Date(m.lastActiveAt).getTime() < 7 * 86400000).length,
  }), [staff]);

  const columns = [
    { key: 'name', label: 'Member', render: r => <div><b>{r.name}</b>{isSelf(r) && <small className="tiny"> (you)</small>}<small className="tiny seller-block">{[r.email, r.phone].filter(Boolean).join(' · ')}</small></div> },
    { key: 'role', label: 'Role', render: r => r.role === 'OWNER' || isSelf(r)
      ? <b>{r.role === 'OWNER' ? 'Owner' : STAFF_ROLE_LABEL[r.role]}</b>
      : <select className="inline-table-input" value={r.role} disabled={busyId === r._id}
          onChange={e => act(r, () => staffApi.update(r._id, { role: e.target.value }), 'Role updated.')}>
          {(roleOptions.some(([k]) => k === r.role) ? roleOptions : [[r.role, STAFF_ROLE_LABEL[r.role]], ...roleOptions]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select> },
    { key: 'permissions', label: 'Access', render: r => r.role === 'OWNER'
      ? <span className="tiny">Everything</span>
      : <div className="team-access">{permissions.filter(p => r.permissionsMap?.[p.key] && p.key !== 'canViewDashboard').map(p => <span key={p.key} title={p.label}>{p.label.split(/[,&]/)[0].trim()}</span>)}{r.customized && <em>custom</em>}</div> },
    { key: 'lastActiveAt', label: 'Last active', render: r => r.role === 'OWNER' ? '—' : <span className={ago(r.lastActiveAt) === 'Online now' ? 'team-online' : 'tiny'}>{ago(r.lastActiveAt)}</span> },
    { key: 'status', label: 'Status', render: r => <StatusPill value={r.role === 'OWNER' ? 'OWNER' : r.status || (r.active ? 'ACTIVE' : 'SUSPENDED')} /> },
  ];

  const actions = r => (r.role === 'OWNER' || isSelf(r)) ? null : <span className="row-actions">
    <button type="button" disabled={busyId === r._id} title="Edit access" onClick={() => setModal({ kind: 'access', row: r })}><Icon name="shield" /></button>
    <button type="button" disabled={busyId === r._id} title="Edit details" onClick={() => setModal({ kind: 'details', row: r })}><Icon name="edit" /></button>
    <button type="button" disabled={busyId === r._id} title="Set a new password" onClick={() => setModal({ kind: 'password', row: r })}><Icon name="settings" /></button>
    <button type="button" disabled={busyId === r._id} title={r.active ? 'Suspend access' : 'Restore access'}
      onClick={() => (r.active ? window.confirm(`Suspend ${r.name}? They are signed out of the store immediately.`) : true) && act(r, () => staffApi.update(r._id, { active: !r.active }), r.active ? 'Access suspended.' : 'Access restored.')}>
      <Icon name={r.active ? 'eye' : 'check'} />
    </button>
    <button type="button" disabled={busyId === r._id} title="Remove member"
      onClick={() => window.confirm(`Remove ${r.name} from your team? Their login stops working; you can add them back later with the same email.`) && act(r, () => staffApi.remove(r._id), 'Team member removed.')}>
      <Icon name="trash" />
    </button>
  </span>;

  const accessField = { name: 'access', label: 'Access', type: 'checkboxes', options: permissions.filter(p => p.key !== 'canViewDashboard' && grantable(p.key)).map(p => [p.key, p.label]) };
  const toMap = list => Object.fromEntries(permissions.map(p => [p.key, p.key === 'canViewDashboard' || (list || []).includes(p.key)]));
  const row = modal?.row;

  return <>
    <PageHead title="Team / Staff" desc="Give employees their own login to this store with only the access they need. Every change they make is logged."
      action={<button type="button" className="gradient-btn" onClick={() => setModal({ kind: 'add' })} disabled={!roleOptions.length}><Icon name="plus" /> Add member</button>} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="Team members" value={staff.length} icon="users" sub="Not counting you" />
        <Metric label="Active" value={stats.active} icon="check" sub="Can sign in" />
        <Metric label="Suspended" value={stats.suspended} icon="shield" sub="Access paused" />
        <Metric label="Active this week" value={stats.recent} icon="eye" sub="Signed in during the last 7 days" />
      </div>
      <div className="data-card">
        <div className="seller-view-tabs" role="tablist" aria-label="Team">
          <button type="button" role="tab" aria-selected={tab === 'MEMBERS'} className={tab === 'MEMBERS' ? 'active' : ''} onClick={() => setTab('MEMBERS')}>Members <small>{members.length}</small></button>
          <button type="button" role="tab" aria-selected={tab === 'ACTIVITY'} className={tab === 'ACTIVITY' ? 'active' : ''} onClick={() => setTab('ACTIVITY')}>Activity</button>
        </div>
        {tab === 'MEMBERS' && <SmartTable columns={columns} rows={members} rowKey={r => r._id} actions={actions} searchPlaceholder="Search team…" exportName="mvec-team" empty="No team members yet." />}
        {tab === 'ACTIVITY' && <>
          <div className="smart-table-tools">
            <select className="table-filter-select" value={activityFor} onChange={e => setActivityFor(e.target.value)} aria-label="Team member">
              <option value="">All team members</option>
              {staff.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
          {activity.loading && <Loading />}
          {activity.error && <div className="form-error">{activity.error}</div>}
          {activity.data?.activity?.length === 0 && <p className="tiny">No changes by team members yet. Changes to products, orders, promotions, payouts and settings show up here.</p>}
          {(activity.data?.activity || []).map(a => <div className="activity-row" key={a.id}>
            <div><b>{a.action}</b><small>{a.name} · {a.path.replace(/^\/api/, '')}</small></div>
            <small className="tiny">{new Date(a.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</small>
          </div>)}
        </>}
      </div>
      <div className="verified-box"><b>How staff access works</b><p>Team members sign in with their own email and password and work inside your store. Menus they can't use are hidden, and the server refuses anything outside their access. Suspending or removing someone takes effect immediately. Only you can manage payouts unless you grant it.</p></div>
    </>}

    {modal?.kind === 'add' && <FormModal title="Add team member" subtitle="Creates a separate login for your store."
      fields={[
        { name: 'name', label: 'Full name', required: true },
        { name: 'email', label: 'Email (used to sign in)', type: 'email', required: true, half: true },
        { name: 'phone', label: 'Phone', half: true, placeholder: '07xx xxx xxx' },
        { name: 'role', label: 'Role', type: 'select', options: roleOptions, required: true },
        { ...accessField, help: 'Starts from the role; adjust if needed.' },
        { name: 'password', label: 'Temporary password', type: 'password', required: true, minLength: 8, help: 'At least 8 characters. Share it securely; they can change it from their profile.' },
      ]}
      initial={{ role: roleOptions.find(([k]) => k === 'ORDER_MANAGER')?.[0] || roleOptions[0]?.[0], access: presetOf('ORDER_MANAGER') }}
      onFieldChange={(name, value) => (name === 'role' ? { access: presetOf(value) } : null)}
      submitLabel="Create login" onClose={() => setModal(null)}
      onSubmit={async form => {
        const res = await staffApi.add({ name: form.name, email: form.email, phone: form.phone, role: form.role, password: form.password, permissions: toMap(form.access) });
        setModal(null); notice.success(`${res.message} ${form.email} can now sign in.`); reload();
      }} />}

    {modal?.kind === 'access' && <FormModal title={`Access for ${row.name}`} subtitle={`${STAFF_ROLE_LABEL[row.role]}: ${ROLE_HELP[row.role] || ''}`}
      fields={[{ ...accessField, help: 'Changes apply to their next action; they don\'t need to sign in again.' }]}
      initial={{ access: Object.keys(row.permissionsMap || {}).filter(k => row.permissionsMap[k]) }}
      submitLabel="Save access" onClose={() => setModal(null)}
      onSubmit={async form => { await staffApi.update(row._id, { permissions: toMap(form.access) }); setModal(null); notice.success('Access updated.'); reload(); }} />}

    {modal?.kind === 'details' && <FormModal title="Edit details" fields={[{ name: 'name', label: 'Full name', required: true }, { name: 'phone', label: 'Phone' }]}
      initial={{ name: row.name, phone: row.phone || '' }} submitLabel="Save" onClose={() => setModal(null)}
      onSubmit={async form => { await staffApi.update(row._id, { name: form.name, phone: form.phone }); setModal(null); notice.success('Details saved.'); reload(); }} />}

    {modal?.kind === 'password' && <FormModal title={`New password for ${row.name}`} subtitle="Use this if they forgot their password. Share it with them securely."
      fields={[{ name: 'password', label: 'New temporary password', type: 'password', required: true, minLength: 8 }]}
      initial={{}} submitLabel="Set password" onClose={() => setModal(null)}
      onSubmit={async form => { const res = await staffApi.resetPassword(row._id, form.password); setModal(null); notice.success(res.message); }} />}
  </>;
}
