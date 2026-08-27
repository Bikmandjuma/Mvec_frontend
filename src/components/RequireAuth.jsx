import { Navigate,useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function RequireAuth({children,roles}){const {user,loading}=useAuth();const loc=useLocation();if(loading)return <div className="loading-screen">Loading MVEC…</div>;if(!user)return <Navigate to="/login" state={{from:loc.pathname}} replace/>;if(roles&&!roles.includes(user.role)) return <Navigate to={user.role==='vendor'?'/vendor':user.role==='super_admin'?'/admin':'/'} replace/>;return children;}
