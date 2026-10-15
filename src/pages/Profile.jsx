import { Navigate } from 'react-router-dom';
import Storefront from '../components/Storefront';
import { useAuth } from '../context/AuthContext';
import AccountSettings from './account/AccountSettings';

// Portal users manage their account inside their own portal.
export const PORTAL_PROFILE = { vendor: '/vendor/profile', super_admin: '/admin/profile', supplier: '/supplier/profile', affiliate: '/affiliate/profile', delivery: '/delivery/profile' };

export default function Profile() {
  const { user } = useAuth();
  const portal = PORTAL_PROFILE[user?.role];
  if (portal) return <Navigate to={`${portal}${window.location.hash}`} replace />;
  return <Storefront><main className="account-page"><AccountSettings /></main></Storefront>;
}
