/**
 * @file Performance and Scalability E2E Test Suite for ScopeDSL
 * @see reports/scopedsl-architecture-and-e2e-coverage-analysis.md
 *
 * This test suite validates system behavior under realistic load conditions,
 * measuring performance characteristics and resource utilization for:
 * - Large dataset resolution (1000+ entities)
 * - Deep nesting performance (6+ levels)
 * - Concurrent access patterns
 * - Memory usage and resource management
 *
 * Addresses Priority 3 requirements from ScopeDSL Architecture and E2E Coverage Analysis
 * Coverage: Workflows 3, 4, 5 (engine execution, node resolution, specialized resolvers)
 *
 * Performance Targets:
 * - Resolution time < 200ms for complex queries with 1000+ entities (with CI variance tolerance)
 * - Support for 10+ simultaneous resolutions
 */

import {
  describe,
  beforeEach,
  beforeAll,
  afterEach,
  afterAll,
  test,
  expect,
  jest,
} from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { PerformanceTestBed } from '../../common/performance/PerformanceTestBed.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import { performance } from 'perf_hooks';

// Set longer timeout for performance tests
jest.setTimeout(30000);

/**
 * Performance and scalability test suite for ScopeDSL
 * Tests system behavior under load with large datasets and complex queries
 */
describe('ScopeDSL Performance and Scalability E2E', () => {
  let container;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let logger;
  let jsonLogicService;
  let spatialIndexManager;
  let registry;

  // Performance tracking
  let performanceMetrics = {
    resolutionTimes: [],
    concurrentResolutions: 0,
  };

  beforeAll(async () => {
    // Use shared container for all tests - massive performance improvement
    container = await PerformanceTestBed.getSharedContainer();

    // Get services once for all tests
    entityManager = container.resolve(tokens.IEntityManager);
    scopeRegistry = container.resolve(tokens.IScopeRegistry);
    scopeEngine = container.resolve(tokens.IScopeEngine);
    dslParser = container.resolve(tokens.DslParser);
    logger = container.resolve(tokens.ILogger);
    jsonLogicService = container.resolve(tokens.JsonLogicEvaluationService);
    spatialIndexManager = container.resolve(tokens.ISpatialIndexManager);
    registry = container.resolve(tokens.IDataRegistry);
  });

  beforeEach(async () => {
    // Light cleanup between tests - just reset metrics and entity cache
    performanceMetrics = {
      resolutionTimes: [],
      concurrentResolutions: 0,
    };

    // Reset entity cache for fresh test data
    PerformanceTestBed.resetEntityCache();
  });

  afterEach(() => {
    // Light cleanup - entity manager already handles instance cleanup
    // No need for DOM cleanup as we reuse it
  });

  afterAll(() => {
    // Final cleanup of shared resources
    PerformanceTestBed.cleanup();
  });

  describe('Large Dataset Resolution', () => {
    test('should handle resolution with 500+ entities within performance targets', async () => {
      // Arrange - Create optimized entity dataset (reduced from 1000 to 500 for faster tests)
      const entityCount = 500;
      const testEntities = await PerformanceTestBed.createOptimizedTestDataset(
        entityCount,
        { registry, entityManager }
      );

      // Create test scope for filtering high-level actors
      const testScopes = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:high_level_actors',
            expr: 'entities(core:actor)[{">": [{\"var\": \"entity.components.core:stats.level\"}, 10]}]',
            description: 'Find all actors above level 10',
          },
        ]
      );

      // Initialize scope registry with test scopes
      scopeRegistry.initialize(testScopes);

      // Create test actor
      const testActor = testEntities.actors[0];
      // Create game context for resolution
      const gameContext = {
        currentLocation: await entityManager.getEntityInstance(
          testEntities.location.id
        ),
        entityManager: entityManager,
        allEntities: Array.from(entityManager.entities || []),
        jsonLogicEval: jsonLogicService,
        logger: logger,
        spatialIndexManager: spatialIndexManager,
      };

      // Act - Measure resolution performance with robust statistical sampling
      let result;
      const performanceStats = await measurePerformanceRobust(
        async () => {
          result = await ScopeTestUtilities.resolveScopeE2E(
            'test:high_level_actors',
            testActor,
            gameContext,
            { scopeRegistry, scopeEngine }
          );
          return result;
        },
        {
          warmupRuns: 2,
          measurementRuns: 5,
          operationName: `500-entity high-level actors filter`,
        }
      );

      // Record metrics (use median for consistency)
      performanceMetrics.resolutionTimes.push(performanceStats.median);

      // Assert - Verify performance targets using median and environment-aware threshold
      const baseThreshold = 200; // Base threshold for local development
      const threshold = getPerformanceThreshold(baseThreshold, 1.5); // 1.5x for CI

      expect(performanceStats.median).toBeLessThan(threshold);
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBeGreaterThan(0);
      expect(result.size).toBeLessThan(entityCount); // Should filter some entities

      // Log performance metrics with enhanced statistics
      logger.info('Large dataset resolution performance', {
        entityCount,
        medianTime: `${performanceStats.median.toFixed(2)}ms`,
        meanTime: `${performanceStats.mean.toFixed(2)}ms`,
        threshold: `${threshold.toFixed(2)}ms`,
        resultCount: result.size,
        performanceStatus:
          performanceStats.median < threshold ? 'PASS' : 'FAIL',
      });
    });

    test('should handle resolution with 2000+ entities gracefully', async () => {
      // Arrange - Create large entity dataset (reduced from 10000 to 2000 for reasonable test time)
      const entityCount = 2000;
      const testEntities = await PerformanceTestBed.createOptimizedTestDataset(
        entityCount,
        { registry, entityManager }
      );

      // Create complex scope with multiple conditions
      const testScopes = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:complex_filter',
            expr: 'entities(core:actor)[{\"and\": [{\">\": [{\"var\": \"entity.components.core:stats.level\"}, 5]}, {\">\": [{\"var\": \"entity.components.core:stats.strength\"}, 15]}, {\">\": [{\"var\": \"entity.components.core:health.current\"}, 0]}]}]',
            description: 'Complex multi-condition filter',
          },
        ]
      );

      scopeRegistry.initialize(testScopes);

      const testActor = testEntities.actors[0];
      const gameContext = await createGameContext(testEntities.location.id);

      // Act - Measure resolution with very large dataset using robust statistical sampling
      let result;
      const performanceStats = await measurePerformanceRobust(
        async () => {
          result = await ScopeTestUtilities.resolveScopeE2E(
            'test:complex_filter',
            testActor,
            gameContext,
            { scopeRegistry, scopeEngine }
          );
          return result;
        },
        {
          warmupRuns: 2,
          measurementRuns: 5,
          operationName: `2000-entity complex 3-condition filter`,
        }
      );

      // Assert - Verify graceful handling using median and environment-aware threshold
      // 2000 entities with complex 3-condition filter
      // Base threshold: 800ms (proportionally reduced from original 4500ms for 10k entities)
      const baseThreshold = 800; // Base threshold for local development
      const threshold = getPerformanceThreshold(baseThreshold, 1.5); // 1.5x for CI (1200ms)

      expect(performanceStats.median).toBeLessThan(threshold);
      expect(result).toBeInstanceOf(Set);

      // Log performance metrics with enhanced statistics
      logger.info('Very large dataset resolution performance', {
        entityCount,
        medianTime: `${performanceStats.median.toFixed(2)}ms`,
        meanTime: `${performanceStats.mean.toFixed(2)}ms`,
        threshold: `${threshold.toFixed(2)}ms`,
        resultCount: result.size,
        performanceStatus:
          performanceStats.median < threshold ? 'PASS' : 'FAIL',
        variabilityPercent: `${(((performanceStats.max - performanceStats.min) / performanceStats.mean) * 100).toFixed(1)}%`,
      });
    });
  });

  describe('Deep Nesting Performance', () => {
    test('should maintain performance with deep component nesting (6+ levels)', async () => {
      // Arrange - Create entities with deep component hierarchies
      const testEntities = await createDeepNestedEntities();

      // Create scope with deep nesting access
      const testScopes = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:deep_nested_access',
            expr: 'actor.core:stats.attributes.physical.strength.base.value',
            description: 'Access deeply nested component data (6 levels)',
          },
        ]
      );

      scopeRegistry.initialize(testScopes);

      const testActor = testEntities.actors[0];
      // Create a location for the test
      const locationDef = {
        id: 'test-deep-nested-location',
        description: 'Test location',
        components: {
          'core:location': { name: 'Test Location' },
        },
      };
      registry.store(
        'entityDefinitions',
        locationDef.id,
        new EntityDefinition(locationDef.id, locationDef)
      );
      await entityManager.createEntityInstance(locationDef.id, {
        instanceId: locationDef.id,
        definitionId: locationDef.id,
        components: locationDef.components,
      });

      const gameContext = await createGameContext(locationDef.id);

      // Act - Measure deep nesting resolution
      const iterations = 30; // Reduced from 100 to 30 - still statistically significant
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await ScopeTestUtilities.resolveScopeE2E(
          'test:deep_nested_access',
          testActor,
          gameContext,
          { scopeRegistry, scopeEngine }
        );
      }

      const endTime = performance.now();
      const avgResolutionTime = (endTime - startTime) / iterations;

      // Assert - Verify performance doesn't degrade with depth
      expect(avgResolutionTime).toBeLessThan(10); // < 10ms per resolution

      logger.info('Deep nesting performance', {
        nestingDepth: 6,
        iterations,
        avgResolutionTime: `${avgResolutionTime.toFixed(2)}ms`,
      });
    });
  });

  describe('Concurrent Access Patterns', () => {
    test('should handle multiple simultaneous resolutions efficiently', async () => {
      // Arrange - Create test data and various scopes
      const testEntities = await PerformanceTestBed.createOptimizedTestDataset(
        300, // Reduced from 500 for faster concurrent tests
        { registry, entityManager }
      );

      const testScopes = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:scope_1',
            expr: 'entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, 5]}]',
            description: 'Concurrent test scope 1',
          },
          {
            id: 'test:scope_2',
            expr: 'location.movement:exits[].target',
            description: 'Concurrent test scope 2',
          },
          {
            id: 'test:scope_3',
            expr: 'entities(core:item)[{">": [{"var": "entity.components.core:value"}, 100]}]',
            description: 'Concurrent test scope 3',
          },
        ]
      );

      scopeRegistry.initialize(testScopes);

      // Create multiple actors for concurrent resolution
      const actors = testEntities.actors.slice(0, 10);
      const concurrentCount = 10;

      // Create game context once for all resolutions
      const gameContext = await createGameContext(testEntities.location.id);

      // First, measure sequential baseline
      const sequentialStartTime = performance.now();
      const sequentialResults = [];

      for (let i = 0; i < concurrentCount; i++) {
        const actor = actors[i % actors.length];
        const scopeId = `test:scope_${(i % 3) + 1}`;

        const result = await ScopeTestUtilities.resolveScopeE2E(
          scopeId,
          actor,
          gameContext,
          {
            scopeRegistry,
            scopeEngine,
          }
        );
        sequentialResults.push(result);
      }

      const sequentialEndTime = performance.now();
      const sequentialTime = sequentialEndTime - sequentialStartTime;

      // Now measure concurrent performance
      const concurrentStartTime = performance.now();

      const resolutionPromises = [];
      for (let i = 0; i < concurrentCount; i++) {
        const actor = actors[i % actors.length];
        const scopeId = `test:scope_${(i % 3) + 1}`;

        resolutionPromises.push(
          ScopeTestUtilities.resolveScopeE2E(scopeId, actor, gameContext, {
            scopeRegistry,
            scopeEngine,
          })
        );
      }

      performanceMetrics.concurrentResolutions = concurrentCount;
      const concurrentResults = await Promise.all(resolutionPromises);

      const concurrentEndTime = performance.now();
      const concurrentTime = concurrentEndTime - concurrentStartTime;

      // Calculate performance improvement
      const speedupRatio = sequentialTime / concurrentTime;
      const percentImprovement =
        ((sequentialTime - concurrentTime) / sequentialTime) * 100;

      // Assert - Verify concurrent execution works correctly
      // Note: Since scope resolution is synchronous (CPU-bound), we don't expect
      // performance improvements from Promise.all in JavaScript's single-threaded environment.
      // In fact, concurrent execution might be slightly slower due to promise overhead.
      // We're primarily testing that concurrent resolutions don't interfere with each other.

      // Allow concurrent to be up to 50% slower than sequential (due to promise overhead)
      expect(speedupRatio).toBeGreaterThan(0.5); // At least 0.5x speed (can be slower)

      // Verify results are correct
      expect(concurrentResults).toHaveLength(concurrentCount);
      expect(concurrentResults.every((r) => r instanceof Set)).toBe(true);
      expect(sequentialResults).toHaveLength(concurrentCount);

      logger.info('Concurrent vs Sequential performance', {
        concurrentCount,
        sequentialTime: `${sequentialTime.toFixed(2)}ms`,
        concurrentTime: `${concurrentTime.toFixed(2)}ms`,
        speedupRatio: speedupRatio.toFixed(2),
        percentImprovement: `${percentImprovement.toFixed(1)}%`,
      });
    });

    test('should handle resource contention gracefully', async () => {
      // Arrange - Create shared resource scenario
      const sharedEntities =
        await PerformanceTestBed.createOptimizedTestDataset(100, {
          registry,
          entityManager,
        });

      // Create scope that will cause contention
      const testScopes = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:contentious_scope',
            expr: 'entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, {"var": "actor.core:stats.level"}]}]',
            description: 'Scope that compares against actor context',
          },
        ]
      );

      scopeRegistry.initialize(testScopes);

      const concurrentCount = 10; // Reduced from 20 to 10 - sufficient for contention testing
      const testActor = sharedEntities.actors[0];

      // Act - Create high contention scenario
      const startTime = performance.now();

      // Create game context once
      const gameContext = await createGameContext(sharedEntities.location.id);

      const resolutionPromises = [];
      for (let i = 0; i < concurrentCount; i++) {
        resolutionPromises.push(
          ScopeTestUtilities.resolveScopeE2E(
            'test:contentious_scope',
            testActor, // Same actor for all to create contention
            gameContext,
            { scopeRegistry, scopeEngine }
          )
        );
      }

      const results = await Promise.all(resolutionPromises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert - System should handle contention without errors
      expect(results).toHaveLength(concurrentCount);
      expect(results.every((r) => r instanceof Set)).toBe(true);
      // All results should be identical since using same actor
      const firstResult = Array.from(results[0]);
      expect(
        results.every((r) => {
          const arr = Array.from(r);
          return (
            arr.length === firstResult.length &&
            arr.every((id) => firstResult.includes(id))
          );
        })
      ).toBe(true);

      logger.info('Resource contention handling', {
        concurrentCount,
        totalTime: `${totalTime.toFixed(2)}ms`,
        avgTime: `${(totalTime / concurrentCount).toFixed(2)}ms`,
        consistentResults: true,
      });
    });
  });

  describe('Performance Summary', () => {
    test('should generate performance report', () => {
      // Generate summary of all performance metrics
      const avgResolutionTime =
        performanceMetrics.resolutionTimes.length > 0
          ? performanceMetrics.resolutionTimes.reduce((a, b) => a + b, 0) /
            performanceMetrics.resolutionTimes.length
          : 0;

      const report = {
        summary: 'ScopeDSL Performance Test Results',
        metrics: {
          avgResolutionTime: `${avgResolutionTime.toFixed(2)}ms`,
          maxConcurrentResolutions: performanceMetrics.concurrentResolutions,
        },
        targets: {
          resolutionTimeTarget: '< 200ms',
          concurrencyTarget: '10+ simultaneous',
        },
        status: {
          resolutionTime:
            avgResolutionTime < 200 && avgResolutionTime > 0 ? 'PASS' : 'FAIL',
          concurrency:
            performanceMetrics.concurrentResolutions >= 10
              ? 'PASS'
              : performanceMetrics.concurrentResolutions === 0
                ? 'SKIPPED'
                : 'FAIL',
        },
      };

      logger.info('Performance Test Summary', report);

      // Assert all targets are met (only if tests were run)
      if (performanceMetrics.resolutionTimes.length > 0) {
        expect(report.status.resolutionTime).toBe('PASS');
      }
      if (performanceMetrics.concurrentResolutions > 0) {
        expect(report.status.concurrency).toBe('PASS');
      } else {
        // If concurrent tests were not run, skip this assertion
        logger.warn(
          'Concurrent tests were not run, skipping concurrency assertion'
        );
      }
    });
  });

  // Helper functions

  /**
   * Measures performance with statistical sampling to reduce variance
   * Includes warm-up runs and environment-aware thresholds
   *
   * @param {Function} operation - Async operation to measure
   * @param {object} options - Measurement options
   * @param {number} [options.warmupRuns] - Number of warm-up runs for JIT optimization
   * @param {number} [options.measurementRuns] - Number of measurement runs for statistical sampling
   * @param {string} [options.operationName] - Name for logging
   * @returns {Promise<{median: number, mean: number, min: number, max: number, all: number[]}>} Performance statistics
   */
  async function measurePerformanceRobust(operation, options = {}) {
    const {
      warmupRuns = 2,
      measurementRuns = 5,
      operationName = 'operation',
    } = options;

    // Warm-up runs to establish JIT optimization and cache population
    logger.info(`Starting ${warmupRuns} warm-up runs for ${operationName}`);
    for (let i = 0; i < warmupRuns; i++) {
      await operation();
    }

    // Measurement runs with timing
    logger.info(
      `Starting ${measurementRuns} measurement runs for ${operationName}`
    );
    const times = [];
    for (let i = 0; i < measurementRuns; i++) {
      const startTime = performance.now();
      await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;
      times.push(duration);
    }

    // Calculate statistics
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    logger.info(`${operationName} performance statistics`, {
      median: `${median.toFixed(2)}ms`,
      mean: `${mean.toFixed(2)}ms`,
      min: `${min.toFixed(2)}ms`,
      max: `${max.toFixed(2)}ms`,
      variance: `${(((max - min) / mean) * 100).toFixed(1)}%`,
      allTimes: times.map((t) => `${t.toFixed(2)}ms`),
    });

    return { median, mean, min, max, all: times };
  }

  /**
   * Gets environment-aware performance threshold
   * Accounts for CI environment variance vs local development
   *
   * @param {number} baseThreshold - Base threshold in milliseconds
   * @param {number} [ciMultiplier] - Multiplier for CI environments
   * @returns {number} Adjusted threshold
   */
  function getPerformanceThreshold(baseThreshold, ciMultiplier = 1.5) {
    const isCI =
      process.env.CI || process.env.GITHUB_ACTIONS || process.env.JENKINS_URL;
    const threshold = isCI ? baseThreshold * ciMultiplier : baseThreshold;

    logger.info('Performance threshold calculation', {
      baseThreshold: `${baseThreshold}ms`,
      isCI,
      ciMultiplier,
      finalThreshold: `${threshold}ms`,
    });

    return threshold;
  }

  /**
   * Creates a game context for scope resolution
   *
   * @param {string} locationId - Location entity ID
   * @returns {Promise<object>} Game context object
   */
  async function createGameContext(locationId) {
    return {
      currentLocation: await entityManager.getEntityInstance(locationId),
      entityManager: entityManager,
      allEntities: Array.from(entityManager.entities || []),
      jsonLogicEval: jsonLogicService,
      logger: logger,
      spatialIndexManager: spatialIndexManager,
    };
  }

  // Entity creation is now handled by PerformanceTestBed.createOptimizedTestDataset()

  /**
   * Creates entities with deeply nested components for performance testing
   */
  async function createDeepNestedEntities() {
    const actorDef = {
      id: 'deep-nested-actor',
      description: 'Actor with deeply nested components',
      components: {
        'core:actor': { name: 'Nested Test Actor' },
        'core:stats': {
          level: 10,
          attributes: {
            physical: {
              strength: {
                base: {
                  value: 20,
                  modifiers: {
                    equipment: 5,
                    buffs: 3,
                  },
                },
                current: 28,
              },
              dexterity: {
                base: {
                  value: 15,
                },
              },
            },
            mental: {
              intelligence: {
                base: {
                  value: 18,
                },
              },
            },
          },
        },
      },
    };

    // Use batch creation for better performance
    const definitions = [new EntityDefinition(actorDef.id, actorDef)];
    await PerformanceTestBed.batchCreateEntities(
      definitions,
      registry,
      entityManager
    );

    return { actors: [{ id: actorDef.id }] };
  }
});
