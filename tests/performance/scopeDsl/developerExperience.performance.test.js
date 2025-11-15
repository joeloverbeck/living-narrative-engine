/**
 * @file Developer Experience Performance Test Suite
 * @description Performance tests for developer experience features in ScopeDSL
 *
 * Tests extracted from E2E tests to focus on performance characteristics
 * of profiling, tracing, and developer tools integration.
 */

import { describe, beforeAll, beforeEach, afterAll, test, expect } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  createPerformanceContainer,
  prewarmContainer,
  resetContainerState,
  forceCleanup,
} from '../../common/performanceContainerFactory.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import { performance } from 'perf_hooks';

/**
 * Performance test suite for developer experience features
 * Focuses on profiling tools integration and performance measurement capabilities
 */
describe('Developer Experience Performance', () => {
  let sharedContainer;
  let cleanupSharedContainer;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let registry;
  let logger;
  let jsonLogicService;
  let scopeDefinitions;
  let testActors;

  beforeAll(async () => {
    const containerSetup = await createPerformanceContainer();
    sharedContainer = containerSetup.container;
    cleanupSharedContainer = containerSetup.cleanup;

    await prewarmContainer(sharedContainer);

    entityManager = sharedContainer.resolve(tokens.IEntityManager);
    scopeRegistry = sharedContainer.resolve(tokens.IScopeRegistry);
    scopeEngine = sharedContainer.resolve(tokens.IScopeEngine);
    registry = sharedContainer.resolve(tokens.IDataRegistry);
    const dslParser = sharedContainer.resolve(tokens.DslParser);
    logger = sharedContainer.resolve(tokens.ILogger);
    jsonLogicService = sharedContainer.resolve(tokens.JsonLogicEvaluationService);

    scopeDefinitions = ScopeTestUtilities.createTestScopes({
      dslParser,
      logger,
    });
  });

  beforeEach(async () => {
    await resetContainerState(sharedContainer);

    ScopeTestUtilities.setupScopeTestConditions(registry);
    scopeRegistry.initialize(scopeDefinitions);

    testActors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry,
    });
  });

  afterAll(() => {
    if (cleanupSharedContainer) {
      cleanupSharedContainer();
    }
    forceCleanup();
  });

  /**
   * Helper to create game context for testing
   */
  function createGameContext() {
    return {
      entities: [testActors.player, testActors.npc],
      location: { id: 'test_location' },
      entityManager,
      jsonLogicEval: jsonLogicService,
      logger,
    };
  }

  /**
   * Helper to create trace context
   */
  function createTraceContext() {
    return new TraceContext();
  }

  describe('Profiling Tools Integration Performance', () => {
    test('should integrate with profiling tools efficiently through trace data', async () => {
      const traceContext = createTraceContext();
      const gameContext = createGameContext();

      // Perform multiple resolutions to generate profiling data
      const startTime = performance.now();
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:json_logic_filter',
        testActors.player,
        gameContext,
        { scopeRegistry, scopeEngine },
        { trace: traceContext }
      );
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify performance can be measured
      expect(duration).toBeDefined();
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify result was returned
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Set);

      console.log(
        `Profiling integration test completed in ${duration.toFixed(2)}ms`
      );
    });

    test('should measure scope resolution performance accurately', async () => {
      const gameContext = createGameContext();

      // Create smaller dataset for performance testing
      await ScopeTestUtilities.createMockEntityDataset(
        15, // Optimized size for performance testing
        'simple',
        {
          entityManager,
          registry,
        }
      );

      // Reduced iterations for performance testing focus
      const iterations = 3;
      const results = [];
      let totalTime = 0;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const result = await ScopeTestUtilities.resolveScopeE2E(
          'test:json_logic_filter',
          testActors.player,
          gameContext,
          { scopeRegistry, scopeEngine }
        );
        const endTime = performance.now();
        const duration = endTime - startTime;

        results.push({ duration, success: result !== undefined });
        totalTime += duration;
      }

      // Verify performance metrics
      expect(results).toHaveLength(iterations);
      expect(totalTime).toBeGreaterThan(0);
      const averageTime = totalTime / iterations;
      expect(averageTime).toBeLessThan(500); // Performance target: 500ms

      console.log('Scope Resolution Performance Metrics:', {
        iterations,
        totalTime: totalTime.toFixed(2),
        averageTime: averageTime.toFixed(2),
        results: results.map((r) => ({
          duration: r.duration.toFixed(2),
          success: r.success,
        })),
      });
    });

    test('should track memory usage efficiently during resolution', async () => {
      // Skip if not in Node environment
      if (typeof process === 'undefined' || !process.memoryUsage) {
        console.log('Skipping memory test in browser environment');
        return;
      }

      const gameContext = createGameContext();

      // Create smaller dataset for memory testing
      await ScopeTestUtilities.createMockEntityDataset(5, 'simple', {
        entityManager,
        registry,
      });

      // Memory tracking
      const startMemory = process.memoryUsage().heapUsed;

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:json_logic_filter',
        testActors.player,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = endMemory - startMemory;

      // Verify resolution worked
      expect(result).toBeDefined();
      expect(typeof memoryUsed).toBe('number');

      console.log(`Memory usage during resolution: ${memoryUsed} bytes`);
    });

    test('should classify performance levels correctly', async () => {
      // Test performance classification utility
      const performanceClasses = [
        { time: 5, expectedClass: 'Excellent' },
        { time: 15, expectedClass: 'Good' },
        { time: 45, expectedClass: 'Good' }, // threshold is <50ms for Good
        { time: 150, expectedClass: 'Acceptable' }, // threshold is <200ms for Acceptable
      ];

      for (const { time, expectedClass } of performanceClasses) {
        // Use internal classification method
        const classification = ScopeTestUtilities._classifyPerformance(time);
        expect(classification).toBe(expectedClass);
      }
    });

    test('should integrate with existing profiling tools efficiently', async () => {
      const gameContext = createGameContext();

      // Create performance marks
      performance.mark('scopeResolution-start');

      await ScopeTestUtilities.resolveScopeE2E(
        'test:json_logic_filter',
        testActors.player,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      performance.mark('scopeResolution-end');

      // Measure between marks
      performance.measure(
        'scopeResolution',
        'scopeResolution-start',
        'scopeResolution-end'
      );

      // Get the measurement
      const measures = performance.getEntriesByName('scopeResolution');
      expect(measures.length).toBeGreaterThan(0);

      const measure = measures[0];
      expect(measure.duration).toBeDefined();
      expect(measure.duration).toBeGreaterThan(0);

      console.log(
        `Performance.measure integration: ${measure.duration.toFixed(2)}ms`
      );

      // Clean up
      performance.clearMarks();
      performance.clearMeasures();
    });
  });

  describe('Tracing Performance', () => {
    test('should handle trace context efficiently', async () => {
      const gameContext = createGameContext();
      const iterations = 5;
      const tracingTimes = [];

      for (let i = 0; i < iterations; i++) {
        const traceContext = createTraceContext();

        const startTime = performance.now();

        const result = await ScopeTestUtilities.resolveScopeE2E(
          'test:json_logic_filter',
          testActors.player,
          gameContext,
          { scopeRegistry, scopeEngine },
          { trace: traceContext }
        );

        const endTime = performance.now();
        const duration = endTime - startTime;

        tracingTimes.push(duration);
        expect(result).toBeDefined();
      }

      const averageTracingTime =
        tracingTimes.reduce((a, b) => a + b, 0) / tracingTimes.length;

      // Tracing should not significantly impact performance
      expect(averageTracingTime).toBeLessThan(1000); // Less than 1 second

      console.log('Tracing Performance Metrics:', {
        iterations,
        averageTime: averageTracingTime.toFixed(2),
        times: tracingTimes.map((t) => t.toFixed(2)),
      });
    });
  });
});
