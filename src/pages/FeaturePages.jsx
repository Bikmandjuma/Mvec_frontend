import {useEffect,useState} from 'react';
import {Link,useLocation,useSearchParams} from 'react-router-dom';
import Icon from '../components/Icon';
import SmartTable from '../components/SmartTable';
import DashboardLayout from '../components/DashboardLayout';import Storefront from '../components/Storefront';import NotificationPanel from '../components/NotificationPanel';
import {productsApi} from '../API/products';
import {suppliersApi} from '../API/suppliers';
import {supportApi} from '../API/support';
import {disputesApi} from '../API/disputes';
import {mapBackendProduct} from '../services/catalogApi';
import {client,extractErrorMessage} from '../API/client';
import {paymentsApi} from '../API/payments';
import {getCompare,toggleCompare,removeFromCompare,clearCompare,COMPARE_MAX} from '../utils/compare';
import {useMarketplace} from '../context/MarketplaceContext';
import ProductImage from '../components/ProductImage';
import {VendorAdvertising,AdminAdvertising} from './Advertising';
import {WholesaleOrders} from './Wholesale';

const money=n=>new Intl.NumberFormat('en-RW').format(Number(n)||0)+' RWF';
const dateDMY=d=>d?new Date(d).toLocaleDateString('en-GB'):'—';
const titleCaseText=s=>String(s||'').toLowerCase().replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());

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
  transactions:['transactions','Transactions','Every supplier payment and settlement has an auditable record.'],
  messages:['messages','Messages','Communicate with vendors about products and deliveries.'],
  reviews:['reviews','Reviews','Review supplier feedback and reliability indicators.']
 },
 delivery:{support:['support','MVEC Support','Contact MVEC about deliveries, pickups or your account.']},
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


function SupplierLiveModule({type}){
 const [rows,setRows]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 useEffect(()=>{const request=type==='transactions'?suppliersApi.getFinanceLedger({limit:100}):suppliersApi.getReviews({limit:100});request.then(res=>setRows(type==='transactions'?(res.entries||[]):(res.reviews||[]))).catch(err=>setError(extractErrorMessage(err))).finally(()=>setLoading(false));},[type]);
 const columns=type==='transactions'?[{key:'description',label:'Description'},{key:'kind',label:'Type'},{key:'amount',label:'Amount',render:r=>money(r.amount)},{key:'at',label:'Date',render:r=>dateDMY(r.at)}]:type==='reviews'?[{key:'author',label:'Vendor'},{key:'orderNumber',label:'Order'},{key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},{key:'comment',label:'Comment'},{key:'createdAt',label:'Date',render:r=>dateDMY(r.createdAt)}]:[{key:'reference',label:'Request'},{key:'status',label:'Status'},{key:'neededBy',label:'Needed by',render:r=>dateDMY(r.neededBy)},{key:'note',label:'Note'}];
 return <><Header eyebrow={`SUPPLIER · ${type.replace('-', ' ').toUpperCase()}`} title={type==='transactions'?'Transactions':'Reviews'} desc="Live records from the supplier database."/>{error&&<div className="form-error">{error}</div>}<div className="data-card">{loading?<div className="empty-state"><h3>Loading live records…</h3></div>:<SmartTable columns={columns} rows={rows} rowKey={r=>r._id||r.id||r.reference} searchPlaceholder={`Search ${type.replace('-', ' ')}…`} empty="No records in the database."/>}</div></>;
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

// Each workspace page key maps to its real, data-backed component.
function RoleModule({role,type}){
 if(type==='support') return <SupportModule role={role}/>;
 if(type==='notifications') return <NotificationPanel/>; // the panel has its own heading
 if(type==='purchases'&&role==='vendor') return <WholesaleOrders role="vendor"/>;
 if((type==='transactions'||type==='reviews')&&role==='supplier') return <SupplierLiveModule type={type}/>;
 if(type==='advertisements'&&role==='vendor') return <VendorAdvertising/>;
 if(type==='advertising'&&role==='admin') return <AdminAdvertising/>;
 if(type==='refunds') return <DisputesList role={role}/>;
 return <div className="data-card"><h2>Page unavailable</h2><p>This page is not available.</p><Link className="gradient-btn" to={role==='admin'?'/admin':`/${role}`}>Return to dashboard</Link></div>;
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
     <label className="field half"><span>Topic</span><select name="category" value={form.category} onChange={update}>{SUPPORT_CATEGORIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>{role==='buyer'&&form.category==='ORDER'&&<p className="tiny field-note">Problem with a specific order? Open it in <Link to="/orders">My orders</Link> and choose Report a problem. The seller and MVEC both receive it, and the payment stays on hold until it's resolved.</p>}
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
 useEffect(()=>{disputesApi.getMine().then(res=>setRows((res.data||[]).map(r=>({...r,id:r.id||r._id})))).catch(err=>setError(extractErrorMessage(err))).finally(()=>setLoading(false));},[]);
 return <><Header eyebrow="BUYER" title="Refunds" desc="Track refund requests you've reported from your orders."/>
  <SettingCard title="Report a problem with an order" desc="Open the order and choose Report a problem to start a refund request with evidence."><Link className="gradient-btn" to="/orders">View my orders</Link></SettingCard>
  {error&&<div className="form-error">{error}</div>}
  <div className="data-card">{loading&&<div className="empty-state"><h3>Loading…</h3></div>}
   {!loading&&<SmartTable columns={[{key:'disputeNumber',label:'Case'},{key:'order',label:'Order',render:r=>r.order?.orderNumber||''},{key:'reason',label:'Reason',render:r=>String(r.reason||'').toLowerCase().replace(/_/g,' ')},{key:'disputedAmount',label:'Amount',render:r=>money(r.disputedAmount)},{key:'status',label:'Status',render:r=>String(r.status||'').toLowerCase().replace(/_/g,' ')}]} rows={rows} rowKey={r=>r.id} searchPlaceholder="Search refunds…" empty="No refund requests yet." exportName="buyer-refunds"/>}
  </div></>;
}

// Side-by-side comparison of the products the buyer picked ("Compare" on a product page).
function BuyerCompare(){
  const {wishlist=[]}=useMarketplace();
  const [ids,setIds]=useState(getCompare());
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  useEffect(()=>{const sync=()=>setIds(getCompare());window.addEventListener('mvec-compare',sync);return()=>window.removeEventListener('mvec-compare',sync);},[]);
  useEffect(()=>{
    let alive=true;
    setLoading(true);
    Promise.allSettled(ids.map(id=>productsApi.getById(id)))
      .then(results=>{
        if(!alive)return;
        const found=results.filter(r=>r.status==='fulfilled'&&r.value).map(r=>mapBackendProduct(r.value));
        setProducts(found);
        // Drop products that were deleted (404); keep them on temporary errors.
        results.forEach((r,i)=>{if(r.status==='rejected'&&r.reason?.response?.status===404)removeFromCompare(ids[i]);});
      })
      .catch(err=>alive&&setError(extractErrorMessage(err)))
      .finally(()=>alive&&setLoading(false));
    return()=>{alive=false;};
  },[ids]);
  const add=(id)=>{const r=toggleCompare(id);setNotice(r.message);};
  const candidates=wishlist.filter(w=>!ids.includes(String(w.id))).slice(0,6);
  const best=products.length>1?Math.min(...products.map(p=>Number(p.price)||Infinity)):null;
  const rows=[
    ['Price',p=><b className={Number(p.price)===best?'success-text':''}>{money(p.price)}{Number(p.price)===best?' · lowest':''}</b>],
    ['Rating',p=>p.rating>0?`★ ${Number(p.rating).toFixed(1)}`:'New'],
    ['Stock',p=>p.stock>0?`${p.stock} available`:<span className="danger-text">Out of stock</span>],
    ['Seller',p=>p.vendor],
    ['Category',p=>p.category||'—'],
  ];
  return <>
    <Header eyebrow="BUYER" title="Compare products" desc="Compare price, rating, stock and seller before you buy. Add products with the Compare button on any product page."/>
    {error&&<div className="form-error">{error}</div>}{notice&&<div className="form-alert success" role="status">{notice}</div>}
    {loading?<div className="empty-state"><h3>Loading…</h3></div>:products.length===0?<div className="empty-state">
      <h3>Nothing to compare yet</h3><p>Open a product and press <b>⇄ Compare</b>, or pick from your wishlist below.</p>
      <Link className="gradient-btn" to="/shop">Browse products</Link>
    </div>:<div className="data-card compare-card"><div className="compare-table" style={{'--cols':products.length}}>
      <div className="compare-head"><span/>{products.map(p=><div key={p.id}><Link to={`/product/${p.id}`}><ProductImage className="module-product-image" src={p.image} alt=""/><b>{p.name}</b></Link><button type="button" className="text-btn" onClick={()=>removeFromCompare(p.id)}>Remove</button></div>)}</div>
      {rows.map(([label,render])=><div className="compare-row" key={label}><span>{label}</span>{products.map(p=><div key={p.id}>{render(p)}</div>)}</div>)}
      <div className="compare-row"><span/>{products.map(p=><div key={p.id}><Link className="outline-btn compact-btn" to={`/product/${p.id}`}>View product</Link></div>)}</div>
    </div>{products.length<2&&<p className="tiny">Add at least one more product to compare.</p>}{products.length>0&&<button type="button" className="text-btn" onClick={clearCompare}>Clear all</button>}</div>}
    {candidates.length>0&&ids.length<COMPARE_MAX&&<div className="data-card"><h3>Add from your wishlist</h3><div className="compare-picks">{candidates.map(w=><button type="button" key={w.id} className="outline-btn compact-btn" onClick={()=>add(w.id)}>+ {w.name}</button>)}</div></div>}
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
      {products.map(p=><div className="product-card" key={p.id}><Link to={`/product/${p.id}`} className="product-img"><ProductImage src={p.image} alt={p.name}/></Link><div className="product-info"><small>{personalized?'Recommended for you':'Trending'}</small><Link to={`/product/${p.id}`} className="product-name">{p.name}</Link><b>{money(p.price)}</b></div></div>)}
    </div>
  </>;
}

// Premium (ad-free) is bought with mobile money or card; it switches on when the payment succeeds.
function BuyerSubscription(){
 const [params,setParams]=useSearchParams();
 const [data,setData]=useState(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
 const [method,setMethod]=useState('momo');const [phone,setPhone]=useState('');const [waiting,setWaiting]=useState(false);
 const load=()=>client.get('/buyer/subscription').then(r=>setData(r.data)).catch(err=>setError(extractErrorMessage(err))).finally(()=>setLoading(false));
 useEffect(()=>{load();},[]);
 const current=data?.subscription?.planKey||'FREE';
 const premiumActive=current==='PREMIUM'&&data?.subscription?.status==='Active';

 // Watch a payment until it succeeds or fails (3 minutes at most).
 const watch=async(paymentId)=>{
  setWaiting(true);
  const until=Date.now()+3*60*1000;
  while(Date.now()<until){
   try{
    const r=await paymentsApi.getStatus(paymentId);
    if(r.payment?.status==='SUCCESS'){await load();setNotice('Premium is active. Enjoy shopping without ads!');setWaiting(false);return;}
    if(['FAILED','CANCELLED'].includes(r.payment?.status)){setError('The payment was declined or cancelled. You have not been charged; you can try again.');setWaiting(false);return;}
   }catch{/* temporary network problem: keep checking */}
   await new Promise(res=>setTimeout(res,3000));
  }
  setWaiting(false);setNotice('We have not received the payment confirmation yet. If you approved it, Premium switches on as soon as it arrives.');
 };
 // Back from the card page.
 useEffect(()=>{const id=params.get('paymentId');if(!id)return;setParams({},{replace:true});setMethod('card');setNotice('Checking your card payment…');watch(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);

 const subscribe=async(e)=>{
  e.preventDefault();setError('');setNotice('');
  if(method==='momo'&&!/^(\+?250|0)?7[2389]\d{7}$/.test(phone.replace(/\s/g,''))){setError('Enter an MTN (078/079) or Airtel (072/073) number.');return;}
  setBusy(true);
  try{
   const r=await client.post('/buyer/subscription/checkout',method==='momo'?{method,phoneNumber:phone.trim()}:{method}).then(x=>x.data);
   if(r.status==='SUCCESS'){await load();setNotice('Premium is active. Enjoy shopping without ads!');return;}
   if(method==='card'){if(!r.checkoutUrl)throw new Error('The card page could not be opened. Please try again.');window.location.assign(r.checkoutUrl);return;}
   setNotice(r.message||'Approve the prompt on your phone.');watch(r.paymentId);
  }catch(err){setError(extractErrorMessage(err));}
  finally{setBusy(false);}
 };
 const cancel=async()=>{if(!window.confirm('Switch back to Free? Ads will show again. Time you already paid for is not refunded.'))return;setBusy(true);setError('');try{const r=await client.post('/buyer/subscription',{plan:'FREE'});setData(r.data);setNotice(r.data.message);}catch(err){setError(extractErrorMessage(err));}finally{setBusy(false);}};
 const premium=(data?.tiers||[]).find(t=>t.planKey==='PREMIUM');

 return <><Header eyebrow="BUYER" title="Subscription" desc="Optional ad-free shopping plan."/>
  {error&&<div className="form-alert error" role="alert">{error}</div>}{notice&&<div className="form-alert success" role="status">{notice}</div>}
  {loading?<div className="empty-state"><h3>Loading…</h3></div>:<div className="dash-grid">
   <SettingCard title="Free" desc="Free forever · ads are shown">
    {current==='FREE'||!premiumActive?<span className="role-chip">Your plan</span>:<button className="outline-btn" disabled={busy} onClick={cancel}>Switch to Free</button>}
   </SettingCard>
   <SettingCard title={premium?.plan||'Buyer Ad Removal'} desc={`${money(premium?.price||5000)} · ${premium?.billing||'Monthly'} · no ads anywhere on MVEC`}>
    {premiumActive?<>
     <span className="role-chip">Your plan</span>
     <p className="tiny">Active until {data.subscription.renewal}. Pay again any time to add 30 more days.</p>
    </>:null}
    <form onSubmit={subscribe} className="subscription-pay">
     <div role="radiogroup" aria-label="Payment method">
      <label className={`payment-option ${method==='momo'?'selected':''}`}><input type="radio" name="sub-method" checked={method==='momo'} onChange={()=>setMethod('momo')} disabled={busy||waiting}/><span className="payment-logo" aria-hidden="true">📱</span><span><b>Mobile money</b><small>MTN MoMo or Airtel Money</small></span></label>
      <label className={`payment-option ${method==='card'?'selected':''}`}><input type="radio" name="sub-method" checked={method==='card'} onChange={()=>setMethod('card')} disabled={busy||waiting}/><span className="payment-logo" aria-hidden="true">💳</span><span><b>Card</b><small>Visa or Mastercard on Flutterwave's secure page</small></span></label>
     </div>
     {method==='momo'&&<label className="field"><span>Mobile money number</span><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="07xx xxx xxx" autoComplete="tel" disabled={busy||waiting}/></label>}
     <button className="gradient-btn full" type="submit" disabled={busy||waiting}>{waiting?'Waiting for payment…':busy?'Starting…':`${premiumActive?'Add 30 days':'Subscribe'} · ${money(premium?.price||5000)}`}</button>
     {waiting&&method==='momo'&&<p className="tiny" role="status">Approve the prompt on your phone. This page updates automatically.</p>}
    </form>
   </SettingCard>
  </div>}
 </>;
}

const FAQ=[
 ['How do I track my order?','Open My orders and choose the order. You see each step (paid, preparing, shipped, on the way) and get a notification when it changes.'],
 ['How are delivery fees calculated?','Each seller sets fees for your district. You see the exact fee for every parcel at checkout, before you pay.'],
 ['How do refunds work?','You can cancel within 30 minutes of paying for a full refund. After that, use Report a problem on the order; MVEC holds the seller\'s payment while it reviews. Refunds go back to the mobile money number or card you paid with.'],
 ['When does the seller get my money?','MVEC holds your payment until you give the courier your 6-digit delivery code. Only give the code when the items are in your hands.'],
 ['How can I contact a seller?','Open Messages and search for the store, or use the Messages link on the order.'],
];

function BuyerModule({type}){
 if(type==='compare') return <BuyerCompare/>;
 if(type==='recommendations') return <BuyerRecommendations/>;
 if(type==='refunds') return <BuyerRefunds/>;
 if(type==='notifications') return <NotificationPanel role="buyer"/>; // the panel has its own heading
 if(type==='support') return <><Header eyebrow="BUYER" title="Help & Support" desc="Get help with orders, payments, delivery and refunds."/><div className="dash-grid"><SettingCard title="Order problem" desc="Something went wrong with an order? Open the order and choose Report a problem."><Link className="gradient-btn" to="/orders">View my orders</Link></SettingCard><SettingCard title="Common questions"><div className="faq-list">{FAQ.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></SettingCard></div></>;
 if(type==='subscription') return <BuyerSubscription/>;
 return null;
}

// URL segments whose module key is named differently.
const PATH_KEYS={'audit-logs':'audit'};

export function AdminDisputesPage(){return <DashboardLayout admin><DisputesList role="admin"/></DashboardLayout>}

export default function FeaturePages({role}){
 const path=useLocation().pathname; const segment=path.split('/').filter(Boolean)[1]||''; const key=PATH_KEYS[segment]||segment;
 if(role==='buyer') return <Storefront><main className="account-page"><BuyerModule type={key}/></main></Storefront>;
 if(!moduleConfig[role]?.[key]) return <DashboardLayout admin={role==='admin'}><div className="data-card"><h2>Page unavailable</h2><p>The requested workspace page could not be found.</p><Link className="gradient-btn" to={role==='admin'?'/admin':`/${role}`}>Return to dashboard</Link></div></DashboardLayout>; return <DashboardLayout admin={role==='admin'}><RoleModule role={role} type={key}/></DashboardLayout>;
}
