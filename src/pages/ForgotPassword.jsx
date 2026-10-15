import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import { authApi } from '../API/auth';
import { extractErrorMessage } from '../API/client';

// The account can be found by email or by phone number.
const identityPayload = (value) => {
  const v = value.trim();
  return v.includes('@') ? { email: v } : { phone: v };
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState('');

  const sendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('Enter the email or phone number on your MVEC account.');
      return;
    }

    setBusy(true);
    try {
      const res = await authApi.forgotPassword(identityPayload(email));
      setDevCode(res.devCode || '');
      setOtp(['', '', '', '', '', '']);
      setStep(2);
      setMessage(res.message || `If an account uses ${email.trim()}, we sent it a 6-digit code.`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);

    if (digit && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const entered = otp.join('');
    if (entered.length !== 6) {
      setError('Enter the complete 6-digit code.');
      return;
    }

    setBusy(true);
    try {
      const res = await authApi.verifyResetOtp({ ...identityPayload(email), code: entered });
      setResetToken(res.resetToken);
      setStep(3);
      setMessage('Code verified. Choose your new password.');
    } catch (err) {
      // Wrong or expired code: stay on this step so the person can try again.
      setError(extractErrorMessage(err) || 'That code is incorrect. Please try again.');
      setOtp(['', '', '', '', '', '']);
      document.getElementById('otp-0')?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resetPasswordForm = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 8) {
      setError('Your new password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await authApi.resetPassword(resetToken, password);
      setMessage('Password reset. You were signed out on other devices. Log in with your new password.');
      setTimeout(() => navigate('/login'), 1600);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await authApi.forgotPassword(identityPayload(email));
      setDevCode(res.devCode || '');
      setOtp(['', '', '', '', '', '']);
      setMessage(`A new code was sent to ${email.trim()}.`);
      document.getElementById('otp-0')?.focus();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={
        step === 1
          ? 'Forgot your password?'
          : step === 2
            ? 'Verify your identity'
            : 'Create a new password'
      }
      subtitle={
        step === 1
          ? 'Enter the email or phone number on your MVEC account. We will send you a 6-digit code.'
          : step === 2
            ? `Enter the 6-digit code we sent to ${email}.`
            : 'Choose a strong password that you have not used before.'
      }
    >
      <div className="reset-steps">
        <div className={`reset-step ${step >= 1 ? 'active' : ''}`}>
          <span>1</span><small>Account</small>
        </div>
        <div className={`reset-line ${step >= 2 ? 'active' : ''}`} />
        <div className={`reset-step ${step >= 2 ? 'active' : ''}`}>
          <span>2</span><small>Code</small>
        </div>
        <div className={`reset-line ${step >= 3 ? 'active' : ''}`} />
        <div className={`reset-step ${step >= 3 ? 'active' : ''}`}>
          <span>3</span><small>Password</small>
        </div>
      </div>

      {error && <div className="form-alert error">{error}</div>}
      {message && <div className="form-alert success">{message}</div>}

      {step === 1 && (
        <form onSubmit={sendOtp} className="auth-form">
          <FormField
            label="Email or phone number"
            name="identity"
            placeholder="you@example.com or 0788 123 456"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />

          <div className="security-note">
            <div className="security-icon">✉</div>
            <div>
              <strong>Why do we need verification?</strong>
              <p>MVEC sends a one-time code to your email or phone to make sure you own the account before you change the password. The code expires after 15 minutes.</p>
            </div>
          </div>

          <button className="submit-btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={verifyOtp} className="auth-form">
          <div className="otp-group">
            <label>Verification code</label>
            <div className="otp-inputs">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  inputMode="numeric"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  aria-label={`OTP digit ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {devCode && <div className="demo-otp">
            <span>Development verification code</span>
            <strong>{devCode}</strong>
          </div>}

          <button className="submit-btn" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify code'}</button>

          <button type="button" className="text-btn centered-btn" onClick={resendOtp} disabled={busy}>
            Didn't receive the code? Send again
          </button>

          <button type="button" className="back-step" onClick={() => { setStep(1); setError(''); setMessage(''); }}>
            ← Use a different email or phone
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={resetPasswordForm} className="auth-form">
          <FormField
            label="New password"
            name="newPassword"
            type="password"
            placeholder="Enter your new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <FormField
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <div className="password-rules">
            <strong>Password requirements</strong>
            <span>• At least 8 characters</span>
            <span>• Use a mix of letters and numbers</span>
            <span>• Avoid using an old password</span>
          </div>

          <button className="submit-btn" type="submit" disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</button>
        </form>
      )}

      <p className="switch-text">
        Remember your password? <Link to="/login">Back to login</Link>
      </p>

      <button className="back-home" onClick={() => navigate('/')}>← Back to home</button>
    </AuthLayout>
  );
}
