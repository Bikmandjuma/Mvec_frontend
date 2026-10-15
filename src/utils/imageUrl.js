import { API_ORIGIN } from '../API/client';

// Product uploads are served from the backend root (/uploads), not /api/uploads.
export { API_ORIGIN };

// Uploaded files may be stored as:
//   - a root-relative path            /uploads/abc.jpg      (preferred)
//   - an absolute URL on a host that  http://localhost:4000/uploads/abc.jpg
//     was baked in when the file was  http://192.168.1.71:4000/uploads/abc.jpg
//     uploaded (old records)
// In both cases the image must be loaded from the API origin that this build is
// configured to talk to, otherwise the browser requests it from the React dev
// server (or a host that no longer exists) and renders the placeholder.
const UPLOADED_FILE = /^https?:\/\/[^/]+(\/uploads\/[^?#\s]+)$/i;

export function resolveImageUrl(value) {
  if (!value || typeof value !== 'string') return '';
  const image = value.trim();
  if (!image || image.startsWith('data:') || image.startsWith('blob:') || image.startsWith('//')) return image;
  const uploaded = UPLOADED_FILE.exec(image);
  if (uploaded) return `${API_ORIGIN}${uploaded[1]}`;
  if (/^[a-z][a-z\d+.-]*:/i.test(image)) return image;
  return `${API_ORIGIN}/${image.replace(/^\/+/, '')}`;
}
