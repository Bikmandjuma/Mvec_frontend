import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Storefront from '../components/Storefront';
import { loadCatalog, mapBackendProduct, asVariantLine } from '../services/catalogApi';
import { DealTag, SellerBadges, VariantPicker, StockAlerts } from '../components/ProductExtras';
import { productsApi } from '../API/products';
import { reviewsApi } from '../API/reviews';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import ProductImage from '../components/ProductImage';
import { money, ratingLabel, formatDate } from '../utils/format';
import { getCompare, toggleCompare } from '../utils/compare';

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
  const [comparing, setComparing] = useState(false);
  const [variant, setVariant] = useState(null);
  useEffect(() => { setComparing(getCompare().includes(String(id))); }, [id]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFeedback(null);
    setQty(1);
    setVariant(null);
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

  // A product with sizes/colours is bought as one of them: price and stock follow the choice.
  const hasVariants = p.variants.length > 0;
  const line = asVariantLine(p, variant);
  const stock = Number(line.stock) || 0;
  const soldOut = hasVariants ? p.variants.every((v) => v.stockQuantity <= 0) || (variant && stock <= 0) : stock <= 0;
  const needsChoice = hasVariants && !variant;
  const maxQty = Math.max(1, Math.min(stock, 100));
  const wished = isWishlisted(p.id);
  const images = [...new Set([p.image, ...(p.gallery || [])].filter(Boolean))];
  const onSale = line.oldPrice > line.price;

  const changeQty = (next) => setQty(Math.max(1, Math.min(maxQty, next)));
  const addToCartClick = async () => {
    if (needsChoice) { setFeedback({ ok: false, message: `Choose ${p.variantOptions.map((o) => o.name.toLowerCase()).join(' and ')} first.` }); return; }
    setAdding(true);
    const result = await addToCart(line, qty);
    setAdding(false);
    setFeedback(result);
  };
  const buy = () => {
    if (needsChoice) { setFeedback({ ok: false, message: `Choose ${p.variantOptions.map((o) => o.name.toLowerCase()).join(' and ')} first.` }); return; }
    navigate(`/checkout?product=${encodeURIComponent(line.id)}&qty=${qty}`);
  };
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
        <DealTag deal={p.deal} />
        <div className="price-line"><strong>{money(line.price)}</strong>{onSale && <del>{money(line.oldPrice)}</del>}{onSale && <span>{Math.round((1 - line.price / line.oldPrice) * 100)}% OFF</span>}</div>
        {hasVariants && <VariantPicker options={p.variantOptions} variants={p.variants} value={variant} onChange={(v) => { setVariant(v); setQty(1); setFeedback(null); if (v?.image) setActiveImage(v.image); }} />}
        <p className={soldOut ? 'stock-line out' : needsChoice ? 'stock-line' : stock <= 5 ? 'stock-line low' : 'stock-line'}>
          {soldOut ? 'Out of stock' : needsChoice ? `Choose ${p.variantOptions.map((o) => o.name.toLowerCase()).join(' and ')}` : stock <= 5 ? `Only ${stock} left in stock` : 'In stock'}
        </p>
        <StockAlerts productId={p.id} soldOut={soldOut} signedIn={Boolean(user)} onSignIn={() => navigate('/login', { state: { from: `${location.pathname}${location.search}` } })} />
        {p.description && <p>{p.description}</p>}
        <div className="vendor-line"><div className="vendor-avatar" aria-hidden="true">{(p.vendor || 'M')[0]}</div><div><small>Sold by</small><span>{p.vendor}</span><SellerBadges badges={p.sellerBadges} /></div></div>
        <div className="attributes">{Object.entries(p.attributes || {}).filter(([, v]) => v).map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
        {!user && <div className="guest-shopping-note">✓ You can browse and add to cart without an account. You&apos;ll sign in at checkout.</div>}
        {feedback && <div className={`form-alert ${feedback.ok ? 'success' : 'error'}`} role="status">{feedback.message}{feedback.ok && (feedback.compare ? <> <Link to="/buyer/compare">Open compare</Link></> : <> <Link to="/cart">View cart</Link></>)}</div>}
        <div className="purchase-row">
          <div className="qty" aria-label="Quantity">
            <button type="button" onClick={() => changeQty(qty - 1)} disabled={soldOut || qty <= 1} aria-label="Decrease quantity">−</button>
            <span aria-live="polite">{qty}</span>
            <button type="button" onClick={() => changeQty(qty + 1)} disabled={soldOut || qty >= maxQty} aria-label="Increase quantity">+</button>
          </div>
          <button type="button" className={'outline-btn ' + (wished ? 'wishlist-saved' : '')} onClick={wish} aria-pressed={wished}><Icon name="heart" /> {wished ? 'Saved' : 'Wishlist'}</button>
          <button type="button" className="gradient-btn" onClick={addToCartClick} disabled={soldOut || adding}><Icon name="cart" /> {adding ? 'Adding…' : 'Add to cart'}</button>
          <button type="button" className="buy-btn" onClick={buy} disabled={soldOut}>Buy now</button>
          <button type="button" className={'outline-btn compare-btn ' + (comparing ? 'wishlist-saved' : '')} aria-pressed={comparing}
            onClick={() => { const r = toggleCompare(p.id); setComparing(r.ids.includes(String(p.id))); setFeedback({ ok: r.ok, message: r.message, compare: true }); }}>
            ⇄ {comparing ? 'Comparing' : 'Compare'}
          </button>
        </div>
        <div className="product-trust"><span>✓ Mobile money or card</span><span>✓ Payment held until delivery</span><span>✓ Delivery code at your door</span><span>✓ Returns after delivery</span></div>
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
              <p><Stars value={r.rating} /> {r.review || r.comment || r.reviewText}</p>
              <small>{r.reviewer || (typeof r.user === 'string' ? r.user : r.user?.fullName) || 'Verified buyer'}{r.isVerifiedPurchase ? ' · Verified purchase' : ''} · {formatDate(r.date || r.createdAt)}</small>
              {r.vendorReply && <div className="review-seller-reply"><b>Seller reply</b><p>{r.vendorReply}</p></div>}
            </div>
          ))}
          <p className="tiny" style={{ marginTop: 12 }}>Bought this product? <Link to="/orders">Leave a review from your order</Link> after it&apos;s delivered.</p>
        </div>
      </div>
    </section>
  </main></Storefront>;
}
