import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Storefront from '../../components/Storefront';
import { returnsApi } from '../../API/returns';
import { extractErrorMessage } from '../../API/client';
import { money, formatDate } from '../../utils/format';

/** The buyer's returns: where each one is, and what they can do next. */
export default function MyReturns() {
  const qc = useQueryClient();
  const { data: rows = [], isPending, error } = useQuery({ queryKey: ['returns', 'mine'], queryFn: returnsApi.mine });
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const act = async (key, fn, ok) => {
    setBusy(key); setNotice(null);
    try { await fn(); setNotice({ ok: true, text: ok }); qc.invalidateQueries({ queryKey: ['returns', 'mine'] }); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(''); }
  };
  return <Storefront><main className="account-page">
    <div className="dash-page-head"><div><span className="eyebrow">MY ACCOUNT</span><h1>My returns</h1><p>Start a return from a delivered order. You're refunded once the seller has the items back.</p></div></div>
    {notice && <div className={`form-alert ${notice.ok ? 'success' : 'error'}`}>{notice.text}</div>}
    {isPending && <div className="empty-state"><h3>Loading…</h3></div>}
    {error && <div className="form-error">{extractErrorMessage(error)}</div>}
    {!isPending && !rows.length && <div className="empty-state"><h3>No returns</h3><p>To return something, open the order in <Link to="/orders">My orders</Link>.</p></div>}
    {rows.map((r) => (
      <section key={r.id} className="data-card return-card">
        <div className="data-card-head"><div><h3>{r.returnNumber} · {r.statusLabel}</h3><span>{r.reasonLabel} · {formatDate(r.createdAt)} · refund {money(r.refundAmount)}</span></div><Link className="outline-btn compact-btn" to={`/orders/${r.order}`}>Order</Link></div>
        <p className="tiny">{r.items.map((i) => `${i.quantity} × ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ''}`).join(', ')}</p>
        {r.status === 'APPROVED' && <div className="form-alert"><b>How to send it back:</b> {r.sellerNote}</div>}
        {r.status === 'REJECTED' && <div className="form-alert error"><b>{r.adminNote ? 'Ikiguzi decided' : 'The seller said'}:</b> {r.adminNote || r.sellerNote}</div>}
        {r.status === 'REFUNDED' && <div className="form-alert success">{money(r.refundAmount)} refunded {formatDate(r.refundedAt)}.</div>}
        <div className="row-actions">
          {['REQUESTED', 'APPROVED'].includes(r.status) && <button type="button" className="outline-btn compact-btn" disabled={!!busy} onClick={() => window.confirm('Cancel this return and keep the items?') && act(r.id, () => returnsApi.cancel(r.id), 'Return cancelled.')}>Cancel return</button>}
          {['REQUESTED', 'APPROVED', 'REJECTED'].includes(r.status) && !r.adminNote && <button type="button" className="outline-btn compact-btn" disabled={!!busy} onClick={() => { const why = window.prompt('Tell Ikiguzi why you disagree or what is taking too long:'); if (why) act(r.id, () => returnsApi.escalate(r.id, why), 'Ikiguzi will review it and decide.'); }}>Ask Ikiguzi to decide</button>}
        </div>
      </section>
    ))}
  </main></Storefront>;
}
