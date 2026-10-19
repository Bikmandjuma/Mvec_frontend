import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../API/auth';
import { disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('huska_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      localStorage.removeItem('huska_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  // The login is shared by every tab of this browser. When another tab signs
  // in as a different account (or signs out), follow it here too; otherwise
  // this tab keeps showing the old account's pages while every request is
  // made as the new one ("User role 'vendor' is not authorized…").
  const [switchNotice, setSwitchNotice] = useState('');
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== 'huska_token' && e.key !== null) return;
      disconnectSocket();
      if (!localStorage.getItem('huska_token')) {
        setUser(null);
        setSwitchNotice('You signed out in another tab.');
        return;
      }
      const before = user?.id;
      loadMe().then(() => setSwitchNotice(before ? 'You signed in with a different account in another tab, so this tab switched to it.' : ''));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadMe, user?.id]);
  useEffect(() => {
    if (!switchNotice) return undefined;
    const t = setTimeout(() => setSwitchNotice(''), 8000);
    return () => clearTimeout(t);
  }, [switchNotice]);

  function persistSession({ token, user: u }) {
    localStorage.setItem('huska_token', token);
    setUser(u);
  }

  async function login(identity, password) {
    const data = await authApi.login(identity, password);
    persistSession(data);
    return data.user;
  }

  async function loginWithGoogle(idToken, role) {
    const data = await authApi.googleLogin(idToken, role);
    persistSession(data);
    return data.user;
  }

  async function register(payload) {
    const data = await authApi.register(payload);
    persistSession(data);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('huska_token');
    // Personal data that must not be left behind for the next person using
    // this browser. The server-side cart stays on the account.
    sessionStorage.removeItem('mvec_checkout_form');
    localStorage.removeItem('mvec_profile_image');
    disconnectSocket();
    setUser(null);
  }

  async function refresh() {
    const me = await authApi.me();
    setUser(me);
    return me;
  }

  // Account settings: merge profile changes, or swap in a fresh token after a
  // password change / "sign out everywhere".
  const updateUser = (patch) => setUser(u => (u ? { ...u, ...patch } : u));
  const replaceToken = (token) => { if (token) localStorage.setItem('huska_token', token); };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, startSession: persistSession, logout, refresh, setUser, updateUser, replaceToken }}>
      {switchNotice && <div className="account-switch-notice" role="status">{switchNotice}</div>}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
