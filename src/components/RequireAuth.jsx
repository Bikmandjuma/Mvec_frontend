import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function RequireAuth({ children, roles }) { const { user, loading }=useAuth(); const loc=useLocation(); if(loading)return <div className="page-loading">Loading MVEC...</div>; if(!user)return <Navigate to="/login" replace state={{from:loc.pathname}}/>; if(roles && !roles.includes(user.role)) return <Navigate to="/" replace/>; return children; }
