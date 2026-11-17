import { useQuery } from "@tanstack/react-query";
import { riderApi } from "../API/rider";
import LiveMap from "./LiveMap";
import { parcelPoints, minutesLeft, kmLeft, kigaliTime as time } from "../utils/liveTracking";

const VEHICLE = { MOTORBIKE: "Motorbike", BICYCLE: "Bicycle", CAR: "Car", ON_FOOT: "On foot" };
function Parcel({ p, viewer }) {
  const loc = p.rider.location;
  return (
    <div className="data-card live-track">
      <div className="live-track-head">
        <div>
          <h3>{viewer === "seller" && p.phase === "to_store" ? "A rider is coming for your parcel" : p.phaseLabel}</h3>
          <p className="tiny">From {p.store.name}{viewer === "buyer" && p.phase === "to_store" ? ". The rider is collecting it now." : ""}</p>
        </div>
        {p.route && <div className="live-track-eta">
          <b>{minutesLeft(p.route.durationS)} min</b>
          <small className="tiny">{kmLeft(p.route.distanceM)} · about {time(p.route.etaAt)}</small>
        </div>}
      </div>
      <div className="live-track-rider">
        <span><b>{p.rider.name}</b> · {VEHICLE[p.rider.vehicleType] || "Rider"}{p.rider.plateNumber ? ` · ${p.rider.plateNumber}` : ""}</span>
        {p.rider.phone && <a className="outline-btn compact-btn" href={`tel:${p.rider.phone}`}>Call the rider</a>}
      </div>
      {!loc && <p className="tiny">Waiting for the rider's location.</p>}
      {loc?.stale && <p className="tiny">Last seen at {time(loc.at)}.</p>}
      <LiveMap points={parcelPoints(p)} route={p.route?.geometry} height={280} />
    </div>
  );
}

/**
 * Where the Ikiguzi riders carrying this order's parcels are, refreshed every
 * few seconds while one is on the way. Shows nothing for parcels without a rider.
 * `viewer`: "buyer" (all parcels) or "seller" (only its own; the server filters).
 */
export default function LiveTracking({ orderId, viewer = "buyer" }) {
  const { data } = useQuery({
    queryKey: ["order-live", orderId],
    queryFn: () => riderApi.orderLive(orderId),
    enabled: Boolean(orderId),
    refetchInterval: (q) => ((q.state.data?.parcels || []).some((p) => p.active) ? (q.state.data.parcels.find((p) => p.active).refreshAfterS || 4) * 1000 : 30_000),
  });
  const parcels = data?.parcels || [];
  const waiting = parcels.filter((p) => !p.active && p.status === "READY_FOR_PICKUP");
  if (!parcels.some((p) => p.active) && !waiting.length) return null;
  return (
    <section className="live-track">
      {parcels.filter((p) => p.active).map((p) => <Parcel key={p.deliveryId} p={p} viewer={viewer} />)}
      {waiting.map((p) => <div className="data-card" key={p.deliveryId}><h3>{p.statusLabel}</h3><p className="tiny">Ikiguzi is finding a rider for the parcel from {p.store.name}.</p></div>)}
    </section>
  );
}
