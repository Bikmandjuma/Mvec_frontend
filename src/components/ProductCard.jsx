import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocalStorage } from '../hooks';

export default function ProductCard({ product }) {
  const { user } = useAuth(); const navigate = useNavigate();
  const [wishlist, setWishlist] = useLocalStorage('mvec_wishlist', []);
  const [cart, setCart] = useLocalStorage('mvec_cart', []);
  const wished = wishlist.some((p) => p.id === product.id);
  const addWishlist = () => {
    if (!user) return navigate('/login');
    setWishlist(wished ? wishlist.filter((p) => p.id !== product.id) : [...wishlist, product]);
  };
  const addCart = () => {
    if (!user) return navigate('/login');
    const existing = cart.find((p) => p.id === product.id);
    setCart(existing ? cart.map((p) => p.id === product.id ? { ...p, quantity: (p.quantity || 1) + 1 } : p) : [...cart, { ...product, quantity: 1 }]);
  };
  return <article className="product-card">
    <Link to={`/product/${product.id}`} className="product-image-wrap"><img src={product.image} alt={product.name}/>{product.oldPrice && <span className="sale-tag">SALE</span>}<button type="button" className={`wish-btn ${wished ? 'wished' : ''}`} onClick={(e)=>{e.preventDefault();addWishlist();}}>♡</button></Link>
    <div className="product-info"><small>{product.category} • {product.brand}</small><Link to={`/product/${product.id}`} className="product-name">{product.name}</Link><div className="rating">★ {product.rating} <span>({product.reviews})</span></div><div className="price-row"><strong>{product.price.toLocaleString()} RWF</strong>{product.oldPrice && <del>{product.oldPrice.toLocaleString()} RWF</del>}</div><small className="vendor-name">Sold by {product.vendor}</small><button className="card-cart" onClick={addCart}>Add to cart</button></div>
  </article>;
}
