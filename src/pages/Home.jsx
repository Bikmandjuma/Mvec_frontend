import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Pagination from "../components/Pagination";
import { loadCatalog } from "../services/catalogApi";
import Storefront from "../components/Storefront";
import Icon from "../components/Icon";
import ProductImage from "../components/ProductImage";
import ProductCard from "../components/ProductCard";
import { useAuth } from "../context/AuthContext";
import { money, ratingLabel } from "../utils/format";

const PRODUCTS_PER_PAGE = 8;
const VENDORS_PER_PAGE = 4;
const CATEGORY_ICONS = ["▦", "▣", "▤", "◉", "⌂", "✦", "◈", "◍"];

function SkeletonGrid({ count = 4 }) {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <div className="product-card skeleton-card" key={i} />)}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [productPage, setProductPage] = useState(1);
  const [vendorPage, setVendorPage] = useState(1);
  const [catalog, setCatalog] = useState({ products: [], categories: [], vendors: [] });
  const [status, setStatus] = useState("loading"); // loading | ready | error

  const load = useCallback((force = false) => {
    setStatus("loading");
    return loadCatalog(force).then((cat) => {
      setCatalog(cat);
      setStatus(cat.error ? "error" : "ready");
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    loadCatalog().then((cat) => {
      if (!mounted) return;
      setCatalog(cat);
      setStatus(cat.error ? "error" : "ready");
    });
    return () => { mounted = false; };
  }, []);

  const { products, vendors } = catalog;
  const inStock = products.filter((p) => p.stock > 0);
  // Popular = best rated with the most reviews; ties keep newest first.
  const popular = [...products].sort((a, b) => (b.rating * Math.log1p(b.reviews)) - (a.rating * Math.log1p(a.reviews)));
  const shownProducts = popular.slice((productPage - 1) * PRODUCTS_PER_PAGE, productPage * PRODUCTS_PER_PAGE);
  const shownVendors = vendors.slice((vendorPage - 1) * VENDORS_PER_PAGE, vendorPage * VENDORS_PER_PAGE);
  const heroProducts = (inStock.length ? inStock : products).slice(0, 6);
  const deals = products.filter((p) => p.oldPrice > p.price && p.stock > 0);
  const bannerProducts = (deals.length ? deals : products).slice(0, 4);
  // Only categories that actually have products get a home-page section.
  const categoryNames = catalog.categories.map((c) => (typeof c === "string" ? c : c.name)).filter(Boolean);
  const populatedCategories = categoryNames.filter((c) => products.some((p) => p.category === c));
  const loading = status === "loading";
  const sellerHome = { vendor: "/vendor", supplier: "/supplier", affiliate: "/affiliate", super_admin: "/admin" }[user?.role];

  return (
    <Storefront>
      <main className="home-page">
        <section className="hero-market hero-modern">
          <div className="hero-copy hero-enter-left">
            <span className="eyebrow">MVEC MARKETPLACE</span>
            <h1 className="hero-animated-title">
              <span>Shop.</span> <span>Sell.</span>
              <br />
              <em>Grow together.</em>
              <i className="hero-title-spark spark-one" aria-hidden="true">✦</i>
              <i className="hero-title-spark spark-two" aria-hidden="true">✦</i>
            </h1>
            <p>Products from trusted sellers across Rwanda.</p>
            <div className="hero-buttons">
              <Link to="/shop" className="gradient-btn">
                Shop now <Icon name="arrow" size={17} />
              </Link>
              <Link to={sellerHome || "/signup"} state={sellerHome ? undefined : { role: "vendor" }} className="outline-btn">
                {sellerHome ? "Go to dashboard" : "Start selling"}
              </Link>
            </div>
            <div className="trust-row">
              <span>✓ Verified sellers</span>
              <span>✓ Payment held until delivery</span>
              <span>✓ Mobile money</span>
            </div>
          </div>
          <div className="hero-visual dynamic-product-stage hero-enter-right">
            <div className="visual-glow" />
            {loading && <div className="hero-product-card hero-product-0 skeleton-card" aria-hidden="true" />}
            {heroProducts.map((p, i) => (
              <Link key={p.id} to={`/product/${p.id}`} className={`hero-product-card hero-product-${i}`}>
                <ProductImage src={p.image} alt={p.name} />
                <span>{p.name}</span>
                <b>{money(p.price)}</b>
              </Link>
            ))}
          </div>
        </section>

        {status === "error" && (
          <div className="form-alert error home-alert" role="alert">
            We could not load the marketplace right now. Check your connection and try again.{" "}
            <button type="button" className="text-btn" onClick={() => load(true)}>Retry</button>
          </div>
        )}

        {products.length > 0 && (
          <section className="moving-products" aria-label="Featured products">
            <div className="moving-track">
              {[...products.slice(0, 12), ...products.slice(0, 12)].map((p, i) => (
                <Link
                  to={`/product/${p.id}`}
                  key={`${p.id}-${i}`}
                  className="moving-product"
                  // The second copy only exists for the seamless scroll effect.
                  aria-hidden={i >= Math.min(products.length, 12) ? "true" : undefined}
                  tabIndex={i >= Math.min(products.length, 12) ? -1 : undefined}
                >
                  <ProductImage src={p.image} alt="" />
                  <span>{p.name}</span>
                  <b>{money(p.price)}</b>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="category-strip">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SHOP BY CATEGORY</span>
              <h2>Find what you need</h2>
            </div>
            <Link to="/shop">View all →</Link>
          </div>
          <div className="category-grid">
            {categoryNames.map((c, i) => {
              const count = products.filter((p) => p.category === c).length;
              return (
                <Link key={c} to={`/shop?category=${encodeURIComponent(c)}`} className="category-tile">
                  <span className="cat-icon" aria-hidden="true">{CATEGORY_ICONS[i % CATEGORY_ICONS.length]}</span>
                  <b>{c}</b>
                  <small>{count ? `${count} product${count === 1 ? "" : "s"}` : "Coming soon"}</small>
                </Link>
              );
            })}
            {categoryNames.length === 0 && !loading && (
              <p className="tiny">Categories will appear here once they're added to the marketplace.</p>
            )}
          </div>
        </section>

        <section className="product-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TRENDING NOW</span>
              <h2>Popular products</h2>
            </div>
            <Link to="/shop">View all products →</Link>
          </div>
          {loading ? <SkeletonGrid count={8} /> : (
            <>
              <div className="product-grid">
                {shownProducts.map((p) => <ProductCard key={p.id} p={p} />)}
              </div>
              {products.length === 0 && status === "ready" && (
                <div className="empty-state"><h3>No products yet</h3><p>Sellers are setting up their stores. Check back soon.</p></div>
              )}
              {products.length > PRODUCTS_PER_PAGE && (
                <Pagination page={productPage} setPage={setProductPage} total={products.length} perPage={PRODUCTS_PER_PAGE} />
              )}
            </>
          )}
        </section>

        {populatedCategories.map((category) => (
          <section className="product-section category-products-section" key={category}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">{category.toUpperCase()}</span>
                <h2>{category}</h2>
              </div>
              <Link to={`/shop?category=${encodeURIComponent(category)}`}>More {category} →</Link>
            </div>
            <div className="product-grid">
              {products.filter((p) => p.category === category).slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          </section>
        ))}

        {bannerProducts.length > 0 && (
          <section className="visual-banner">
            <div>
              <span className="eyebrow">MVEC DEAL DAYS</span>
              <h2>
                More products.
                <br />
                Less searching.
              </h2>
              <p>{deals.length ? `${deals.length} product${deals.length === 1 ? " is" : "s are"} on sale right now.` : "Explore products from verified sellers."}</p>
              <Link to={deals.length ? "/shop?deal=true" : "/shop"} className="gradient-btn">
                {deals.length ? "Shop deals" : "Browse the shop"}
              </Link>
            </div>
            <div className="banner-image-stack">
              {bannerProducts.map((p, i) => (
                <Link key={p.id} to={`/product/${p.id}`} className={`banner-product banner-${i}`} aria-label={p.name}>
                  <ProductImage src={p.image} alt={p.name} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {vendors.length > 0 && (
          <section className="product-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">TOP STORES</span>
                <h2>Trusted vendors</h2>
              </div>
              <Link to="/vendors">View all stores →</Link>
            </div>
            <div className="vendor-grid">
              {shownVendors.map((v) => (
                <Link to={`/vendors/${v.id}`} className="vendor-card" key={v.id}>
                  {v.logoUrl
                    ? <ProductImage className="vendor-avatar" src={v.logoUrl} alt="" />
                    : <div className="vendor-avatar" aria-hidden="true">{(v.name || "V").charAt(0)}</div>}
                  <div>
                    <b>{v.name}</b>
                    <small>{v.category}</small>
                    <span>
                      ★ {ratingLabel(v.rating)} · {v.products} product{v.products === 1 ? "" : "s"}
                    </span>
                  </div>
                  <Icon name="arrow" size={17} />
                </Link>
              ))}
            </div>
            {vendors.length > VENDORS_PER_PAGE && (
              <Pagination page={vendorPage} setPage={setVendorPage} total={vendors.length} perPage={VENDORS_PER_PAGE} />
            )}
          </section>
        )}
      </main>
    </Storefront>
  );
}
