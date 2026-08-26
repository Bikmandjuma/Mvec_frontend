import { useState } from 'react';
import { Link } from 'react-router-dom';
import MarketplaceLayout from '../components/MarketplaceLayout';
import ProductCard from '../components/ProductCard';
import { categories, products, vendors } from '../data';

export default function Home() {
  const [search, setSearch] = useState('');
  return <MarketplaceLayout search={search} setSearch={setSearch}>
    <section className="home-hero"><div className="hero-content"><span className="hero-kicker">MVEC MARKETPLACE</span><h1>Everything you need.<br/><span>All in one place.</span></h1><p>Shop from trusted vendors, discover great deals and enjoy a marketplace built for Rwanda.</p><div className="hero-actions"><Link to="/shop" className="gradient-btn">Shop now</Link><Link to="/signup" className="outline-btn">Become a vendor</Link></div><div className="hero-trust"><span>✓ Verified vendors</span><span>✓ Secure payments</span><span>✓ Buyer protection</span></div></div><div className="hero-market-art"><div className="hero-circle"/><div className="hero-device"><b>MVEC</b><span>SHOP</span><span>SELL</span><span>GROW</span></div><div className="hero-float float-one">★ 4.9<br/><small>Top vendors</small></div><div className="hero-float float-two">🛒<br/><small>Easy checkout</small></div></div></section>
    <section className="section"><div className="section-heading"><div><small>EXPLORE</small><h2>Shop by category</h2></div><Link to="/shop">View all →</Link></div><div className="category-grid">{categories.map((c,i)=><Link to={`/shop?category=${encodeURIComponent(c)}`} className="category-tile" key={c}><span>{['⌁','▣','⌂','◉','▤','✦','⚽','▰'][i]}</span><strong>{c}</strong><small>Explore products</small></Link>)}</div></section>
    <section className="section soft-section"><div className="section-heading"><div><small>DEALS FOR YOU</small><h2>Popular products</h2></div><Link to="/shop?sort=deals">See all deals →</Link></div><div className="product-grid">{products.slice(0,4).map(p=><ProductCard key={p.id} product={p}/>)}</div></section>
    <section className="vendor-banner"><div><small>SELL ON MVEC</small><h2>Turn your products into a business.</h2><p>Create a store, list products, manage orders and reach buyers.</p><Link to="/signup" className="white-btn">Start selling</Link></div><div className="vendor-stat"><strong>1 platform</strong><span>for buyers + vendors</span></div></section>
    <section className="section"><div className="section-heading"><div><small>TRUSTED STORES</small><h2>Featured vendors</h2></div><Link to="/vendors">View vendors →</Link></div><div className="vendor-grid">{vendors.map(v=><Link className="vendor-card" to={`/vendors/${v.id}`} key={v.id}><div className="vendor-avatar">{v.name.slice(0,2).toUpperCase()}</div><div><strong>{v.name}</strong><p>{v.category} • {v.products} products</p><span>★ {v.rating} • Verified vendor</span></div><b>→</b></Link>)}</div></section>
  </MarketplaceLayout>;
}
