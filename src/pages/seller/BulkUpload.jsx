import { useEffect, useState } from "react";
import { productsApi } from "../../API/products";
import { categoriesApi } from "../../API/categories";
import { extractErrorMessage } from "../../API/client";

// Bulk product upload from a spreadsheet saved as CSV. The file is read in the
// browser; each row goes through the same rules as adding a product by hand.
const COLUMNS = ["name", "description", "price", "discountPrice", "stockQuantity", "category", "brand", "mainImage", "status"];
const TEMPLATE = `${COLUMNS.join(",")}\n"Wireless earbuds","Bluetooth 5.3 earbuds with charging case",25000,22000,40,Electronics,SoundMax,https://example.com/earbuds.jpg,DRAFT\n`;

// Minimal CSV reader: commas, quoted fields with "" escapes, CRLF or LF.
function parseCsv(text) {
  const rows = []; let row = []; let field = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export default function BulkUpload({ onClose, onDone }) {
  const [categories, setCategories] = useState([]);
  const [rows, setRows] = useState([]);
  const [problems, setProblems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { categoriesApi.getAll().then((r) => setCategories(r.categories || [])).catch(() => {}); }, []);

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "mvec-products-template.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const readFile = async (file) => {
    setError(""); setResult(null); setRows([]); setProblems([]);
    if (!file) return;
    const table = parseCsv(await file.text());
    if (table.length < 2) { setError("The file has no product rows. Use the template's first row as the header."); return; }
    const header = table[0].map((h) => h.trim());
    const missing = ["name", "description", "price", "category", "mainImage"].filter((c) => !header.includes(c));
    if (missing.length) { setError(`The header is missing: ${missing.join(", ")}. Download the template to see the columns.`); return; }
    const byName = new Map(categories.map((c) => [String(c.name).trim().toLowerCase(), c.id || c._id]));
    const found = []; const issues = [];
    table.slice(1).forEach((cells, i) => {
      const r = Object.fromEntries(header.map((h, j) => [h, (cells[j] || "").trim()]));
      const categoryId = byName.get(String(r.category).toLowerCase());
      const rowIssues = [];
      if (!r.name) rowIssues.push("name");
      if (!r.description) rowIssues.push("description");
      if (!(Number(r.price) > 0)) rowIssues.push("price");
      if (!categoryId) rowIssues.push(`category "${r.category}" not found`);
      if (!/^https?:\/\//i.test(r.mainImage)) rowIssues.push("mainImage must be an image link (https://…)");
      if (rowIssues.length) { issues.push(`Row ${i + 2}: ${rowIssues.join(", ")}`); return; }
      found.push({
        name: r.name, description: r.description, price: Number(r.price),
        ...(Number(r.discountPrice) > 0 ? { discountPrice: Number(r.discountPrice) } : {}),
        stockQuantity: Math.max(0, Math.floor(Number(r.stockQuantity) || 0)),
        category: categoryId, ...(r.brand ? { brand: r.brand } : {}), mainImage: r.mainImage,
        status: String(r.status || "DRAFT").toUpperCase() === "ACTIVE" ? "ACTIVE" : "DRAFT",
      });
    });
    if (found.length > 200) { setError("Upload up to 200 products at a time. Split the file and try again."); return; }
    setRows(found); setProblems(issues);
  };

  const upload = async () => {
    setBusy(true); setError("");
    try { const res = await productsApi.bulkCreate(rows); setResult(res); if (res.created) onDone?.(); }
    catch (err) { const data = err.response?.data; if (data?.results) setResult(data); setError(extractErrorMessage(err)); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
    <div className="modal seller-modal bulk-upload" role="dialog" aria-label="Upload products">
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close" disabled={busy}>×</button>
      <h2>Upload products</h2>
      <p>Fill in the template in Excel or Google Sheets, save it as CSV, then choose it here. Products are added as drafts unless the status column says ACTIVE. Up to 200 at a time.</p>
      <button type="button" className="outline-btn" onClick={downloadTemplate}>Download template</button>
      <label className="field"><span>CSV file</span><input type="file" accept=".csv,text/csv" onChange={(e) => readFile(e.target.files?.[0])} disabled={busy} /></label>
      {error && <div className="form-alert error" role="alert">{error}</div>}
      {problems.length > 0 && <div className="form-alert error"><b>{problems.length} row{problems.length === 1 ? "" : "s"} will be skipped:</b><ul>{problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}</ul>{problems.length > 8 && <small>…and {problems.length - 8} more.</small>}</div>}
      {rows.length > 0 && !result && <p className="tiny">{rows.length} product{rows.length === 1 ? "" : "s"} ready to upload.</p>}
      {result && <div className={`form-alert ${result.created ? "success" : "error"}`}><b>{result.message}</b>{(result.results || []).filter((r) => !r.ok).slice(0, 8).map((r) => <div key={r.row} className="tiny">{r.name || `Product ${r.row}`}: {r.message}</div>)}</div>}
      <div className="modal-actions">
        <button type="button" className="outline-btn" onClick={onClose} disabled={busy}>{result ? "Close" : "Cancel"}</button>
        {!result && <button type="button" className="gradient-btn" disabled={busy || !rows.length} onClick={upload}>{busy ? "Uploading…" : `Upload ${rows.length || ""} product${rows.length === 1 ? "" : "s"}`}</button>}
      </div>
    </div>
  </div>;
}
