import { useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";
import GoogleButton from "../components/GoogleButton";
import { extractErrorMessage } from "../API/client";
import { authApi } from "../API/auth";
import { useAuth } from "../context/AuthContext";
import { afterSignIn, safeRedirect } from "../utils/redirect";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { login, loginWithGoogle, startSession } = useAuth();
  const [form, setForm] = useState({ identity: "", password: "" });
  const [error, setError] = useState(params.get("blocked") ? "Your account is blocked or suspended. Contact MVEC support." : "");
  const [loading, setLoading] = useState(false);
  const returnTo = safeRedirect(location.state?.from) || safeRedirect(params.get("next"));
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  // Guests (and buyers who prefer it) log in with a one-time code.
  const [codeLogin, setCodeLogin] = useState(null); // { phone, code, sent, sentTo }

  async function sendLoginCode(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.guestSendCode(codeLogin.phone.trim());
      setCodeLogin((c) => ({ ...c, sent: true, sentTo: res.message || "" }));
    } catch (err) {
      if (err.response?.status === 429) setCodeLogin((c) => ({ ...c, sent: true }));
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function verifyLoginCode(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await authApi.guestVerify({ phone: codeLogin.phone.trim(), code: codeLogin.code.trim() });
      startSession(session);
      navigate(afterSignIn(session.user, returnTo || "/orders"), { replace: true });
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(/full name/i.test(message) ? "No order or account uses this number yet. Shop and check out to get started." : message);
    } finally {
      setLoading(false);
    }
  }

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
      navigate(afterSignIn(user, returnTo), { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(idToken) {
    setError("");
    setLoading(true);
    try {
      const user = await loginWithGoogle(idToken);
      navigate(afterSignIn(user, returnTo), { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, "Google sign-in failed. Try again or use your password."));
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
      {codeLogin
        ? <form onSubmit={codeLogin.sent ? verifyLoginCode : sendLoginCode} className="auth-form code-login" noValidate>
            <FormField label="Phone number" name="codePhone" placeholder="0788 123 456" value={codeLogin.phone} onChange={(e) => setCodeLogin((c) => ({ ...c, phone: e.target.value, sent: false }))} autoComplete="tel" />
            {codeLogin.sent && <FormField label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" value={codeLogin.code} onChange={(e) => setCodeLogin((c) => ({ ...c, code: e.target.value.replace(/\D/g, "").slice(0, 6) }))} />}
            {codeLogin.sent && codeLogin.sentTo && <p className="tiny" role="status">{codeLogin.sentTo}</p>}
            <button className="submit-btn" type="submit" disabled={loading}>{loading ? "Please wait…" : codeLogin.sent ? "Log in" : "Send me a code"}</button>
            <button type="button" className="text-btn" onClick={() => setCodeLogin(null)}>Use my password instead</button>
          </form>
        : <p className="switch-text">Ordered as a guest? <button type="button" className="text-btn" onClick={() => { setError(""); setCodeLogin({ phone: "", code: "", sent: false }); }}>Log in with a code</button></p>}
      <GoogleButton onCredential={handleGoogle} onError={() => setError("Google sign-in was cancelled or failed. Try again.")} />
      <p className="switch-text">
        Don&apos;t have an account? <Link to="/signup" state={location.state || (returnTo ? { from: returnTo } : undefined)}>Create one</Link>
      </p>
      <button type="button" className="back-home" onClick={() => navigate("/")}>
        ← Back to home
      </button>
    </AuthLayout>
  );
}
