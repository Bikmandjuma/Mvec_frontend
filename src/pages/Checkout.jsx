import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Storefront from "../components/Storefront";
import ProductImage from "../components/ProductImage";
import { useMarketplace } from "../context/MarketplaceContext";
import { useAuth } from "../context/AuthContext";
import { productsApi } from "../API/products";
import { ordersApi } from "../API/orders";
import { extractErrorMessage } from "../API/client";

const money = (n) => new Intl.NumberFormat("en-RW").format(Number(n) || 0) + " RWF";

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, clearCart } = useMarketplace();
  const { user } = useAuth();

  const pid = params.get("product");
  const [buyNowProduct, setBuyNowProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(Boolean(pid));

  useEffect(() => {
    if (!pid || pid === "undefined") { setLoadingProduct(false); return; }
    let alive = true;
    productsApi.getById(pid).then((p) => {
      if (!alive || !p) return;
      setBuyNowProduct({
        id: p._id || p.id,
        name: p.name,
        image: p.mainImage || p.image || "",
        vendor: p.vendor?.companyName || p.vendor?.fullName || "MVEC Seller",
        price: p.discountPrice || p.price,
      });
    }).finally(() => alive && setLoadingProduct(false));
    return () => { alive = false; };
  }, [pid]);

  const items = useMemo(() => {
    if (buyNowProduct) return [{ ...buyNowProduct, qty: Number(params.get("qty") || 1) }];
    return cart;
  }, [buyNowProduct, cart, params]);

  const [form, setForm] = useState(() => {
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem("mvec_checkout_form") || "{}"); } catch { /* ignore invalid saved form */ }
    sessionStorage.removeItem("mvec_checkout_form");
    return {
      name: user?.fullName || "", phone: user?.telephone || "", email: user?.email || "",
      province: "Kigali City", district: "Gasabo", sector: "Remera",
      address: "KG 11 Ave, Kigali", method: "standard", ...saved,
    };
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const subtotal = items.reduce((s, x) => s + (x.price || 0) * (x.qty || x.quantity || 1), 0);
  const shipping = form.province === "Kigali City" ? 0 : (form.method === "express" ? 10000 : 5000);
  const total = subtotal + shipping;

  function update(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  async function continuePayment(e) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.phone || !form.address) {
      setError("Please complete your name, phone number and delivery address.");
      return;
    }
    if (!items.length) { setError("Your cart is empty."); return; }
    if (!user) {
      sessionStorage.setItem("mvec_checkout_form", JSON.stringify(form));
      navigate("/signup", { state: { from: `${location.pathname}${location.search}`, checkoutReturn: true } });
      return;
    }

    setSubmitting(true);
    try {
      const shippingAddress = {
        street: form.address,
        city: form.district,
        province: form.province,
        state: form.sector,
        country: "Rwanda",
      };

      let order;
      if (buyNowProduct) {
        const res = await ordersApi.directCheckout({
          items: items.map((x) => ({ productId: x.id, qty: x.qty })),
          shippingAddress,
          paymentMethod: "momo",
        });
        order = res.order;
      } else {
        const res = await ordersApi.checkout({ shippingAddress, paymentMethod: "momo" });
        order = res.order;
        await clearCart();
      }
      const orderId = order?._id || order?.id;
      if (!orderId) throw new Error("The order was created, but its ID was missing from the response.");
      navigate(`/payment/${orderId}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingProduct) {
    return <Storefront><main className="checkout-page"><div className="empty-state"><h3>Loading…</h3></div></main></Storefront>;
  }

  return <Storefront><main className="checkout-page">
    <div className="page-title"><span className="eyebrow">CHECKOUT</span><h1>Complete your order</h1><p>Simple phone-first checkout with protected MVEC settlement.</p></div>
    <div className="checkout-steps"><span className="active">1 Customer & delivery</span><span>2 Payment</span><span>3 Confirmation</span></div>
    {error && <div className="form-alert error">{error}</div>}
    <form onSubmit={continuePayment}><div className="checkout-layout"><section className="checkout-main">
      <div className="form-card"><h2>Customer information</h2><p className="tiny">Email is optional. Your phone number is used for order updates.</p>
        <div className="two-col"><label className="field"><span>Name</span><input name="name" value={form.name} onChange={update} required /></label><label className="field"><span>Phone</span><input name="phone" value={form.phone} onChange={update} placeholder="+250 7xx xxx xxx" required /></label></div>
        <label className="field"><span>Email (optional)</span><input name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" /></label>
      </div>
      <div className="form-card"><h2>Delivery address</h2><div className="two-col"><label className="field"><span>Province / City</span><select name="province" value={form.province} onChange={update}><option>Kigali City</option><option>Northern Province</option><option>Southern Province</option><option>Eastern Province</option><option>Western Province</option></select></label><label className="field"><span>District</span><input name="district" value={form.district} onChange={update} placeholder="District" /></label></div><div className="two-col"><label className="field"><span>Sector</span><input name="sector" value={form.sector} onChange={update} placeholder="Sector" /></label><label className="field"><span>Street / landmark</span><input name="address" value={form.address} onChange={update} placeholder="Street, landmark" required /></label></div>
        <div className="delivery-options"><label><input type="radio" checked={form.method === "standard"} onChange={() => setForm({ ...form, method: "standard" })} /> Standard delivery <b>{form.province === "Kigali City" ? "FREE" : "5,000 RWF"}</b></label><label><input type="radio" checked={form.method === "express"} onChange={() => setForm({ ...form, method: "express" })} /> Express delivery <b>10,000 RWF</b></label></div>
        <p className="tiny">Delivery is fulfilled by the seller or an assigned delivery partner. Delivery proof is recorded when the order arrives.</p>
      </div>
      <div className="form-card"><h2>Order items</h2>{items.length === 0 && <p className="tiny">Your cart is empty.</p>}{items.map((x, i) => <div className="mini-item" key={x.id || i}><ProductImage src={x.image} alt="" /><div><b>{x.name}</b><span>{x.vendor} · Qty {x.qty || x.quantity || 1}</span></div><strong>{money((x.price || 0) * (x.qty || x.quantity || 1))}</strong></div>)}</div>
    </section><aside className="summary-card"><h2>Order summary</h2><div><span>Products</span><b>{money(subtotal)}</b></div><div><span>Shipping</span><b>{money(shipping)}</b></div><div><span>Platform fees</span><b>Included where applicable</b></div><hr /><div className="grand"><span>Grand total</span><strong>{money(total)}</strong></div>
      <button className="gradient-btn full" type="submit" disabled={submitting}>{submitting ? "Placing order…" : "Continue to payment"}</button><Link to="/cart" className="back-link">← Back to cart</Link>
      <div className="verified-box"><b>✓ Clear payment flow</b><p>Your payment is processed through an appropriate payment partner. In the protected workflow, funds are recorded as HELD until delivery is confirmed.</p></div>
    </aside></div></form>
  </main></Storefront>;
}
