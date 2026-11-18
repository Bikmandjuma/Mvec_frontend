/**
 * The product form's sizes/colours and flash-deal sections.
 *
 * Variants: up to two option names (e.g. Size, Color) and one row per
 * combination, each with its own stock and an optional own price. With
 * variants, the product's stock is their sum.
 */
const toLocal = (d) => {
  if (!d) return '';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
};

/** Editor state from a saved product: { names: ["Size","Color"], rows: [{ id, values: {Size: "M"}, price, stock, sku }] }. */
export function variantStateFrom(product) {
  const list = Array.isArray(product?.variants) ? product.variants : [];
  const names = [];
  for (const v of list) for (const n of Object.keys(v.options || {})) if (!names.includes(n)) names.push(n);
  return {
    names: names.length ? names.slice(0, 2) : ['Size'],
    rows: list.map((v) => ({ id: v.id, values: { ...(v.options || {}) }, price: v.ownPrice ?? '', stock: v.stockQuantity ?? 0, sku: v.sku || '' })),
  };
}

/** What the API takes: [{ id?, options, price, stockQuantity, sku }]. */
export function variantPayload(state) {
  return state.rows.map((r) => ({
    id: r.id,
    options: Object.fromEntries(state.names.filter(Boolean).map((n) => [n, r.values[n] || ''])),
    price: r.price === '' ? null : Number(r.price),
    stockQuantity: Number(r.stock) || 0,
    sku: r.sku,
  }));
}

export function dealStateFrom(product) {
  return {
    dealPrice: product?.dealPrice ?? '',
    dealStartsAt: toLocal(product?.dealStartsAt),
    dealEndsAt: toLocal(product?.dealEndsAt),
    dealQuantity: product?.dealQuantity ?? '',
    had: Boolean(product?.dealPrice),
  };
}

/** Undefined when nothing changes; `{ dealPrice: null }` ends a deal. */
export function dealPayload(deal) {
  if (deal.dealPrice === '' || deal.dealPrice === null) return deal.had ? { dealPrice: null } : {};
  return {
    dealPrice: Number(deal.dealPrice),
    dealStartsAt: deal.dealStartsAt ? new Date(deal.dealStartsAt).toISOString() : new Date().toISOString(),
    dealEndsAt: deal.dealEndsAt ? new Date(deal.dealEndsAt).toISOString() : '',
    dealQuantity: deal.dealQuantity === '' ? null : Number(deal.dealQuantity),
  };
}

export function VariantEditor({ state, onChange }) {
  const { names, rows } = state;
  const set = (next) => onChange({ ...state, ...next });
  const setRow = (i, patch) => set({ rows: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const total = rows.reduce((n, r) => n + (Number(r.stock) || 0), 0);
  return (
    <section className="editor-section">
      <h3>Sizes &amp; colours</h3>
      <p className="tiny">Sell one product in several sizes or colours, each with its own stock (and price, if it differs). Buyers choose one before adding to cart. Leave empty if the product has no options.</p>
      <div className="two-col">
        {[0, 1].map((i) => (
          <label key={i} className="field"><span>{i === 0 ? 'First option' : 'Second option (optional)'}</span>
            <input value={names[i] || ''} placeholder={i === 0 ? 'Size' : 'Color'} maxLength={40}
              onChange={(e) => { const next = [...names]; next[i] = e.target.value; set({ names: next.filter((n, k) => k === 0 || n !== undefined) }); }} />
          </label>
        ))}
      </div>
      {rows.length > 0 && (
        <div className="variant-table">
          <div className="variant-row head">{names.filter(Boolean).map((n) => <span key={n}>{n}</span>)}<span>Own price</span><span>Stock</span><span /></div>
          {rows.map((r, i) => (
            <div key={r.id || i} className="variant-row">
              {names.filter(Boolean).map((n) => <input key={n} aria-label={n} value={r.values[n] || ''} maxLength={60} placeholder={n === 'Size' ? 'M' : n === 'Color' ? 'Red' : ''} onChange={(e) => setRow(i, { values: { ...r.values, [n]: e.target.value } })} />)}
              <input aria-label="Own price" type="number" min="1" value={r.price} placeholder="Same" onChange={(e) => setRow(i, { price: e.target.value })} />
              <input aria-label="Stock" type="number" min="0" value={r.stock} onChange={(e) => setRow(i, { stock: e.target.value })} />
              <button type="button" className="icon-btn" aria-label="Remove option" onClick={() => set({ rows: rows.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
        </div>
      )}
      <div className="row-actions">
        <button type="button" className="outline-btn compact-btn" onClick={() => set({ rows: [...rows, { values: {}, price: '', stock: 0, sku: '' }] })}>+ Add a size/colour</button>
        {rows.length > 0 && <span className="tiny">Total stock: {total}</span>}
      </div>
    </section>
  );
}

export function DealEditor({ deal, onChange, price }) {
  const set = (k) => (e) => onChange({ ...deal, [k]: e.target.value });
  const off = deal.dealPrice !== '' && Number(price) > 0 ? Math.round((1 - Number(deal.dealPrice) / Number(price)) * 100) : null;
  return (
    <section className="editor-section">
      <h3>Flash deal</h3>
      <p className="tiny">A lower price for a short time (up to 14 days), optionally for a limited number of units. It shows on the Deals page with a countdown. When it ends or the units run out, the regular price is back.</p>
      <div className="two-col">
        <label className="field"><span>Deal price (RWF){off != null && off > 0 ? ` · ${off}% off` : ''}</span><input type="number" min="1" value={deal.dealPrice} onChange={set('dealPrice')} placeholder="No deal" /></label>
        <label className="field"><span>Units at this price</span><input type="number" min="1" value={deal.dealQuantity} onChange={set('dealQuantity')} placeholder="No limit" /></label>
        <label className="field"><span>Starts</span><input type="datetime-local" value={deal.dealStartsAt} onChange={set('dealStartsAt')} /></label>
        <label className="field"><span>Ends</span><input type="datetime-local" value={deal.dealEndsAt} onChange={set('dealEndsAt')} /></label>
      </div>
      {deal.had && <button type="button" className="outline-btn compact-btn" onClick={() => onChange({ ...deal, dealPrice: '', dealStartsAt: '', dealEndsAt: '', dealQuantity: '' })}>End the deal</button>}
    </section>
  );
}
