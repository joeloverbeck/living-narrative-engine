/**
 * @file Unit tests for SuspiciousPatternsManager class
 * @description Tests for LRU eviction, automatic cleanup, and memory management
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import { SuspiciousPatternsManager } from '../../../src/middleware/rateLimiting.js';

describe('SuspiciousPatternsManager', () => {
  beforeEach(() => {
    // Use Jest fake timers for controlled testing
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Clear any pending timers first
    jest.clearAllTimers();
    // Restore real timers
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  /**
   * Helper function to create a SuspiciousPatternsManager for testing
   * @param {object} options - Configuration options for the manager
   * @returns {SuspiciousPatternsManager} New instance
   */
  function createSuspiciousPatternsManager(options = {}) {
    return new SuspiciousPatternsManager(options);
  }

  describe('Basic Operations', () => {
    it('should set and get patterns correctly', () => {
      const manager = createSuspiciousPatternsManager();
      const pattern = {
        requests: [Date.now()],
        suspiciousScore: 1,
        lastRequest: Date.now(),
      };

      manager.set('test-key', pattern);
      const retrieved = manager.get('test-key');

      expect(retrieved).toBeDefined();
      expect(retrieved.suspiciousScore).toBe(1);
      expect(retrieved.requests).toHaveLength(1);
    });

    it('should delete patterns correctly', () => {
      const manager = createSuspiciousPatternsManager();
      const pattern = { requests: [], suspiciousScore: 0 };

      manager.set('test-key', pattern);
      expect(manager.get('test-key')).toBeDefined();

      manager.delete('test-key');
      expect(manager.get('test-key')).toBeUndefined();
    });

    it('should return correct size', () => {
      const manager = createSuspiciousPatternsManager();

      expect(manager.size()).toBe(0);

      manager.set('key1', { requests: [] });
      expect(manager.size()).toBe(1);

      manager.set('key2', { requests: [] });
      expect(manager.size()).toBe(2);

      manager.delete('key1');
      expect(manager.size()).toBe(1);
    });

    it('should clear all patterns', () => {
      const manager = createSuspiciousPatternsManager();

      manager.set('key1', { requests: [] });
      manager.set('key2', { requests: [] });
      expect(manager.size()).toBe(2);

      manager.clear();
      expect(manager.size()).toBe(0);
      expect(manager.get('key1')).toBeUndefined();
      expect(manager.get('key2')).toBeUndefined();
    });
  });

  describe('LRU Eviction', () => {
    it('should enforce size limits with LRU eviction', () => {
      const maxSize = 3;
      const manager = createSuspiciousPatternsManager({ maxSize });

      // Add entries up to the limit
      manager.set('key1', { requests: [] });
      manager.set('key2', { requests: [] });
      manager.set('key3', { requests: [] });
      expect(manager.size()).toBe(3);

      // Add one more to trigger eviction
      manager.set('key4', { requests: [] });
      expect(manager.size()).toBe(3);

      // The least recently used (key1) should be evicted
      expect(manager.get('key1')).toBeUndefined();
      expect(manager.get('key4')).toBeDefined();
    });

    it('should update access order when getting patterns', () => {
      const maxSize = 2;
      const manager = createSuspiciousPatternsManager({ maxSize });

      manager.set('key1', { requests: [] });
      jest.advanceTimersByTime(10); // Advance time to ensure different timestamps

      manager.set('key2', { requests: [] });
      jest.advanceTimersByTime(10); // Advance time to ensure different timestamps

      // Access key1 to make it more recently used
      manager.get('key1');
      jest.advanceTimersByTime(10); // Advance time to ensure different timestamps

      // Add a new entry to trigger eviction
      manager.set('key3', { requests: [] });

      // key2 should be evicted (least recently used), key1 should remain
      expect(manager.get('key1')).toBeDefined();
      expect(manager.get('key2')).toBeUndefined();
      expect(manager.get('key3')).toBeDefined();
    });

    it('should handle rapid additions without errors', () => {
      const maxSize = 5;
      const manager = createSuspiciousPatternsManager({ maxSize });

      // Rapidly add many entries
      for (let i = 0; i < 20; i++) {
        manager.set(`key${i}`, {
          requests: [Date.now()],
          suspiciousScore: i % 10,
        });
      }

      expect(manager.size()).toBe(maxSize);

      // Should contain the most recent entries
      expect(manager.get('key19')).toBeDefined();
      expect(manager.get('key18')).toBeDefined();
      expect(manager.get('key0')).toBeUndefined();
    });
  });

  describe('Automatic Cleanup', () => {
    it('should clean up expired entries', () => {
      const maxAge = 1000; // 1 second
      const manager = createSuspiciousPatternsManager({ maxAge });

      const oldTimestamp = Date.now() - maxAge - 100; // Already expired
      const newTimestamp = Date.now(); // Fresh

      // Manually add patterns with different timestamps
      manager.patterns.set('old-key', {
        requests: [],
        suspiciousScore: 1,
        updatedAt: oldTimestamp,
        createdAt: oldTimestamp,
      });

      manager.patterns.set('new-key', {
        requests: [],
        suspiciousScore: 1,
        updatedAt: newTimestamp,
        createdAt: newTimestamp,
      });

      expect(manager.size()).toBe(2);

      // Trigger cleanup
      const cleaned = manager.cleanupExpired();

      expect(cleaned).toBe(1);
      expect(manager.get('old-key')).toBeUndefined();
      expect(manager.get('new-key')).toBeDefined();
    });

    it('should provide accurate statistics', () => {
      const manager = createSuspiciousPatternsManager();

      const now = Date.now();
      manager.set('key1', {
        requests: [now, now - 1000, now - 2000],
        suspiciousScore: 2,
      });
      manager.set('key2', {
        requests: [now],
        suspiciousScore: 1,
      });

      const stats = manager.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.totalRequestsTracked).toBe(4); // 3 + 1
      expect(stats.expiredEntries).toBe(0); // Nothing expired yet
      expect(typeof stats.lastCleanup).toBe('number');
      expect(typeof stats.timeSinceLastCleanup).toBe('number');
    });

    it('should schedule cleanup when minimum interval has passed', () => {
      const manager = createSuspiciousPatternsManager({
        minCleanupInterval: 100,
      });

      // Set lastCleanup to past to allow scheduling
      manager.lastCleanup = Date.now() - 200;

      const pattern = { requests: [], suspiciousScore: 0 };
      manager.set('test-key', pattern);

      // Verify cleanup timer was scheduled by checking if it exists
      expect(manager.cleanupTimer).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should handle large numbers of patterns efficiently', () => {
      const maxSize = 1000;
      const manager = createSuspiciousPatternsManager({ maxSize });

      const startTime = performance.now();

      // Add many patterns
      for (let i = 0; i < maxSize * 2; i++) {
        manager.set(`key${i}`, {
          requests: [Date.now()],
          suspiciousScore: i % 10,
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(manager.size()).toBe(maxSize);
      expect(duration).toBeLessThan(1000); // Should complete quickly
    });

    it('should maintain consistent performance with frequent access', () => {
      const manager = createSuspiciousPatternsManager({ maxSize: 100 });

      // Add initial patterns
      for (let i = 0; i < 50; i++) {
        manager.set(`key${i}`, { requests: [], suspiciousScore: 0 });
      }

      const iterations = 1000;
      const startTime = performance.now();

      // Frequent get/set operations
      for (let i = 0; i < iterations; i++) {
        const key = `key${i % 50}`;
        const pattern = manager.get(key) || {
          requests: [],
          suspiciousScore: 0,
        };
        pattern.requests.push(Date.now());
        manager.set(key, pattern);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(0.5); // Less than 0.5ms per operation
    });

    it('should handle concurrent modifications safely', async () => {
      const manager = createSuspiciousPatternsManager({ maxSize: 20 });

      // Simulate concurrent operations
      const operations = [];

      for (let i = 0; i < 50; i++) {
        operations.push(
          Promise.resolve().then(() => {
            manager.set(`concurrent-key-${i}`, {
              requests: [Date.now()],
              suspiciousScore: i % 5,
            });
          })
        );
      }

      await Promise.all(operations);

      expect(manager.size()).toBeLessThanOrEqual(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values gracefully', () => {
      const manager = createSuspiciousPatternsManager();

      expect(() => {
        manager.set('null-key', null);
        manager.set('undefined-key', undefined);
        manager.get('null-key');
        manager.get('undefined-key');
        manager.delete('nonexistent-key');
      }).not.toThrow();
    });

    it('should ignore non-string keys safely', () => {
      const manager = createSuspiciousPatternsManager();

      manager.set(123, { requests: [] });
      manager.set('', { requests: [] });

      expect(manager.size()).toBe(0);
      expect(manager.get(123)).toBeUndefined();

      manager.delete(123);
      expect(manager.size()).toBe(0);
    });

    it('should return undefined for non-string keys during get', () => {
      const manager = createSuspiciousPatternsManager();

      expect(manager.get(undefined)).toBeUndefined();
      expect(manager.get(42)).toBeUndefined();
    });

    it('should handle empty patterns correctly', () => {
      const manager = createSuspiciousPatternsManager();

      manager.set('empty-key', {});
      const retrieved = manager.get('empty-key');

      expect(retrieved).toBeDefined();
      expect(retrieved.createdAt).toBeDefined();
      expect(retrieved.updatedAt).toBeDefined();
    });

    it('should handle patterns with missing fields', () => {
      const manager = createSuspiciousPatternsManager();

      const incompletePattern = {
        // Missing requests array
        suspiciousScore: 3,
      };

      manager.set('incomplete-key', incompletePattern);
      const retrieved = manager.get('incomplete-key');

      expect(retrieved).toBeDefined();
      expect(retrieved.suspiciousScore).toBe(3);
    });

    it('should handle timestamp edge cases', () => {
      const manager = createSuspiciousPatternsManager();

      // Test with extreme timestamps
      const pattern = {
        requests: [0, Number.MAX_SAFE_INTEGER],
        suspiciousScore: 1,
      };

      expect(() => {
        manager.set('edge-case-key', pattern);
        manager.get('edge-case-key');
        manager.cleanupExpired();
      }).not.toThrow();
    });

    it('should maintain consistency after cleanup errors', () => {
      const manager = createSuspiciousPatternsManager();

      // Add some patterns
      manager.set('key1', { requests: [] });
      manager.set('key2', { requests: [] });

      // Mock a potential error scenario
      const originalDelete = manager.delete;
      let deleteCallCount = 0;
      manager.delete = function (key) {
        deleteCallCount++;
        if (deleteCallCount === 1) {
          throw new Error('Simulated deletion error');
        }
        return originalDelete.call(this, key);
      };

      // Cleanup should handle errors gracefully
      expect(() => {
        manager.cleanupExpired();
      }).not.toThrow();

      // Manager should still be functional
      expect(manager.size()).toBeGreaterThan(0);
      manager.set('key3', { requests: [] });
      expect(manager.get('key3')).toBeDefined();
    });

    it('should report expired entries in statistics', () => {
      const manager = createSuspiciousPatternsManager();
      const now = Date.now();

      manager.patterns.set('expired', {
        requests: [now - manager.maxAge - 10],
        suspiciousScore: 0,
        updatedAt: now - manager.maxAge - 10,
        createdAt: now - manager.maxAge - 20,
      });

      manager.patterns.set('active', {
        requests: [now],
        suspiciousScore: 0,
        updatedAt: now,
        createdAt: now,
      });

      const stats = manager.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.expiredEntries).toBe(1);
      expect(stats.totalRequestsTracked).toBe(2);
    });

    it('should respect batch size limits during cleanup', () => {
      const manager = createSuspiciousPatternsManager();
      const expiredTime = Date.now() - manager.maxAge - 1;

      manager.patterns.set('first', {
        requests: [],
        suspiciousScore: 0,
        updatedAt: expiredTime,
        createdAt: expiredTime,
      });

      manager.patterns.set('second', {
        requests: [],
        suspiciousScore: 0,
        updatedAt: expiredTime,
        createdAt: expiredTime,
      });

      const cleaned = manager.cleanupExpired(1);

      expect(cleaned).toBe(1);
      expect(manager.get('first')).toBeUndefined();
      expect(manager.get('second')).toBeDefined();
    });
  });

  describe('Cleanup Scheduling', () => {
    it('should avoid scheduling duplicate cleanup timers', () => {
      const manager = createSuspiciousPatternsManager({
        minCleanupInterval: 0,
      });
      const timeoutSpy = jest.spyOn(global, 'setTimeout');

      manager.scheduleCleanup();
      manager.scheduleCleanup();

      expect(timeoutSpy).toHaveBeenCalledTimes(1);

      jest.runOnlyPendingTimers();
      expect(manager.cleanupTimer).toBeNull();

      timeoutSpy.mockRestore();
      manager.destroy();
    });

    it('should reset cleanup timer even when cleanup throws', () => {
      const manager = createSuspiciousPatternsManager({
        minCleanupInterval: 0,
      });
      manager.cleanupExpired = jest.fn(() => {
        throw new Error('cleanup failed');
      });

      manager.scheduleCleanup();

      expect(manager.cleanupTimer).not.toBeNull();

      jest.runOnlyPendingTimers();

      expect(manager.cleanupExpired).toHaveBeenCalled();
      expect(manager.cleanupTimer).toBeNull();

      manager.destroy();
    });

    it('should continue periodic cleanup after errors', () => {
      const manager = createSuspiciousPatternsManager({ cleanupInterval: 100 });
      manager.cleanupExpired = jest.fn(() => {
        throw new Error('interval cleanup failed');
      });

      jest.advanceTimersByTime(100);

      expect(manager.cleanupExpired).toHaveBeenCalledTimes(1);

      manager.destroy();
    });

    it('should remove expired entries during full cleanup', () => {
      const manager = createSuspiciousPatternsManager();
      const expiredTime = Date.now() - manager.maxAge - 5;

      manager.patterns.set('stale', {
        requests: [],
        suspiciousScore: 0,
        updatedAt: expiredTime,
        createdAt: expiredTime,
      });

      const cleaned = manager.fullCleanup();

      expect(cleaned).toBe(1);
      expect(manager.get('stale')).toBeUndefined();

      manager.destroy();
    });
  });
});
