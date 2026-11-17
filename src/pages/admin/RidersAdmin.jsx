// Super admin: approve the riders who signed up, and reject or suspend them
// with a reason the rider sees (by text message too).
import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import SmartTable from '../../components/SmartTable';
import { ridersAdminApi } from '../../API/rider';
import { PageHead, Loading, StatusPill, useNotice } from '../seller/shared';
import { useLoader } from '../../lib/useLoader';

const TABS = [['PENDING', 'To review'], ['APPROVED', 'Approved'], ['SUSPENDED', 'Suspended'], ['REJECTED', 'Rejected']];
const VEHICLE = { MOTORBIKE: 'Motorbike', BICYCLE: 'Bicycle', CAR: 'Car', ON_FOOT: 'On foot' };

export default function RidersAdmin() {
  const [tab, setTab] = useState('PENDING');
  const { data, loading, error, reload } = useLoader(['admin', 'riders', tab], () => ridersAdminApi.list(tab).then(r => r.riders));
  const [busy, setBusy] = useState('');
  const notice = useNotice();

  const act = async (rider, status) => {
    let note;
    if (status !== 'APPROVED') {
      note = window.prompt(`Why ${status === 'REJECTED' ? 'reject' : 'suspend'} ${rider.name}? They will see this.`);
      if (!note || !note.trim()) return;
    }
    setBusy(rider.id);
    try { await ridersAdminApi.review(rider.id, status, note); notice.success(`${rider.name} ${status.toLowerCase()}.`); reload(); }
    catch (err) { notice.fail(err); }
    finally { setBusy(''); }
  };

  const columns = [
    { key: 'name', label: 'Rider', render: r => <div><b>{r.name}</b><small className="tiny seller-block">{r.phone}</small></div> },
    { key: 'vehicleType', label: 'Vehicle', render: r => `${VEHICLE[r.vehicleType] || r.vehicleType}${r.plateNumber ? ` · ${r.plateNumber}` : ''}` },
    { key: 'isOnline', label: 'Now', render: r => (r.isOnline ? 'Online' : 'Offline') },
    { key: 'status', label: 'Status', render: r => <StatusPill value={r.status} /> },
  ];
  const actions = r => <span className="row-actions">
    {r.status !== 'APPROVED' && <button type="button" className="table-action-btn primary" disabled={busy === r.id} onClick={() => act(r, 'APPROVED')}>Approve</button>}
    {r.status === 'PENDING' && <button type="button" className="table-action-btn" disabled={busy === r.id} onClick={() => act(r, 'REJECTED')}>Reject</button>}
    {r.status === 'APPROVED' && <button type="button" className="table-action-btn" disabled={busy === r.id} onClick={() => act(r, 'SUSPENDED')}>Suspend</button>}
  </span>;

  return <DashboardLayout admin>
    <PageHead eyebrow="PEOPLE" title="Riders" desc="Riders sign up in the Ikiguzi app. Approve them before they can take deliveries." />
    {notice.banner}
    <div className="data-card">
      <div className="seller-view-tabs" role="tablist" aria-label="Rider status">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {loading ? <Loading /> : error ? <div className="form-error">{error}</div>
        : <SmartTable columns={columns} rows={data || []} rowKey={r => r.id} actions={actions} searchPlaceholder="Search riders…" empty="No riders here." exportName={`ikiguzi-riders-${tab.toLowerCase()}`} />}
    </div>
  </DashboardLayout>;
}
