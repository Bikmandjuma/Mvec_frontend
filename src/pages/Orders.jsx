import {Link} from "react-router-dom";
import {useEffect,useMemo,useState} from "react";
import Pagination from "../components/Pagination";
import Storefront from "../components/Storefront";
import {demoOrders} from "../data";
import {cancelOrderByBuyer,getDeliveryRemaining,getOrders,syncOrderLifecycle} from "../services/mvecStore";
const money=n=>new Intl.NumberFormat("en-RW").format(Number(n)||0)+" RWF";
const fmt=ms=>{const s=Math.max(0,Math.floor(ms/1000));const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`};
const canCancel=o=>o.payment==='SUCCESS'&&o.refundStatus!=='FULL'&&o.status!=='Cancelled'&&o.paidAt&&Date.now()-new Date(o.paidAt).getTime()<=30*60*1000;
export default function Orders(){
 const [tick,setTick]=useState(0),[orders,setOrders]=useState(()=>[...getOrders(),...demoOrders]),[q,setQ]=useState(""),[page,setPage]=useState(1),[message,setMessage]=useState("");
 useEffect(()=>{const timer=setInterval(()=>{syncOrderLifecycle();setOrders([...getOrders(),...demoOrders]);setTick(x=>x+1)},1000);return()=>clearInterval(timer)},[]);
 const filtered=useMemo(()=>orders.filter(o=>JSON.stringify(o).toLowerCase().includes(q.toLowerCase())),[orders,q,tick]);
 const shown=filtered.slice((page-1)*5,page*5);
 const cancel=async id=>{try{cancelOrderByBuyer(id);setOrders([...getOrders(),...demoOrders]);setMessage("Order cancelled successfully. A full refund has been recorded.")}catch(e){setMessage(e.message)}};
 return <Storefront><main className="account-page"><div className="page-title"><span className="eyebrow">PURCHASES</span><h1>My orders</h1><p>Track payment, delivery and protected settlement from one place.</p></div>
 <div className="dash-toolbar"><div className="dash-filter"><span>⌕</span><input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Search orders, products, vendors or status…"/></div></div>
 {message&&<div className="form-alert success">{message}</div>}
 <div className="orders-table"><div className="table-head"><span>Order</span><span>Product</span><span>Total</span><span>Payment</span><span>Delivery</span><span>Time left</span></div>{shown.map(o=>{const remaining=getDeliveryRemaining(o);return <div className="table-row" key={o.id}><Link to={"/orders/"+o.id}><b>{o.id}</b></Link><span>{o.items?.[0]?.name||o.productName||"Order"}</span><span>{money(o.total)}</span><span className={`status ${(o.payment||"").toLowerCase()}`}>{o.payment||"PENDING"}</span><span>{o.status}{o.settlementStatus?` · ${o.settlementStatus}`:""}</span><span>{o.payment==='SUCCESS'&&o.settlementStatus==='HELD'?fmt(remaining):o.refundStatus==='FULL'?"Refunded":"—"}</span>{canCancel(o)&&<button className="outline-btn" onClick={()=>cancel(o.id)}>Cancel order</button>}</div>})}</div>
 <Pagination page={Math.min(page,Math.max(1,Math.ceil(filtered.length/5)))} setPage={setPage} total={filtered.length} perPage={5}/>
 <div className="verified-box"><b>🔒 Protected payment & delivery window</b><p>After successful payment, MVEC records the funds as HELD. You have 30 minutes to cancel. The delivery window is three hours; if delivery is not confirmed before it expires, the order is cancelled and a full refund is recorded.</p></div><Link className="gradient-btn" to="/shop">Continue shopping</Link></main></Storefront>}
