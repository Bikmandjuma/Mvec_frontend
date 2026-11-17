import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, NavigationControl, STYLE_URL, KIGALI } from "../lib/maplibre";

const round = (n) => Math.round(n * 1e6) / 1e6;

/**
 * A map pin: tap the map or drag the pin. `value` is { lat, lng } or null.
 * With `allowGps`, a button drops the pin where this device is (buyers at
 * home); a store's pin is never taken from GPS, since the seller may be away.
 */
export default function PinPicker({ value, onChange, label, help, allowGps = false }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState("");

  useEffect(() => {
    const start = value || KIGALI;
    const map = new MapLibreMap({ container: boxRef.current, style: STYLE_URL, center: [start.lng, start.lat], zoom: value ? 16 : 12, attributionControl: { compact: true } });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    let loaded = false;
    map.once("styledata", () => { loaded = true; });
    map.on("error", () => { if (!loaded) setFailed(true); });
    map.on("click", (e) => onChangeRef.current({ lat: round(e.lngLat.lat), lng: round(e.lngLat.lng) }));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
    // The map starts on the first value; later values only move the pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lat = value?.lat;
  const lng = value?.lng;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lat == null) { markerRef.current?.remove(); markerRef.current = null; return; }
    if (!markerRef.current) {
      const marker = new Marker({ color: "#0f6fde", draggable: true });
      marker.on("dragend", () => { const p = marker.getLngLat(); onChangeRef.current({ lat: round(p.lat), lng: round(p.lng) }); });
      markerRef.current = marker.setLngLat([lng, lat]).addTo(map);
      map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15) });
    } else {
      markerRef.current.setLngLat([lng, lat]);
      if (!map.getBounds().contains([lng, lat])) map.easeTo({ center: [lng, lat] });
    }
  }, [lat, lng]);

  const useMyLocation = () => {
    if (!navigator.geolocation) { setLocating("This browser can't share your location. Tap the map instead."); return; }
    setLocating("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(""); onChange({ lat: round(p.coords.latitude), lng: round(p.coords.longitude) }); },
      () => setLocating("We couldn't get your location. Tap the map where you are instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="field pin-picker">
      <span>{label}</span>
      {help && <small className="tiny">{help}</small>}
      {failed
        ? <p className="tiny">The map couldn't load. Check your connection and refresh the page.</p>
        : <div ref={boxRef} style={{ height: 260, borderRadius: 12, overflow: "hidden", marginTop: 6 }} />}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
        {allowGps && <button type="button" className="outline-btn compact-btn" onClick={useMyLocation}>Use my location</button>}
        {value && <button type="button" className="outline-btn compact-btn" onClick={() => onChange(null)}>Remove pin</button>}
        <small className="tiny">{locating || (value ? `Pin set at ${value.lat}, ${value.lng}` : "Tap the map to drop the pin.")}</small>
      </div>
    </div>
  );
}
