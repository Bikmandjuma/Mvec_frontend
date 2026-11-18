import { createSplashController } from './splash.js';

// Connects the controller to the splash markup in index.html. Importing this
// module (from main.jsx) starts the splash's clock. It is a no-op when the page
// has no splash element, or when this tab session has already shown it.
const SEEN_KEY = 'mvec_splash_seen';

function start() {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById('mvec-splash');
  if (!el || document.documentElement.classList.contains('no-splash')) return null;
  const root = document.getElementById('root');
  try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode: the splash simply shows again next load */ }

  return createSplashController({
    // Counted from the start of the page load, so a slow bundle does not add to the wait.
    elapsedMs: typeof performance !== 'undefined' ? performance.now() : 0,
    onFade: () => {
      el.classList.add('is-fading');
      if (root) root.inert = false;
    },
    onGone: () => el.remove(),
  });
}

export const launchSplash = start();
