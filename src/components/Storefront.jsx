import {Link} from 'react-router-dom';
import Icon from './Icon';
import {useAuth} from '../context/AuthContext';
import {useTheme} from '../context/ThemeContext';
import {useMarketplace} from '../context/MarketplaceContext';

export default function Storefront({children}){
  const {user,logout}=useAuth(); const {theme,toggleTheme}=useTheme();
  const {cartCount,wishlistCount}=useMarketplace();
  return <>
    <header className="top-strip"><div>Welcome to <b>MVEC</b> — Rwanda's multi-vendor marketplace</div><div className="top-links"><span>Help & Support</span><span>Become a vendor</span></div></header>
    <header className="market-header">
      <Link to="/" className="mvec-brand">MVEC</Link>
      <div className="market-search"><Icon name="search"/><input placeholder="Search products, brands, vendors..."/><select><option>All Categories</option></select><button>Search</button></div>
      <div className="header-actions">
        <button className="site-theme-toggle" onClick={toggleTheme} title={theme==='dark'?'Switch to light mode':'Switch to dark mode'} aria-label="Toggle theme">{theme==='dark'?'☀️':'🌙'}</button>
        <Link className="count-link" to="/wishlist" title="Wishlist"><Icon name="heart"/><span className="nav-count">{wishlistCount}</span></Link>
        <Link className="count-link" to="/cart" title="Cart"><Icon name="cart"/><span className="nav-count">{cartCount}</span></Link>
        {user?<div className="user-menu"><Link to="/profile"><Icon name="user"/><span>{user.fullName?.split(' ')[0]}</span></Link><button onClick={logout} title="Logout"><Icon name="logout"/></button></div>:<Link className="login-link" to="/login">Sign in</Link>}
      </div>
    </header>
    <nav className="main-nav"><div className="category-menu"><Icon name="menu"/> <span>All Categories</span></div><div className="main-nav-links"><Link to="/"><Icon name="home"/><span>Home</span></Link><Link to="/shop"><Icon name="shop"/><span>Shop</span></Link><Link to="/shop?deal=true"><Icon name="tag"/><span>Deals</span></Link><Link to="/vendors"><Icon name="users"/><span>Vendors</span></Link><Link to="/orders"><Icon name="box"/><span>Orders</span></Link></div>{user?.role==='vendor'&&<Link className="nav-admin" to="/vendor">Seller Center</Link>}{user?.role==='super_admin'&&<Link className="nav-admin" to="/admin">Admin</Link>}</nav>
    {children}
    <footer className="market-footer"><div><div className="mvec-brand footer-brand">MVEC</div><p>Multi-vendor commerce built for buyers and sellers across Rwanda.</p></div><div><h4>Marketplace</h4><Link to="/shop">Shop</Link><Link to="/vendors">Stores</Link><Link to="/wishlist">Wishlist</Link></div><div><h4>Customer service</h4><Link to="/profile">My account</Link><Link to="/orders">Orders</Link><Link to="/login">Sign in</Link></div><div><h4>Sell on MVEC</h4><Link to="/signup">Become a vendor</Link><Link to="/vendor">Seller Center</Link></div></footer>
  </>
}
