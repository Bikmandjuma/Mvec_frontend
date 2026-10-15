import { productsApi, categoriesApi, vendorsApi } from '../API';
import { resolveImageUrl } from '../utils/imageUrl';

// The storefront catalogue is shared by the header search, home, shop and
// product pages. It is cached briefly so pages do not refetch on every
// navigation, but prices and stock are refreshed every few minutes and right
// after an order is placed (clearCatalogCache).
const CACHE_TTL_MS = 5 * 60 * 1000;
let cached = null;
let cachedAt = 0;
let inflight = null;

const PLACEHOLDER_IMG =
  'https://placehold.co/600x600?text=MVEC+Product';

export function mapBackendProduct(p) {
  if (!p) return null;
  const vendor = p.vendor || {};
  const category = p.category || {};
  const rawPrice = Number(p.price || 0);
  const discountPrice = Number(p.discountPrice || 0);
  const activePrice = discountPrice > 0 && discountPrice < rawPrice ? discountPrice : rawPrice;
  const media = p.media || {};
  const productAttributes = p.attributes || {};
  const gallery = Array.isArray(media.gallery) ? media.gallery : Array.isArray(p.gallery) ? p.gallery : [];
  const mainImage = resolveImageUrl(media.mainImage || p.mainImage || gallery[0]) || PLACEHOLDER_IMG;
  return {
    // API mutations and reviews use Mongo's ObjectId. publicId is a display
    // identifier and is not accepted by Product.findById().
    id: p._id || p.id || p.publicId,
    publicId: p.publicId || "",
    name: p.name || '',
    category: category.name || (typeof p.category === 'string' ? p.category : 'Uncategorized'),
    brand: p.brand || '',
    vendor: vendor.companyName || vendor.Fullname || vendor.fullName || 'MVEC Seller',
    vendorId: String(vendor._id || vendor.id || (typeof p.vendor === 'string' ? p.vendor : '') || p.vendorId || ''),
    price: activePrice,
    oldPrice: discountPrice > 0 && discountPrice < rawPrice ? rawPrice : 0,
    rating: Number(p.averageRating) || 0,
    reviews: Number(p.reviewCount) || 0,
    stock: Number(p.stockQuantity || 0),
    sku: p.sku || '',
    image: mainImage,
    gallery: gallery.map(resolveImageUrl),
    description: p.description || p.shortDescription || '',
    status: p.status || 'ACTIVE',
    slug: p.slug || '',
    attributes: {
      Color: productAttributes.color || p.color || '',
      Size: productAttributes.size || p.size || '',
      Material: productAttributes.material || p.material || '',
      Weight: productAttributes.weight || p.weight || '',
      Capacity: productAttributes.capacity || p.capacity || '',
      Model: productAttributes.model || p.model || '',
    },
  };
}

export function mapBackendVendor(v) {
  if (!v) return null;
  return {
    // `id` is the store id used in /vendors/:id; `userId` is the vendor's
    // account id, which is what products reference.
    id: String(v.id || v._id || ''),
    userId: String(v.userId || v.user || ''),
    name: v.businessName || 'Vendor',
    category: v.category || '',
    products: 0,
    rating: Number(v.ratingAvg) || 0,
    slug: v.slug || '',
    logoUrl: v.logoUrl || '',
    bannerUrl: v.bannerUrl || '',
    status: v.status || 'ACTIVE',
  };
}

export function mapBackendCategory(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name || '',
    slug: c.slug || '',
    imageUrl: c.imageUrl || '',
    description: c.description || '',
  };
}

// Count each vendor's live products and use their most common category when
// the store has not set one, so the home page shows real numbers.
function withVendorStats(vendors, products) {
  return vendors.map((v) => {
    const own = products.filter((p) => p.vendorId && p.vendorId === v.userId);
    const counts = own.reduce((acc, p) => ({ ...acc, [p.category]: (acc[p.category] || 0) + 1 }), {});
    const topCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    return { ...v, products: own.length, category: v.category || topCategory || 'Marketplace store' };
  });
}

export function loadCatalog(force = false) {
  if (cached && !force && Date.now() - cachedAt < CACHE_TTL_MS) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = (async () => {
    const [pRes, cRes, vRes] = await Promise.allSettled([
      productsApi.getAll(),
      categoriesApi.getAll(),
      vendorsApi.getAll({ pageSize: 100 }),
    ]);

    const products = pRes.status === 'fulfilled'
      ? (pRes.value.products || []).map(mapBackendProduct).filter((p) => p && p.id)
      : [];
    const categories = cRes.status === 'fulfilled'
      ? (cRes.value.categories || []).map(mapBackendCategory).filter((c) => c && c.name)
      : [];
    const rawVendors = vRes.status === 'fulfilled' ? (vRes.value.data || vRes.value.vendors || []) : [];
    const vendors = withVendorStats(rawVendors.map(mapBackendVendor).filter((v) => v && v.id), products);

    const result = { products, categories, vendors, error: pRes.status === 'rejected' };
    // Never cache a failed load: the next page visit should try again.
    if (!result.error) {
      cached = result;
      cachedAt = Date.now();
    }
    return result;
  })()
    .catch(() => ({ products: [], categories: [], vendors: [], error: true }))
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function clearCatalogCache() {
  cached = null;
  cachedAt = 0;
}

export function getProductById(productsList, id) {
  return (productsList || []).find((x) => String(x.id) === String(id)) || null;
}

