import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { client, extractErrorMessage } from '../API/client';
import { money, formatDate } from '../utils/format';

// Money MVEC sends out: affiliate withdrawals that need approval, and every
// automatic refund / withdrawal transfer with its status and a retry button.
const METHOD = { MTN_MOMO: 'MTN MoMo', AIRTEL_MONEY: 'Airtel Money', BANK_TRANSFER: 'Bank transfer' };
const TRANSFER_STATUS = { QUEUED: ['Queued', 'pending'], SENT: ['Waiting for provider', 'pending'], SUCCESS: ['Sent', 'active'], FAILED: ['Failed', 'failed'] };

function Notice({ notice }) {
  if (!notice) return null;
  return <div className={`form-alert ${notice.ok ? 'success' : 'error'}`} role="status">{notice.text}</div>;
}

export default function AdminTransfers() {
  const [payouts, setPayouts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [filter, setFilter] = useState('FAILED');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [bankRef, setBankRef] = useState({});

  const load = () => {
    setLoading(true);
    Promise.all([
      client.get('/affiliates/admin/payouts').then((r) => r.data.data || []),
      client.get('/admin/disbursements', { params: filter ? { status: filter } : {} }).then((r) => r.data.data || []),
    ])
      .then(([p, t]) => { setPayouts(p.filter((x) => ['PENDING', 'APPROVED', 'PROCESSING'].includes(x.status))); setTransfers(t); })
      .catch((err) => setNotice({ ok: false, text: extractErrorMessage(err) }))
      .finally(() => setLoading(false));
  };
  useEffect(load, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const processPayout = async (p, status) => {
    if (status === 'REJECTED' && !window.confirm('Reject this withdrawal? The amount returns to the affiliate\'s balance.')) return;
    if (status === 'COMPLETED' && !bankRef[p.id]) { setNotice({ ok: false, text: 'Enter the bank transfer reference first.' }); return; }
    setBusy(p.id);
    setNotice(null);
    try {
      await client.post(`/affiliates/payouts/${p.id}/process`, {
        status,
        transactionReference: bankRef[p.id],
        rejectionReason: status === 'REJECTED' ? 'Rejected by MVEC' : undefined,
      });
      setNotice({ ok: true, text: status === 'REJECTED' ? 'Withdrawal rejected.' : status === 'APPROVED' ? 'Approved and sent to mobile money.' : 'Marked as paid.' });
      load();
    } catch (err) {
      setNotice({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setBusy('');
    }
  };

  const retry = async (t) => {
    setBusy(t._id);
    setNotice(null);
    try {
      const res = await client.post(`/admin/disbursements/${t._id}/retry`);
      setNotice({ ok: true, text: res.data.message });
      load();
    } catch (err) {
      setNotice({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setBusy('');
    }
  };

  return <DashboardLayout admin>
    <div className="dash-page-head"><div><span className="eyebrow">ADMIN · MONEY OUT</span><h1>Refunds &amp; withdrawals</h1><p>Refunds and small affiliate withdrawals are sent automatically. Approve larger withdrawals here and retry any transfer that failed.</p></div></div>
    <Notice notice={notice} />

    <div className="data-card">
      <div className="data-card-head"><div><h3>Affiliate withdrawals waiting</h3><span>{payouts.length} request{payouts.length === 1 ? '' : 's'}</span></div><button type="button" className="outline-btn" onClick={load}>Refresh</button></div>
      {loading ? <p className="tiny">Loading…</p> : payouts.length === 0 ? <div className="empty-state"><h3>Nothing to approve</h3></div> : (
        <div className="orders-list">
          {payouts.map((p) => (
            <div className="order-row" key={p.id}>
              <div className="order-row-main">
                <b>{p.affiliate?.Fullname || 'Affiliate'}</b>
                <small>{METHOD[p.paymentMethod] || p.paymentMethod} · {p.phoneNumber || [p.bankName, p.accountNumber].filter(Boolean).join(' ')}</small>
                <small>Requested {formatDate(p.createdAt)} · {p.payoutNumber}</small>
              </div>
              <div className="order-row-meta"><strong>{money(p.amount)}</strong><span className="status pending">{p.status === 'PROCESSING' ? 'Sending' : 'Waiting'}</span></div>
              <div className="order-row-actions">
                {p.status === 'PENDING' && p.paymentMethod !== 'BANK_TRANSFER' && <button type="button" className="gradient-btn" disabled={busy === p.id} onClick={() => processPayout(p, 'APPROVED')}>Approve &amp; send</button>}
                {p.status === 'PENDING' && p.paymentMethod === 'BANK_TRANSFER' && <>
                  <input className="inline-table-input" placeholder="Bank reference" aria-label="Bank transfer reference" value={bankRef[p.id] || ''} onChange={(e) => setBankRef({ ...bankRef, [p.id]: e.target.value })} />
                  <button type="button" className="gradient-btn" disabled={busy === p.id} onClick={() => processPayout(p, 'COMPLETED')}>Mark paid</button>
                </>}
                {p.status === 'PENDING' && <button type="button" className="outline-btn" disabled={busy === p.id} onClick={() => processPayout(p, 'REJECTED')}>Reject</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    <div className="data-card">
      <div className="data-card-head"><div><h3>Transfers</h3><span>Refunds and withdrawals sent to mobile money</span></div>
        <select className="inline-table-input" aria-label="Show transfers" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="FAILED">Failed</option><option value="SENT">Waiting for provider</option><option value="SUCCESS">Sent</option><option value="">All</option>
        </select>
      </div>
      {loading ? <p className="tiny">Loading…</p> : transfers.length === 0 ? <div className="empty-state"><h3>No transfers here</h3></div> : (
        <div className="orders-list">
          {transfers.map((t) => {
            const [label, tone] = TRANSFER_STATUS[t.status] || [t.status, ''];
            return (
              <div className="order-row" key={t._id}>
                <div className="order-row-main">
                  <b>{t.kind === 'REFUND' ? `Refund · ${t.order?.orderNumber || ''}` : 'Affiliate withdrawal'}</b>
                  <small>{t.recipient?.Fullname || ''} · +{String(t.phone).replace(/^\+/, '')}</small>
                  {t.lastError && <small className="danger-text">{t.lastError}</small>}
                </div>
                <div className="order-row-meta"><strong>{money(t.amount)}</strong><span className={`status ${tone}`}>{label}</span><small>{t.attempts} attempt{t.attempts === 1 ? '' : 's'} · {formatDate(t.updatedAt)}</small></div>
                <div className="order-row-actions">{t.status === 'FAILED' && <button type="button" className="outline-btn" disabled={busy === t._id} onClick={() => retry(t)}>Retry now</button>}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </DashboardLayout>;
}
