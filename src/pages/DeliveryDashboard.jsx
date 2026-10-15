import { useLocation } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import DeliveryTracking from "../components/DeliveryTracking";

function Overview() {
  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">DELIVERY</span>
          <h1>Delivery dashboard</h1>
          <p>Pick up assigned parcels, deliver them and confirm with the buyer's code.</p>
        </div>
      </div>
      <div className="verified-box">
        <b>Delivery confirmation</b>
        <p>When you hand the items to the buyer, ask for the 6-digit code shown on their order and sent to them by SMS. The correct code completes the delivery and releases the seller's payment. Five wrong codes lock the delivery for MVEC support.</p>
      </div>
      <DeliveryTracking role="delivery" />
    </>
  );
}

export default function DeliveryDashboard() {
  const path = useLocation().pathname;
  return (
    <DashboardLayout>
      {path.includes("/deliveries") ? <DeliveryTracking role="delivery" /> : path.includes("/history") ? <DeliveryTracking role="delivery" initialTab="done" /> : <Overview />}
    </DashboardLayout>
  );
}
