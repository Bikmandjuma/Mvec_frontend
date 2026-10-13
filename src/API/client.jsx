import axios from "axios";

const BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export { BASE_URL };

// Origin the REST API (and /uploads static files) are served from. Kept here
// so the API client and every image URL resolve to the exact same host — two
// different fallbacks used to make calls go to one host and images to another.
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");

export const client = axios.create({ baseURL: BASE_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("huska_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    // An expired or revoked session: sign out and send the user to log in,
    // remembering where they were. Requests made without a token (guests)
    // simply fail and are handled by the page.
    if (error.response?.status === 401 && localStorage.getItem("huska_token")) {
      localStorage.removeItem("huska_token");
      if (window.location.pathname !== "/login") {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
      }
    }
    return Promise.reject(error);
  }
);

// A message the user can act on. Problems they can fix (a wrong field, an
// item out of stock) come from the server as-is; connection problems and
// faults on our side say so plainly, so nobody retries a form that is fine.
export function extractErrorMessage(error, fallback) {
  const res = error?.response;
  const data = res?.data;
  const serverMessage =
    (typeof data === "string" && data.length < 300 && !data.trim().startsWith("<") ? data : "") ||
    data?.message ||
    data?.error?.message ||
    (typeof data?.error === "string" ? data.error : "") ||
    (Array.isArray(data?.errors) ? data.errors.map((e) => e.msg || e.message || e).filter(Boolean).join(" ") : "");

  if (!res) {
    if (error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "")) {
      return "The server took too long to answer. Check your connection and try again; if you were paying, check My orders before paying again.";
    }
    if (error?.request || error?.code === "ERR_NETWORK") {
      return navigator.onLine === false
        ? "You are offline. Reconnect to the internet and try again."
        : "We can't reach MVEC right now. Check your internet connection and try again in a moment.";
    }
    return error?.message || fallback || "Something went wrong. Please try again.";
  }
  if (res.status === 401) return serverMessage || "Your session has expired. Please sign in again.";
  if (res.status === 403) return serverMessage || "Your account isn't allowed to do this.";
  if (res.status === 404) return serverMessage || "We couldn't find what you were looking for. It may have been removed.";
  if (res.status === 413) return "That file is too large. Choose a smaller one and try again.";
  if (res.status === 429) return serverMessage || "Too many attempts. Wait a minute and try again.";
  if (res.status >= 500) {
    const generic = !serverMessage || /^(internal )?server error$/i.test(serverMessage);
    const message = generic
      ? fallback || "Something went wrong on our side, not yours. Please try again in a moment; if it keeps happening, contact MVEC support."
      : serverMessage;
    // The reference lets support find the exact failure in the server log.
    const ref = data?.reference;
    return ref && !message.includes(ref) ? `${message.replace(/\.$/, "")} (reference ${ref}).` : message;
  }
  return serverMessage || fallback || "Something went wrong. Please try again.";
}

export function mapUser(u) {
  if (!u) return null;
  return {
    id: u._id || u.id,
    fullName: u.Fullname || u.fullName || u.name || "",
    telephone: u.phone || u.telephone || "",
    email: u.email || "",
    gender: u.gender || "",
    role: u.role || "buyer",
    avatarUrl: u.avatarUrl || "",
    companyName: u.companyName || "",
    businessName: u.businessName || u.companyName || "",
    logoUrl: u.logoUrl || "",
    description: u.description || "",
    category: u.category || "",
    location: u.location || null,
    isOnboarded: u.isOnboarded !== false,
    verificationStatus: u.verificationStatus || "VERIFIED",
    isSellerEnabled: Boolean(u.isSellerEnabled),
  };
}

export function mapAuthResponse(data) {
  return {
    token: data.token,
    user: mapUser(data.user),
  };
}
