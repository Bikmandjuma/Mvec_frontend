import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Storefront from '../components/Storefront';
import { loadCatalog } from '../services/catalogApi';
import { reviewsApi } from '../API/reviews';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import ProductImage from '../components/ProductImage';

const money = n => new Intl.NumberFormat('en-RW').format(Number(n) || 0) + ' RWF';

export default function ProductDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, isWishlisted } = useMarketplace();

  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (!id || id === 'undefined') {
      setLoading(false);
      return undefined;
    }
    let mounted = true;
    loadCatalog().then(res => {
      if (!mounted) return;
      setCatalog(res.products || []);
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [id]);

  const p = catalog.find(x => String(x.id) === id || String(x.publicId) === id);

  useEffect(() => {
    if (!p?.id) return;
    reviewsApi.getForProduct(p.id).then(res => setReviews(res.reviews || [])).catch(() => setReviews([]));
  }, [p?.id]);

  if (loading) {
    return <Storefront><main className="detail-page"><div className="empty-state"><h3>Loading…</h3></div></main></Storefront>;
  }
  if (!p) {
    return <Storefront><main className="detail-page"><div className="empty-state"><h3>Product not found</h3><p>It may have been removed or is no longer available.</p><Link className="gradient-btn" to="/shop">Back to shop</Link></div></main></Storefront>;
  }

  const wished = isWishlisted(p.id);
  const buy = () => { addToCart(p, qty); navigate('/checkout?product=' + p.id + '&qty=' + qty); };
  const addToCartClick = () => { addToCart(p, qty); };
  const wish = () => {
    if (!user) { navigate('/login', { state: { from: `/product/${p.id}` } }); return; }
    toggleWishlist(p);
  };

  return <Storefront><main className="detail-page">
    <div className="breadcrumbs"><Link to="/">Home</Link> / <Link to="/shop">Shop</Link> / {p.name}</div>
    <section className="detail-card">
      <div className="detail-gallery"><ProductImage src={p.image} alt={p.name} /></div>
      <div className="detail-copy">
        <small>{p.category} · SKU {p.sku}</small>
        <h1>{p.name}</h1>
        <div className="rating large">★ {p.rating} <span>{reviews.length} reviews</span></div>
        <div className="price-line"><strong>{money(p.price)}</strong>{p.oldPrice ? <del>{money(p.oldPrice)}</del> : null}{p.oldPrice ? <span>{Math.round((1 - p.price / p.oldPrice) * 100)}% OFF</span> : null}</div>
        <p>{p.description}</p>
        <div className="vendor-line"><div className="vendor-avatar">{(p.vendor || 'M')[0]}</div><div><small>Sold by</small><span>{p.vendor}</span></div></div>
        <div className="attributes">{Object.entries(p.attributes || {}).filter(([, v]) => v).map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
        <div className="guest-shopping-note">✓ You can browse, add to cart and start checkout without creating an account.</div>
        <div className="purchase-row">
          <div className="qty"><button onClick={() => setQty(Math.max(1, qty - 1))}>−</button><span>{qty}</span><button onClick={() => setQty(qty + 1)}>+</button></div>
          <button className={'outline-btn ' + (wished ? 'wishlist-saved' : '')} onClick={wish}><Icon name="heart" /> {wished ? 'Saved' : 'Wishlist'}</button>
          <button className="gradient-btn" onClick={addToCartClick}><Icon name="cart" /> Add to cart</button>
          <button className="buy-btn" onClick={buy}>Buy now</button>
        </div>
        <div className="product-trust"><span>✓ Secure payment</span><span>✓ Buyer protection</span><span>✓ Delivery tracking</span></div>
      </div>
    </section>
    <section className="reviews-section">
      <div><span className="eyebrow">CUSTOMER FEEDBACK</span><h2>Ratings & reviews</h2><p>Reviews are submitted by buyers from their order after delivery.</p></div>
      <div className="review-layout">
        <div className="review-score"><strong>{p.rating}</strong><div>★★★★★</div><span>{reviews.length} reviews</span></div>
        <div className="review-form">
          <h3>Recent reviews</h3>
          {reviews.length === 0 && <p className="tiny">No reviews yet. Be the first to buy and review this product.</p>}
          {reviews.map(r => (
            <div className="message-bubble theirs" key={r.id}>
              <p>{'★'.repeat(r.rating)} {r.reviewText}</p>
              <small>{r.user?.fullName || 'Verified buyer'} · {new Date(r.createdAt).toLocaleDateString('en-GB')}</small>
            </div>
          ))}
          <p className="tiny" style={{ marginTop: 12 }}>Bought this product? <Link to="/orders">Leave a review from your order</Link> after it's delivered.</p>
        </div>
      </div>
    </section>
  </main></Storefront>;
}
