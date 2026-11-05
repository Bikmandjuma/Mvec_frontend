// Seller monetization pages: pay-per-click sponsored ads and the freemium subscription.
import { useState } from 'react';
import Icon from '../../components/Icon';
import SmartTable from '../../components/SmartTable';
import { vendorServicesApi } from '../../API/vendorServices';
import { productsApi } from '../../API/products';
import { payoutsApi } from '../../API/payouts';
import { Link } from 'react-router-dom';
import { PageHead, Loading, Metric, StatusPill, FormModal, money, dateDMY, toInputDate, useLoader, useNotice } from './shared';

const PLACEMENTS = [['HOMEPAGE_HERO', 'Homepage hero'], ['CATEGORY_BANNER', 'Category banner'], ['SEARCH_RESULTS', 'Search results'], ['FEATURED', 'Featured'], ['PROMOTION', 'Promotion']];

const MIN_AD_BUDGET = 5000;
const AD_TABS = [['ALL', 'All'], ['LIVE', 'Live', ['ACTIVE']], ['REVIEW', 'In review', ['PENDING']], ['PAUSED', 'Paused', ['PAUSED']], ['ENDED', 'Ended', ['COMPLETED', 'REJECTED']]];

export function AdvertisementsPage() {
  const { data, loading, error, reload } = useLoader(() => Promise.all([
    vendorServicesApi.getAdvertisements().then(r => r.data || []),
    productsApi.getVendorProducts().then(r => r.products || []).catch(() => []),
    payoutsApi.getBalance().catch(() => null),
  ]).then(([ads, products, balance]) => ({ ads, products, available: Number(balance?.summary?.available ?? balance?.balance?.availableBalance ?? 0) })));
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState('ALL');
  const [busy, setBusy] = useState('');
  const notice = useNotice();

  const run = async (ad, fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(ad.id);
    try { const res = await fn(); notice.success(res.message); reload(); }
    catch (err) { notice.fail(err); }
    finally { setBusy(''); }
  };

  const ads = data?.ads || [];
  const cpc = ads[0]?.costPerClick || 100;
  const totals = ads.reduce((t, a) => ({ spent: t.spent + a.spent, clicks: t.clicks + Number(a.clicks || 0), views: t.views + Number(a.impressions || 0) }), { spent: 0, clicks: 0, views: 0 });
  const live = ads.filter(a => a.statusKey === 'ACTIVE');
  const statuses = AD_TABS.find(([k]) => k === tab)?.[2];
  const rows = statuses ? ads.filter(a => statuses.includes(a.statusKey)) : ads;

  const columns = [
    { key: 'product', label: 'Product', render: r => <div><b>{r.product}</b><small className="tiny seller-block">{r.placement} · {r.id}</small></div> },
    { key: 'period', label: 'Runs', render: r => `${r.startDate} → ${r.endDate === '—' ? 'until budget ends' : r.endDate}` },
    { key: 'budget', label: 'Budget', render: r => <div>{money(r.budget)}<div className="seller-progress" title={`${money(r.spent)} spent`}><i style={{ width: `${Math.min(100, (r.spent / (r.budget || 1)) * 100)}%` }} /></div><small className="tiny seller-block">{money(r.spent)} spent{['ACTIVE', 'PAUSED', 'PENDING'].includes(r.statusKey) ? ` · ${money(r.remaining)} left` : r.refunded > 0 ? ` · ${money(r.refunded)} returned` : ''}</small></div> },
    { key: 'impressions', label: 'Views', render: r => Number(r.impressions || 0).toLocaleString() },
    { key: 'clicks', label: 'Clicks', render: r => <span>{Number(r.clicks || 0).toLocaleString()} <small className="tiny">({r.ctr})</small></span> },
    { key: 'status', label: 'Status', render: r => <div><StatusPill value={r.statusKey === 'PENDING' ? 'IN_REVIEW' : r.statusKey} />{r.rejectionReason && <small className="tiny seller-block">{r.rejectionReason}</small>}</div> },
  ];
  const actions = r => <span className="row-actions">
    {r.statusKey === 'ACTIVE' && <button type="button" className="table-action-btn" disabled={busy === r.id} onClick={() => run(r, () => vendorServicesApi.setAdvertisementStatus(r.id, 'PAUSED'))}>Pause</button>}
    {r.statusKey === 'PAUSED' && <button type="button" className="table-action-btn" disabled={busy === r.id} onClick={() => run(r, () => vendorServicesApi.setAdvertisementStatus(r.id, 'ACTIVE'))}>Resume</button>}
    {['ACTIVE', 'PAUSED', 'PENDING'].includes(r.statusKey) && <button type="button" className="table-action-btn" disabled={busy === r.id}
      onClick={() => run(r, () => vendorServicesApi.endAdvertisement(r.id), r.statusKey === 'PENDING' ? `Withdraw this campaign? The full ${money(r.budget)} goes back to your balance.` : `End this campaign now? ${money(r.remaining)} unspent goes back to your balance.`)}>
      {r.statusKey === 'PENDING' ? 'Withdraw' : 'End'}
    </button>}
  </span>;

  const products = (data?.products || []).filter(p => p.status === 'ACTIVE' && Number(p.stockQuantity) > 0);
  return <>
    <PageHead title="Advertisements" desc={`Sponsor your products on the homepage, search and category pages. You pay ${money(cpc)} per buyer click from a budget you set; unspent budget comes back to you.`}
      action={<button type="button" className="gradient-btn" onClick={() => setCreating(true)} disabled={!products.length} title={products.length ? '' : 'You need an active, in-stock product'}><Icon name="plus" /> New campaign</button>} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="Live campaigns" value={live.length} icon="tag" sub={`${ads.filter(a => a.statusKey === 'PENDING').length} in review`} />
        <Metric label="Views" value={totals.views.toLocaleString()} icon="eye" sub="Times your ads were shown" />
        <Metric label="Clicks" value={totals.clicks.toLocaleString()} icon="cart" sub={totals.views ? `${((totals.clicks / totals.views) * 100).toFixed(1)}% click rate` : 'No views yet'} />
        <Metric label="Spent" value={money(totals.spent)} icon="wallet" sub={`Balance ${money(data.available)}`} />
      </div>
      <div className="data-card">
        <div className="seller-view-tabs" role="tablist" aria-label="Campaign status">
          {AD_TABS.map(([k, label, st]) => <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label} <small>{st ? ads.filter(a => st.includes(a.statusKey)).length : ads.length}</small></button>)}
        </div>
        <SmartTable columns={columns} rows={rows} rowKey={r => r.id} actions={actions} searchPlaceholder="Search campaigns…" exportName="mvec-advertisements" empty="No campaigns here. Create one to put a product in front of more buyers." />
      </div>
      <div className="verified-box"><b>How ads work</b><p>Your budget is reserved from your available balance when you submit. MVEC reviews the campaign, usually within a day. Once live, each buyer click costs {money(cpc)}; views are free. When the end date passes, the budget runs out or you end it, any unspent amount returns to your balance.</p></div>
    </>}
    {creating && <FormModal title="New ad campaign" subtitle={`Paid from your available balance (${money(data?.available)}). Reviewed by MVEC before it goes live.`}
      fields={[
        { name: 'productId', label: 'Product', type: 'select', required: true, placeholder: 'Select a product', options: products.map(p => [p.id || p._id, p.name]) },
        { name: 'placement', label: 'Where to show it', type: 'select', options: PLACEMENTS },
        { name: 'budget', label: 'Budget (RWF)', type: 'number', required: true, half: true, help: `Minimum ${money(MIN_AD_BUDGET)} · about ${Math.floor(MIN_AD_BUDGET / cpc)} clicks per ${money(MIN_AD_BUDGET)}` },
        { name: 'startDate', label: 'Start date', type: 'date', half: true },
        { name: 'endDate', label: 'End date (optional)', type: 'date', half: true },
      ]}
      initial={{ placement: 'SEARCH_RESULTS', budget: MIN_AD_BUDGET, startDate: toInputDate(new Date()) }} submitLabel="Pay & submit for review" onClose={() => setCreating(false)}
      onSubmit={async form => {
        const budget = Number(form.budget);
        if (!Number.isInteger(budget) || budget < MIN_AD_BUDGET) throw new Error(`The minimum budget is ${money(MIN_AD_BUDGET)}.`);
        if (budget > (data?.available || 0)) throw new Error(`Your available balance is ${money(data?.available)}. Lower the budget or wait for more sales to be released.`);
        const res = await vendorServicesApi.createAdvertisement({ productId: form.productId, placement: form.placement, budget, startDate: form.startDate || undefined, endDate: form.endDate || undefined });
        setCreating(false);
        notice.success(res.message);
        reload();
      }} />}
  </>;
}

// Fallback when the server's plan details haven't loaded.
const PLAN_PERKS = {
  FREE: ['Create a seller or supplier account and store', 'List products up to the Free limit', 'Receive and manage orders', 'Basic sales and inventory tools', 'Standard support'],
  PREMIUM: ['Higher or unlimited product listings (fair use)', 'Advanced sales reports and product analytics', 'Bulk product upload', 'Premium store branding', 'Promotional campaigns and featured listings', 'Priority support', 'Low-stock alerts', 'Growth insights'],
};

export function SubscriptionPage({ api = vendorServicesApi, balanceLink = '/vendor/payouts' }) {
  const { data, loading, error, reload } = useLoader(() => api.getSubscription());
  const [busy, setBusy] = useState('');
  const notice = useNotice();

  const tiers = data?.tiers || [];
  const sub = data?.subscription;
  const premium = sub?.planKey === 'PREMIUM' && sub?.status === 'Active';
  const plans = data?.plans;
  const programActive = Boolean(plans?.programActive);
  const perks = { FREE: plans?.freeIncludes || PLAN_PERKS.FREE, PREMIUM: plans?.premiumFeatures || PLAN_PERKS.PREMIUM };
  const price = plans?.sellerPremiumPrice || tiers.find(t => t.planKey === 'PREMIUM')?.price || 5000;
  const balance = Number(data?.availableBalance || 0);
  const short = !premium && balance < price;

  const run = async (plan, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(plan);
    try {
      const res = await api.changeSubscription(plan);
      notice.success(res.message);
      reload();
    } catch (err) { notice.fail(err); }
    finally { setBusy(''); }
  };
  const upgrade = () => run('PREMIUM', `Pay ${money(price)} from your available balance (${money(balance)}) for 30 days of Seller Premium? It renews monthly from your balance until you turn auto-renew off.`);
  const stopRenew = () => run('FREE', `Turn off auto-renew? Premium stays active until ${dateDMY(sub?.renewalDate)}, then you move to Free.`);
  const resumeRenew = () => run('PREMIUM');

  return <>
    <PageHead title="Subscription" desc="Selling on MVEC is free. Premium adds visibility and advanced tools, paid monthly from your sales balance." />
    {notice.banner}
    {data && !programActive && <div className="verified-box"><b>Every tool is free for now</b><p>While MVEC grows, you have everything, including the Premium tools, at no cost. Paid plans will start later, and you'll be told well before anything changes.</p></div>}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="Current plan" value={premium ? 'Seller Premium' : programActive ? 'Free' : 'Free · all tools included'} icon="tag" sub={premium ? (sub.autoRenew ? `Renews ${dateDMY(sub.renewalDate)}` : `Ends ${dateDMY(sub.renewalDate)}`) : 'No monthly fee'} />
        <Metric label="Available balance" value={money(balance)} icon="wallet" sub="Premium is paid from this" />
        <Metric label="Auto-renew" value={premium ? (sub.autoRenew ? 'On' : 'Off') : '—'} icon="shield" sub={premium ? `${money(sub.price || price)} every 30 days` : 'Starts with Premium'} />
      </div>

      <div className="seller-plans">
        {tiers.map(t => {
          const current = (t.planKey === 'PREMIUM') === premium;
          return <div className={'data-card seller-plan' + (current ? ' current' : '')} key={t.planKey}>
            <div className="data-card-head"><div><span className="eyebrow">{t.plan}</span></div>{current && <StatusPill value="ACTIVE" />}</div>
            <h2>{t.price ? money(t.price) : 'Free'}<small>{t.price ? ' / 30 days' : ''}</small></h2>
            <ul className="simple-list">{(perks[t.planKey] || []).map(p => <li key={p}>{t.planKey === 'FREE' && p.startsWith('List products') && plans?.freeProductLimit ? `${p} (${plans.freeProductLimit})` : p}</li>)}</ul>
            {t.planKey === 'PREMIUM' && !programActive && !premium && <button type="button" className="outline-btn" disabled>Coming soon</button>}
            {t.planKey === 'PREMIUM' && (programActive || premium) && (premium
              ? (sub.autoRenew
                  ? <button type="button" className="outline-btn" disabled={!!busy} onClick={stopRenew}>{busy ? 'Updating…' : 'Turn off auto-renew'}</button>
                  : <button type="button" className="gradient-btn" disabled={!!busy} onClick={resumeRenew}>{busy ? 'Updating…' : 'Resume auto-renew'}</button>)
              : <>
                  <button type="button" className="gradient-btn" disabled={!!busy || short} onClick={upgrade}>{busy === 'PREMIUM' ? 'Paying…' : `Upgrade · pay ${money(t.price)}`}</button>
                  {short && <p className="tiny">You need {money(price - balance)} more in your available balance. Money becomes available when buyers confirm delivery. <Link to={balanceLink}>See balance</Link></p>}
                </>)}
            {t.planKey === 'FREE' && <button type="button" className="outline-btn" disabled>{premium ? (sub.autoRenew ? `Free after you stop renewal` : `Starts ${dateDMY(sub.renewalDate)}`) : 'Current plan'}</button>}
          </div>;
        })}
      </div>

      <div className="data-card">
        <div className="data-card-head"><h3>Billing history</h3></div>
        {(data.charges || []).length === 0 && <p className="tiny">No subscription charges yet.</p>}
        {(data.charges || []).map(c => <div className="activity-row" key={c._id || c.reference}>
          <div><b>{c.reference}</b><small>{dateDMY(c.createdAt)} · {c.description}</small></div>
          <div><strong className="seller-negative">-{money(c.amount)}</strong><StatusPill value={c.status} /></div>
        </div>)}
      </div>
    </>}
  </>;
}
