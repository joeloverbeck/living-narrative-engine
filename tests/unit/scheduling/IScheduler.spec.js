import { describe, it, expect } from '@jest/globals';
import { IScheduler } from '../../../src/scheduling/IScheduler.js';

describe('IScheduler interface contract', () => {
  it('throws an error when setTimeout is not implemented', () => {
    const scheduler = new IScheduler();
    expect(() => scheduler.setTimeout(() => {}, 10)).toThrow('not implemented');
  });

  it('throws an error when clearTimeout is not implemented', () => {
    const scheduler = new IScheduler();
    expect(() => scheduler.clearTimeout(123)).toThrow('not implemented');
  });
});
