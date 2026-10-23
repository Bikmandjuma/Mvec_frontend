// Global search for every portal (⌘K / Ctrl+K or "/"). Searches the pages and
// quick actions you can use, plus your live records from the server (orders,
// products, customers, users… depending on role and staff access). Keyboard:
// ↑ ↓ to move, Enter to open, Esc to close.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { searchApi } from '../API/search';
import { navGroupsForRole } from '../data/navItems';
import { staffCan } from '../data/staffAccess';
import { useTheme } from '../context/ThemeContext';
import { resolveImageUrl } from '../utils/imageUrl';

const RECENT_KEY = 'mvec_recent_searches';
const MAX_RECENT = 6;

const QUICK_ACTIONS = {
  vendor: [
    ['Add a product', '/vendor/products', 'plus', 'products new item catalog'],
    ['Record a manual order', '/vendor/orders', 'cart', 'manual order phone walk-in'],
    ['Create a promotion', '/vendor/promotions', 'tag', 'coupon discount code'],
    ['Request a payout', '/vendor/payouts', 'wallet', 'withdraw money'],
    ['Add a team member', '/vendor/team', 'users', 'staff employee'],
  ],
  super_admin: [
    ['Review seller payouts', '/admin/vendor-payouts', 'wallet', 'withdrawals approve'],
    ['Review ad campaigns', '/admin/advertising', 'tag', 'ads approve'],
    ['Open disputes', '/admin/disputes', 'bell', 'refund arbitration'],
  ],
  supplier: [['Add a wholesale product', '/supplier/products', 'plus', 'catalog']],
  affiliate: [['Create a referral link', '/affiliate/links', 'plus', 'link share']],
};

const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, MAX_RECENT); } catch { return []; } };
const saveRecent = term => {
  try {
    const list = [term, ...readRecent().filter(t => t.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* storage unavailable */ }
};

function Highlight({ text, term }) {
  const s = String(text || '');
  const i = term ? s.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (i < 0) return s;
  return <>{s.slice(0, i)}<mark>{s.slice(i, i + term.length)}</mark>{s.slice(i + term.length)}</>;
}

export default function CommandPalette({ open, onClose, admin, user, onLogout }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [term, setTerm] = useState('');
  const [remote, setRemote] = useState({ query: '', groups: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState(readRecent);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const seq = useRef(0);
  const role = admin ? 'super_admin' : user?.role;
  const query = term.trim();

  useEffect(() => {
    if (!open) return undefined;
    setTerm(''); setRemote({ query: '', groups: [] }); setActive(0); setRecent(readRecent()); setError('');
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); document.body.style.overflow = prev; };
  }, [open]);

  // Live records from the server, debounced; stale responses are ignored.
  useEffect(() => {
    if (!open || query.length < 2) { setRemote({ query: '', groups: [] }); setLoading(false); return undefined; }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      searchApi.portal(query)
        .then(res => { if (id === seq.current) { setRemote({ query, groups: res.groups || [] }); setError(''); } })
        .catch(() => { if (id === seq.current) { setRemote({ query, groups: [] }); setError('Live results are unavailable right now.'); } })
        .finally(() => { if (id === seq.current) setLoading(false); });
    }, 220);
    return () => clearTimeout(t);
  }, [query, open]);

  const pages = useMemo(() => navGroupsForRole(user?.role, admin)
    .flatMap(g => g.items.filter(([href]) => admin || staffCan(user, href)).map(([href, label, icon]) => ({ href, label, icon, group: g.label }))), [user, admin]);

  const actions = useMemo(() => {
    const own = (QUICK_ACTIONS[role] || []).filter(([, href]) => admin || staffCan(user, href));
    const profile = admin ? '/admin/profile' : { vendor: '/vendor/profile', supplier: '/supplier/profile', affiliate: '/affiliate/profile', delivery: '/delivery/profile' }[user?.role] || '/profile';
    return [
      ...own.map(([label, href, icon, words]) => ({ label, href, icon, words })),
      { label: 'Account settings', href: profile, icon: 'user', words: 'profile password photo address' },
      { label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', run: toggleTheme, icon: theme === 'dark' ? 'sun' : 'moon', words: 'theme dark light appearance' },
      { label: 'View marketplace', href: '/', icon: 'home', words: 'store shop storefront' },
      { label: 'Sign out', run: onLogout, icon: 'logout', words: 'logout log out exit' },
    ];
  }, [role, user, admin, theme, toggleTheme, onLogout]);

  // Flat list of selectable rows, in display order, grouped for rendering.
  const sections = useMemo(() => {
    const lower = query.toLowerCase();
    const hit = (...parts) => parts.join(' ').toLowerCase().includes(lower);
    const out = [];
    if (!query) {
      if (recent.length) out.push({ key: 'recent', label: 'Recent searches', items: recent.map(t => ({ kind: 'recent', id: `r-${t}`, title: t, icon: 'search', fill: t })) });
      out.push({ key: 'actions', label: 'Quick actions', items: actions.map(a => ({ kind: 'action', id: `a-${a.label}`, title: a.label, icon: a.icon, href: a.href, run: a.run })) });
      out.push({ key: 'pages', label: 'Go to', items: pages.slice(0, 8).map(p => ({ kind: 'page', id: `p-${p.href}`, title: p.label, subtitle: p.group, icon: p.icon, href: p.href })) });
      return out;
    }
    const pageHits = pages.filter(p => hit(p.label, p.group)).slice(0, 5);
    if (pageHits.length) out.push({ key: 'pages', label: 'Pages', items: pageHits.map(p => ({ kind: 'page', id: `p-${p.href}`, title: p.label, subtitle: p.group, icon: p.icon, href: p.href })) });
    const actionHits = actions.filter(a => hit(a.label, a.words || '')).slice(0, 4);
    if (actionHits.length) out.push({ key: 'actions', label: 'Actions', items: actionHits.map(a => ({ kind: 'action', id: `a-${a.label}`, title: a.label, icon: a.icon, href: a.href, run: a.run })) });
    if (remote.query === query) {
      remote.groups.forEach(g => out.push({ key: g.key, label: g.label, items: g.items.map(it => ({ ...it, kind: 'record', id: `${g.key}-${it.id}` })) }));
    }
    out.push({ key: 'market', label: 'Marketplace', items: [{ kind: 'market', id: 'market', title: `Search the marketplace for “${query}”`, icon: 'shop', href: `/shop?q=${encodeURIComponent(query)}` }] });
    return out;
  }, [query, recent, actions, pages, remote]);

  const flat = useMemo(() => sections.flatMap(s => s.items), [sections]);
  useEffect(() => { setActive(0); }, [query, remote]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = item => {
    if (!item) return;
    if (item.kind === 'recent') { setTerm(item.fill); inputRef.current?.focus(); return; }
    if (query.length >= 2 && item.kind !== 'action') saveRecent(query);
    onClose();
    if (item.run) item.run();
    else if (item.href) navigate(item.href);
  };

  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(flat[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'Tab') { e.preventDefault(); setActive(i => (e.shiftKey ? Math.max(0, i - 1) : Math.min(flat.length - 1, i + 1))); }
  };

  if (!open) return null;
  let index = -1;
  const recordCount = remote.query === query ? remote.groups.reduce((t, g) => t + g.items.length, 0) : 0;

  return createPortal(<div className="cmdk-backdrop" onMouseDown={onClose}>
    <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={e => e.stopPropagation()}>
      <div className="cmdk-input">
        <Icon name="search" size={19} />
        <input ref={inputRef} value={term} onChange={e => setTerm(e.target.value)} onKeyDown={onKey}
          placeholder={role === 'super_admin' ? 'Search users, sellers, orders, products, disputes…' : role === 'vendor' ? 'Search orders, products, customers, promotions…' : 'Search pages and records…'}
          role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={flat[active] ? `cmdk-${active}` : undefined} autoComplete="off" spellCheck="false" />
        {loading && <span className="cmdk-spinner" aria-label="Searching" />}
        {term && !loading && <button type="button" className="cmdk-clear" onClick={() => { setTerm(''); inputRef.current?.focus(); }} aria-label="Clear search">×</button>}
        <kbd className="cmdk-esc" onClick={onClose}>esc</kbd>
      </div>

      <div className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
        {query.length === 1 && <p className="cmdk-hint">Keep typing to search your records…</p>}
        {sections.map(section => <div className="cmdk-section" key={section.key} role="group" aria-label={section.label}>
          <div className="cmdk-section-head">
            <span>{section.label}</span>
            {section.key === 'recent' && <button type="button" onClick={() => { try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ } setRecent([]); }}>Clear</button>}
          </div>
          {section.items.map(item => {
            index += 1;
            const i = index;
            return <div key={item.id} id={`cmdk-${i}`} data-index={i} role="option" aria-selected={i === active}
              className={'cmdk-item' + (i === active ? ' active' : '')} onMouseMove={() => active !== i && setActive(i)} onClick={() => choose(item)}>
              <span className={`cmdk-icon kind-${item.kind}`}>{item.image ? <img src={resolveImageUrl(item.image)} alt="" /> : <Icon name={item.icon || 'arrow'} size={16} />}</span>
              <span className="cmdk-text">
                <b><Highlight text={item.title} term={item.kind === 'market' ? '' : query} /></b>
                {item.subtitle && <small><Highlight text={item.subtitle} term={query} /></small>}
              </span>
              {item.badge && <em className="cmdk-badge">{item.badge}</em>}
              <span className="cmdk-enter" aria-hidden="true">↵</span>
            </div>;
          })}
        </div>)}
        {query.length >= 2 && !loading && remote.query === query && recordCount === 0 && !error && <p className="cmdk-hint">No records match “{query}”. Try an order number, a name, a phone number or a product.</p>}
        {error && <p className="cmdk-hint">{error}</p>}
      </div>

      <div className="cmdk-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>esc</kbd> close</span>
        <span className="cmdk-foot-right">{query.length >= 2 && remote.query === query ? `${recordCount} record${recordCount === 1 ? '' : 's'}` : 'MVEC search'}</span>
      </div>
    </div>
  </div>, document.body);
}
