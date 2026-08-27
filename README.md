# MVEC Seller Platform — Complete Frontend

React/Vite frontend for the MVEC multi-vendor marketplace, seller platform and admin control area.

## Run
```bash
npm install
npm run dev
```

## Main areas
- `/` Marketplace homepage
- `/shop` Paginated product marketplace
- `/vendors` Paginated vendor marketplace
- `/orders` Buyer orders
- `/orders/:id` Buyer order details, customer details and order history
- `/vendor` Seller dashboard
- `/vendor/stores`
- `/vendor/products`
- `/vendor/inventory`
- `/vendor/orders`
- `/vendor/orders/:id` Seller order/transaction detail
- `/vendor/customers`
- `/vendor/analytics`
- `/vendor/payouts`
- `/vendor/transactions`
- `/vendor/promotions`
- `/vendor/reviews`
- `/vendor/shipping`
- `/vendor/reports`
- `/vendor/notifications`
- `/vendor/team`
- `/vendor/settings`
- `/admin` Super Admin dashboard
- `/admin/users`, `/admin/vendors`, `/admin/products`, `/admin/categories`, `/admin/orders`, `/admin/transactions`, `/admin/payments`, `/admin/settings`

## Frontend functionality
- Responsive marketplace and dashboard layouts
- Seller-level module navigation
- Seller CRUD demo actions for stores, products, promotions and staff
- Inventory, orders, customers, reviews, shipping, reports and notifications screens
- Transaction list with pagination and transaction → order detail navigation
- Order detail view with order information, customer information, payment state and fulfillment history
- Reusable numbered pagination controls
- Marketplace pagination on homepage products/vendors, shop results, vendors and buyer orders
- Dashboard pagination on management tables
- Light/dark theme toggle persisted in localStorage
- MVEC sky-blue gradient branding and hover gradient
- Prepared for backend/API integration; current records are demo/local frontend state

## Important backend boundary
Frontend role checks are for navigation/UX only. Once APIs are connected, authorization, seller tenant isolation, payment verification, permissions and sensitive CRUD operations must be enforced by the backend/database layer.
