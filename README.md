# MVEC Marketplace — Upgraded Non-Escrow MVP

This version upgrades the existing MVEC frontend without replacing its visual design.

## Current settlement model

MVEC is **direct settlement / no escrow** for this MVP.

Buyer -> payment provider -> seller settlement -> seller fulfillment -> delivery proof -> order completion.

MVEC does not hold buyer funds in the frontend. Trust is supported by seller verification, reputation, delivery proof, reviews, disputes, audit records and marketplace enforcement.

## Added / upgraded

- Phone-first signup; email optional
- Buyer, Vendor, Supplier, Affiliate and Delivery Partner roles
- Role-based dashboards using the existing MVEC dashboard design
- Vendor product CRUD with full product details
- Vendor-owned product catalog persistence
- Vendor marketplace for finding suppliers
- Vendor affiliate marketing controls
- Supplier wholesale catalog with MOQ and bulk discounts
- Supplier B2B orders
- Affiliate links, conversions and commission views
- Delivery partner workflow and delivery proof concept
- Admin operations for suppliers, affiliates, deliveries, disputes and commissions
- Buyer order creation and persistent local order records
- Payment and order statuses kept separate
- Direct-settlement wording; no false escrow claims
- Buyer delivery confirmation and problem reporting
- Commission ledger fields and configurable commission rate
- Existing MVEC Alibaba-inspired blue design and normal CSS preserved
- Responsive/mobile-friendly additions

## Demo accounts

- Buyer: buyer@mvec.rw / Buyer@123
- Vendor: vendor@mvec.rw / Vendor@123
- Supplier: supplier@mvec.rw / Supplier@123
- Affiliate: affiliate@mvec.rw / Affiliate@123
- Delivery: (removed) / (removed)
- Admin: admin@mvec.rw / Admin@123

## Running locally

```bash
npm install
npm run dev
```

The supplied archive originally contained platform-specific/incomplete `node_modules`; the upgraded archive intentionally excludes `node_modules`. Install dependencies on the target machine before running.

## Production note

Payment-provider APIs, KYC/AML, commission settlement, refunds, delivery evidence storage and legal/compliance rules must be implemented and verified on the backend with the selected licensed providers before production.
