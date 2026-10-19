import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";
import GoogleButton from "../components/GoogleButton";
import { useAuth } from "../context/AuthContext";
import { extractErrorMessage } from "../API/client";
import { isRwandanPhone } from "../utils/delivery";
import { afterSignIn, safeRedirect } from "../utils/redirect";

const ROLES = ["buyer", "vendor", "supplier", "affiliate"];

export default function Signup() {
  const navigate = useNavigate(),
    location = useLocation();
  const { register, loginWithGoogle } = useAuth();
  const [form, setForm] = useState({
    fullName: "",
    telephone: "",
    email: "",
    gender: "",
    role: ROLES.includes(location.state?.role) ? location.state.role : "buyer",
    companyName: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (form.fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!isRwandanPhone(form.telephone)) {
      setError("Enter a Rwandan mobile number, for example 0788 123 456.");
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Enter a valid email address or leave it empty.");
      return;
    }
    if (["vendor", "supplier"].includes(form.role) && !form.companyName.trim()) {
      setError("Please enter your business name.");
      return;
    }
    if (form.password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { confirmPassword: _, ...payload } = form;
      const user = await register({ ...payload, fullName: form.fullName.trim(), email: form.email.trim() || undefined, gender: form.gender || undefined });
      const returnTo = safeRedirect(location.state?.from);
      navigate(afterSignIn(user, returnTo), { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  // Google sign-up creates the account with the role picked above.
  async function handleGoogle(idToken) {
    setError("");
    setLoading(true);
    try {
      const user = await loginWithGoogle(idToken, form.role);
      const returnTo = safeRedirect(location.state?.from);
      navigate(afterSignIn(user, returnTo), { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, "Google sign-up failed. Try again or fill in the form."));
    } finally {
      setLoading(false);
    }
  }

  const roleText = {
    buyer: [
      "Buyer account",
      "Browse products, place orders and manage your purchases.",
    ],
    vendor: [
      "Vendor account",
      "Create a store, sell products and reach customers.",
    ],
    supplier: [
      "Supplier account",
      "List wholesale products and reach customers.",
    ],
    affiliate: [
      "Affiliate account",
      "Promote products and earn commission on qualifying sales.",
    ],
  };
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join MVEC with your phone number. Email is optional."
    >
      {error && <div className="form-alert error" role="alert">{error}</div>}
      <form onSubmit={submit} className="auth-form" noValidate>
        <FormField
          label="Full name"
          name="fullName"
          placeholder="Enter your full name"
          value={form.fullName}
          onChange={update}
          autoComplete="name"
          maxLength={120}
        />
        <FormField
          label="Telephone"
          name="telephone"
          type="tel"
          placeholder="0788 123 456"
          value={form.telephone}
          onChange={update}
          autoComplete="tel"
        />
        <FormField
          label="Email (optional)"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={update}
          required={false}
          autoComplete="email"
        />
        <div className="two-col">
          <label className="field">
            <span>Gender (optional)</span>
            <select name="gender" value={form.gender} onChange={update}>
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="field">
            <span>Account type</span>
            <select name="role" value={form.role} onChange={update}>
              <option value="buyer">Buyer</option>
              <option value="vendor">Vendor</option>
              <option value="supplier">Supplier</option>
              <option value="affiliate">Affiliate marketer</option>
            </select>
          </label>
        </div>
        {["vendor", "supplier"].includes(form.role) && (
          <FormField
            label={
              form.role === "supplier"
                ? "Business name"
                : "Store / company name"
            }
            name="companyName"
            placeholder="Enter business name"
            value={form.companyName}
            onChange={update}
            required
          />
        )}
        <div className="two-col">
          <FormField
            label="Create password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={update}
            autoComplete="new-password"
            minLength={8}
          />
          <FormField
            label="Verify password"
            name="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            value={form.confirmPassword}
            onChange={update}
            autoComplete="new-password"
          />
        </div>
        <div className="role-info">
          <div className="role-icon">◎</div>
          <div>
            <strong>{roleText[form.role][0]}</strong>
            <p>{roleText[form.role][1]}</p>
          </div>
        </div>
        <button className="submit-btn" type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <GoogleButton text="signup_with" onCredential={handleGoogle} onError={() => setError("Google sign-up was cancelled or failed. Try again.")} />
      <p className="switch-text">
        Already have an account?{" "}
        <Link to="/login" state={location.state}>
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
