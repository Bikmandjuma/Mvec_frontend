// Account settings for every role, shown inside the user's own portal (seller,
// admin, supplier, affiliate, delivery) or the storefront for buyers:
// profile & photo, sign-in & security, delivery addresses, preferences.
import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authApi } from '../../API/auth';
import { addressesApi } from '../../API/addresses';
import { extractErrorMessage } from '../../API/client';
import { RWANDA_LOCATIONS, PROVINCES } from '../../data/rwandaLocations';
import { STAFF_ROLE_LABEL } from '../../data/staffAccess';
import { PageHead, FormModal, StatusPill, dateDMY, useNotice } from '../seller/shared';

const ROLE_LABEL = { buyer: 'Buyer', vendor: 'Seller', supplier: 'Supplier', affiliate: 'Affiliate', super_admin: 'Super admin', developer: 'Developer', delivery: 'Delivery partner' };
const ADDRESS_TYPES = [['HOME', 'Home'], ['OFFICE', 'Office'], ['PARENTS', 'Family'], ['OTHER', 'Other']];
const NOTIFY = [
  ['orders', 'Orders & deliveries', 'New orders, status changes and delivery updates'],
  ['payouts', 'Money', 'Payments, payouts, refunds and charges'],
  ['messages', 'Messages', 'Buyer, seller and support conversations'],
  ['marketing', 'Tips & offers', 'Product news and promotions from MVEC'],
];
const CHANNELS = [['email', 'Email'], ['sms', 'SMS']];
const LANGUAGES = [['en', 'English'], ['rw', 'Kinyarwanda'], ['fr', 'Français']];
const TABS = [['profile', 'Profile', 'user'], ['security', 'Sign-in & security', 'shield'], ['addresses', 'Addresses', 'home'], ['preferences', 'Preferences', 'settings']];

const initials = name => String(name || 'M').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

export default function AccountSettings({ eyebrow = 'MY ACCOUNT' }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(() => (typeof window !== 'undefined' && TABS.some(([k]) => k === window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'profile'));
  const notice = useNotice();
  const pick = k => { setTab(k); try { window.history.replaceState(null, '', `#${k}`); } catch { /* ignore */ } };
  if (!user) return null;

  return <>
    <PageHead eyebrow={eyebrow} title="Account settings" desc="Your profile, sign-in details, addresses and preferences. Changes save here without leaving the page." />
    {notice.banner}
    <div className="account-shell">
      <aside className="account-side data-card">
        <AvatarBlock notice={notice} />
        <nav className="account-tabs" role="tablist" aria-label="Account settings">
          {TABS.map(([k, label, icon]) => <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => pick(k)}><Icon name={icon} size={16} />{label}</button>)}
        </nav>
      </aside>
      <section className="account-main">
        {tab === 'profile' && <ProfileTab notice={notice} />}
        {tab === 'security' && <SecurityTab notice={notice} />}
        {tab === 'addresses' && <AddressesTab notice={notice} />}
        {tab === 'preferences' && <PreferencesTab notice={notice} />}
      </section>
    </div>
  </>;
}

function AvatarBlock({ notice }) {
  const { user, updateUser } = useAuth();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const upload = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { notice.fail('Your photo must be 3 MB or smaller.'); return; }
    setBusy(true);
    try { const res = await authApi.uploadAvatar(file); updateUser({ avatarUrl: res.avatarUrl }); notice.success(res.message); }
    catch (err) { notice.fail(err); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await authApi.removeAvatar(); updateUser({ avatarUrl: '' }); notice.success('Photo removed.'); }
    catch (err) { notice.fail(err); }
    finally { setBusy(false); }
  };
  return <div className="account-identity">
    <button type="button" className="account-avatar" onClick={() => input.current?.click()} disabled={busy} title="Change photo">
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{initials(user.fullName)}</span>}
      <i><Icon name="edit" size={14} /></i>
    </button>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
    <b>{user.fullName}</b>
    <small>{user.isStaff ? `${STAFF_ROLE_LABEL[user.staffRole] || 'Staff'} · ${user.staffStoreName || 'Store'}` : ROLE_LABEL[user.role] || user.role}</small>
    <div className="account-avatar-actions">
      <button type="button" className="link-btn" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Saving…' : user.avatarUrl ? 'Change photo' : 'Add photo'}</button>
      {user.avatarUrl && <button type="button" className="link-btn muted" onClick={remove} disabled={busy}>Remove</button>}
    </div>
  </div>;
}

function ProfileTab({ notice }) {
  const { user, updateUser } = useAuth();
  const initial = { fullName: user.fullName || '', gender: user.gender || 'other', email: user.email || '', phone: user.telephone || '', companyName: user.companyName || '' };
  const [form, setForm] = useState(initial);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setForm(initial); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user.id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const normPhone = p => String(p || '').replace(/\D/g, '').replace(/^250/, '0');
  const identityChanged = form.email.trim().toLowerCase() !== (user.email || '') || normPhone(form.phone) !== normPhone(user.telephone);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const ownerSeller = user.role === 'vendor' && !user.isStaff;

  const save = async e => {
    e.preventDefault();
    setError('');
    if (identityChanged && user.hasPassword && !password) { setError('Enter your current password to change your email or phone.'); return; }
    setBusy(true);
    try {
      const payload = { Fullname: form.fullName, gender: form.gender, email: form.email, phone: form.phone };
      if (ownerSeller) payload.companyName = form.companyName;
      if (identityChanged) payload.currentPassword = password;
      const res = await authApi.updateAccount(payload);
      updateUser(res.user);
      setPassword('');
      notice.success(res.message);
    } catch (err) { setError(extractErrorMessage(err)); }
    finally { setBusy(false); }
  };

  return <form className="data-card account-card" onSubmit={save}>
    <div className="data-card-head"><div><h3>Personal details</h3><span>How you appear across MVEC</span></div></div>
    {error && <div className="form-error">{error}</div>}
    <div className="seller-form-grid">
      <label className="field"><span>Full name *</span><input value={form.fullName} onChange={e => set('fullName', e.target.value)} required minLength={2} /></label>
      <label className="field half"><span>Gender</span><select value={form.gender} onChange={e => set('gender', e.target.value)}><option value="female">Female</option><option value="male">Male</option><option value="other">Prefer not to say</option></select></label>
      {ownerSeller && <label className="field half"><span>Business name *</span><input value={form.companyName} onChange={e => set('companyName', e.target.value)} required /></label>}
      <label className="field half"><span>Email</span><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" />
        {user.email && <small className="tiny">{user.emailVerified ? '✓ Verified' : 'Not verified yet'}</small>}
      </label>
      <label className="field half"><span>Phone</span><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="07xx xxx xxx" /><small className="tiny">Used to sign in and for order updates</small></label>
      {identityChanged && user.hasPassword && <label className="field"><span>Current password *</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /><small className="tiny">Needed because your email or phone is how you sign in.</small></label>}
    </div>
    <div className="account-actions">
      <button type="button" className="outline-btn" disabled={!dirty || busy} onClick={() => { setForm(initial); setPassword(''); setError(''); }}>Discard</button>
      <button type="submit" className="gradient-btn" disabled={!dirty || busy}>{busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  </form>;
}

function SecurityTab({ notice }) {
  const { user, updateUser, replaceToken } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const first = !user.hasPassword;
  const strength = p => [p.length >= 8, /[A-Z]/.test(p) && /[a-z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p), p.length >= 12].filter(Boolean).length;
  const score = strength(form.next);

  const change = async e => {
    e.preventDefault();
    setError('');
    if (form.next.length < 8) { setError('Use at least 8 characters.'); return; }
    if (form.next !== form.confirm) { setError("The new passwords don't match."); return; }
    setBusy('password');
    try {
      const res = await authApi.changePassword({ currentPassword: first ? undefined : form.current, newPassword: form.next });
      replaceToken(res.token);
      updateUser({ hasPassword: true, lastPasswordChangeAt: res.lastPasswordChangeAt });
      setForm({ current: '', next: '', confirm: '' });
      notice.success(res.message);
    } catch (err) { setError(extractErrorMessage(err)); }
    finally { setBusy(''); }
  };
  const logoutAll = async () => {
    if (!window.confirm('Sign out of MVEC on every other phone and computer? You stay signed in here.')) return;
    setBusy('all');
    try { const res = await authApi.logoutAll(); replaceToken(res.token); notice.success(res.message); }
    catch (err) { notice.fail(err); }
    finally { setBusy(''); }
  };

  return <>
    <form className="data-card account-card" onSubmit={change}>
      <div className="data-card-head"><div><h3>{first ? 'Set a password' : 'Change password'}</h3><span>{first ? 'You sign in with Google. Add a password to also sign in with your email or phone.' : user.lastPasswordChangeAt ? `Last changed ${dateDMY(user.lastPasswordChangeAt)}` : 'Use a password you don\'t use anywhere else'}</span></div></div>
      {error && <div className="form-error">{error}</div>}
      <div className="seller-form-grid">
        {!first && <label className="field"><span>Current password</span><input type="password" value={form.current} onChange={e => setForm({ ...form, current: e.target.value })} autoComplete="current-password" required /></label>}
        <label className="field half"><span>New password</span><input type="password" value={form.next} onChange={e => setForm({ ...form, next: e.target.value })} autoComplete="new-password" required minLength={8} />
          {form.next && <span className={`pw-meter s${score}`}><i /><small className="tiny">{['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][score]}</small></span>}
        </label>
        <label className="field half"><span>Confirm new password</span><input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" required /></label>
      </div>
      <div className="account-actions"><button type="submit" className="gradient-btn" disabled={busy === 'password'}>{busy === 'password' ? 'Saving…' : first ? 'Set password' : 'Update password'}</button></div>
      {!first && <p className="tiny">Changing your password signs you out on your other devices.</p>}
    </form>

    <div className="data-card account-card">
      <div className="data-card-head"><div><h3>Sessions</h3><span>Lost a phone or used a shared computer?</span></div></div>
      <div className="activity-row"><div><b>Sign out everywhere else</b><small>Ends every other session immediately. This device stays signed in.</small></div><button type="button" className="outline-btn" disabled={busy === 'all'} onClick={logoutAll}>{busy === 'all' ? 'Signing out…' : 'Sign out others'}</button></div>
    </div>

    <div className="data-card account-card">
      <div className="data-card-head"><div><h3>Account</h3><span>Details managed by MVEC</span></div></div>
      <div className="activity-row"><div><b>Account type</b><small>{user.isStaff ? `Staff login for ${user.staffStoreName || 'a store'}` : 'Your own account'}</small></div><strong>{user.isStaff ? STAFF_ROLE_LABEL[user.staffRole] : ROLE_LABEL[user.role] || user.role}</strong></div>
      <div className="activity-row"><div><b>Sign-in methods</b><small>How you can sign in</small></div><strong>{[user.hasPassword && 'Password', user.googleLinked && 'Google'].filter(Boolean).join(' · ') || '—'}</strong></div>
      {user.createdAt && <div className="activity-row"><div><b>Member since</b><small>Account created</small></div><strong>{dateDMY(user.createdAt)}</strong></div>}
      <div className="activity-row"><div><b>Status</b><small>Contact MVEC support if this looks wrong</small></div><StatusPill value="ACTIVE" /></div>
      {user.isStaff && <p className="tiny">Your store access is managed by the store owner from Team / Staff.</p>}
    </div>
  </>;
}

const blankAddress = user => ({ type: 'HOME', provinceState: PROVINCES[0], cityDistrict: RWANDA_LOCATIONS[PROVINCES[0]][0], street: '', building: '', apartment: '', phone: user.telephone || '', deliveryInstructions: '', isDefaultShipping: false, isDefaultBilling: false });

function AddressesTab({ notice }) {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const load = () => addressesApi.getAll().then(r => setList(r.addresses || [])).catch(err => setError(extractErrorMessage(err)));
  useEffect(() => { load(); }, []);

  const run = async (fn, message) => { try { await fn(); notice.success(message); load(); } catch (err) { notice.fail(err); } };
  const label = t => ADDRESS_TYPES.find(([k]) => k === t)?.[1] || 'Address';

  return <div className="data-card account-card">
    <div className="data-card-head"><div><h3>Delivery addresses</h3><span>Used at checkout and for deliveries</span></div><button type="button" className="gradient-btn" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Add address</button></div>
    {error && <div className="form-error">{error}</div>}
    {!list && !error && <p className="tiny">Loading…</p>}
    {list?.length === 0 && <p className="tiny">No saved addresses yet. Add one to check out faster.</p>}
    <div className="account-addresses">
      {(list || []).map(a => <div className="account-address" key={a._id}>
        <div className="account-address-head"><b>{label(a.type)}</b>
          <span>{a.isDefaultShipping && <em className="status active">Default delivery</em>}{a.isDefaultBilling && <em className="status warning">Billing</em>}</span>
        </div>
        <p>{[a.street, a.building, a.apartment && `Apt ${a.apartment}`].filter(Boolean).join(', ')}<br />{a.cityDistrict}, {a.provinceState}, {a.country}<br />{a.phone}</p>
        {a.deliveryInstructions && <small className="tiny">{a.deliveryInstructions}</small>}
        <div className="account-address-actions">
          <button type="button" className="link-btn" onClick={() => setEditing(a)}>Edit</button>
          {!a.isDefaultShipping && <button type="button" className="link-btn" onClick={() => run(() => addressesApi.update(a._id, { isDefaultShipping: true }), 'Default delivery address set.')}>Make default</button>}
          <button type="button" className="link-btn muted" onClick={() => window.confirm('Delete this address?') && run(() => addressesApi.remove(a._id), 'Address deleted.')}>Delete</button>
        </div>
      </div>)}
    </div>
    {editing && <AddressModal user={user} address={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
      onSaved={msg => { setEditing(null); notice.success(msg); load(); }} />}
  </div>;
}

function AddressModal({ user, address, onClose, onSaved }) {
  const [province, setProvince] = useState(address?.provinceState && RWANDA_LOCATIONS[address.provinceState] ? address.provinceState : PROVINCES[0]);
  const fields = [
    { name: 'type', label: 'Label', type: 'select', options: ADDRESS_TYPES, half: true },
    { name: 'phone', label: 'Contact phone', required: true, half: true, placeholder: '07xx xxx xxx' },
    { name: 'provinceState', label: 'Province / City', type: 'select', options: PROVINCES.map(p => [p, p]), half: true },
    { name: 'cityDistrict', label: 'District', type: 'select', options: (RWANDA_LOCATIONS[province] || []).map(d => [d, d]), half: true },
    { name: 'street', label: 'Street / landmark', required: true },
    { name: 'building', label: 'Building / house', half: true },
    { name: 'apartment', label: 'Apartment / floor', half: true },
    { name: 'deliveryInstructions', label: 'Delivery instructions', type: 'textarea', rows: 2, placeholder: 'e.g. Call when you arrive' },
    { name: 'defaults', label: 'Use as', type: 'checkboxes', options: [['isDefaultShipping', 'Default delivery address'], ['isDefaultBilling', 'Billing address']] },
  ];
  const start = address ? { ...address, defaults: [address.isDefaultShipping && 'isDefaultShipping', address.isDefaultBilling && 'isDefaultBilling'].filter(Boolean) } : { ...blankAddress(user), defaults: [] };
  return <FormModal title={address ? 'Edit address' : 'Add address'} fields={fields} initial={start} submitLabel={address ? 'Save address' : 'Add address'} onClose={onClose}
    onFieldChange={(name, value) => { if (name === 'provinceState') { setProvince(value); return { cityDistrict: RWANDA_LOCATIONS[value]?.[0] || '' }; } return null; }}
    onSubmit={async form => {
      const payload = {
        type: form.type, country: 'Rwanda', provinceState: form.provinceState, cityDistrict: form.cityDistrict, street: form.street,
        building: form.building || '', apartment: form.apartment || '', phone: form.phone, deliveryInstructions: form.deliveryInstructions || '',
        isDefaultShipping: (form.defaults || []).includes('isDefaultShipping'), isDefaultBilling: (form.defaults || []).includes('isDefaultBilling'),
      };
      if (address) await addressesApi.update(address._id, payload); else await addressesApi.add(payload);
      onSaved(address ? 'Address saved.' : 'Address added.');
    }} />;
}

function PreferencesTab({ notice }) {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const prefs = user.preferences || { notifications: { orders: true, payouts: true, messages: true, marketing: false, email: true, sms: true }, language: 'en', theme: 'light' };
  const [busy, setBusy] = useState(false);

  const save = async (patch, message = 'Preferences saved.') => {
    const next = { ...prefs, ...patch, notifications: { ...prefs.notifications, ...(patch.notifications || {}) } };
    updateUser({ preferences: next });
    setBusy(true);
    try { const res = await authApi.updateAccount({ preferences: patch }); updateUser({ preferences: res.user.preferences }); notice.success(message); }
    catch (err) { updateUser({ preferences: prefs }); notice.fail(err); }
    finally { setBusy(false); }
  };

  return <>
    <div className="data-card account-card">
      <div className="data-card-head"><div><h3>Notifications</h3><span>What MVEC tells you about. Important security and account messages are always sent.</span></div></div>
      {NOTIFY.map(([k, label, help]) => <label className="account-toggle" key={k}>
        <span><b>{label}</b><small>{help}</small></span>
        <input type="checkbox" checked={prefs.notifications?.[k] !== false} disabled={busy} onChange={e => save({ notifications: { [k]: e.target.checked } })} />
      </label>)}
      <div className="account-channels"><span className="tiny">Also send by</span>
        {CHANNELS.map(([k, label]) => <label key={k}><input type="checkbox" checked={prefs.notifications?.[k] !== false} disabled={busy} onChange={e => save({ notifications: { [k]: e.target.checked } })} /> {label}</label>)}
      </div>
    </div>
    <div className="data-card account-card">
      <div className="data-card-head"><div><h3>Display</h3><span>Saved to your account</span></div></div>
      <div className="seller-form-grid">
        <label className="field half"><span>Appearance</span>
          <select value={theme} onChange={e => { setTheme(e.target.value); save({ theme: e.target.value }, 'Appearance saved.'); }}><option value="light">Light</option><option value="dark">Dark</option></select>
        </label>
        <label className="field half"><span>Language</span>
          <select value={prefs.language || 'en'} onChange={e => save({ language: e.target.value }, 'Language saved.')}>{LANGUAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
      </div>
    </div>
  </>;
}
