// Affiliate referral: an affiliate link (?ref=CODE on any storefront page) is
// counted once and remembered for 30 days, then sent with the buyer's order so
// the affiliate is credited.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { affiliatesApi } from '../API/affiliates';

const KEY = 'mvec_referral';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function getReferralCode() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.code && Date.now() - saved.at < TTL_MS) return saved.code;
  } catch { /* storage unavailable */ }
  return null;
}

export function ReferralCapture() {
  const { search } = useLocation();
  useEffect(() => {
    const code = new URLSearchParams(search).get('ref');
    if (!code || !/^[A-Za-z0-9_-]{3,60}$/.test(code)) return;
    if (getReferralCode() === code) return;
    affiliatesApi.trackClick(code)
      .then(res => {
        if (res?.data?.FraudGuardFlagged) return;
        try { localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* storage unavailable */ }
      })
      .catch(() => {});
  }, [search]);
  return null;
}
