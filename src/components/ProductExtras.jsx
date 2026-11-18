import { useEffect, useState } from 'react';
import { productsApi } from '../API/products';
import { extractErrorMessage } from '../API/client';

/** Ticks every second until `to`; returns "2h 05m 09s", or "" once it has passed. */
export function useCountdown(to) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!to) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [to]);
  const left = to ? new Date(to).getTime() - now : 0;
  if (!(left > 0)) return '';
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return d ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${sec}s`;
}

/** "Flash deal −30% · ends in 2h 05m" (or "starts in …"), with units left. */
export function DealTag({ deal, compact = false }) {
  const ends = useCountdown(deal?.live ? deal.endsAt : deal?.startsAt);
  if (!deal || !ends) return null;
  return (
    <span className={`deal-tag${deal.live ? '' : ' upcoming'}${compact ? ' compact' : ''}`}>
      <b>{deal.live ? `Flash deal −${deal.percentOff}%` : `Deal −${deal.percentOff}% soon`}</b>
      <span>{deal.live ? `ends in ${ends}` : `starts in ${ends}`}{deal.left != null && !compact ? ` · ${deal.left} left` : ''}</span>
    </span>
  );
}

/** Earned seller badges: Verified, Top rated, Ships fast, New seller. */
export function SellerBadges({ badges = [] }) {
  if (!badges.length) return null;
  return (
    <div className="seller-badges">
      {badges.map((b) => <span key={b.code} className={`seller-badge ${b.code.toLowerCase()}`} title={b.hint}>{b.code === 'VERIFIED' ? '✓ ' : ''}{b.label}</span>)}
    </div>
  );
}

/**
 * Pick one value per option (Color, Size…). Values that would lead to no
 * variant in stock are shown crossed out. Calls onChange(variant | null).
 */
export function VariantPicker({ options = [], variants = [], value, onChange }) {
  const [chosen, setChosen] = useState(() => (value ? { ...value.options } : {}));
  useEffect(() => { setChosen(value ? { ...value.options } : {}); }, [value]);
  const matchFor = (picks) => variants.find((v) => options.every((o) => picks[o.name] && v.options[o.name] === picks[o.name])) || null;
  const pick = (name, val) => {
    const next = { ...chosen, [name]: chosen[name] === val ? undefined : val };
    setChosen(next);
    onChange(matchFor(next));
  };
  const possible = (name, val) => variants.some((v) => v.options[name] === val && v.stockQuantity > 0
    && options.every((o) => o.name === name || !chosen[o.name] || v.options[o.name] === chosen[o.name]));
  return (
    <div className="variant-picker">
      {options.map((o) => (
        <div key={o.name} className="variant-group">
          <small>{o.name}{chosen[o.name] ? `: ${chosen[o.name]}` : ''}</small>
          <div className="variant-values">
            {o.values.map((val) => (
              <button type="button" key={val} className={'variant-value' + (chosen[o.name] === val ? ' active' : '') + (possible(o.name, val) ? '' : ' unavailable')}
                aria-pressed={chosen[o.name] === val} onClick={() => pick(o.name, val)}>{val}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Tell me when it's back" (sold out) and "Tell me if the price drops", for signed-in buyers. */
export function StockAlerts({ productId, soldOut, signedIn, onSignIn }) {
  const [on, setOn] = useState({ BACK_IN_STOCK: false, PRICE_DROP: false });
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!signedIn || !productId) return;
    productsApi.alertsOn(productId).then(setOn).catch(() => {});
  }, [productId, signedIn]);
  const toggle = async (kind) => {
    if (!signedIn) { onSignIn(); return; }
    try {
      const res = on[kind] ? await productsApi.unwatch(productId, kind) : await productsApi.watch(productId, kind);
      setOn((x) => ({ ...x, [kind]: !x[kind] }));
      setNote(res.message || '');
    } catch (err) { setNote(extractErrorMessage(err)); }
  };
  return (
    <div className="stock-alerts">
      {soldOut && <button type="button" className={'outline-btn compact-btn' + (on.BACK_IN_STOCK ? ' wishlist-saved' : '')} onClick={() => toggle('BACK_IN_STOCK')}>🔔 {on.BACK_IN_STOCK ? "We'll tell you when it's back" : "Tell me when it's back"}</button>}
      <button type="button" className={'outline-btn compact-btn' + (on.PRICE_DROP ? ' wishlist-saved' : '')} onClick={() => toggle('PRICE_DROP')}>↓ {on.PRICE_DROP ? 'Watching the price' : 'Tell me if the price drops'}</button>
      {note && <small className="tiny">{note}</small>}
    </div>
  );
}
