import { createContext, useContext, useMemo, useState } from 'react';

const MarketplaceContext = createContext(null);
const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };

export function MarketplaceProvider({ children }) {
  const [cart, setCart] = useState(read('mvec_cart'));
  const [wishlist, setWishlist] = useState(read('mvec_wishlist'));
  const persist = (key, value, setter) => { setter(value); localStorage.setItem(key, JSON.stringify(value)); };
  const addToCart = (product, qty = 1) => {
    const existing = cart.findIndex(x => String(x.id) === String(product.id));
    const next = existing >= 0 ? cart.map((x,i) => i === existing ? {...x, qty:(x.qty || 1) + qty} : x) : [...cart, {...product, qty}];
    persist('mvec_cart', next, setCart);
  };
  const removeFromCart = (id) => persist('mvec_cart', cart.filter(x => String(x.id) !== String(id)), setCart);
  const updateCartQty = (id, qty) => persist('mvec_cart', cart.map(x => String(x.id) === String(id) ? {...x, qty:Math.max(1,qty)} : x), setCart);
  const toggleWishlist = (product) => {
    const exists = wishlist.some(x => String(x.id) === String(product.id));
    const next = exists ? wishlist.filter(x => String(x.id) !== String(product.id)) : [...wishlist, product];
    persist('mvec_wishlist', next, setWishlist);
    return !exists;
  };
  const isWishlisted = (id) => wishlist.some(x => String(x.id) === String(id));
  const clearWishlist = () => persist('mvec_wishlist', [], setWishlist);
  const value = useMemo(() => ({cart,wishlist,cartCount:cart.reduce((n,x)=>n+(Number(x.qty)||1),0),wishlistCount:wishlist.length,addToCart,removeFromCart,updateCartQty,toggleWishlist,isWishlisted,clearWishlist}), [cart,wishlist]);
  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}
export const useMarketplace = () => useContext(MarketplaceContext);
