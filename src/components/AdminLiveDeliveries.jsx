import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ridersAdminApi } from "../API/rider";
import { extractErrorMessage } from "../API/client";
import LiveMap from "./LiveMap";
import { kigaliTime } from "../utils/liveTracking";

const KEY = ["admin", "live-deliveries"];

/**
 * Admin: every parcel a rider is carrying now, on one map, refreshed every
 * 10 seconds. A parcel not yet collected can be handed to another rider.
 */
export default function AdminLiveDeliveries() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: KEY, queryFn: ridersAdminApi.deliveries, refetchInterval: 10_000 });
  const [error, setError] = useState("");
  const deliveries = data?.deliveries || [];
  const points = deliveries.flatMap((d) => [
    d.rider.location && { id: `rider-${d.deliveryId}`, kind: "rider", lat: d.rider.location.lat, lng: d.rider.location.lng, heading: d.rider.location.heading, stale: d.rider.location.stale, label: `${d.rider.name} · ${d.orderNumber}` },
    { id: `${d.target}-${d.deliveryId}`, kind: d.target === "store" ? "store" : "buyer", lat: (d.target === "store" ? d.store : d.destination).lat, lng: (d.target === "store" ? d.store : d.destination).lng, label: d.target === "store" ? d.store.name : d.orderNumber },
  ].filter(Boolean));

  const release = async (d) => {
    const note = window.prompt(`Give ${d.orderNumber} to another rider? ${d.rider.name} will be told not to collect it. Reason (optional):`);
    if (note === null) return;
    setError("");
    try {
      await ridersAdminApi.release(d.deliveryId, note);
      queryClient.invalidateQueries({ queryKey: KEY });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  if (!data) return null;
  return (
    <section className="data-card live-track">
      <div className="live-track-head">
        <div><h3>On the way now</h3><p className="tiny">{deliveries.length} parcel{deliveries.length === 1 ? "" : "s"} with riders · {data.waitingForRider} waiting for a rider</p></div>
      </div>
      {error && <div className="form-error">{error}</div>}
      {deliveries.length > 0 && <LiveMap points={points} height={320} />}
      {deliveries.map((d) => (
        <div className="live-track-rider" key={d.deliveryId}>
          <span>
            <Link to={`/admin/orders/${d.orderId}`}><b>{d.orderNumber}</b></Link> · {d.rider.name} · {d.statusLabel}
            {d.rider.location ? (d.rider.location.stale ? ` · last seen ${kigaliTime(d.rider.location.at)}` : "") : " · no location yet"}
          </span>
          {d.rider.phone && <a className="outline-btn compact-btn" href={`tel:${d.rider.phone}`}>Call</a>}
          {d.status === "ASSIGNED" && <button type="button" className="outline-btn compact-btn" onClick={() => release(d)}>Give to another rider</button>}
        </div>
      ))}
    </section>
  );
}
