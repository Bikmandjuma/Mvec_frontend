// Only follow in-app paths after login, never an external URL
// ("//evil.com" or "https://…") passed in through ?next=.
export function safeRedirect(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return '';
  if (path.startsWith('/login') || path.startsWith('/signup')) return '';
  return path;
}

export const homeForRole = (role) =>
  ({ vendor: '/vendor', supplier: '/supplier', affiliate: '/affiliate', delivery: '/delivery', super_admin: '/admin' }[role] || '/');

// Where to go right after logging in or creating an account. Everyone except
// buyers goes straight to their dashboard (a link inside that dashboard, e.g.
// after a timed-out session, is kept). Buyers return to what they were doing.
export function afterSignIn(user, returnTo) {
  if (!user || user.role === 'buyer') return returnTo || '/';
  const home = homeForRole(user.role);
  if (home === '/') return '/';
  return returnTo && (returnTo === home || returnTo.startsWith(`${home}/`)) ? returnTo : home;
}
