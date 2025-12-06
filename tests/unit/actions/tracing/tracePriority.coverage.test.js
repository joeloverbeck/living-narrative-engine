import { describe, it, expect } from '@jest/globals';
import {
  TracePriority,
  PRIORITY_NAMES,
  DEFAULT_PRIORITY,
  isValidPriority,
  normalizePriority,
  getPriorityName,
  inferPriority,
  comparePriorities,
  getPriorityLevels,
} from '../../../../src/actions/tracing/tracePriority.js';

/**
 * @file Additional coverage for tracePriority utilities.
 */

describe('tracePriority utilities', () => {
  it('exposes priority constants and their human readable names', () => {
    expect(TracePriority).toMatchObject({
      CRITICAL: 3,
      HIGH: 2,
      NORMAL: 1,
      LOW: 0,
    });

    expect(PRIORITY_NAMES).toEqual({
      [TracePriority.CRITICAL]: 'CRITICAL',
      [TracePriority.HIGH]: 'HIGH',
      [TracePriority.NORMAL]: 'NORMAL',
      [TracePriority.LOW]: 'LOW',
    });

    expect(DEFAULT_PRIORITY).toBe(TracePriority.NORMAL);
  });

  it('validates priority inputs', () => {
    for (const value of Object.values(TracePriority)) {
      expect(isValidPriority(value)).toBe(true);
    }

    expect(isValidPriority(7)).toBe(false);
    expect(isValidPriority(-4)).toBe(false);
    expect(isValidPriority(NaN)).toBe(false);
  });

  it('normalizes values by clamping to bounds and rounding when needed', () => {
    expect(normalizePriority(TracePriority.HIGH)).toBe(TracePriority.HIGH);
    expect(normalizePriority(99)).toBe(TracePriority.CRITICAL);
    expect(normalizePriority(-42)).toBe(TracePriority.LOW);
    expect(normalizePriority(1.6)).toBe(2);
    expect(normalizePriority(1.4)).toBe(1);
  });

  it('maps normalized priorities to display names with UNKNOWN fallback', () => {
    expect(getPriorityName(TracePriority.CRITICAL)).toBe('CRITICAL');
    expect(getPriorityName(1.2)).toBe('NORMAL');
    expect(getPriorityName(Number.NaN)).toBe('UNKNOWN');
  });

  describe('inferPriority', () => {
    it('returns LOW for nullish traces and NORMAL by default', () => {
      expect(inferPriority(null)).toBe(TracePriority.LOW);
      expect(inferPriority(undefined)).toBe(TracePriority.LOW);
      expect(inferPriority({})).toBe(TracePriority.NORMAL);
    });

    it('upgrades priority based on error flags and action identifiers', () => {
      expect(
        inferPriority({ hasError: true, actionId: 'system:bootstrap' })
      ).toBe(TracePriority.CRITICAL);

      expect(inferPriority({ execution: { error: new Error('boom') } })).toBe(
        TracePriority.CRITICAL
      );

      expect(inferPriority({ actionId: 'system:reload' })).toBe(
        TracePriority.HIGH
      );

      expect(inferPriority({ actionId: 'user:interaction' })).toBe(
        TracePriority.HIGH
      );

      expect(inferPriority({ actionId: 'debug:trace' })).toBe(
        TracePriority.LOW
      );

      expect(inferPriority({ actionId: 'trace:diagnostic' })).toBe(
        TracePriority.LOW
      );
    });
  });

  it('compares priorities with higher values sorted first', () => {
    expect(comparePriorities(TracePriority.HIGH, TracePriority.NORMAL)).toBe(
      -1
    );
    expect(comparePriorities(TracePriority.NORMAL, TracePriority.HIGH)).toBe(1);
    expect(comparePriorities(TracePriority.LOW, TracePriority.LOW)).toBe(0);
  });

  it('lists priority levels from highest to lowest', () => {
    expect(getPriorityLevels()).toEqual([
      TracePriority.CRITICAL,
      TracePriority.HIGH,
      TracePriority.NORMAL,
      TracePriority.LOW,
    ]);
  });
});
