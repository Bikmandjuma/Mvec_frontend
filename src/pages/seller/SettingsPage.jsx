import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { vendorsApi } from '../../API/vendors';
import { payoutsApi } from '../../API/payouts';
import { PageHead, Loading, StatusPill, useLoader, useNotice } from './shared';

const SHORTCUTS = [
  ['/vendor/stores', 'Storefront', 'Logo, description and store contact details', 'shop'],
  ['/vendor/shipping', 'Shipping zones', 'Delivery fees, regions and delivery times', 'box'],
  ['/vendor/payouts', 'Payouts', 'Balance and mobile money withdrawals', 'wallet'],
  ['/vendor/team', 'Team & permissions', 'Staff accounts and their access', 'users'],
  ['/vendor/notifications', 'Notifications', 'Order, stock and payout alerts', 'bell'],
  ['/profile', 'Account & security', 'Your personal profile and password', 'shield'],
];

export default function SettingsPage() {
  const { data, loading, error, notFound, setData } = useLoader(() =>
    Promise.all([vendorsApi.getMyProfile(), payoutsApi.getBalance().catch(() => null)])
      .then(([p, b]) => ({ vendor: p.vendor, commissionRate: b?.commissionRate })));
  const [form, setForm] = useState({ businessName: '', email: '', phone: '', location: '', description: '' });
  const [saving, setSaving] = useState(false);
  const notice = useNotice();

  useEffect(() => {
    const v = data?.vendor;
    if (v) setForm({ businessName: v.businessName || '', email: v.email || '', phone: v.phone || '', location: v.location || '', description: v.description || '' });
  }, [data]);

  const update = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const save = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await vendorsApi.updateMyProfile(form);
      setData(d => ({ ...d, vendor: res.vendor || { ...d.vendor, ...form } }));
      notice.success('Business profile saved.');
    } catch (err) { notice.fail(err); }
    finally { setSaving(false); }
  };

  const vendor = data?.vendor;
  return <>
    <PageHead title="Settings" desc="Business profile, verification status and shortcuts to every store setting." />
    {notice.banner}
    {loading && <Loading />}
    {!loading && error && <div className="form-error">{notFound ? 'No business profile yet. Create your store first from My Store.' : error}</div>}
    {!loading && vendor && <div className="dash-grid">
      <form className="data-card" onSubmit={save}>
        <div className="data-card-head"><div><h3>Business profile</h3><span>Shown on your public vendor page</span></div></div>
        <label className="field"><span>Business name *</span><input name="businessName" value={form.businessName} onChange={update} required /></label>
        <div className="two-col">
          <label className="field"><span>Business email</span><input type="email" name="email" value={form.email} onChange={update} /></label>
          <label className="field"><span>Business phone</span><input name="phone" value={form.phone} onChange={update} /></label>
        </div>
        <label className="field"><span>Location</span><input name="location" value={form.location} onChange={update} placeholder="Kigali" /></label>
        <label className="field"><span>About the business</span><textarea name="description" rows="3" value={form.description} onChange={update} /></label>
        <div className="editor-actions"><button className="gradient-btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></div>
      </form>
      <div>
        <div className="data-card">
          <div className="data-card-head"><div><h3>Account status</h3><span>Managed by MVEC</span></div></div>
          <div className="seller-kv"><span>Account</span><StatusPill value={vendor.status || 'ACTIVE'} /></div>
          <div className="seller-kv"><span>Verification</span><StatusPill value={vendor.verificationStatus || 'PENDING'} /></div>
          <div className="seller-kv"><span>Platform fee</span><b>{data.commissionRate || '5%'} per sale</b></div>
          <div className="seller-kv"><span>Rating</span><b>{Number(vendor.ratingAvg || 0).toFixed(1)} / 5</b></div>
        </div>
        <div className="data-card seller-shortcuts">
          {SHORTCUTS.map(([to, title, sub, icon]) => <Link key={to} to={to}>
            <span><Icon name={icon} size={17} /></span>
            <div><b>{title}</b><small>{sub}</small></div>
            <Icon name="arrow" size={14} />
          </Link>)}
        </div>
      </div>
    </div>}
  </>;
}
