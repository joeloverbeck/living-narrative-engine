import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WarningTracker from '../../../../src/anatomy/services/warningTracker.js';

describe('WarningTracker', () => {
  let tracker;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    tracker = new WarningTracker({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('validates logger dependency', () => {
      expect(() => new WarningTracker({})).toThrow();
    });
  });

  describe('warnOnce', () => {
    it('logs warning on first call', () => {
      tracker.warnOnce('missingDefinition', 'bleed', 'first warning');

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('first warning')
      );
    });

    it('suppresses warning on subsequent calls with same category+key', () => {
      tracker.warnOnce('missingDefinition', 'bleed', 'first warning');
      tracker.warnOnce('missingDefinition', 'bleed', 'second warning');

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    it('logs warning for different keys in same category', () => {
      tracker.warnOnce('missingDefinition', 'bleed', 'warn bleed');
      tracker.warnOnce('missingDefinition', 'burn', 'warn burn');

      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    it('logs warning for same key in different categories', () => {
      tracker.warnOnce('missingDefinition', 'bleed', 'warn bleed');
      tracker.warnOnce('missingOrder', 'bleed', 'warn order');

      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('hasWarned', () => {
    it('returns false before warning issued', () => {
      expect(tracker.hasWarned('missingDefinition', 'bleed')).toBe(false);
    });

    it('returns true after warning issued', () => {
      tracker.warnOnce('missingDefinition', 'bleed', 'warn');

      expect(tracker.hasWarned('missingDefinition', 'bleed')).toBe(true);
    });
  });

  describe('clear', () => {
    it('resets all warning caches', () => {
      tracker.warnOnce('missingDefinition', 'bleed', 'warn bleed');
      tracker.warnOnce('missingOrder', 'bleed', 'warn order');

      tracker.clear();

      expect(tracker.hasWarned('missingDefinition', 'bleed')).toBe(false);
      expect(tracker.hasWarned('missingOrder', 'bleed')).toBe(false);
    });

    it('allows same warning to be logged again', () => {
      tracker.warnOnce('missingDefinition', 'bleed', 'warn');
      tracker.clear();
      tracker.warnOnce('missingDefinition', 'bleed', 'warn again');

      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearCategory', () => {
    it('only clears specified category', () => {
      tracker.warnOnce('missingDefinition', 'bleed', 'warn bleed');
      tracker.warnOnce('missingOrder', 'bleed', 'warn order');

      tracker.clearCategory('missingDefinition');

      expect(tracker.hasWarned('missingDefinition', 'bleed')).toBe(false);
      expect(tracker.hasWarned('missingOrder', 'bleed')).toBe(true);
    });

    it('preserves other categories', () => {
      tracker.warnOnce('missingDefinition', 'bleed', 'warn bleed');
      tracker.warnOnce('missingOrder', 'bleed', 'warn order');

      tracker.clearCategory('missingOrder');

      expect(tracker.hasWarned('missingDefinition', 'bleed')).toBe(true);
      expect(tracker.hasWarned('missingOrder', 'bleed')).toBe(false);
    });
  });
});
