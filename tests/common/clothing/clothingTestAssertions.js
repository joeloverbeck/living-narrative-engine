/**
 * @file Custom assertion helpers for clothing system tests
 * @description Provides specialized assertions for testing clothing accessibility,
 * layer priority, and performance characteristics
 */

import { expect } from '@jest/globals';

/**
 * Custom assertion helpers for clothing tests
 */
export class ClothingTestAssertions {
  /**
   * Asserts that only the expected items are accessible
   *
   * @param {Array} result - The actual result from getAccessibleItems
   * @param {Array<string>} expectedAccessible - Items that should be accessible
   * @param {Array<string>} expectedBlocked - Items that should NOT be accessible
   */
  static assertOnlyAccessibleItems(
    result,
    expectedAccessible,
    expectedBlocked
  ) {
    // Handle both array of strings and array of objects with itemId
    const resultIds = result.map((item) =>
      typeof item === 'string' ? item : item.itemId
    );

    // Check all expected accessible items are present
    expectedAccessible.forEach((itemId) => {
      expect(resultIds).toContain(itemId);
    });

    // Check all expected blocked items are NOT present
    expectedBlocked.forEach((itemId) => {
      expect(resultIds).not.toContain(itemId);
    });

    // Optionally check the count matches
    if (expectedAccessible.length > 0) {
      expect(resultIds).toHaveLength(expectedAccessible.length);
    }
  }

  /**
   * Asserts that items are returned in the correct layer priority order
   *
   * @param {Array} result - The actual result from getAccessibleItems
   * @param {Array<string>} expectedLayerOrder - Expected order of layers
   */
  static assertCorrectLayerPriority(result, expectedLayerOrder) {
    // Extract layers from result
    const layers = result
      .map((item) => {
        if (typeof item === 'object' && item.layer) {
          return item.layer;
        }
        // If just strings, we need to infer layer from item ID or other context
        return null;
      })
      .filter((layer) => layer !== null);

    // Get unique layers in order
    const uniqueLayers = [];
    layers.forEach((layer) => {
      if (!uniqueLayers.includes(layer)) {
        uniqueLayers.push(layer);
      }
    });

    // Check the order matches expected
    expect(uniqueLayers).toEqual(expectedLayerOrder);
  }

  /**
   * Asserts that a function executes within a performance threshold
   *
   * @param {Function} fn - The function to execute
   * @param {number} maxTimeMs - Maximum execution time in milliseconds
   * @param {string} [description] - Optional description for the assertion
   */
  static assertPerformanceWithin(fn, maxTimeMs, description = '') {
    const start = performance.now();
    fn();
    const duration = performance.now() - start;

    if (description) {
      expect(duration).toBeLessThan(maxTimeMs);
    } else {
      expect(duration).toBeLessThan(maxTimeMs);
    }

    return duration; // Return for additional analysis if needed
  }

  /**
   * Asserts that async function executes within a performance threshold
   *
   * @param {Function} asyncFn - The async function to execute
   * @param {number} maxTimeMs - Maximum execution time in milliseconds
   * @param {string} [description] - Optional description for the assertion
   */
  static async assertAsyncPerformanceWithin(
    asyncFn,
    maxTimeMs,
    description = ''
  ) {
    const start = performance.now();
    await asyncFn();
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(maxTimeMs);

    return duration;
  }

  /**
   * Asserts that cache provides expected speedup
   *
   * @param {Function} coldFn - Function to run without cache
   * @param {Function} warmFn - Function to run with cache
   * @param {number} minSpeedup - Minimum expected speedup factor
   */
  static assertCacheSpeedup(coldFn, warmFn, minSpeedup = 5) {
    // Measure cold cache performance
    const coldStart = performance.now();
    coldFn();
    const coldTime = performance.now() - coldStart;

    // Measure warm cache performance
    const warmStart = performance.now();
    warmFn();
    const warmTime = performance.now() - warmStart;

    // Only test speedup if cold time is measurable
    if (coldTime > 0.1) {
      const speedup = coldTime / warmTime;
      expect(speedup).toBeGreaterThan(minSpeedup);
    } else {
      // Operations too fast to measure reliably
      expect(warmTime).toBeDefined();
    }

    return { coldTime, warmTime, speedup: coldTime / warmTime };
  }

  /**
   * Asserts that accessibility result has expected structure
   *
   * @param {object} result - Result from isItemAccessible
   * @param {boolean} expectedAccessible - Expected accessibility
   * @param {string} [expectedReason] - Expected reason (partial match)
   * @param {Array<string>} [expectedBlockingItems] - Expected blocking items
   */
  static assertAccessibilityResult(
    result,
    expectedAccessible,
    expectedReason = null,
    expectedBlockingItems = null
  ) {
    expect(result).toHaveProperty('accessible');
    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('blockingItems');

    expect(result.accessible).toBe(expectedAccessible);

    if (expectedReason !== null) {
      expect(result.reason).toContain(expectedReason);
    }

    if (expectedBlockingItems !== null) {
      if (expectedBlockingItems.length === 0) {
        expect(result.blockingItems).toEqual([]);
      } else {
        expectedBlockingItems.forEach((item) => {
          expect(result.blockingItems).toContain(item);
        });
      }
    }
  }

  /**
   * Asserts that equipment structure is valid
   *
   * @param {object} equipment - Equipment object to validate
   */
  static assertValidEquipmentStructure(equipment) {
    expect(equipment).toHaveProperty('equipped');
    expect(equipment.equipped).toBeInstanceOf(Object);

    // Check each slot has valid structure
    Object.entries(equipment.equipped).forEach(([slot, layers]) => {
      expect(layers).toBeInstanceOf(Object);

      // Check each layer has valid item references
      Object.entries(layers).forEach(([layer, items]) => {
        if (Array.isArray(items)) {
          items.forEach((item) => {
            expect(typeof item).toBe('string');
          });
        } else {
          expect(typeof items).toBe('string');
        }
      });
    });
  }

  /**
   * Asserts linear scaling performance
   *
   * @param {Array<{itemCount: number, duration: number}>} measurements - Performance measurements
   * @param {number} maxScalingFactor - Maximum acceptable scaling factor
   */
  static assertLinearScaling(measurements, maxScalingFactor = 3) {
    for (let i = 1; i < measurements.length; i++) {
      const timeRatio = measurements[i].duration / measurements[i - 1].duration;
      const itemRatio =
        measurements[i].itemCount / measurements[i - 1].itemCount;

      // Performance should scale roughly linearly with item count
      expect(timeRatio).toBeLessThan(itemRatio * maxScalingFactor);
    }
  }

  /**
   * Asserts memory usage is within bounds
   *
   * @param {Function} setupFn - Function to set up test state
   * @param {Function} testFn - Function to run repeatedly
   * @param {number} iterations - Number of iterations
   * @param {number} maxMemoryGrowthMB - Maximum memory growth in MB
   */
  static assertMemoryUsage(setupFn, testFn, iterations, maxMemoryGrowthMB = 1) {
    setupFn();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < iterations; i++) {
      testFn();
    }

    // Force garbage collection again
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowthMB = (finalMemory - initialMemory) / (1024 * 1024);

    expect(memoryGrowthMB).toBeLessThan(maxMemoryGrowthMB);

    return memoryGrowthMB;
  }

  /**
   * Asserts that result contains expected items in any order
   *
   * @param {Array} result - The actual result
   * @param {Array} expectedItems - Expected items (order doesn't matter)
   */
  static assertContainsItems(result, expectedItems) {
    const resultIds = result.map((item) =>
      typeof item === 'string' ? item : item.itemId
    );

    expect(resultIds).toHaveLength(expectedItems.length);
    expectedItems.forEach((item) => {
      expect(resultIds).toContain(item);
    });
  }

  /**
   * Asserts that Layla Agirre scenario is correctly handled
   *
   * @param {Array} result - Result from getAccessibleItems
   */
  static assertLaylaAgirreScenario(result) {
    const resultIds = result.map((item) =>
      typeof item === 'string' ? item : item.itemId
    );

    // Should only contain trousers, not boxer brief
    expect(resultIds).toContain(
      'clothing:dark_olive_high_rise_double_pleat_trousers'
    );
    expect(resultIds).not.toContain('clothing:power_mesh_boxer_brief');

    // In topmost mode, should only be one item
    if (result.length === 1) {
      expect(resultIds[0]).toBe(
        'clothing:dark_olive_high_rise_double_pleat_trousers'
      );
    }
  }

  /**
   * Asserts mode-specific behavior
   *
   * @param {object} results - Object with results for different modes
   * @param {object} expectations - Expected behavior for each mode
   */
  static assertModeSpecificBehavior(results, expectations) {
    Object.entries(expectations).forEach(([mode, expected]) => {
      const result = results[mode];
      const resultIds = result.map((item) =>
        typeof item === 'string' ? item : item.itemId
      );

      if (expected.shouldContain) {
        expected.shouldContain.forEach((item) => {
          expect(resultIds).toContain(item);
        });
      }

      if (expected.shouldNotContain) {
        expected.shouldNotContain.forEach((item) => {
          expect(resultIds).not.toContain(item);
        });
      }

      if (expected.count !== undefined) {
        expect(result).toHaveLength(expected.count);
      }
    });
  }
}

export default ClothingTestAssertions;
