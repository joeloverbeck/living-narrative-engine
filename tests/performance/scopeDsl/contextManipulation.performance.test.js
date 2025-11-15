/**
 * @file Context Manipulation Performance Test Suite
 * @description Performance tests for context manipulation operations in ScopeDSL
 *
 * Tests extracted from E2E tests to ensure proper performance measurement isolation.
 * Focuses on context size limits, merging performance, and scalability analysis.
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { createEntityInstance } from '../../common/entities/entityFactories.js';
import ContextMerger from '../../../src/scopeDsl/core/contextMerger.js';
import ContextValidator from '../../../src/scopeDsl/core/contextValidator.js';
import { performance } from 'perf_hooks';

/**
 * Performance test suite for context manipulation operations
 * Focuses on performance characteristics rather than functional correctness
 */
describe('Context Manipulation Performance', () => {
  let container;
  let entityManager;
  let contextMerger;
  let contextValidator;

  beforeEach(async () => {
    // Create real container for performance testing
    container = new AppContainer();
    await configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Get required services
    entityManager = container.resolve(tokens.IEntityManager);
    contextMerger = new ContextMerger();
    contextValidator = new ContextValidator();
  });

  afterEach(() => {
    if (container) {
      container = null;
    }
  });

  describe('Context Size Limits Performance', () => {
    test('should handle extremely large contexts efficiently', async () => {
      const startTime = performance.now();

      // Create a large context with many properties
      const largeContext = {
        actorEntity: createEntityInstance({ instanceId: 'actor4' }),
        runtimeCtx: { entityManager },
        dispatcher: { resolve: async () => new Set() },
        cycleDetector: { enter: () => true, leave: () => {} },
        depthGuard: { ensure: () => true },
        depth: 0,
      };

      // Add 10000+ properties to test size limits
      for (let i = 0; i < 10000; i++) {
        largeContext[`prop_${i}`] = {
          data: `value_${i}`,
          nested: {
            level1: {
              level2: `nested_${i}`,
            },
          },
        };
      }

      const creationTime = performance.now() - startTime;

      // Context creation should complete in reasonable time
      expect(creationTime).toBeLessThan(1000); // Less than 1 second

      // Test merging large contexts
      const overlayContext = {};
      for (let i = 10000; i < 15000; i++) {
        overlayContext[`prop_${i}`] = `overlay_${i}`;
      }

      const mergeStart = performance.now();
      const mergedContext = contextMerger.merge(largeContext, overlayContext);
      const mergeTime = performance.now() - mergeStart;

      // Merge should complete efficiently
      expect(mergeTime).toBeLessThan(500); // Less than 500ms

      // Verify merged context has properties from both
      expect(mergedContext.prop_0).toBeDefined();
      expect(mergedContext.prop_10000).toBeDefined();
      expect(Object.keys(mergedContext).length).toBeGreaterThan(15000);
    });

    test('should maintain performance with gradual context size increase', async () => {
      const sizes = [100, 1000, 5000, 10000];
      const samplesPerSize = 5;
      const performanceMetrics = [];

      const createContext = (size) => {
        const context = {
          actorEntity: createEntityInstance({ instanceId: `actor_${size}` }),
          runtimeCtx: { entityManager },
          dispatcher: { resolve: async () => new Set() },
          cycleDetector: { enter: () => true, leave: () => {} },
          depthGuard: { ensure: () => true },
          depth: 0,
        };

        for (let i = 0; i < size; i++) {
          context[`prop_${i}`] = { value: i, data: `data_${i}` };
        }

        return context;
      };

      for (const size of sizes) {
        let cumulativeTime = 0;

        for (let sample = 0; sample < samplesPerSize; sample++) {
          const context = createContext(size);

          const startTime = performance.now();

          // Validate context
          contextValidator.validate(context);

          // Perform merge operation
          const overlay = { depth: 5, extraProp: 'test' };
          contextMerger.merge(context, overlay);

          cumulativeTime += performance.now() - startTime;
        }

        const averageTime = cumulativeTime / samplesPerSize;

        performanceMetrics.push({
          size,
          time: averageTime,
          ratio: averageTime / size,
        });
      }

      // Performance should not degrade exponentially
      for (let i = 1; i < performanceMetrics.length; i++) {
        const current = performanceMetrics[i];
        const previous = performanceMetrics[i - 1];

        // Time per property should remain relatively stable
        // Allow for some variance due to test environment
        const degradationRatio = current.ratio / previous.ratio;
        expect(degradationRatio).toBeLessThan(6); // Averaged samples allow a more realistic (but still lenient) threshold
      }

      // Log performance metrics for analysis
      console.log(
        'Context Manipulation Performance Metrics:',
        performanceMetrics
      );
    });
  });

  describe('Context Validation Performance', () => {
    test('should validate large contexts efficiently', async () => {
      const sizes = [500, 2000, 8000];
      const validationTimes = [];

      for (const size of sizes) {
        const context = {
          actorEntity: createEntityInstance({
            instanceId: `validation_actor_${size}`,
          }),
          runtimeCtx: { entityManager },
          dispatcher: { resolve: async () => new Set() },
          cycleDetector: { enter: () => true, leave: () => {} },
          depthGuard: { ensure: () => true },
          depth: 0,
        };

        // Add properties for validation testing
        for (let i = 0; i < size; i++) {
          context[`validation_prop_${i}`] = {
            type: 'test',
            value: `test_value_${i}`,
            metadata: { index: i, category: 'performance_test' },
          };
        }

        const startTime = performance.now();
        contextValidator.validate(context);
        const validationTime = performance.now() - startTime;

        validationTimes.push({
          size,
          time: validationTime,
          ratio: validationTime / size,
        });

        // Validation should complete quickly
        expect(validationTime).toBeLessThan(200); // Less than 200ms even for large contexts
      }

      console.log('Context Validation Performance Metrics:', validationTimes);
    });
  });

  describe('Context Merging Performance', () => {
    test('should merge contexts with consistent performance characteristics', async () => {
      const mergingSizes = [200, 1000, 4000];
      const mergingTimes = [];

      for (const size of mergingSizes) {
        const baseContext = {
          actorEntity: createEntityInstance({
            instanceId: `merge_base_${size}`,
          }),
          runtimeCtx: { entityManager },
          dispatcher: { resolve: async () => new Set() },
          cycleDetector: { enter: () => true, leave: () => {} },
          depthGuard: { ensure: () => true },
          depth: 0,
        };

        const overlayContext = {};

        // Create contexts of varying sizes
        for (let i = 0; i < size; i++) {
          baseContext[`base_${i}`] = `base_value_${i}`;
          overlayContext[`overlay_${i}`] = `overlay_value_${i}`;
        }

        const startTime = performance.now();
        const mergedContext = contextMerger.merge(baseContext, overlayContext);
        const mergingTime = performance.now() - startTime;

        mergingTimes.push({
          size,
          time: mergingTime,
          ratio: mergingTime / size,
        });

        // Merging should be efficient
        expect(mergingTime).toBeLessThan(100); // Less than 100ms
        expect(Object.keys(mergedContext).length).toBeGreaterThan(size * 2);
      }

      console.log('Context Merging Performance Metrics:', mergingTimes);
    });
  });
});
