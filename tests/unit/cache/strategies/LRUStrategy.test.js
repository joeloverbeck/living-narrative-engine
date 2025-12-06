/**
 * @file Unit tests for LRU cache strategy
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LRUStrategy } from '../../../../src/cache/strategies/LRUStrategy.js';

describe('LRUStrategy', () => {
  let lruStrategy;

  beforeEach(() => {
    lruStrategy = new LRUStrategy({
      maxSize: 3,
      ttl: 1000, // 1 second for testing
      updateAgeOnGet: true,
    });
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      lruStrategy.set('key1', 'value1');
      expect(lruStrategy.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(lruStrategy.get('nonexistent')).toBeUndefined();
    });

    it('should check if keys exist', () => {
      lruStrategy.set('key1', 'value1');
      expect(lruStrategy.has('key1')).toBe(true);
      expect(lruStrategy.has('nonexistent')).toBe(false);
    });

    it('should delete values', () => {
      lruStrategy.set('key1', 'value1');
      expect(lruStrategy.delete('key1')).toBe(true);
      expect(lruStrategy.get('key1')).toBeUndefined();
      expect(lruStrategy.delete('nonexistent')).toBe(false);
    });

    it('should clear all values', () => {
      lruStrategy.set('key1', 'value1');
      lruStrategy.set('key2', 'value2');
      lruStrategy.clear();
      expect(lruStrategy.size).toBe(0);
      expect(lruStrategy.get('key1')).toBeUndefined();
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used items when capacity is exceeded', () => {
      lruStrategy.set('key1', 'value1');
      lruStrategy.set('key2', 'value2');
      lruStrategy.set('key3', 'value3');

      // All should be present
      expect(lruStrategy.size).toBe(3);

      // Access key1 to make it most recently used
      lruStrategy.get('key1');

      // Add key4, should evict key2 (least recently used)
      lruStrategy.set('key4', 'value4');

      expect(lruStrategy.size).toBe(3);
      expect(lruStrategy.has('key1')).toBe(true);
      expect(lruStrategy.has('key2')).toBe(false);
      expect(lruStrategy.has('key3')).toBe(true);
      expect(lruStrategy.has('key4')).toBe(true);
    });

    it('should update order on get operations', () => {
      lruStrategy.set('key1', 'value1');
      lruStrategy.set('key2', 'value2');
      lruStrategy.set('key3', 'value3');

      // Access key1 to make it most recently used
      lruStrategy.get('key1');

      // Add key4, should evict key2 (oldest not accessed)
      lruStrategy.set('key4', 'value4');

      expect(lruStrategy.has('key1')).toBe(true);
      expect(lruStrategy.has('key2')).toBe(false);
    });
  });

  describe('TTL Support', () => {
    it('should respect TTL settings', (done) => {
      const shortTtlStrategy = new LRUStrategy({
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
      lruStrategy.set('key1', 'value1', { ttl: 50 });
      lruStrategy.set('key2', 'value2'); // Uses default TTL (1000ms)

      expect(lruStrategy.get('key1')).toBe('value1');
      expect(lruStrategy.get('key2')).toBe('value2');

      setTimeout(() => {
        expect(lruStrategy.get('key1')).toBeUndefined();
        expect(lruStrategy.get('key2')).toBe('value2');
        done();
      }, 100);
    });
  });

  describe('Memory Management', () => {
    it('should track cache size', () => {
      expect(lruStrategy.size).toBe(0);
      lruStrategy.set('key1', 'value1');
      expect(lruStrategy.size).toBe(1);
      lruStrategy.set('key2', 'value2');
      expect(lruStrategy.size).toBe(2);
    });

    it('should respect max size limit', () => {
      expect(lruStrategy.maxSize).toBe(3);

      lruStrategy.set('key1', 'value1');
      lruStrategy.set('key2', 'value2');
      lruStrategy.set('key3', 'value3');
      lruStrategy.set('key4', 'value4'); // Should evict key1

      expect(lruStrategy.size).toBe(3);
    });

    it('should calculate memory size when enabled', () => {
      const memorySizeStrategy = new LRUStrategy({
        maxSize: 10,
        maxMemoryUsage: 1024,
      });

      memorySizeStrategy.set('key1', 'small');
      expect(memorySizeStrategy.memorySize).toBeGreaterThan(0);
    });
  });

  describe('Iteration Support', () => {
    it('should provide entries iterator', () => {
      lruStrategy.set('key1', 'value1');
      lruStrategy.set('key2', 'value2');

      const entries = Array.from(lruStrategy.entries());
      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual(['key1', 'value1']);
      expect(entries).toContainEqual(['key2', 'value2']);
    });

    it('should provide keys iterator', () => {
      lruStrategy.set('key1', 'value1');
      lruStrategy.set('key2', 'value2');

      const keys = Array.from(lruStrategy.keys());
      expect(keys).toHaveLength(2);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });

  describe('Pruning Operations', () => {
    it('should prune expired entries', (done) => {
      const shortTtlStrategy = new LRUStrategy({
        maxSize: 10,
        ttl: 50,
      });

      shortTtlStrategy.set('key1', 'value1');
      shortTtlStrategy.set('key2', 'value2');

      setTimeout(() => {
        const pruned = shortTtlStrategy.prune();
        expect(pruned).toBeGreaterThan(0);
        expect(shortTtlStrategy.size).toBe(0);
        done();
      }, 100);
    });

    it('should support aggressive pruning', () => {
      lruStrategy.set('key1', 'value1');
      lruStrategy.set('key2', 'value2');

      const sizeBefore = lruStrategy.size;
      const pruned = lruStrategy.prune(true);

      expect(pruned).toBe(sizeBefore);
      expect(lruStrategy.size).toBe(0);
    });
  });

  describe('Strategy Properties', () => {
    it('should return correct strategy name', () => {
      expect(lruStrategy.strategyName).toBe('LRU');
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
        lruStrategy.set(key, value);
        expect(lruStrategy.get(key)).toEqual(value);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid set/get operations', () => {
      for (let i = 0; i < 100; i++) {
        lruStrategy.set(`key${i}`, `value${i}`);
      }

      // Should only keep the most recent 3 due to maxSize
      expect(lruStrategy.size).toBe(3);
      expect(lruStrategy.has('key99')).toBe(true);
      expect(lruStrategy.has('key98')).toBe(true);
      expect(lruStrategy.has('key97')).toBe(true);
      expect(lruStrategy.has('key0')).toBe(false);
    });

    it('should handle same key updates', () => {
      lruStrategy.set('key1', 'value1');
      lruStrategy.set('key1', 'value2');

      expect(lruStrategy.size).toBe(1);
      expect(lruStrategy.get('key1')).toBe('value2');
    });
  });
});
