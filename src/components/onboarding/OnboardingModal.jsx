import { useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { suppliersApi } from "../../API/suppliers";
import { vendorsApi } from "../../API/vendors";
import { uploadsApi } from "../../API/uploads";
import { extractErrorMessage } from "../../API/client";
import CategorySelect from "../CategorySelect";

export default function OnboardingModal({ onClose }) {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ businessName: user?.businessName || user?.companyName || "", email: user?.email || "", phone: user?.telephone || user?.phone || "", description: user?.description || "", logoUrl: user?.logoUrl || "", category: user?.category || "", location: typeof user?.location === "string" ? user.location : "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const update = e => setForm({ ...form, [e.target.name]: e.target.value });
  const upload = async e => { const file = e.target.files?.[0]; if (!file) return; try { setSaving(true); const result = await uploadsApi.uploadImages([file]); setForm(current => ({ ...current, logoUrl: result.urls?.[0] || "" })); } catch (err) { setError(extractErrorMessage(err)); } finally { setSaving(false); } };
  const submit = async e => { e.preventDefault(); if (submitting.current) return; setError(""); if (Object.values(form).some(value => !String(value || "").trim())) { setError("Business name, contact information, description, logo, category, and location are required."); return; } submitting.current = true; try { setSaving(true); const api = user.role === "supplier" ? suppliersApi : vendorsApi; await api.onboard(form); await refresh(); onClose(); } catch (err) { setError(extractErrorMessage(err)); submitting.current = false; } finally { setSaving(false); } };
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal onboarding-modal"><button className="modal-close" onClick={onClose}>×</button><span className="eyebrow">ACCOUNT SETUP</span><h2>Complete onboarding</h2><p>Submit your complete business profile. MVEC will review it before marketplace actions are enabled.</p>{error && <div className="form-alert error">{error}</div>}<form onSubmit={submit}><div className="form-row"><label className="field"><span>Business name</span><input name="businessName" value={form.businessName} onChange={update} required/></label><CategorySelect valueKey="name" label="Category" name="category" value={form.category} onChange={value => setForm(f => ({ ...f, category: value }))} required/></div><div className="form-row"><label className="field"><span>Email</span><input name="email" type="email" value={form.email} onChange={update} required/></label><label className="field"><span>Phone</span><input name="phone" value={form.phone} onChange={update} required/></label></div><label className="field"><span>Location</span><input name="location" value={form.location} onChange={update} placeholder="City, district, or address" required/></label><label className="field"><span>Business description</span><textarea name="description" value={form.description} onChange={update} rows="4" required/></label><label className="field"><span>Business logo URL</span><input name="logoUrl" value={form.logoUrl} onChange={update} placeholder="https://…" required/></label><label className="field"><span>Or upload a logo</span><input type="file" accept="image/*" onChange={upload}/></label><div className="modal-actions"><button type="button" className="outline-btn" onClick={onClose}>Cancel</button><button className="gradient-btn" disabled={saving}>{saving ? "Submitting…" : "Submit for review"}</button></div></form></div></div>;
}
