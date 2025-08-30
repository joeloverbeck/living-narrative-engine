/**
 * @file SlotAccessResolver Memory Test Suite
 *
 * This memory test suite validates the memory management characteristics of
 * the SlotAccessResolver and its caching mechanisms, focusing on:
 * - Cache memory efficiency
 * - Memory growth patterns during cache population
 * - Proper cache size limits
 *
 * Memory Targets:
 * - Cache should not grow indefinitely
 * - Cache size should remain bounded under repeated operations
 *
 * Note: This test uses the dedicated 'npm run test:memory' runner
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import {
  calculateCoveragePriorityOptimized,
  clearPriorityCache,
  getCacheStats,
} from '../../../../src/scopeDsl/prioritySystem/priorityCalculator.js';

// Set timeout for memory tests
jest.setTimeout(30000);

describe('SlotAccessResolver Memory Management', () => {
  // Memory metrics tracking
  let memoryMetrics = {
    initialCacheSize: 0,
    finalCacheSize: 0,
    cacheGrowth: 0,
  };

  beforeEach(() => {
    // Clear cache before each test
    clearPriorityCache();

    // Reset memory metrics
    memoryMetrics = {
      initialCacheSize: 0,
      finalCacheSize: 0,
      cacheGrowth: 0,
    };
  });

  afterEach(() => {
    // Clear cache after each test to prevent interference
    clearPriorityCache();
  });

  test('should handle memory efficiently with caching', () => {
    // Clear priority cache
    clearPriorityCache();

    const initialStats = getCacheStats();
    expect(initialStats.size).toBe(0);
    memoryMetrics.initialCacheSize = initialStats.size;

    // Trigger cache population
    for (let i = 0; i < 100; i++) {
      calculateCoveragePriorityOptimized('base', 'outer');
      calculateCoveragePriorityOptimized('outer', 'base');
    }

    const finalStats = getCacheStats();
    memoryMetrics.finalCacheSize = finalStats.size;
    memoryMetrics.cacheGrowth = finalStats.size - initialStats.size;

    // Verify cache is being used
    expect(finalStats.size).toBeGreaterThan(0);

    // Verify cache doesn't grow indefinitely
    expect(finalStats.size).toBeLessThan(10); // Should not grow indefinitely

    // Log metrics for monitoring
    console.log('Memory Test Metrics:', {
      initialCacheSize: memoryMetrics.initialCacheSize,
      finalCacheSize: memoryMetrics.finalCacheSize,
      cacheGrowth: memoryMetrics.cacheGrowth,
    });
  });

  test('should maintain stable cache size under repeated identical operations', () => {
    clearPriorityCache();

    // Perform initial operations
    for (let i = 0; i < 50; i++) {
      calculateCoveragePriorityOptimized('base', 'outer');
      calculateCoveragePriorityOptimized('outer', 'base');
    }

    const midStats = getCacheStats();
    const midSize = midStats.size;

    // Perform more identical operations
    for (let i = 0; i < 50; i++) {
      calculateCoveragePriorityOptimized('base', 'outer');
      calculateCoveragePriorityOptimized('outer', 'base');
    }

    const finalStats = getCacheStats();
    const finalSize = finalStats.size;

    // Cache size should remain stable for identical operations
    expect(finalSize).toBe(midSize);
  });

  test('should handle diverse layer combinations without excessive memory growth', () => {
    clearPriorityCache();

    const layers = ['base', 'outer', 'underwear', 'accessories', 'armor'];
    const operations = [];

    // Generate diverse layer combinations
    for (let i = 0; i < layers.length; i++) {
      for (let j = 0; j < layers.length; j++) {
        if (i !== j) {
          operations.push([layers[i], layers[j]]);
        }
      }
    }

    // Execute all combinations multiple times
    for (let round = 0; round < 5; round++) {
      operations.forEach(([layer1, layer2]) => {
        calculateCoveragePriorityOptimized(layer1, layer2);
      });
    }

    const finalStats = getCacheStats();

    // Even with diverse combinations, cache should remain bounded
    // Maximum theoretical size is layers.length * (layers.length - 1)
    const maxExpectedSize = layers.length * (layers.length - 1);
    expect(finalStats.size).toBeLessThanOrEqual(maxExpectedSize);

    console.log('Diverse operations cache stats:', {
      operationCount: operations.length * 5,
      uniqueOperations: operations.length,
      finalCacheSize: finalStats.size,
      maxExpectedSize: maxExpectedSize,
    });
  });
});
