# MVEC — Alibaba-style UI + Marketplace Frontend

This version starts from the previous `MVEC-frontend-alibaba-ui` project and keeps the previous authentication experience while adding the marketplace features requested on 26 Aug 2026.

## Run

```bash
npm install
npm run dev
```

## Important frontend/backend note

The project is frontend-only. Authentication API calls use:

`https://kwegereza-backend-production.up.railway.app/api`

Override it with a `.env` file if needed:

```env
VITE_API_URL=http://localhost:5000/api
```

The Google button, payment methods and OTP screens are UI flows until their real backend/payment providers are connected.

## Main routes

- `/` marketplace home
- `/shop` product marketplace + search + filters
- `/product/:id` product details, cart, wishlist, ratings/reviews
- `/cart` multi-vendor cart
- `/wishlist` saved products
- `/checkout` customer, delivery and payment selection
- `/payment/:id` payment state flow
- `/profile` buyer profile + multiple addresses
- `/orders` buyer orders
- `/vendors` vendor directory
- `/vendors/:id` vendor storefront
- `/vendor` vendor center
- `/admin` super-admin center
- `/login`, `/signup`, `/forgot-password` previous authentication flow

## Roles

Buyer: shopping, cart, wishlist, checkout, addresses, orders and reviews.

Vendor: buyer capabilities plus store/product management, inventory, vendor orders, analytics and category requests.

Super Admin: platform-wide user/vendor/product/category/payment/report/settings controls.
