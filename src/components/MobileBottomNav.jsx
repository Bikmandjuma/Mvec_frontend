import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { navForRole, mobilePrimaryByRole } from '../data/navItems';

// Public (storefront) bottom nav, exactly 5 items, no "More" needed.
const PUBLIC_ITEMS = [
  ['/', 'Home', 'home'],
  ['/shop', 'Shop', 'grid'],
  ['/cart', 'Cart', 'cart'],
  ['/wishlist', 'Wishlist', 'heart'],
];

const DASH_PREFIXES = ['/admin', '/vendor', '/supplier', '/affiliate', '/delivery'];
const MOBILE_BREAKPOINT = '(max-width: 900px)';

/**
 * True mobile-viewport gate. The bottom nav (and its "More" sheet, which
 * contains a link for every remaining nav item) must NEVER exist in the DOM
 * on a desktop-width viewport, relying on CSS alone to hide it is fragile
 * (stale bundles, specificity edge cases, browser quirks), so this hook
 * decides whether to render anything at all, in JavaScript, before the
 * component ever touches the DOM.
 */
function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mql = window.matchMedia(MOBILE_BREAKPOINT);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange); // Safari <14 fallback
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  return isMobile;
}

export default function MobileBottomNav() {
  const { user } = useAuth();
  const loc = useLocation();
  const isMobile = useIsMobileViewport();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Close the "More" sheet on every navigation.
  useEffect(() => { setSheetOpen(false); }, [loc.pathname]);

  // Hard gate: on a desktop-width viewport this component renders nothing at
  // all, not even hidden-via-CSS markup, so a wide viewport can never show
  // the "More" sheet's full link list inline at the bottom of the page.
  if (!isMobile) return null;

  const inDashboard = DASH_PREFIXES.some((p) => loc.pathname === p || loc.pathname.startsWith(p + '/'));
  const role = user?.role;

  let primary; // items shown directly as icons
  let overflow; // items tucked away behind "More"
  let brandLabel;

  if (inDashboard && role) {
    const all = navForRole(role);
    const primaryHrefs = mobilePrimaryByRole[role] || all.slice(0, 4).map((i) => i[0]);
    primary = primaryHrefs
      .map((href) => all.find((i) => i[0] === href))
      .filter(Boolean);
    overflow = all.filter((i) => !primaryHrefs.includes(i[0]));
    brandLabel = 'More tools';
  } else {
    const account = user ? ['/profile', 'Account', 'user'] : ['/login', 'Sign in', 'user'];
    primary = [...PUBLIC_ITEMS, account];
    overflow = [];
    brandLabel = 'More';
  }

  const hasMore = overflow.length > 0;
  const isActive = (href) => loc.pathname === href;

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Primary">
        {primary.slice(0, hasMore ? 4 : 5).map(([href, label, icon]) => (
          <Link
            key={href}
            to={href}
            className={'mbn-item' + (isActive(href) ? ' active' : '')}
          >
            <Icon name={icon} size={21} />
            <span>{label}</span>
          </Link>
        ))}
        {hasMore && (
          <button
            type="button"
            className={'mbn-item mbn-more' + (sheetOpen ? ' active' : '')}
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
          >
            <Icon name={sheetOpen ? 'plus' : 'grid'} size={21} />
            <span>More</span>
          </button>
        )}
      </nav>

      {hasMore && (
        <>
          <div
            className={'mbn-backdrop' + (sheetOpen ? ' open' : '')}
            onClick={() => setSheetOpen(false)}
          />
          <div className={'mbn-sheet' + (sheetOpen ? ' open' : '')} role="dialog" aria-label={brandLabel}>
            <div className="mbn-sheet-handle" />
            <div className="mbn-sheet-head">{brandLabel}</div>
            <div className="mbn-sheet-grid">
              {overflow.map(([href, label, icon]) => (
                <Link
                  key={href}
                  to={href}
                  className={'mbn-sheet-item' + (isActive(href) ? ' active' : '')}
                  onClick={() => setSheetOpen(false)}
                >
                  <span className="mbn-sheet-icon"><Icon name={icon} size={20} /></span>
                  <small>{label}</small>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
