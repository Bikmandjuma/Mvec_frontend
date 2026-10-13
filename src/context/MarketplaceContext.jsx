import { createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { cartApi } from '../API/cart';
import { wishlistApi } from '../API/wishlist';
import { extractErrorMessage } from '../API/client';
import { resolveImageUrl } from '../utils/imageUrl';
import { useAuth } from './AuthContext';

const MarketplaceContext = createContext(null);

const GUEST_CART_KEY = 'mvec_cart';
const LEGACY_WISHLIST_KEY = 'mvec_wishlist';
const wishlistKey = (userId) => `mvec_wishlist_${userId}`;
const MAX_QTY = 100;

const readJson = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};
const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
};

const vendorNameOf = (vendor) => (vendor && typeof vendor === 'object'
  ? vendor.companyName || vendor.Fullname || vendor.fullName || vendor.businessName || vendor.name || 'MVEC Seller'
  : vendor || 'MVEC Seller');

const effectivePrice = (p) => {
  const price = Number(p?.price) || 0;
  const discount = Number(p?.discountPrice) || 0;
  return discount > 0 && discount < price ? discount : price;
};

// One cart line shape for the whole UI: { id, name, image, price, qty, stock, vendor, ... }.
// `qty` is the only quantity field; old guest carts stored `quantity`.
const fromGuestItem = (item) => ({
  ...item,
  id: String(item.id || item._id || ''),
  qty: Math.max(1, Number(item.qty ?? item.quantity) || 1),
  vendor: vendorNameOf(item.vendor),
});

const fromServerItem = (item) => {
  const prod = item?.product && typeof item.product === 'object' ? item.product : null;
  if (!prod) return null;
  return {
    id: String(prod._id || prod.id),
    name: prod.name || 'Product',
    image: resolveImageUrl(prod.media?.mainImage || prod.image || ''),
    price: Number(item.price) || effectivePrice(prod),
    qty: Math.max(1, Number(item.quantity) || 1),
    stock: Number(prod.stockQuantity) || 0,
    status: prod.status || 'ACTIVE',
    sku: prod.sku || '',
    vendor: vendorNameOf(prod.vendor),
    vendorId: String(prod.vendor?._id || prod.vendor || ''),
  };
};

const normalizeServerCart = (cart) => (Array.isArray(cart?.items) ? cart.items.map(fromServerItem).filter(Boolean) : []);

export function MarketplaceProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ? String(user.id) : null;

  const [cart, setCart] = useState(() => readJson(GUEST_CART_KEY).map(fromGuestItem));
  const [wishlist, setWishlist] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartNotice, setCartNotice] = useState('');
  const loadSeq = useRef(0);

  const loadCart = useCallback(async () => {
    if (authLoading) return;
    const seq = ++loadSeq.current;
    if (!userId) {
      setCart(readJson(GUEST_CART_KEY).map(fromGuestItem));
      return;
    }
    setCartLoading(true);
    try {
      // Move anything added while signed out into the account cart. Items
      // that cannot be added (sold out, own product…) are reported, and the
      // guest cart is cleared either way so they are not retried forever.
      const guestItems = readJson(GUEST_CART_KEY).map(fromGuestItem);
      const skipped = [];
      for (const item of guestItems) {
        try {
          if (item.id) await cartApi.add(item.id, Math.min(MAX_QTY, item.qty));
        } catch (err) {
          skipped.push(`${item.name || 'An item'}: ${extractErrorMessage(err)}`);
        }
      }
      if (guestItems.length) localStorage.removeItem(GUEST_CART_KEY);
      if (skipped.length) setCartNotice(`Some items could not be moved to your cart. ${skipped.join(' ')}`);

      const serverCart = await cartApi.get();
      if (seq === loadSeq.current) setCart(normalizeServerCart(serverCart));
    } catch (err) {
      // Keep what is on screen rather than pretending the cart is empty.
      if (seq === loadSeq.current) setCartNotice(`We could not load your cart. ${extractErrorMessage(err)}`);
    } finally {
      if (seq === loadSeq.current) setCartLoading(false);
    }
  }, [userId, authLoading]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  // Wishlist lives on the account, so it follows the buyer to every device.
  // Lists saved in this browser by older versions are merged in once.
  const fromServerWish = (w) => {
    const p = w.product || {};
    return {
      id: String(p._id || p.id),
      name: p.name || 'Product',
      image: resolveImageUrl(p.media?.mainImage || ''),
      vendor: vendorNameOf(p.vendor),
      price: effectivePrice(p),
      stock: Number(p.stockQuantity) || 0,
      status: p.status,
      savedPrice: Number(w.savedPrice) || 0,
      savedAt: w.savedAt,
    };
  };
  useEffect(() => {
    if (!userId) {
      setWishlist([]);
      return undefined;
    }
    let alive = true;
    const local = [...readJson(wishlistKey(userId)), ...readJson(LEGACY_WISHLIST_KEY)];
    const localIds = [...new Set(local.map((x) => String(x.id || x._id)).filter(Boolean))];
    const load = localIds.length ? wishlistApi.add(localIds) : wishlistApi.get();
    load
      .then((items) => {
        if (!alive) return;
        setWishlist(items.map(fromServerWish));
        localStorage.removeItem(wishlistKey(userId));
        localStorage.removeItem(LEGACY_WISHLIST_KEY);
      })
      .catch(() => alive && setWishlist(local.map((x) => ({ ...x, id: String(x.id || x._id) }))));
    return () => { alive = false; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveGuestCart = (next) => {
    writeJson(GUEST_CART_KEY, next);
    return next;
  };

  /** @returns {Promise<{ok: boolean, message: string}>} */
  const addToCart = useCallback(async (product, qty = 1) => {
    const id = String(product?.id || product?._id || '');
    const amount = Math.max(1, Math.min(MAX_QTY, Number(qty) || 1));
    if (!id) return { ok: false, message: 'This product cannot be added right now.' };
    const stock = Number(product.stock ?? product.stockQuantity);
    if (Number.isFinite(stock) && stock <= 0) return { ok: false, message: 'This product is out of stock.' };

    if (!userId) {
      let message = 'Added to your cart.';
      setCart((prev) => {
        const existing = prev.find((x) => x.id === id);
        const wanted = (existing?.qty || 0) + amount;
        const capped = Number.isFinite(stock) && stock > 0 ? Math.min(wanted, stock) : wanted;
        if (capped < wanted) message = `Only ${stock} available. Your cart has the maximum.`;
        const line = {
          id,
          name: product.name,
          image: product.image || '',
          price: Number(product.price) || 0,
          stock: Number.isFinite(stock) ? stock : undefined,
          sku: product.sku || '',
          vendor: vendorNameOf(product.vendor),
          vendorId: product.vendorId || '',
          qty: Math.min(capped, MAX_QTY),
        };
        return saveGuestCart(existing ? prev.map((x) => (x.id === id ? { ...x, ...line } : x)) : [...prev, line]);
      });
      return { ok: true, message };
    }

    try {
      const res = await cartApi.add(id, amount);
      setCart(normalizeServerCart(res?.cart));
      return { ok: true, message: 'Added to your cart.' };
    } catch (err) {
      return { ok: false, message: extractErrorMessage(err) };
    }
  }, [userId]);

  const removeFromCart = useCallback(async (id) => {
    const key = String(id);
    if (!userId) {
      setCart((prev) => saveGuestCart(prev.filter((x) => x.id !== key)));
      return { ok: true, message: '' };
    }
    try {
      const res = await cartApi.remove(key);
      setCart(normalizeServerCart(res?.cart));
      return { ok: true, message: '' };
    } catch (err) {
      return { ok: false, message: extractErrorMessage(err) };
    }
  }, [userId]);

  const updateCartQty = useCallback(async (id, qty) => {
    const key = String(id);
    const line = cart.find((x) => x.id === key);
    const max = Math.min(MAX_QTY, line?.stock > 0 ? line.stock : MAX_QTY);
    const next = Math.max(1, Math.min(max, Number(qty) || 1));
    if (line && next === line.qty) {
      return { ok: false, message: Number(qty) > max ? `Only ${max} available.` : '' };
    }
    if (!userId) {
      setCart((prev) => saveGuestCart(prev.map((x) => (x.id === key ? { ...x, qty: next } : x))));
      return { ok: true, message: '' };
    }
    try {
      const res = await cartApi.updateQuantity(key, next);
      setCart(normalizeServerCart(res?.cart));
      return { ok: true, message: '' };
    } catch (err) {
      return { ok: false, message: extractErrorMessage(err) };
    }
  }, [userId, cart]);

  const clearCart = useCallback(async () => {
    if (!userId) {
      localStorage.removeItem(GUEST_CART_KEY);
      setCart([]);
      return;
    }
    try {
      await cartApi.clear();
      setCart([]);
    } catch {
      // The server already empties the cart after checkout; nothing to do.
    }
  }, [userId]);

  const toggleWishlist = useCallback((product) => {
    if (!userId) return false;
    const id = String(product.id || product._id);
    const exists = wishlist.some((x) => String(x.id) === id);
    // Update the screen immediately, then sync with the account.
    setWishlist((prev) => (exists
      ? prev.filter((x) => String(x.id) !== id)
      : [...prev, { id, name: product.name, image: product.image || '', vendor: vendorNameOf(product.vendor), price: Number(product.price) || 0, savedPrice: Number(product.price) || 0, savedAt: new Date().toISOString() }]));
    (exists ? wishlistApi.remove(id) : wishlistApi.add([id]))
      .then((items) => setWishlist(items.map(fromServerWish)))
      .catch(() => setCartNotice('We could not update your wishlist. Please try again.'));
    return true;
  }, [userId, wishlist]); // eslint-disable-line react-hooks/exhaustive-deps

  const isWishlisted = useCallback((id) => wishlist.some((x) => String(x.id) === String(id)), [wishlist]);

  const clearWishlist = useCallback(() => {
    wishlist.forEach((x) => wishlistApi.remove(x.id).catch(() => {}));
    setWishlist([]);
  }, [wishlist]);

  const cartCount = useMemo(() => cart.reduce((n, x) => n + (Number(x.qty) || 1), 0), [cart]);
  const dismissCartNotice = useCallback(() => setCartNotice(''), []);

  const value = useMemo(() => ({
    cart,
    wishlist,
    cartCount,
    cartLoading,
    cartNotice,
    dismissCartNotice,
    wishlistCount: wishlist.length,
    addToCart,
    removeFromCart,
    updateCartQty,
    refreshCart: loadCart,
    toggleWishlist,
    isWishlisted,
    clearWishlist,
    clearCart,
  }), [cart, wishlist, cartCount, cartLoading, cartNotice, dismissCartNotice, addToCart, removeFromCart, updateCartQty, loadCart, toggleWishlist, isWishlisted, clearWishlist, clearCart]);

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

export const useMarketplace = () => useContext(MarketplaceContext);
