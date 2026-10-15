import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import ProductImage from './ProductImage';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { money, ratingLabel } from '../utils/format';

/**
 * Storefront product tile used on Home, Shop and store pages.
 * The wishlist button sits beside the link (not inside it) so clicking it
 * never also opens the product.
 */
export default function ProductCard({ p, href, label }) {
  const { user } = useAuth();
  const { toggleWishlist, isWishlisted } = useMarketplace();
  const navigate = useNavigate();
  const location = useLocation();
  const wished = isWishlisted(p.id);
  const to = href || `/product/${p.id}`;
  const soldOut = Number(p.stock) <= 0;
  const onSale = Number(p.oldPrice) > Number(p.price);

  const save = () => {
    if (!user) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    toggleWishlist(p);
  };

  return (
    <div className="product-card">
      <div className="product-img-wrap">
        <Link to={to} className="product-img">
          <ProductImage src={p.image} alt={p.name} loading="lazy" />
          {soldOut ? <span className="sale-badge sold-out-badge">SOLD OUT</span> : onSale && <span className="sale-badge">SALE</span>}
        </Link>
        <button
          type="button"
          className={'quick-heart ' + (wished ? 'wish-active' : '')}
          onClick={save}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`}
        >
          <Icon name="heart" size={17} />
        </button>
      </div>
      <div className="product-info">
        <small>{label ?? p.category}</small>
        <Link to={to} className="product-name">{p.name}</Link>
        <div className="rating">
          ★ {ratingLabel(p.rating)} {p.reviews > 0 && <span>({p.reviews})</span>}
        </div>
        <div>
          <b>{money(p.price)}</b> {onSale && <del>{money(p.oldPrice)}</del>}
        </div>
      </div>
    </div>
  );
}
