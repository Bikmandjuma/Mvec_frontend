// Super admin: review seller withdrawal requests. Approve sends the money
// (automatically when PAYOUT_AUTO_DISBURSE is on, otherwise mark it paid with
// the transfer reference); reject returns the amount to the seller's balance.
import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { vendorPayoutsAdminApi } from '../../API/payouts';
import { PageHead, Loading, Metric, StatusPill, money, dateDMY, useLoader, useNotice } from '../seller/shared';

const TABS = [['PENDING', 'To review'], ['PROCESSING', 'Processing'], ['PAID', 'Paid'], ['REJECTED', 'Rejected'], ['CANCELLED', 'Cancelled'], ['', 'All']];

export default function VendorPayoutsAdmin() {
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useLoader(() => vendorPayoutsAdminApi.list({ status: status || undefined, page, limit: 20 }), [status, page]);
  const [busy, setBusy] = useState('');
  const notice = useNotice();

  const act = async (p, fn, done) => {
    setBusy(p._id);
    try { const res = await fn(); notice.success(res.message || done); reload(); }
    catch (err) { notice.fail(err); }
    finally { setBusy(''); }
  };
  const approve = p => {
    const auto = data?.autoDisburse;
    if (!window.confirm(auto ? `Send ${money(p.amount)} to ${p.payoutDetails?.accountNumber} now?` : `Approve ${p.payoutNumber}? Send ${money(p.amount)} to ${p.payoutDetails?.accountNumber}, then mark it paid with the transfer reference.`)) return;
    act(p, () => vendorPayoutsAdminApi.approve(p._id), 'Payout approved.');
  };
  const markPaid = p => {
    const ref = window.prompt(`Transfer reference for ${money(p.amount)} sent to ${p.payoutDetails?.accountNumber}:`);
    if (!ref || !ref.trim()) return;
    act(p, () => vendorPayoutsAdminApi.markPaid(p._id, ref.trim()), 'Payout marked as paid.');
  };
  const reject = p => {
    const reason = window.prompt(`Why reject ${p.payoutNumber}? The seller sees this and the amount returns to their balance.`);
    if (!reason || !reason.trim()) return;
    act(p, () => vendorPayoutsAdminApi.reject(p._id, reason.trim()), 'Payout rejected.');
  };

  const totals = data?.totals || {};
  const rows = data?.data || [];
  const pages = data?.meta?.pages || 1;
  const vendorName = p => p.vendor?.companyName || p.vendor?.Fullname || p.vendor?.fullName || p.vendor?.email || 'Seller';

  return <DashboardLayout admin>
    <PageHead eyebrow="ADMIN CONTROL" title="Seller payouts" desc={data?.autoDisburse ? 'Approving sends the money automatically through mobile money.' : 'Approve, send the money by mobile money, then mark it paid with the transfer reference.'} />
    {notice.banner}
    <div className="metric-grid">
      <Metric label="To review" value={money(totals.PENDING?.amount)} icon="bell" sub={`${totals.PENDING?.count || 0} requests`} />
      <Metric label="Processing" value={money(totals.PROCESSING?.amount)} icon="wallet" sub={`${totals.PROCESSING?.count || 0} requests`} />
      <Metric label="Paid" value={money(totals.PAID?.amount)} icon="chart" sub={`${totals.PAID?.count || 0} payouts`} />
      <Metric label="Rejected" value={money(totals.REJECTED?.amount)} icon="shield" sub={`${totals.REJECTED?.count || 0} requests`} />
    </div>
    <div className="data-card">
      <div className="seller-view-tabs" role="tablist" aria-label="Payout status">
        {TABS.map(([k, label]) => <button type="button" role="tab" key={k || 'all'} aria-selected={status === k} className={status === k ? 'active' : ''} onClick={() => { setStatus(k); setPage(1); }}>
          {label} {k && totals[k]?.count ? <small>{totals[k].count}</small> : null}
        </button>)}
      </div>
      {loading && !data && <Loading />}
      {error && <div className="form-error">{error}</div>}
      {data && rows.length === 0 && <p className="tiny">Nothing here.</p>}
      {rows.length > 0 && <div className="table-scroll"><table className="smart-table">
        <thead><tr><th>Payout</th><th>Seller</th><th>Send to</th><th>Amount</th><th>Status</th><th></th></tr></thead>
        <tbody>{rows.map(p => <tr key={p._id}>
          <td><b>{p.payoutNumber}</b><small className="tiny seller-block">{dateDMY(p.createdAt)}</small></td>
          <td>{vendorName(p)}<small className="tiny seller-block">Balance left {money(p.sellerAvailableBalance)}</small></td>
          <td>{p.payoutDetails?.accountName}<small className="tiny seller-block">{[p.payoutDetails?.bankName, p.payoutDetails?.accountNumber].filter(Boolean).join(' · ')}</small></td>
          <td><b>{money(p.amount)}</b></td>
          <td><StatusPill value={p.status} />
            {p.transferReference && <small className="tiny seller-block">Ref {p.transferReference}</small>}
            {p.rejectionReason && <small className="tiny seller-block">{p.rejectionReason}</small>}
          </td>
          <td className="row-actions">
            {p.status === 'PENDING' && <>
              <button type="button" className="table-action-btn primary" disabled={busy === p._id} onClick={() => approve(p)}>Approve</button>
              <button type="button" className="table-action-btn seller-negative" disabled={busy === p._id} onClick={() => reject(p)}>Reject</button>
            </>}
            {p.status === 'PROCESSING' && <>
              <button type="button" className="table-action-btn" disabled={busy === p._id} onClick={() => markPaid(p)}>Mark paid</button>
              <button type="button" className="table-action-btn seller-negative" disabled={busy === p._id} onClick={() => reject(p)}>Reject</button>
            </>}
          </td>
        </tr>)}</tbody>
      </table></div>}
      {pages > 1 && <div className="smart-table-tools">
        <button type="button" className="table-action-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span className="tiny">Page {page} of {pages}</span>
        <button type="button" className="table-action-btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>}
    </div>
  </DashboardLayout>;
}
