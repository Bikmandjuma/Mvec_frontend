// Shared navigation item definitions, used by both the desktop sidebar
// (DashboardLayout) and the mobile app-style bottom navigation
// (MobileBottomNav) so the two stay perfectly in sync.
// Shape: [href, label, iconName]

export const sellerNav = [['/vendor','Dashboard','grid'],['/vendor/stores','My Stores','shop'],['/vendor/products','Products','box'],['/vendor/categories','Categories','tag'],['/vendor/inventory','Inventory','grid'],['/vendor/orders','Orders','cart'],['/vendor/purchases','Purchases','receipt'],['/vendor/quotes','Quote Requests','receipt'],['/vendor/customers','Customers','users'],['/vendor/analytics','Analytics','chart'],['/vendor/payouts','Payouts','wallet'],['/vendor/transactions','Transactions','wallet'],['/vendor/suppliers','Find Suppliers','shop'],['/vendor/affiliates','Affiliate Marketing','users'],['/vendor/advertisements','Advertisements','tag'],['/vendor/promotions','Promotions','tag'],['/vendor/subscription','Subscription','wallet'],['/vendor/reviews','Reviews','heart'],['/vendor/refunds','Refunds','wallet'],['/vendor/shipping','Shipping','shop'],['/vendor/delivery','Delivery & Settlement','box'],['/vendor/reports','Reports','chart'],['/vendor/messages','Messages','users'],['/vendor/notifications','Notifications','bell'],['/vendor/team','Team / Staff','users'],['/vendor/settings','Settings','settings'],['/vendor/support','MVEC Support','bell']];

export const adminNav = [['/admin','Overview','grid'],['/admin/become-seller','Become a Seller','shop'],['/admin/analytics','Analytics','chart'],['/admin/trust','Trust Scores','chart'],['/admin/users','Users','users'],['/admin/vendors','Sellers','shop'],['/admin/suppliers','Suppliers','shop'],['/admin/affiliates','Affiliates','users'],['/admin/products','Products','box'],['/admin/categories','Categories','tag'],['/admin/orders','Orders','cart'],['/admin/deliveries','Deliveries','box'],['/admin/disputes','Disputes','bell'],['/admin/payments','Payments','wallet'],['/admin/vendor-payouts','Seller Payouts','wallet'],['/admin/transfers','Refunds & Withdrawals','wallet'],['/admin/commissions','MVEC Earnings','wallet'],['/admin/commission-rules','Commission Rules','tag'],['/admin/ledger','Financial Ledger','wallet'],['/admin/advertising','Advertising','tag'],['/admin/subscriptions','Subscriptions','wallet'],['/admin/risk','Fraud & Risk','bell'],['/admin/audit-logs','Audit Log','box'],['/admin/settings','Settings','settings'],['/admin/messages','Messages','users'],['/admin/notifications','Notifications','bell'],['/admin/support','Support Inbox','bell']];

// Grouped version of the admin sidebar: a short list of always-visible top
// links, then collapsible categories each holding their sub-links. Built
// from the exact same [href,label,icon] tuples as adminNav above. Every page
// here reads live data; pages with badges show work waiting for an admin.
export const adminNavGroups = [
  {
    label: 'Overview',
    items: [['/admin','Overview','grid'],['/admin/become-seller','Become a Seller','shop']],
  },
  {
    label: 'People & Stores',
    items: [['/admin/vendors','Sellers','shop'],['/admin/suppliers','Suppliers','shop'],['/admin/affiliates','Affiliates','users'],['/admin/users','Users','users']],
  },
  {
    label: 'Orders',
    items: [['/admin/orders','Orders','cart'],['/admin/deliveries','Deliveries','box'],['/admin/disputes','Disputes','bell']],
  },
  {
    label: 'Money',
    items: [['/admin/payments','Payments','wallet'],['/admin/vendor-payouts','Seller Payouts','wallet'],['/admin/transfers','Refunds & Withdrawals','wallet'],['/admin/commissions','MVEC Earnings','wallet'],['/admin/commission-rules','Commission Rules','tag'],['/admin/ledger','Financial Ledger','wallet']],
  },
  {
    label: 'Catalog',
    items: [['/admin/products','Products','box'],['/admin/categories','Categories','tag']],
  },
  {
    label: 'Growth',
    items: [['/admin/advertising','Advertising','tag'],['/admin/subscriptions','Subscriptions','wallet']],
  },
  {
    label: 'Insights',
    items: [['/admin/analytics','Analytics','chart'],['/admin/trust','Trust Scores','chart'],['/admin/risk','Fraud & Risk','bell']],
  },
  {
    label: 'Platform',
    items: [['/admin/settings','Settings','settings'],['/admin/audit-logs','Audit Log','box']],
  },
  {
    label: 'Communication',
    items: [['/admin/messages','Messages','users'],['/admin/notifications','Notifications','bell'],['/admin/support','Support Inbox','bell']],
  },
];

export const supplierNav = [['/supplier','Dashboard','grid'],['/supplier/products','Wholesale Products','box'],['/supplier/inventory','Inventory','grid'],['/supplier/orders','Orders','cart'],['/supplier/quotes','Quote Requests','receipt'],['/supplier/analytics','Analytics','chart'],['/supplier/payments','Payments','wallet'],['/supplier/transactions','Transactions','wallet'],['/supplier/reports','Reports','chart'],['/supplier/reviews','Reviews','heart'],['/supplier/messages','Messages','users'],['/supplier/team','Team / Staff','users'],['/supplier/notifications','Notifications','bell'],['/supplier/settings','Settings','settings'],['/supplier/support','MVEC Support','bell']];

export const affiliateNav = [['/affiliate','Dashboard','grid'],['/affiliate/messages','Messages','users'],['/affiliate/products','Promote Products','box'],['/affiliate/links','My Links','tag'],['/affiliate/commissions','Commissions','chart'],['/affiliate/wallet','Wallet','wallet'],['/affiliate/withdrawals','Withdrawals','wallet'],['/affiliate/notifications','Notifications','bell'],['/affiliate/profile','Profile','user'],['/affiliate/support','MVEC Support','bell']];

export const deliveryNav = [['/delivery','Dashboard','grid'],['/delivery/deliveries','My Deliveries','box'],['/delivery/history','Delivered','chart'],['/delivery/messages','Messages','users'],['/delivery/support','MVEC Support','bell'],['/profile','My Account','user']];

// Compact 4-icon "primary" set shown directly in the mobile bottom bar for
// each dashboard role, before the 5th "More" icon. Kept short and to the
// point (Dashboard, the role's core listing, Orders/Wallet, Messages).
export const mobilePrimaryByRole = {
  vendor: ['/vendor','/vendor/products','/vendor/orders','/vendor/payouts'],
  super_admin: ['/admin','/admin/vendors','/admin/orders','/admin/ledger'],
  supplier: ['/supplier','/supplier/products','/supplier/orders','/supplier/payments'],
  affiliate: ['/affiliate','/affiliate/links','/affiliate/wallet','/affiliate/withdrawals'],
  delivery: ['/delivery','/delivery/deliveries','/delivery/history','/delivery/messages'],
};

export function navForRole(role){
  return role==='supplier'?supplierNav:role==='affiliate'?affiliateNav:role==='delivery'?deliveryNav:role==='super_admin'?adminNav:sellerNav;
}

// Grouped versions of every other role's sidebar, in the exact same shape as
// adminNavGroups above (organized from the same flat tuples, nothing added
// or removed).
export const sellerNavGroups = [
  { label: 'Overview', items: [['/vendor','Dashboard','grid']] },
  { label: 'Store', items: [['/vendor/stores','My Stores','shop'],['/vendor/products','Products','box'],['/vendor/categories','Categories','tag'],['/vendor/inventory','Inventory','grid'],['/vendor/shipping','Shipping','shop']] },
  { label: 'Orders & Customers', items: [['/vendor/orders','Orders','cart'],['/vendor/purchases','Purchases','receipt'],['/vendor/quotes','Quote Requests','receipt'],['/vendor/customers','Customers','users'],['/vendor/delivery','Delivery & Settlement','box'],['/vendor/refunds','Refunds','wallet']] },
  { label: 'Finance', items: [['/vendor/payouts','Payouts','wallet'],['/vendor/transactions','Transactions','wallet'],['/vendor/subscription','Subscription','wallet']] },
  { label: 'Growth', items: [['/vendor/suppliers','Find Suppliers','shop'],['/vendor/affiliates','Affiliate Marketing','users'],['/vendor/advertisements','Advertisements','tag'],['/vendor/promotions','Promotions','tag'],['/vendor/reviews','Reviews','heart'],['/vendor/reports','Reports','chart'],['/vendor/analytics','Analytics','chart']] },
  { label: 'Team & Settings', items: [['/vendor/team','Team / Staff','users'],['/vendor/settings','Settings','settings']] },
  { label: 'Support', items: [['/vendor/messages','Messages','users'],['/vendor/notifications','Notifications','bell'],['/vendor/support','MVEC Support','bell']] },
];

export const supplierNavGroups = [
  { label: 'Overview', items: [['/supplier','Dashboard','grid']] },
  { label: 'Catalog & Orders', items: [['/supplier/products','Wholesale Products','box'],['/supplier/inventory','Inventory','grid'],['/supplier/orders','Orders','cart'],['/supplier/quotes','Quote Requests','receipt']] },
  { label: 'Finance & Insights', items: [['/supplier/payments','Payments','wallet'],['/supplier/transactions','Transactions','wallet'],['/supplier/analytics','Analytics','chart'],['/supplier/reports','Reports','chart'],['/supplier/reviews','Reviews','heart'],['/supplier/subscription','Subscription','tag']] },
  { label: 'Team & Settings', items: [['/supplier/team','Team / Staff','users'],['/supplier/settings','Settings','settings']] },
  { label: 'Support', items: [['/supplier/messages','Messages','users'],['/supplier/notifications','Notifications','bell'],['/supplier/support','MVEC Support','bell']] },
];

export const affiliateNavGroups = [
  { label: 'Overview', items: [['/affiliate','Dashboard','grid']] },
  { label: 'Promotion', items: [['/affiliate/products','Promote Products','box'],['/affiliate/links','My Links','tag']] },
  { label: 'Earnings', items: [['/affiliate/commissions','Commissions','chart'],['/affiliate/wallet','Wallet','wallet'],['/affiliate/withdrawals','Withdrawals','wallet']] },
  { label: 'Account', items: [['/affiliate/profile','Profile','user']] },
  { label: 'Support', items: [['/affiliate/messages','Messages','users'],['/affiliate/notifications','Notifications','bell'],['/affiliate/support','MVEC Support','bell']] },
];

export const deliveryNavGroups = [
  { label: 'Overview', items: [['/delivery','Dashboard','grid']] },
  { label: 'Work', items: [['/delivery/deliveries','My Deliveries','box'],['/delivery/history','Delivered','chart']] },
  { label: 'Support', items: [['/delivery/messages','Messages','users'],['/delivery/support','MVEC Support','bell'],['/profile','My Account','user']] },
];

// ─── PERMISSION-AWARE NAVIGATION ─────────────────────────────────────────────
// Team/staff members must only see the sections they are allowed to use.
// Backend is always the authority (checkStaffPermission / supplier team roles);
// this only keeps the sidebar honest so members are not pointed at 403s.

// Vendor staff permission required per section (Staff.permissions keys).
const VENDOR_SECTION_PERMISSIONS = {
  '/vendor/products': 'canManageProducts',
  '/vendor/inventory': 'canManageProducts',
  '/vendor/categories': 'canManageProducts',
  '/vendor/promotions': 'canManageProducts',
  '/vendor/orders': 'canManageOrders',
  '/vendor/purchases': 'canManageOrders',
  '/vendor/quotes': 'canManageOrders',
  '/vendor/customers': 'canManageOrders',
  '/vendor/refunds': 'canManageOrders',
  '/vendor/delivery': 'canManageOrders',
  '/vendor/payouts': 'canManagePayouts',
  '/vendor/transactions': 'canManagePayouts',
  '/vendor/analytics': 'canViewAnalytics',
  '/vendor/reports': 'canViewAnalytics',
  '/vendor/team': 'canManageStaff',
  '/vendor/stores': 'canManageSettings',
  '/vendor/shipping': 'canManageSettings',
  '/vendor/settings': 'canManageSettings',
  '/vendor/advertisements': 'canManageSettings',
  '/vendor/subscription': 'canManageSettings',
};

// Supplier team role capabilities — mirrors the backend CAPABILITIES_BY_ROLE.
const SUPPLIER_ROLE_CAPABILITIES = {
  OPERATIONS: ['catalog', 'supply', 'analytics'],
  WAREHOUSE: ['supply'],
  FULFILMENT: ['supply'],
  FINANCE: ['finance', 'analytics'],
  VIEWER: [],
};

const SUPPLIER_SECTION_CAPABILITIES = {
  '/supplier/products': 'catalog',
  '/supplier/inventory': 'catalog',
  '/supplier/orders': 'supply',
  '/supplier/quotes': 'supply',
  '/supplier/payments': 'finance',
  '/supplier/team': 'team',
  '/supplier/settings': 'profile',
};

function visibleGroups(groups, isVisible) {
  return groups
    .map((group) => ({ ...group, items: group.items.filter(isVisible) }))
    .filter((group) => group.items.length > 0);
}

function filterGroupsForUser(groups, role, user) {
  if (!user) return groups;
  if (role === 'vendor' && user.isVendorStaff && user.permissionsMap) {
    return visibleGroups(groups, ([href]) => {
      const needed = VENDOR_SECTION_PERMISSIONS[href];
      return !needed || user.permissionsMap[needed] === true;
    });
  }
  if (role === 'supplier' && user.supplierTeamRole) {
    const capabilities = SUPPLIER_ROLE_CAPABILITIES[user.supplierTeamRole] || [];
    return visibleGroups(groups, ([href]) => {
      const needed = SUPPLIER_SECTION_CAPABILITIES[href];
      return !needed || capabilities.includes(needed);
    });
  }
  return groups;
}

export function navGroupsForRole(role, admin, user){
  if (admin) return adminNavGroups;
  if (role==='supplier') return filterGroupsForUser(supplierNavGroups, role, user);
  if (role==='affiliate') return affiliateNavGroups;
  if (role==='delivery') return deliveryNavGroups;
  return filterGroupsForUser(sellerNavGroups, role, user);
}
