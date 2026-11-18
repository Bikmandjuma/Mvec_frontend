import { useState } from 'react';
import { uploadsApi } from '../../API/uploads';
import { extractErrorMessage } from '../../API/client';
import { formatDate } from '../../utils/format';

const KINDS = [['NATIONAL_ID', 'National ID or passport'], ['BUSINESS_REGISTRATION', 'RDB business registration'], ['TIN', 'TIN certificate'], ['OTHER', 'Other document']];

/**
 * A seller's (or supplier's) identity and business papers for Ikiguzi's
 * review. Files are private: only the seller and Ikiguzi can open them.
 * `save(documents)` stores the list on the profile.
 */
export default function SellerDocuments({ documents = [], save }) {
  const [kind, setKind] = useState('NATIONAL_ID');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const add = async (files) => {
    if (!files?.length) return;
    setBusy(true); setNotice(null);
    try {
      const { documents: up } = await uploadsApi.documents(files);
      await save([...documents, ...up.map((d) => ({ kind, url: d.url, name: d.name }))]);
      setNotice({ ok: true, text: 'Document added. Ikiguzi reviews it with your profile.' });
    } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(false); }
  };
  const remove = async (url) => {
    setBusy(true);
    try { await save(documents.filter((d) => d.url !== url)); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(false); }
  };
  return (
    <div className="data-card">
      <h3>Verification documents</h3>
      <p className="tiny">Ikiguzi verifies sellers before their products appear in the marketplace, and verified sellers get a badge buyers trust. Add a photo or PDF of your ID and, if you have one, your RDB business registration. Only you and Ikiguzi can see them.</p>
      {notice && <div className={`form-alert ${notice.ok ? 'success' : 'error'}`}>{notice.text}</div>}
      {documents.length > 0 && <ul className="doc-list">{documents.map((d) => (
        <li key={d.url}><button type="button" className="link-btn" onClick={() => uploadsApi.openPrivate(d.url).catch(() => setNotice({ ok: false, text: 'The document could not be opened.' }))}>{d.label || KINDS.find(([k]) => k === d.kind)?.[1] || d.kind}</button><small className="tiny">{d.name} · {formatDate(d.uploadedAt)}</small><button type="button" className="icon-btn" aria-label="Remove document" disabled={busy} onClick={() => remove(d.url)}>×</button></li>
      ))}</ul>}
      <div className="row-actions">
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Document type">{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <label className="outline-btn compact-btn">{busy ? 'Uploading…' : 'Upload'}<input type="file" accept="image/*,application/pdf" hidden disabled={busy} onChange={(e) => add(e.target.files)} /></label>
      </div>
    </div>
  );
}

/** For Ikiguzi's review: the documents as links that open privately. */
export function DocumentLinks({ documents = [] }) {
  if (!documents.length) return <p className="tiny">No documents uploaded.</p>;
  return <ul className="doc-list">{documents.map((d) => <li key={d.url}><button type="button" className="link-btn" onClick={() => uploadsApi.openPrivate(d.url)}>{d.label || d.kind}</button><small className="tiny">{d.name}</small></li>)}</ul>;
}
