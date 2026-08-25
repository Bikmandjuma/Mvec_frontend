import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import GoogleButton from '../components/GoogleButton';
import FormField from '../components/FormField';

export default function Signup() {
  const [form, setForm] = useState({
    fullName: '',
    telephone: '',
    email: '',
    gender: '',
    role: '',
    companyName: '',
    password: '',
    confirmPassword: ''
  });

  const update = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submit = (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    alert(`Account form ready. Selected role: ${form.role || 'not selected'}`);
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join MVEC as a buyer or start selling your products."
    >
      <GoogleButton />

      <div className="or-divider">
        <span>OR</span>
      </div>

      <form onSubmit={submit} className="auth-form">
        <FormField
          label="Full name"
          name="fullName"
          placeholder="Enter your full name"
          value={form.fullName}
          onChange={update}
        />

        <div className="two-col">
          <FormField
            label="Telephone"
            name="telephone"
            type="tel"
            placeholder="+250 7xx xxx xxx"
            value={form.telephone}
            onChange={update}
          />

          <FormField
            label="Email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={update}
          />
        </div>

        <div className="two-col">
          <label className="field">
            <span>Gender</span>
            <select
              name="gender"
              value={form.gender}
              onChange={update}
              required
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </label>

          <label className="field">
            <span>Account type</span>
            <select
              name="role"
              value={form.role}
              onChange={update}
              required
            >
              <option value="">Choose role</option>
              <option value="buyer">Buyer</option>
              <option value="vendor">Vendor</option>
            </select>
          </label>
        </div>

        {/* Company name field appears only for vendors */}
        {form.role === 'vendor' && (
          <FormField
            label="Company name"
            name="companyName"
            placeholder="Enter your company name"
            value={form.companyName}
            onChange={update}
            required
          />
        )}

        {/* Password fields */}
        <div className="two-col">
          <FormField
            label="Create password"
            name="password"
            type="password"
            placeholder="Create a password"
            value={form.password}
            onChange={update}
            required
          />

          <FormField
            label="Verify password"
            name="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            value={form.confirmPassword}
            onChange={update}
            required
          />
        </div>

        <div className="role-info">
          <div className="role-icon">◎</div>
          <div>
            <strong>
              {form.role === 'vendor'
                ? 'Vendor account'
                : form.role === 'buyer'
                ? 'Buyer account'
                : 'Choose your account type'}
            </strong>

            <p>
              {form.role === 'vendor'
                ? 'Sell products, manage your store and reach customers.'
                : form.role === 'buyer'
                ? 'Browse products, place orders and manage your purchases.'
                : 'Your selection helps MVEC give you the right marketplace experience.'}
            </p>
          </div>
        </div>

        <button className="submit-btn" type="submit">
          Create account
        </button>
      </form>

      <p className="switch-text">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}