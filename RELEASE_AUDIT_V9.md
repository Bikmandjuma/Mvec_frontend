# MVEC Frontend v9 — Focused release update

## Marketplace homepage
- Added floating animation to the “Shop. Sell. Grow together.” hero title, including subtle floating accent marks.
- Replaced the text Messages navbar item with a notification bell in the header, positioned between Wishlist and Cart.
- Notification destination follows the signed-in role.
- User workspace links now use the single label “Dashboard”.

## Vendor supplier discovery
- Find Suppliers now includes live search, result count, pagination, and empty-state handling.
- Supplier order creation is marked as a supplier/B2B order and carries zero MVEC commission.

## Affiliate workspace
- Removed Delivery Tracking from affiliate navigation and routing.
- Wallet shows Total Earned first.
- Promote Products displays remaining stock for each product.
- Promote Products includes search, result count, and pagination.
- Creating an affiliate link exposes a Copy Link action beside the create button.
- My Links includes Amount Generated and a final total row.

## Supplier payments and settlement
- Removed MVEC commission from supplier payment displays.
- Supplier transaction rows use Supplier Settlement instead of fee/commission.
- Supplier settlement logic releases the full protected supplier amount.
- Supplier orders do not create MVEC commission ledger entries.
- Existing supplier transaction rows are normalized so stale fee fields are not rendered.

## Additional release check
- Fixed the supplier Team/Staff name field binding discovered during this pass.
- Parsed all 49 JavaScript/JSX source files with TypeScript JSX parsing: 0 syntax errors.
