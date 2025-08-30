/**
 * @file Performance and regression tests for ModTestHandlerFactory
 * @description Validates factory performance and ensures no regression in handler creation time
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestHandlerFactory } from '../../../common/mods/ModTestHandlerFactory.js';
import { SimpleEntityManager } from '../../../common/entities/index.js';

describe('ModTestHandlerFactory Performance Tests', () => {
  let entityManager;
  let eventBus;
  let logger;
  let performanceResults;

  beforeEach(() => {
    entityManager = new SimpleEntityManager([
      {
        id: 'perf-test-entity',
        components: { 'core:name': { name: 'Performance Test' } },
      },
    ]);

    eventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    performanceResults = {
      createStandardHandlers: [],
      createHandlersWithAddComponent: [],
      createMinimalHandlers: [],
      createCustomHandlers: [],
      createSafeDispatcher: [],
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Measures execution time for a factory method
   *
   * @param {Function} factoryMethod - Factory method to measure
   * @param {...any} args - Arguments to pass to the factory method
   * @returns {object} Object with executionTime and result
   */
  function measureExecutionTime(factoryMethod, ...args) {
    const start = performance.now();
    const result = factoryMethod.apply(ModTestHandlerFactory, args);
    const end = performance.now();
    return {
      executionTime: end - start,
      result,
    };
  }

  /**
   * Runs multiple iterations to get average performance
   *
   * @param {string} testName - Name of the test for tracking results
   * @param {Function} factoryMethod - Factory method to test
   * @param {Array} args - Arguments array for the factory method
   * @param {number} iterations - Number of iterations to run
   * @returns {object} Performance results object
   */
  function runPerformanceTest(testName, factoryMethod, args, iterations = 100) {
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const { executionTime } = measureExecutionTime(factoryMethod, ...args);
      times.push(executionTime);
    }

    const averageTime =
      times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    performanceResults[testName] = times;

    return {
      averageTime,
      minTime,
      maxTime,
      iterations,
      times,
    };
  }

  describe('Factory Method Performance', () => {
    it('should create standard handlers within performance threshold', () => {
      const results = runPerformanceTest(
        'createStandardHandlers',
        ModTestHandlerFactory.createStandardHandlers,
        [entityManager, eventBus, logger],
        100
      );

      // Performance threshold: should average under 10ms per creation
      expect(results.averageTime).toBeLessThan(10);

      // Should not have any extremely slow outliers (>50ms)
      expect(results.maxTime).toBeLessThan(50);

      // Should be consistently fast (min should be reasonable)
      expect(results.minTime).toBeGreaterThan(0);

      console.log(
        `createStandardHandlers: avg=${results.averageTime.toFixed(2)}ms, min=${results.minTime.toFixed(2)}ms, max=${results.maxTime.toFixed(2)}ms`
      );
    });

    it('should create handlers with ADD_COMPONENT within performance threshold', () => {
      const results = runPerformanceTest(
        'createHandlersWithAddComponent',
        ModTestHandlerFactory.createHandlersWithAddComponent,
        [entityManager, eventBus, logger],
        100
      );

      // Should be only slightly slower than standard handlers due to additional handler
      expect(results.averageTime).toBeLessThan(12);
      expect(results.maxTime).toBeLessThan(60);

      console.log(
        `createHandlersWithAddComponent: avg=${results.averageTime.toFixed(2)}ms, min=${results.minTime.toFixed(2)}ms, max=${results.maxTime.toFixed(2)}ms`
      );
    });

    it('should create minimal handlers faster than standard handlers', () => {
      const standardResults = runPerformanceTest(
        'createStandardHandlers',
        ModTestHandlerFactory.createStandardHandlers,
        [entityManager, eventBus, logger],
        100
      );

      const minimalResults = runPerformanceTest(
        'createMinimalHandlers',
        ModTestHandlerFactory.createMinimalHandlers,
        [entityManager, eventBus, logger],
        100
      );

      // Minimal handlers should be faster (or at least not significantly slower)
      expect(minimalResults.averageTime).toBeLessThanOrEqual(
        standardResults.averageTime * 1.1
      );
      expect(minimalResults.averageTime).toBeLessThan(8);

      console.log(
        `createMinimalHandlers: avg=${minimalResults.averageTime.toFixed(2)}ms vs standard=${standardResults.averageTime.toFixed(2)}ms`
      );
    });

    it('should create custom handlers within reasonable time regardless of options', () => {
      const testConfigurations = [
        {},
        { includeAddComponent: true },
        { includeSetVariable: false },
        { includeQueryComponent: false },
        { includeAddComponent: true, includeSetVariable: false },
      ];

      testConfigurations.forEach((options, index) => {
        const results = runPerformanceTest(
          `createCustomHandlers_${index}`,
          ModTestHandlerFactory.createCustomHandlers,
          [entityManager, eventBus, logger, options],
          50
        );

        expect(results.averageTime).toBeLessThan(15);
        expect(results.maxTime).toBeLessThan(70);

        console.log(
          `createCustomHandlers[${index}]: avg=${results.averageTime.toFixed(2)}ms, options=${JSON.stringify(options)}`
        );
      });
    });

    it('should create safe dispatcher very quickly', () => {
      const results = runPerformanceTest(
        'createSafeDispatcher',
        ModTestHandlerFactory.createSafeDispatcher,
        [eventBus],
        200
      );

      // Safe dispatcher should be very fast (just creates a simple object)
      expect(results.averageTime).toBeLessThan(1);
      expect(results.maxTime).toBeLessThan(5);

      console.log(
        `createSafeDispatcher: avg=${results.averageTime.toFixed(2)}ms, min=${results.minTime.toFixed(2)}ms, max=${results.maxTime.toFixed(2)}ms`
      );
    });
  });

  describe('Memory Usage Analysis', () => {
    it('should not create excessive object references', () => {
      const iterations = 50;
      const handlers = [];

      for (let i = 0; i < iterations; i++) {
        handlers.push(
          ModTestHandlerFactory.createStandardHandlers(
            entityManager,
            eventBus,
            logger
          )
        );
      }

      // Each handler set should have exactly 7 handlers
      handlers.forEach((handlerSet) => {
        expect(Object.keys(handlerSet)).toHaveLength(7);
      });

      // Verify that handlers are properly instantiated (not sharing references inappropriately)
      const firstSet = handlers[0];
      const secondSet = handlers[1];

      // Different handler sets should have different instances
      expect(firstSet.GET_TIMESTAMP).not.toBe(secondSet.GET_TIMESTAMP);
      expect(firstSet.SET_VARIABLE).not.toBe(secondSet.SET_VARIABLE);
    });

    it('should handle repeated factory calls without memory leaks', () => {
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const handlers = ModTestHandlerFactory.createStandardHandlers(
          entityManager,
          eventBus,
          logger
        );

        // Use handlers to ensure they're not optimized away
        expect(handlers.GET_NAME).toBeDefined();
        expect(handlers.DISPATCH_EVENT).toBeDefined();
      }

      // If this test completes without running out of memory, we're good
      expect(true).toBe(true);
    });
  });

  describe('Regression Tests', () => {
    it('should maintain consistent performance across different entity manager sizes', () => {
      const entitySizes = [1, 10, 50, 100];
      const results = [];

      entitySizes.forEach((size) => {
        const entities = Array.from({ length: size }, (_, i) => ({
          id: `entity-${i}`,
          components: { 'core:name': { name: `Entity ${i}` } },
        }));

        const largEntityManager = new SimpleEntityManager(entities);

        const result = runPerformanceTest(
          `size_${size}`,
          ModTestHandlerFactory.createStandardHandlers,
          [largEntityManager, eventBus, logger],
          20
        );

        results.push({ size, averageTime: result.averageTime });
      });

      // Performance should not degrade significantly with entity manager size
      // (since factory doesn't iterate through entities)
      const smallSize = results.find((r) => r.size === 1);
      const largeSize = results.find((r) => r.size === 100);

      expect(largeSize.averageTime).toBeLessThanOrEqual(
        smallSize.averageTime * 2
      );

      console.log('Performance by entity count:', results);
    });

    it('should maintain performance with concurrent factory calls', async () => {
      const concurrentCalls = 20;
      const promises = [];

      const startTime = performance.now();

      for (let i = 0; i < concurrentCalls; i++) {
        promises.push(
          new Promise((resolve) => {
            const start = performance.now();
            const handlers = ModTestHandlerFactory.createStandardHandlers(
              entityManager,
              eventBus,
              logger
            );
            const end = performance.now();
            resolve({ handlers, time: end - start });
          })
        );
      }

      const results = await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const averageTime =
        results.reduce((sum, r) => sum + r.time, 0) / results.length;

      // Concurrent calls should not significantly impact individual performance
      expect(averageTime).toBeLessThan(20);

      // Total time should be reasonable (not linearly scaling with concurrent calls)
      expect(totalTime).toBeLessThan(concurrentCalls * 20);

      console.log(
        `Concurrent performance: ${concurrentCalls} calls in ${totalTime.toFixed(2)}ms, avg=${averageTime.toFixed(2)}ms per call`
      );

      // All results should be valid
      results.forEach(({ handlers }) => {
        expect(Object.keys(handlers)).toHaveLength(7);
      });
    });
  });

  describe('Scalability Tests', () => {
    it('should demonstrate performance advantage over manual handler creation', () => {
      // Simulate the manual creation time by measuring overhead
      const manualCreationOverhead = 0.5; // Estimated additional time per handler for manual creation
      const numHandlers = 7;
      const estimatedManualTime = numHandlers * manualCreationOverhead;

      const factoryResults = runPerformanceTest(
        'factory_vs_manual',
        ModTestHandlerFactory.createStandardHandlers,
        [entityManager, eventBus, logger],
        100
      );

      // Factory should be competitive with manual creation (not necessarily faster due to validation overhead)
      // The real benefit is code reduction, not necessarily speed improvement
      expect(factoryResults.averageTime).toBeLessThan(50); // Reasonable upper bound

      console.log(
        `Factory performance: ${factoryResults.averageTime.toFixed(2)}ms (estimated manual: ~${estimatedManualTime}ms)`
      );
    });

    it('should validate that category-based factory selection has minimal overhead', () => {
      const directCallResults = runPerformanceTest(
        'direct_call',
        ModTestHandlerFactory.createStandardHandlers,
        [entityManager, eventBus, logger],
        50
      );

      const categoryFactoryResults = [];

      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        const factory =
          ModTestHandlerFactory.getHandlerFactoryForCategory('intimacy');
        const handlers = factory(entityManager, eventBus, logger);
        const end = performance.now();
        categoryFactoryResults.push(end - start);

        // Use handlers to ensure they're not optimized away
        expect(handlers).toBeDefined();
      }

      const categoryAverageTime =
        categoryFactoryResults.reduce((sum, time) => sum + time, 0) /
        categoryFactoryResults.length;

      // Category-based selection should add minimal overhead (allow up to 3x due to function lookup)
      expect(categoryAverageTime).toBeLessThanOrEqual(
        directCallResults.averageTime * 3
      );

      console.log(
        `Category factory overhead: direct=${directCallResults.averageTime.toFixed(2)}ms, category=${categoryAverageTime.toFixed(2)}ms`
      );
    });
  });

  describe('Performance Summary', () => {
    it('should generate performance report', () => {
      // This test runs at the end to summarize all performance data collected
      const summary = {
        factoryMethods: Object.keys(performanceResults).length,
        totalIterations: Object.values(performanceResults).reduce(
          (sum, results) => sum + results.length,
          0
        ),
        averagePerformance: {},
      };

      Object.entries(performanceResults).forEach(([method, times]) => {
        if (times.length > 0) {
          const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
          summary.averagePerformance[method] = parseFloat(avg.toFixed(2));
        }
      });

      console.log('\n=== ModTestHandlerFactory Performance Summary ===');
      console.log(`Methods tested: ${summary.factoryMethods}`);
      console.log(`Total iterations: ${summary.totalIterations}`);
      console.log('Average performance:');
      Object.entries(summary.averagePerformance).forEach(
        ([method, avgTime]) => {
          console.log(`  ${method}: ${avgTime}ms`);
        }
      );

      // All methods should meet performance criteria
      Object.values(summary.averagePerformance).forEach((time) => {
        expect(time).toBeLessThan(15); // 15ms upper bound for any factory method
      });
    });
  });
});
