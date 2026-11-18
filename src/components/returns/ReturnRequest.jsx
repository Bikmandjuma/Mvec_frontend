import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { returnsApi } from '../../API/returns';
import { uploadsApi } from '../../API/uploads';
import { extractErrorMessage } from '../../API/client';
import { money, formatDate } from '../../utils/format';
import ProductImage from '../ProductImage';

/**
 * On a delivered order: choose the items to send back, why, and (when the
 * seller is at fault) a photo. One request goes to each seller involved.
 */
export default function ReturnRequest({ orderId }) {
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = () => returnsApi.eligibility(orderId).then(setInfo).catch(() => setInfo(null));
  useEffect(() => { load(); }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!info) return null;
  const returnable = info.items.filter((i) => i.returnable > 0);
  const deadline = returnable.map((i) => new Date(i.deadline)).sort((a, b) => b - a)[0];
  const chosenReason = info.reasons.find((r) => r.code === reason);

  if (!returnable.length && !notice) return null;

  const addPhotos = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const { urls } = await uploadsApi.photos([...files].slice(0, 5 - photos.length));
      setPhotos((p) => [...p, ...urls].slice(0, 5));
    } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(false); }
  };
  const submit = async (e) => {
    e.preventDefault();
    const items = Object.entries(qty).filter(([, n]) => n > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (!items.length) { setNotice({ ok: false, text: 'Choose at least one item to return.' }); return; }
    setBusy(true); setNotice(null);
    try {
      const res = await returnsApi.create({ orderId, items, reason, description: description.trim(), photos });
      setNotice({ ok: true, text: `Return ${res.returns.map((r) => r.returnNumber).join(', ')} sent. The seller answers within a few days; you'll get a message.` });
      setOpen(false); setQty({}); setReason(''); setDescription(''); setPhotos([]);
      load();
    } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(false); }
  };

  return (
    <section className="data-card">
      <h3>Return items</h3>
      {notice && <div className={`form-alert ${notice.ok ? 'success' : 'error'}`}>{notice.text} {notice.ok && <Link to="/account/returns">See my returns</Link>}</div>}
      {returnable.length > 0 && !open && <>
        <p className="tiny">You can send items back until {formatDate(deadline)}. Once the seller has them, you're refunded to the number or card you paid with. The delivery fee isn't refunded.</p>
        <button type="button" className="outline-btn" onClick={() => setOpen(true)}>Start a return</button>
      </>}
      {open && <form onSubmit={submit}>
        {returnable.map((i) => (
          <div key={i.orderItemId} className="return-line">
            <ProductImage src={i.image} alt="" />
            <div><b>{i.name}</b>{i.variantLabel && <small className="variant-chip">{i.variantLabel}</small>}<small className="tiny">{money(i.price)} each · up to {i.returnable}</small></div>
            <select aria-label={`How many ${i.name} to return`} value={qty[i.orderItemId] || 0} onChange={(e) => setQty((q) => ({ ...q, [i.orderItemId]: Number(e.target.value) }))}>
              {Array.from({ length: i.returnable + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'Keep' : `Return ${n}`}</option>)}
            </select>
          </div>
        ))}
        <label className="field"><span>Why are you returning it?</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} required>
            <option value="">Choose a reason</option>
            {info.reasons.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </label>
        <label className="field"><span>Tell the seller more</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} required placeholder="What's wrong with it?" />
        </label>
        <div className="field">
          <span>Photos{chosenReason?.needsPhoto ? ' (needed: show the problem)' : ' (optional)'}</span>
          <div className="return-photos">
            {photos.map((u) => <span key={u} className="return-photo"><ProductImage src={u} alt="" /><button type="button" aria-label="Remove photo" onClick={() => setPhotos((p) => p.filter((x) => x !== u))}>×</button></span>)}
            {photos.length < 5 && <label className="outline-btn compact-btn">Add photo<input type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} /></label>}
          </div>
        </div>
        <div className="row-actions">
          <button type="button" className="outline-btn" onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" className="gradient-btn" disabled={busy}>{busy ? 'Sending…' : 'Send return request'}</button>
        </div>
      </form>}
    </section>
  );
}
