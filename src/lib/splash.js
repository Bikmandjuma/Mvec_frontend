// Timing of the launch splash. It follows the mobile splash
// (Mvec_Mobile/lib/widgets/splash_gate.dart): a minimum time on screen so the
// brand gets its moment, then wait until the app is ready (or give up after
// `patienceMs`), let the page paint under it for `settleMs`, then fade.
//
// The web page loads in a fraction of the phone's start-up work, so the minimum
// is shorter than the mobile 2.5 s, and it is counted from page load rather
// than from when this code runs, so a slow bundle never adds to the wait.
export const SPLASH_TIMING = { minMs: 1500, settleMs: 250, fadeMs: 450, patienceMs: 8000 };

/**
 * Drives one splash through showing → fading → gone.
 *
 * @param {object} options
 * @param {object} [options.timing]    overrides for SPLASH_TIMING
 * @param {number} [options.elapsedMs] time already spent since the page began loading
 * @param {Function} [options.onFade]  called when the fade should start
 * @param {Function} [options.onGone]  called once the fade has finished
 * @param {Function} [options.setTimer]/[options.clearTimer] injectable for tests
 */
export function createSplashController({
  timing = SPLASH_TIMING,
  elapsedMs = 0,
  onFade,
  onGone,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  const t = { ...SPLASH_TIMING, ...timing };
  const timers = [];
  let minElapsed = false;
  let ready = false;
  let gaveUp = false;
  let finishing = false;
  let done = false;

  const later = (fn, ms) => timers.push(setTimer(fn, Math.max(0, ms)));

  const maybeFinish = () => {
    if (finishing || done || !minElapsed) return;
    if (!ready && !gaveUp) return;
    finishing = true;
    later(() => {
      onFade?.();
      later(() => {
        done = true;
        onGone?.();
      }, t.fadeMs);
    }, t.settleMs);
  };

  later(() => { minElapsed = true; maybeFinish(); }, t.minMs - elapsedMs);
  later(() => { gaveUp = true; maybeFinish(); }, t.patienceMs - elapsedMs);

  return {
    /** The app has something to show: the splash may fade once its minimum time is up. */
    ready() { ready = true; maybeFinish(); },
    /** Stop all timers (the splash element is left as it is). */
    cancel() { timers.forEach((id) => clearTimer(id)); },
    get done() { return done; },
  };
}
