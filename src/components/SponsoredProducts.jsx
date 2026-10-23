// "Sponsored" row of seller ad campaigns on storefront pages. Products come
// from the already-loaded catalog; the server picks which campaigns show,
// counts the view, and charges the campaign when a buyer clicks.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adsApi } from '../API/ads';
import { resolveImageUrl } from '../utils/imageUrl';

const money = n => new Intl.NumberFormat('en-RW').format(Number(n) || 0) + ' RWF';

export default function SponsoredProducts({ surface = 'shop', q = '', category = '', catalog = [], limit = 4, title = 'Sponsored products' }) {
  const [ads, setAds] = useState([]);

  useEffect(() => {
    if (!catalog.length) return undefined;
    let alive = true;
    const t = setTimeout(() => {
      adsApi.sponsored({ surface, q: q || undefined, category: category || undefined, limit })
        .then(res => alive && setAds(res.data || []))
        .catch(() => alive && setAds([]));
    }, q ? 400 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [surface, q, category, limit, catalog.length]);

  const rows = ads
    .map(ad => ({ ad, p: catalog.find(p => String(p.id) === ad.productId || (ad.productPublicId && p.id === ad.productPublicId)) }))
    .filter(r => r.p);
  if (!rows.length) return null;

  const open = ad => { adsApi.click(ad.adId).catch(() => {}); };
  return <section className="sponsored-row" aria-label={title}>
    <div className="sponsored-head"><span className="eyebrow">SPONSORED</span><h3>{title}</h3></div>
    <div className="product-grid">
      {rows.map(({ ad, p }) => <div className="product-card sponsored" key={ad.adId}>
        <Link to={`/product/${p.id}`} className="product-img" onClick={() => open(ad)}>
          <img src={resolveImageUrl(p.image)} alt={p.name} />
          <span className="sponsored-badge">Sponsored</span>
        </Link>
        <div className="product-info">
          <small>{p.vendor}</small>
          <Link to={`/product/${p.id}`} className="product-name" onClick={() => open(ad)}>{p.name}</Link>
          <div className="rating">★ {p.rating} <span>({p.reviews})</span></div>
          <b>{money(p.price)}</b> {p.oldPrice ? <del>{money(p.oldPrice)}</del> : null}
        </div>
      </div>)}
    </div>
  </section>;
}
