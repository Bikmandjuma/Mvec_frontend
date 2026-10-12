import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { loadCatalog } from '../services/catalogApi';
import { useLanguage } from '../context/LanguageContext';
import { notificationsApi } from '../API/notifications';
import ProductImage from './ProductImage';
import { money } from '../utils/format';

const DASHBOARD_BY_ROLE = { vendor: '/vendor', supplier: '/supplier', affiliate: '/affiliate', delivery: '/delivery', super_admin: '/admin' };
const NOTIFICATIONS_BY_ROLE = { vendor: '/vendor/notifications', supplier: '/supplier/notifications', affiliate: '/affiliate/notifications', super_admin: '/admin/notifications' };

export default function Storefront({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { cartCount, wishlistCount, cartNotice, dismissCartNotice } = useMarketplace();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [allCategories, setAllCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [unread, setUnread] = useState(0);
  const searchRef = useRef(null);
  const catRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    loadCatalog().then((cat) => {
      if (!mounted) return;
      setAllCategories((cat.categories || []).map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean));
      setProducts(cat.products || []);
      setVendors(cat.vendors || []);
    });
    return () => { mounted = false; };
  }, []);

  // Unread notifications badge (only meaningful when signed in).
  useEffect(() => {
    if (!user) { setUnread(0); return undefined; }
    let alive = true;
    const load = () => notificationsApi.getAll({ limit: 1 }).then((d) => alive && setUnread(d.unreadCount || 0)).catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => { alive = false; clearInterval(timer); };
  }, [user]);

  // Close the search suggestions and category menu on outside click / Escape.
  useEffect(() => {
    const onClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
      if (catRef.current && !catRef.current.contains(e.target)) setCatOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setSearchOpen(false); setCatOpen(false); } };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  // Close menus when the page changes.
  useEffect(() => { setSearchOpen(false); setCatOpen(false); }, [location.pathname, location.search]);

  const query = search.trim().toLowerCase();
  const suggestions = query ? products.filter((p) => `${p.name} ${p.brand || ''} ${p.vendor || ''} ${p.category || ''}`.toLowerCase().includes(query)).slice(0, 5) : [];
  const vendorSuggestions = query ? vendors.filter((v) => `${v.name} ${v.category}`.toLowerCase().includes(query)).slice(0, 3) : [];
  const submitSearch = () => {
    if (!search.trim()) return;
    setSearchOpen(false);
    navigate(`/shop?q=${encodeURIComponent(search.trim())}`);
  };
  const onLogout = () => {
    logout();
    navigate('/');
  };
  const dashboard = DASHBOARD_BY_ROLE[user?.role];
  const notificationPath = NOTIFICATIONS_BY_ROLE[user?.role] || '/buyer/notifications';
  const isSeller = ['vendor', 'supplier'].includes(user?.role);

  return <>
    <div className="top-strip"><div>Welcome to <b>MVEC</b>, Rwanda&apos;s multi-vendor marketplace</div><div className="top-links"><Link to="/buyer/support">{t('help')}</Link>{!user && <Link to="/signup" state={{ role: 'vendor' }}>{t('becomeVendor')}</Link>}</div></div>
    <header className="market-header">
      <Link to="/" className="mvec-brand">MVEC</Link>
      <div className="market-search-wrap" ref={searchRef}>
        <form className="market-search" role="search" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
          <Icon name="search" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder={`${t('search')} products, brands, vendors...`}
            aria-label={t('search')}
            maxLength={100}
          />
          <select
            aria-label={t('allCategories')}
            value=""
            onChange={(e) => e.target.value && navigate(`/shop?category=${encodeURIComponent(e.target.value)}`)}
          >
            <option value="">{t('allCategories')}</option>
            {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="submit">{t('search')}</button>
        </form>
        {searchOpen && query && <div className="global-search-results">
          {suggestions.map((p) => <Link key={`p-${p.id}`} to={`/product/${p.id}`} onClick={() => setSearch('')}><ProductImage src={p.image} alt="" /><span><b>{p.name}</b><small>{p.category} · {money(p.price)}</small></span></Link>)}
          {vendorSuggestions.map((v) => <Link key={`v-${v.id}`} to={`/vendors/${v.id}`} onClick={() => setSearch('')}><span className="search-avatar">{(v.name || 'V')[0]}</span><span><b>{v.name}</b><small>Store · {v.category}</small></span></Link>)}
          {!suggestions.length && !vendorSuggestions.length && <div className="search-no-results">No matching products or stores</div>}
          <button type="button" className="search-view-all" onClick={submitSearch}>View all results</button>
        </div>}
      </div>
      <div className="header-actions">
        <button className="site-theme-toggle" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} /></button>
        <Link className="count-link" to="/wishlist" title="Wishlist" aria-label={`Wishlist, ${wishlistCount} items`}><Icon name="heart" /><span className="nav-count">{wishlistCount}</span></Link>
        {user && <Link className="count-link notification-link" to={notificationPath} title="Notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}><Icon name="bell" />{unread > 0 && <span className="notification-dot" />}</Link>}
        <Link className="count-link" to="/cart" title="Cart" aria-label={`Cart, ${cartCount} items`}><Icon name="cart" /><span className="nav-count">{cartCount}</span></Link>
        {user
          ? <div className="user-menu"><Link to={dashboard && user.role !== 'buyer' ? dashboard : '/profile'}><Icon name="user" /><span>{user.fullName?.split(' ')[0] || 'Account'}</span></Link><button onClick={onLogout} title="Log out" aria-label="Log out"><Icon name="logout" /></button></div>
          : <Link className="login-link" to="/login" state={{ from: `${location.pathname}${location.search}` }}>{t('signIn')}</Link>}
      </div>
    </header>
    <nav className="main-nav">
      <div className="category-menu category-menu-dropdown" ref={catRef}>
        <button type="button" onClick={() => setCatOpen((v) => !v)} aria-expanded={catOpen}><Icon name="menu" /><span>{t('allCategories')}</span></button>
        {catOpen && <div className="category-dropdown">
          {allCategories.length === 0 && <span className="tiny" style={{ padding: '10px 14px', display: 'block' }}>No categories yet</span>}
          {allCategories.map((c) => <Link onClick={() => setCatOpen(false)} key={c} to={`/shop?category=${encodeURIComponent(c)}`}>{c}</Link>)}
        </div>}
      </div>
      <div className="main-nav-links">
        <Link to="/"><Icon name="home" /><span>{t('home')}</span></Link>
        <Link to="/shop"><Icon name="shop" /><span>{t('shop')}</span></Link>
        <Link to="/buyer/recommendations"><Icon name="heart" /><span>{t('forYou')}</span></Link>
        <Link to="/shop?deal=true"><Icon name="tag" /><span>{t('deals')}</span></Link>
        <Link to="/vendors"><Icon name="users" /><span>{t('vendors')}</span></Link>
        <Link to="/orders"><Icon name="box" /><span>{t('orders')}</span></Link>
      </div>
      {dashboard && <Link className="nav-admin" to={dashboard}>Dashboard</Link>}
    </nav>
    {cartNotice && <div className="form-alert error site-notice" role="alert">{cartNotice} <button type="button" className="text-btn" onClick={dismissCartNotice}>Dismiss</button></div>}
    {children}
    <footer className="market-footer">
      <div><div className="mvec-brand footer-brand">MVEC</div><p>Multi-vendor commerce built for buyers and sellers across Rwanda.</p></div>
      <div><h4>Marketplace</h4><Link to="/shop">Shop</Link><Link to="/vendors">Stores</Link><Link to="/wishlist">Wishlist</Link></div>
      <div><h4>Customer service</h4><Link to="/profile">My account</Link><Link to="/orders">Orders</Link><Link to="/buyer/support">Help &amp; Support</Link>{!user && <Link to="/login">Sign in</Link>}</div>
      <div><h4>Sell on MVEC</h4>{isSeller || dashboard ? <Link to={dashboard}>Seller dashboard</Link> : <Link to="/signup" state={{ role: 'vendor' }}>Become a vendor</Link>}</div>
    </footer>
  </>;
}
