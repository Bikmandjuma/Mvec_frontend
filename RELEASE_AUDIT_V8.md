# MVEC Frontend Release Audit — v8

This release is the frontend release candidate intended to connect to the production backend/API.

## Corrected
- Vendor product creation/editing opens inside the seller workspace; both Add product entry points use the same editor flow.
- Product fields persist on save, including media, attributes, pricing, stock and publishing state.
- Product Archive and Restore are reversible.
- Seller analytics and overview figures respond to the selected period.
- Orders and inventory use different operational datasets and fields.
- Supplier wholesale product forms and dashboard navigation scroll correctly on short screens.
- Affiliate wallet and withdrawals are separate views with distinct data and actions.
- Admin account identity fields are view-only.
- Admin refunds, notifications, recommendations, supplier matching, trust, security and system administration use distinct datasets and contextual actions.
- Tables support search, status/category filtering where applicable, pagination and CSV export.
- Delivery records include status filtering and CSV export.
- Authentication-page language selection is functional.
- Affiliate notifications have a dedicated page.
- Dashboard sidebars, long forms and modals are independently scrollable.
- Action buttons use consistent MVEC styling and contextual labels.

## Backend/API handoff
The frontend keeps the existing local state and service layer as the integration boundary. Replace the local persistence/service implementations with API calls for authentication, products, inventory, orders, payments, settlement, delivery, refunds, reviews, subscriptions, notifications, trust, recommendations, matching, analytics and reporting.
