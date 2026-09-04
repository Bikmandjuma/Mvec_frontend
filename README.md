# MVEC Marketplace

MVEC is a Rwanda-focused multi-party marketplace connecting buyers, vendors, suppliers and affiliate marketers through one marketplace platform.

## Current settlement model

The current marketplace flow uses protected settlement:

Buyer → payment → MVEC protected transaction → vendor/supplier fulfillment → delivery confirmation → settlement release.

The application records payment, order, delivery, settlement and commission states separately so each transaction can be followed from start to finish.

## Marketplace roles

- Buyer
- Vendor
- Supplier
- Affiliate marketer
- Super Admin
- Delivery operations

Buyer access is phone-first and guest-friendly. Email is optional for normal shopping.

## Main marketplace features

- Product marketplace, categories, search and filters
- Vendor stores and verified seller information
- Supplier wholesale marketplace
- Minimum order quantities and bulk discounts
- Vendor-to-supplier supply orders
- Cart and phone-first checkout
- Protected settlement workflow
- Delivery tracking and delivery proof
- Refunds and disputes
- Product, vendor, supplier and delivery reviews
- Affiliate links, conversions, commissions and wallet withdrawals
- RWF 10,000 minimum affiliate withdrawal
- Buyer ad-removal subscription
- Vendor subscription and advertising tools
- Recommendations and supplier matching
- Fraud and risk monitoring
- Internal transaction-linked messaging
- Centralized notifications
- Financial ledger and auditable transaction records
- Configurable commission rules by platform, category, vendor type, vendor, product and promotion
- Centralized pricing calculation and stored order pricing snapshots
- Rwanda location and delivery rules
- English, Kinyarwanda and French language support
- Admin analytics, reports, trust controls and audit logs
- Search and pagination on marketplace tables
- Responsive desktop, tablet and mobile layouts

## Order identification

Every new order receives a unique human-readable ID containing the primary product name.

Example:

`MVEC-WIRELESS-NOISE-CANCELLING-HEADPHONES-2026-000001-4821`

Every order also receives a transaction ID such as:

`MVEC-TXN-2026-000001-4821`

Financial events are stored in the marketplace ledger and can be traced back to the order and transaction.

## Pricing

Customer-facing checkout shows the final total. Internal users with the appropriate access can see the settlement calculation, including:

- Base product price
- Delivery allocation
- Discount
- MVEC commission
- Affiliate commission
- Vendor settlement

Commission rates are configurable rather than hard-coded.

## Communication

Messages are linked to the relevant order or supply transaction. Examples:

`MVEC-WIRELESS-NOISE-CANCELLING-HEADPHONES-2026-000001-4821`

or

`SUP-2026-1001`

This keeps buyer-vendor and vendor-supplier conversations connected to the transaction they concern.

## Languages

The marketplace supports:

- English
- Kinyarwanda
- French

Translation keys are centralized so additional languages can be added without changing page components.

## Development access

- Buyer: `buyer@mvec.rw` / `Buyer@123`
- Vendor: `vendor@mvec.rw` / `Vendor@123`
- Supplier: `supplier@mvec.rw` / `Supplier@123`
- Affiliate: `affiliate@mvec.rw` / `Affiliate@123`
- Admin: `admin@mvec.rw` / `Admin@123`

Delivery access is provisioned separately from development seed accounts.

## Running locally

```bash
npm install
npm run dev
```

## API integration points

The current application keeps marketplace workflows separated from provider-specific services so production services can be connected without redesigning the pages.

The main integration areas are:

- Authentication and OTP
- Payment collection
- Protected settlement
- Vendor and supplier payouts
- SMS and notifications
- Delivery tracking
- Maps and location services
- File and image storage
- KYC and verification
- Refund processing
- Analytics

Until those services are connected, the application keeps its transaction state and workflow locally for local development.

## Production requirements

Before handling real transactions, connect the appropriate regulated payment and settlement services, backend authorization, database, KYC/AML processes, delivery integrations, secure file storage and production notification services.
