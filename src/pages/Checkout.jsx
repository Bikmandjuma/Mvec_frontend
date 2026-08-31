import {useMemo,useState} from "react";
import {Link,useNavigate,useSearchParams} from "react-router-dom";
import Storefront from "../components/Storefront";
import {products} from "../data";
import {useMarketplace} from "../context/MarketplaceContext";
import {useAuth} from "../context/AuthContext";
import {createOrder, calculateCommission} from "../services/mvecStore";

const money=n=>new Intl.NumberFormat("en-RW").format(Number(n)||0)+" RWF";

export default function Checkout(){
  const [params]=useSearchParams(), navigate=useNavigate();
  const {cart, clearCart}=useMarketplace();
  const {user}=useAuth();
  const pid=params.get("product"), p=products.find(x=>String(x.id)===pid);
  const items=useMemo(()=>p?[{...p,qty:Number(params.get("qty")||1)}]:cart,[p,cart,params]);
  const [form,setForm]=useState({name:user?.fullName||"",phone:user?.telephone||"",email:user?.email||"",address:"KG 11 Ave, Kigali",method:"standard"});
  const [error,setError]=useState("");
  const subtotal=items.reduce((s,x)=>s+x.price*(x.qty||1),0);
  const shipping=form.method==="express"?10000:5000;
  const total=subtotal+shipping;
  function update(e){setForm({...form,[e.target.name]:e.target.value});}
  function continuePayment(e){
    e.preventDefault(); setError("");
    if(!form.name||!form.phone||!form.address){setError("Please complete your name, phone number and delivery address.");return;}
    if(!items.length){setError("Your cart is empty.");return;}
    const order=createOrder({
      buyer:user?.fullName||form.name,buyerPhone:form.phone,buyerEmail:form.email||"",
      vendor:items[0].vendor, items:items.map(x=>({productId:x.id,name:x.name,qty:x.qty,price:x.price,image:x.image,vendor:x.vendor})),
      subtotal,shipping,total,address:form.address,deliveryMethod:form.method,
      commission:calculateCommission(subtotal), paymentMethod:null
    });
    if(!p) clearCart();
    navigate(`/payment/${order.id}`);
  }
  return <Storefront><main className="checkout-page">
    <div className="page-title"><span className="eyebrow">CHECKOUT</span><h1>Complete your order</h1><p>Simple checkout with phone-first delivery and direct payment.</p></div>
    <div className="checkout-steps"><span className="active">1 Customer & delivery</span><span>2 Payment</span><span>3 Confirmation</span></div>
    {error&&<div className="form-alert error">{error}</div>}
    <form onSubmit={continuePayment}><div className="checkout-layout"><section className="checkout-main">
      <div className="form-card"><h2>Customer information</h2><p className="tiny">Email is optional. Your phone number is used for order updates.</p>
        <div className="two-col"><label className="field"><span>Name</span><input name="name" value={form.name} onChange={update} required/></label><label className="field"><span>Phone</span><input name="phone" value={form.phone} onChange={update} placeholder="+250 7xx xxx xxx" required/></label></div>
        <label className="field"><span>Email (optional)</span><input name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com"/></label>
      </div>
      <div className="form-card"><h2>Delivery address</h2><label className="field"><span>Where should we deliver?</span><input name="address" value={form.address} onChange={update} placeholder="Street, sector, district" required/></label>
        <div className="delivery-options"><label><input type="radio" checked={form.method==="standard"} onChange={()=>setForm({...form,method:"standard"})}/> Standard delivery <b>5,000 RWF</b></label><label><input type="radio" checked={form.method==="express"} onChange={()=>setForm({...form,method:"express"})}/> Express delivery <b>10,000 RWF</b></label></div>
        <p className="tiny">Delivery is fulfilled by the seller or an assigned delivery partner. Delivery proof is recorded when the order arrives.</p>
      </div>
      <div className="form-card"><h2>Order items</h2>{items.map(x=><div className="mini-item" key={x.id}><img src={x.image} alt=""/><div><b>{x.name}</b><span>{x.vendor} · Qty {x.qty}</span></div><strong>{money(x.price*x.qty)}</strong></div>)}</div>
    </section><aside className="summary-card"><h2>Order summary</h2><div><span>Products</span><b>{money(subtotal)}</b></div><div><span>Shipping</span><b>{money(shipping)}</b></div><div><span>Platform fees</span><b>Included where applicable</b></div><hr/><div className="grand"><span>Grand total</span><strong>{money(total)}</strong></div>
      <button className="gradient-btn full" type="submit">Continue to payment</button><Link to="/cart" className="back-link">← Back to cart</Link>
      <div className="verified-box"><b>✓ Clear payment flow</b><p>Your payment is processed by a payment partner. MVEC does not hold buyer funds in this MVP.</p></div>
    </aside></div></form>
  </main></Storefront>
}