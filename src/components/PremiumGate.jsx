import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { client } from "../API/client";
import { useAuth } from "../context/AuthContext";

// Shows its content when the account may use `feature`. While MVEC's paid
// plans are off (the default) everyone may use everything, so this only
// matters after an admin switches the subscription program on.
let cached = null;
export function usePlan() {
  const [plan, setPlan] = useState(cached);
  useEffect(() => {
    let alive = true;
    client.get("/plans/me").then((r) => { cached = r.data; if (alive) setPlan(r.data); }).catch(() => alive && setPlan({ entitlements: { features: {} }, failed: true }));
    return () => { alive = false; };
  }, []);
  return plan;
}

export default function PremiumGate({ feature, title, children }) {
  const plan = usePlan();
  const { user } = useAuth();
  if (!plan) return <div className="empty-state"><h3>Loading…</h3></div>;
  // If the plan can't be loaded, don't lock anyone out; the server still checks.
  if (plan.failed || plan.entitlements?.features?.[feature] !== false) return children;
  const base = user?.role === "supplier" ? "/supplier" : "/vendor";
  return <div className="data-card empty-state premium-gate">
    <span className="eyebrow">SELLER PREMIUM</span>
    <h2>{title || "This is a Premium tool"}</h2>
    <p>{plan.premiumFeatures?.[feature] || "This tool"} is part of Seller Premium.</p>
    <Link className="gradient-btn" to={`${base}/subscription`}>See plans</Link>
  </div>;
}
