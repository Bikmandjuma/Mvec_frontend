import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import Storefront from "../components/Storefront";
import ProductImage from "../components/ProductImage";
import { useMarketplace, GUEST_CART_KEY } from "../context/MarketplaceContext";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../API/auth";
import { cartApi } from "../API/cart";
import { productsApi } from "../API/products";
import { ordersApi } from "../API/orders";
import { addressesApi } from "../API/addresses";
import { shippingApi } from "../API/shipping";
import { promotionsApi } from "../API/promotions";
import { RWANDA_LOCATIONS, PROVINCES } from "../data/rwandaLocations";
import { extractErrorMessage } from "../API/client";
import { mapBackendProduct, clearCatalogCache } from "../services/catalogApi";
import { money } from "../utils/format";
import { isRwandanPhone } from "../utils/delivery";

const FORM_KEY = "mvec_checkout_form";
// fulfilment: "" until the buyer chooses; "pickup" or "delivery".
// method: the delivery speed, used only for delivery.
const EMPTY_FORM = { name: "", phone: "", email: "", fulfilment: "", province: "Kigali City", district: "", sector: "", street: "", method: "standard" };

const readSavedForm = () => {
  try { return JSON.parse(sessionStorage.getItem(FORM_KEY) || "null"); } catch { return null; }
};

const SPEEDS = ["standard", "express"];

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
  const who = form.fulfilment === "pickup" ? "collecting" : "receiving";
  if (form.name.trim().length < 2) errors.name = `Enter the name of the person ${who} the order.`;
  if (!isRwandanPhone(form.phone)) errors.phone = "Enter a Rwandan mobile number, for example 0788 123 456.";
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Enter a valid email or leave it empty.";
  if (!form.fulfilment) errors.fulfilment = "Choose whether you'll pick the order up or have it delivered.";
  if (form.fulfilment === "delivery") {
    if (!RWANDA_LOCATIONS[form.province]?.includes(form.district)) errors.district = "Choose your district.";
    if (form.street.trim().length < 3) errors.street = "Enter your street, house number or a nearby landmark.";
  }
  return errors;
}

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { cart, cartLoading, refreshCart } = useMarketplace();
  const { user, loading: authLoading, startSession } = useAuth();

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

  // Guest checkout: the buyer proves the phone with a one-time code.
  const [verify, setVerify] = useState(null); // { step: "sending" | "code", code, busy, error, devCode }

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

  const isPickup = form.fulfilment === "pickup";
  const isDelivery = form.fulfilment === "delivery";
  const chosenMethod = isPickup ? "pickup" : isDelivery ? form.method : "";

  // Quotes: delivery fees from each seller's zones (one per speed), or the
  // pickup points. The server recomputes everything when the order is created.
  const [quotes, setQuotes] = useState({ standard: null, express: null, pickup: null });
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const quote = chosenMethod ? quotes[chosenMethod] : null;
  // No delivery fee until the buyer chooses delivery.
  const delivery = isDelivery ? quote?.shippingFee ?? 0 : 0;
  const undeliverable = Boolean(isDelivery && quote && !quote.deliverable);
  const undeliverableMessage = undeliverable ? quote.groups.filter((g) => !g.deliverable).map((g) => g.message).join(" ") : "";
  // Seller coupon: previewed here, applied for real when the order is created.
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const discount = coupon ? Math.min(coupon.discount, subtotal + delivery) : 0;
  const total = subtotal + delivery - discount;

  const quoteItems = useMemo(() => items.map((x) => ({ productId: x.id || x._id, qty: x.qty || 1 })), [items]);
  const quoteKey = JSON.stringify([form.fulfilment, form.province, form.district, quoteItems]);
  useEffect(() => {
    const validDistrict = RWANDA_LOCATIONS[form.province]?.includes(form.district);
    if (!quoteItems.length || (isDelivery && !validDistrict) || !form.fulfilment) {
      setQuotes({ standard: null, express: null, pickup: null });
      return undefined;
    }
    let alive = true;
    setQuoting(true);
    setQuoteError("");
    const t = setTimeout(() => {
      const request = isPickup
        ? shippingApi.quote({ method: "PICKUP", items: quoteItems }).then((pickup) => ({ standard: null, express: null, pickup }))
        : Promise.all(SPEEDS.map((m) => shippingApi.quote({ address: { province: form.province, district: form.district }, method: m.toUpperCase(), items: quoteItems })))
            .then(([standard, express]) => ({ standard, express, pickup: null }));
      request
        .then((next) => alive && setQuotes(next))
        .catch((err) => alive && setQuoteError(extractErrorMessage(err, isPickup
          ? "We could not load the pickup points right now. You can still place the order; the seller's address is shown on your order."
          : "We could not work out the delivery fee right now. You can still place the order; the fee is confirmed on the next step.")))
        .finally(() => alive && setQuoting(false));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const checkCoupon = async (code, silent = false) => {
    if (!code.trim()) return;
    if (!user) { setCouponError("Coupons work once you're signed in or have verified your phone."); return; }
    setCouponBusy(true);
    if (!silent) setCouponError("");
    try {
      const res = await promotionsApi.validate({
        code: code.trim(), items: quoteItems, shippingMethod: chosenMethod || "pickup",
        shippingAddress: isDelivery && form.district ? { province: form.province, district: form.district } : undefined,
      });
      setCoupon(res);
      setCouponError("");
    } catch (err) {
      setCoupon(null);
      setCouponError(extractErrorMessage(err));
    } finally { setCouponBusy(false); }
  };
  // The discount depends on the basket and delivery, so re-check when they change.
  useEffect(() => {
    if (coupon) checkCoupon(coupon.code, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, form.method]);

  const feeLabel = (method) => {
    const q = quotes[method];
    if (!q) return quoting ? "…" : RWANDA_LOCATIONS[form.province]?.includes(form.district) ? "—" : "Choose your district";
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

  const chooseFulfilment = (value) => {
    setForm((f) => ({ ...f, fulfilment: value }));
    setErrors((x) => ({ ...x, fulfilment: undefined, district: undefined, street: undefined }));
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

  // The order request. Guests always send their items with the order (their
  // basket lives in this browser, not in an account cart).
  async function submitOrder({ guestItems = null } = {}) {
    const payload = {
      shippingAddress: isDelivery
        ? { street: form.street.trim(), district: form.district, sector: form.sector.trim(), province: form.province, country: "Rwanda" }
        : {},
      recipient: { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() },
      deliveryMethod: chosenMethod,
      shippingMethod: chosenMethod.toUpperCase(),
      couponCode: coupon?.code,
    };
    const lines = guestItems || (pid ? items : null);
    const res = lines
      ? await ordersApi.directCheckout({ ...payload, items: lines.map((x) => ({ productId: x.id, quantity: x.qty })) })
      : await ordersApi.checkout(payload);

    if (isDelivery && user && saveAddress && !addressId) {
      addressesApi.add({
        type: "HOME", country: "Rwanda", provinceState: form.province, cityDistrict: form.district,
        sector: form.sector.trim(), street: form.street.trim(), phone: form.phone.trim(),
      }).catch(() => {});
    }
    clearCatalogCache(); // stock changed
    const orderId = res.order?.id;
    if (!orderId) throw new Error("Your order was placed. Open My orders to pay for it.");
    return orderId;
  }

  async function placeOrder(e) {
    e.preventDefault();
    setError("");
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) { showError(found.fulfilment && Object.keys(found).length === 1 ? found.fulfilment : "Please check the highlighted fields."); return; }
    if (!items.length) { showError("Your cart is empty."); return; }
    if (unavailable.length) { showError("Some items are no longer available in the quantity selected. Update your cart first."); return; }
    if (undeliverable) { showError(`${undeliverableMessage} Choose another district, choose pickup, or remove those items.`); return; }

    // No account needed: a guest confirms their phone with a code first.
    if (!user) { sendGuestCode(); return; }

    setSubmitting(true);
    try {
      const orderId = await submitOrder();
      if (!pid) refreshCart(); // the server emptied the cart
      navigate(`/payment/${orderId}`, { replace: true });
    } catch (err) {
      showError(extractErrorMessage(err));
      if (!pid) refreshCart();
    } finally {
      setSubmitting(false);
    }
  }

  async function sendGuestCode() {
    setVerify({ step: "sending", code: "", busy: true, error: "" });
    try {
      const res = await authApi.guestSendCode(form.phone.trim());
      setVerify({ step: "code", code: "", busy: false, error: "", devCode: res.devCode || "" });
    } catch (err) {
      const message = extractErrorMessage(err);
      // A code sent less than a minute ago is still valid: let them type it.
      setVerify(err.response?.status === 429 ? { step: "code", code: "", busy: false, error: message } : null);
      if (err.response?.status !== 429) showError(message);
    }
  }

  async function confirmGuestCode(e) {
    e.preventDefault();
    const code = verify.code.trim();
    if (!/^\d{6}$/.test(code)) { setVerify((v) => ({ ...v, error: "Enter the 6-digit code." })); return; }
    setVerify((v) => ({ ...v, busy: true, error: "" }));
    const basket = items.map((x) => ({ ...x }));
    let session;
    try {
      session = await authApi.guestVerify({ phone: form.phone.trim(), code, fullName: form.name.trim(), email: form.email.trim() || undefined });
    } catch (err) {
      setVerify((v) => ({ ...v, busy: false, error: extractErrorMessage(err) }));
      return;
    }
    // The basket goes with the order, so don't also merge it into the account cart.
    if (!pid) { try { localStorage.removeItem(GUEST_CART_KEY); } catch { /* storage unavailable */ } }
    startSession(session);
    setVerify(null);
    setSubmitting(true);
    try {
      const orderId = await submitOrder({ guestItems: basket });
      if (!pid) refreshCart();
      navigate(`/payment/${orderId}`, { replace: true });
    } catch (err) {
      // Keep the basket: put the items in the (now signed-in) cart.
      if (!pid) {
        for (const x of basket) { try { await cartApi.add(x.id, x.qty); } catch { /* reported below */ } }
        refreshCart();
      }
      showError(extractErrorMessage(err));
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

  const deliveryRow = !form.fulfilment
    ? "Choose pickup or delivery"
    : isPickup ? "FREE (pickup)"
    : quoting && !quote ? "…" : undeliverable || !quote ? "—" : delivery === 0 ? "FREE" : money(delivery);

  return <Storefront><main className="checkout-page">
    <div className="page-title"><span className="eyebrow">CHECKOUT</span><h1>Complete your order</h1><p>Pay with mobile money or card. MVEC holds the payment until you confirm you have your items.</p></div>
    <ol className="checkout-steps"><li className="active">1 Your details</li><li>2 Payment</li><li>3 Confirmation</li></ol>
    {error && <div className="form-alert error" role="alert" ref={errorRef}>{error}</div>}
    {!user && !authLoading && <div className="form-alert info">No account needed. We'll text a code to your phone to confirm it's yours before you pay. <Link to="/login" state={{ from: `/checkout${pid ? `?product=${pid}&qty=${requestedQty}` : ""}`, checkoutReturn: true }}>Have an account? Log in</Link></div>}
    <form onSubmit={placeOrder} noValidate><div className="checkout-layout"><section className="checkout-main">
      <div className="form-card"><h2>Your details</h2><p className="tiny">The seller uses this phone number to reach you about the order.</p>
        <div className="two-col">
          {field("name", "Full name", { autoComplete: "name", required: true })}
          {field("phone", "Phone", { type: "tel", autoComplete: "tel", placeholder: "07xx xxx xxx", required: true, disabled: Boolean(verify) })}
        </div>
        {field("email", "Email (optional)", { type: "email", autoComplete: "email", placeholder: "you@example.com" })}
      </div>

      <div className={`form-card ${errors.fulfilment ? "has-error" : ""}`}><h2>How do you want to get your order?</h2>
        <div className="fulfilment-choice" role="radiogroup" aria-label="Pickup or delivery">
          <label className={isPickup ? "selected" : ""}>
            <input type="radio" name="fulfilment" checked={isPickup} onChange={() => chooseFulfilment("pickup")} />
            <span><b>I'll pick it up</b><small>Collect from the seller's store. No delivery fee.</small></span>
          </label>
          <label className={isDelivery ? "selected" : ""}>
            <input type="radio" name="fulfilment" checked={isDelivery} onChange={() => chooseFulfilment("delivery")} />
            <span><b>Deliver it to me</b><small>The seller or an MVEC courier brings it. A delivery fee applies.</small></span>
          </label>
        </div>
        {errors.fulfilment && <small className="field-error">{errors.fulfilment}</small>}

        {isPickup && <>
          {quoting && !quote && <p className="tiny">Loading pickup points…</p>}
          {quote?.groups?.length > 0 && <div className="checkout-parcels">{quote.groups.map((g) => <div key={`${g.vendor}-${g.store}`}>
            <span><b>{g.storeName}</b><small>{g.pickup?.address || "The seller confirms the pickup address"}{g.pickup?.phone ? ` · ${g.pickup.phone}` : ""}</small></span>
            <strong>FREE</strong>
          </div>)}</div>}
          {quoteError && <div className="form-alert error">{quoteError}</div>}
          <p className="tiny">You'll be told when your order is ready. Bring your delivery code; the seller hands over your items when you give it. Items from different stores are collected from each store.</p>
        </>}

        {isDelivery && <>
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
          {undeliverable && <div className="form-alert error">{undeliverableMessage} Choose another district, choose pickup, or remove those items.</div>}
          {quote?.deliverable && <div className="checkout-parcels">{quote.groups.map((g) => <div key={`${g.vendor}-${g.store}`}>
            <span><b>{g.storeName}</b><small>{g.zoneName}{g.eta ? ` · ${g.eta}` : ""}{g.freeOverAmount && g.fee > 0 ? ` · free from ${money(g.freeOverAmount)}` : ""}</small>{g.message && <small className="checkout-parcel-note">{g.message}</small>}</span>
            <strong>{g.fee === 0 ? "FREE" : money(g.fee)}</strong>
          </div>)}</div>}
          <p className="tiny">Delivery fees are set by each seller for your district; items from different stores ship separately. You give the courier your delivery code when it arrives.</p>
        </>}
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
      <div><span>{isPickup ? "Pickup" : "Delivery"}{isDelivery && quote?.groups?.length > 1 ? ` (${quote.groups.length} parcels)` : ""}</span><b>{deliveryRow}</b></div>
      {discount > 0 && <div><span>Coupon {coupon.code}</span><b>−{money(discount)}</b></div>}
      <div className="checkout-coupon">
        {coupon
          ? <p className="tiny"><b>{coupon.code}</b> · {coupon.message} <button type="button" className="link-btn" onClick={() => { setCoupon(null); setCouponInput(""); }}>Remove</button></p>
          : <div className="checkout-coupon-row">
              <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Coupon code" aria-label="Coupon code"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); checkCoupon(couponInput); } }} />
              <button type="button" className="outline-btn" disabled={couponBusy || !couponInput.trim()} onClick={() => checkCoupon(couponInput)}>{couponBusy ? "…" : "Apply"}</button>
            </div>}
        {couponError && <small className="checkout-coupon-error">{couponError}</small>}
      </div>
      <hr />
      <div className="grand"><span>Total to pay</span><strong>{money(total)}</strong></div>
      <button className="gradient-btn full" type="submit" disabled={submitting || authLoading || Boolean(verify) || unavailable.length > 0 || undeliverable}>
        {submitting ? "Placing order…" : user ? "Continue to payment" : "Verify phone & continue"}
      </button>
      {!pid && <Link to="/cart" className="back-link">← Back to cart</Link>}
      <div className="verified-box"><b>✓ Protected payment</b><p>You pay by MTN MoMo, Airtel Money or card (Visa/Mastercard) on the next step. MVEC holds the money and only releases it to the seller after you confirm you have your items with your code.</p></div>
    </aside></div></form>

    {verify && <div className="modal-backdrop" onMouseDown={() => !verify.busy && setVerify(null)}>
      <form className="modal" role="dialog" aria-label="Confirm your phone" onMouseDown={(e) => e.stopPropagation()} onSubmit={confirmGuestCode} noValidate>
        <button type="button" className="modal-close" onClick={() => setVerify(null)} aria-label="Close" disabled={verify.busy}>×</button>
        <h2>Confirm your phone</h2>
        {verify.step === "sending"
          ? <p>Sending a code to {form.phone}…</p>
          : <>
              <p>We sent a 6-digit code to <b>{form.phone}</b>. Enter it to place your order. Only this phone can see the order.</p>
              {verify.devCode && <p className="tiny">Development code: <b>{verify.devCode}</b></p>}
              <label className="field"><span>Code</span>
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={verify.code}
                  onChange={(e) => setVerify((v) => ({ ...v, code: e.target.value.replace(/\D/g, ""), error: "" }))} />
              </label>
              {verify.error && <div className="form-alert error" role="alert">{verify.error}</div>}
              <div className="modal-actions">
                <button type="button" className="outline-btn" disabled={verify.busy} onClick={sendGuestCode}>Send a new code</button>
                <button type="submit" className="gradient-btn" disabled={verify.busy}>{verify.busy ? "Checking…" : "Confirm & continue"}</button>
              </div>
            </>}
      </form>
    </div>}
  </main></Storefront>;
}
