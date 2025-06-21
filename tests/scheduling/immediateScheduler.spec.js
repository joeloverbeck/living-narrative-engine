import { describe, it, expect } from '@jest/globals';
import { ImmediateScheduler } from '../../src/scheduling/index.js';

describe('ImmediateScheduler', () => {
  it('runs callbacks synchronously', () => {
    const scheduler = new ImmediateScheduler();
    let called = false;
    scheduler.setTimeout(() => {
      called = true;
    }, 10);
    expect(called).toBe(true);
  });

  it('returns 0 from setTimeout', () => {
    const scheduler = new ImmediateScheduler();
    const id = scheduler.setTimeout(() => {}, 5);
    expect(id).toBe(0);
  });
});
