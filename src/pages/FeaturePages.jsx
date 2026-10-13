import {useEffect,useMemo,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import Icon from '../components/Icon';
import SmartTable from '../components/SmartTable';
import DashboardLayout from '../components/DashboardLayout';import Storefront from '../components/Storefront';import NotificationPanel from '../components/NotificationPanel';
import {vendors,categories} from '../data';
import {productsApi} from '../API/products';
import {categoriesApi} from '../API/categories';
import {wholesaleApi} from '../API/wholesale';
import {disputesApi} from '../API/disputes';
import {supportApi} from '../API/support';
import {adminApi} from '../API/admin';
import {mapBackendProduct} from '../services/catalogApi';
import {extractErrorMessage} from '../API/client';

const money=n=>new Intl.NumberFormat('en-RW').format(Number(n)||0)+' RWF';
const dateDMY=d=>d?new Date(d).toLocaleDateString('en-GB'):'—';
const titleCaseText=s=>String(s||'').toLowerCase().replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
const RELEASE='v9';
const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(`mvec_${RELEASE}_${k}`));return v??f}catch{return f}};
const write=(k,v)=>localStorage.setItem(`mvec_${RELEASE}_${k}`,JSON.stringify(v));

function Header({eyebrow,title,desc,action}){return <div className="dash-page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{action}</div>}
function Metric({label,value,sub,icon='chart'}){return <div className="metric"><div className="metric-icon"><Icon name={icon}/></div><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div></div>}
function SettingCard({title,desc,children}){return <div className="data-card"><h3>{title}</h3>{desc&&<p className="tiny">{desc}</p>}{children}</div>}

const moduleConfig={
 vendor:{
  support:['support','MVEC Support','Contact MVEC directly about payments, delivery, orders or marketplace issues.'],
  purchases:['purchases','Purchases','Track stock purchased from suppliers and supplier order history.'],
  refunds:['refunds','Refunds','Review buyer refund requests and their evidence.'],
  messages:['messages','Messages','Keep buyer and supplier conversations organized.']
 },
 supplier:{
  support:['support','MVEC Support','Contact MVEC directly about payments, delivery, supply orders or marketplace issues.'],
  requests:['supply-requests','Supply Requests','Review incoming vendor requests and confirm fulfillment.'],
  transactions:['transactions','Transactions','Every supplier payment and settlement has an auditable record.'],
  messages:['messages','Messages','Communicate with vendors about products and deliveries.'],
  reviews:['reviews','Reviews','Review supplier feedback and reliability indicators.']
 },
 affiliate:{support:['support','MVEC Support','Contact MVEC directly about payments, delivery, commissions or marketplace issues.'],fraud:['fraud','Fraud Protection','Review flagged clicks, self-referrals and suspicious conversions.']},
 admin:{
  support:['support','MVEC Support','Contact MVEC directly about platform issues and escalations.'],
  payments:['payments','Payments','Monitor payment confirmations and protected settlement states.'],
  refunds:['refunds','Refunds','Review marketplace refund requests and financial return records.'],
  advertising:['advertising','Advertising','Manage sponsored products, campaigns and marketplace placements.'],
  subscriptions:['subscriptions','Subscriptions','Manage optional vendor premium and buyer ad-removal plans.'],
  languages:['languages','Languages','Manage multilingual marketplace content and language availability.'],
  locations:['locations','Locations','Manage Rwanda provinces, districts, sectors and delivery rules.'],
  security:['security','Security','Review platform security controls and role permissions.'],
  audit:['audit-logs','Audit Logs','Trace important changes and financial events across MVEC.'],
  notifications:['notifications','Notifications','Monitor marketplace notifications and delivery status messages.'],
  recommendations:['recommendations','Recommendations','Manage product recommendation signals and rules.'],
  matching:['matching','Supplier Matching','Help vendors discover suppliers using transparent matching signals.'],
  trust:['trust','Trust Scores','Monitor transparent vendor and supplier trust metrics.'],
  system:['system','System Administration','Platform maintenance, feature flags and operational controls.']
 }
};

// Wholesale order lifecycle: label, pill tone and what it means for each side.
const WHOLESALE_STATUS={
 PENDING_PAYMENT:['Awaiting payment','pending','Pay to lock funds in escrow.','Waiting for the vendor to pay.'],
 ESCROW_HELD:['Paid · in escrow','pending','Funds are held safely until you confirm receipt.','Funds are secured. Ship the order.'],
 SHIPPED:['Shipped','pending','On its way. Confirm once the stock arrives.','Waiting for the vendor to confirm receipt.'],
 DELIVERED:['Delivered','pending','Delivered. Confirm receipt to release payment.','Waiting for the vendor to confirm receipt.'],
 CONFIRMED_RELEASED:['Completed','active','Received. Payment released to the supplier.','Completed. Funds added to your balance.'],
 DISPUTED:['Disputed','danger','Under review by MVEC.','Under review by MVEC.'],
 CANCELLED:['Cancelled','danger','This order was cancelled.','This order was cancelled.']
};
const IN_ESCROW=['ESCROW_HELD','SHIPPED','DELIVERED'];
const partyName=p=>p?.companyName||p?.Fullname||p?.fullName||p?.email||'—';
const itemCount=o=>(o.items||[]).reduce((n,i)=>n+(Number(i.quantity)||0),0);
function WholesaleStatus({value}){const s=WHOLESALE_STATUS[value];return <em className={'status '+(s?.[1]||'warning')}>{s?.[0]||value}</em>}

function WholesaleList({role}){
 const supplier=role==='supplier';
 const [rows,setRows]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const [busyId,setBusyId]=useState('');const [notice,setNotice]=useState('');const [details,setDetails]=useState(null);
 const load=()=>wholesaleApi.getMine().then(res=>{setRows(res.orders||res.data||[]);setError('')}).catch(err=>setError(extractErrorMessage(err))).finally(()=>setLoading(false));
 useEffect(()=>{load()},[]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3000);return()=>clearTimeout(t)},[notice]);

 const run=async(order,fn,done)=>{
  setBusyId(order._id);setError('');
  try{await fn();setNotice(done);setDetails(null);await load()}
  catch(err){setError(extractErrorMessage(err))}
  finally{setBusyId('')}
 };
 const confirmReceipt=o=>window.confirm(`Confirm you received ${o.orderNumber}? ${money(o.totalAmount)} will be released to ${partyName(o.supplier)}. This cannot be undone.`)
  &&run(o,()=>wholesaleApi.confirmReceipt(o._id),`${o.orderNumber} confirmed. Payment released to the supplier.`);
 const markShipped=o=>run(o,()=>wholesaleApi.markShipped(o._id),`${o.orderNumber} marked as shipped.`);
 const nextAction=o=>{
  const busy=busyId===o._id;
  if(!supplier&&['SHIPPED','DELIVERED'].includes(o.status)) return <button type="button" className="table-action-btn primary" disabled={busy} onClick={()=>confirmReceipt(o)}><Icon name="check" size={15}/>{busy?'Confirming…':'Confirm receipt'}</button>;
  if(supplier&&o.status==='ESCROW_HELD') return <button type="button" className="table-action-btn primary" disabled={busy} onClick={()=>markShipped(o)}><Icon name="box" size={15}/>{busy?'Saving…':'Mark shipped'}</button>;
  return null;
 };

 const stats=useMemo(()=>{
  const sum=list=>list.reduce((n,o)=>n+(Number(o.totalAmount)||0),0);
  const escrow=rows.filter(o=>IN_ESCROW.includes(o.status));
  const toAct=rows.filter(o=>supplier?o.status==='ESCROW_HELD':['SHIPPED','DELIVERED'].includes(o.status));
  const done=rows.filter(o=>o.status==='CONFIRMED_RELEASED');
  return {escrow:sum(escrow),escrowCount:escrow.length,toAct:toAct.length,pending:rows.filter(o=>o.status==='PENDING_PAYMENT').length,done:sum(done),doneCount:done.length};
 },[rows,supplier]);

 const counterpart=supplier?'vendor':'supplier';
 const columns=[
  {key:'orderNumber',label:'Order',render:r=><div><b>{r.orderNumber}</b><small className="tiny seller-block">{dateDMY(r.createdAt)}</small></div>},
  {key:counterpart,label:supplier?'Vendor':'Supplier',render:r=>partyName(r[counterpart])},
  {key:'items',label:'Items',render:r=><div>{r.items?.[0]?.productName||'—'}<small className="tiny seller-block">{r.items?.length>1?`+${r.items.length-1} more · `:''}{itemCount(r)} units</small></div>},
  {key:'totalAmount',label:'Total',render:r=><b>{money(r.totalAmount)}</b>},
  {key:'status',label:'Status',render:r=><WholesaleStatus value={r.status}/>}
 ];
 const actions=r=><span className="row-actions">{nextAction(r)}<button type="button" title="View details" onClick={()=>setDetails(r)}><Icon name="eye" size={16}/></button></span>;
 const findSuppliers=!supplier&&<Link className="gradient-btn" to="/vendor/suppliers"><Icon name="plus" size={16}/> New purchase</Link>;

 return <><Header eyebrow={supplier?'SUPPLIER · ORDERS':'VENDOR · PURCHASES'} title={supplier?'Vendor orders':'Purchases'} desc={supplier?'Wholesale orders vendors have placed with you.':'Wholesale stock you have ordered from suppliers, protected by escrow until you confirm receipt.'} action={findSuppliers}/>
  {error&&<div className="form-error">{error}</div>}
  {notice&&<div className="form-alert success">{notice}</div>}
  {!loading&&rows.length>0&&<div className="metric-grid">
   <Metric icon="receipt" label={supplier?'Orders received':'Purchase orders'} value={rows.length} sub={`${stats.pending} awaiting payment`}/>
   <Metric icon="shield" label="Held in escrow" value={money(stats.escrow)} sub={`${stats.escrowCount} active order${stats.escrowCount===1?'':'s'}`}/>
   <Metric icon="bell" label={supplier?'To ship':'To confirm'} value={stats.toAct} sub={supplier?'Paid and ready to ship':'Arrived or on the way'}/>
   <Metric icon="wallet" label={supplier?'Earned':'Total spent'} value={money(stats.done)} sub={`${stats.doneCount} completed`}/>
  </div>}
  <div className="data-card">
   {loading&&<div className="empty-state"><h3>Loading…</h3></div>}
   {!loading&&!error&&!rows.length&&<div className="empty-state"><h3>No wholesale orders yet</h3><p>{supplier?'Orders vendors place for your wholesale products will appear here.':'Buy stock in bulk from verified suppliers. Your payment stays in escrow until you confirm the delivery.'}</p>{findSuppliers}</div>}
   {!loading&&rows.length>0&&<SmartTable columns={columns} rows={rows} rowKey={r=>r._id||r.id} actions={actions} searchPlaceholder="Search by order, supplier or product…" empty="No wholesale orders match your search." exportName={supplier?'mvec-vendor-orders':'mvec-purchases'}/>}
  </div>
  {details&&<div className="modal-backdrop" onMouseDown={()=>setDetails(null)}><div className="modal seller-modal" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-label={`Order ${details.orderNumber}`}>
   <button type="button" className="modal-close" onClick={()=>setDetails(null)} aria-label="Close">×</button>
   <h2>{details.orderNumber}</h2>
   <p>{supplier?'Vendor':'Supplier'}: <b>{partyName(details[counterpart])}</b> · Placed {dateDMY(details.createdAt)}</p>
   <div className="purchase-status-note"><WholesaleStatus value={details.status}/><span>{WHOLESALE_STATUS[details.status]?.[supplier?3:2]}</span></div>
   <div className="purchase-items">
    {(details.items||[]).map((i,k)=><div key={k}><span><b>{i.productName}</b><small>{i.quantity} × {money(i.unitPrice)} · MOQ {i.moq}</small></span><b>{money(i.quantity*i.unitPrice)}</b></div>)}
    <div className="purchase-total"><span>Total</span><b>{money(details.totalAmount)}</b></div>
   </div>
   <div className="purchase-dates tiny">{[['Shipped',details.shippedAt],['Delivered',details.deliveredAt],['Confirmed',details.confirmedAt]].filter(d=>d[1]).map(d=><span key={d[0]}>{d[0]} {dateDMY(d[1])}</span>)}</div>
   <div className="modal-actions"><button type="button" className="outline-btn" onClick={()=>setDetails(null)}>Close</button>{nextAction(details)}</div>
  </div></div>}
 </>;
}

function AdminPayments(){
 const [rows,setRows]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 useEffect(()=>{adminApi.getPayments({pageSize:100}).then(res=>setRows(res.data||[])).catch(err=>setError(extractErrorMessage(err))).finally(()=>setLoading(false));},[]);
 return <><Header eyebrow="ADMIN · PAYMENTS" title="Payments" desc="Monitor payment confirmations and protected settlement states."/>
  {error&&<div className="form-error">{error}</div>}
  <div className="data-card">{loading&&<div className="empty-state"><h3>Loading…</h3></div>}
   {!loading&&<SmartTable columns={[{key:'transactionReference',label:'Reference'},{key:'order',label:'Order',render:r=>r.parentOrder?.orderNumber||r.parentOrderId},{key:'amount',label:'Amount',render:r=>money(r.amount)},{key:'method',label:'Method'},{key:'status',label:'Status',render:r=><em className={'status '+(r.status==='SUCCESS'?'active':'warning')}>{r.status}</em>}]} rows={rows} rowKey={r=>r.id} searchPlaceholder="Search payments…" empty="No payments yet."/>}
  </div></>;
}

const DISPUTE_REASON={ITEM_NOT_RECEIVED:'Item not received',DAMAGED_GOODS:'Damaged goods',WRONG_ITEM:'Wrong item',INCOMPLETE_ORDER:'Incomplete order',SLA_BREACH:'Late delivery',OTHER:'Other'};
const DISPUTE_STATUS={OPEN:['Open','warning'],UNDER_REVIEW:['Under review','pending'],EVIDENCE_SUBMITTED:['Evidence submitted','pending'],RESOLVED_BUYER_REFUNDED:['Refunded to buyer','danger'],RESOLVED_VENDOR_RELEASED:['Released to seller','active'],RESOLVED_SPLIT:['Split settlement','active'],REJECTED:['Rejected','danger']};
const disputeOpen=s=>['OPEN','UNDER_REVIEW','EVIDENCE_SUBMITTED'].includes(s);
function DisputeStatus({value}){const s=DISPUTE_STATUS[value];return <em className={'status '+(s?.[1]||'warning')}>{s?.[0]||value}</em>}

function DisputesList({role}){
 const admin=role==='admin';
 const [rows,setRows]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const [open,setOpen]=useState(null);const [reply,setReply]=useState('');const [sending,setSending]=useState(false);const [notice,setNotice]=useState('');
 const load=()=>(admin?disputesApi.getAll({pageSize:100}):disputesApi.getMine()).then(res=>{setRows(res.data||[]);setError('')}).catch(err=>setError(extractErrorMessage(err))).finally(()=>setLoading(false));
 useEffect(()=>{load()},[]);// eslint-disable-line react-hooks/exhaustive-deps
 const active=rows.filter(r=>disputeOpen(r.status));
 const atStake=active.reduce((n,r)=>n+(Number(r.disputedAmount)||0),0);
 const needsReply=active.filter(r=>r.status==='OPEN').length;
 const respond=async()=>{
  if(!reply.trim())return;setSending(true);setError('');
  try{await disputesApi.submitEvidence(open._id||open.id,{message:reply.trim()});setNotice(`Your response to ${open.disputeNumber} was sent to MVEC.`);setOpen(null);setReply('');await load()}
  catch(err){setError(extractErrorMessage(err))}finally{setSending(false)}
 };
 const columns=[
  {key:'disputeNumber',label:'Case',render:r=><div><b>{r.disputeNumber}</b><small className="tiny seller-block">{dateDMY(r.createdAt)}</small></div>},
  {key:'order',label:'Order',render:r=>r.order?.orderNumber||'—'},
  ...(role==='buyer'?[]:[{key:'raisedBy',label:'Raised by',render:r=>r.raisedBy?.Fullname||r.raisedBy?.email||'Buyer'}]),
  {key:'reason',label:'Reason',render:r=>DISPUTE_REASON[r.reason]||r.reason},
  {key:'disputedAmount',label:'Amount',render:r=><b>{money(r.disputedAmount)}</b>},
  {key:'status',label:'Status',render:r=><DisputeStatus value={r.status}/>}
 ];
 const actions=r=><span className="row-actions">
  {!admin&&disputeOpen(r.status)&&<button type="button" className="table-action-btn primary" onClick={()=>{setOpen(r);setReply('')}}>Respond</button>}
  <button type="button" title="View case" onClick={()=>{setOpen(r);setReply('')}}><Icon name="eye" size={16}/></button>
 </span>;
 return <><Header eyebrow={`${role.toUpperCase()} · REFUNDS`} title="Refunds & disputes" desc={admin?'Review reported problems, evidence and their resolution.':'Problems buyers reported with your orders. Respond with your side so MVEC can resolve them fairly.'}/>
  {error&&<div className="form-error">{error}</div>}
  {notice&&<div className="form-alert success">{notice}</div>}
  {!loading&&rows.length>0&&<div className="metric-grid">
   <Metric icon="bell" label="Open cases" value={active.length} sub={`${rows.length} in total`}/>
   <Metric icon="edit" label={admin?'Awaiting evidence':'Need your response'} value={needsReply} sub="Not yet answered"/>
   <Metric icon="shield" label="Amount at stake" value={money(atStake)} sub="Held until resolved"/>
   <Metric icon="check" label="Resolved" value={rows.length-active.length} sub="Closed by MVEC"/>
  </div>}
  <div className="data-card">{loading&&<div className="empty-state"><h3>Loading…</h3></div>}
   {!loading&&!error&&!rows.length&&<div className="empty-state"><h3>No refund requests</h3><p>{admin?'Disputes raised by buyers will appear here.':'Good news: no buyer has reported a problem with your orders.'}</p></div>}
   {!loading&&rows.length>0&&<SmartTable columns={columns} rows={rows} rowKey={r=>r._id||r.id} actions={actions} searchPlaceholder="Search cases…" empty="No cases match your search." exportName={`mvec-${role}-refunds`}/>}
  </div>
  {open&&<div className="modal-backdrop" onMouseDown={()=>setOpen(null)}><div className="modal seller-modal" role="dialog" aria-label={`Case ${open.disputeNumber}`} onMouseDown={e=>e.stopPropagation()}>
   <button type="button" className="modal-close" onClick={()=>setOpen(null)} aria-label="Close">×</button>
   <h2>{open.disputeNumber}</h2>
   <p>Order <b>{open.order?.orderNumber||'—'}</b> · {DISPUTE_REASON[open.reason]||open.reason} · {money(open.disputedAmount)}</p>
   <div className="purchase-status-note"><DisputeStatus value={open.status}/><span>Opened {dateDMY(open.createdAt)}</span></div>
   {open.description&&<div className="case-quote"><small>Buyer's description</small><p>{open.description}</p></div>}
   {open.arbitrationDecision?.decision&&<div className="case-quote"><small>MVEC decision</small><p>{titleCaseText(open.arbitrationDecision.decision)}{open.arbitrationDecision.notes?` · ${open.arbitrationDecision.notes}`:''}</p></div>}
   {!admin&&disputeOpen(open.status)&&<label className="field"><span>Your response</span><textarea rows="4" value={reply} onChange={e=>setReply(e.target.value)} placeholder="Explain what happened: delivery proof, photos you have, or how you want to resolve it."/></label>}
   <div className="modal-actions"><button type="button" className="outline-btn" onClick={()=>setOpen(null)}>Close</button>
    {!admin&&disputeOpen(open.status)&&<button type="button" className="gradient-btn" disabled={!reply.trim()||sending} onClick={respond}>{sending?'Sending…':'Send response'}</button>}</div>
  </div></div>}
 </>;
}

function GenericTableModule({role,type}){
 const cfg=moduleConfig[role][type];
 const [rows,setRows]=useState(()=>read(`mvec_${role}_${type}`,null));
 const defaults={
  categories:categories.map((x,i)=>({id:`CAT-${i+1}`,name:x,products:[42,31,27,24,18,16,12,9][i],status:i===6?'Paused':'Active'})),
  purchases:[{id:'PO-2026-001',supplier:'Rwanda Wholesale Suppliers',items:24,total:2200000,status:'HELD',date:'28/08/2026'},{id:'PO-2026-002',supplier:'East Africa Fashion Supply',items:40,total:1800000,status:'RELEASED',date:'25/08/2026'},{id:'PO-2026-003',supplier:'Kigali General Suppliers',items:16,total:920000,status:'PROCESSING',date:'02/09/2026'}],
  advertisements:[{id:'AD-1001',product:'Samsung Galaxy S25',placement:'Homepage hero',budget:150000,status:'Active',clicks:1820,impressions:28400},{id:'AD-1002',product:'Classic Leather Sneakers',placement:'Fashion category',budget:80000,status:'Scheduled',clicks:0,impressions:0},{id:'AD-1003',product:'Office Chair Pro',placement:'Search results',budget:95000,status:'Paused',clicks:412,impressions:7900}],
  subscription:role==='vendor'?[{id:'SUB-V-101',plan:'Vendor Premium',holder:'Kigali Tech Store',price:15000,billing:'Monthly',renewal:'30/09/2026',status:'Active'},{id:'SUB-V-102',plan:'Vendor Premium',holder:'Fashion Rwanda',price:15000,billing:'Monthly',renewal:'N/A',status:'Available'}]:[{id:'SUB-S-101',plan:'Supplier Plus',holder:'Rwanda Wholesale Suppliers',price:25000,billing:'Monthly',renewal:'20/09/2026',status:'Active'},{id:'SUB-S-102',plan:'Supplier Plus',holder:'East Africa Fashion Supply',price:25000,billing:'Monthly',renewal:'N/A',status:'Available'}],
  refunds:[{id:'REF-ADM-001',order:'MVEC-WIRELESS-NOISE-CANCELLING-HEADPHONES-2026-000001-4821',requester:'Aline Uwase',reason:'Damaged on arrival',amount:68000,evidence:'Photo attached',status:'Pending review',date:'31/08/2026'},{id:'REF-ADM-002',order:'MVEC-SNEAKERS-2026-000002-4822',requester:'Jean Paul',reason:'Wrong size delivered',amount:95000,evidence:'Photo attached',status:'Approved',date:'30/08/2026'},{id:'REF-ADM-003',order:'SUP-2026-1001',requester:'Kigali Tech Store',reason:'Missing wholesale items',amount:2200000,evidence:'Delivery record',status:'Escalated',date:'29/08/2026'}],
  reviews:role==='supplier'?[{id:'REV-S-301',product:'Bulk Bluetooth Headsets',reviewer:'Kigali Tech Store',rating:5,comment:'Consistent stock and reliable fulfillment.',status:'Published',date:'31/08/2026'},{id:'REV-S-302',product:'Fashion Basics Pack',reviewer:'Urban Closet',rating:4,comment:'Good wholesale pricing and packaging.',status:'Published',date:'30/08/2026'},{id:'REV-S-303',product:'Kitchen Starter Set',reviewer:'HomeStyle Kigali',rating:3,comment:'Delivery arrived one day late.',status:'Needs response',date:'29/08/2026'}]:[{id:'REV-V-201',product:'Wireless Headphones',reviewer:'Aline Uwase',rating:5,comment:'Great sound and fast delivery.',status:'Published',date:'31/08/2026'},{id:'REV-V-202',product:'Smart Watch Active',reviewer:'Jean Paul',rating:4,comment:'Good battery life.',status:'Published',date:'30/08/2026'},{id:'REV-V-203',product:'Office Chair Pro',reviewer:'Diane Mukamana',rating:2,comment:'Assembly instructions were unclear.',status:'Needs response',date:'29/08/2026'}],
  shipping:[{id:'ZONE-001',zone:'Kigali City',fee:2000,eta:'Same day',method:'Standard / Pickup',status:'Active'},{id:'ZONE-002',zone:'Northern Province',fee:5000,eta:'2–4 days',method:'Standard',status:'Active'},{id:'ZONE-003',zone:'Southern Province',fee:7000,eta:'3–6 days',method:'Standard',status:'Active'},{id:'ZONE-004',zone:'Eastern Province',fee:7000,eta:'3–6 days',method:'Standard',status:'Paused'}],
  messages:[{id:'MSG-1001',from:role==='vendor'?'Aline Uwase':'Kigali Tech Store',subject:'Order delivery question',status:'Unread',date:'31/08/2026'},{id:'MSG-1002',from:'Rwanda Wholesale Suppliers',subject:'Wholesale stock update',status:'Read',date:'30/08/2026'}],
  'supply-requests':[{id:'SUP-2026-1001',vendor:'Kigali Tech Store',products:'Phones + accessories',total:2200000,status:'Awaiting acceptance',requested:'01/09/2026'},{id:'SUP-2026-1002',vendor:'Urban Closet',products:'Sneakers',total:860000,status:'Processing',requested:'30/08/2026'}],
  transactions:[{id:'TXN-2026-0001',party:'Kigali Tech Store',order:'SUP-2026-1001',amount:2200000,supplierSettlement:2200000,status:'HELD',release:'After receipt'},{id:'TXN-2026-0002',party:'Smart Hub Rwanda',order:'SUP-2026-1002',amount:1480000,supplierSettlement:1480000,status:'RELEASED',release:'30/08/2026'}],
  fraud:[{id:'RISK-1001',affiliate:'AFF-00045',signal:'Self-referral pattern',orders:2,risk:'High',status:'Flagged'},{id:'RISK-1002',affiliate:'AFF-00021',signal:'Repeated device clicks',orders:18,risk:'Medium',status:'Review'},{id:'RISK-1003',affiliate:'AFF-00018',signal:'Unusual conversion timing',orders:7,risk:'Low',status:'Monitoring'}],
  payments:[{id:'PAY-2026-0001',order:'MVEC-WIRELESS-NOISE-CANCELLING-HEADPHONES-2026-000001-4821',payer:'Aline Uwase',amount:68000,method:'MTN MoMo',status:'HELD'},{id:'PAY-2026-0002',order:'MVEC-SNEAKERS-2026-000002-4822',payer:'Jean Paul',amount:95000,method:'Airtel Money',status:'RELEASED'},{id:'PAY-2026-0003',order:'SUP-2026-1001',payer:'Kigali Tech Store',amount:2200000,method:'MTN MoMo',status:'PENDING'}],
  adminRefunds:[{id:'REF-ADM-001',order:'MVEC-WIRELESS-NOISE-CANCELLING-HEADPHONES-2026-000001-4821',requester:'Aline Uwase',reason:'Damaged on arrival',amount:68000,evidence:'Photo attached',status:'Pending review',date:'31/08/2026'},{id:'REF-ADM-002',order:'MVEC-SNEAKERS-2026-000002-4822',requester:'Jean Paul',reason:'Wrong size delivered',amount:95000,evidence:'Photo attached',status:'Approved',date:'30/08/2026'},{id:'REF-ADM-003',order:'SUP-2026-1001',requester:'Kigali Tech Store',reason:'Missing wholesale items',amount:2200000,evidence:'Delivery record',status:'Escalated',date:'29/08/2026'}],
  advertising:[{id:'AD-ADM-01',vendor:'Kigali Tech Store',product:'Samsung Galaxy S25',placement:'Homepage',budget:250000,status:'Active',ctr:'6.4%'},{id:'AD-ADM-02',vendor:'Fashion Rwanda',product:'Classic Leather Sneakers',placement:'Fashion category',budget:100000,status:'Pending approval',ctr:'N/A'}],
  subscriptions:[{id:'SUB-001',holder:'Kigali Tech Store',type:'Vendor Premium',amount:15000,cycle:'Monthly',status:'Active'},{id:'SUB-002',holder:'Aline Uwase',type:'Buyer Ad Removal',amount:5000,cycle:'Monthly',status:'Active'},{id:'SUB-003',holder:'Fashion Rwanda',type:'Vendor Premium',amount:15000,cycle:'Monthly',status:'Expired'}],
  languages:[{code:'rw',name:'Kinyarwanda',role:'Primary',coverage:'100%',activeUsers:'58%'},{code:'en',name:'English',role:'Secondary',coverage:'100%',activeUsers:'34%'},{code:'fr',name:'French',role:'Secondary',coverage:'72%',activeUsers:'8%'}],
  locations:[{province:'Kigali City',districts:3,sectors:35,deliveryFee:2000,coverage:'100%'},{province:'Northern Province',districts:5,sectors:36,deliveryFee:5000,coverage:'92%'},{province:'Southern Province',districts:8,sectors:101,deliveryFee:7000,coverage:'86%'},{province:'Eastern Province',districts:7,sectors:95,deliveryFee:7000,coverage:'83%'}],
  security:[{id:'SEC-001',control:'Role-based access',area:'Identity & access',owner:'Platform Security',status:'Enabled',lastReview:'01/09/2026'},{id:'SEC-002',control:'OTP authentication',area:'Account security',owner:'Identity Service',status:'Enabled',lastReview:'31/08/2026'},{id:'SEC-003',control:'Financial action audit',area:'Finance',owner:'Finance Operations',status:'Enabled',lastReview:'30/08/2026'},{id:'SEC-004',control:'Session anomaly detection',area:'Threat monitoring',owner:'Security Operations',status:'Monitoring',lastReview:'02/09/2026'}],
  audit:[{id:'AUD-10001',actor:'MVEC Administrator',action:'Vendor verification updated',entity:'Vendor VND-0086',date:'31/08/2026'},{id:'AUD-10002',actor:'MVEC System',action:'Payment marked HELD',entity:'MVEC-TXN-2026-0001',date:'31/08/2026'},{id:'AUD-10003',actor:'Finance Operations',action:'Refund approved',entity:'REF-ADM-002',date:'30/08/2026'}],
  notifications:[{id:'NTF-1001',recipient:'Kigali Tech Store',channel:'In-app',type:'Payment',message:'Order payment was confirmed and funds are protected.',status:'Sent',date:'31/08/2026'},{id:'NTF-1002',recipient:'Rwanda Wholesale Suppliers',channel:'SMS',type:'Supply order',message:'Supply order SUP-2026-1001 is awaiting acceptance.',status:'Delivered',date:'31/08/2026'},{id:'NTF-1003',recipient:'Aline Uwase',channel:'Push',type:'Delivery',message:'Your order is out for delivery.',status:'Read',date:'31/08/2026'}],
  recommendations:[{id:'REC-001',signal:'Purchase history',source:'Completed orders',weight:35,enabled:true,lastUpdated:'02/09/2026'},{id:'REC-002',signal:'Search history',source:'Marketplace searches',weight:25,enabled:true,lastUpdated:'02/09/2026'},{id:'REC-003',signal:'Product views',source:'Product detail views',weight:20,enabled:true,lastUpdated:'01/09/2026'},{id:'REC-004',signal:'Similar customers',source:'Behavior similarity',weight:12,enabled:false,lastUpdated:'28/08/2026'},{id:'REC-005',signal:'Popular products',source:'Marketplace demand',weight:8,enabled:true,lastUpdated:'02/09/2026'}],
  matching:[{id:'MATCH-001',supplier:'Rwanda Wholesale Suppliers',category:'Electronics',score:95,price:'Excellent',stock:'High',reliability:'98%',distance:'Kigali',status:'Recommended'},{id:'MATCH-002',supplier:'East Africa Fashion Supply',category:'Fashion',score:91,price:'Good',stock:'High',reliability:'96%',distance:'Kigali',status:'Recommended'},{id:'MATCH-003',supplier:'Kigali General Suppliers',category:'Home & Living',score:87,price:'Good',stock:'Medium',reliability:'93%',distance:'Kigali',status:'Available'}],
  trust:[{id:'TRUST-001',party:'Kigali Tech Store',type:'Vendor',score:94,completion:'98%',refundRate:'2%',disputeRate:'1%',rating:'4.8/5',trend:'+3'},{id:'TRUST-002',party:'Rwanda Wholesale Suppliers',type:'Supplier',score:91,completion:'96%',refundRate:'2%',disputeRate:'1%',rating:'4.7/5',trend:'+1'},{id:'TRUST-003',party:'Aline Uwase',type:'Buyer',score:88,completion:'94%',refundRate:'3%',disputeRate:'0%',rating:'4.6/5',trend:'Stable'}],
  system:[{id:'SYS-001',setting:'Marketplace availability',value:'Operational',scope:'Core platform',lastChanged:'02/09/2026',owner:'Operations'},{id:'SYS-002',setting:'Protected settlement',value:'Enabled',scope:'Payments',lastChanged:'01/09/2026',owner:'Finance'},{id:'SYS-003',setting:'Maintenance mode',value:'Off',scope:'Platform access',lastChanged:'29/08/2026',owner:'Engineering'},{id:'SYS-004',setting:'API health monitoring',value:'Enabled',scope:'Integrations',lastChanged:'02/09/2026',owner:'Engineering'}]
 };
 const defaultRows = role==='admin' && type==='refunds' ? defaults.adminRefunds : defaults[type]; const rawInitial=rows||defaultRows||[]; const initial=role==='supplier'&&type==='transactions'?rawInitial.map(({fee,...r})=>({...r,supplierSettlement:r.supplierSettlement??r.amount})):rawInitial; const [data,setData]=useState(initial);
 const save=next=>{setData(next);write(`mvec_${role}_${type}`,next)};
 const columns=useMemo(()=>{const keys=Object.keys(data[0]||{});return keys.map(k=>({key:k,label:k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()),render:r=>typeof r[k]==='boolean'?r[k]?'Yes':'No':(k==='amount'||k==='budget'||k==='price'&&typeof r[k]==='number')?money(r[k]):k==='rating'?`★ ${r[k]}`:String(r[k])}))},[data]);
 const editable=['advertisements','subscription','shipping','categories'].includes(type);
 const actionTypes=['refunds','reviews','notifications','recommendations','matching','trust','security','system','fraud','advertising','subscriptions','shipping','categories'];
 const [notice,setNotice]=useState(''); const [details,setDetails]=useState(null);
 const contextualAction=(row)=>{
   const notify=(message)=>{setNotice(message);window.setTimeout(()=>setNotice(''),1800)};
   if(type==='refunds') return <button className="table-action-btn" onClick={()=>{const next=row.status==='Approved'?'Pending review':'Approved';save(data.map(x=>x===row?{...x,status:next}:x));notify(`Refund ${row.id} marked ${next.toLowerCase()}.`)}}>{row.status==='Approved'?'Reopen':'Review'}</button>;
   if(type==='reviews') return <button className="table-action-btn" onClick={()=>{save(data.map(x=>x===row?{...x,status:x.status==='Published'?'Response requested':'Published'}:x));notify('Review status updated.')}}>{row.status==='Published'?'Respond':'Publish'}</button>;
   if(type==='notifications') return <button className="table-action-btn" onClick={()=>{save(data.map(x=>x===row?{...x,status:'Read'}:x));notify('Notification marked as read.')}}>{row.status==='Read'?'Read':'Mark read'}</button>;
   if(type==='recommendations') return <button className="table-action-btn" onClick={()=>{save(data.map(x=>x===row?{...x,enabled:!x.enabled,lastUpdated:dateDMY(new Date())}:x));notify(`Recommendation signal ${row.enabled?'disabled':'enabled'}.`)}}>{row.enabled?'Disable':'Enable'}</button>;
   if(type==='matching') return <button className="table-action-btn" onClick={()=>{save(data.map(x=>x===row?{...x,score:Math.min(99,Number(x.score)+1),status:'Recommended'}:x));notify('Supplier match refreshed.')}}>Refresh match</button>;
   if(type==='trust') return <button className="table-action-btn" onClick={()=>setDetails(row)}>Review</button>;
   if(type==='security') return <button className="table-action-btn" onClick={()=>setDetails(row)}>Review policy</button>;
   if(type==='system') return <button className="table-action-btn" onClick={()=>{save(data.map(x=>x===row?{...x,lastChanged:dateDMY(new Date())}:x));notify(`${row.setting} updated.`)}}>Apply</button>;
   if(type==='fraud') return <button className="table-action-btn" onClick={()=>{save(data.map(x=>x===row?{...x,status:x.status==='Flagged'?'Review':'Monitoring'}:x));notify('Risk case status updated.')}}>Review</button>;
   return editable?<button className="table-action-btn" onClick={()=>{const nextStatus=row.status==='Active'?'Paused':'Active';const key=Object.keys(row).find(k=>k==='status');if(key)save(data.map(x=>x===row?{...x,status:nextStatus}:x));notify(`Record ${nextStatus.toLowerCase()}.`)}}>{row.status==='Active'?'Pause':'Activate'}</button>:null;
 };
 if(type==='support') return <SupportModule role={role}/>;
 if(type==='notifications') return <><Header eyebrow={`${role.toUpperCase()} · ${cfg[0]}`} title={cfg[1]} desc={cfg[2]}/><NotificationPanel/></>;
 if(type==='purchases'&&role==='vendor') return <WholesaleList role="vendor"/>;
 if((type==='supply-requests'||type==='transactions')&&role==='supplier') return <WholesaleList role="supplier"/>;
 if(type==='payments'&&role==='admin') return <AdminPayments/>;
 if(type==='refunds') return <DisputesList role={role}/>;
 return <><Header eyebrow={`${role.toUpperCase()} · ${cfg[0]}`} title={cfg[1]} desc={cfg[2]}/>{notice&&<div className="success-text">{notice}</div>}<div className="data-card"><SmartTable columns={columns} rows={data} rowKey={r=>r.id||r.name||r.plan||r.zone||r.control||r.signal||r.party} searchPlaceholder={`Search ${cfg[1].toLowerCase()}…`} exportName={`mvec-${role}-${type}`} actions={actionTypes.includes(type)?contextualAction:undefined}/></div>{details&&<div className="modal-backdrop" onMouseDown={()=>setDetails(null)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setDetails(null)}>×</button><span className="eyebrow">DETAILS</span><h2>{type==='trust'?'Trust profile':'Security policy'}</h2><div className="vendor-detail-grid">{Object.entries(details).map(([k,v])=><div key={k}><span>{k.replace(/([A-Z])/g,' $1')}</span><b>{String(v)}</b></div>)}</div><button className="gradient-btn" onClick={()=>setDetails(null)}>Done</button></div></div>}</>;
}


const SUPPORT_CATEGORIES=[['ORDER','Order or delivery'],['PAYMENT','Payment or payout'],['ACCOUNT','My account'],['VENDOR_ONBOARDING','Store setup'],['TECHNICAL','Technical problem'],['OTHER','Something else']];
const CASE_STATUS={OPEN:['Open','warning'],IN_PROGRESS:['In progress','pending'],RESOLVED:['Resolved','active'],CLOSED:['Closed','active']};
function CaseStatus({value}){const s=CASE_STATUS[value];return <em className={'status '+(s?.[1]||'warning')}>{s?.[0]||value}</em>}

function SupportModule({role}){
 const blank={subject:'',category:'ORDER',priority:'MEDIUM',reference:'',description:''};
 const [form,setForm]=useState(blank);const [sending,setSending]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [cases,setCases]=useState([]);const [loading,setLoading]=useState(true);
 const [open,setOpen]=useState(null);const [reply,setReply]=useState('');const [replying,setReplying]=useState(false);
 const load=()=>supportApi.listCases({pageSize:50}).then(res=>setCases(res.cases||[])).catch(err=>setError(extractErrorMessage(err))).finally(()=>setLoading(false));
 useEffect(()=>{load()},[]);// eslint-disable-line react-hooks/exhaustive-deps
 const update=e=>setForm(f=>({...f,[e.target.name]:e.target.value}));
 const submit=async e=>{
  e.preventDefault();if(!form.subject.trim()||!form.description.trim())return;
  setSending(true);setError('');
  try{
   const description=form.reference.trim()?`Reference: ${form.reference.trim()}\n\n${form.description.trim()}`:form.description.trim();
   const res=await supportApi.createCase({subject:form.subject.trim(),category:form.category,priority:form.priority,description});
   setNotice(`Ticket ${res.case?.ticketNumber||''} created. MVEC support will reply here.`);setForm(blank);await load();
  }catch(err){setError(extractErrorMessage(err))}finally{setSending(false)}
 };
 const view=c=>{setReply('');setOpen(c);supportApi.getCaseById(c._id||c.id).then(res=>setOpen(res.case||c)).catch(()=>{})};
 const sendReply=async()=>{
  if(!reply.trim())return;setReplying(true);
  try{await supportApi.addComment(open._id||open.id,{message:reply.trim()});const res=await supportApi.getCaseById(open._id||open.id);setOpen(res.case);setReply('');load()}
  catch(err){setError(extractErrorMessage(err))}finally{setReplying(false)}
 };
 const columns=[
  {key:'ticketNumber',label:'Ticket',render:c=><div><b>{c.ticketNumber}</b><small className="tiny seller-block">{dateDMY(c.createdAt)}</small></div>},
  {key:'subject',label:'Subject'},
  {key:'category',label:'Topic',render:c=>(SUPPORT_CATEGORIES.find(x=>x[0]===c.category)||[0,c.category])[1]},
  {key:'comments',label:'Replies',render:c=>c.comments?.length||0},
  {key:'status',label:'Status',render:c=><CaseStatus value={c.status}/>}
 ];
 return <><Header eyebrow={`${role.toUpperCase()} · SUPPORT`} title="MVEC Support" desc="Contact the MVEC team about payments, deliveries, orders or your account, and follow every request here."/>
  {notice&&<div className="form-alert success">{notice}</div>}
  {error&&<div className="form-error">{error}</div>}
  <div className="dash-grid support-grid">
   <form className="data-card support-direct" onSubmit={submit}>
    <h3>New request</h3>
    <div className="seller-form-grid">
     <label className="field"><span>Subject *</span><input name="subject" value={form.subject} onChange={update} required placeholder="e.g. Payout not received"/></label>
     <label className="field half"><span>Topic</span><select name="category" value={form.category} onChange={update}>{SUPPORT_CATEGORIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
     <label className="field half"><span>Urgency</span><select name="priority" value={form.priority} onChange={update}><option value="LOW">Low</option><option value="MEDIUM">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent: money or orders blocked</option></select></label>
     <label className="field"><span>Order or transaction ID</span><input name="reference" value={form.reference} onChange={update} placeholder="Optional"/></label>
     <label className="field"><span>Message *</span><textarea name="description" rows="5" value={form.description} onChange={update} required placeholder="Describe the issue and what you've already tried…"/></label>
    </div>
    <div className="support-actions"><button className="gradient-btn" type="submit" disabled={sending||!form.subject.trim()||!form.description.trim()}>{sending?'Sending…':'Send to MVEC'}</button></div>
   </form>
   <div className="data-card">
    <div className="data-card-head"><div><h3>Your requests</h3><span>{cases.filter(c=>c.status==='OPEN'||c.status==='IN_PROGRESS').length} open</span></div></div>
    {loading&&<div className="empty-state"><h3>Loading…</h3></div>}
    {!loading&&!cases.length&&<div className="empty-state"><h3>No requests yet</h3><p>Requests you send will appear here with MVEC's replies.</p></div>}
    {!loading&&cases.length>0&&<SmartTable columns={columns} rows={cases} rowKey={c=>c._id||c.id} pageSize={5} enableTools={cases.length>5} actions={c=><span className="row-actions"><button type="button" title="Open ticket" onClick={()=>view(c)}><Icon name="eye" size={16}/></button></span>}/>}
   </div>
  </div>
  {open&&<div className="modal-backdrop" onMouseDown={()=>setOpen(null)}><div className="modal seller-modal" role="dialog" aria-label={`Ticket ${open.ticketNumber}`} onMouseDown={e=>e.stopPropagation()}>
   <button type="button" className="modal-close" onClick={()=>setOpen(null)} aria-label="Close">×</button>
   <h2>{open.subject}</h2>
   <div className="purchase-status-note"><CaseStatus value={open.status}/><span>{open.ticketNumber} · opened {dateDMY(open.createdAt)}</span></div>
   <div className="case-thread">
    <div className="case-quote mine"><small>You · {dateDMY(open.createdAt)}</small><p>{open.description}</p></div>
    {(open.comments||[]).map((c,i)=>{const staff=c.author&&typeof c.author==='object'&&c.author.role!==undefined&&!['vendor','supplier','buyer','affiliate'].includes(c.author.role);
     return <div key={c._id||i} className={'case-quote'+(staff?'':' mine')}><small>{staff?'MVEC support':'You'} · {dateDMY(c.createdAt)}</small><p>{c.message}</p></div>})}
   </div>
   {!['RESOLVED','CLOSED'].includes(open.status)&&<label className="field"><span>Reply</span><textarea rows="3" value={reply} onChange={e=>setReply(e.target.value)} placeholder="Add more details…"/></label>}
   <div className="modal-actions"><button type="button" className="outline-btn" onClick={()=>setOpen(null)}>Close</button>
    {!['RESOLVED','CLOSED'].includes(open.status)&&<button type="button" className="gradient-btn" disabled={!reply.trim()||replying} onClick={sendReply}>{replying?'Sending…':'Send reply'}</button>}</div>
  </div></div>}
 </>;
}
function BuyerRefunds(){
 const [rows,setRows]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 useEffect(()=>{disputesApi.getMine().then(res=>setRows(res.data||[])).catch(err=>setError(extractErrorMessage(err))).finally(()=>setLoading(false));},[]);
 return <><Header eyebrow="BUYER" title="Refunds" desc="Track refund requests you've reported from your orders."/>
  <SettingCard title="Report a problem with an order" desc="Open the order and choose Report a problem to start a refund request with evidence."><Link className="gradient-btn" to="/orders">View my orders</Link></SettingCard>
  {error&&<div className="form-error">{error}</div>}
  <div className="data-card">{loading&&<div className="empty-state"><h3>Loading…</h3></div>}
   {!loading&&<SmartTable columns={[{key:'disputeNumber',label:'Case'},{key:'order',label:'Order',render:r=>r.order?.orderNumber||''},{key:'reason',label:'Reason'},{key:'disputedAmount',label:'Amount',render:r=>money(r.disputedAmount)},{key:'status',label:'Status'}]} rows={rows} rowKey={r=>r.id} searchPlaceholder="Search refunds…" empty="No refund requests yet." exportName="buyer-refunds"/>}
  </div></>;
}

function BuyerCompare(){
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    productsApi.getRecommendations(3)
      .then(res=>setProducts((res.products||[]).map(mapBackendProduct)))
      .catch(err=>setError(extractErrorMessage(err)))
      .finally(()=>setLoading(false));
  },[]);
  return <>
    <Header eyebrow="BUYER" title="Compare products" desc="Compare price, rating, stock and seller trust before you buy."/>
    {loading && <div className="empty-state"><h3>Loading…</h3></div>}
    {error && <div className="form-error">{error}</div>}
    {!loading && !error && products.length===0 && <div className="empty-state"><h3>No products to compare yet</h3></div>}
    <div className="dash-grid">
      {products.map(p=><div className="data-card" key={p.id}><img className="module-product-image" src={p.image} alt=""/><h3>{p.name}</h3><p>{p.vendor}</p><strong>{money(p.price)}</strong><div className="comparison-list"><span>Rating <b>★ {p.rating}</b></span><span>Stock <b>{p.stock}</b></span><span>Seller <b>Verified ✓</b></span><span>Category <b>{p.category}</b></span></div></div>)}
    </div>
  </>;
}

function BuyerRecommendations(){
  const [products,setProducts]=useState([]);
  const [personalized,setPersonalized]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    productsApi.getRecommendations(8)
      .then(res=>{ setProducts((res.products||[]).map(mapBackendProduct)); setPersonalized(Boolean(res.personalized)); })
      .catch(err=>setError(extractErrorMessage(err)))
      .finally(()=>setLoading(false));
  },[]);
  return <>
    <Header eyebrow="BUYER" title="Recommended for you" desc={personalized?"Based on categories you've bought from before.":"Popular and top-rated products across the marketplace."}/>
    {loading && <div className="empty-state"><h3>Loading…</h3></div>}
    {error && <div className="form-error">{error}</div>}
    {!loading && !error && products.length===0 && <div className="empty-state"><h3>No recommendations yet</h3><p>Browse the shop to see personalized picks appear here.</p></div>}
    <div className="product-grid">
      {products.map(p=><div className="product-card" key={p.id}><Link to={`/product/${p.id}`} className="product-img"><img src={p.image} alt={p.name}/></Link><div className="product-info"><small>{personalized?'Recommended for you':'Trending'}</small><Link to={`/product/${p.id}`} className="product-name">{p.name}</Link><b>{money(p.price)}</b></div></div>)}
    </div>
  </>;
}

function BuyerModule({type}){
 if(type==='compare') return <BuyerCompare/>;
 if(type==='recommendations') return <BuyerRecommendations/>;
 if(type==='refunds') return <BuyerRefunds/>;
 if(type==='notifications') return <><Header eyebrow="BUYER" title="Notifications" desc="Order, payment, delivery and marketplace updates in one place."/><NotificationPanel role="buyer"/></>;
 if(type==='support') return <><Header eyebrow="BUYER" title="Help & Support" desc="Get help with orders, payments, delivery and refunds."/><div className="dash-grid"><SettingCard title="Order problem" desc="Something went wrong with an order? Open the order and choose Report a problem."><Link className="gradient-btn" to="/orders">View my orders</Link></SettingCard><SettingCard title="Common questions"><div className="timeline">{['How do I track my order?','How are delivery fees calculated?','How do refunds work?','How can I contact a seller?'].map((x,i)=><div className="timeline-item done" key={x}><i/><div><b>{i+1}. {x}</b><small>MVEC Help Center</small></div></div>)}</div></SettingCard></div></>;
 if(type==='subscription') return <BuyerSubscription/>;
 return null;
}

export default function FeaturePages({role}){
 const path=useLocation().pathname; const key=path.split('/').filter(Boolean)[1]||'';
 if(role==='buyer') return <Storefront><main className="account-page"><BuyerModule type={key}/></main></Storefront>;
 if(!moduleConfig[role]?.[key]) return <DashboardLayout admin={role==='admin'}><div className="data-card"><h2>Page unavailable</h2><p>The requested workspace page could not be found.</p><Link className="gradient-btn" to={role==='admin'?'/admin':`/${role}`}>Return to dashboard</Link></div></DashboardLayout>; return <DashboardLayout admin={role==='admin'}><GenericTableModule role={role} type={key}/></DashboardLayout>;
}
