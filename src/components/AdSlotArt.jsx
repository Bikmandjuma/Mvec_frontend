// Flat product illustrations used in empty ad slots on the home page hero.
// They show "a product goes here" visually, without borrowing any real
// vendor's photos for a slot nobody has paid for.
const FRAME = { viewBox: '0 0 200 150', width: '100%', height: '100%', role: 'img', preserveAspectRatio: 'xMidYMid slice' };

function Backdrop({ id, from, to }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="200" height="150" rx="12" fill={`url(#${id})`} />
      <ellipse cx="100" cy="128" rx="58" ry="7" fill="#0b3a4a" opacity=".12" />
    </>
  );
}

const Sneaker = () => (
  <svg {...FRAME} aria-label="Sneaker illustration">
    <Backdrop id="ad-bg-sneaker" from="#fff4e6" to="#ffd8a8" />
    <path d="M42 112c0-14 10-22 24-27l18-20c4-4 10-4 13 1l9 14c6 8 16 12 28 13l18 2c9 1 14 8 14 17H42z" fill="#ffffff" />
    <path d="M42 112h124v8c0 3-2 5-5 5H47c-3 0-5-2-5-5v-8z" fill="#f08c00" />
    <path d="M84 65l9 14M76 74l9 13M68 82l8 12" stroke="#f59f00" strokeWidth="4" strokeLinecap="round" />
    <path d="M118 96c10 2 22 3 34 3" stroke="#ffc078" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

const Headphones = () => (
  <svg {...FRAME} aria-label="Headphones illustration">
    <Backdrop id="ad-bg-headphones" from="#e7f5ff" to="#a5d8ff" />
    <path d="M58 92V78c0-24 19-43 42-43s42 19 42 43v14" fill="none" stroke="#1c7ed6" strokeWidth="9" strokeLinecap="round" />
    <rect x="44" y="84" width="28" height="40" rx="12" fill="#1864ab" />
    <rect x="128" y="84" width="28" height="40" rx="12" fill="#1864ab" />
    <rect x="52" y="92" width="12" height="24" rx="6" fill="#4dabf7" />
    <rect x="136" y="92" width="12" height="24" rx="6" fill="#4dabf7" />
  </svg>
);

const Handbag = () => (
  <svg {...FRAME} aria-label="Handbag illustration">
    <Backdrop id="ad-bg-handbag" from="#fff0f6" to="#fcc2d7" />
    <path d="M78 64c0-14 10-24 22-24s22 10 22 24" fill="none" stroke="#a61e4d" strokeWidth="7" strokeLinecap="round" />
    <path d="M54 66h92l10 56c1 5-3 9-8 9H52c-5 0-9-4-8-9l10-56z" fill="#d6336c" />
    <rect x="90" y="84" width="20" height="12" rx="4" fill="#ffdeeb" />
  </svg>
);

const Phone = () => (
  <svg {...FRAME} aria-label="Phone illustration">
    <Backdrop id="ad-bg-phone" from="#ebfbee" to="#b2f2bb" />
    <rect x="72" y="26" width="56" height="104" rx="12" fill="#2b8a3e" />
    <rect x="78" y="36" width="44" height="80" rx="6" fill="#d3f9d8" />
    <rect x="86" y="46" width="28" height="22" rx="4" fill="#69db7c" />
    <rect x="86" y="74" width="28" height="5" rx="2.5" fill="#8ce99a" />
    <rect x="86" y="84" width="18" height="5" rx="2.5" fill="#8ce99a" />
    <circle cx="100" cy="123" r="3" fill="#d3f9d8" />
  </svg>
);

export const AD_SLOT_ART = [Sneaker, Headphones, Handbag, Phone];
