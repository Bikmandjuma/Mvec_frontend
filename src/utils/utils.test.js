import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirect, afterSignIn } from './redirect.js';
import { canCancel, paidCancelRemaining, CANCEL_WINDOW_MS } from './orders.js';
import { isRwandanPhone } from './delivery.js';

describe('after sign-in', () => {
  it('only follows paths inside the app', () => {
    assert.equal(safeRedirect('/orders/12'), '/orders/12');
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'orders', '/login?next=/x', null]) {
      assert.equal(safeRedirect(bad), '', String(bad));
    }
  });

  it('sellers land on their dashboard, buyers go back to what they were doing', () => {
    assert.equal(afterSignIn({ role: 'buyer' }, '/cart'), '/cart');
    assert.equal(afterSignIn({ role: 'vendor' }, '/cart'), '/vendor');
    assert.equal(afterSignIn({ role: 'vendor' }, '/vendor/orders'), '/vendor/orders');
  });
});

describe('cancelling an order', () => {
  const paidAt = new Date('2026-11-01T10:00:00Z').getTime();
  const paid = { paymentStatus: 'PAID', orderStatus: 'CONFIRMED', paidAt };

  it('an unpaid order can always be cancelled', () => {
    assert.equal(canCancel({ paymentStatus: 'PENDING', orderStatus: 'PENDING' }), true);
  });

  it('a paid order only within the cancel window', () => {
    assert.equal(paidCancelRemaining(paid, paidAt + 60_000), CANCEL_WINDOW_MS - 60_000);
    assert.equal(canCancel(paid, paidAt + CANCEL_WINDOW_MS + 1), false);
    assert.equal(canCancel({ ...paid, orderStatus: 'SHIPPED' }, paidAt), false);
  });
});

it('accepts MTN and Airtel numbers only', () => {
  for (const ok of ['0788123456', '+250 788 123 456', '0721234567']) assert.equal(isRwandanPhone(ok), true, ok);
  for (const bad of ['0758123456', '078812345', '']) assert.equal(isRwandanPhone(bad), false, bad);
});
