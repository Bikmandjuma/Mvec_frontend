import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import DeliveryTracking from "./components/DeliveryTracking";
import DashboardLayout from "./components/DashboardLayout";
import NotificationPanel from "./components/NotificationPanel";
import MobileBottomNav from "./components/MobileBottomNav";
import AffiliateRedirect from "./components/AffiliateRedirect";
import { ReferralCapture } from "./services/referral";
// Each page loads on demand, so the first visit downloads only what it shows.
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetails = lazy(() => import("./pages/ProductDetails"));
const Cart = lazy(() => import("./pages/Cart"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Payment = lazy(() => import("./pages/Payment"));
const Profile = lazy(() => import("./pages/Profile"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const Vendors = lazy(() => import("./pages/Vendors"));
const VendorDetail = lazy(() => import("./pages/VendorDetail"));
const VendorDashboard = lazy(() => import("./pages/VendorDashboard"));
const SupplierDashboard = lazy(() => import("./pages/SupplierDashboard"));
const AffiliateDashboard = lazy(() => import("./pages/AffiliateDashboard"));
const DeliveryDashboard = lazy(() => import("./pages/DeliveryDashboard"));
const PlatformOperations = lazy(() => import("./pages/PlatformOperations"));
const VendorNetwork = lazy(() => import("./pages/VendorNetwork"));
const VendorAffiliate = lazy(() => import("./pages/VendorAffiliate"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const BecomeSeller = lazy(() => import("./pages/BecomeSeller"));
const SellerOrderDetail = lazy(() => import("./pages/SellerOrderDetail"));
const AdminTransfers = lazy(() => import("./pages/AdminTransfers"));
const VendorPayoutsAdmin = lazy(() => import("./pages/admin/VendorPayoutsAdmin"));
const AccountSettings = lazy(() => import("./pages/account/AccountSettings"));
const AdvertisingAdmin = lazy(() => import("./pages/admin/AdvertisingAdmin"));
const FeaturePages = lazy(() => import("./pages/FeaturePages"));
const AdminDisputesPage = lazy(() => import("./pages/FeaturePages").then((m) => ({ default: m.AdminDisputesPage })));
const VendorQuotes = lazy(() => import("./pages/Wholesale").then((m) => ({ default: m.VendorQuotes })));
const AdminVendors = lazy(() => import("./pages/AdminOps").then((m) => ({ default: m.AdminVendors })));
const AdminSuppliers = lazy(() => import("./pages/AdminOps").then((m) => ({ default: m.AdminSuppliers })));
const AdminPaymentsPage = lazy(() => import("./pages/AdminOps").then((m) => ({ default: m.AdminPaymentsPage })));
const AdminEarnings = lazy(() => import("./pages/AdminOps").then((m) => ({ default: m.AdminEarnings })));
const AdminLedgerPage = lazy(() => import("./pages/AdminOps").then((m) => ({ default: m.AdminLedgerPage })));
const AdminAnalyticsPage = lazy(() => import("./pages/AdminOps").then((m) => ({ default: m.AdminAnalyticsPage })));
const AdminRisk = lazy(() => import("./pages/AdminOps").then((m) => ({ default: m.AdminRisk })));
const AdminTrust = lazy(() => import("./pages/AdminOps").then((m) => ({ default: m.AdminTrust })));
const AdminSubscriptionsPage = lazy(() => import("./pages/AdminOps").then((m) => ({ default: m.AdminSubscriptionsPage })));
const AdminPlatform = lazy(() => import("./pages/AdminOps").then((m) => ({ default: m.AdminPlatform })));
const AdminAuditLog = lazy(() => import("./pages/AdminOps").then((m) => ({ default: m.AdminAuditLog })));
const AdminCommissionRules = lazy(() => import("./pages/AdminOps").then((m) => ({ default: m.AdminCommissionRules })));
const AdminSupportInbox = lazy(() => import("./pages/AdminOps").then((m) => ({ default: m.AdminSupportInbox })));
const CommunicationPage = lazy(() => import("./pages/ExtendedModules").then((m) => ({ default: m.CommunicationPage })));

function DashboardDelivery({ role }) {
  return (
    <DashboardLayout admin={role === "admin"}>
      <DeliveryTracking role={role} />
    </DashboardLayout>
  );
}
export default function App() {
  return (
    <>
    <ReferralCapture />
    <Suspense fallback={<div className="loading-screen">Loading MVEC…</div>}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/product/:id" element={<ProductDetails />} />
      <Route path="/vendors" element={<Vendors />} />
      <Route path="/vendors/:id" element={<VendorDetail />} />
      <Route path="/cart" element={<Cart />} />
      <Route
        path="/wishlist"
        element={
          <RequireAuth>
            <Wishlist />
          </RequireAuth>
        }
      />
      <Route path="/checkout" element={<Checkout />} />
      <Route
        path="/payment/:id"
        element={
          <RequireAuth>
            <Payment />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route
        path="/orders"
        element={
          <RequireAuth>
            <Orders />
          </RequireAuth>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <RequireAuth>
            <OrderDetails />
          </RequireAuth>
        }
      />
      <Route path="/buyer/compare" element={<FeaturePages role="buyer" />} />
      <Route
        path="/buyer/recommendations"
        element={<FeaturePages role="buyer" />}
      />
      <Route
        path="/buyer/refunds"
        element={
          <RequireAuth>
            <FeaturePages role="buyer" />
          </RequireAuth>
        }
      />
      <Route path="/buyer/support" element={<FeaturePages role="buyer" />} />
      <Route
        path="/buyer/messages"
        element={
          <RequireAuth>
            <CommunicationPage role="buyer" />
          </RequireAuth>
        }
      />
      <Route
        path="/buyer/notifications"
        element={
          <RequireAuth>
            <FeaturePages role="buyer" />
          </RequireAuth>
        }
      />
      <Route
        path="/buyer/subscription"
        element={
          <RequireAuth roles={["buyer"]}>
            <FeaturePages role="buyer" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/support"
        element={
          <RequireAuth roles={["vendor"]}>
            <FeaturePages role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/support"
        element={
          <RequireAuth roles={["supplier"]}>
            <FeaturePages role="supplier" />
          </RequireAuth>
        }
      />
      <Route
        path="/affiliate/support"
        element={
          <RequireAuth roles={["affiliate"]}>
            <FeaturePages role="affiliate" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/messages"
        element={
          <RequireAuth roles={["super_admin"]}>
            <CommunicationPage role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/support"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminSupportInbox />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/become-seller"
        element={
          <RequireAuth roles={["super_admin"]}>
            <BecomeSeller />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/purchases"
        element={
          <RequireAuth roles={["vendor"]}>
            <FeaturePages role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/quotes"
        element={
          <RequireAuth roles={["vendor"]}>
            <DashboardLayout><VendorQuotes /></DashboardLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/refunds"
        element={
          <RequireAuth roles={["vendor"]}>
            <FeaturePages role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/messages"
        element={
          <RequireAuth roles={["vendor"]}>
            <CommunicationPage role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/delivery"
        element={
          <RequireAuth roles={["vendor"]}>
            <DashboardDelivery role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/suppliers"
        element={
          <RequireAuth roles={["vendor"]}>
            <VendorNetwork />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/affiliates"
        element={
          <RequireAuth roles={["vendor"]}>
            <VendorAffiliate />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/orders/:id"
        element={
          <RequireAuth roles={["vendor"]}>
            <SellerOrderDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/*"
        element={
          <RequireAuth roles={["vendor"]}>
            <VendorDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/supply-requests"
        element={
          <Navigate to="/supplier/quotes" replace />
        }
      />
      <Route
        path="/supplier/transactions"
        element={
          <RequireAuth roles={["supplier"]}>
            <FeaturePages role="supplier" />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/messages"
        element={
          <RequireAuth roles={["supplier"]}>
            <CommunicationPage role="supplier" />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/reviews"
        element={
          <RequireAuth roles={["supplier"]}>
            <FeaturePages role="supplier" />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/delivery"
        element={
          <Navigate to="/supplier/orders" replace />
        }
      />
      <Route
        path="/supplier/*"
        element={
          <RequireAuth roles={["supplier"]}>
            <SupplierDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/affiliate/notifications"
        element={
          <RequireAuth roles={["affiliate"]}>
            <DashboardLayout>
              <NotificationPanel
                role="affiliate"
                recipient="affiliate@mvec.rw"
              />
            </DashboardLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/affiliate/messages"
        element={
          <RequireAuth roles={["affiliate"]}>
            <CommunicationPage role="affiliate" />
          </RequireAuth>
        }
      />
      <Route
        path="/affiliate/*"
        element={
          <RequireAuth roles={["affiliate"]}>
            <AffiliateDashboard />
          </RequireAuth>
        }
      />
      <Route path="/track/:code" element={<AffiliateRedirect />} />
      <Route
        path="/delivery/messages"
        element={
          <RequireAuth roles={["delivery"]}>
            <CommunicationPage role="delivery" />
          </RequireAuth>
        }
      />
      <Route
        path="/delivery/support"
        element={
          <RequireAuth roles={["delivery"]}>
            <FeaturePages role="delivery" />
          </RequireAuth>
        }
      />
      <Route
        path="/delivery/*"
        element={
          <RequireAuth roles={["delivery"]}>
            <DeliveryDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/payments"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminPaymentsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/refunds"
        element={
          <Navigate to="/admin/disputes" replace />
        }
      />
      <Route
        path="/admin/advertising"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdvertisingAdmin />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/subscriptions"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminSubscriptionsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/languages"
        element={
          <Navigate to="/admin/settings" replace />
        }
      />
      <Route
        path="/admin/locations"
        element={
          <Navigate to="/admin/settings" replace />
        }
      />
      <Route
        path="/admin/security"
        element={
          <Navigate to="/admin/settings" replace />
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminAuditLog />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/notifications"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/recommendations"
        element={
          <Navigate to="/admin/analytics" replace />
        }
      />
      <Route
        path="/admin/matching"
        element={
          <Navigate to="/admin/suppliers" replace />
        }
      />
      <Route
        path="/admin/trust"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminTrust />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/system"
        element={
          <Navigate to="/admin/settings" replace />
        }
      />
      <Route
        path="/admin/transfers"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminTransfers />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/transactions"
        element={
          <Navigate to="/admin/payments" replace />
        }
      />
      <Route
        path="/admin/orders/:id"
        element={
          <RequireAuth roles={["super_admin"]}>
            <SellerOrderDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/suppliers"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminSuppliers />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/affiliates"
        element={
          <RequireAuth roles={["super_admin"]}>
            <PlatformOperations type="affiliates" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/deliveries"
        element={
          <RequireAuth roles={["super_admin"]}>
            <DashboardDelivery role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/disputes"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminDisputesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/commissions"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminEarnings />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminAnalyticsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/profile"
        element={
          <RequireAuth roles={["vendor"]}>
            <DashboardLayout><AccountSettings eyebrow="SELLER PLATFORM" /></DashboardLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/profile"
        element={
          <RequireAuth roles={["super_admin"]}>
            <DashboardLayout admin><AccountSettings eyebrow="ADMIN CONTROL" /></DashboardLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/profile"
        element={
          <RequireAuth roles={["supplier"]}>
            <DashboardLayout><AccountSettings eyebrow="SUPPLIER PORTAL" /></DashboardLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/delivery/profile"
        element={
          <RequireAuth roles={["delivery"]}>
            <DashboardLayout><AccountSettings eyebrow="DELIVERY PORTAL" /></DashboardLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/vendor-payouts"
        element={
          <RequireAuth roles={["super_admin"]}>
            <VendorPayoutsAdmin />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/ledger"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminLedgerPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/commission-rules"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminCommissionRules />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/risk"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminRisk />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/supplier-acquisition"
        element={
          <Navigate to="/admin/suppliers" replace />
        }
      />
      <Route
        path="/admin/vendor-acquisition"
        element={
          <Navigate to="/admin/vendors" replace />
        }
      />
      <Route
        path="/admin/vendors"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminVendors />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminPlatform />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <Navigate to="/admin/analytics" replace />
        }
      />
      <Route
        path="/admin/*"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    <MobileBottomNav />
    </>
  );
}
