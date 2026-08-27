import { useMemo } from 'react';
export default function Pagination({page,setPage,total,perPage=8}){
  const pages=Math.max(1,Math.ceil(total/perPage));
  const numbers=useMemo(()=>{if(pages<=7)return Array.from({length:pages},(_,i)=>i+1);let a=[1];if(page>4)a.push('…');let s=Math.max(2,page-1),e=Math.min(pages-1,page+1);for(let i=s;i<=e;i++)a.push(i);if(page<pages-3)a.push('…');a.push(pages);return a},[pages,page]);
  return <div className="pagination"><button disabled={page===1} onClick={()=>setPage(page-1)}>‹</button>{numbers.map((n,i)=>n==='…'?<span key={i}>…</span>:<button key={n} className={page===n?'current':''} onClick={()=>setPage(n)}>{n}</button>)}<button disabled={page===pages} onClick={()=>setPage(page+1)}>›</button><small>Page {page} of {pages}</small></div>
}
