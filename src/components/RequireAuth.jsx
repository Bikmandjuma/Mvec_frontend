import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { needsOnboarding } from './dashboard/RestrictedOverview';

export default function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="loading-screen">Loading MVEC…</div>;
  if (!user) return <Navigate to="/login" state={{ from: `${loc.pathname}${loc.search}` }} replace />;
  const isAdminActingAsSeller = user.role === 'super_admin' && user.isSellerEnabled && roles?.includes('vendor');
  if (roles && !roles.includes(user.role) && !isAdminActingAsSeller) {
    const home = { vendor: '/vendor', supplier: '/supplier', affiliate: '/affiliate', delivery: '/delivery', super_admin: '/admin' }[user.role] || '/';
    return <Navigate to={home} replace />;
  }
  if (roles?.includes(user.role) && needsOnboarding(user) && loc.pathname !== `/${user.role}`) return <Navigate to={`/${user.role}`} replace />;
  return children;
}
