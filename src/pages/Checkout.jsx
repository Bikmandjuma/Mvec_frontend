import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Storefront from "../components/Storefront";
import { useMarketplace } from "../context/MarketplaceContext";
import { useAuth } from "../context/AuthContext";
import { productsApi } from "../API/products";
import { ordersApi } from "../API/orders";
import { shippingApi } from "../API/shipping";
import { RWANDA_LOCATIONS, PROVINCES } from "../data/rwandaLocations";
import { extractErrorMessage } from "../API/client";

const money = (n) => new Intl.NumberFormat("en-RW").format(Number(n) || 0) + " RWF";

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { cart, clearCart } = useMarketplace();
  const { user } = useAuth();

  const pid = params.get("product");
  const [buyNowProduct, setBuyNowProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(Boolean(pid));

  useEffect(() => {
    if (!pid) { setLoadingProduct(false); return; }
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

  const [form, setForm] = useState({
    name: user?.fullName || "",
    phone: user?.telephone || "",
    email: user?.email || "",
    province: "Kigali City",
    district: "Gasabo",
    sector: "Remera",
    address: "KG 11 Ave, Kigali",
    method: "STANDARD",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Delivery quotes from the sellers' shipping zones, one per method.
  const [quotes, setQuotes] = useState({ STANDARD: null, EXPRESS: null });
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  const subtotal = items.reduce((s, x) => s + (x.price || 0) * (x.qty || x.quantity || 1), 0);
  const quote = quotes[form.method];
  const shipping = quote?.shippingFee ?? 0;
  const total = subtotal + shipping;
  const undeliverable = quote && !quote.deliverable;

  const quoteItems = useMemo(() => items.map((x) => ({ productId: x.id || x._id, qty: x.qty || x.quantity || 1 })), [items]);
  const quoteKey = JSON.stringify([form.province, form.district, quoteItems]);
  useEffect(() => {
    if (!user || !quoteItems.length || !form.district) { setQuotes({ STANDARD: null, EXPRESS: null }); return; }
    let alive = true;
    setQuoting(true);
    setQuoteError("");
    const t = setTimeout(() => {
      const address = { province: form.province, district: form.district };
      Promise.all(["STANDARD", "EXPRESS"].map((method) => shippingApi.quote({ address, method, items: quoteItems })))
        .then(([standard, express]) => alive && setQuotes({ STANDARD: standard, EXPRESS: express }))
        .catch((err) => alive && setQuoteError(extractErrorMessage(err)))
        .finally(() => alive && setQuoting(false));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, user]);

  function update(e) {
    const { name, value } = e.target;
    // Changing province resets the district to the first one in that province.
    setForm((f) => (name === "province" ? { ...f, province: value, district: RWANDA_LOCATIONS[value][0] } : { ...f, [name]: value }));
  }
  const feeLabel = (method) => {
    const q = quotes[method];
    if (!user) return "Sign in to see";
    if (!q) return quoting ? "…" : "—";
    if (!q.deliverable) return "Unavailable";
    return q.shippingFee === 0 ? "FREE" : money(q.shippingFee);
  };

  async function continuePayment(e) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.phone || !form.address) {
      setError("Please complete your name, phone number and delivery address.");
      return;
    }
    if (!items.length) { setError("Your cart is empty."); return; }
    if (!user) { navigate("/login", { state: { from: "/checkout" } }); return; }
    if (undeliverable) { setError(quote.groups.filter((g) => !g.deliverable).map((g) => g.message).join(" ")); return; }

    setSubmitting(true);
    try {
      const shippingAddress = {
        street: form.address,
        district: form.district,
        province: form.province,
        sector: form.sector,
        country: "Rwanda",
      };

      let order;
      if (buyNowProduct) {
        const res = await ordersApi.directCheckout({
          items: items.map((x) => ({ productId: x.id, qty: x.qty })),
          shippingAddress,
          paymentMethod: "momo",
          shippingMethod: form.method,
        });
        order = res.order;
      } else {
        const res = await ordersApi.checkout({ shippingAddress, paymentMethod: "momo", shippingMethod: form.method });
        order = res.order;
        await clearCart();
      }
      navigate(`/payment/${order.id || order._id}`);
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
      <div className="form-card"><h2>Delivery address</h2><div className="two-col"><label className="field"><span>Province / City</span><select name="province" value={form.province} onChange={update}>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></label><label className="field"><span>District</span><select name="district" value={form.district} onChange={update}>{RWANDA_LOCATIONS[form.province].map((d) => <option key={d}>{d}</option>)}</select></label></div><div className="two-col"><label className="field"><span>Sector</span><input name="sector" value={form.sector} onChange={update} placeholder="Sector" /></label><label className="field"><span>Street / landmark</span><input name="address" value={form.address} onChange={update} placeholder="Street, landmark" required /></label></div>
        <div className="delivery-options"><label><input type="radio" checked={form.method === "STANDARD"} onChange={() => setForm({ ...form, method: "STANDARD" })} /> Standard delivery <b>{feeLabel("STANDARD")}</b></label><label><input type="radio" checked={form.method === "EXPRESS"} onChange={() => setForm({ ...form, method: "EXPRESS" })} /> Express delivery <b>{feeLabel("EXPRESS")}</b></label></div>
        {quoteError && <div className="form-alert error">{quoteError}</div>}
        {undeliverable && <div className="form-alert error">{quote.groups.filter((g) => !g.deliverable).map((g) => g.message).join(" ")} Choose another district or remove those items.</div>}
        {quote?.deliverable && <div className="checkout-parcels">{quote.groups.map((g) => <div key={`${g.vendor}-${g.store}`}>
          <span><b>{g.storeName}</b><small>{g.zoneName}{g.eta ? ` · ${g.eta}` : ""}{g.freeOverAmount && g.fee > 0 ? ` · free from ${money(g.freeOverAmount)}` : ""}</small>{g.message && <small className="checkout-parcel-note">{g.message}</small>}</span>
          <strong>{g.fee === 0 ? "FREE" : money(g.fee)}</strong>
        </div>)}</div>}
        <p className="tiny">Delivery fees are set by each seller for your district. Items from different stores ship separately.</p>
      </div>
      <div className="form-card"><h2>Order items</h2>{items.length === 0 && <p className="tiny">Your cart is empty.</p>}{items.map((x, i) => <div className="mini-item" key={x.id || i}><img src={x.image} alt="" /><div><b>{x.name}</b><span>{x.vendor} · Qty {x.qty || x.quantity || 1}</span></div><strong>{money((x.price || 0) * (x.qty || x.quantity || 1))}</strong></div>)}</div>
    </section><aside className="summary-card"><h2>Order summary</h2><div><span>Products</span><b>{money(subtotal)}</b></div><div><span>Delivery{quote?.groups?.length > 1 ? ` (${quote.groups.length} parcels)` : ""}</span><b>{!user ? "At sign-in" : quoting && !quote ? "…" : undeliverable ? "—" : shipping === 0 ? "FREE" : money(shipping)}</b></div><div><span>Platform fees</span><b>Included where applicable</b></div><hr /><div className="grand"><span>Grand total</span><strong>{money(total)}</strong></div>
      <button className="gradient-btn full" type="submit" disabled={submitting || undeliverable || (user && quoting && !quote)}>{submitting ? "Placing order…" : "Continue to payment"}</button><Link to="/cart" className="back-link">← Back to cart</Link>
      <div className="verified-box"><b>✓ Clear payment flow</b><p>Your payment is processed through an appropriate payment partner. In the protected workflow, funds are recorded as HELD until delivery is confirmed.</p></div>
    </aside></div></form>
  </main></Storefront>;
}
