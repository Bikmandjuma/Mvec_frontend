// Mirrors Ikiguzi_backend/src/config/delivery.js. The server recomputes the
// fee when the order is created; this copy only lets checkout show the same
// number before submitting. Keep both files in sync.
export const PROVINCES = [
  'Kigali City',
  'Northern Province',
  'Southern Province',
  'Eastern Province',
  'Western Province',
];

export const FEES = { standardKigali: 0, standardProvince: 5000, express: 10000 };

export function shippingFee(province, method) {
  if (method === 'express') return FEES.express;
  return province === 'Kigali City' ? FEES.standardKigali : FEES.standardProvince;
}

// Rwandan mobile numbers: 078/079 (MTN) and 072/073 (Airtel).
export function isRwandanPhone(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  const local = digits.startsWith('250') ? `0${digits.slice(3)}` : digits;
  return /^07[2389]\d{7}$/.test(local);
}
