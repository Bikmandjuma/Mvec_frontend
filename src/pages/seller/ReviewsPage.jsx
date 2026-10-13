import { useMemo, useState } from 'react';
import SmartTable from '../../components/SmartTable';
import { reviewsApi } from '../../API/reviews';
import { PageHead, Loading, Metric, FormModal, dateDMY, useLoader, useNotice } from './shared';

const Stars = ({ value }) => <span className="seller-stars" aria-label={`${value} out of 5`}>{'★'.repeat(value)}<i>{'★'.repeat(5 - value)}</i></span>;

export default function ReviewsPage() {
  const { data, loading, error, reload } = useLoader(() => reviewsApi.getVendorReviews().then(r => r.data || []));
  const [replying, setReplying] = useState(null);
  const notice = useNotice();

  const stats = useMemo(() => {
    const rows = data || [];
    const avg = rows.length ? rows.reduce((s, r) => s + Number(r.rating || 0), 0) / rows.length : 0;
    return { total: rows.length, avg, awaiting: rows.filter(r => !r.vendorReply).length };
  }, [data]);

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
    <PageHead title="Reviews" desc="See what buyers say about your products and reply publicly. Moderation stays with MVEC." />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="Average rating" value={stats.total ? stats.avg.toFixed(1) + ' / 5' : '—'} icon="heart" sub={`${stats.total} reviews`} />
        <Metric label="Awaiting reply" value={stats.awaiting} icon="bell" sub="Reviews without your response" />
      </div>
      <div className="data-card">
        <SmartTable columns={columns} rows={data} rowKey={r => r.id} actions={actions} searchPlaceholder="Search reviews…" exportName="mvec-reviews" empty="No reviews yet. They appear here once buyers rate your products." />
      </div>
    </>}
    {replying && <FormModal title="Reply to review" subtitle={`${replying.reviewer || 'Buyer'} on ${replying.product}: “${replying.comment || ''}”`}
      fields={[{ name: 'reply', label: 'Your public reply', type: 'textarea', rows: 4, required: true }]}
      initial={{ reply: replying.vendorReply || '' }} submitLabel="Post reply" onClose={() => setReplying(null)}
      onSubmit={async form => { await reviewsApi.reply(replying.id, form.reply); setReplying(null); notice.success('Reply posted.'); reload(); }} />}
  </>;
}
