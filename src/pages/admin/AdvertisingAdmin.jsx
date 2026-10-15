// Super admin: review seller ad campaigns. Approving puts the product in the
// sponsored slots; rejecting (with a reason) and ending return the unspent
// budget to the seller's balance automatically.
import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import SmartTable from '../../components/SmartTable';
import { adsAdminApi } from '../../API/vendorServices';
import { PageHead, Loading, Metric, StatusPill, money, useLoader, useNotice } from '../seller/shared';

const TABS = [['PENDING', 'To review'], ['ACTIVE', 'Live'], ['PAUSED', 'Paused'], ['COMPLETED', 'Ended'], ['REJECTED', 'Rejected'], ['ALL', 'All']];

export default function AdvertisingAdmin() {
  const { data, loading, error, reload } = useLoader(() => adsAdminApi.list({ limit: 200 }).then(r => r.data || []));
  const [tab, setTab] = useState('PENDING');
  const [busy, setBusy] = useState('');
  const notice = useNotice();

  const act = async (ad, status, confirmText) => {
    let reason;
    if (status === 'REJECTED') {
      reason = window.prompt(`Why reject the campaign for ${ad.product}? The seller sees this and gets ${money(ad.remaining)} back.`);
      if (!reason || !reason.trim()) return;
    } else if (confirmText && !window.confirm(confirmText)) return;
    setBusy(ad.id);
    try { const res = await adsAdminApi.setStatus(ad.id, status, reason); notice.success(res.message); reload(); }
    catch (err) { notice.fail(err); }
    finally { setBusy(''); }
  };

  const ads = data || [];
  const count = k => (k === 'ALL' ? ads.length : ads.filter(a => a.statusKey === k).length);
  const rows = tab === 'ALL' ? ads : ads.filter(a => a.statusKey === tab);
  const sum = (list, f) => list.reduce((t, a) => t + Number(a[f] || 0), 0);
  const live = ads.filter(a => a.statusKey === 'ACTIVE');

  const columns = [
    { key: 'product', label: 'Campaign', render: r => <div><b>{r.product}</b><small className="tiny seller-block">{r.vendor} · {r.id}</small></div> },
    { key: 'placement', label: 'Placement' },
    { key: 'period', label: 'Runs', render: r => `${r.startDate} → ${r.endDate}` },
    { key: 'budget', label: 'Budget', render: r => <div>{money(r.budget)}<small className="tiny seller-block">{money(r.spent)} spent · {money(r.remaining)} left</small></div> },
    { key: 'clicks', label: 'Performance', render: r => <span>{Number(r.impressions || 0).toLocaleString()} views · {Number(r.clicks || 0).toLocaleString()} clicks ({r.ctr})</span> },
    { key: 'status', label: 'Status', render: r => <div><StatusPill value={r.statusKey === 'PENDING' ? 'IN_REVIEW' : r.statusKey} />{r.rejectionReason && <small className="tiny seller-block">{r.rejectionReason}</small>}</div> },
  ];
  const actions = r => <span className="row-actions">
    {r.statusKey === 'PENDING' && <>
      <button type="button" className="table-action-btn primary" disabled={busy === r.id} onClick={() => act(r, 'ACTIVE', `Approve and publish the campaign for ${r.product}?`)}>Approve</button>
      <button type="button" className="table-action-btn" disabled={busy === r.id} onClick={() => act(r, 'REJECTED')}>Reject</button>
    </>}
    {r.statusKey === 'ACTIVE' && <button type="button" className="table-action-btn" disabled={busy === r.id} onClick={() => act(r, 'PAUSED')}>Pause</button>}
    {r.statusKey === 'PAUSED' && <button type="button" className="table-action-btn" disabled={busy === r.id} onClick={() => act(r, 'ACTIVE')}>Resume</button>}
    {['ACTIVE', 'PAUSED'].includes(r.statusKey) && <button type="button" className="table-action-btn" disabled={busy === r.id} onClick={() => act(r, 'COMPLETED', `End this campaign? ${money(r.remaining)} unspent returns to the seller.`)}>End</button>}
  </span>;

  return <DashboardLayout admin>
    <PageHead eyebrow="ADMIN CONTROL" title="Advertising" desc={`Review seller campaigns. Budgets are prepaid from seller balances; each click costs ${money(ads[0]?.costPerClick || 100)}.`} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="To review" value={count('PENDING')} icon="bell" sub={money(sum(ads.filter(a => a.statusKey === 'PENDING'), 'budget')) + ' in budgets'} />
        <Metric label="Live campaigns" value={live.length} icon="tag" sub={`${money(sum(live, 'remaining'))} budget left`} />
        <Metric label="Ad revenue" value={money(sum(ads, 'spent'))} icon="wallet" sub={`${sum(ads, 'clicks').toLocaleString()} paid clicks`} />
        <Metric label="Views" value={sum(ads, 'impressions').toLocaleString()} icon="eye" sub="All campaigns" />
      </div>
      <div className="data-card">
        <div className="seller-view-tabs" role="tablist" aria-label="Campaign status">
          {TABS.map(([k, label]) => <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label} <small>{count(k)}</small></button>)}
        </div>
        <SmartTable columns={columns} rows={rows} rowKey={r => r.id} actions={actions} searchPlaceholder="Search campaigns or sellers…" exportName="mvec-ad-campaigns" empty="No campaigns here." />
      </div>
    </>}
  </DashboardLayout>;
}
