// Shared display helpers so every page formats prices and ratings the same way.
export const money = (n) => `${new Intl.NumberFormat('en-RW').format(Math.round(Number(n) || 0))} RWF`;

// "4.333333" -> "4.3"; no rating yet -> "New".
export const ratingLabel = (rating) => {
  const value = Number(rating) || 0;
  return value > 0 ? value.toFixed(1) : 'New';
};

export const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB') : '';
};

// The backend sends `_id`; newer responses also send `id`. Use one field.
export const idOf = (doc) => String(doc?.id || doc?._id || '');

// Turn a Mongo-style status ("OUT_FOR_DELIVERY") into readable text.
export const statusLabel = (status) =>
  String(status || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
