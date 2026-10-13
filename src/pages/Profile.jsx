import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Storefront from '../components/Storefront';
import Icon from '../components/Icon';
import ProductImage from '../components/ProductImage';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../API/auth';
import { addressesApi } from '../API/addresses';
import { uploadsApi } from '../API/uploads';
import { extractErrorMessage } from '../API/client';
import { isRwandanPhone } from '../utils/delivery';
import { PROVINCES, RWANDA_LOCATIONS } from '../data/rwandaLocations';

const ROLE_LABEL = { buyer: 'Buyer', vendor: 'Vendor', supplier: 'Supplier', affiliate: 'Affiliate', super_admin: 'Super Admin', delivery: 'Delivery' };
const ADDRESS_TYPES = [['HOME', 'Home'], ['OFFICE', 'Office'], ['PARENTS', 'Family'], ['OTHER', 'Other']];
const EMPTY_ADDRESS = { type: 'HOME', provinceState: 'Kigali City', cityDistrict: '', sector: '', street: '', building: '', phone: '', deliveryInstructions: '', isDefaultShipping: false };
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function Notice({ notice }) {
  if (!notice) return null;
  return <div className={`form-alert ${notice.ok ? 'success' : 'error'}`} role={notice.ok ? 'status' : 'alert'}>{notice.text}</div>;
}

function AccountDetails() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ fullName: user.fullName, email: user.email, gender: user.gender || '' });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [uploading, setUploading] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (form.fullName.trim().length < 2) { setNotice({ ok: false, text: 'Please enter your full name.' }); return; }
    setBusy(true);
    setNotice(null);
    try {
      const updated = await authApi.updateProfile({ Fullname: form.fullName.trim(), email: form.email.trim(), gender: form.gender });
      setUser(updated);
      setEditing(false);
      setNotice({ ok: true, text: 'Your details were saved.' });
    } catch (err) {
      setNotice({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { setNotice({ ok: false, text: 'Choose a JPEG, PNG, WEBP or GIF image.' }); return; }
    if (file.size > MAX_AVATAR_BYTES) { setNotice({ ok: false, text: 'Your photo must be 2 MB or smaller.' }); return; }
    setUploading(true);
    setNotice(null);
    try {
      const { avatarUrl } = await uploadsApi.uploadAvatar(file);
      setUser({ ...user, avatarUrl });
      setNotice({ ok: true, text: 'Profile photo updated.' });
    } catch (err) {
      setNotice({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="form-card profile-card">
      <div className="profile-avatar-wrap">
        <div className="profile-avatar">{user.avatarUrl ? <ProductImage src={user.avatarUrl} alt="Profile" /> : (user.fullName || '?')[0]}</div>
        <label className="avatar-upload">{uploading ? 'Uploading…' : 'Change photo'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={upload} disabled={uploading} /></label>
      </div>
      <Notice notice={notice} />
      {editing ? (
        <form onSubmit={save}>
          <label className="field"><span>Full name</span><input name="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} maxLength={120} autoComplete="name" /></label>
          <label className="field"><span>Email (optional)</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
          <label className="field"><span>Gender (optional)</span>
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select>
          </label>
          <div className="address-actions">
            <button type="submit" className="gradient-btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { setEditing(false); setForm({ fullName: user.fullName, email: user.email, gender: user.gender || '' }); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <h2>{user.fullName}</h2>
          {user.email && <p>{user.email}</p>}
          <span className="role-chip">{ROLE_LABEL[user.role] || user.role}</span>
          <div className="profile-meta">
            <span><Icon name="user" /> {user.gender ? user.gender[0].toUpperCase() + user.gender.slice(1) : 'Gender not specified'}</span>
            <span>📞 {user.telephone || 'No phone number'}</span>
          </div>
          <button type="button" className="outline-btn" onClick={() => setEditing(true)}>Edit details</button>
          <p className="tiny">Your phone number is your sign-in. Contact support to change it.</p>
        </>
      )}
    </section>
  );
}

function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8) { setNotice({ ok: false, text: 'Your new password must be at least 8 characters.' }); return; }
    if (form.newPassword !== form.confirm) { setNotice({ ok: false, text: 'The new passwords do not match.' }); return; }
    setBusy(true);
    setNotice(null);
    try {
      const res = await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      // Other devices are signed out; keep this one signed in with the new token.
      if (res.token) {
        try { localStorage.setItem('huska_token', res.token); } catch { /* storage unavailable */ }
      }
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setNotice({ ok: true, text: res.message || 'Password updated.' });
    } catch (err) {
      setNotice({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="form-card">
      <h2>Change password</h2>
      <Notice notice={notice} />
      <form onSubmit={submit}>
        <label className="field"><span>Current password</span><input type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required /></label>
        <div className="two-col">
          <label className="field"><span>New password</span><input type="password" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required /></label>
          <label className="field"><span>Confirm new password</span><input type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required /></label>
        </div>
        <button type="submit" className="gradient-btn" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
        <p className="tiny">Forgot your current password? <Link to="/forgot-password">Reset it</Link>.</p>
      </form>
    </section>
  );
}

// Older addresses may hold a province name we no longer list; find it from the district.
const normalizeAddress = (a) => {
  if (PROVINCES.includes(a.provinceState)) return a;
  const province = PROVINCES.find((p) => RWANDA_LOCATIONS[p].some((d) => d.toLowerCase() === String(a.cityDistrict || '').toLowerCase()));
  const district = province && RWANDA_LOCATIONS[province].find((d) => d.toLowerCase() === String(a.cityDistrict).toLowerCase());
  return { ...a, provinceState: province || 'Kigali City', cityDistrict: district || '' };
};

function AddressForm({ initial, onSave, onCancel, busy }) {
  const [form, setForm] = useState(() => normalizeAddress(initial));
  const [error, setError] = useState('');
  // Changing the province clears a district that is not in it.
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => (key === 'provinceState' && !(RWANDA_LOCATIONS[value] || []).includes(f.cityDistrict)
      ? { ...f, provinceState: value, cityDistrict: '' }
      : { ...f, [key]: value }));
  };
  const districts = RWANDA_LOCATIONS[form.provinceState] || [];
  const submit = (e) => {
    e.preventDefault();
    if (!districts.includes(form.cityDistrict)) { setError('Choose your district.'); return; }
    if (form.street.trim().length < 3) { setError('Enter the street, house number or a nearby landmark.'); return; }
    if (!isRwandanPhone(form.phone)) { setError('Enter a Rwandan mobile number for delivery, for example 0788 123 456.'); return; }
    setError('');
    onSave({ ...form, country: 'Rwanda', cityDistrict: form.cityDistrict.trim(), street: form.street.trim() });
  };
  return (
    <form className="address-card" onSubmit={submit}>
      {error && <div className="form-alert error" role="alert">{error}</div>}
      <div className="two-col">
        <label className="field"><span>Label</span><select name="type" value={form.type} onChange={set('type')}>{ADDRESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="field"><span>Province / City</span><select name="provinceState" value={form.provinceState} onChange={set('provinceState')}>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></label>
      </div>
      <div className="two-col">
        <label className="field"><span>District</span>
          <select name="cityDistrict" value={form.cityDistrict} onChange={set('cityDistrict')} required>
            <option value="">Choose a district</option>
            {districts.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="field"><span>Sector (optional)</span><input name="sector" value={form.sector || ''} onChange={set('sector')} placeholder="e.g. Remera" /></label>
      </div>
      <div className="two-col">
        <label className="field"><span>Street / landmark</span><input name="street" value={form.street} onChange={set('street')} placeholder="e.g. KG 11 Ave" autoComplete="street-address" /></label>
        <label className="field"><span>House / building (optional)</span><input value={form.building || ''} onChange={set('building')} /></label>
      </div>
      <div className="two-col">
        <label className="field"><span>Phone for delivery</span><input name="phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="07xx xxx xxx" autoComplete="tel" /></label>
        <label className="field"><span>Delivery instructions (optional)</span><input value={form.deliveryInstructions || ''} onChange={set('deliveryInstructions')} maxLength={200} /></label>
      </div>
      <label className="filter-check"><input type="checkbox" checked={Boolean(form.isDefaultShipping)} onChange={set('isDefaultShipping')} /> Use as my default delivery address</label>
      <div className="address-actions">
        <button type="submit" className="gradient-btn" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function Addresses() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | address id
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    addressesApi.getAll()
      .then((res) => setAddresses(res.addresses || []))
      .catch((err) => setNotice({ ok: false, text: extractErrorMessage(err) }))
      .finally(() => setLoading(false));
  }, []);

  const run = async (action, successText) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await action();
      setAddresses(res.addresses || []);
      setEditing(null);
      if (successText) setNotice({ ok: true, text: successText });
    } catch (err) {
      setNotice({ ok: false, text: extractErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const remove = (a) => {
    if (!window.confirm('Remove this address?')) return;
    run(() => addressesApi.remove(a._id), 'Address removed.');
  };

  return (
    <section className="addresses">
      <div className="section-heading">
        <div><span className="eyebrow">DELIVERY</span><h2>Saved addresses</h2></div>
        {editing === null && addresses.length < 10 && <button type="button" className="gradient-btn" onClick={() => setEditing('new')}>+ Add address</button>}
      </div>
      <Notice notice={notice} />
      {loading && <p className="tiny">Loading addresses…</p>}
      {!loading && !addresses.length && editing === null && <div className="address-card"><p>No saved addresses yet. Add one to check out faster.</p></div>}
      {editing === 'new' && (
        <AddressForm initial={{ ...EMPTY_ADDRESS, phone: user.telephone || '', isDefaultShipping: addresses.length === 0 }} busy={busy}
          onCancel={() => setEditing(null)} onSave={(data) => run(() => addressesApi.add(data), 'Address saved.')} />
      )}
      {addresses.map((a) => (editing === a._id ? (
        <AddressForm key={a._id} initial={{ ...EMPTY_ADDRESS, ...a }} busy={busy} onCancel={() => setEditing(null)}
          onSave={(data) => run(() => addressesApi.update(a._id, data), 'Address updated.')} />
      ) : (
        <div className="address-card" key={a._id}>
          <div className="address-head"><h3>{ADDRESS_TYPES.find(([v]) => v === a.type)?.[1] || 'Address'}</h3><div>{a.isDefaultShipping && <span>DEFAULT</span>}</div></div>
          <p>{[a.street, a.building].filter(Boolean).join(', ')}<br />{[a.sector, a.cityDistrict, a.provinceState].filter(Boolean).join(', ')}<br />{a.phone}</p>
          <small>{a.deliveryInstructions || 'No delivery instructions'}</small>
          <div className="address-actions">
            <button type="button" onClick={() => setEditing(a._id)} disabled={busy}>Edit</button>
            {!a.isDefaultShipping && <button type="button" disabled={busy} onClick={() => run(() => addressesApi.update(a._id, { isDefaultShipping: true }), 'Default address updated.')}>Make default</button>}
            <button type="button" disabled={busy} onClick={() => remove(a)}>Remove</button>
          </div>
        </div>
      )))}
    </section>
  );
}

export default function Profile() {
  return <Storefront><main className="account-page">
    <div className="page-title"><span className="eyebrow">MY ACCOUNT</span><h1>Profile &amp; addresses</h1><p>Manage your account details, delivery addresses and password.</p></div>
    <div className="profile-grid">
      <div>
        <AccountDetails />
        <ChangePassword />
      </div>
      <Addresses />
    </div>
    <div className="account-links">
      <Link to="/orders"><Icon name="box" /> My orders</Link>
      <Link to="/wishlist"><Icon name="heart" /> Wishlist</Link>
      <Link to="/cart"><Icon name="cart" /> Cart</Link>
      <Link to="/buyer/refunds"><Icon name="wallet" /> Refunds &amp; problems</Link>
    </div>
  </main></Storefront>;
}
