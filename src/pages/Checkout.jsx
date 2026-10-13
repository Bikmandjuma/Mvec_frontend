import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Storefront from "../components/Storefront";
import ProductImage from "../components/ProductImage";
import { useMarketplace } from "../context/MarketplaceContext";
import { useAuth } from "../context/AuthContext";
import { productsApi } from "../API/products";
import { ordersApi } from "../API/orders";
import { addressesApi } from "../API/addresses";
import { shippingApi } from "../API/shipping";
import { RWANDA_LOCATIONS, PROVINCES } from "../data/rwandaLocations";
import { extractErrorMessage } from "../API/client";
import { mapBackendProduct, clearCatalogCache } from "../services/catalogApi";
import { money } from "../utils/format";
import { isRwandanPhone } from "../utils/delivery";

const FORM_KEY = "mvec_checkout_form";
const EMPTY_FORM = { name: "", phone: "", email: "", province: "Kigali City", district: "", sector: "", street: "", method: "standard" };

const readSavedForm = () => {
  try { return JSON.parse(sessionStorage.getItem(FORM_KEY) || "null"); } catch { return null; }
};

const METHODS = ["standard", "express"];

// The province a district belongs to, matched case-insensitively.
const findDistrict = (name) => {
  const wanted = String(name || "").trim().toLowerCase();
  for (const province of PROVINCES) {
    const district = RWANDA_LOCATIONS[province].find((d) => d.toLowerCase() === wanted);
    if (district) return { province, district };
  }
  return null;
};

const fromAddress = (a) => ({
  ...(findDistrict(a.cityDistrict) || { province: PROVINCES.includes(a.provinceState) ? a.provinceState : "Kigali City", district: "" }),
  sector: a.sector || "",
  street: [a.street, a.building, a.apartment].filter(Boolean).join(", "),
  phone: a.phone || "",
});

function validate(form) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = "Enter the name of the person receiving the order.";
  if (!isRwandanPhone(form.phone)) errors.phone = "Enter a Rwandan mobile number, for example 0788 123 456.";
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Enter a valid email or leave it empty.";
  if (!RWANDA_LOCATIONS[form.province]?.includes(form.district)) errors.district = "Choose your district.";
  if (form.street.trim().length < 3) errors.street = "Enter your street, house number or a nearby landmark.";
  return errors;
}

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, cartLoading, refreshCart } = useMarketplace();
  const { user, loading: authLoading } = useAuth();

  const pid = params.get("product");
  const requestedQty = Math.max(1, Math.min(100, Math.floor(Number(params.get("qty")) || 1)));
  const [buyNowProduct, setBuyNowProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(Boolean(pid));
  const [productError, setProductError] = useState("");

  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...(readSavedForm() || {}) }));
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState("");
  const [saveAddress, setSaveAddress] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const prefilled = useRef(false);
  const errorRef = useRef(null);

  // Buy now: load the one product being purchased.
  useEffect(() => {
    if (!pid) { setLoadingProduct(false); return undefined; }
    let alive = true;
    productsApi.getById(pid)
      .then((raw) => alive && setBuyNowProduct(mapBackendProduct(raw)))
      .catch(() => alive && setProductError("This product is no longer available."))
      .finally(() => alive && setLoadingProduct(false));
    return () => { alive = false; };
  }, [pid]);

  // Once the account is known, fill in the buyer's details and default
  // address. Anything restored from a sign-in redirect wins.
  useEffect(() => {
    if (authLoading || !user || prefilled.current) return;
    prefilled.current = true;
    const restored = readSavedForm();
    sessionStorage.removeItem(FORM_KEY);
    setForm((f) => ({
      ...f,
      name: f.name || user.fullName || "",
      phone: f.phone || user.telephone || "",
      email: f.email || user.email || "",
    }));
    addressesApi.getAll().then((res) => {
      const list = res.addresses || [];
      setAddresses(list);
      const preferred = list.find((a) => a.isDefaultShipping) || list[0];
      if (preferred && !restored?.street) {
        setAddressId(preferred._id);
        setForm((f) => ({ ...f, ...fromAddress(preferred), phone: f.phone || preferred.phone || "" }));
      }
      if (!list.length) setSaveAddress(true);
    }).catch(() => {});
  }, [authLoading, user]);

  const items = useMemo(() => {
    if (pid) {
      if (!buyNowProduct) return [];
      const qty = Math.min(requestedQty, Math.max(1, buyNowProduct.stock || 1));
      return [{ ...buyNowProduct, qty }];
    }
    return cart;
  }, [pid, buyNowProduct, requestedQty, cart]);

  const unavailable = items.filter((x) => (x.status && x.status !== "ACTIVE") || (Number.isFinite(x.stock) && x.stock <= 0) || (Number(x.stock) > 0 && x.qty > x.stock));
  const subtotal = items.reduce((s, x) => s + (Number(x.price) || 0) * (x.qty || 1), 0);

  // Delivery quotes from the sellers' shipping zones, one per method. The
  // server recomputes the fee when the order is created.
  const [quotes, setQuotes] = useState({ standard: null, express: null });
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const quote = quotes[form.method];
  const delivery = quote?.shippingFee ?? 0;
  const total = subtotal + delivery;
  const undeliverable = Boolean(quote && !quote.deliverable);
  const undeliverableMessage = undeliverable ? quote.groups.filter((g) => !g.deliverable).map((g) => g.message).join(" ") : "";

  const quoteItems = useMemo(() => items.map((x) => ({ productId: x.id || x._id, qty: x.qty || 1 })), [items]);
  const quoteKey = JSON.stringify([form.province, form.district, quoteItems]);
  useEffect(() => {
    const validDistrict = RWANDA_LOCATIONS[form.province]?.includes(form.district);
    if (!user || !quoteItems.length || !validDistrict) { setQuotes({ standard: null, express: null }); return undefined; }
    let alive = true;
    setQuoting(true);
    setQuoteError("");
    const t = setTimeout(() => {
      const address = { province: form.province, district: form.district };
      Promise.all(METHODS.map((m) => shippingApi.quote({ address, method: m.toUpperCase(), items: quoteItems })))
        .then(([standard, express]) => alive && setQuotes({ standard, express }))
        .catch((err) => alive && setQuoteError(extractErrorMessage(err, "We could not work out the delivery fee right now. You can still place the order; the fee is confirmed on the next step.")))
        .finally(() => alive && setQuoting(false));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, user]);

  const feeLabel = (method) => {
    const q = quotes[method];
    if (!user) return "Shown after sign-in";
    if (!q) return quoting ? "…" : "—";
    if (!q.deliverable) return "Unavailable";
    return q.shippingFee === 0 ? "FREE" : money(q.shippingFee);
  };

  const update = (e) => {
    const { name, value } = e.target;
    // Changing province resets the district to one in that province.
    setForm((f) => (name === "province" ? { ...f, province: value, district: "" } : { ...f, [name]: value }));
    if (errors[name]) setErrors((x) => ({ ...x, [name]: undefined }));
    if (["province", "district", "sector", "street"].includes(name)) setAddressId("");
  };

  const pickAddress = (id) => {
    setAddressId(id);
    const a = addresses.find((x) => x._id === id);
    if (a) setForm((f) => ({ ...f, ...fromAddress(a) }));
  };

  const showError = (message) => {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  async function placeOrder(e) {
    e.preventDefault();
    setError("");
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) { showError("Please check the highlighted fields."); return; }
    if (!items.length) { showError("Your cart is empty."); return; }
    if (unavailable.length) { showError("Some items are no longer available in the quantity selected. Update your cart first."); return; }

    if (!user) {
      // Keep what the buyer typed and come straight back after signing in.
      sessionStorage.setItem(FORM_KEY, JSON.stringify(form));
      navigate("/login", { state: { from: `${location.pathname}${location.search}`, checkoutReturn: true } });
      return;
    }
    if (undeliverable) { showError(`${undeliverableMessage} Choose another district or remove those items.`); return; }

    setSubmitting(true);
    try {
      const payload = {
        shippingAddress: { street: form.street.trim(), district: form.district, sector: form.sector.trim(), province: form.province, country: "Rwanda" },
        recipient: { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() },
        deliveryMethod: form.method,
        shippingMethod: form.method.toUpperCase(),
      };
      const res = pid
        ? await ordersApi.directCheckout({ ...payload, items: items.map((x) => ({ productId: x.id, quantity: x.qty })) })
        : await ordersApi.checkout(payload);

      if (saveAddress && !addressId) {
        addressesApi.add({
          type: "HOME", country: "Rwanda", provinceState: form.province, cityDistrict: form.district,
          sector: form.sector.trim(), street: form.street.trim(), phone: form.phone.trim(),
        }).catch(() => {});
      }

      clearCatalogCache(); // stock changed
      if (!pid) refreshCart(); // the server emptied the cart
      const orderId = res.order?.id;
      if (!orderId) throw new Error("Your order was placed. Open My orders to pay for it.");
      navigate(`/payment/${orderId}`, { replace: true });
    } catch (err) {
      showError(extractErrorMessage(err));
      if (!pid) refreshCart();
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingProduct || (!pid && cartLoading && !cart.length)) {
    return <Storefront><main className="checkout-page"><div className="empty-state"><h3>Loading…</h3></div></main></Storefront>;
  }
  if (productError || (!items.length && !submitting)) {
    return <Storefront><main className="checkout-page"><div className="empty-state">
      <h2>{productError || "Your cart is empty"}</h2>
      <Link className="gradient-btn" to="/shop">Continue shopping</Link>
    </div></main></Storefront>;
  }

  const field = (name, label, props = {}) => (
    <label className={`field ${errors[name] ? "has-error" : ""}`}>
      <span>{label}</span>
      <input name={name} value={form[name]} onChange={update} aria-invalid={Boolean(errors[name])} {...props} />
      {errors[name] && <small className="field-error">{errors[name]}</small>}
    </label>
  );

  return <Storefront><main className="checkout-page">
    <div className="page-title"><span className="eyebrow">CHECKOUT</span><h1>Complete your order</h1><p>Pay with mobile money. MVEC holds the payment until you confirm delivery.</p></div>
    <ol className="checkout-steps"><li className="active">1 Delivery details</li><li>2 Payment</li><li>3 Confirmation</li></ol>
    {error && <div className="form-alert error" role="alert" ref={errorRef}>{error}</div>}
    <form onSubmit={placeOrder} noValidate><div className="checkout-layout"><section className="checkout-main">
      <div className="form-card"><h2>Who receives the order?</h2><p className="tiny">The seller and courier use this phone number to reach you.</p>
        <div className="two-col">
          {field("name", "Full name", { autoComplete: "name", required: true })}
          {field("phone", "Phone", { type: "tel", autoComplete: "tel", placeholder: "07xx xxx xxx", required: true })}
        </div>
        {field("email", "Email (optional)", { type: "email", autoComplete: "email", placeholder: "you@example.com" })}
      </div>

      <div className="form-card"><h2>Delivery address</h2>
        {addresses.length > 0 && (
          <label className="field"><span>Saved addresses</span>
            <select value={addressId} onChange={(e) => pickAddress(e.target.value)}>
              <option value="">Enter a new address</option>
              {addresses.map((a) => <option key={a._id} value={a._id}>{`${a.type || "Address"}: ${a.street}, ${a.cityDistrict}`}</option>)}
            </select>
          </label>
        )}
        <div className="two-col">
          <label className="field"><span>Province / City</span><select name="province" value={form.province} onChange={update}>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label className={`field ${errors.district ? "has-error" : ""}`}><span>District</span>
            <select name="district" value={form.district} onChange={update} aria-invalid={Boolean(errors.district)} required>
              <option value="">Choose a district</option>
              {(RWANDA_LOCATIONS[form.province] || []).map((d) => <option key={d}>{d}</option>)}
            </select>
            {errors.district && <small className="field-error">{errors.district}</small>}
          </label>
        </div>
        <div className="two-col">
          {field("sector", "Sector (optional)", { placeholder: "e.g. Remera" })}
          {field("street", "Street / landmark", { placeholder: "e.g. KG 11 Ave, house 18", autoComplete: "street-address", required: true })}
        </div>
        {user && !addressId && <label className="filter-check"><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> Save this address to my account</label>}
        <fieldset className="delivery-options">
          <legend className="tiny">Delivery speed</legend>
          <label><input type="radio" name="method" checked={form.method === "standard"} onChange={() => setForm((f) => ({ ...f, method: "standard" }))} /> Standard delivery <b>{feeLabel("standard")}</b></label>
          <label><input type="radio" name="method" checked={form.method === "express"} onChange={() => setForm((f) => ({ ...f, method: "express" }))} /> Express delivery <b>{feeLabel("express")}</b></label>
        </fieldset>
        {quoteError && <div className="form-alert error">{quoteError}</div>}
        {undeliverable && <div className="form-alert error">{undeliverableMessage} Choose another district or remove those items.</div>}
        {quote?.deliverable && <div className="checkout-parcels">{quote.groups.map((g) => <div key={`${g.vendor}-${g.store}`}>
          <span><b>{g.storeName}</b><small>{g.zoneName}{g.eta ? ` · ${g.eta}` : ""}{g.freeOverAmount && g.fee > 0 ? ` · free from ${money(g.freeOverAmount)}` : ""}</small>{g.message && <small className="checkout-parcel-note">{g.message}</small>}</span>
          <strong>{g.fee === 0 ? "FREE" : money(g.fee)}</strong>
        </div>)}</div>}
        <p className="tiny">Delivery fees are set by each seller for your district; items from different stores ship separately. The seller or an MVEC delivery partner brings your order. You give them your delivery code when it arrives.</p>
      </div>

      <div className="form-card"><h2>Order items</h2>
        {items.map((x) => {
          const problem = (x.status && x.status !== "ACTIVE") || (Number.isFinite(x.stock) && x.stock <= 0)
            ? "No longer available"
            : Number(x.stock) > 0 && x.qty > x.stock ? `Only ${x.stock} left` : "";
          return <div className="mini-item" key={x.id}>
            <ProductImage src={x.image} alt="" />
            <div><b>{x.name}</b><span>{x.vendor} · Qty {x.qty}</span>{problem && <small className="danger-text">{problem}</small>}</div>
            <strong>{money((Number(x.price) || 0) * x.qty)}</strong>
          </div>;
        })}
        {pid && requestedQty > (buyNowProduct?.stock || 0) && buyNowProduct?.stock > 0 && <p className="tiny">Quantity lowered to the {buyNowProduct.stock} available.</p>}
      </div>
    </section>
    <aside className="summary-card"><h2>Order summary</h2>
      <div><span>Products</span><b>{money(subtotal)}</b></div>
      <div><span>Delivery{quote?.groups?.length > 1 ? ` (${quote.groups.length} parcels)` : ""}</span><b>{!user ? "Shown after sign-in" : quoting && !quote ? "…" : undeliverable ? "—" : !quote ? "—" : delivery === 0 ? "FREE" : money(delivery)}</b></div>
      <hr />
      <div className="grand"><span>Total to pay</span><strong>{money(total)}</strong></div>
      <button className="gradient-btn full" type="submit" disabled={submitting || authLoading || unavailable.length > 0 || undeliverable}>
        {submitting ? "Placing order…" : user ? "Continue to payment" : "Sign in to continue"}
      </button>
      {!pid && <Link to="/cart" className="back-link">← Back to cart</Link>}
      <div className="verified-box"><b>✓ Protected payment</b><p>You pay by MTN MoMo or Airtel Money on the next step. MVEC holds the money and only releases it to the seller after you confirm delivery with your code.</p></div>
    </aside></div></form>
  </main></Storefront>;
}
