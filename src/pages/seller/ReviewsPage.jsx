import { useMemo, useState } from 'react';
import SmartTable from '../../components/SmartTable';
import { reviewsApi } from '../../API/reviews';
import { PageHead, Loading, Metric, FormModal, dateDMY, useLoader, useNotice } from './shared';

const Stars = ({ value }) => <span className="seller-stars" aria-label={`${value} out of 5`}>{'★'.repeat(value)}<i>{'★'.repeat(5 - value)}</i></span>;

export default function ReviewsPage() {
  const { data, loading, error, reload } = useLoader(() => reviewsApi.getVendorReviews().then(r => r.data || []));
  const [replying, setReplying] = useState(null);
  const notice = useNotice();

  const [tab, setTab] = useState('ALL');
  const stats = useMemo(() => {
    const rows = data || [];
    const avg = rows.length ? rows.reduce((s, r) => s + Number(r.rating || 0), 0) / rows.length : 0;
    const dist = [5, 4, 3, 2, 1].map(n => [n, rows.filter(r => Number(r.rating) === n).length]);
    const byProduct = new Map();
    rows.forEach(r => {
      const k = String(r.productId || r.product);
      const p = byProduct.get(k) || { name: r.product, count: 0, sum: 0, low: 0 };
      p.count += 1; p.sum += Number(r.rating || 0); if (Number(r.rating) <= 2) p.low += 1;
      byProduct.set(k, p);
    });
    const replied = rows.filter(r => r.vendorReply).length;
    return {
      total: rows.length, avg, dist, awaiting: rows.length - replied,
      replyRate: rows.length ? Math.round((replied / rows.length) * 100) : 0,
      products: [...byProduct.values()].map(p => ({ ...p, avg: p.sum / p.count })).sort((a, b) => a.avg - b.avg || b.count - a.count),
    };
  }, [data]);
  const TABS = [['ALL', 'All', () => true], ['AWAITING', 'Needs reply', r => !r.vendorReply], ['LOW', '1–2 stars', r => Number(r.rating) <= 2], ['MID', '3 stars', r => Number(r.rating) === 3], ['HIGH', '4–5 stars', r => Number(r.rating) >= 4]];
  const shown = (data || []).filter(TABS.find(([k]) => k === tab)[2]);

  const columns = [
    { key: 'product', label: 'Product', render: r => <b>{r.product}</b> },
    { key: 'reviewer', label: 'Customer', render: r => <div>{r.reviewer || 'Buyer'}{r.isVerifiedPurchase && <small className="tiny seller-block">Verified purchase</small>}</div> },
    { key: 'rating', label: 'Rating', render: r => <Stars value={Number(r.rating || 0)} /> },
    { key: 'comment', label: 'Review', render: r => <div className="seller-review-text">
      <span>{r.comment || '—'}</span>
      {r.vendorReply && <small><b>Your reply:</b> {r.vendorReply}</small>}
    </div> },
    { key: 'date', label: 'Date', render: r => dateDMY(r.date) },
  ];

  const actions = r => <button type="button" className="table-action-btn" onClick={() => setReplying(r)}>{r.vendorReply ? 'Edit reply' : 'Reply'}</button>;

  return <>
    <PageHead title="Reviews" desc="See what buyers say about your products and reply publicly. Your reply shows under the review on the product page and the buyer is notified. Moderation stays with MVEC." />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="Average rating" value={stats.total ? stats.avg.toFixed(1) + ' / 5' : '—'} icon="heart" sub={`${stats.total} reviews`} />
        <Metric label="Awaiting reply" value={stats.awaiting} icon="bell" sub="Reviews without your response" />
        <Metric label="Reply rate" value={`${stats.replyRate}%`} icon="users" sub="Buyers see your replies on the product page" />
        <Metric label="Low ratings" value={stats.dist[3][1] + stats.dist[4][1]} icon="shield" sub="1–2 star reviews" />
      </div>
      {stats.total > 0 && <div className="dash-grid">
        <div className="data-card"><div className="data-card-head"><div><h3>Rating breakdown</h3><span>All your products</span></div></div>
          {stats.dist.map(([n, c]) => <div className="progress-row" key={n}><span>{n} ★</span><div><i style={{ width: `${stats.total ? (c / stats.total) * 100 : 0}%` }} /></div><b>{c}</b></div>)}
        </div>
        <div className="data-card"><div className="data-card-head"><div><h3>By product</h3><span>Lowest rated first</span></div></div>
          {stats.products.slice(0, 5).map(p => <div className="activity-row" key={p.name}><div><b>{p.name}</b><small>{p.count} review{p.count === 1 ? '' : 's'}{p.low ? ` · ${p.low} low` : ''}</small></div><div><strong>{p.avg.toFixed(1)} ★</strong></div></div>)}
        </div>
      </div>}
      <div className="data-card">
        <div className="seller-view-tabs" role="tablist" aria-label="Filter reviews">
          {TABS.map(([k, label, fn]) => <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label} <small>{(data || []).filter(fn).length}</small></button>)}
        </div>
        <SmartTable columns={columns} rows={shown} rowKey={r => r.id} actions={actions} searchPlaceholder="Search reviews…" exportName="mvec-reviews" empty="No reviews here. They appear once buyers rate your products." />
      </div>
    </>}
    {replying && <FormModal title="Reply to review" subtitle={`${replying.reviewer || 'Buyer'} on ${replying.product}: “${replying.comment || ''}”`}
      fields={[{ name: 'reply', label: 'Your public reply', type: 'textarea', rows: 4, required: true }]}
      initial={{ reply: replying.vendorReply || '' }} submitLabel="Post reply" onClose={() => setReplying(null)}
      onSubmit={async form => { await reviewsApi.reply(replying.id, form.reply); setReplying(null); notice.success('Reply posted.'); reload(); }} />}
  </>;
}
