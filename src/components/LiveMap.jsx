import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, NavigationControl, LngLatBounds, STYLE_URL, KIGALI } from "../lib/maplibre";

const ROUTE = "live-route";

/** The pin's look: a rider dot that points where they're heading, a store, or the buyer. */
function pinElement(kind) {
  const el = document.createElement("div");
  el.className = `live-pin ${kind}`;
  el.innerHTML = kind === "rider" ? '<i class="live-pin-arrow"></i><span class="live-pin-dot"></span>' : "<span></span>";
  return el;
}

/**
 * A live delivery map. `points`: [{ id, kind: "rider"|"store"|"buyer", lat, lng,
 * label?, heading?, stale? }]; `route`: [[lng, lat], ...] drawn as the road to go.
 * It zooms to fit when pins appear or disappear, not on every position update,
 * so a viewer who moved the map isn't pulled back every few seconds.
 */
export default function LiveMap({ points = [], route = null, height = 300 }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const markers = useRef(new Map());
  const fitted = useRef("");
  // Set the moment the map loads (state would only catch up on the next render),
  // and the fit waiting for it.
  const loadedRef = useRef(false);
  const pendingFit = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const map = new MapLibreMap({ container: boxRef.current, style: STYLE_URL, center: [KIGALI.lng, KIGALI.lat], zoom: 12, attributionControl: { compact: true } });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    let loaded = false;
    map.on("error", () => { if (!loaded) setFailed(true); });
    map.on("load", () => {
      loaded = true;
      loadedRef.current = true;
      pendingFit.current?.();
      pendingFit.current = null;
      map.addSource(ROUTE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: `${ROUTE}-casing`, type: "line", source: ROUTE, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 8 } });
      map.addLayer({ id: ROUTE, type: "line", source: ROUTE, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#0b6580", "line-width": 5 } });
      setReady(true);
    });
    mapRef.current = map;
    // Cards change size as the page settles (fonts, sidebars, phone rotation).
    const resized = new ResizeObserver(() => map.resize());
    resized.observe(boxRef.current);
    const pins = markers.current;
    return () => { resized.disconnect(); map.remove(); mapRef.current = null; pins.clear(); };
  }, []);

  // Pins: add, move, remove.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set();
    for (const p of points) {
      if (p.lat == null || p.lng == null) continue;
      seen.add(p.id);
      let entry = markers.current.get(p.id);
      if (!entry) {
        const el = pinElement(p.kind);
        entry = { el, marker: new Marker({ element: el, anchor: p.kind === "buyer" ? "bottom" : "center" }).setLngLat([p.lng, p.lat]).addTo(map) };
        markers.current.set(p.id, entry);
      }
      entry.marker.setLngLat([p.lng, p.lat]);
      entry.el.title = p.label || "";
      entry.el.classList.toggle("stale", Boolean(p.stale));
      const arrow = entry.el.querySelector(".live-pin-arrow");
      if (arrow) {
        arrow.style.display = p.heading == null ? "none" : "";
        arrow.style.transform = `rotate(${p.heading || 0}deg)`;
      }
    }
    for (const [id, entry] of markers.current) {
      if (!seen.has(id)) { entry.marker.remove(); markers.current.delete(id); }
    }
    const key = [...seen].sort().join("|");
    if (key && key !== fitted.current) {
      fitted.current = key;
      const placed = points.filter((p) => p.lat != null && p.lng != null);
      // Always the live map: a fit waiting for the load may outlive the map it was planned on.
      const fit = () => {
        const live = mapRef.current;
        if (!live) return;
        live.resize();
        if (placed.length === 1) live.jumpTo({ center: [placed[0].lng, placed[0].lat], zoom: 15 });
        else if (placed.length > 1) {
          const bounds = placed.reduce((b, p) => b.extend([p.lng, p.lat]), new LngLatBounds([placed[0].lng, placed[0].lat], [placed[0].lng, placed[0].lat]));
          live.fitBounds(bounds, { padding: 50, maxZoom: 16, duration: 0 });
        }
      };
      // Before the map has loaded its size can still change: fit once it has.
      if (loadedRef.current) fit();
      else pendingFit.current = fit;
    }
  }, [points]);

  // The road still to go.
  useEffect(() => {
    const source = ready && mapRef.current?.getSource(ROUTE);
    if (!source) return;
    source.setData(route?.length > 1
      ? { type: "Feature", geometry: { type: "LineString", coordinates: route } }
      : { type: "FeatureCollection", features: [] });
  }, [route, ready]);

  return failed
    ? <p className="tiny">The map couldn't load. Check your connection and refresh the page.</p>
    : <div ref={boxRef} className="live-map" style={{ height }} />;
}
