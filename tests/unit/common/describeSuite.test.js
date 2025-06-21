/**
 * @file Test suite for the generic describeSuite helper.
 */

import { describe, it, expect, jest, afterAll } from '@jest/globals';
import { describeSuite } from '../../common/describeSuite.js';

class DummyBed {
  constructor(value) {
    this.value = value;
  }

  async cleanup() {}
}

describe('describeSuite', () => {
  let cleanupCalls = 0;
  const originalCleanup = DummyBed.prototype.cleanup;
  const cleanupSpy = jest
    .spyOn(DummyBed.prototype, 'cleanup')
    .mockImplementation(async function (...args) {
      cleanupCalls++;
      return originalCleanup.apply(this, args);
    });

  describeSuite(
    'inner',
    DummyBed,
    (getBed) => {
      it('instantiates the test bed with arguments', () => {
        const bed = getBed();
        expect(bed).toBeInstanceOf(DummyBed);
        expect(bed.value).toBe('foo');
      });

      it('provides the same instance to each test', () => {
        expect(getBed()).toBe(getBed());
      });
    },
    'foo'
  );

  afterAll(() => {
    cleanupSpy.mockRestore();
  });

  it('calls cleanup after each test', () => {
    expect(cleanupCalls).toBe(2);
  });
});
