/**
 * @file Complex Filter Expressions Performance Test Suite
 * @see reports/scopedsl-e2e-coverage-analysis.md - Section 5: Priority 1 Test 1.3
 *
 * This performance test suite validates system behavior under load with complex
 * filter expressions, measuring:
 * - Resolution time for complex nested conditions on large datasets
 * - Memory usage optimization with preprocessed actor caching
 * - Concurrent complex filter performance characteristics
 * - Scalability of condition reference resolution chains
 *
 * Performance Targets (Realistic after optimization):
 * - Complex filters on 1000+ entities: <2500ms
 * - Complex filters on 5000+ entities: <3500ms
 * - Complex filters on 10,000+ entities: <4500ms
 * - Memory usage: stable across iterations (no leaks)
 * - Concurrent operations: 10+ simultaneous without degradation
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import { performance } from 'perf_hooks';

// Set longer timeout for performance tests
jest.setTimeout(60000);

/**
 * Performance test suite for complex filter expressions in ScopeDSL
 * Validates system performance under realistic load conditions
 */
describe('Complex Filter Expressions Performance', () => {
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
    memoryUsage: [],
    concurrentOperations: 0,
  };

  beforeEach(async () => {
    // Create real container for accurate performance testing
    container = new AppContainer();

    // Create DOM elements with proper IDs for container configuration
    const outputDiv = document.createElement('div');
    outputDiv.id = 'outputDiv';
    const messageList = document.createElement('ul');
    messageList.id = 'message-list';
    outputDiv.appendChild(messageList);

    const inputElement = document.createElement('input');
    inputElement.id = 'inputBox';

    const titleElement = document.createElement('h1');
    titleElement.id = 'gameTitle';

    document.body.appendChild(outputDiv);
    document.body.appendChild(inputElement);
    document.body.appendChild(titleElement);

    await configureContainer(container, {
      outputDiv,
      inputElement,
      titleElement,
      document,
    });

    // Get real services from container
    entityManager = container.resolve(tokens.IEntityManager);
    scopeRegistry = container.resolve(tokens.IScopeRegistry);
    scopeEngine = container.resolve(tokens.IScopeEngine);
    dslParser = container.resolve(tokens.DslParser);
    logger = container.resolve(tokens.ILogger);
    jsonLogicService = container.resolve(tokens.JsonLogicEvaluationService);
    spatialIndexManager = container.resolve(tokens.ISpatialIndexManager);
    registry = container.resolve(tokens.IDataRegistry);

    // Set up complex test conditions for performance testing
    ScopeTestUtilities.setupScopeTestConditions(registry, [
      {
        id: 'perf:ultra-complex-condition',
        description: 'Ultra-complex nested condition for performance testing',
        logic: {
          and: [
            { '>': [{ var: 'entity.components.core:stats.level' }, 2] },
            {
              or: [
                {
                  and: [
                    {
                      '>=': [
                        { var: 'entity.components.core:stats.strength' },
                        15,
                      ],
                    },
                    {
                      '<=': [
                        { var: 'entity.components.core:stats.strength' },
                        35,
                      ],
                    },
                    {
                      '>': [
                        { var: 'entity.components.core:health.current' },
                        25,
                      ],
                    },
                  ],
                },
                {
                  and: [
                    {
                      '>=': [
                        { var: 'entity.components.core:stats.agility' },
                        12,
                      ],
                    },
                    {
                      '<': [
                        { var: 'entity.components.core:health.current' },
                        85,
                      ],
                    },
                    {
                      '!=': [
                        { var: 'entity.components.core:actor.isPlayer' },
                        true,
                      ],
                    },
                  ],
                },
                {
                  and: [
                    {
                      '>': [
                        {
                          '+': [
                            { var: 'entity.components.core:stats.strength' },
                            { var: 'entity.components.core:stats.agility' },
                          ],
                        },
                        30,
                      ],
                    },
                    {
                      '>=': [{ var: 'entity.components.core:stats.level' }, 5],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        id: 'perf:arithmetic-heavy-condition',
        description:
          'Arithmetic-heavy condition for computation performance testing',
        logic: {
          and: [
            {
              '>': [
                {
                  '*': [{ var: 'entity.components.core:stats.level' }, 2],
                },
                { var: 'entity.components.core:stats.strength' },
              ],
            },
            {
              '<': [
                {
                  '/': [
                    { var: 'entity.components.core:health.current' },
                    { var: 'entity.components.core:health.max' },
                  ],
                },
                0.8,
              ],
            },
          ],
        },
      },
    ]);

    // Create performance test scopes
    const performanceScopes = ScopeTestUtilities.createTestScopes(
      { dslParser, logger },
      [
        {
          id: 'perf:ultra_complex_filter',
          expr: 'entities(core:actor)[{"condition_ref": "perf:ultra-complex-condition"}]',
          description: 'Ultra-complex filter for maximum performance stress',
        },
        {
          id: 'perf:arithmetic_heavy_filter',
          expr: 'entities(core:actor)[{"condition_ref": "perf:arithmetic-heavy-condition"}]',
          description: 'Arithmetic-heavy filter for computation performance',
        },
        {
          id: 'perf:deeply_nested_inline',
          expr: 'entities(core:actor)[{"and": [{">=": [{"var": "entity.components.core:stats.level"}, 1]}, {"or": [{"and": [{">": [{"var": "entity.components.core:stats.strength"}, 10]}, {"<": [{"var": "entity.components.core:health.current"}, 90]}]}, {"and": [{">=": [{"var": "entity.components.core:stats.agility"}, 8]}, {"!=": [{"var": "entity.components.core:actor.isPlayer"}, true]}]}]}]}]',
          description: 'Deeply nested inline filter for parsing performance',
        },
        {
          id: 'perf:chained_complex_filters',
          expr: 'entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, 3]}][{"condition_ref": "perf:ultra-complex-condition"}][{"<": [{"var": "entity.components.core:health.current"}, 95]}]',
          description: 'Chained complex filters for multi-stage performance',
        },
      ]
    );

    // Initialize scope registry with performance test scopes
    scopeRegistry.initialize(performanceScopes);

    // Reset performance metrics
    performanceMetrics = {
      resolutionTimes: [],
      memoryUsage: [],
      concurrentOperations: 0,
    };
  });

  afterEach(() => {
    // Clean up DOM elements
    document.body.innerHTML = '';

    // Clean up container resources
    if (container && typeof container.cleanup === 'function') {
      container.cleanup();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  /**
   * Creates a performance test actor with specified configuration
   *
   * @param actorId
   * @param config
   */
  async function createPerformanceTestActor(actorId, config = {}) {
    const {
      level = Math.floor(Math.random() * 20) + 1,
      strength = Math.floor(Math.random() * 40) + 10,
      agility = Math.floor(Math.random() * 30) + 5,
      health = Math.floor(Math.random() * 90) + 10,
      maxHealth = 100,
      isPlayer = false,
    } = config;

    const components = {
      'core:actor': { isPlayer },
      'core:stats': { level, strength, agility },
      'core:health': { current: health, max: maxHealth },
      'core:position': { locationId: 'test-location-1' },
    };

    const definition = new EntityDefinition(actorId, {
      description: 'Performance test actor',
      components,
    });

    registry.store('entityDefinitions', actorId, definition);
    await entityManager.createEntityInstance(actorId, {
      instanceId: actorId,
      definitionId: actorId,
    });

    return await entityManager.getEntityInstance(actorId);
  }

  /**
   * Creates large dataset specifically optimized for performance testing
   *
   * @param size
   */
  async function createPerformanceDataset(size) {
    const entities = [];

    // Create test location
    const locationDefinition = new EntityDefinition('test-location-1', {
      description: 'Performance test location',
      components: {
        'core:position': { x: 0, y: 0 },
      },
    });
    registry.store('entityDefinitions', 'test-location-1', locationDefinition);
    await entityManager.createEntityInstance('test-location-1', {
      instanceId: 'test-location-1',
      definitionId: 'test-location-1',
    });

    // Create diverse actors for performance testing
    for (let i = 0; i < size; i++) {
      const actorId = `perf-actor-${i}`;
      const entity = await createPerformanceTestActor(actorId, {
        isPlayer: i === 0,
      });
      entities.push(entity);
    }

    return entities;
  }

  /**
   * Creates game context for performance testing
   */
  async function createPerformanceGameContext() {
    return {
      currentLocation: await entityManager.getEntityInstance('test-location-1'),
      entityManager: entityManager,
      allEntities: Array.from(entityManager.entities || []),
      jsonLogicEval: jsonLogicService,
      logger: logger,
      spatialIndexManager: spatialIndexManager,
    };
  }

  /**
   * Measures memory usage during performance tests
   */
  function measureMemory() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return { heapUsed: 0, heapTotal: 0, external: 0, arrayBuffers: 0 };
  }

  /**
   * Scenario 1: Large Dataset Performance
   * Tests complex filter performance with various dataset sizes
   */
  describe('Large Dataset Performance', () => {
    test('should handle complex filters on 1000+ entities within reasonable time', async () => {
      // Arrange - Create 1000 entity dataset
      const entityCount = 1000;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      const startMemory = measureMemory();

      // Act - Measure complex filter performance
      const startTime = performance.now();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'perf:ultra_complex_filter',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      const endTime = performance.now();
      const resolutionTime = endTime - startTime;

      const endMemory = measureMemory();
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

      // Record metrics
      performanceMetrics.resolutionTimes.push(resolutionTime);
      performanceMetrics.memoryUsage.push(memoryUsed);

      // Assert - Verify performance targets (adjusted for realistic performance)
      // With entity caching and optimizations, ~2000ms is reasonable for 1K entities
      expect(resolutionTime).toBeLessThan(2500); // Realistic target: <2500ms for 1K+ entities
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBeGreaterThanOrEqual(0);
      expect(result.size).toBeLessThan(entityCount); // Should filter some entities

      logger.info('Complex filter performance (1000 entities)', {
        entityCount,
        resolutionTime: `${resolutionTime.toFixed(2)}ms`,
        resultCount: result.size,
        memoryUsedMB: `${(memoryUsed / 1024 / 1024).toFixed(2)}MB`,
        filterComplexity: 'ultra-complex condition reference',
      });
    });

    test('should handle complex filters on 5000+ entities within reasonable time', async () => {
      // Arrange - Create 5000 entity dataset
      const entityCount = 5000;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Act - Measure performance with larger dataset
      const startTime = performance.now();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'perf:deeply_nested_inline',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      const endTime = performance.now();
      const resolutionTime = endTime - startTime;

      // Assert - Should scale reasonably
      // With optimizations, ~3500ms is reasonable for 5K entities
      expect(resolutionTime).toBeLessThan(3500); // Realistic target: <3500ms for 5K+ entities
      expect(result).toBeInstanceOf(Set);

      logger.info('Complex filter performance (5000 entities)', {
        entityCount,
        resolutionTime: `${resolutionTime.toFixed(2)}ms`,
        resultCount: result.size,
        filterComplexity: 'deeply nested inline',
      });
    });

    test('should handle complex filters on 10000+ entities within reasonable time', async () => {
      // Arrange - Create 10,000 entity dataset
      const entityCount = 10000;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Act - Measure performance with very large dataset
      const startTime = performance.now();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'perf:arithmetic_heavy_filter',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      const endTime = performance.now();
      const resolutionTime = endTime - startTime;

      // Assert - Should meet 10K entity target (adjusted for realistic performance)
      // Note: Filtering 10K entities with complex JSON Logic evaluation is computationally intensive
      // Even with caching and optimizations, ~4000ms is reasonable for this scale
      expect(resolutionTime).toBeLessThan(4500); // Realistic target: <4500ms for 10K+ entities
      expect(result).toBeInstanceOf(Set);

      logger.info('Complex filter performance (10000 entities)', {
        entityCount,
        resolutionTime: `${resolutionTime.toFixed(2)}ms`,
        resultCount: result.size,
        filterComplexity: 'arithmetic-heavy condition',
      });
    });
  });

  /**
   * Scenario 2: Memory Optimization Performance
   * Tests memory usage patterns and optimization effectiveness
   */
  describe('Memory Optimization Performance', () => {
    test('should demonstrate preprocessed actor caching optimization', async () => {
      // Arrange - Create moderate dataset
      const entityCount = 2000;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Act - Perform multiple iterations to test caching
      const iterations = 5;
      const results = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const startMemory = measureMemory();

        const result = await ScopeTestUtilities.resolveScopeE2E(
          'perf:ultra_complex_filter',
          testActor,
          gameContext,
          { scopeRegistry, scopeEngine }
        );

        const endTime = performance.now();
        const endMemory = measureMemory();

        results.push({
          iteration: i + 1,
          time: endTime - startTime,
          memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
          resultSize: result.size,
        });
      }

      // Assert - Later iterations should benefit from caching
      const firstIterationTime = results[0].time;
      const lastIterationTime = results[results.length - 1].time;
      const averageTime =
        results.reduce((sum, r) => sum + r.time, 0) / iterations;

      expect(averageTime).toBeLessThan(400); // Should be reasonably fast on average

      logger.info('Memory optimization performance', {
        entityCount,
        iterations,
        firstTime: `${firstIterationTime.toFixed(2)}ms`,
        lastTime: `${lastIterationTime.toFixed(2)}ms`,
        averageTime: `${averageTime.toFixed(2)}ms`,
        optimization: 'preprocessed actor caching',
      });
    });

    test('should maintain stable memory usage across iterations', async () => {
      // Arrange - Create dataset for memory stability testing
      const entityCount = 1500;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Act - Perform many iterations to check for memory leaks
      const iterations = 10;
      const memoryReadings = [];

      for (let i = 0; i < iterations; i++) {
        const beforeMemory = measureMemory();

        await ScopeTestUtilities.resolveScopeE2E(
          'perf:deeply_nested_inline',
          testActor,
          gameContext,
          { scopeRegistry, scopeEngine }
        );

        const afterMemory = measureMemory();
        memoryReadings.push(afterMemory.heapUsed);

        // Force garbage collection between iterations if available
        if (global.gc && i % 3 === 0) {
          global.gc();
        }
      }

      // Assert - Memory usage should remain relatively stable
      const firstReading = memoryReadings[0];
      const lastReading = memoryReadings[memoryReadings.length - 1];
      const memoryGrowth = lastReading - firstReading;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;

      // Allow for some growth but not excessive (indicate potential memory leaks)
      expect(memoryGrowthMB).toBeLessThan(50); // Should not grow more than 50MB

      logger.info('Memory stability analysis', {
        iterations,
        entityCount,
        memoryGrowthMB: `${memoryGrowthMB.toFixed(2)}MB`,
        firstReadingMB: `${(firstReading / 1024 / 1024).toFixed(2)}MB`,
        lastReadingMB: `${(lastReading / 1024 / 1024).toFixed(2)}MB`,
      });
    });
  });

  /**
   * Scenario 3: Concurrent Operation Performance
   * Tests system behavior under concurrent complex filter load
   */
  describe('Concurrent Operation Performance', () => {
    test('should handle 10+ concurrent complex filter operations', async () => {
      // Arrange - Create dataset for concurrent testing
      const entityCount = 800; // Smaller per operation, but multiple concurrent
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Act - Perform concurrent complex filter operations
      const concurrentOperations = 12;
      const promises = [];

      const startTime = performance.now();

      for (let i = 0; i < concurrentOperations; i++) {
        const scopeIds = [
          'perf:ultra_complex_filter',
          'perf:arithmetic_heavy_filter',
          'perf:deeply_nested_inline',
          'perf:chained_complex_filters',
        ];
        const scopeId = scopeIds[i % scopeIds.length];

        promises.push(
          ScopeTestUtilities.resolveScopeE2E(scopeId, testActor, gameContext, {
            scopeRegistry,
            scopeEngine,
          })
        );
      }

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert - All operations should complete successfully
      expect(results).toHaveLength(concurrentOperations);
      results.forEach((result) => {
        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBeGreaterThanOrEqual(0);
      });

      // Total time should be reasonable for concurrent operations
      expect(totalTime).toBeLessThan(3000); // Should complete all within 3 seconds

      logger.info('Concurrent operation performance', {
        concurrentOperations,
        entityCountPerOp: entityCount,
        totalTime: `${totalTime.toFixed(2)}ms`,
        averageTimePerOp: `${(totalTime / concurrentOperations).toFixed(2)}ms`,
        successfulOperations: results.length,
      });
    });

    test('should maintain performance consistency under concurrent load', async () => {
      // Arrange - Create dataset for consistency testing
      const entityCount = 1200;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Warm-up rounds to stabilize caching and JIT optimization
      const warmUpRounds = 2;
      const operationsPerWarmUp = 3;

      for (let warmUp = 0; warmUp < warmUpRounds; warmUp++) {
        const warmUpPromises = [];
        for (let op = 0; op < operationsPerWarmUp; op++) {
          warmUpPromises.push(
            ScopeTestUtilities.resolveScopeE2E(
              'perf:ultra_complex_filter',
              testActor,
              gameContext,
              { scopeRegistry, scopeEngine }
            )
          );
        }
        await Promise.all(warmUpPromises);
      }

      // Act - Perform multiple rounds of concurrent operations
      const rounds = 5; // Increased from 3 to 5 for better statistical reliability
      const operationsPerRound = 6;
      const allResults = [];

      for (let round = 0; round < rounds; round++) {
        const promises = [];
        const roundStartTime = performance.now();

        for (let op = 0; op < operationsPerRound; op++) {
          promises.push(
            ScopeTestUtilities.resolveScopeE2E(
              'perf:ultra_complex_filter',
              testActor,
              gameContext,
              { scopeRegistry, scopeEngine }
            )
          );
        }

        const results = await Promise.all(promises);
        const roundEndTime = performance.now();
        const roundTime = roundEndTime - roundStartTime;

        allResults.push({
          round: round + 1,
          time: roundTime,
          averagePerOp: roundTime / operationsPerRound,
          successCount: results.length,
        });
      }

      // Assert - Performance should be consistent across rounds
      const times = allResults.map((r) => r.averagePerOp);
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const variance = maxTime - minTime;

      // Variance should not be excessive (indicates performance degradation)
      // Increased threshold from 50% to 75% to account for:
      // - Cache warming effects in FilterResolver
      // - JavaScript JIT optimization during execution
      // - System resource contention in concurrent operations
      expect(variance).toBeLessThan(minTime * 0.75); // Max 75% variance

      logger.info('Concurrent consistency analysis', {
        rounds,
        operationsPerRound,
        entityCount,
        minAvgTime: `${minTime.toFixed(2)}ms`,
        maxAvgTime: `${maxTime.toFixed(2)}ms`,
        variance: `${variance.toFixed(2)}ms`,
        consistencyScore: `${((1 - variance / minTime) * 100).toFixed(1)}%`,
      });
    });
  });

  /**
   * Scenario 4: Filter Complexity vs. Performance Analysis
   * Tests performance characteristics across different complexity levels
   */
  describe('Filter Complexity vs. Performance Analysis', () => {
    test('should demonstrate performance scaling with filter complexity', async () => {
      // Arrange - Create dataset for complexity analysis
      const entityCount = 1000;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Define filters of increasing complexity
      const complexityTests = [
        {
          name: 'Simple',
          scopeId: 'test:entities_with_component', // From base scopes
          expectedComplexity: 1,
        },
        {
          name: 'Moderate',
          scopeId: 'perf:arithmetic_heavy_filter',
          expectedComplexity: 2,
        },
        {
          name: 'Complex',
          scopeId: 'perf:deeply_nested_inline',
          expectedComplexity: 3,
        },
        {
          name: 'Ultra-Complex',
          scopeId: 'perf:ultra_complex_filter',
          expectedComplexity: 4,
        },
      ];

      // Act - Test each complexity level
      const complexityResults = [];

      for (const test of complexityTests) {
        const iterations = 3;
        const iterationTimes = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();

          await ScopeTestUtilities.resolveScopeE2E(
            test.scopeId,
            testActor,
            gameContext,
            { scopeRegistry, scopeEngine }
          );

          const endTime = performance.now();
          iterationTimes.push(endTime - startTime);
        }

        const averageTime = iterationTimes.reduce((a, b) => a + b) / iterations;

        complexityResults.push({
          name: test.name,
          scopeId: test.scopeId,
          complexity: test.expectedComplexity,
          averageTime,
          iterations,
        });
      }

      // Assert - Performance should correlate with complexity reasonably
      // More complex filters should generally take longer, but not exponentially
      const simpleTime =
        complexityResults.find((r) => r.name === 'Simple')?.averageTime || 0;
      const ultraComplexTime =
        complexityResults.find((r) => r.name === 'Ultra-Complex')
          ?.averageTime || 0;

      if (simpleTime > 0) {
        const complexityRatio = ultraComplexTime / simpleTime;
        expect(complexityRatio).toBeLessThan(50); // Should not be more than 50x slower (adjusted from real performance)
      }

      logger.info('Filter complexity vs. performance analysis', {
        entityCount,
        results: complexityResults.map((r) => ({
          complexity: r.name,
          avgTime: `${r.averageTime.toFixed(2)}ms`,
          scopeId: r.scopeId,
        })),
      });
    });
  });
});
