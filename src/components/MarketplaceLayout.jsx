import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function MarketplaceLayout({ children, search = '', setSearch }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const role = user?.role || user?.accountType;

  return (
    <div className="marketplace-shell">
      <div className="top-strip">Free delivery on selected orders • Secure checkout • Shop from trusted vendors across Rwanda</div>
      <header className="market-header">
        <Link to="/" className="market-logo">MVEC</Link>
        <div className="market-search">
          <input value={search} onChange={(e) => setSearch?.(e.target.value)} placeholder="Search products, brands, vendors, SKU..." />
          <button onClick={() => navigate(`/shop${search ? `?q=${encodeURIComponent(search)}` : ''}`)}>⌕</button>
        </div>
        <div className="header-actions">
          <Link to="/wishlist" title="Wishlist">♡</Link>
          <Link to="/cart" title="Cart">🛒</Link>
          {user ? (
            <div className="user-menu">
              <Link to={role === 'vendor' ? '/vendor' : role === 'super_admin' ? '/admin' : '/profile'} className="account-pill">{user.fullName?.split(' ')[0] || 'Account'}</Link>
              <button onClick={logout} className="logout-mini">Log out</button>
            </div>
          ) : <Link to="/login" className="header-login">Log in</Link>}
        </div>
      </header>
      <nav className="category-bar">
        <div className="category-menu">☰ <strong>All Categories</strong></div>
        <div className="category-links">
          <Link to="/">Home</Link><Link to="/shop">Shop</Link><Link to="/shop?sort=deals">Deals</Link><Link to="/vendors">Vendors</Link><Link to="/orders">Orders</Link>
          {user?.role === 'vendor' && <Link to="/vendor">Seller Center</Link>}
        </div>
        <span className="support-pill">☎ +250 788 000 000</span>
      </nav>
      {children}
      <footer className="market-footer">
        <div><strong>MVEC</strong><p>Multi-vendor shopping built for buyers and sellers.</p></div>
        <div><h4>Customer Service</h4><p>Contact Us</p><p>Returns</p><p>Order History</p></div>
        <div><h4>Information</h4><p>About MVEC</p><p>Delivery</p><p>Privacy</p></div>
        <div><h4>Seller</h4><p>Seller Center</p><p>Vendor policies</p><p>Become a vendor</p></div>
      </footer>
    </div>
  );
}
