// Only follow in-app paths after login, never an external URL
// ("//evil.com" or "https://…") passed in through ?next=.
export function safeRedirect(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return '';
  if (path.startsWith('/login') || path.startsWith('/signup')) return '';
  return path;
}

export const homeForRole = (role) =>
  ({ vendor: '/vendor', supplier: '/supplier', affiliate: '/affiliate', delivery: '/delivery', super_admin: '/admin' }[role] || '/');
