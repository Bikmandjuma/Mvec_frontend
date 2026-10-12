import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Storefront from '../components/Storefront';
import { loadCatalog, mapBackendProduct } from '../services/catalogApi';
import { productsApi } from '../API/products';
import { reviewsApi } from '../API/reviews';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import ProductImage from '../components/ProductImage';
import { money, ratingLabel, formatDate } from '../utils/format';

const Stars = ({ value }) => {
  const full = Math.round(Number(value) || 0);
  return <span aria-label={`${full} out of 5 stars`}>{'★'.repeat(full)}<span className="stars-empty">{'★'.repeat(5 - full)}</span></span>;
};

export default function ProductDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart, toggleWishlist, isWishlisted } = useMarketplace();

  const [p, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState('');
  const [reviews, setReviews] = useState([]);
  const [feedback, setFeedback] = useState(null); // { ok, message }
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFeedback(null);
    setQty(1);
    if (!id || id === 'undefined') { setProduct(null); setLoading(false); return undefined; }
    // Fetch the product itself (fresh price and stock); fall back to the
    // cached catalogue for old links that use the public product code.
    productsApi.getById(id)
      .then((raw) => mapBackendProduct(raw))
      .catch(() => loadCatalog().then((res) => (res.products || []).find((x) => String(x.id) === id || String(x.publicId) === id) || null))
      .then((product) => {
        if (!alive) return;
        setProduct(product);
        setActiveImage(product?.image || '');
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (!p?.id) return;
    reviewsApi.getForProduct(p.id).then((res) => setReviews(res.reviews || [])).catch(() => setReviews([]));
  }, [p?.id]);

  if (loading) {
    return <Storefront><main className="detail-page"><div className="empty-state"><h3>Loading…</h3></div></main></Storefront>;
  }
  if (!p) {
    return <Storefront><main className="detail-page"><div className="empty-state"><h3>Product not found</h3><p>It may have been removed or is no longer available.</p><Link className="gradient-btn" to="/shop">Back to shop</Link></div></main></Storefront>;
  }

  const stock = Number(p.stock) || 0;
  const soldOut = stock <= 0;
  const maxQty = Math.max(1, Math.min(stock, 100));
  const wished = isWishlisted(p.id);
  const images = [...new Set([p.image, ...(p.gallery || [])].filter(Boolean))];
  const onSale = p.oldPrice > p.price;

  const changeQty = (next) => setQty(Math.max(1, Math.min(maxQty, next)));
  const addToCartClick = async () => {
    setAdding(true);
    const result = await addToCart(p, qty);
    setAdding(false);
    setFeedback(result);
  };
  const buy = () => navigate(`/checkout?product=${encodeURIComponent(p.id)}&qty=${qty}`);
  const wish = () => {
    if (!user) { navigate('/login', { state: { from: `${location.pathname}${location.search}` } }); return; }
    toggleWishlist(p);
  };

  return <Storefront><main className="detail-page">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> / <Link to="/shop">Shop</Link> / {p.category && <><Link to={`/shop?category=${encodeURIComponent(p.category)}`}>{p.category}</Link> / </>}{p.name}</nav>
    <section className="detail-card">
      <div className="detail-gallery">
        <ProductImage src={activeImage || p.image} alt={p.name} />
        {images.length > 1 && (
          <div className="gallery-thumbs">
            {images.map((src) => (
              <button type="button" key={src} className={src === activeImage ? 'active' : ''} onClick={() => setActiveImage(src)} aria-label="Show image">
                <ProductImage src={src} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="detail-copy">
        <small>{p.category}{p.sku ? ` · SKU ${p.sku}` : ''}</small>
        <h1>{p.name}</h1>
        <div className="rating large">★ {ratingLabel(p.rating)} <span>{reviews.length} review{reviews.length === 1 ? '' : 's'}</span></div>
        <div className="price-line"><strong>{money(p.price)}</strong>{onSale && <del>{money(p.oldPrice)}</del>}{onSale && <span>{Math.round((1 - p.price / p.oldPrice) * 100)}% OFF</span>}</div>
        <p className={soldOut ? 'stock-line out' : stock <= 5 ? 'stock-line low' : 'stock-line'}>
          {soldOut ? 'Out of stock' : stock <= 5 ? `Only ${stock} left in stock` : 'In stock'}
        </p>
        {p.description && <p>{p.description}</p>}
        <div className="vendor-line"><div className="vendor-avatar" aria-hidden="true">{(p.vendor || 'M')[0]}</div><div><small>Sold by</small><span>{p.vendor}</span></div></div>
        <div className="attributes">{Object.entries(p.attributes || {}).filter(([, v]) => v).map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
        {!user && <div className="guest-shopping-note">✓ You can browse and add to cart without an account. You&apos;ll sign in at checkout.</div>}
        {feedback && <div className={`form-alert ${feedback.ok ? 'success' : 'error'}`} role="status">{feedback.message}{feedback.ok && <> <Link to="/cart">View cart</Link></>}</div>}
        <div className="purchase-row">
          <div className="qty" aria-label="Quantity">
            <button type="button" onClick={() => changeQty(qty - 1)} disabled={soldOut || qty <= 1} aria-label="Decrease quantity">−</button>
            <span aria-live="polite">{qty}</span>
            <button type="button" onClick={() => changeQty(qty + 1)} disabled={soldOut || qty >= maxQty} aria-label="Increase quantity">+</button>
          </div>
          <button type="button" className={'outline-btn ' + (wished ? 'wishlist-saved' : '')} onClick={wish} aria-pressed={wished}><Icon name="heart" /> {wished ? 'Saved' : 'Wishlist'}</button>
          <button type="button" className="gradient-btn" onClick={addToCartClick} disabled={soldOut || adding}><Icon name="cart" /> {adding ? 'Adding…' : 'Add to cart'}</button>
          <button type="button" className="buy-btn" onClick={buy} disabled={soldOut}>Buy now</button>
        </div>
        <div className="product-trust"><span>✓ Mobile money payment</span><span>✓ Payment held until delivery</span><span>✓ Delivery code at your door</span></div>
      </div>
    </section>
    <section className="reviews-section">
      <div><span className="eyebrow">CUSTOMER FEEDBACK</span><h2>Ratings & reviews</h2><p>Reviews are written by buyers after their order is delivered.</p></div>
      <div className="review-layout">
        <div className="review-score"><strong>{ratingLabel(p.rating)}</strong><div><Stars value={p.rating} /></div><span>{reviews.length} review{reviews.length === 1 ? '' : 's'}</span></div>
        <div className="review-form">
          <h3>Recent reviews</h3>
          {reviews.length === 0 && <p className="tiny">No reviews yet.</p>}
          {reviews.map((r) => (
            <div className="message-bubble theirs" key={r.id}>
              <p><Stars value={r.rating} /> {r.review || r.comment}</p>
              <small>{r.reviewer || 'Verified buyer'} · {formatDate(r.date)}</small>
              {r.vendorReply && <p className="tiny"><b>Seller reply:</b> {r.vendorReply}</p>}
            </div>
          ))}
          <p className="tiny" style={{ marginTop: 12 }}>Bought this product? <Link to="/orders">Leave a review from your order</Link> after it&apos;s delivered.</p>
        </div>
      </div>
    </section>
  </main></Storefront>;
}
