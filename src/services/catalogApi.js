import { productsApi, categoriesApi, vendorsApi } from '../API';
import {
  products as mockProducts,
  categories as mockCategories,
  vendors as mockVendors,
} from '../data';
import { resolveImageUrl } from '../utils/imageUrl';

let cached = null;
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
    vendor: vendor.companyName || vendor.fullName || 'MVEC Seller',
    vendorId: vendor.id || p.vendorId || '',
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
    id: v.id || v.userId,
    name: v.businessName || 'Vendor',
    category: 'Marketplace vendor',
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

const toCache = (result) => ({
  ...result,
  products: result.backendProducts || [],
  categories: result.backendCategories || [],
  vendors: result.backendVendors || [],
});

export function loadCatalog(force = false) {
  if (cached && !force) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = (async () => {
    const [pRes, cRes, vRes] = await Promise.allSettled([
      productsApi.getAll(),
      categoriesApi.getAll(),
      vendorsApi.getAll(),
    ]);

    const backendProducts = pRes.status === 'fulfilled'
      ? (pRes.value.products || []).map(mapBackendProduct).filter(Boolean)
      : [];

    const backendCategories = cRes.status === 'fulfilled'
      ? (cRes.value.categories || []).map(mapBackendCategory).filter(Boolean)
      : [];

    const rawVendors = vRes.status === 'fulfilled'
      ? (vRes.value.data || vRes.value.vendors || [])
      : [];
    const backendVendors = rawVendors.map(mapBackendVendor).filter(Boolean);

    cached = toCache({ backendProducts, backendCategories, backendVendors });
    return cached;
  })()
    .catch(() => {
      cached = toCache({ backendProducts: [], backendCategories: [], backendVendors: [] });
      return cached;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function clearCatalogCache() {
  cached = null;
}

export function getProductById(productsList, id) {
  return (productsList || []).find((x) => String(x.id) === String(id)) || null;
}

export { mockProducts, mockCategories, mockVendors };
