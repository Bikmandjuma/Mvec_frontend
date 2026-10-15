import { useEffect, useState } from "react";
import { adminApi } from "../../API/admin";

// Live counts of work waiting for an admin, keyed by page ("/admin/vendors": 2),
// for the sidebar badges. Refreshes every minute; failures keep the old counts.
export default function useAdminBadges(enabled) {
  const [badges, setBadges] = useState({});
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const load = () => adminApi.getAttention().then((r) => alive && setBadges(r.badges || {})).catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(timer); };
  }, [enabled]);
  return badges;
}
