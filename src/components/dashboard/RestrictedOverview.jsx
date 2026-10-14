import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import OnboardingModal from "../onboarding/OnboardingModal";

export function needsOnboarding(user) { return ["vendor", "supplier"].includes(user?.role) && user?.isOnboarded === false; }

export default function RestrictedOverview({ children }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (user?.role === "vendor" && user?.verificationStatus === "REJECTED" && !needsOnboarding(user)) {
    // MVEC asked for changes: say what, and where to fix it (saving sends it back for review).
    return <><div className="restricted-warning"><div><strong>MVEC asked you to update your store profile</strong><span>{user.verificationNote || "Check your business details."} Saving your profile sends it back for review.</span></div><Link className="gradient-btn" to="/vendor/settings">Fix my profile</Link></div>{children}</>;
  }
  if (!needsOnboarding(user)) return children;
  return <><div className="restricted-warning"><div><strong>Onboarding incomplete</strong><span>Complete your business profile and wait for MVEC verification before publishing products, creating a store, or placing supply orders.</span></div><button className="gradient-btn" onClick={() => setOpen(true)}>Complete Onboarding</button></div>{children}{open && <OnboardingModal onClose={() => setOpen(false)}/>}</>;
}
