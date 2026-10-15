import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import FormField from '../components/FormField';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { vendorsApi } from '../API/vendors';
import { extractErrorMessage } from '../API/client';

export default function BecomeSeller() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: '',
    phone: user?.telephone || '',
    email: user?.email || '',
    description: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const alreadySeller = Boolean(user?.isSellerEnabled);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await vendorsApi.becomeSeller(form);
      setUser((u) => ({ ...u, isSellerEnabled: true }));
      navigate('/vendor');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout admin>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SELLER MODE</span>
          <h1>Become a Seller</h1>
          <p>
            Open your own vendor storefront on MVEC while keeping full Super Administrator access.
            Your admin role and permissions never change.
          </p>
        </div>
      </div>

      {alreadySeller ? (
        <div className="data-card become-seller-card">
          <div className="become-seller-hero">
            <div className="become-seller-icon"><Icon name="shop" size={30} /></div>
            <div>
              <h3>You're already selling on MVEC</h3>
              <p>Your vendor storefront is active. Jump into your seller dashboard to manage products, orders and payouts.</p>
            </div>
          </div>
          <button className="gradient-btn" onClick={() => navigate('/vendor')}>
            <Icon name="grid" /> Go to my Seller Dashboard
          </button>
        </div>
      ) : (
        <div className="data-card become-seller-card">
          <form onSubmit={submit} className="become-seller-form">
            {error && <div className="form-error">{error}</div>}
            <FormField label="Business / store name" name="businessName" placeholder="e.g. MVEC Official Store" value={form.businessName} onChange={update} />
            <FormField label="Business phone" name="phone" placeholder="0788123456" value={form.phone} onChange={update} />
            <FormField label="Business email" name="email" type="email" placeholder="store@example.com" value={form.email} onChange={update} />
            <label className="field">
              <span>Short description (optional)</span>
              <textarea name="description" rows={3} placeholder="What will you sell on MVEC?" value={form.description} onChange={update} />
            </label>
            <button className="gradient-btn" type="submit" disabled={busy}>
              {busy ? 'Setting up your store…' : 'Activate Seller Mode'}
            </button>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
