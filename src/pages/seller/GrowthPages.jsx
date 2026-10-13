// Seller monetization pages: sponsored ads and the freemium subscription.
import { useState } from 'react';
import Icon from '../../components/Icon';
import SmartTable from '../../components/SmartTable';
import { vendorServicesApi } from '../../API/vendorServices';
import { productsApi } from '../../API/products';
import { PageHead, Loading, StatusPill, FormModal, money, useLoader, useNotice } from './shared';

const PLACEMENTS = [['HOMEPAGE_HERO', 'Homepage hero'], ['CATEGORY_BANNER', 'Category banner'], ['SEARCH_RESULTS', 'Search results'], ['FEATURED', 'Featured'], ['PROMOTION', 'Promotion']];

export function AdvertisementsPage() {
  const { data, loading, error, reload } = useLoader(() => Promise.all([
    vendorServicesApi.getAdvertisements().then(r => r.data || []),
    productsApi.getVendorProducts().then(r => r.products || []).catch(() => []),
  ]).then(([ads, products]) => ({ ads, products })));
  const [creating, setCreating] = useState(false);
  const notice = useNotice();

  const toggle = async ad => {
    try {
      await vendorServicesApi.setAdvertisementStatus(ad.id, ad.statusKey === 'ACTIVE' ? 'PAUSED' : 'ACTIVE');
      notice.success(ad.statusKey === 'ACTIVE' ? 'Campaign paused.' : 'Campaign activated.');
      reload();
    } catch (err) { notice.fail(err); }
  };

  const columns = [
    { key: 'product', label: 'Product', render: r => <b>{r.product}</b> },
    { key: 'placement', label: 'Placement' },
    { key: 'budget', label: 'Budget', render: r => money(r.budget) },
    { key: 'period', label: 'Runs', render: r => `${r.startDate} → ${r.endDate}` },
    { key: 'impressions', label: 'Views', render: r => Number(r.impressions || 0).toLocaleString() },
    { key: 'clicks', label: 'Clicks', render: r => `${Number(r.clicks || 0).toLocaleString()} (${r.ctr})` },
    { key: 'status', label: 'Status', render: r => <StatusPill value={r.status} /> },
  ];
  const actions = r => ['ACTIVE', 'PAUSED'].includes(r.statusKey)
    ? <button type="button" className="table-action-btn" onClick={() => toggle(r)}>{r.statusKey === 'ACTIVE' ? 'Pause' : 'Activate'}</button>
    : <span className="tiny">Awaiting MVEC review</span>;

  const products = data?.products || [];
  return <>
    <PageHead title="Advertisements" desc="Sponsor products in prominent marketplace placements. Campaigns go live after MVEC approval."
      action={<button type="button" className="gradient-btn" onClick={() => setCreating(true)} disabled={!products.length} title={products.length ? '' : 'Add a product first'}><Icon name="plus" /> New campaign</button>} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <div className="data-card">
      <SmartTable columns={columns} rows={data.ads} rowKey={r => r.id} actions={actions} searchPlaceholder="Search campaigns…" exportName="mvec-advertisements" empty="No campaigns yet." />
    </div>}
    {creating && <FormModal title="New ad campaign" subtitle="Your campaign is reviewed by MVEC before it goes live."
      fields={[
        { name: 'productId', label: 'Product', type: 'select', required: true, placeholder: 'Select a product', options: products.map(p => [p.id, p.name]) },
        { name: 'placement', label: 'Placement', type: 'select', options: PLACEMENTS },
        { name: 'budget', label: 'Budget (RWF)', type: 'number', required: true, half: true },
        { name: 'startDate', label: 'Start date', type: 'date', half: true },
        { name: 'endDate', label: 'End date', type: 'date', half: true },
      ]}
      initial={{ placement: 'SEARCH_RESULTS' }} submitLabel="Submit for review" onClose={() => setCreating(false)}
      onSubmit={async form => {
        const product = products.find(p => String(p.id) === String(form.productId));
        await vendorServicesApi.createAdvertisement({ ...form, product: product?.name, budget: Number(form.budget), startDate: form.startDate || undefined, endDate: form.endDate || undefined });
        setCreating(false);
        notice.success('Campaign submitted for review.');
        reload();
      }} />}
  </>;
}

const PLAN_PERKS = {
  FREE: ['Unlimited product listings', 'Orders, payouts and delivery tracking', 'Standard marketplace visibility'],
  PREMIUM: ['Everything in Free', 'Priority placement in search', 'Advanced analytics and reports', 'Priority MVEC support'],
};

export function SubscriptionPage() {
  const { data, loading, error, setData } = useLoader(() => vendorServicesApi.getSubscription());
  const [busy, setBusy] = useState('');
  const notice = useNotice();

  const tiers = data?.tiers || [];
  const currentKey = tiers.find(t => t.status === 'Active')?.planKey || 'FREE';

  const change = async plan => {
    if (plan === 'FREE' && !window.confirm('Downgrade to the Free plan? Premium tools stop immediately.')) return;
    setBusy(plan);
    try {
      const res = await vendorServicesApi.changeSubscription(plan);
      setData({ subscription: res.subscription, tiers: res.tiers });
      notice.success(res.message);
    } catch (err) { notice.fail(err); }
    finally { setBusy(''); }
  };

  return <>
    <PageHead title="Subscription" desc="Selling on MVEC is free. Premium adds visibility and advanced tools." />
    {notice.banner}
    {loading && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <div className="seller-plans">
      {tiers.map(t => {
        const current = t.planKey === currentKey;
        return <div className={'data-card seller-plan' + (current ? ' current' : '')} key={t.planKey}>
          <div className="data-card-head"><div><span className="eyebrow">{t.plan}</span></div>{current && <StatusPill value="ACTIVE" />}</div>
          <h2>{t.price ? money(t.price) : 'Free'}<small>{t.price ? ' / month' : ''}</small></h2>
          {current && t.renewal && t.renewal !== '—' && <p className="tiny">Renews {t.renewal}</p>}
          <ul className="simple-list">{(PLAN_PERKS[t.planKey] || []).map(p => <li key={p}>{p}</li>)}</ul>
          {current
            ? <button type="button" className="outline-btn" disabled>Current plan</button>
            : <button type="button" className={t.planKey === 'PREMIUM' ? 'gradient-btn' : 'outline-btn'} disabled={!!busy} onClick={() => change(t.planKey)}>
                {busy === t.planKey ? 'Updating…' : t.planKey === 'PREMIUM' ? 'Upgrade to Premium' : 'Switch to Free'}
              </button>}
        </div>;
      })}
    </div>}
  </>;
}
