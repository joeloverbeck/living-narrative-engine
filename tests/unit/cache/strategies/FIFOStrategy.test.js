/**
 * @file Unit tests for FIFO cache strategy
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FIFOStrategy } from '../../../../src/cache/strategies/FIFOStrategy.js';

describe('FIFOStrategy', () => {
  let fifoStrategy;

  beforeEach(() => {
    fifoStrategy = new FIFOStrategy({
      maxSize: 3,
      ttl: 1000, // 1 second for testing
      updateAgeOnGet: true,
    });
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      fifoStrategy.set('key1', 'value1');
      expect(fifoStrategy.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(fifoStrategy.get('nonexistent')).toBeUndefined();
    });

    it('should check if keys exist', () => {
      fifoStrategy.set('key1', 'value1');
      expect(fifoStrategy.has('key1')).toBe(true);
      expect(fifoStrategy.has('nonexistent')).toBe(false);
    });

    it('should delete values', () => {
      fifoStrategy.set('key1', 'value1');
      expect(fifoStrategy.delete('key1')).toBe(true);
      expect(fifoStrategy.get('key1')).toBeUndefined();
      expect(fifoStrategy.delete('nonexistent')).toBe(false);
    });

    it('should clear all values', () => {
      fifoStrategy.set('key1', 'value1');
      fifoStrategy.set('key2', 'value2');
      fifoStrategy.clear();
      expect(fifoStrategy.size).toBe(0);
      expect(fifoStrategy.get('key1')).toBeUndefined();
    });
  });

  describe('FIFO Eviction', () => {
    it('should evict first inserted item when capacity is exceeded', () => {
      fifoStrategy.set('key1', 'value1'); // First in
      fifoStrategy.set('key2', 'value2'); // Second in
      fifoStrategy.set('key3', 'value3'); // Third in
      
      expect(fifoStrategy.size).toBe(3);
      
      // Add fourth item, should evict key1 (first in, first out)
      fifoStrategy.set('key4', 'value4');
      
      expect(fifoStrategy.size).toBe(3);
      expect(fifoStrategy.has('key1')).toBe(false); // Evicted
      expect(fifoStrategy.has('key2')).toBe(true);
      expect(fifoStrategy.has('key3')).toBe(true);
      expect(fifoStrategy.has('key4')).toBe(true);
    });

    it('should maintain insertion order regardless of access patterns', () => {
      fifoStrategy.set('key1', 'value1');
      fifoStrategy.set('key2', 'value2');
      fifoStrategy.set('key3', 'value3');
      
      // Access key1 multiple times (should not affect eviction order in FIFO)
      fifoStrategy.get('key1');
      fifoStrategy.get('key1');
      fifoStrategy.get('key1');
      
      // Add key4, should still evict key1 (oldest insertion)
      fifoStrategy.set('key4', 'value4');
      
      expect(fifoStrategy.has('key1')).toBe(false); // Still evicted despite access
      expect(fifoStrategy.has('key2')).toBe(true);
      expect(fifoStrategy.has('key3')).toBe(true);
      expect(fifoStrategy.has('key4')).toBe(true);
    });

    it('should preserve insertion order in iteration', () => {
      fifoStrategy.set('key3', 'value3');
      fifoStrategy.set('key1', 'value1');
      fifoStrategy.set('key2', 'value2');
      
      const keys = Array.from(fifoStrategy.keys());
      expect(keys).toEqual(['key3', 'key1', 'key2']); // Insertion order preserved
    });
  });

  describe('Insertion Order Tracking', () => {
    it('should provide insertion order statistics', () => {
      fifoStrategy.set('key1', 'value1');
      fifoStrategy.set('key2', 'value2');
      fifoStrategy.set('key3', 'value3');
      
      const stats = fifoStrategy.getInsertionStats();
      expect(stats.oldestKey).toBe('key1');
      expect(stats.newestKey).toBe('key3');
      expect(stats.insertionOrder).toEqual(['key1', 'key2', 'key3']);
      expect(stats.orderIntegrity).toBe(true);
    });

    it('should calculate average age of entries', (done) => {
      fifoStrategy.set('key1', 'value1');
      // Small delay to ensure different timestamps
      setTimeout(() => {
        fifoStrategy.set('key2', 'value2');

        const stats = fifoStrategy.getInsertionStats();
        expect(stats.averageAge).toBeGreaterThan(0);
        done();
      }, 10);
    });

    it('should handle key updates in insertion order', () => {
      fifoStrategy.set('key1', 'value1');
      fifoStrategy.set('key2', 'value2');
      fifoStrategy.set('key1', 'updated_value1'); // Update existing key
      
      const stats = fifoStrategy.getInsertionStats();
      // key1 should now be at the end since it was updated
      expect(stats.insertionOrder).toEqual(['key2', 'key1']);
      expect(stats.newestKey).toBe('key1');
    });
  });

  describe('TTL Support', () => {
    it('should respect TTL settings', (done) => {
      const shortTtlStrategy = new FIFOStrategy({
        maxSize: 10,
        ttl: 200, // 200ms for more reliable timing
      });

      shortTtlStrategy.set('key1', 'value1');
      expect(shortTtlStrategy.get('key1')).toBe('value1');

      setTimeout(() => {
        expect(shortTtlStrategy.get('key1')).toBeUndefined();
        done();
      }, 250); // Wait 250ms to ensure TTL has expired
    });

    it('should support per-entry TTL override', (done) => {
      fifoStrategy.set('key1', 'value1', { ttl: 100 }); // 100ms TTL
      fifoStrategy.set('key2', 'value2'); // Uses default TTL (1000ms)

      setTimeout(() => {
        expect(fifoStrategy.get('key1')).toBeUndefined();
        expect(fifoStrategy.get('key2')).toBe('value2');
        done();
      }, 150); // Wait 150ms, key1 should expire but key2 should remain
    });

    it('should update TTL on get when configured', (done) => {
      const updateOnGetStrategy = new FIFOStrategy({
        maxSize: 10,
        ttl: 300, // 300ms TTL for more reliable timing
        updateAgeOnGet: true,
      });

      updateOnGetStrategy.set('key1', 'value1');

      setTimeout(() => {
        // Access the key to update its TTL (at 100ms)
        expect(updateOnGetStrategy.get('key1')).toBe('value1');

        setTimeout(() => {
          // Should still be available due to TTL update (at 200ms total)
          expect(updateOnGetStrategy.get('key1')).toBe('value1');
          done();
        }, 100);
      }, 100);
    });

    it('should remove expired entries when checking existence', () => {
      jest.useFakeTimers();
      try {
        const shortTtlStrategy = new FIFOStrategy({
          maxSize: 5,
          ttl: 100,
        });

        shortTtlStrategy.set('key1', 'value1');
        jest.advanceTimersByTime(150);

        expect(shortTtlStrategy.has('key1')).toBe(false);
        expect(shortTtlStrategy.size).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('Memory Management', () => {
    it('should track cache size', () => {
      expect(fifoStrategy.size).toBe(0);
      fifoStrategy.set('key1', 'value1');
      expect(fifoStrategy.size).toBe(1);
      fifoStrategy.set('key2', 'value2');
      expect(fifoStrategy.size).toBe(2);
    });

    it('should respect max size limit', () => {
      expect(fifoStrategy.maxSize).toBe(3);
      
      fifoStrategy.set('key1', 'value1');
      fifoStrategy.set('key2', 'value2');
      fifoStrategy.set('key3', 'value3');
      fifoStrategy.set('key4', 'value4'); // Should evict key1
      
      expect(fifoStrategy.size).toBe(3);
    });

    it('should calculate memory size when enabled', () => {
      const memorySizeStrategy = new FIFOStrategy({
        maxSize: 10,
        maxMemoryUsage: 1024,
      });

      memorySizeStrategy.set('key1', 'small');
      expect(memorySizeStrategy.memorySize).toBeGreaterThan(0);
    });

    it('should accurately estimate memory usage for various data types', () => {
      const scenarios = [
        { key: 'string', value: 'data', expectedSize: 8 },
        { key: 'number', value: 123, expectedSize: 8 },
        { key: 'array', value: ['a', 'bc'], expectedSize: 30 },
        { key: 'object', value: { foo: 'bar' }, expectedSize: 26 },
      ];

      scenarios.forEach(({ key, value, expectedSize }) => {
        const strategy = new FIFOStrategy({ maxSize: 5, maxMemoryUsage: 1024 });
        strategy.set(key, value);
        expect(strategy.memorySize).toBe(expectedSize);
      });
    });

    it('should fallback to default size for non-serializable objects', () => {
      const strategy = new FIFOStrategy({ maxSize: 5, maxMemoryUsage: 1024 });
      const circular = {};
      circular.self = circular;

      strategy.set('circular', circular);
      expect(strategy.memorySize).toBe(100);
    });
  });

  describe('Iteration Support', () => {
    it('should provide entries iterator in FIFO order', () => {
      fifoStrategy.set('key1', 'value1');
      fifoStrategy.set('key2', 'value2');
      fifoStrategy.set('key3', 'value3');
      
      const entries = Array.from(fifoStrategy.entries());
      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual(['key1', 'value1']); // First inserted
      expect(entries[1]).toEqual(['key2', 'value2']); // Second inserted
      expect(entries[2]).toEqual(['key3', 'value3']); // Third inserted
    });

    it('should provide keys iterator in FIFO order', () => {
      fifoStrategy.set('key3', 'value3');
      fifoStrategy.set('key1', 'value1');
      fifoStrategy.set('key2', 'value2');
      
      const keys = Array.from(fifoStrategy.keys());
      expect(keys).toEqual(['key3', 'key1', 'key2']); // Insertion order
    });

    it('should filter expired entries in iteration', (done) => {
      const shortTtlStrategy = new FIFOStrategy({
        maxSize: 10,
        ttl: 200, // 200ms for more reliable timing
      });

      shortTtlStrategy.set('key1', 'value1');
      shortTtlStrategy.set('key2', 'value2');

      setTimeout(() => {
        const keys = Array.from(shortTtlStrategy.keys());
        expect(keys).toHaveLength(0);
        done();
      }, 250); // Wait 250ms to ensure TTL has expired
    });
  });

  describe('Pruning Operations', () => {
    it('should prune expired entries', (done) => {
      const shortTtlStrategy = new FIFOStrategy({
        maxSize: 10,
        ttl: 200, // 200ms for more reliable timing
      });

      shortTtlStrategy.set('key1', 'value1');
      shortTtlStrategy.set('key2', 'value2');

      setTimeout(() => {
        const pruned = shortTtlStrategy.prune();
        expect(pruned).toBe(2);
        expect(shortTtlStrategy.size).toBe(0);
        done();
      }, 250); // Wait 250ms to ensure TTL has expired
    });

    it('should support aggressive pruning', () => {
      fifoStrategy.set('key1', 'value1');
      fifoStrategy.set('key2', 'value2');
      
      const sizeBefore = fifoStrategy.size;
      const pruned = fifoStrategy.prune(true);
      
      expect(pruned).toBe(sizeBefore);
      expect(fifoStrategy.size).toBe(0);
    });

    it('should not prune non-expired entries in normal pruning', () => {
      fifoStrategy.set('key1', 'value1');
      fifoStrategy.set('key2', 'value2');
      
      const pruned = fifoStrategy.prune(false);
      
      expect(pruned).toBe(0);
      expect(fifoStrategy.size).toBe(2);
    });
  });

  describe('Strategy Properties', () => {
    it('should return correct strategy name', () => {
      expect(fifoStrategy.strategyName).toBe('FIFO');
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
        fifoStrategy.set(key, value);
        expect(fifoStrategy.get(key)).toEqual(value);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid set operations maintaining FIFO order', () => {
      const keys = [];
      for (let i = 0; i < 10; i++) {
        const key = `key${i}`;
        fifoStrategy.set(key, `value${i}`);
        keys.push(key);
      }
      
      // Should only keep the most recent 3 due to maxSize (FIFO eviction)
      expect(fifoStrategy.size).toBe(3);
      expect(fifoStrategy.has('key7')).toBe(true); // 8th inserted
      expect(fifoStrategy.has('key8')).toBe(true); // 9th inserted
      expect(fifoStrategy.has('key9')).toBe(true); // 10th inserted
      expect(fifoStrategy.has('key0')).toBe(false); // First inserted, first evicted
    });

    it('should handle same key updates correctly', () => {
      fifoStrategy.set('key1', 'value1');
      fifoStrategy.set('key2', 'value2');
      fifoStrategy.set('key1', 'updated_value1'); // Update moves to end
      
      expect(fifoStrategy.size).toBe(2);
      expect(fifoStrategy.get('key1')).toBe('updated_value1');
      
      const stats = fifoStrategy.getInsertionStats();
      expect(stats.insertionOrder).toEqual(['key2', 'key1']); // key1 moved to end
    });

    it('should maintain order integrity after deletions', () => {
      fifoStrategy.set('key1', 'value1');
      fifoStrategy.set('key2', 'value2');
      fifoStrategy.set('key3', 'value3');
      
      fifoStrategy.delete('key2'); // Delete middle item
      
      const stats = fifoStrategy.getInsertionStats();
      expect(stats.insertionOrder).toEqual(['key1', 'key3']);
      expect(stats.orderIntegrity).toBe(true);
    });

    it('should handle empty cache operations gracefully', () => {
      expect(fifoStrategy.size).toBe(0);
      expect(fifoStrategy.get('key1')).toBeUndefined();
      expect(fifoStrategy.delete('key1')).toBe(false);
      expect(fifoStrategy.has('key1')).toBe(false);
      
      const stats = fifoStrategy.getInsertionStats();
      expect(stats.oldestKey).toBeNull();
      expect(stats.newestKey).toBeNull();
      expect(stats.orderIntegrity).toBe(true);
    });
  });
});