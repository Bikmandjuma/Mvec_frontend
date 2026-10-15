// Which permission each seller page needs when a staff member is signed in.
// The server enforces the same rules; this only hides what they can't use.
const RULES = [
  ['/vendor/team', 'canManageStaff'],
  ['/vendor/settings', 'canManageSettings'],
  ['/vendor/stores', 'canManageSettings'],
  ['/vendor/shipping', 'canManageSettings'],
  ['/vendor/products', 'canManageProducts'],
  ['/vendor/categories', 'canManageProducts'],
  ['/vendor/inventory', 'canManageProducts'],
  ['/vendor/purchases', 'canManageProducts'],
  ['/vendor/suppliers', 'canManageProducts'],
  ['/vendor/orders', 'canManageOrders'],
  ['/vendor/customers', 'canManageOrders'],
  ['/vendor/delivery', 'canManageOrders'],
  ['/vendor/refunds', 'canManageOrders'],
  ['/vendor/payouts', 'canManagePayouts'],
  ['/vendor/transactions', 'canManagePayouts'],
  ['/vendor/subscription', 'canManagePayouts'],
  ['/vendor/affiliates', 'canManageMarketing'],
  ['/vendor/advertisements', 'canManageMarketing'],
  ['/vendor/promotions', 'canManageMarketing'],
  ['/vendor/reviews', 'canManageMarketing'],
  ['/vendor/reports', 'canViewAnalytics'],
  ['/vendor/analytics', 'canViewAnalytics'],
];

export const STAFF_ROLE_LABEL = {
  STORE_MANAGER: 'Store manager',
  ORDER_MANAGER: 'Order manager',
  CATALOG_MANAGER: 'Catalog manager',
  MARKETING_MANAGER: 'Marketing manager',
  FINANCE_MANAGER: 'Finance manager',
};

export function permissionForPath(pathname) {
  return RULES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'))?.[1] || null;
}

// Owners (non-staff) can open everything.
export function staffCan(user, pathname) {
  if (!user?.isStaff) return true;
  const key = permissionForPath(pathname);
  return !key || user.permissionsMap?.[key] === true;
}
