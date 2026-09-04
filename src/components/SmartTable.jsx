import { useMemo, useState } from "react";
import Pagination from "./Pagination";

const FILTER_KEYS = ["status","category","role","payment","settlement","type","state","stage","risk","method","range","period","date"];
const labelFor = key => key ? key.replace(/([A-Z])/g," $1").replace(/^./,s=>s.toUpperCase()) : "Filter";
const csvCell = value => `"${String(value ?? "").replace(/"/g,'""')}"`;
const plainValue = (row,col) => {
  const value = row?.[col.key];
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export default function SmartTable({ columns, rows=[], rowKey, pageSize=6, searchPlaceholder="Search…", empty="No records found.", actions, enableTools=true, exportName="mvec-records" }) {
  const [q,setQ]=useState("");
  const [page,setPage]=useState(1);
  const filterKey=useMemo(()=>FILTER_KEYS.find(key=>rows.some(row=>row?.[key]!==undefined && row?.[key]!==null && String(row[key]).trim()!=="")),[rows]);
  const filterOptions=useMemo(()=>filterKey?[...new Set(rows.map(row=>String(row?.[filterKey]??"")).filter(Boolean))].sort():[],[rows,filterKey]);
  const [filterValue,setFilterValue]=useState("");
  const [filterOpen,setFilterOpen]=useState(false);
  const filtered=useMemo(()=>rows.filter(row=>{
    const matchesSearch=JSON.stringify(row).toLowerCase().includes(q.toLowerCase());
    const matchesFilter=!filterValue || !filterKey || String(row?.[filterKey]??"")===filterValue;
    return matchesSearch && matchesFilter;
  }),[rows,q,filterKey,filterValue]);
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const current=Math.min(page,totalPages);
  const shown=filtered.slice((current-1)*pageSize,current*pageSize);
  const changeSearch=e=>{setQ(e.target.value);setPage(1)};
  const exportCsv=()=>{
    const header=columns.map(c=>csvCell(c.label||c.key||c)).join(",");
    const body=filtered.map(row=>columns.map(c=>csvCell(plainValue(row,c))).join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+header+"\n"+body],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download=`${exportName}-${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  return <>
    {enableTools&&<div className="smart-table-tools">
      <div className="dash-filter"><span aria-hidden="true">⌕</span><input value={q} onChange={changeSearch} placeholder={searchPlaceholder}/></div>
      {filterOpen&&filterKey&&<select className="table-filter-select" value={filterValue} onChange={e=>{setFilterValue(e.target.value);setPage(1)}} aria-label={`Filter by ${labelFor(filterKey)}`}><option value="">All {labelFor(filterKey)}</option>{filterOptions.map(v=><option key={v} value={v}>{v}</option>)}</select>}
      <button type="button" className="filter-btn table-filter-toggle" onClick={()=>setFilterOpen(v=>!v)} aria-expanded={filterOpen}>Filter{filterValue?` · ${filterValue}`:""}</button><button type="button" className="filter-btn table-export-btn" onClick={exportCsv}>Export CSV</button>
      <span className="table-count">{filtered.length} records</span>
    </div>}
    <div className="table-scroll">
      <table className="smart-table">
        <colgroup>{columns.map(c=><col key={c.key||c} />)}{actions&&<col />}</colgroup>
        <thead><tr>{columns.map(c=><th key={c.key||c}>{c.label||c}</th>)}{actions&&<th>Actions</th>}</tr></thead>
        <tbody>
          {shown.length ? shown.map((row,index)=><tr key={rowKey?rowKey(row,index):index}>{columns.map(c=><td key={c.key||c}>{c.render?c.render(row):row[c.key]}</td>)}{actions&&<td className="row-actions">{actions(row)}</td>}</tr>) : <tr><td className="table-empty" colSpan={columns.length+(actions?1:0)}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
    <Pagination page={current} setPage={setPage} total={filtered.length} perPage={pageSize}/>
  </>;
}
