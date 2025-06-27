import { describe, it, expect, jest } from '@jest/globals';
import { RealScheduler } from '../../src/scheduling/index.js';

describe('RealScheduler', () => {
  it('delegates setTimeout to globalThis.setTimeout', () => {
    const spy = jest
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(() => 'id');
    const fn = jest.fn();
    const scheduler = new RealScheduler();
    const result = scheduler.setTimeout(fn, 50);
    expect(spy).toHaveBeenCalledWith(fn, 50);
    expect(result).toBe('id');
    spy.mockRestore();
  });

  it('delegates clearTimeout to globalThis.clearTimeout', () => {
    const spy = jest
      .spyOn(globalThis, 'clearTimeout')
      .mockImplementation(() => {});
    const scheduler = new RealScheduler();
    scheduler.clearTimeout('id');
    expect(spy).toHaveBeenCalledWith('id');
    spy.mockRestore();
  });
});
