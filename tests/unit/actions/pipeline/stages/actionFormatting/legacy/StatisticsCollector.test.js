import { describe, it, expect } from '@jest/globals';
import StatisticsCollector from '../../../../../../../src/actions/pipeline/stages/actionFormatting/legacy/StatisticsCollector.js';

describe('StatisticsCollector', () => {
  describe('constructor', () => {
    it('should accept a valid stats object', () => {
      const stats = {};
      const collector = new StatisticsCollector(stats);
      expect(collector.isEnabled()).toBe(true);
      expect(collector.getStats()).toBe(stats);
    });

    it('should handle null stats', () => {
      const collector = new StatisticsCollector(null);
      expect(collector.isEnabled()).toBe(false);
      expect(collector.getStats()).toBeNull();
    });

    it('should handle undefined stats', () => {
      const collector = new StatisticsCollector(undefined);
      expect(collector.isEnabled()).toBe(false);
      expect(collector.getStats()).toBeNull();
    });

    it('should reject non-object stats', () => {
      const collector = new StatisticsCollector('not an object');
      expect(collector.isEnabled()).toBe(false);
    });
  });

  describe('increment', () => {
    it('should increment a new counter from 0', () => {
      const stats = {};
      const collector = new StatisticsCollector(stats);

      collector.increment('testCounter');

      expect(stats.testCounter).toBe(1);
    });

    it('should increment an existing counter', () => {
      const stats = { testCounter: 5 };
      const collector = new StatisticsCollector(stats);

      collector.increment('testCounter');

      expect(stats.testCounter).toBe(6);
    });

    it('should handle multiple increments', () => {
      const stats = {};
      const collector = new StatisticsCollector(stats);

      collector.increment('testCounter');
      collector.increment('testCounter');
      collector.increment('testCounter');

      expect(stats.testCounter).toBe(3);
    });

    it('should handle multiple different counters', () => {
      const stats = {};
      const collector = new StatisticsCollector(stats);

      collector.increment('counter1');
      collector.increment('counter2');
      collector.increment('counter1');

      expect(stats.counter1).toBe(2);
      expect(stats.counter2).toBe(1);
    });

    it('should be no-op when disabled', () => {
      const collector = new StatisticsCollector(null);

      collector.increment('testCounter');

      expect(collector.getStats()).toBeNull();
    });

    it('should initialize non-numeric values to 0', () => {
      const stats = { testCounter: 'not a number' };
      const collector = new StatisticsCollector(stats);

      collector.increment('testCounter');

      expect(stats.testCounter).toBe(1);
    });
  });

  describe('isEnabled', () => {
    it('should return true when stats object provided', () => {
      const collector = new StatisticsCollector({});
      expect(collector.isEnabled()).toBe(true);
    });

    it('should return false when stats is null', () => {
      const collector = new StatisticsCollector(null);
      expect(collector.isEnabled()).toBe(false);
    });
  });

  describe('get', () => {
    it('should return statistic value', () => {
      const stats = { testCounter: 42 };
      const collector = new StatisticsCollector(stats);

      expect(collector.get('testCounter')).toBe(42);
    });

    it('should return undefined for non-existent key', () => {
      const collector = new StatisticsCollector({});

      expect(collector.get('nonExistent')).toBeUndefined();
    });

    it('should return undefined when disabled', () => {
      const collector = new StatisticsCollector(null);

      expect(collector.get('testCounter')).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should reset a counter to 0', () => {
      const stats = { testCounter: 5 };
      const collector = new StatisticsCollector(stats);

      collector.reset('testCounter');

      expect(stats.testCounter).toBe(0);
    });

    it('should be no-op when disabled', () => {
      const collector = new StatisticsCollector(null);

      collector.reset('testCounter');

      expect(collector.getStats()).toBeNull();
    });
  });

  describe('resetAll', () => {
    it('should reset all counters to 0', () => {
      const stats = { counter1: 5, counter2: 10, counter3: 15 };
      const collector = new StatisticsCollector(stats);

      collector.resetAll();

      expect(stats.counter1).toBe(0);
      expect(stats.counter2).toBe(0);
      expect(stats.counter3).toBe(0);
    });

    it('should be no-op when disabled', () => {
      const collector = new StatisticsCollector(null);

      collector.resetAll();

      expect(collector.getStats()).toBeNull();
    });
  });

  describe('snapshot', () => {
    it('should create a copy of statistics', () => {
      const stats = { counter1: 5, counter2: 10 };
      const collector = new StatisticsCollector(stats);

      const snapshot = collector.snapshot();

      expect(snapshot).toEqual({ counter1: 5, counter2: 10 });
      expect(snapshot).not.toBe(stats); // Different object
    });

    it('should return null when disabled', () => {
      const collector = new StatisticsCollector(null);

      expect(collector.snapshot()).toBeNull();
    });

    it('should not be affected by subsequent changes', () => {
      const stats = { counter1: 5 };
      const collector = new StatisticsCollector(stats);

      const snapshot = collector.snapshot();
      collector.increment('counter1');

      expect(snapshot.counter1).toBe(5);
      expect(stats.counter1).toBe(6);
    });
  });
});
