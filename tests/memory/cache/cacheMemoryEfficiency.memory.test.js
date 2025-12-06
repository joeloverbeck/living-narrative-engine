/**
 * @file Memory efficiency tests for unified cache infrastructure
 * Tests memory usage under load, memory-based eviction, and memory pressure handling
 * Extracted from performance test suite - these are memory-specific tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { UnifiedCache } from '../../../src/cache/UnifiedCache.js';

describe('Cache Memory Efficiency Tests', () => {
  let testBed;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    // Force garbage collection before each test
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    testBed.cleanup();

    // Force garbage collection after each test
    if (global.gc) {
      global.gc();
    }
  });

  describe('Memory Usage Under Load', () => {
    it('should maintain efficient memory usage under load', () => {
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 5000,
          maxMemoryUsage: 1024 * 1024, // 1MB limit
          evictionPolicy: 'lru',
        }
      );

      // Add data that should trigger memory-based eviction
      const largeDataSize = 1000; // Characters per entry
      const itemCount = 2000;

      for (let i = 0; i < itemCount; i++) {
        const largeValue = {
          id: i,
          data: Array(largeDataSize).fill(`x${i}`).join(''),
          metadata: {
            created: Date.now(),
            accessed: 0,
            version: 1,
          },
        };
        cache.set(`large:item${i}`, largeValue);
      }

      const metrics = cache.getMetrics();
      const memoryUsage = cache.getMemoryUsage();

      // Cache should respect size limits due to memory constraints
      expect(metrics.size).toBeLessThan(itemCount);

      // Memory usage should be within configured limit (allow 10% overhead for lru-cache implementation)
      expect(memoryUsage.currentBytes).toBeLessThanOrEqual(1024 * 1024 * 1.1);

      // Utilization should be tracked correctly
      expect(memoryUsage.utilizationPercent).toBeLessThanOrEqual(110);

      console.log(
        `Memory Efficiency: ${metrics.size} items cached from ${itemCount} total`
      );
      console.log(
        `Cache memory usage: ${memoryUsage.currentMB.toFixed(2)} MB (${memoryUsage.utilizationPercent.toFixed(1)}% of limit)`
      );
    });

    it('should handle memory pressure gracefully', () => {
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 10000,
          maxMemoryUsage: 512 * 1024, // Tight 512KB limit
          evictionPolicy: 'lru',
        }
      );

      let successfulSets = 0;
      let totalAttempts = 5000;

      // Try to add more data than memory limit allows
      for (let i = 0; i < totalAttempts; i++) {
        const data = {
          id: i,
          payload: Array(200).fill(`data${i}`).join(''), // ~1KB per entry
          timestamp: Date.now(),
        };

        cache.set(`memory:test${i}`, data);
        successfulSets++;

        // Check if we've hit memory limits
        const memoryUsage = cache.getMemoryUsage();
        if (memoryUsage.utilizationPercent > 95) {
          break;
        }
      }

      const finalMetrics = cache.getMetrics();
      const finalMemoryUsage = cache.getMemoryUsage();

      // Should handle memory pressure without crashing
      expect(finalMemoryUsage.utilizationPercent).toBeLessThanOrEqual(110); // Allow 10% overhead

      // The cache should have fewer items than attempts due to memory limits
      expect(finalMetrics.size).toBeLessThan(totalAttempts);

      console.log(
        `Memory Pressure Test: ${successfulSets}/${totalAttempts} items set`
      );
      console.log(
        `Final: ${finalMetrics.size} items, ${finalMemoryUsage.utilizationPercent.toFixed(1)}% memory utilization`
      );
      console.log(
        `Memory usage: ${finalMemoryUsage.currentMB.toFixed(2)} MB of ${finalMemoryUsage.maxMB} MB limit`
      );
    });
  });

  describe('Memory-Based Eviction', () => {
    it('should evict items based on memory constraints', () => {
      const memoryLimit = 256 * 1024; // 256KB
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 1000, // High item limit, memory should be the constraint
          maxMemoryUsage: memoryLimit,
          evictionPolicy: 'lru',
        }
      );

      const itemSize = 1024; // ~1KB per item
      let itemsAdded = 0;

      // Add items until memory limit is approached
      for (let i = 0; i < 500; i++) {
        const data = {
          id: i,
          content: Array(itemSize).fill(`item${i}`).join(''),
          metadata: { timestamp: Date.now() },
        };

        cache.set(`eviction:test${i}`, data);
        itemsAdded++;
      }

      const metrics = cache.getMetrics();
      const memoryUsage = cache.getMemoryUsage();

      // Items should have been evicted to maintain memory limit
      expect(metrics.size).toBeLessThan(itemsAdded);

      // Memory usage should be close to but not exceed limit (with small overhead allowance)
      expect(memoryUsage.currentBytes).toBeLessThanOrEqual(memoryLimit * 1.1);

      // Calculate rough eviction effectiveness
      const theoreticalMax = memoryLimit / (itemSize * 2); // Rough estimate
      expect(metrics.size).toBeLessThan(theoreticalMax * 1.5); // Should be reasonably efficient

      console.log(
        `Eviction Test: ${metrics.size}/${itemsAdded} items retained`
      );
      console.log(
        `Memory: ${memoryUsage.currentBytes} bytes (${memoryUsage.utilizationPercent.toFixed(1)}% of ${memoryLimit} byte limit)`
      );
    });

    it('should evict items when memory limit is reached', () => {
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 100,
          maxMemoryUsage: 128 * 1024, // 128KB
          evictionPolicy: 'lru',
        }
      );

      // Add items that will exceed memory limit
      const itemsAdded = 100;
      for (let i = 0; i < itemsAdded; i++) {
        cache.set(`lru:${i}`, {
          id: i,
          data: Array(500).fill(`data${i}`).join(''),
        });
      }

      const metrics = cache.getMetrics();
      const memoryUsage = cache.getMemoryUsage();

      // Cache should have evicted items to stay within limits
      expect(metrics.size).toBeLessThanOrEqual(100);
      expect(metrics.size).toBeLessThan(itemsAdded); // Some eviction occurred

      // Memory should be within configured limit (with overhead)
      expect(memoryUsage.currentBytes).toBeLessThanOrEqual(128 * 1024 * 1.1);

      console.log(`LRU Eviction: ${metrics.size}/${itemsAdded} items retained`);
      console.log(
        `Memory: ${memoryUsage.currentBytes} bytes (${memoryUsage.utilizationPercent.toFixed(1)}% of limit)`
      );
    });
  });

  describe('Memory Pressure Scenarios', () => {
    it('should handle extreme memory constraints', () => {
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 5, // Very low to ensure memory constraint is tested
          maxMemoryUsage: 32 * 1024, // 32KB very tight limit
          evictionPolicy: 'fifo',
        }
      );

      let errorCount = 0;
      const totalOperations = 200;

      // Attempt operations under extreme constraints
      for (let i = 0; i < totalOperations; i++) {
        try {
          const data = {
            id: i,
            content: Array(200).fill(`extreme${i}`).join(''),
          };

          cache.set(`extreme:${i}`, data);

          // Try reads
          cache.get(`extreme:${Math.max(0, i - 2)}`);
          cache.has(`extreme:${Math.max(0, i - 1)}`);
        } catch (error) {
          errorCount++;
        }
      }

      const metrics = cache.getMetrics();
      const memoryUsage = cache.getMemoryUsage();

      // Should complete without errors
      expect(errorCount).toBe(0);

      // Should maintain some items
      expect(metrics.size).toBeGreaterThan(0);
      expect(metrics.size).toBeLessThanOrEqual(5);

      // Memory should be controlled (allow significant overhead for lru-cache internals)
      expect(memoryUsage.currentBytes).toBeLessThan(150 * 1024); // Allow up to 150KB for internal structures

      console.log(
        `Extreme Constraints: ${totalOperations} operations, ${metrics.size} items retained, ${errorCount} errors`
      );
      console.log(
        `Memory: ${memoryUsage.currentBytes} bytes (${memoryUsage.utilizationPercent?.toFixed(1) || 'N/A'}%)`
      );
    });

    it('should recover from memory pressure when load decreases', () => {
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 500,
          maxMemoryUsage: 256 * 1024, // 256KB
          evictionPolicy: 'lru',
        }
      );

      // Phase 1: Apply memory pressure
      for (let i = 0; i < 200; i++) {
        cache.set(`pressure:${i}`, {
          id: i,
          data: Array(800).fill(`pressure${i}`).join(''),
        });
      }

      const pressureMetrics = cache.getMetrics();
      const pressureMemory = cache.getMemoryUsage();

      // Phase 2: Reduce load with smaller items
      for (let i = 200; i < 300; i++) {
        cache.set(`normal:${i}`, {
          id: i,
          data: `small${i}`,
        });
      }

      const recoveryMetrics = cache.getMetrics();
      const recoveryMemory = cache.getMemoryUsage();

      // Cache should handle both phases
      expect(pressureMetrics.size).toBeLessThan(200);
      expect(recoveryMetrics.size).toBeGreaterThan(0);

      // Memory should stay within limits in both phases
      expect(pressureMemory.utilizationPercent).toBeLessThanOrEqual(110);
      expect(recoveryMemory.utilizationPercent).toBeLessThanOrEqual(110);

      console.log(
        `Pressure Phase: ${pressureMetrics.size} items, ${pressureMemory.utilizationPercent.toFixed(1)}% utilization`
      );
      console.log(
        `Recovery Phase: ${recoveryMetrics.size} items, ${recoveryMemory.utilizationPercent.toFixed(1)}% utilization`
      );
    });
  });

  describe('Memory Monitoring', () => {
    it('should accurately report memory usage statistics', () => {
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 100,
          maxMemoryUsage: 512 * 1024, // 512KB
          evictionPolicy: 'lru',
        }
      );

      // Add known data size
      const itemCount = 50;
      const itemSize = 500; // Approximate characters

      for (let i = 0; i < itemCount; i++) {
        cache.set(`monitor:${i}`, {
          id: i,
          data: Array(itemSize).fill(`x${i}`).join(''),
        });
      }

      const memoryUsage = cache.getMemoryUsage();

      // Verify all fields are present and valid
      expect(memoryUsage.currentBytes).toBeGreaterThan(0);
      expect(memoryUsage.currentMB).toBeGreaterThan(0);
      expect(memoryUsage.maxBytes).toBe(512 * 1024);
      expect(memoryUsage.maxMB).toBeCloseTo(0.5, 1);
      expect(memoryUsage.utilizationPercent).toBeGreaterThan(0);
      expect(memoryUsage.utilizationPercent).toBeLessThan(100);

      // Verify consistency between bytes and MB
      expect(memoryUsage.currentBytes / (1024 * 1024)).toBeCloseTo(
        memoryUsage.currentMB,
        5
      );

      console.log(`Memory Monitoring: ${itemCount} items`);
      console.log(
        `  Current: ${memoryUsage.currentBytes} bytes (${memoryUsage.currentMB.toFixed(3)} MB)`
      );
      console.log(
        `  Maximum: ${memoryUsage.maxBytes} bytes (${memoryUsage.maxMB} MB)`
      );
      console.log(
        `  Utilization: ${memoryUsage.utilizationPercent.toFixed(2)}%`
      );
    });

    it('should track memory changes during cache operations', () => {
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 200,
          maxMemoryUsage: 1024 * 1024, // 1MB
          evictionPolicy: 'lru',
        }
      );

      // Initial state
      const initialMemory = cache.getMemoryUsage();
      expect(initialMemory.currentBytes).toBe(0);

      // Add items and track growth
      const snapshots = [];
      for (let i = 0; i < 100; i++) {
        cache.set(`track:${i}`, {
          id: i,
          data: Array(300).fill(`data${i}`).join(''),
        });

        if (i % 20 === 0) {
          snapshots.push(cache.getMemoryUsage());
        }
      }

      // Memory should increase with additions
      for (let i = 1; i < snapshots.length; i++) {
        expect(snapshots[i].currentBytes).toBeGreaterThanOrEqual(
          snapshots[i - 1].currentBytes
        );
      }

      // Delete items and track decrease
      for (let i = 0; i < 50; i++) {
        cache.delete(`track:${i}`);
      }

      const afterDelete = cache.getMemoryUsage();
      expect(afterDelete.currentBytes).toBeLessThan(
        snapshots[snapshots.length - 1].currentBytes
      );

      console.log(
        `Memory Tracking: Initial ${initialMemory.currentBytes}B → Peak ${snapshots[snapshots.length - 1].currentBytes}B → After Delete ${afterDelete.currentBytes}B`
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle memory calculation for various data types', () => {
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 50,
          maxMemoryUsage: 256 * 1024,
          evictionPolicy: 'lru',
        }
      );

      // Different data types
      const testCases = {
        string: 'simple string',
        longString: Array(1000).fill('x').join(''),
        number: 12345,
        boolean: true,
        null: null,
        array: [1, 2, 3, 4, 5],
        nestedArray: [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
        object: { key: 'value', nested: { deep: 'data' } },
        complexObject: {
          str: 'text',
          num: 123,
          arr: [1, 2, 3],
          obj: { a: 1, b: 2 },
          date: new Date(),
          regex: /test/g,
        },
      };

      Object.entries(testCases).forEach(([key, value]) => {
        cache.set(key, value);
      });

      const memoryUsage = cache.getMemoryUsage();
      const metrics = cache.getMetrics();

      // Should handle all types without errors
      expect(metrics.size).toBe(Object.keys(testCases).length);
      expect(memoryUsage.currentBytes).toBeGreaterThan(0);

      console.log(
        `Edge Cases: ${metrics.size} different data types, ${memoryUsage.currentBytes} bytes total`
      );
    });

    it('should handle memory usage with undefined and non-serializable values', () => {
      const cache = new UnifiedCache(
        { logger: mockLogger },
        {
          maxSize: 20,
          maxMemoryUsage: 128 * 1024,
          evictionPolicy: 'lru',
        }
      );

      // Try to cache problematic values
      const problematic = {
        withFunction: { id: 1, fn: () => 'test' },
        withSymbol: { id: 2, sym: Symbol('test') },
        withCircular: (() => {
          const obj = { id: 3 };
          obj.self = obj;
          return obj;
        })(),
      };

      // Should handle without crashing
      expect(() => {
        Object.entries(problematic).forEach(([key, value]) => {
          cache.set(key, value);
        });
      }).not.toThrow();

      const memoryUsage = cache.getMemoryUsage();

      // Memory should be tracked (using fallback calculations for non-serializable)
      expect(memoryUsage.currentBytes).toBeGreaterThan(0);

      console.log(
        `Problematic Values: ${cache.getMetrics().size} items, ${memoryUsage.currentBytes} bytes`
      );
    });
  });
});
