/**
 * @file Unit tests for LFU cache strategy
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LFUStrategy } from '../../../../src/cache/strategies/LFUStrategy.js';

describe('LFUStrategy', () => {
  let lfuStrategy;

  beforeEach(() => {
    lfuStrategy = new LFUStrategy({
      maxSize: 3,
      ttl: 1000, // 1 second for testing
      updateAgeOnGet: true,
    });
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      lfuStrategy.set('key1', 'value1');
      expect(lfuStrategy.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(lfuStrategy.get('nonexistent')).toBeUndefined();
    });

    it('should check if keys exist', () => {
      lfuStrategy.set('key1', 'value1');
      expect(lfuStrategy.has('key1')).toBe(true);
      expect(lfuStrategy.has('nonexistent')).toBe(false);
    });

    it('should delete values', () => {
      lfuStrategy.set('key1', 'value1');
      expect(lfuStrategy.delete('key1')).toBe(true);
      expect(lfuStrategy.get('key1')).toBeUndefined();
      expect(lfuStrategy.delete('nonexistent')).toBe(false);
    });

    it('should clear all values', () => {
      lfuStrategy.set('key1', 'value1');
      lfuStrategy.set('key2', 'value2');
      lfuStrategy.clear();
      expect(lfuStrategy.size).toBe(0);
      expect(lfuStrategy.get('key1')).toBeUndefined();
    });
  });

  describe('LFU Eviction', () => {
    it('should evict least frequently used items when capacity is exceeded', () => {
      lfuStrategy.set('key1', 'value1');
      lfuStrategy.set('key2', 'value2');
      lfuStrategy.set('key3', 'value3');

      // Access key1 multiple times to increase its frequency
      lfuStrategy.get('key1');
      lfuStrategy.get('key1');
      lfuStrategy.get('key1');

      // Access key2 once
      lfuStrategy.get('key2');

      // key3 has only been set (frequency 1)
      // key2 has frequency 2 (set + 1 get)
      // key1 has frequency 4 (set + 3 gets)

      // Add key4, should evict key3 (lowest frequency)
      lfuStrategy.set('key4', 'value4');

      expect(lfuStrategy.size).toBe(3);
      expect(lfuStrategy.has('key1')).toBe(true);
      expect(lfuStrategy.has('key2')).toBe(true);
      expect(lfuStrategy.has('key3')).toBe(false); // Evicted
      expect(lfuStrategy.has('key4')).toBe(true);
    });

    it('should track access frequency correctly', () => {
      lfuStrategy.set('key1', 'value1');

      // Get the key multiple times
      lfuStrategy.get('key1');
      lfuStrategy.get('key1');

      const stats = lfuStrategy.getFrequencyStats();
      expect(stats.minFrequency).toBe(3); // set + 2 gets
      expect(stats.maxFrequency).toBe(3);
    });
  });

  describe('Frequency Tracking', () => {
    it('should provide frequency statistics', () => {
      lfuStrategy.set('key1', 'value1'); // frequency 1
      lfuStrategy.get('key1'); // frequency 2
      lfuStrategy.set('key2', 'value2'); // frequency 1

      const stats = lfuStrategy.getFrequencyStats();
      expect(stats.minFrequency).toBe(1);
      expect(stats.maxFrequency).toBe(2);
      expect(stats.averageFrequency).toBe(1.5);
    });

    it('should maintain frequency distribution', () => {
      lfuStrategy.set('key1', 'value1');
      lfuStrategy.get('key1'); // frequency 2
      lfuStrategy.set('key2', 'value2'); // frequency 1
      lfuStrategy.set('key3', 'value3'); // frequency 1

      const stats = lfuStrategy.getFrequencyStats();
      expect(stats.frequencyDistribution[1]).toBe(2); // key2, key3
      expect(stats.frequencyDistribution[2]).toBe(1); // key1
    });
  });

  describe('TTL Support', () => {
    it('should respect TTL settings', (done) => {
      const shortTtlStrategy = new LFUStrategy({
        maxSize: 10,
        ttl: 50, // 50ms
      });

      shortTtlStrategy.set('key1', 'value1');
      expect(shortTtlStrategy.get('key1')).toBe('value1');

      setTimeout(() => {
        expect(shortTtlStrategy.get('key1')).toBeUndefined();
        done();
      }, 100);
    });

    it('should support per-entry TTL override', (done) => {
      lfuStrategy.set('key1', 'value1', { ttl: 50 });
      lfuStrategy.set('key2', 'value2'); // Uses default TTL

      setTimeout(() => {
        expect(lfuStrategy.get('key1')).toBeUndefined();
        expect(lfuStrategy.get('key2')).toBe('value2');
        done();
      }, 100);
    });

    it('should update TTL on get when configured', () => {
      jest.useFakeTimers();

      try {
        const updateOnGetStrategy = new LFUStrategy({
          maxSize: 10,
          ttl: 100,
          updateAgeOnGet: true,
        });

        updateOnGetStrategy.set('key1', 'value1');

        jest.advanceTimersByTime(60);
        expect(updateOnGetStrategy.get('key1')).toBe('value1');

        jest.advanceTimersByTime(60);
        expect(updateOnGetStrategy.get('key1')).toBe('value1');

        jest.advanceTimersByTime(101);
        expect(updateOnGetStrategy.get('key1')).toBeUndefined();
      } finally {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      }
    });
  });

  describe('Memory Management', () => {
    it('should track cache size', () => {
      expect(lfuStrategy.size).toBe(0);
      lfuStrategy.set('key1', 'value1');
      expect(lfuStrategy.size).toBe(1);
      lfuStrategy.set('key2', 'value2');
      expect(lfuStrategy.size).toBe(2);
    });

    it('should respect max size limit', () => {
      expect(lfuStrategy.maxSize).toBe(3);

      lfuStrategy.set('key1', 'value1');
      lfuStrategy.set('key2', 'value2');
      lfuStrategy.set('key3', 'value3');
      lfuStrategy.set('key4', 'value4'); // Should evict least frequent

      expect(lfuStrategy.size).toBe(3);
    });

    it('should calculate memory size when enabled', () => {
      const memorySizeStrategy = new LFUStrategy({
        maxSize: 10,
        maxMemoryUsage: 1024,
      });

      memorySizeStrategy.set('key1', 'small');
      expect(memorySizeStrategy.memorySize).toBeGreaterThan(0);
    });

    it('should size arrays, primitives, and non-serializable objects consistently', () => {
      const memorySizingStrategy = new LFUStrategy({
        maxSize: 10,
        maxMemoryUsage: 10_000,
      });

      memorySizingStrategy.set('array', [1, 'two', [3]]);
      const afterArray = memorySizingStrategy.memorySize;
      expect(afterArray).toBeGreaterThan(24);

      memorySizingStrategy.set('primitive', 123);
      const afterPrimitive = memorySizingStrategy.memorySize;
      expect(afterPrimitive).toBeGreaterThan(afterArray);

      const circular = {};
      circular.self = circular;
      memorySizingStrategy.set('circular', circular);
      const afterCircular = memorySizingStrategy.memorySize;

      expect(afterCircular - afterPrimitive).toBe(100);
    });
  });

  describe('Expiration handling', () => {
    it('should remove expired entries when checking existence', () => {
      jest.useFakeTimers();

      try {
        jest.setSystemTime(0);

        const expiringStrategy = new LFUStrategy({
          maxSize: 5,
          ttl: 50,
          updateAgeOnGet: false,
        });

        expiringStrategy.set('transient', 'value');

        jest.advanceTimersByTime(60);

        expect(expiringStrategy.has('transient')).toBe(false);
        expect(expiringStrategy.size).toBe(0);
      } finally {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      }
    });
  });

  describe('Iteration Support', () => {
    it('should provide entries iterator', () => {
      lfuStrategy.set('key1', 'value1');
      lfuStrategy.set('key2', 'value2');

      const entries = Array.from(lfuStrategy.entries());
      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual(['key1', 'value1']);
      expect(entries).toContainEqual(['key2', 'value2']);
    });

    it('should provide keys iterator', () => {
      lfuStrategy.set('key1', 'value1');
      lfuStrategy.set('key2', 'value2');

      const keys = Array.from(lfuStrategy.keys());
      expect(keys).toHaveLength(2);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should filter expired entries in iteration', (done) => {
      const shortTtlStrategy = new LFUStrategy({
        maxSize: 10,
        ttl: 50,
      });

      shortTtlStrategy.set('key1', 'value1');
      shortTtlStrategy.set('key2', 'value2');

      setTimeout(() => {
        const keys = Array.from(shortTtlStrategy.keys());
        expect(keys).toHaveLength(0);
        done();
      }, 100);
    });
  });

  describe('Pruning Operations', () => {
    it('should prune expired entries', (done) => {
      const shortTtlStrategy = new LFUStrategy({
        maxSize: 10,
        ttl: 50,
      });

      shortTtlStrategy.set('key1', 'value1');
      shortTtlStrategy.set('key2', 'value2');

      setTimeout(() => {
        const pruned = shortTtlStrategy.prune();
        expect(pruned).toBe(2);
        expect(shortTtlStrategy.size).toBe(0);
        done();
      }, 100);
    });

    it('should support aggressive pruning', () => {
      lfuStrategy.set('key1', 'value1');
      lfuStrategy.set('key2', 'value2');

      const sizeBefore = lfuStrategy.size;
      const pruned = lfuStrategy.prune(true);

      expect(pruned).toBe(sizeBefore);
      expect(lfuStrategy.size).toBe(0);
    });
  });

  describe('Strategy Properties', () => {
    it('should return correct strategy name', () => {
      expect(lfuStrategy.strategyName).toBe('LFU');
    });

    it('should handle different data types', () => {
      const testData = [
        ['string', 'test string'],
        ['number', 42],
        ['boolean', true],
        ['null', null],
        ['object', { key: 'value' }],
        ['array', [1, 2, 3]],
      ];

      testData.forEach(([type, value]) => {
        const key = `key_${type}`;
        lfuStrategy.set(key, value);
        expect(lfuStrategy.get(key)).toEqual(value);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid set/get operations', () => {
      for (let i = 0; i < 100; i++) {
        lfuStrategy.set(`key${i}`, `value${i}`);
        if (i % 10 === 0) {
          // Access every 10th key more frequently
          lfuStrategy.get(`key${i}`);
          lfuStrategy.get(`key${i}`);
        }
      }

      // Should only keep the most recent 3 due to maxSize
      expect(lfuStrategy.size).toBe(3);

      // More frequently accessed keys should be retained
      expect(lfuStrategy.has('key90')).toBe(true);
    });

    it('should handle same key updates correctly', () => {
      lfuStrategy.set('key1', 'value1');
      lfuStrategy.get('key1'); // frequency 2
      lfuStrategy.set('key1', 'value2'); // Should maintain frequency

      expect(lfuStrategy.size).toBe(1);
      expect(lfuStrategy.get('key1')).toBe('value2');

      const stats = lfuStrategy.getFrequencyStats();
      expect(stats.maxFrequency).toBeGreaterThan(1); // Should maintain frequency tracking
    });

    it('should handle frequency overflow gracefully', () => {
      lfuStrategy.set('key1', 'value1');

      // Access key many times
      for (let i = 0; i < 1000; i++) {
        lfuStrategy.get('key1');
      }

      const stats = lfuStrategy.getFrequencyStats();
      expect(stats.maxFrequency).toBe(1001); // set + 1000 gets
      expect(lfuStrategy.get('key1')).toBe('value1');
    });
  });
});
