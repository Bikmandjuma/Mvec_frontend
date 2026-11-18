import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { returnsApi } from '../../API/returns';
import { extractErrorMessage } from '../../API/client';
import { money, formatDate } from '../../utils/format';
import ProductImage from '../ProductImage';

const TABS = [['', 'All'], ['REQUESTED', 'To answer'], ['APPROVED', 'Waiting for items'], ['ESCALATED', 'With Ikiguzi'], ['REFUNDED', 'Refunded'], ['REJECTED', 'Declined']];

/**
 * Returns for a seller (approve with instructions, decline, confirm the items
 * arrived, or refund without them) or for Ikiguzi (decide escalated ones).
 */
export default function ReturnsBoard({ admin = false }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState(admin ? 'ESCALATED' : 'REQUESTED');
  const key = ['returns', admin ? 'admin' : 'seller', tab];
  const { data: rows = [], isPending, error } = useQuery({ queryKey: key, queryFn: () => (admin ? returnsApi.forAdmin(tab) : returnsApi.forSeller(tab)) });
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const act = async (id, fn, ok) => {
    setBusy(id); setNotice(null);
    try { await fn(); setNotice({ ok: true, text: ok }); qc.invalidateQueries({ queryKey: ['returns'] }); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(''); }
  };
  const ask = (q) => window.prompt(q)?.trim();

  return <>
    <div className="dash-page-head"><div><span className="eyebrow">{admin ? 'Ikiguzi OPERATIONS' : 'ORDERS'}</span><h1>Returns</h1><p>{admin
      ? 'Returns the seller declined or didn\'t answer in time, and the buyer asked Ikiguzi about. Refunding takes the seller\'s share back from their balance.'
      : 'Answer each request within a few days, or Ikiguzi decides. When the items are back, confirm it and the buyer is refunded from your balance.'}</p></div></div>
    <div className="dash-toolbar"><div className="seg-tabs">{TABS.map(([v, l]) => <button key={v} type="button" className={tab === v ? 'active' : ''} onClick={() => setTab(v)}>{l}</button>)}</div></div>
    {notice && <div className={`form-alert ${notice.ok ? 'success' : 'error'}`}>{notice.text}</div>}
    {error && <div className="form-error">{extractErrorMessage(error)}</div>}
    {isPending && <div className="empty-state"><h3>Loading…</h3></div>}
    {!isPending && !rows.length && <div className="empty-state"><h3>Nothing here</h3><p>{tab === 'REQUESTED' ? 'No returns waiting for your answer.' : 'No returns in this list.'}</p></div>}
    {rows.map((r) => (
      <div key={r.id} className="data-card return-card">
        <div className="data-card-head"><div><h3>{r.returnNumber} · {r.statusLabel}</h3><span>{r.orderNumber ? `Order ${r.orderNumber} · ` : ''}{r.buyerName ? `${r.buyerName} · ` : ''}{formatDate(r.createdAt)} · refund {money(r.refundAmount)}</span></div>{!admin && <Link className="outline-btn compact-btn" to={`/vendor/orders/${r.order}`}>Order</Link>}</div>
        {r.items.map((i) => <div key={i.orderItemId} className="return-line"><ProductImage src={i.image} alt="" /><div><b>{i.quantity} × {i.name}</b>{i.variantLabel && <small className="variant-chip">{i.variantLabel}</small>}</div></div>)}
        <p><b>{r.reasonLabel}:</b> {r.description}</p>
        {r.photos?.length > 0 && <div className="return-photos">{r.photos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="return-photo"><ProductImage src={u} alt="Buyer's photo" /></a>)}</div>}
        {r.sellerNote && <p className="tiny"><b>Seller:</b> {r.sellerNote}</p>}
        {r.status === 'REQUESTED' && r.respondBy && !admin && <p className="tiny">Answer by {formatDate(r.respondBy)}, or Ikiguzi decides.</p>}
        <div className="row-actions">
          {!admin && r.status === 'REQUESTED' && <>
            <button type="button" className="gradient-btn compact-btn" disabled={!!busy} onClick={() => { const how = ask('How should the buyer send it back? (e.g. "Bring it to our shop in Remera, Mon–Sat 9–18")'); if (how !== undefined) act(r.id, () => returnsApi.approve(r.id, how), 'Approved. The buyer has your instructions.'); }}>Approve</button>
            <button type="button" className="outline-btn compact-btn" disabled={!!busy} onClick={() => { const why = ask('Why are you declining? The buyer sees this and can ask Ikiguzi.'); if (why) act(r.id, () => returnsApi.reject(r.id, why), 'Declined. The buyer was told why.'); }}>Decline</button>
          </>}
          {!admin && r.status === 'APPROVED' && <>
            <button type="button" className="gradient-btn compact-btn" disabled={!!busy} onClick={() => window.confirm(`Confirm the items are back? The buyer is refunded ${money(r.refundAmount)} from your balance.`) && act(r.id, () => returnsApi.received(r.id, window.confirm('Put them back in stock? (Cancel if they are damaged.)')), 'Refunded. The buyer has been told.')}>Items received: refund</button>
          </>}
          {!admin && ['REQUESTED', 'APPROVED'].includes(r.status) && <button type="button" className="outline-btn compact-btn" disabled={!!busy} onClick={() => window.confirm(`Refund ${money(r.refundAmount)} and let the buyer keep the items?`) && act(r.id, () => returnsApi.refundNow(r.id), 'Refunded. The buyer keeps the items.')}>Refund, keep the items</button>}
          {admin && ['ESCALATED', 'REQUESTED', 'APPROVED', 'REJECTED'].includes(r.status) && <>
            <button type="button" className="gradient-btn compact-btn" disabled={!!busy} onClick={() => { const n = ask(`Why refund ${money(r.refundAmount)}? Both sides see this.`); if (n) act(r.id, () => returnsApi.decide(r.id, 'REFUND', n), 'Refunded.'); }}>Refund the buyer</button>
            <button type="button" className="outline-btn compact-btn" disabled={!!busy} onClick={() => { const n = ask('Why no refund? Both sides see this.'); if (n) act(r.id, () => returnsApi.decide(r.id, 'REJECT', n), 'Closed without a refund.'); }}>No refund</button>
          </>}
        </div>
      </div>
    ))}
  </>;
}
