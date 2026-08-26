import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Shop from './pages/Shop';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import Payment from './pages/Payment';
import Profile from './pages/Profile';
import Orders from './pages/Orders';
import Vendors from './pages/Vendors';
import VendorDetail from './pages/VendorDetail';
import VendorDashboard from './pages/VendorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import RequireAuth from './components/RequireAuth';

export default function App() {
  return <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/shop" element={<Shop />} />
    <Route path="/product/:id" element={<ProductDetails />} />
    <Route path="/vendors" element={<Vendors />} />
    <Route path="/vendors/:id" element={<VendorDetail />} />
    <Route path="/cart" element={<RequireAuth><Cart /></RequireAuth>} />
    <Route path="/wishlist" element={<RequireAuth><Wishlist /></RequireAuth>} />
    <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
    <Route path="/payment/:id" element={<RequireAuth><Payment /></RequireAuth>} />
    <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
    <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
    <Route path="/vendor" element={<RequireAuth roles={['vendor']}><VendorDashboard /></RequireAuth>} />
    <Route path="/admin" element={<RequireAuth roles={['super_admin']}><AdminDashboard /></RequireAuth>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
