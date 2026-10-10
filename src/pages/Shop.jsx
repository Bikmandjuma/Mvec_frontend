import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Storefront from '../components/Storefront';
import { loadCatalog } from '../services/catalogApi';
import Icon from '../components/Icon';
import Pagination from '../components/Pagination';
import ProductImage from '../components/ProductImage';

const money = n => new Intl.NumberFormat('en-RW').format(Number(n) || 0) + ' RWF';

export default function Shop() {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(params.get('category') || '');
  const [sort, setSort] = useState('featured');
  const [max, setMax] = useState(1000000);
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const productLink = (id) => ref ? `/product/${id}?ref=${ref}` : `/product/${id}`;

  useEffect(() => {
    let mounted = true;
    loadCatalog().then(res => {
      if (!mounted) return;
      setCatalog(res.products || []);
      setCategories((res.categories || []).map(c => (typeof c === 'string' ? c : c.name)).filter(Boolean));
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => catalog.filter(p =>
    (!cat || p.category === cat) &&
    (!q || `${p.name} ${p.brand} ${p.vendor} ${p.sku} ${p.description}`.toLowerCase().includes(q.toLowerCase())) &&
    p.price <= max
  ).sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : sort === 'rating' ? b.rating - a.rating : 0), [q, cat, sort, max, catalog]);

  return <Storefront><main className="catalog-page">
    <div className="catalog-head">
      <div><span className="eyebrow">MVEC MARKETPLACE</span><h1>Shop products</h1><p>Search by name, SKU, brand, category or vendor.</p></div>
      <div className="catalog-search"><Icon name="search" /><input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search the marketplace…" /></div>
    </div>
    <div className="catalog-layout">
      <aside className="filter-panel">
        <h3>Filters</h3>
        <label>Category
          <select value={cat} onChange={e => { setCat(e.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Maximum price<input type="range" min="20000" max="1000000" step="10000" value={max} onChange={e => { setMax(+e.target.value); setPage(1); }} /><b>{money(max)}</b></label>
      </aside>
      <section className="catalog-results">
        <div className="results-toolbar">
          <span>{filtered.length} products</span>
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}>
            <option value="featured">Featured</option>
            <option value="rating">Top rated</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </div>
        {loading && <div className="empty-state"><h3>Loading products…</h3></div>}
        {!loading && (
          <div className="product-grid">
            {filtered.slice((page - 1) * 8, page * 8).map(p => (
              <div className="product-card" key={String(p.id)}>
                <Link to={productLink(p.id)} className="product-img">
                  <ProductImage src={p.image} alt={p.name} />
                  {p.oldPrice ? <span className="sale-badge">SALE</span> : null}
                </Link>
                <div className="product-info">
                  <small>{p.vendor}</small>
                  <Link to={productLink(p.id)} className="product-name">{p.name}</Link>
                  <div className="rating">★ {p.rating} <span>({p.reviews})</span></div>
                  <b>{money(p.price)}</b> {p.oldPrice ? <del>{money(p.oldPrice)}</del> : null}
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} setPage={setPage} total={filtered.length} perPage={8} />
        {!loading && !filtered.length && <div className="empty-state"><h3>No products found</h3><p>Try another search or remove a filter.</p></div>}
      </section>
    </div>
  </main></Storefront>;
}
