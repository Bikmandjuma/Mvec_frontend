import { useMemo, useState } from "react";
import Icon from "./Icon";
import Pagination from "./Pagination";

export default function SmartTable({ columns, rows, rowKey, pageSize=6, searchPlaceholder="Search…", empty="No records found.", actions }) {
  const [q,setQ]=useState("");
  const [page,setPage]=useState(1);
  const filtered=useMemo(()=>rows.filter(row=>JSON.stringify(row).toLowerCase().includes(q.toLowerCase())),[rows,q]);
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const current=Math.min(page,totalPages);
  const shown=filtered.slice((current-1)*pageSize,current*pageSize);
  const changeSearch=e=>{setQ(e.target.value);setPage(1)};
  return <>
    <div className="smart-table-tools"><div className="dash-filter"><Icon name="search"/><input value={q} onChange={changeSearch} placeholder={searchPlaceholder}/></div><span className="table-count">{filtered.length} records</span></div>
    <div className="data-table smart-table"><div className="data-row table-label" style={{gridTemplateColumns:`repeat(${columns.length + (actions?1:0)}, minmax(130px,1fr))`}}>{columns.map(c=><span key={c.key||c}>{c.label||c}</span>)}{actions&&<span>Actions</span>}</div>
      {shown.length ? shown.map((row,index)=><div className="data-row" key={rowKey?rowKey(row):index} style={{gridTemplateColumns:`repeat(${columns.length + (actions?1:0)}, minmax(130px,1fr))`}}>{columns.map(c=><span key={c.key||c.key}>{c.render?c.render(row):row[c.key]}</span>)}{actions&&<span className="row-actions">{actions(row)}</span>}</div>) : <div className="table-empty">{empty}</div>}
    </div>
    <Pagination page={current} setPage={setPage} total={filtered.length} perPage={pageSize}/>
  </>;
}
