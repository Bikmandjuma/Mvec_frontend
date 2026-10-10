import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Storefront from '../components/Storefront';
import { vendorsApi } from '../API/vendors';
import { productsApi } from '../API/products';
import { mapBackendProduct } from '../services/catalogApi';
import { extractErrorMessage } from '../API/client';
import ProductImage from '../components/ProductImage';

const money = n => new Intl.NumberFormat('en-RW').format(Number(n) || 0) + ' RWF';

export default function VendorDetail() {
  const { id } = useParams();
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    vendorsApi.getByIdOrSlug(id).then(res => {
      if (!alive) return;
      const v = res.vendor;
      setVendor(v);
      setFollowing(localStorage.getItem(`mvec_follow_vendor_${v.id}`) === '1');
      return productsApi.getAll({ vendorId: v.userId });
    }).then(res => {
      if (!alive || !res) return;
      setProducts((res.products || []).map(mapBackendProduct));
    }).catch(err => alive && setError(extractErrorMessage(err)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  const toggleFollow = () => {
    const next = !following;
    setFollowing(next);
    localStorage.setItem(`mvec_follow_vendor_${vendor.id}`, next ? '1' : '0');
  };

  if (loading) return <Storefront><main className="catalog-page"><div className="empty-state"><h3>Loading store…</h3></div></main></Storefront>;
  if (error || !vendor) return <Storefront><main className="catalog-page"><div className="empty-state"><h3>Store not found</h3><p>{error}</p></div></main></Storefront>;

  return (
    <Storefront>
      <main className="catalog-page">
        <div className="store-banner">
          {vendor.logoUrl ? <img className="vendor-avatar" src={vendor.logoUrl} alt="" /> : <div className="vendor-avatar">{vendor.businessName?.[0] || 'V'}</div>}
          <div>
            <span className="eyebrow">{vendor.verificationStatus === 'VERIFIED' ? 'VERIFIED STORE' : 'STORE'}</span>
            <h1>{vendor.businessName}</h1>
            <p>★ {Number(vendor.ratingAvg || 0).toFixed(1)} · {products.length} products · {vendor.category || 'Business'}</p>
          </div>
          <button className="outline-btn" onClick={toggleFollow}>{following ? 'Following' : 'Follow store'}</button>
        </div>
        <div className="verified-box"><b>{vendor.category || 'Business'} · {typeof vendor.location === 'string' ? vendor.location : (vendor.location?.city || 'Rwanda')}</b><p>{vendor.description || 'This business has not added a description yet.'}</p></div>
        <div className="section-heading"><h2>Store products</h2><Link to="/shop">All products →</Link></div>
        {products.length === 0 && <div className="empty-state"><h3>No products listed yet</h3></div>}
        <div className="product-grid">
          {products.map(p => (
            <div className="product-card" key={p.id}>
              <Link to={`/product/${p.id}`} className="product-img"><ProductImage src={p.image} alt="" /></Link>
              <div className="product-info">
                <small>{p.category}</small>
                <Link className="product-name" to={`/product/${p.id}`}>{p.name}</Link>
                <div className="rating">★ {p.rating} <span>({p.reviews})</span></div>
                <b>{money(p.price)}</b>
              </div>
            </div>
          ))}
        </div>
      </main>
    </Storefront>
  );
}
