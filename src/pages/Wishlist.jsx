import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Storefront from '../components/Storefront';
import ProductImage from '../components/ProductImage';
import { useMarketplace } from '../context/MarketplaceContext';
import { loadCatalog } from '../services/catalogApi';
import { money } from '../utils/format';

export default function Wishlist() {
  const { wishlist, addToCart, toggleWishlist } = useMarketplace();
  const [live, setLive] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState(null);

  // Compare saved items with today's catalogue for current price and stock.
  useEffect(() => {
    let alive = true;
    loadCatalog().then((res) => {
      if (!alive) return;
      setLive(Object.fromEntries((res.products || []).map((p) => [String(p.id), p])));
      setLoaded(!res.error);
    });
    return () => { alive = false; };
  }, []);

  const moveToCart = async (item, current) => {
    const result = await addToCart(current || item, 1);
    if (result.ok) toggleWishlist(item);
    setNotice({ ok: result.ok, text: result.ok ? `${item.name} moved to your cart.` : result.message });
  };

  return <Storefront><main className="account-page">
    <div className="page-title"><span className="eyebrow">SAVED ITEMS</span><h1>Wishlist</h1><p>Products you saved. Your list follows you on every device and prices update automatically.</p></div>
    {notice && <div className={`form-alert ${notice.ok ? 'success' : 'error'}`} role="status">{notice.text}</div>}
    <div className="wishlist-grid">
      {wishlist.map((item) => {
        // Prefer today's catalogue entry; the account wishlist also carries
        // the product's current price, stock and status.
        const current = live[String(item.id)] || (item.status ? item : null);
        const unavailable = item.status ? !['ACTIVE', 'OUT_OF_STOCK'].includes(item.status) : loaded && !current;
        const soldOut = !unavailable && (item.status === 'OUT_OF_STOCK' || (current && Number(current.stock) <= 0));
        const price = current?.price ?? item.savedPrice ?? item.price;
        const saved = Number(item.savedPrice ?? item.price) || 0;
        const dropped = current && saved > 0 && current.price < saved;
        return <div className="wish-card" key={item.id}>
          <Link to={`/product/${item.id}`}><ProductImage src={current?.image || item.image} alt="" /></Link>
          <div>
            <small>{current?.vendor || item.vendor}</small>
            <Link to={`/product/${item.id}`}><h3>{current?.name || item.name}</h3></Link>
            <b>{money(price)}</b>
            {dropped && <span className="price-drop">↓ {money(saved - current.price)} cheaper than when you saved it</span>}
            {unavailable && <span className="danger-text tiny">No longer available</span>}
            {soldOut && <span className="danger-text tiny">Out of stock</span>}
            <div className="wish-actions">
              <button type="button" className="gradient-btn" disabled={unavailable || soldOut} onClick={() => moveToCart(item, current)}>Move to cart</button>
              <button type="button" className="icon-btn" onClick={() => toggleWishlist(item)}>Remove</button>
            </div>
          </div>
        </div>;
      })}
    </div>
    {!wishlist.length && <div className="empty-state"><h2>Your wishlist is empty</h2><p>Save products by tapping the heart icon.</p><Link className="gradient-btn" to="/shop">Discover products</Link></div>}
  </main></Storefront>;
}
