// One MapLibre setup for every map on the site (pins and live tracking).
import { setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

// MapLibre resolves its worker next to its own bundle, which Vite's
// pre-bundling breaks: point it at the file Vite serves.
setWorkerUrl(maplibreWorkerUrl);

// CARTO's free vector basemap (as KitchenLink uses), no key needed.
export const STYLE_URL = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
export const KIGALI = { lat: -1.9441, lng: 30.0619 };
export { Map, Marker, NavigationControl, LngLatBounds } from "maplibre-gl";
