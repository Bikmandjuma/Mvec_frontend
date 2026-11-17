// Shared by the live delivery views (buyer, seller, rider, admin).
export const kigaliTime = (d) => new Date(d).toLocaleTimeString("en-GB", { timeZone: "Africa/Kigali", hour: "2-digit", minute: "2-digit" });
export const minutesLeft = (s) => Math.max(1, Math.round(s / 60));
export const kmLeft = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);

/** Map pins for one parcel: the rider, then where they're going. */
export function parcelPoints(p) {
  const loc = p.rider?.location;
  return [
    loc && { id: `rider-${p.deliveryId}`, kind: "rider", lat: loc.lat, lng: loc.lng, heading: loc.heading, stale: loc.stale, label: p.rider.name },
    { id: `store-${p.deliveryId}`, kind: "store", lat: p.store.lat, lng: p.store.lng, label: p.store.name },
    p.phase === "to_buyer" && { id: `buyer-${p.deliveryId}`, kind: "buyer", lat: p.destination.lat, lng: p.destination.lng, label: "Delivery point" },
  ].filter(Boolean);
}
