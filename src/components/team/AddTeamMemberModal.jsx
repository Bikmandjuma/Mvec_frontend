import { useEffect, useState } from "react";
import { extractErrorMessage } from "../../API/client";

const VENDOR_ROLES = [
  ["STORE_MANAGER", "Admin / Store Manager"],
  ["CATALOG_MANAGER", "Inventory Manager"],
  ["ORDER_MANAGER", "Fulfillment / Orders Manager"],
];

const SUPPLIER_ROLES = [
  ["OPERATIONS", "Admin / Operations"],
  ["WAREHOUSE", "Inventory Manager"],
  ["FULFILMENT", "Fulfillment / Orders Manager"],
  ["VIEWER", "Viewer"],
];

export default function AddTeamMemberModal({
  mode = "vendor",
  value,
  onCancel,
  onSave,
}) {
  const editing = Boolean(value?._id);
  const roles = mode === "supplier" ? SUPPLIER_ROLES : VENDOR_ROLES;
  const [form, setForm] = useState({
    name: value?.name || value?.fullName || "",
    email: value?.email || "",
    phone: value?.phone || "",
    password: "",
    role: value?.role || roles[0][0],
    status: value?.status || "ACTIVE",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const close = (event) => event.key === "Escape" && onCancel();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onCancel]);

  const update = (event) =>
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({ ...form, id: value?._id || value?.id });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onCancel}>×</button>
        <span className="eyebrow">TEAM / STAFF</span>
        <h2>{editing ? "Edit team member" : "Add team member"}</h2>
        <p>{mode === "vendor" && !editing ? "Create an account now or send an email invitation." : "Save this team member to the database."}</p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={submit}>
          <label className="field"><span>Full name *</span><input name="name" value={form.name} onChange={update} required /></label>
          <div className="form-row">
            <label className="field"><span>Email address {mode === "vendor" ? "*" : ""}</span><input type="email" name="email" value={form.email} onChange={update} required={mode === "vendor"} /></label>
            <label className="field"><span>Phone number *</span><input name="phone" value={form.phone} onChange={update} required /></label>
          </div>
          {!editing && <label className="field"><span>{mode === "vendor" ? "Temporary password (leave empty to send invitation)" : "Login password"} *</span><input type="password" name="password" value={form.password} onChange={update} minLength="8" required={mode === "supplier"} autoComplete="new-password" /></label>}
          <label className="field"><span>Permission role *</span><select name="role" value={form.role} onChange={update} required>{roles.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          {editing && <label className="field"><span>Status</span><select name="status" value={form.status} onChange={update}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="INVITED">Invited</option></select></label>}
          <div className="modal-actions"><button type="button" className="outline-btn" onClick={onCancel}>Cancel</button><button className="gradient-btn" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : mode === "vendor" && !form.password ? "Send invitation" : "Save member"}</button></div>
        </form>
      </div>
    </div>
  );
}
