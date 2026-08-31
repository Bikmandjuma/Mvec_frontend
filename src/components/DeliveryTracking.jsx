import { useMemo, useState } from "react";
import Icon from "./Icon";
import { getOrders, releaseSettlement, updateOrder, saveOrders } from "../services/mvecStore";
import Pagination from "./Pagination";

const money=n=>new Intl.NumberFormat("en-RW").format(Number(n)||0)+" RWF";
const steps=["Order placed","Payment confirmed","Seller confirmed","Processing","Ready for delivery","Picked up","In transit","Out for delivery","Delivered"];

function ensureDemoOrders(){
  let orders=getOrders();
  if(!orders.some(o=>o.payment==="SUCCESS")){
    orders=[
      {id:"MVEC-10452",date:"2026-08-30",payment:"SUCCESS",paymentMethod:"momo",status:"Out for Delivery",settlementMode:"protected",settlementStatus:"HELD",heldAmount:850000,buyer:"Aline Uwase",vendor:"Kigali Tech Store",supplier:"Rwanda Wholesale Suppliers",total:850000,deliveryStatus:"Out for delivery",trackingNumber:"MVEC-TRK-2026-10452",commissionStatus:"Pending"},
      {id:"MVEC-10451",date:"2026-08-29",payment:"SUCCESS",paymentMethod:"momo",status:"Shipped",settlementMode:"protected",settlementStatus:"HELD",heldAmount:190000,buyer:"Jean Paul",vendor:"Fashion Rwanda",total:190000,deliveryStatus:"In transit",trackingNumber:"MVEC-TRK-2026-10451",commissionStatus:"Pending"},
      {id:"B2B-2001",date:"2026-08-28",payment:"SUCCESS",paymentMethod:"momo",status:"Processing",settlementMode:"protected",settlementStatus:"HELD",heldAmount:2200000,buyer:"Kigali Tech Store",vendor:"Kigali Tech Store",supplier:"Rwanda Wholesale Suppliers",total:2200000,deliveryStatus:"Ready for delivery",trackingNumber:"MVEC-TRK-2026-B2001",commissionStatus:"Pending"}
    ];
    saveOrders(orders);
  }
  return orders;
}
export default function DeliveryTracking({role="vendor"}){
  const [orders,setOrders]=useState(()=>ensureDemoOrders().filter(o=>o.payment==="SUCCESS"));
  const [q,setQ]=useState(""); const [page,setPage]=useState(1); const perPage=5;
  const roleOrders=role==="supplier"?orders.filter(o=>o.supplier||o.id.startsWith("B2B")):role==="vendor"?orders.filter(o=>o.vendor):role==="affiliate"?orders.filter(o=>o.affiliateCode||o.id==="MVEC-10452"):orders;
  const filtered=useMemo(()=>roleOrders.filter(o=>JSON.stringify(o).toLowerCase().includes(q.toLowerCase())),[roleOrders,q]);
  const shown=filtered.slice((page-1)*perPage,page*perPage);
  const advance=(o)=>{
    const current=Math.max(0,steps.indexOf(o.deliveryStatus));
    const next=steps[Math.min(steps.length-1,current+1)];
    const patch={deliveryStatus:next,status:next==="Delivered"?"Delivered":o.status};
    const updated=updateOrder(o.id,patch);
    if(next==="Delivered") releaseSettlement(o.id,role);
    setOrders(getOrders().filter(x=>x.payment==="SUCCESS"));
    return updated;
  };
  const confirm=(o)=>{releaseSettlement(o.id,role);setOrders(getOrders().filter(x=>x.payment==="SUCCESS"));};
  return <>
    <div className="dash-page-head"><div><span className="eyebrow">DELIVERY & SETTLEMENT</span><h1>{role==='admin'?'All deliveries':'Delivery tracking'}</h1><p>{role==='admin'?'Monitor delivery, protected funds and settlement across the marketplace.':'Track delivery progress and see whether MVEC funds are still protected or released.'}</p></div></div>
    <div className="verified-box settlement-banner"><b>🔒 Protected settlement is active</b><p>After a successful payment, MVEC records the funds as <strong>HELD</strong>. The seller/supplier fulfills the order, delivery is confirmed, then MVEC releases the protected amount. This frontend demonstrates the workflow; production settlement must be provided by a regulated payment partner.</p></div>
    <div className="dash-toolbar"><div className="dash-filter"><Icon name="search"/><input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Search order, customer, vendor or tracking number…"/></div></div>
    <div className="data-card"><div className="data-card-head"><div><h3>Delivery operations</h3><span>{filtered.length} paid orders</span></div></div>
      {shown.map(o=>{const idx=Math.max(0,steps.indexOf(o.deliveryStatus));return <div className="delivery-track-card" key={o.id}><div className="delivery-track-head"><div><b>{o.id}</b><small>{o.trackingNumber} · {o.buyer||'Buyer'}</small></div><div className="settlement-chip"><span className={o.settlementStatus==='RELEASED'?'released':'held'}>{o.settlementStatus==='RELEASED'?'Funds released':'Funds held by MVEC'}</span><strong>{money(o.heldAmount||o.total)}</strong></div></div><div className="delivery-steps">{steps.map((s,i)=><div className={i<=idx?'step done':'step'} key={s}><i>{i<idx?'✓':i===idx?'●':''}</i><small>{s}</small></div>)}</div><div className="delivery-track-actions"><span>Seller: <b>{o.vendor||'Marketplace seller'}</b></span><span>Payment: <b>{o.payment}</b></span>{o.settlementStatus!=='RELEASED'&&<><button className="outline-btn" onClick={()=>advance(o)}>Advance delivery</button><button className="gradient-btn" onClick={()=>confirm(o)}>Confirm delivery & release</button></>}</div></div>})}
      {!shown.length&&<div className="empty-state"><h3>No paid deliveries</h3><p>Paid orders will appear here automatically.</p></div>}
      <Pagination page={Math.min(page,Math.max(1,Math.ceil(filtered.length/perPage)))} setPage={setPage} total={filtered.length} perPage={perPage}/>
    </div>
  </>;
}
