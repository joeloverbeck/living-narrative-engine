/**
 * @file SlotAccessResolver Coverage Memory Test Suite
 *
 * This memory test suite validates the memory management characteristics of
 * the SlotAccessResolver coverage resolution system and its caching mechanisms, focusing on:
 * - Cache memory efficiency and bounded growth
 * - Memory leak detection during intensive operations
 * - Memory usage patterns during cache population
 * - Proper cache size limits and eviction
 *
 * Memory Targets:
 * - Cache should not grow indefinitely
 * - Memory increase <20MB after 10k operations
 * - Cache size should remain bounded under repeated operations
 * - Proper memory cleanup after garbage collection
 *
 * Note: Run with NODE_ENV=test node --expose-gc ./node_modules/.bin/jest
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { createUltraLightContainer } from '../../common/testing/ultraLightContainer.js';
import {
  CoverageTestUtilities,
  PERFORMANCE_TARGETS,
} from '../../common/scopeDsl/coverageTestUtilities.js';
import createSlotAccessResolver from '../../../src/scopeDsl/nodes/slotAccessResolver.js';
import {
  calculateCoveragePriorityOptimized,
  clearPriorityCache,
  getCacheStats,
} from '../../../src/scopeDsl/prioritySystem/priorityCalculator.js';

// Set timeout for memory tests
jest.setTimeout(120000); // 2 minutes

describe('SlotAccessResolver Coverage Memory', () => {
  let container;
  let slotAccessResolver;
  let testUtilities;

  // Memory metrics tracking
  let memoryMetrics = {
    initialCacheSize: 0,
    finalCacheSize: 0,
    cacheGrowth: 0,
    initialMemory: 0,
    finalMemory: 0,
    memoryIncrease: 0,
  };

  beforeEach(() => {
    container = createUltraLightContainer();
    testUtilities = new CoverageTestUtilities(container);

    const testBed = testUtilities.createSlotAccessTestBed();
    slotAccessResolver = createSlotAccessResolver(testBed);

    // Clear cache before each test
    if (typeof clearPriorityCache === 'function') {
      clearPriorityCache();
    }

    // Force GC before each test for clean baseline
    if (global.gc) {
      global.gc();
    }

    // Reset memory metrics
    memoryMetrics = {
      initialCacheSize: 0,
      finalCacheSize: 0,
      cacheGrowth: 0,
      initialMemory: process.memoryUsage().heapUsed,
      finalMemory: 0,
      memoryIncrease: 0,
    };
  });

  afterEach(() => {
    // Clean up after each test
    container.cleanup();

    if (typeof clearPriorityCache === 'function') {
      clearPriorityCache();
    }

    if (global.gc) {
      global.gc();
    }
  });

  describe('Memory Usage Monitoring', () => {
    test('should maintain stable memory usage during intensive operations', async () => {
      const equipment = testUtilities.generateEquipment(20, {
        coverageItems: 10,
      });
      const character = await testUtilities.createCharacter({ equipment });

      const node = {
        type: 'Step',
        field: 'torso_lower',
        parent: { type: 'Step' },
      };

      const mockContext = testUtilities.createMockContext(
        character.equipment.equipped,
        'topmost'
      );

      const initialMemory = process.memoryUsage().heapUsed;
      memoryMetrics.initialMemory = initialMemory;

      // Perform many resolutions
      for (let i = 0; i < 10000; i++) {
        slotAccessResolver.resolve(node, mockContext);

        // Periodic memory check
        if (i % 1000 === 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          const increase = currentMemory - initialMemory;

          // Log memory increase for monitoring, but don't fail test
          if (increase > 50 * 1024 * 1024) {
            console.warn(
              `High memory increase at iteration ${i}: ${(increase / 1024 / 1024).toFixed(2)}MB`
            );
          }
        }
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const totalIncrease = finalMemory - initialMemory;
      memoryMetrics.finalMemory = finalMemory;
      memoryMetrics.memoryIncrease = totalIncrease;

      console.log(
        `Memory increase after 10k resolutions: ${(totalIncrease / 1024 / 1024).toFixed(2)}MB`
      );

      // Should not have significant memory leak
      expect(totalIncrease).toBeLessThan(PERFORMANCE_TARGETS.memoryIncrease);
    });

    test('should handle cache size limits properly', async () => {
      // Test priority calculation cache if available
      if (
        typeof getCacheStats !== 'function' ||
        typeof calculateCoveragePriorityOptimized !== 'function'
      ) {
        console.log('Cache functions not available, skipping cache size test');
        return;
      }

      const initialStats = getCacheStats();
      expect(initialStats.size).toBe(0);
      memoryMetrics.initialCacheSize = initialStats.size;

      // Fill priority calculation cache beyond limits
      const cacheTestData = [];

      for (let i = 0; i < 2000; i++) {
        // Exceed typical cache limit
        const priority = `priority_${i % 10}`;
        const layer = `layer_${i % 8}`;
        cacheTestData.push([priority, layer]);
      }

      const startTime = performance.now();

      cacheTestData.forEach(([priority, layer]) => {
        calculateCoveragePriorityOptimized(priority, layer);
      });

      const cacheTime = performance.now() - startTime;

      // Should handle cache overflow gracefully
      expect(cacheTime).toBeLessThan(1000); // Complete in reasonable time

      const finalStats = getCacheStats();
      memoryMetrics.finalCacheSize = finalStats.size;
      memoryMetrics.cacheGrowth = finalStats.size - initialStats.size;

      console.log('Cache Test Metrics:', {
        initialCacheSize: memoryMetrics.initialCacheSize,
        finalCacheSize: memoryMetrics.finalCacheSize,
        cacheGrowth: memoryMetrics.cacheGrowth,
      });

      // Check cache metrics
      expect(finalStats.size).toBeLessThan(1500); // Should have reasonable limit
    });
  });

  describe('Cache Memory Management', () => {
    test('should handle memory efficiently with caching', () => {
      // Test priority calculator caching if available
      if (
        typeof clearPriorityCache !== 'function' ||
        typeof getCacheStats !== 'function'
      ) {
        console.log(
          'Cache functions not available, skipping cache memory test'
        );
        return;
      }
      {
        // Clear priority cache
        clearPriorityCache();

        const initialStats = getCacheStats();
        expect(initialStats.size).toBe(0);
        memoryMetrics.initialCacheSize = initialStats.size;

        // Trigger cache population
        if (typeof calculateCoveragePriorityOptimized === 'function') {
          for (let i = 0; i < 100; i++) {
            calculateCoveragePriorityOptimized('base', 'outer');
            calculateCoveragePriorityOptimized('outer', 'base');
          }
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
      }
    });

    test('should maintain stable cache size under repeated identical operations', () => {
      if (
        typeof clearPriorityCache !== 'function' ||
        typeof getCacheStats !== 'function'
      ) {
        console.log(
          'Cache functions not available, skipping cache stability test'
        );
        return;
      }
      {
        clearPriorityCache();

        // Perform initial operations
        if (typeof calculateCoveragePriorityOptimized === 'function') {
          for (let i = 0; i < 50; i++) {
            calculateCoveragePriorityOptimized('base', 'outer');
            calculateCoveragePriorityOptimized('outer', 'base');
          }
        }

        const midStats = getCacheStats();
        const midSize = midStats.size;

        // Perform more identical operations
        if (typeof calculateCoveragePriorityOptimized === 'function') {
          for (let i = 0; i < 50; i++) {
            calculateCoveragePriorityOptimized('base', 'outer');
            calculateCoveragePriorityOptimized('outer', 'base');
          }
        }

        const finalStats = getCacheStats();
        const finalSize = finalStats.size;

        // Cache size should remain stable for identical operations
        expect(finalSize).toBe(midSize);
      }
    });

    test('should handle diverse layer combinations without excessive memory growth', () => {
      if (
        typeof clearPriorityCache !== 'function' ||
        typeof getCacheStats !== 'function'
      ) {
        console.log(
          'Cache functions not available, skipping diverse combinations test'
        );
        return;
      }
      {
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
        if (typeof calculateCoveragePriorityOptimized === 'function') {
          for (let round = 0; round < 5; round++) {
            operations.forEach(([layer1, layer2]) => {
              calculateCoveragePriorityOptimized(layer1, layer2);
            });
          }
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
      }
    });
  });

  describe('Memory Leak Detection', () => {
    test('should not leak memory during repeated character creation and resolution', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and resolve multiple characters to test for memory leaks
      for (let i = 0; i < 100; i++) {
        const equipment = testUtilities.generateEquipment(10, {
          coverageItems: 5,
          variety: true,
        });
        const character = await testUtilities.createCharacter({ equipment });

        const node = {
          type: 'Step',
          field: 'torso_lower',
          parent: { type: 'Step' },
        };

        const mockContext = testUtilities.createMockContext(
          character.equipment.equipped,
          'topmost'
        );

        // Perform some resolutions
        for (let j = 0; j < 10; j++) {
          slotAccessResolver.resolve(node, mockContext);
        }

        // Clean up character data
        container.cleanup();
        container = createUltraLightContainer();
        testUtilities = new CoverageTestUtilities(container);

        const testBed = testUtilities.createSlotAccessTestBed();
        slotAccessResolver = createSlotAccessResolver(testBed);

        // Periodic memory check
        if (i % 20 === 0 && global.gc) {
          global.gc();
          const currentMemory = process.memoryUsage().heapUsed;
          const increase = currentMemory - initialMemory;
          console.log(
            `Memory after ${i + 1} iterations: ${(increase / 1024 / 1024).toFixed(2)}MB increase`
          );
        }
      }

      // Final cleanup and memory check
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const totalIncrease = finalMemory - initialMemory;

      console.log(
        `Final memory increase after 100 character cycles: ${(totalIncrease / 1024 / 1024).toFixed(2)}MB`
      );

      // Should not have significant memory leak
      expect(totalIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });

    test('should cleanup memory properly after intensive concurrent operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create multiple characters for concurrent operations
      const characters = [];
      for (let i = 0; i < 20; i++) {
        const equipment = testUtilities.generateEquipment(8, {
          coverageItems: 4,
          variety: true,
        });
        characters.push(await testUtilities.createCharacter({ equipment }));
      }

      const node = {
        type: 'Step',
        field: 'torso_lower',
        parent: { type: 'Step' },
      };

      // Perform intensive concurrent operations
      for (let iteration = 0; iteration < 50; iteration++) {
        const promises = characters.map((char) => {
          const mockContext = testUtilities.createMockContext(
            char.equipment.equipped,
            'topmost'
          );
          return Promise.resolve(slotAccessResolver.resolve(node, mockContext));
        });

        await Promise.all(promises);
      }

      // Cleanup and measure final memory
      container.cleanup();
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const totalIncrease = finalMemory - initialMemory;

      console.log(
        `Memory increase after intensive concurrent operations: ${(totalIncrease / 1024 / 1024).toFixed(2)}MB`
      );

      // Should not have significant memory leak
      expect(totalIncrease).toBeLessThan(30 * 1024 * 1024); // Less than 30MB
    });
  });
});
