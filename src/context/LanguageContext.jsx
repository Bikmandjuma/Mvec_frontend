import { createContext, useContext } from 'react';

// Ikiguzi is English-only. This context is kept (rather than removed) so
// existing components can keep calling useLanguage()/t() without changes,
// but it no longer stores a language preference, offers a switcher, or
// rewrites page text, it always resolves to plain English.
const LanguageContext = createContext(null);

const translations = {
  home: 'Home', shop: 'Shop', forYou: 'For You', deals: 'Deals', vendors: 'Vendors',
  orders: 'Orders', allCategories: 'All Categories', search: 'Search', signIn: 'Sign in',
  becomeVendor: 'Become a vendor', help: 'Help & Support', shopNow: 'Shop now',
  startSelling: 'Start selling', viewAll: 'View all', cart: 'Cart', wishlist: 'Wishlist',
  addToCart: 'Add to cart', messages: 'Messages',
};

export function LanguageProvider({ children }) {
  const t = (key) => translations[key] || key;
  const value = { language: 'en', setLanguage: () => {}, t, translations: { en: translations } };
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const c = useContext(LanguageContext);
  if (!c) throw new Error('useLanguage must be used within LanguageProvider');
  return c;
}
