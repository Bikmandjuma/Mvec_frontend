import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Storefront from '../components/Storefront';
import { vendorsApi } from '../API/vendors';
import Icon from '../components/Icon';
import ProductImage from '../components/ProductImage';
import Pagination from '../components/Pagination';

export default function Vendors() {
  const [page, setPage] = useState(1);
  const [vendors, setVendors] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const perPage = 6;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    vendorsApi.getAll({ page, pageSize: perPage }).then(res => {
      if (!alive) return;
      setVendors(res.data || []);
      setTotal(res.meta?.total || (res.data || []).length);
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [page]);

  return (
    <Storefront>
      <main className="catalog-page">
        <div className="catalog-head">
          <div><span className="eyebrow">MARKETPLACE STORES</span><h1>Stores</h1><p>Every store selling on MVEC. Sellers checked by MVEC carry a Verified badge; every order is protected by MVEC either way.</p></div>
        </div>
        {loading && <div className="empty-state"><h3>Loading vendors…</h3></div>}
        {!loading && vendors.length === 0 && <div className="empty-state"><h3>No vendors yet</h3><p>Stores appear here once they have products for sale.</p></div>}
        {!loading && vendors.length > 0 && (
          <div className="vendor-grid vendor-page-grid">
            {vendors.map(v => (
              <Link to={`/vendors/${v.slug || v.id}`} className="vendor-card big" key={v.id}>
                {v.logoUrl ? <ProductImage className="vendor-avatar" src={v.logoUrl} alt="" /> : <div className="vendor-avatar">{(v.businessName || 'V')[0]}</div>}
                <div>
                  <b>{v.businessName}</b>
                  <small>{v.category || 'Business'} · {typeof v.location === 'string' ? v.location : (v.location?.city || 'Rwanda')}</small>
                  <span>{Number(v.ratingAvg) > 0 ? `★ ${Number(v.ratingAvg).toFixed(1)}` : 'New store'}</span>
                  {v.description && <small>{v.description}</small>}
                  {v.verificationStatus === 'VERIFIED' ? <small className="verified-badge">✓ Verified seller</small> : <small>Seller on MVEC</small>}
                </div>
                <Icon name="arrow" />
              </Link>
            ))}
          </div>
        )}
        <Pagination page={page} setPage={setPage} total={total} perPage={perPage} />
      </main>
    </Storefront>
  );
}
