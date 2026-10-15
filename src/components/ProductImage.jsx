import { resolveImageUrl } from '../utils/imageUrl';

const FALLBACK_IMAGE = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'%3E%3Crect width='600' height='600' fill='%23eef1f4'/%3E%3Cpath d='M170 430l90-105 70 75 55-65 75 95H170z' fill='%23c8d0d8'/%3E%3Ccircle cx='390' cy='225' r='42' fill='%23c8d0d8'/%3E%3Ctext x='300' y='510' text-anchor='middle' fill='%23636e78' font-family='Arial,sans-serif' font-size='30'%3EMVEC%3C/text%3E%3C/svg%3E`;

export default function ProductImage({ src, alt = '', onError, ...props }) {
  const handleError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = FALLBACK_IMAGE;
    onError?.(event);
  };

  return <img {...props} src={resolveImageUrl(src) || FALLBACK_IMAGE} alt={alt} onError={handleError} />;
}
