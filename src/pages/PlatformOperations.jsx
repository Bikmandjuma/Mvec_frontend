import {useEffect,useState} from "react";
import DashboardLayout from "../components/DashboardLayout";
import SmartTable from "../components/SmartTable";
import Pagination from "../components/Pagination";
import {adminApi} from "../API/admin";
import {extractErrorMessage} from "../API/client";
function LiveRoleRecords({type}) {
  const [rows,setRows]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [busyId,setBusyId]=useState('');const [page,setPage]=useState(1);const [total,setTotal]=useState(0);
  const isSupplier=type==='suppliers';
  const title=isSupplier?'Suppliers':'Affiliates';
  const load=()=>{setLoading(true);setError('');const request=isSupplier?adminApi.getSuppliers({page,pageSize:20}):adminApi.getAffiliates();request.then(res=>{const data=res.data||[];setRows(isSupplier?data.map(s=>({id:s._id||s.id,name:s.businessName,email:s.email||s.user?.email||'',verificationStatus:s.verificationStatus||'UNVERIFIED',status:s.status||'ACTIVE'})):data.map(a=>({...a,name:a.name||a.Fullname,status:a.status||'ACTIVE'})));setTotal(isSupplier?(res.meta?.total||0):data.length);}).catch(err=>setError(extractErrorMessage(err))).finally(()=>setLoading(false));};
  useEffect(()=>{load();},[type,page]);
  const act=async(row,action)=>{setBusyId(row.id);setError('');try{if(isSupplier){if(action==='verify')await adminApi.verifySupplier(row.id,{decision:'VERIFIED'});else if(action==='reject')await adminApi.verifySupplier(row.id,{decision:'REJECTED'});else await adminApi.updateSupplierStatus(row.id,{status:row.status==='ACTIVE'?'SUSPENDED':'ACTIVE'});}else{await adminApi.updateUserStatus(row.id,{status:row.status==='BLOCK'?'ACTIVE':'BLOCK'});}load();}catch(err){setError(extractErrorMessage(err));}finally{setBusyId('');}};
  const columns=isSupplier?[{key:'name',label:'Supplier'},{key:'email',label:'Email'},{key:'verificationStatus',label:'Verification'},{key:'status',label:'Account status'}]:[{key:'name',label:'Affiliate'},{key:'email',label:'Email'},{key:'clicks',label:'Clicks'},{key:'conversions',label:'Conversions'},{key:'earnings',label:'Earnings',render:r=>`${Number(r.earnings||0).toLocaleString()} RWF`},{key:'status',label:'Account status'}];
  return <DashboardLayout admin><div className="dash-page-head"><div><span className="eyebrow">MVEC OPERATIONS</span><h1>{title}</h1><p>Manage {title.toLowerCase()} using live marketplace account records.</p></div></div><div className="data-card"><div className="data-card-head"><div><h3>{title}</h3><span>{total} records</span></div></div>{error&&<div className="form-error">{error}</div>}{loading?<div className="empty-state"><h3>Loading {title.toLowerCase()}…</h3></div>:!error&&<SmartTable columns={columns} rows={rows} rowKey={r=>r.id} searchPlaceholder={`Search ${title.toLowerCase()}…`} actions={row=><>{isSupplier&&row.verificationStatus!=='VERIFIED'&&<><button className="table-action-btn" disabled={busyId===row.id} onClick={()=>act(row,'verify')}>Verify</button><button className="table-action-btn" disabled={busyId===row.id} onClick={()=>act(row,'reject')}>Reject</button></>}<button className="table-action-btn" disabled={busyId===row.id} onClick={()=>act(row,isSupplier?'status':'block')}>{isSupplier?(row.status==='ACTIVE'?'Suspend':'Activate'):(row.status==='BLOCK'?'Unblock':'Block')}</button></>}/>}{isSupplier&&total>20&&<Pagination page={page} setPage={setPage} total={total} perPage={20}/>}</div></DashboardLayout>;
}

export default function PlatformOperations({type}){return <LiveRoleRecords type={type}/>}
