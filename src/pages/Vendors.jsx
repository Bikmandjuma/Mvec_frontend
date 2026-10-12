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
          <div><span className="eyebrow">MARKETPLACE STORES</span><h1>Trusted vendors</h1><p>Discover local stores and shop directly from verified sellers.</p></div>
        </div>
        {loading && <div className="empty-state"><h3>Loading vendors…</h3></div>}
        {!loading && vendors.length === 0 && <div className="empty-state"><h3>No vendors yet</h3><p>Verified vendor storefronts will appear here.</p></div>}
        {!loading && vendors.length > 0 && (
          <div className="vendor-grid vendor-page-grid">
            {vendors.map(v => (
              <Link to={`/vendors/${v.slug || v.id}`} className="vendor-card big" key={v.id}>
                {v.logoUrl ? <ProductImage className="vendor-avatar" src={v.logoUrl} alt="" /> : <div className="vendor-avatar">{(v.businessName || 'V')[0]}</div>}
                <div>
                  <b>{v.businessName}</b>
                  <small>{v.category || 'Business'} · {typeof v.location === 'string' ? v.location : (v.location?.city || 'Rwanda')}</small>
                  <span>★ {Number(v.ratingAvg || 0).toFixed(1)}</span>
                  {v.description && <small>{v.description}</small>}
                  <small>Verified seller · Rwanda</small>
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
