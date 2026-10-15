// Seller Finance: payouts (withdraw the released balance) and the statement of
// sales, payouts and charges. Both read the server-side ledger (/payouts/*).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SmartTable from '../../components/SmartTable';
import { payoutsApi } from '../../API/payouts';
import { PageHead, Loading, Metric, StatusPill, money, dateDMY, titleCase, toInputDate, useLoader, useNotice } from './shared';

export const momoProvider = n => {
  const d = String(n || '').replace(/\D/g, '').replace(/^250/, '0');
  return /^07[89]/.test(d) ? 'MTN MoMo' : /^07[23]/.test(d) ? 'Airtel Money' : '';
};

const PAYOUT_TABS = [['ALL', 'All'], ['OPEN', 'In progress', ['PENDING', 'PROCESSING']], ['PAID', 'Paid', ['PAID']], ['CLOSED', 'Rejected / cancelled', ['REJECTED', 'CANCELLED', 'FAILED']]];
const PAYOUT_STEP = {
  PENDING: 'Waiting for MVEC review',
  PROCESSING: 'Being sent to your mobile money',
  PAID: 'Sent',
  REJECTED: 'Rejected — the amount is back in your balance',
  CANCELLED: 'Cancelled — the amount is back in your balance',
  FAILED: 'Failed — the amount is back in your balance',
};

export function PayoutsPage() {
  const { data, loading, error, reload } = useLoader(() => Promise.all([payoutsApi.getBalance(), payoutsApi.getHistory()])
    .then(([b, h]) => ({ summary: b.summary || {}, commissionRate: b.commissionRate, payouts: h.payouts || [] })));
  const notice = useNotice();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState('ALL');

  const s = data?.summary || {};
  const min = s.minimumPayout || 1000;
  // Prefill the account used last time.
  const last = data?.payouts.find(p => p.payoutDetails?.accountNumber)?.payoutDetails;
  const f = form || { amount: '', accountName: last?.accountName || '', accountNumber: last?.accountNumber || '' };
  const set = (k, v) => setForm({ ...f, [k]: v });

  const amount = Number(f.amount);
  const problem = !f.amount ? '' :
    !Number.isInteger(amount) ? 'Use a whole amount in RWF.' :
    amount < min ? `The minimum payout is ${money(min)}.` :
    amount > (s.available || 0) ? `You can withdraw up to ${money(s.available)}.` : '';
  const provider = momoProvider(f.accountNumber);

  const submit = async e => {
    e.preventDefault();
    if (!f.amount || !f.accountName.trim() || !f.accountNumber.trim()) { notice.fail('Enter the amount, account name and mobile money number.'); return; }
    if (problem) { notice.fail(problem); return; }
    if (!provider) { notice.fail('Use an MTN (078/079) or Airtel (072/073) number.'); return; }
    setBusy('request');
    try {
      const res = await payoutsApi.requestPayout({ amount, payoutDetails: { accountName: f.accountName.trim(), accountNumber: f.accountNumber.trim() } });
      notice.success(res.message);
      setForm({ ...f, amount: '' });
      reload();
    } catch (err) { notice.fail(err); }
    finally { setBusy(''); }
  };

  const cancel = async p => {
    if (!window.confirm(`Cancel payout ${p.payoutNumber} of ${money(p.amount)}? The amount goes back to your available balance.`)) return;
    setBusy(p._id);
    try { const res = await payoutsApi.cancel(p._id); notice.success(res.message || 'Payout cancelled.'); reload(); }
    catch (err) { notice.fail(err); }
    finally { setBusy(''); }
  };

  const payouts = data?.payouts || [];
  const counts = Object.fromEntries(PAYOUT_TABS.map(([k, , st]) => [k, st ? payouts.filter(p => st.includes(p.status)).length : payouts.length]));
  const statuses = PAYOUT_TABS.find(([k]) => k === tab)?.[2];
  const shown = statuses ? payouts.filter(p => statuses.includes(p.status)) : payouts;

  return <>
    <PageHead title="Payouts" desc="Withdraw money released from delivered orders to your mobile money."
      action={<Link className="outline-btn" to="/vendor/transactions">View statement</Link>} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="Available" value={money(s.available)} icon="wallet" sub="Ready to withdraw" />
        <Metric label="In escrow" value={money(s.inEscrow)} icon="shield" sub={`${s.escrowOrders || 0} orders · released after delivery`} />
        <Metric label="Withdrawals in progress" value={money(s.pendingPayouts)} icon="bell" sub="Requested, not sent yet" />
        <Metric label="Paid out" value={money(s.paidOut)} icon="chart" sub="Sent to your account" />
      </div>
      {s.frozen > 0 && <div className="form-alert">{money(s.frozen)} from {s.frozenOrders} order{s.frozenOrders === 1 ? '' : 's'} is on hold because of an open dispute. <Link to="/vendor/orders">See orders</Link></div>}

      <div className="dash-grid">
        <div className="data-card">
          <h3>Request payout</h3>
          <form onSubmit={submit}>
            <label className="field"><span>Amount (RWF)</span>
              <div className="payout-amount">
                <input type="number" min={min} step="1" max={s.available || 0} value={f.amount} onChange={e => set('amount', e.target.value)} placeholder={`Minimum ${money(min)}`} />
                <button type="button" className="table-action-btn" disabled={(s.available || 0) < min} onClick={() => set('amount', String(Math.floor(s.available)))}>Withdraw all</button>
              </div>
              {problem && <small className="tiny seller-negative">{problem}</small>}
            </label>
            <label className="field"><span>Account name</span><input value={f.accountName} onChange={e => set('accountName', e.target.value)} placeholder="Name registered on the mobile money account" /></label>
            <label className="field"><span>Mobile money number</span>
              <input value={f.accountNumber} onChange={e => set('accountNumber', e.target.value)} placeholder="078 / 079 (MTN) or 072 / 073 (Airtel)" />
              {provider && <small className="tiny">Paid to {provider}</small>}
            </label>
            <button className="gradient-btn" type="submit" disabled={busy === 'request' || (s.available || 0) < min}>{busy === 'request' ? 'Requesting…' : 'Request payout'}</button>
            <p className="tiny">MVEC reviews requests and sends the money, usually within 1 business day. You can cancel while a request is waiting for review.</p>
          </form>
        </div>

        <div className="data-card">
          <h3>Where your money is</h3>
          <div className="activity-row"><div><b>In escrow</b><small>Paid by buyers, released when they confirm delivery</small></div><strong>{money(s.inEscrow)}</strong></div>
          <div className="activity-row"><div><b>On hold</b><small>Orders with an open dispute</small></div><strong>{money(s.frozen)}</strong></div>
          <div className="activity-row"><div><b>Available</b><small>Released to you, ready to withdraw</small></div><strong>{money(s.available)}</strong></div>
          {s.collectedBySeller > 0 && <div className="activity-row"><div><b>Collected by you</b><small>Manual orders paid in cash or offline — not in your MVEC balance</small></div><strong>{money(s.collectedBySeller)}</strong></div>}
          <div className="activity-row"><div><b>MVEC commission</b><small>{data.commissionRate || '5%'} of each released sale</small></div><strong>{money(s.commissionPaid)}</strong></div>
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-head"><h3>Payout history</h3></div>
        <div className="seller-view-tabs" role="tablist" aria-label="Payout status">
          {PAYOUT_TABS.map(([k, label]) => <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label} <small>{counts[k]}</small></button>)}
        </div>
        {shown.length === 0 && <p className="tiny">No payouts here yet.</p>}
        {shown.map(p => <div className="activity-row" key={p._id || p.payoutNumber}>
          <div>
            <b>{p.payoutNumber}</b>
            <small>{dateDMY(p.createdAt)} · {[p.payoutDetails?.bankName, p.payoutDetails?.accountNumber].filter(Boolean).join(' · ')}</small>
            <small>{PAYOUT_STEP[p.status] || titleCase(p.status)}
              {p.transferReference && <> · Ref {p.transferReference}</>}
              {p.rejectionReason && <> · Reason: {p.rejectionReason}</>}
            </small>
          </div>
          <div>
            <strong>{money(p.amount)}</strong>
            <StatusPill value={p.status} />
            {p.status === 'PENDING' && <button type="button" className="table-action-btn" disabled={busy === p._id} onClick={() => cancel(p)}>{busy === p._id ? 'Cancelling…' : 'Cancel'}</button>}
          </div>
        </div>)}
      </div>
    </>}
  </>;
}

const TYPE_LABEL = { SALE: 'Sale', DISPUTE_RELEASE: 'Dispute release', PAYOUT: 'Payout', SUBSCRIPTION: 'Subscription', ADVERTISING: 'Advertising', ADJUSTMENT: 'Adjustment' };
const STATE_LABEL = { IN_ESCROW: 'In escrow', FROZEN: 'On hold', RELEASED: 'Released', ARBITRATED: 'Dispute resolved', COLLECTED_BY_SELLER: 'Collected by you', REFUNDED: 'Refunded', CANCELLED: 'Cancelled', CHARGED: 'Charged' };
const PERIODS = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['365', 'Last 12 months'], ['ALL', 'All time'], ['CUSTOM', 'Custom']];
const daysAgo = n => toInputDate(new Date(Date.now() - n * 86400000));

export function TransactionsPage() {
  const [period, setPeriod] = useState('90');
  const [range, setRange] = useState({ from: daysAgo(30), to: toInputDate(new Date()) });
  const [type, setType] = useState('ALL');
  const params = period === 'ALL' ? {} : period === 'CUSTOM' ? range : { from: daysAgo(Number(period)) };
  const { data, loading, error } = useLoader(() => Promise.all([payoutsApi.getStatement(params), payoutsApi.getBalance()])
    .then(([st, b]) => ({ ...st, summary: b.summary || {} })), [period, range.from, range.to]);

  const rows = useMemo(() => (data?.entries || [])
    .filter(e => type === 'ALL' || (type === 'CHARGE' ? ['SUBSCRIPTION', 'ADVERTISING', 'ADJUSTMENT'].includes(e.type) : e.type === type))
    .map((e, i) => ({
      ...e, id: `${e.type}-${e.reference}-${i}`, date: e.date, kind: TYPE_LABEL[e.type] || titleCase(e.type),
      status: STATE_LABEL[e.state] || titleCase(e.state),
    })), [data, type]);

  const columns = [
    { key: 'date', label: 'Date', render: r => dateDMY(r.date) },
    { key: 'kind', label: 'Type', render: r => <b>{r.kind}</b> },
    { key: 'reference', label: 'Reference', render: r => <span>
      {r.orderId ? <Link to={`/vendor/orders/${r.orderId}`}>{r.reference}</Link> : r.reference}
      {r.detail && <small className="tiny seller-block">{r.detail}</small>}
      {r.transferReference && <small className="tiny seller-block">Transfer ref {r.transferReference}</small>}
      {r.rejectionReason && <small className="tiny seller-block">Reason: {r.rejectionReason}</small>}
    </span> },
    { key: 'gross', label: 'Gross', render: r => r.gross != null ? <span>{money(r.gross)}{r.delivery > 0 && <small className="tiny seller-block">incl. {money(r.delivery)} delivery</small>}</span> : '—' },
    { key: 'commission', label: 'Commission', render: r => r.commission ? `-${money(r.commission)}` : '—' },
    { key: 'net', label: 'Net', render: r => <b className={r.net < 0 ? 'seller-negative' : ''}>{money(r.net)}</b> },
    { key: 'effect', label: 'Balance effect', render: r => r.effect ? <span className={r.effect < 0 ? 'seller-negative' : ''}>{r.effect > 0 ? '+' : ''}{money(r.effect)}</span> : <span className="tiny">none yet</span> },
    { key: 'status', label: 'Status', render: r => <StatusPill value={r.state} /> },
  ];

  const t = data?.totals || {};
  const s = data?.summary || {};
  return <>
    <PageHead title="Transactions" desc="Your statement: every sale, commission, payout and charge, and how it changed your balance."
      action={<Link className="outline-btn" to="/vendor/payouts">Request payout</Link>} />
    <div className="smart-table-tools">
      <select className="table-filter-select" value={period} onChange={e => setPeriod(e.target.value)} aria-label="Period">{PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      {period === 'CUSTOM' && <>
        <input type="date" className="table-filter-select" value={range.from} max={range.to} onChange={e => setRange({ ...range, from: e.target.value })} aria-label="From" />
        <input type="date" className="table-filter-select" value={range.to} min={range.from} onChange={e => setRange({ ...range, to: e.target.value })} aria-label="To" />
      </>}
      <select className="table-filter-select" value={type} onChange={e => setType(e.target.value)} aria-label="Type">
        <option value="ALL">All types</option><option value="SALE">Sales</option><option value="PAYOUT">Payouts</option><option value="CHARGE">Charges</option><option value="DISPUTE_RELEASE">Dispute releases</option>
      </select>
    </div>
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="Released to you" value={money(t.released)} icon="wallet" sub="In this period" />
        <Metric label="Commission" value={money(t.commission)} icon="tag" sub="On released sales" />
        <Metric label="Paid out" value={money(t.paidOut)} icon="chart" sub={`Charges ${money(t.charges)}`} />
        <Metric label="Available now" value={money(s.available)} icon="shield" sub={`${money(s.inEscrow)} still in escrow`} />
      </div>
      <div className="data-card">
        <SmartTable columns={columns} rows={rows} rowKey={r => r.id} pageSize={12} searchPlaceholder="Search reference, order…" exportName="mvec-statement" empty="No transactions in this period." />
      </div>
    </>}
  </>;
}
