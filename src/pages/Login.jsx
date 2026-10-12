import { useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";
import { extractErrorMessage } from "../API/client";
import { useAuth } from "../context/AuthContext";
import { homeForRole, safeRedirect } from "../utils/redirect";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { login } = useAuth();
  const [form, setForm] = useState({ identity: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const returnTo = safeRedirect(location.state?.from) || safeRedirect(params.get("next"));
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.identity.trim() || !form.password) {
      setError("Enter your email or phone number and your password.");
      return;
    }
    setLoading(true);
    try {
      const user = await login(form.identity.trim(), form.password);
      // Go back to where the user was (e.g. checkout), otherwise to their home.
      navigate(returnTo || homeForRole(user.role), { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle={location.state?.checkoutReturn ? "Log in to finish your order. Your cart is kept." : "Log in to continue shopping or managing your store."}>
      {error && <div className="form-alert error" role="alert">{error}</div>}
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <FormField label="Email or phone number" name="identity" placeholder="you@example.com or 0788 123 456" value={form.identity} onChange={update} autoComplete="username" />
        <FormField label="Password" name="password" type="password" placeholder="Enter your password" value={form.password} onChange={update} autoComplete="current-password" />
        <div className="form-row">
          <span />
          <Link to="/forgot-password" className="text-btn">Forgot password?</Link>
        </div>
        <button className="submit-btn" type="submit" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="switch-text">
        Don&apos;t have an account? <Link to="/signup" state={location.state || (returnTo ? { from: returnTo } : undefined)}>Create one</Link>
      </p>
      <button type="button" className="back-home" onClick={() => navigate("/")}>
        ← Back to home
      </button>
    </AuthLayout>
  );
}
