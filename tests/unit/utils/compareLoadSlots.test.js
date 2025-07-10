import { describe, it, expect } from '@jest/globals';
import { compareLoadSlots } from '../../../src/utils/loadSlotUtils.js';

describe('compareLoadSlots', () => {
  it('places corrupted slots after non-corrupted ones', () => {
    const a = { isCorrupted: true };
    const b = { isCorrupted: false };
    expect(compareLoadSlots(a, b)).toBe(1);
    expect(compareLoadSlots(b, a)).toBe(-1);
  });

  it('orders corrupted slots alphabetically', () => {
    const first = { isCorrupted: true, identifier: 'b' };
    const second = { isCorrupted: true, saveName: 'a' };
    // 'b' should come after 'a'
    expect(compareLoadSlots(first, second)).toBeGreaterThan(0);
    expect(compareLoadSlots(second, first)).toBeLessThan(0);
  });

  it('orders by timestamp when neither slot is corrupted', () => {
    const older = { isCorrupted: false, timestamp: '2023-01-01T00:00:00Z' };
    const newer = { isCorrupted: false, timestamp: '2023-02-01T00:00:00Z' };
    expect(compareLoadSlots(older, newer)).toBeGreaterThan(0);
    expect(compareLoadSlots(newer, older)).toBeLessThan(0);
  });

  it('returns 0 when timestamp access throws', () => {
    const throwing = {
      isCorrupted: false,
      get timestamp() {
        throw new Error('bad');
      },
    };
    const other = { isCorrupted: false, timestamp: '2023-01-01T00:00:00Z' };
    expect(compareLoadSlots(throwing, other)).toBe(0);
  });
});
