import { Link } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { PageHead } from "./seller/shared";

const STEPS = [
  ["Affiliates choose your products", "Approved affiliates pick products from the MVEC catalog to promote."],
  ["They share tracked links", "Each affiliate gets a unique link, so every sale is attributed correctly."],
  ["A buyer purchases", "The order is placed and paid through MVEC as usual."],
  ["Delivery is confirmed", "Commission is only earned once the buyer's delivery OTP is verified."],
  ["Commission is settled", "MVEC settles the affiliate commission according to platform rules."],
];

// Vendor-side affiliate controls (opt-in, custom rates, per-affiliate stats)
// are not exposed by the API yet, so this page explains the programme rather
// than showing figures.
export default function VendorAffiliate() {
  return <DashboardLayout>
    <PageHead eyebrow="MARKETING" title="Affiliate marketing"
      desc="MVEC affiliates and influencers can promote your active products and earn a commission on sales they bring in."
      action={<Link className="outline-btn" to="/vendor/products">Review my products</Link>} />
    <div className="verified-box">
      <b>Coming soon: affiliate reports for sellers</b>
      <p>Per-affiliate sales, commission settings and opt-out controls will appear here once they are available. Until then, affiliate-driven orders show up in your regular Orders and Transactions.</p>
    </div>
    <div className="data-card">
      <div className="data-card-head"><div><h3>How it works</h3><span>Commission is earned only on delivered orders</span></div></div>
      <div className="timeline">
        {STEPS.map(([title, text], i) => <div className="timeline-item done" key={title}><i /><div><b>{i + 1}. {title}</b><small>{text}</small></div></div>)}
      </div>
    </div>
  </DashboardLayout>;
}
