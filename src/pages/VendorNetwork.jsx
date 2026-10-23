import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";
import { suppliersApi } from "../API/suppliers";
import { wholesaleApi } from "../API/wholesale";
import { storesApi } from "../API/stores";
import { conversationsApi } from "../API/conversations";
import { extractErrorMessage } from "../API/client";
import { resolveImageUrl } from "../utils/imageUrl";

const money = n => new Intl.NumberFormat("en-RW").format(Math.round(Number(n) || 0)) + " RWF";
const idOf = v => String(v?._id || v?.id || v || "");

// Supplier.location is free-form until locations are modelled: a string or an address object.
const locationOf = s => {
  const l = s.location;
  if (!l) return "Rwanda";
  if (typeof l === "string") return l;
  return [l.sector, l.district || l.city, l.province].filter(Boolean).join(", ") || "Rwanda";
};

// Same pricing rule the backend applies when the order is created.
const unitPrice = p => (Number(p.wholesalePrice) || 0) * (1 - (Number(p.bulkDiscount) || 0) / 100);

function Rating({ value }) {
  const v = Number(value) || 0;
  return <span className="b2b-rating" title={`${v.toFixed(1)} out of 5`}>
    {[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= Math.round(v) ? "on" : ""}>★</i>)}
    <b>{v ? v.toFixed(1) : "New"}</b>
  </span>;
}

function SupplierAvatar({ s, size = 48 }) {
  return s.logoUrl
    ? <img className="b2b-avatar" src={resolveImageUrl(s.logoUrl)} alt="" style={{ width: size, height: size }} />
    : <span className="b2b-avatar" style={{ width: size, height: size }}>{(s.businessName || "?").slice(0, 1).toUpperCase()}</span>;
}

function CatalogModal({ supplier, onClose, onMessage, messaging, messageError }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [qty, setQty] = useState({});
  const [placing, setPlacing] = useState(false);
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");

  // The store that receives the goods when the order completes (primary by default).
  useEffect(() => {
    storesApi.getMyStores()
      .then(res => { const list = res.stores || []; setStores(list); setStoreId(idOf(list.find(s => s.isPrimary) || list[0])); })
      .catch(() => setStores([]));
  }, []);

  useEffect(() => {
    suppliersApi.getProducts(idOf(supplier))
      .then(res => setProducts(res.products || []))
      .catch(err => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [supplier]);

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(term)) : products;
  }, [products, q]);

  const lines = products.filter(p => qty[idOf(p)] > 0).map(p => ({ p, quantity: qty[idOf(p)] }));
  const total = lines.reduce((n, l) => n + unitPrice(l.p) * l.quantity, 0);
  const lineError = ({ p, quantity }) =>
    quantity < p.moq ? `Minimum order is ${p.moq} ${p.unit}${p.moq === 1 ? "" : "s"}.`
      : quantity > p.stockQuantity ? `Only ${p.stockQuantity} in stock.` : "";
  const invalid = lines.some(lineError);

  const setLine = (p, value) => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    setQty(cur => ({ ...cur, [idOf(p)]: n }));
  };

  const placeOrder = async () => {
    setPlacing(true);
    setError("");
    try {
      const res = await wholesaleApi.createOrder({
        supplierId: idOf(supplier),
        items: lines.map(l => ({ productId: idOf(l.p), productName: l.p.name, quantity: l.quantity })),
        ...(storeId ? { storeId } : {}),
      });
      // Purchases opens the payment step for this order straight away.
      navigate("/vendor/purchases", { state: { notice: "Order placed and stock reserved for 48 hours. Pay now to confirm it.", payOrderId: idOf(res.data) } });
    } catch (err) {
      setError(extractErrorMessage(err));
      setPlacing(false);
    }
  };

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal b2b-catalog" role="dialog" aria-label={`${supplier.businessName} catalog`} onMouseDown={e => e.stopPropagation()}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
      <div className="b2b-catalog-head">
        <SupplierAvatar s={supplier} size={52} />
        <div>
          <h2>{supplier.businessName} <em className="status active">Verified ✓</em></h2>
          <p><Rating value={supplier.ratingAvg} /> · {locationOf(supplier)}</p>
        </div>
        <button type="button" className="outline-btn" disabled={messaging} onClick={() => onMessage(supplier)}>
          <Icon name="users" size={16} />{messaging ? "Opening…" : "Message"}
        </button>
      </div>
      {supplier.description && <p className="b2b-catalog-desc">{supplier.description}</p>}
      {(error || messageError) && <div className="form-error">{error || messageError}</div>}

      <div className="b2b-catalog-body">
        <div className="b2b-catalog-products">
          {products.length > 4 && <div className="dash-filter"><Icon name="search" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search this catalog…" /></div>}
          {loading && <div className="empty-state"><h3>Loading catalog…</h3></div>}
          {!loading && !products.length && !error && <div className="empty-state"><h3>No wholesale products yet</h3><p>Message this supplier to ask what they can supply.</p></div>}
          {shown.map(p => {
            const id = idOf(p);
            const n = qty[id] || 0;
            const out = p.stockQuantity < p.moq;
            return <div className={"b2b-product" + (n ? " selected" : "")} key={id}>
              {p.media?.mainImage ? <img src={resolveImageUrl(p.media.mainImage)} alt="" /> : <span className="b2b-product-img"><Icon name="box" size={22} /></span>}
              <div className="b2b-product-info">
                <b>{p.name}</b>
                <small>{p.category} · MOQ {p.moq} {p.unit}{p.moq === 1 ? "" : "s"} · {p.stockQuantity} in stock{p.shipsFrom ? ` · ships from ${p.shipsFrom.storeName}${p.shipsFrom.city ? `, ${p.shipsFrom.city}` : ""}` : ""}</small>
                <span className="b2b-price">
                  {money(unitPrice(p))}<small>/{p.unit}</small>
                  {p.bulkDiscount > 0 && <><s>{money(p.wholesalePrice)}</s><em>-{p.bulkDiscount}%</em></>}
                </span>
              </div>
              {out
                ? <em className="status danger">Out of stock</em>
                : n
                  ? <div className="b2b-qty">
                      <button type="button" aria-label="Decrease" onClick={() => setLine(p, n - 1 < p.moq ? 0 : n - 1)}>−</button>
                      <input type="number" min={p.moq} max={p.stockQuantity} value={n} onChange={e => setLine(p, e.target.value)} aria-label={`${p.name} quantity`} />
                      <button type="button" aria-label="Increase" disabled={n >= p.stockQuantity} onClick={() => setLine(p, n + 1)}>+</button>
                    </div>
                  : <button type="button" className="table-action-btn" onClick={() => setLine(p, p.moq)}><Icon name="plus" size={14} />Add {p.moq}</button>}
            </div>;
          })}
        </div>

        <aside className="b2b-order">
          <ol className="b2b-steps" aria-label="How buying works">
            {["Pick products", "Place order", "Pay", "Confirm delivery"].map((label, i) =>
              <li key={label} className={i === (lines.length ? 1 : 0) ? "on" : i < (lines.length ? 1 : 0) ? "done" : ""}><span>{i + 1}</span>{label}</li>)}
          </ol>
          <h3>Your order{lines.length > 0 && <small className="tiny"> · {lines.length} product{lines.length === 1 ? "" : "s"}</small>}</h3>
          {!lines.length && <p className="tiny">Click <b>Add</b> on a product to start. Quantities start at each product's minimum order.</p>}
          {lines.map(l => <div className="b2b-order-line" key={idOf(l.p)}>
            <div><b>{l.p.name}</b><small>{l.quantity} {l.p.unit}{l.quantity === 1 ? "" : "s"} × {money(unitPrice(l.p))}</small>{lineError(l) && <small className="b2b-line-error">{lineError(l)}</small>}</div>
            <span>{money(unitPrice(l.p) * l.quantity)}</span>
            <button type="button" className="b2b-line-remove" aria-label={`Remove ${l.p.name}`} title="Remove" onClick={() => setLine(l.p, 0)}>×</button>
          </div>)}
          {lines.length > 0 && <div className="b2b-order-total"><span>Total</span><b>{money(total)}</b></div>}
          {stores.length > 1
            ? <label className="field"><span>Deliver to store</span>
                <select value={storeId} onChange={e => setStoreId(e.target.value)}>
                  {stores.map(s => <option key={idOf(s)} value={idOf(s)}>{s.storeName}{s.isPrimary ? " (primary)" : ""}</option>)}
                </select>
              </label>
            : null}
          {lines.length > 0 && <p className="tiny">When you confirm receipt, the goods are added to {stores.find(s => idOf(s) === storeId)?.storeName || "your store"}'s inventory automatically.</p>}
          <button type="button" className="gradient-btn" disabled={!lines.length || invalid || placing} onClick={placeOrder}>
            {placing ? "Placing order…" : lines.length ? `Place order · ${money(total)}` : "Place order"}
          </button>
          {lines.length > 0 && !invalid && <p className="tiny">Next, you pay by mobile money or card.</p>}
          <p className="tiny b2b-escrow-note"><Icon name="shield" size={14} /> Your payment is held in escrow and only released to the supplier after you confirm delivery.</p>
        </aside>
      </div>
    </div>
  </div>;
}

export default function VendorNetwork() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("rating");
  const [page, setPage] = useState(1);
  const [contacting, setContacting] = useState("");
  const [open, setOpen] = useState(null);
  const perPage = 9;

  useEffect(() => {
    suppliersApi.getAll({ pageSize: 100 })
      .then(res => setSuppliers(res.data || []))
      .catch(err => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = suppliers.filter(s => `${s.businessName} ${locationOf(s)} ${s.description || ""}`.toLowerCase().includes(term));
    return sort === "name"
      ? [...list].sort((a, b) => a.businessName.localeCompare(b.businessName))
      : [...list].sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0));
  }, [suppliers, q, sort]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / perPage)));
  const rows = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const contactSupplier = async (s) => {
    setError("");
    setContacting(idOf(s));
    try {
      await conversationsApi.create({ recipientId: idOf(s.user), subject: `Wholesale enquiry: ${s.businessName}` });
      navigate("/vendor/messages");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setContacting("");
    }
  };

  return (
    <DashboardLayout>
      <div className="dash-page-head">
        <div><span className="eyebrow">B2B MARKETPLACE</span><h1>Find suppliers</h1><p>Browse verified suppliers, compare wholesale prices and order stock in bulk, protected by escrow.</p></div>
      </div>
      <div className="dash-toolbar b2b-toolbar">
        <div className="dash-filter"><Icon name="search" /><input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search by supplier, location or what they sell…" /></div>
        <select className="period-select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort suppliers">
          <option value="rating">Top rated</option>
          <option value="name">Name A–Z</option>
        </select>
        <span className="table-count">{filtered.length} supplier{filtered.length === 1 ? "" : "s"}</span>
      </div>
      {error && !open && <div className="form-error">{error}</div>}
      {loading && <div className="empty-state"><h3>Loading suppliers…</h3></div>}
      {!loading && !rows.length && <div className="data-card empty-state">
        <h3>{q ? "No suppliers match your search" : "No verified suppliers yet"}</h3>
        <p>{q ? "Try a different name or location." : "Verified suppliers will appear here as they join MVEC."}</p>
      </div>}
      {!loading && rows.length > 0 && (
        <div className="b2b-grid">
          {rows.map(s => {
            const id = idOf(s);
            return <div className="data-card b2b-card" key={id}>
              <div className="b2b-card-head">
                <SupplierAvatar s={s} />
                <div>
                  <h3>{s.businessName}</h3>
                  <span className="tiny">{locationOf(s)}</span>
                </div>
                <em className="status active" title="Verified by MVEC">✓</em>
              </div>
              <Rating value={s.ratingAvg} />
              <p className="b2b-card-desc">{s.description || "Wholesale supplier on MVEC."}</p>
              <div className="b2b-card-actions">
                <button type="button" className="gradient-btn" onClick={() => { setError(""); setOpen(s); }}><Icon name="box" size={16} />View catalog</button>
                <button type="button" className="outline-btn" title="Message supplier" disabled={contacting === id} onClick={() => contactSupplier(s)}>
                  {contacting === id ? "…" : <Icon name="users" size={16} />}
                </button>
              </div>
            </div>;
          })}
        </div>
      )}
      {filtered.length > perPage && <Pagination page={safePage} setPage={setPage} total={filtered.length} perPage={perPage} />}
      <div className="verified-box"><b>✓ B2B trust</b><p>Every supplier here is verified by MVEC. Minimum order quantities and stock are checked when you order, and your payment stays in escrow until you confirm the delivery.</p></div>
      {open && <CatalogModal supplier={open} onClose={() => setOpen(null)} onMessage={contactSupplier} messaging={contacting === idOf(open)} messageError={error} />}
    </DashboardLayout>
  );
}
