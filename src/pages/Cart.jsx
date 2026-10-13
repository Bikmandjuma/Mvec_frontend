import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Storefront from '../components/Storefront';
import ProductImage from '../components/ProductImage';
import { useMarketplace } from '../context/MarketplaceContext';
import { money } from '../utils/format';

export default function Cart() {
  const navigate = useNavigate();
  const { cart, cartLoading, updateCartQty, removeFromCart } = useMarketplace();
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const subtotal = cart.reduce((s, x) => s + (Number(x.price) || 0) * (x.qty || 1), 0);
  const grouped = cart.reduce((acc, x) => { (acc[x.vendor || 'MVEC Seller'] ??= []).push(x); return acc; }, {});
  const unavailable = cart.filter((x) => (x.status && x.status !== 'ACTIVE') || (Number.isFinite(x.stock) && x.stock <= 0));
  const overStock = cart.filter((x) => Number(x.stock) > 0 && x.qty > x.stock);
  const blocked = unavailable.length > 0 || overStock.length > 0;

  const run = async (id, action) => {
    setError('');
    setBusyId(id);
    const result = await action();
    setBusyId('');
    if (result && !result.ok && result.message) setError(result.message);
  };

  return <Storefront><main className="account-page">
    <div className="page-title"><span className="eyebrow">SHOPPING CART</span><h1>Your cart</h1><p>Products from different vendors are fulfilled separately.</p></div>
    {error && <div className="form-alert error" role="alert">{error}</div>}
    {cartLoading && !cart.length && <div className="empty-state"><h3>Loading your cart…</h3></div>}
    {!cartLoading && !cart.length && <div className="empty-state"><div className="empty-icon" aria-hidden="true">🛒</div><h2>Your cart is empty</h2><Link className="gradient-btn" to="/shop">Continue shopping</Link></div>}
    {cart.length > 0 && <div className="cart-layout">
      <section>
        {Object.entries(grouped).map(([vendor, items]) => <div className="vendor-cart" key={vendor}>
          <h3>🏪 {vendor}</h3>
          {items.map((item) => {
            const outOfStock = (item.status && item.status !== 'ACTIVE') || (Number.isFinite(item.stock) && item.stock <= 0);
            const atMax = Number(item.stock) > 0 && item.qty >= item.stock;
            return <div className="cart-item" key={item.id}>
              <ProductImage src={item.image} alt="" />
              <div className="cart-main">
                <Link to={`/product/${item.id}`}>{item.name}</Link>
                {item.sku && <small>SKU: {item.sku}</small>}
                <b>{money(item.price)}</b>
                {outOfStock && <small className="danger-text">No longer available. Remove it to continue.</small>}
                {!outOfStock && Number(item.stock) > 0 && item.qty > item.stock && <small className="danger-text">Only {item.stock} left. Lower the quantity.</small>}
              </div>
              <div className="qty" aria-label={`Quantity of ${item.name}`}>
                <button type="button" aria-label="Decrease quantity" disabled={busyId === item.id || item.qty <= 1} onClick={() => run(item.id, () => updateCartQty(item.id, item.qty - 1))}>−</button>
                <span aria-live="polite">{item.qty}</span>
                <button type="button" aria-label="Increase quantity" disabled={busyId === item.id || outOfStock || atMax} onClick={() => run(item.id, () => updateCartQty(item.id, item.qty + 1))}>+</button>
              </div>
              <button type="button" className="icon-btn" aria-label={`Remove ${item.name}`} disabled={busyId === item.id} onClick={() => run(item.id, () => removeFromCart(item.id))}>×</button>
            </div>;
          })}
        </div>)}
      </section>
      <aside className="summary-card">
        <h3>Order summary</h3>
        <div><span>Subtotal</span><b>{money(subtotal)}</b></div>
        <div><span>Delivery</span><b>Calculated at checkout</b></div>
        <p className="tiny">Each seller sets its own delivery fee for your district. You see the exact amount at checkout before you pay.</p>
        <hr />
        <div className="grand"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
        <button type="button" className="gradient-btn full" disabled={blocked} onClick={() => navigate('/checkout')}>Proceed to checkout</button>
        {blocked && <p className="tiny danger-text">Fix the highlighted items to continue.</p>}
        <p className="tiny">Your payment is held by MVEC until you confirm delivery.</p>
      </aside>
    </div>}
  </main></Storefront>;
}
