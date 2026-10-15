// Rwandan mobile numbers: 078/079 (MTN) and 072/073 (Airtel).
export function isRwandanPhone(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  const local = digits.startsWith('250') ? `0${digits.slice(3)}` : digits;
  return /^07[2389]\d{7}$/.test(local);
}
