# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The Ikiguzi (MVEC) website: React 18 + Vite. It serves buyers, sellers (vendors), suppliers, affiliates, riders and admins. It talks to `../Mvec_backend` at `VITE_API_URL` (default `http://localhost:4000/api`). People see the name **Ikiguzi**.

## Commands

```bash
npm run dev      # Vite on :5173
npm run lint     # ESLint (0 errors expected; warnings are hook-dependency hints)
npm test         # node --test: plain-JS tests next to the code (*.test.js)
npm run build
```

## Layout

- `src/API/*.js`: one module per backend area, built on the axios `client` in `API/client.js`, which adds the token and gives errors plain words via `extractErrorMessage`.
- `src/pages/` holds the role dashboards: `VendorDashboard` (with `pages/seller/*`), `SupplierDashboard`, `AffiliateDashboard`, `RiderDashboard`, `AdminDashboard` and `AdminOps` (with `pages/admin/*`). `App.jsx` routes them behind `RequireAuth roles={...}`.
- **Loading data:** use `useLoader(key, load)` from `src/lib/useLoader.js`. It's react-query underneath (cached per key, refreshed in the background), and returns `{ data, loading, error, notFound, reload, setData }`. The key must name everything the load depends on. Older pages still load in `useEffect`. Move a page over when you touch it.
- `src/context/` holds sign-in, theme, language and the marketplace (cart, wishlist, catalog).
- `components/PinPicker.jsx` is the MapLibre map pin, using the free CARTO basemap. It's used for a store's pickup pin and the buyer's delivery pin. Rider delivery needs both.

## Rules

- The server decides prices, delivery fees, commission and which order step comes next. Show what it returns.
- Riders (`/delivery/*`, `RiderDashboard.jsx`) mirror the app. The board refreshes every 10 seconds. While online, the browser's position is sent at most every 4 s after moving 8 m, and at least every 15 s.
- Sellers confirm a hand-over with the buyer's 6-digit code (`components/DeliveryTracking.jsx`). They can't ship a parcel an Ikiguzi rider carries.
