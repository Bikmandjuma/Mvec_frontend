import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Storefront from '../components/Storefront';
import { loadCatalog } from '../services/catalogApi';
import Icon from '../components/Icon';
import Pagination from '../components/Pagination';
import SponsoredProducts from '../components/SponsoredProducts';
import ProductCard from '../components/ProductCard';

const PER_PAGE = 12;

export default function Shop() {
  // Filters live in the URL so header search, category links, "Deals" and the
  // back button all work, and a filtered page can be shared.
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const cat = params.get('category') || '';
  const dealsOnly = params.get('deal') === 'true';
  const inStockOnly = params.get('stock') === '1';
  const sort = params.get('sort') || 'newest';
  // Optional price range from the URL. Empty means no limit in that direction.
  const minPrice = Math.max(0, Number(params.get('min')) || 0);
  const maxPrice = Math.max(0, Number(params.get('max')) || 0);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const ref = params.get('ref');

  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchText, setSearchText] = useState(q);

  const [priceDraft, setPriceDraft] = useState({ min: params.get('min') || '', max: params.get('max') || '' });
  useEffect(() => { setSearchText(q); }, [q]);
  useEffect(() => { setPriceDraft({ min: params.get('min') || '', max: params.get('max') || '' }); }, [params]);

  useEffect(() => {
    let mounted = true;
    loadCatalog().then((res) => {
      if (!mounted) return;
      setCatalog(res.products || []);
      setCategories((res.categories || []).map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean));
      setLoadError(Boolean(res.error));
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined || value === false) next.delete(key);
      else next.set(key, String(value));
    });
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  const applyPrice = (e) => {
    e?.preventDefault();
    const clean = (v) => (Number(v) > 0 ? String(Math.floor(Number(v))) : '');
    let min = clean(priceDraft.min);
    let max = clean(priceDraft.max);
    if (min && max && Number(min) > Number(max)) [min, max] = [max, min];
    update({ min, max });
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = catalog.filter((p) =>
      (!cat || p.category === cat) &&
      (!dealsOnly || p.oldPrice > p.price) &&
      (!inStockOnly || p.stock > 0) &&
      (!needle || `${p.name} ${p.brand} ${p.vendor} ${p.sku} ${p.category} ${p.description}`.toLowerCase().includes(needle)) &&
      (!minPrice || p.price >= minPrice) &&
      (!maxPrice || p.price <= maxPrice),
    );
    const sorters = {
      'price-low': (a, b) => a.price - b.price,
      'price-high': (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
    };
    // "newest" keeps the API order (newest first); sold-out items go last.
    const sorted = sorters[sort] ? [...list].sort(sorters[sort]) : list;
    return [...sorted.filter((p) => p.stock > 0), ...sorted.filter((p) => !(p.stock > 0))];
  }, [q, cat, dealsOnly, inStockOnly, sort, minPrice, maxPrice, catalog]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const productLink = (id) => (ref ? `/product/${id}?ref=${encodeURIComponent(ref)}` : `/product/${id}`);
  const hasFilters = Boolean(q || cat || dealsOnly || inStockOnly || minPrice || maxPrice);

  return <Storefront><main className="catalog-page">
    <div className="catalog-head">
      <div>
        <span className="eyebrow">MVEC MARKETPLACE</span>
        <h1>{dealsOnly ? 'Deals' : cat || 'Shop products'}</h1>
        <p>{q ? `Results for “${q}”` : 'Search by name, SKU, brand, category or vendor.'}</p>
      </div>
      <form className="catalog-search" role="search" onSubmit={(e) => { e.preventDefault(); update({ q: searchText.trim() }); }}>
        <Icon name="search" />
        <input value={searchText} onChange={(e) => setSearchText(e.target.value)} onBlur={() => searchText.trim() !== q && update({ q: searchText.trim() })} placeholder="Search the marketplace…" aria-label="Search products" maxLength={100} />
      </form>
    </div>
    <div className="catalog-layout">
      <aside className="filter-panel">
        <h3>Filters</h3>
        <label>Category
          <select value={cat} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <form className="price-range" onSubmit={applyPrice}>
          <span>Price (RWF)</span>
          <div>
            <input type="number" min="0" inputMode="numeric" placeholder="Min" aria-label="Minimum price" value={priceDraft.min} onChange={(e) => setPriceDraft({ ...priceDraft, min: e.target.value })} />
            <span aria-hidden="true">–</span>
            <input type="number" min="0" inputMode="numeric" placeholder="No limit" aria-label="Maximum price" value={priceDraft.max} onChange={(e) => setPriceDraft({ ...priceDraft, max: e.target.value })} />
          </div>
          <button type="submit" className="outline-btn">Apply</button>
        </form>
        <label className="filter-check"><input type="checkbox" checked={dealsOnly} onChange={(e) => update({ deal: e.target.checked ? 'true' : '' })} /> On sale only</label>
        <label className="filter-check"><input type="checkbox" checked={inStockOnly} onChange={(e) => update({ stock: e.target.checked ? '1' : '' })} /> In stock only</label>
        {hasFilters && <button type="button" className="outline-btn" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}
      </aside>
      <section className="catalog-results">
        <div className="results-toolbar">
          <span>{loading ? 'Loading…' : `${filtered.length} product${filtered.length === 1 ? '' : 's'}`}</span>
          <select value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })} aria-label="Sort products">
            <option value="newest">Newest</option>
            <option value="rating">Top rated</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </div>
        {!loading && page === 1 && <SponsoredProducts surface={q ? 'search' : cat ? 'category' : 'shop'} q={q} category={cat} catalog={catalog} limit={4} title={q ? `Sponsored results for “${q}”` : cat ? `Sponsored in ${cat}` : 'Sponsored products'} />}
        {loadError && <div className="form-alert error">We could not load products right now. Please refresh the page.</div>}
        {loading && <div className="empty-state"><h3>Loading products…</h3></div>}
        {!loading && (
          <div className="product-grid">
            {shown.map((p) => <ProductCard key={p.id} p={p} href={productLink(p.id)} label={p.vendor} />)}
          </div>
        )}
        {!loading && !filtered.length && !loadError && <div className="empty-state"><h3>No products found</h3><p>Try another search or remove a filter.</p></div>}
        {filtered.length > PER_PAGE && <Pagination page={currentPage} setPage={(n) => update({ page: n > 1 ? n : '' })} total={filtered.length} perPage={PER_PAGE} />}
      </section>
    </div>
  </main></Storefront>;
}
