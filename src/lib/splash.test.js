import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSplashController, SPLASH_TIMING } from './splash.js';

// A manual clock: timers run only when the test advances time.
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const pending = new Map();
  return {
    setTimer: (fn, ms) => { const id = nextId++; pending.set(id, { at: now + ms, fn }); return id; },
    clearTimer: (id) => pending.delete(id),
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...pending].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        pending.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
  };
}

function setup(options = {}) {
  const clock = fakeClock();
  const events = [];
  const splash = createSplashController({
    ...clock,
    onFade: () => events.push('fade'),
    onGone: () => events.push('gone'),
    ...options,
  });
  return { clock, events, splash };
}

const { minMs, settleMs, fadeMs, patienceMs } = SPLASH_TIMING;

describe('launch splash timing', () => {
  it('stays up for the minimum time even when the app is ready at once', () => {
    const { clock, events, splash } = setup();
    splash.ready();
    clock.advance(minMs - 1);
    assert.deepEqual(events, []);
    clock.advance(1 + settleMs);
    assert.deepEqual(events, ['fade']);
    clock.advance(fadeMs);
    assert.deepEqual(events, ['fade', 'gone']);
    assert.equal(splash.done, true);
  });

  it('waits for the app after the minimum time, then fades', () => {
    const { clock, events, splash } = setup();
    clock.advance(minMs + 2000);
    assert.deepEqual(events, [], 'not ready yet, so it keeps waiting');
    splash.ready();
    clock.advance(settleMs);
    assert.deepEqual(events, ['fade']);
  });

  it('never waits for a stuck start-up longer than the patience limit', () => {
    const { clock, events } = setup();
    clock.advance(patienceMs - 1);
    assert.deepEqual(events, []);
    clock.advance(1 + settleMs + fadeMs);
    assert.deepEqual(events, ['fade', 'gone']);
  });

  it('counts the minimum from the page load, not from when it started', () => {
    const { clock, events, splash } = setup({ elapsedMs: 1200 });
    splash.ready();
    clock.advance(minMs - 1200 + settleMs);
    assert.deepEqual(events, ['fade']);
  });

  it('a bundle that loaded after the minimum fades as soon as the app is ready', () => {
    const { clock, events, splash } = setup({ elapsedMs: minMs + 500 });
    splash.ready();
    clock.advance(settleMs);
    assert.deepEqual(events, ['fade']);
  });

  it('fades and finishes only once, however often it is told the app is ready', () => {
    const { clock, events, splash } = setup();
    for (let i = 0; i < 4; i++) splash.ready();
    clock.advance(patienceMs + 5000);
    assert.deepEqual(events, ['fade', 'gone']);
  });

  it('cancel stops everything', () => {
    const { clock, events, splash } = setup();
    splash.ready();
    splash.cancel();
    clock.advance(patienceMs + 5000);
    assert.deepEqual(events, []);
  });
});
