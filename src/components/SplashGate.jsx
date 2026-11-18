import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { launchSplash } from '../lib/launchSplash';

// Tells the launch splash (index.html) when the app has something to show:
// the signed-in state is known, so protected pages do not flash a loading
// screen, and the page's lazy chunk has replaced the "Loading Ikiguzi…"
// fallback. Renders nothing; routing and auth are left exactly as they were.
export default function SplashGate() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!launchSplash || loading) return undefined;
    let checks = 0;
    const settle = () => {
      if (!document.querySelector('.loading-screen') || ++checks > 80) {
        clearInterval(timer);
        launchSplash.ready();
      }
    };
    const timer = setInterval(settle, 100);
    settle();
    return () => clearInterval(timer);
  }, [loading]);

  return null;
}
