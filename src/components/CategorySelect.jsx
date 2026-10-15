import { useEffect, useState } from "react";
import { categoriesApi } from "../API/categories";
import { extractErrorMessage } from "../API/client";
import { useAuth } from "../context/AuthContext";

// One category picker for the whole app. Categories come from MVEC's list;
// if the right one is missing, sellers, suppliers and admins can add it right
// here and it is selected at once and appears in every other picker.
//
// valueKey "id" stores the category id (products, commission rules);
// valueKey "name" stores the name (business category on a profile, wholesale products).
const NEW = "__new__";
const CHANGED = "mvec:categories-changed";
let cached = null;

function load(force = false) {
  if (!cached || force) cached = categoriesApi.getAll().then((r) => (r.categories || r.data || []).filter((c) => c.active !== false).map((c) => ({ id: String(c.id || c._id), name: c.name })).sort((a, b) => a.name.localeCompare(b.name))).catch((err) => { cached = null; throw err; });
  return cached;
}

export default function CategorySelect({ value, onChange, valueKey = "id", label = "Category", name = "category", required = false, allowCreate = true, placeholder = "Choose a category", className = "field", id }) {
  const { user } = useAuth() || {};
  const [list, setList] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canCreate = allowCreate && ["vendor", "supplier", "super_admin"].includes(user?.role);

  useEffect(() => {
    let alive = true;
    const refresh = (force) => load(force).then((rows) => alive && setList(rows)).catch((err) => alive && setError(extractErrorMessage(err)));
    refresh(false);
    const onChanged = () => refresh(false);
    window.addEventListener(CHANGED, onChanged);
    return () => { alive = false; window.removeEventListener(CHANGED, onChanged); };
  }, []);

  const keyOf = (c) => (valueKey === "name" ? c.name : c.id);
  // Keep an older hand-typed value visible until it is replaced.
  const legacy = value && !list.some((c) => keyOf(c) === value || (valueKey === "name" && c.name.toLowerCase() === String(value).toLowerCase())) ? value : null;

  const pick = (e) => {
    if (e.target.value === NEW) { setAdding(true); setError(""); return; }
    const cat = list.find((c) => keyOf(c) === e.target.value) || null;
    onChange(e.target.value, cat);
  };

  const create = async () => {
    const nameText = draft.trim();
    if (nameText.length < 2) { setError("Type the new category's name."); return; }
    setBusy(true); setError("");
    try {
      const res = await categoriesApi.create({ name: nameText });
      const created = { id: String(res.category.id || res.category._id), name: res.category.name };
      const rows = await load(true);
      setList(rows.some((c) => c.id === created.id) ? rows : [...rows, created].sort((a, b) => a.name.localeCompare(b.name)));
      window.dispatchEvent(new Event(CHANGED));
      onChange(keyOf(created), created);
      setAdding(false); setDraft("");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return <div className={`${className} category-select`}>
    <span id={`${id || name}-label`}>{label}{required ? " *" : ""}</span>
    {!adding ? <select id={id || `${name}-select`} aria-labelledby={`${id || name}-label`} name={name} value={legacy ? value : value || ""} onChange={pick} required={required}>
      <option value="">{placeholder}</option>
      {legacy && <option value={legacy}>{legacy}</option>}
      {list.map((c) => <option key={c.id} value={keyOf(c)}>{c.name}</option>)}
      {canCreate && <option value={NEW}>+ Add a new category…</option>}
    </select>
      : <div className="category-add">
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New category name" aria-label="New category name" maxLength={80}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } if (e.key === "Escape") setAdding(false); }} />
        <button type="button" className="gradient-btn" disabled={busy} onClick={create}>{busy ? "Adding…" : "Add"}</button>
        <button type="button" className="outline-btn" onClick={() => { setAdding(false); setError(""); }}>Cancel</button>
      </div>}
    {error && <small className="field-error" role="alert">{error}</small>}
  </div>;
}

// Fixed lists people should pick from rather than type.
export const UNITS = ["piece", "pack", "box", "carton", "dozen", "set", "pair", "bag", "sack", "kg", "g", "litre", "ml", "metre", "roll", "bottle", "crate", "tray"];

export function UnitSelect({ value, onChange, label = "Unit", name = "unit", required = true, className = "field" }) {
  const options = UNITS.includes(value) || !value ? UNITS : [value, ...UNITS];
  return <label className={className}><span>{label}{required ? " *" : ""}</span>
    <select name={name} value={value || ""} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">Choose a unit</option>
      {options.map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
  </label>;
}
