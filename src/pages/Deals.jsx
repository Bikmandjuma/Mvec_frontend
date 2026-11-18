import { useQuery } from '@tanstack/react-query';
import Storefront from '../components/Storefront';
import ProductCard from '../components/ProductCard';
import { productsApi } from '../API/products';
import { mapBackendProduct } from '../services/catalogApi';

/** Flash deals: on now (ending soonest first), then the ones starting within a day. */
export default function Deals() {
  const { data, isPending, error } = useQuery({
    queryKey: ['deals'],
    queryFn: () => productsApi.deals(),
    refetchInterval: 60000,
  });
  const live = (data?.live || []).map(mapBackendProduct);
  const upcoming = (data?.upcoming || []).map(mapBackendProduct);
  return (
    <Storefront>
      <main className="catalog-page">
        <div className="catalog-head"><div><span className="eyebrow">FLASH DEALS</span><h1>Deals</h1><p>Limited-time prices on a limited number of units. When the timer ends or the units run out, the price goes back up.</p></div></div>
        {isPending && <div className="empty-state"><h3>Loading deals…</h3></div>}
        {error && <div className="form-error">We could not load today's deals. Refresh to try again.</div>}
        {!isPending && !error && !live.length && !upcoming.length && <div className="empty-state"><h3>No deals right now</h3><p>Check back soon: sellers add new deals every day.</p></div>}
        {live.length > 0 && <section><h2 className="deals-heading">On now</h2><div className="product-grid">{live.map((p) => <ProductCard key={p.id} p={p} />)}</div></section>}
        {upcoming.length > 0 && <section><h2 className="deals-heading">Starting soon</h2><div className="product-grid">{upcoming.map((p) => <ProductCard key={p.id} p={p} />)}</div></section>}
      </main>
    </Storefront>
  );
}
