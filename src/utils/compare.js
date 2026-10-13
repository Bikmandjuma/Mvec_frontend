// Products the buyer picked to compare (up to 4), remembered on this device.
const KEY = "mvec_compare";
export const COMPARE_MAX = 4;

export function getCompare() {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(ids) ? ids.filter(Boolean).map(String).slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

function save(ids) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event("mvec-compare"));
  return ids;
}

/** Add or remove a product. Returns { ok, ids, message }. */
export function toggleCompare(id) {
  const key = String(id);
  const ids = getCompare();
  if (ids.includes(key)) return { ok: true, ids: save(ids.filter((x) => x !== key)), message: "Removed from compare." };
  if (ids.length >= COMPARE_MAX) return { ok: false, ids, message: `You can compare up to ${COMPARE_MAX} products. Remove one first.` };
  return { ok: true, ids: save([...ids, key]), message: "Added to compare." };
}

export const removeFromCompare = (id) => save(getCompare().filter((x) => x !== String(id)));
export const clearCompare = () => save([]);
