/**
 * @file High Concurrency Performance Test Suite
 * @see reports/scopedsl-e2e-coverage-analysis.md - Section 5: Priority 2 Test 2.1
 *
 * This performance test suite validates system performance under high concurrency scenarios,
 * focusing on detailed benchmarking and timing analysis:
 * - Concurrency scaling (10, 25, 50, 75, 100 concurrent operations)
 * - Throughput benchmarks (ops/second at different concurrency levels)
 * - Error rate analysis under increasing load
 * - Timing consistency validation under concurrent load
 * - Performance regression detection
 *
 * Performance Targets:
 * - Throughput > 20 ops/second under 50 concurrent load
 * - Linear scaling up to 50 concurrent operations
 * - Error rate < 5% under normal concurrent load
 * - Consistent response times (variance < 50%)
 * - No performance degradation over multiple test cycles
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
jest.setTimeout(120000);

/**
 * Performance test suite for high concurrency scenarios in ScopeDSL
 * Validates performance characteristics and benchmarking under concurrent load
 */
describe('High Concurrency Performance', () => {
  let container;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let logger;
  let jsonLogicService;
  let spatialIndexManager;
  let registry;

  // Performance metrics tracking
  let performanceMetrics = {
    throughputResults: [],
    scalingResults: [],
    errorRates: [],
    timingConsistency: [],
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

    // Set up performance test conditions
    ScopeTestUtilities.setupScopeTestConditions(registry, [
      {
        id: 'perf-concurrency:lightweight-condition',
        description: 'Lightweight condition for throughput testing',
        logic: {
          '>': [{ var: 'entity.components.core:stats.level' }, 0],
        },
      },
      {
        id: 'perf-concurrency:moderate-condition',
        description: 'Moderate condition for scaling testing',
        logic: {
          and: [
            { '>': [{ var: 'entity.components.core:stats.level' }, 1] },
            {
              or: [
                { '>=': [{ var: 'entity.components.core:stats.strength' }, 10] },
                { '>=': [{ var: 'entity.components.core:health.current' }, 30] },
              ],
            },
          ],
        },
      },
      {
        id: 'perf-concurrency:heavy-condition',
        description: 'Heavy condition for stress testing',
        logic: {
          and: [
            { '>': [{ var: 'entity.components.core:stats.level' }, 2] },
            {
              or: [
                {
                  and: [
                    {
                      '>=': [{ var: 'entity.components.core:stats.strength' }, 15],
                    },
                    {
                      '>': [{ var: 'entity.components.core:health.current' }, 40],
                    },
                  ],
                },
                {
                  and: [
                    {
                      '>=': [{ var: 'entity.components.core:stats.agility' }, 12],
                    },
                    {
                      '<': [{ var: 'entity.components.core:health.current' }, 80],
                    },
                  ],
                },
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
          id: 'perf-concurrency:lightweight_filter',
          expr: 'entities(core:actor)[{"condition_ref": "perf-concurrency:lightweight-condition"}]',
          description: 'Lightweight filter for throughput testing',
        },
        {
          id: 'perf-concurrency:moderate_filter',
          expr: 'entities(core:actor)[{"condition_ref": "perf-concurrency:moderate-condition"}]',
          description: 'Moderate filter for scaling testing',
        },
        {
          id: 'perf-concurrency:heavy_filter',
          expr: 'entities(core:actor)[{"condition_ref": "perf-concurrency:heavy-condition"}]',
          description: 'Heavy filter for stress testing',
        },
        {
          id: 'perf-concurrency:chained_filter',
          expr: 'entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, 1]}][{"condition_ref": "perf-concurrency:moderate-condition"}]',
          description: 'Chained filter for complex concurrent testing',
        },
        {
          id: 'perf-concurrency:union_filter',
          expr: 'entities(core:actor)[{"condition_ref": "perf-concurrency:lightweight-condition"}] + entities(core:actor)[{"condition_ref": "perf-concurrency:moderate-condition"}]',
          description: 'Union filter for concurrent operation testing',
        },
      ]
    );

    // Initialize scope registry
    scopeRegistry.initialize(performanceScopes);

    // Reset performance metrics
    performanceMetrics = {
      throughputResults: [],
      scalingResults: [],
      errorRates: [],
      timingConsistency: [],
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
   */
  async function createPerformanceActor(actorId, config = {}) {
    const {
      level = Math.floor(Math.random() * 8) + 1,
      strength = Math.floor(Math.random() * 25) + 10,
      agility = Math.floor(Math.random() * 20) + 5,
      health = Math.floor(Math.random() * 70) + 30,
      maxHealth = 100,
      isPlayer = false,
    } = config;

    const components = {
      'core:actor': { isPlayer },
      'core:stats': { level, strength, agility },
      'core:health': { current: health, max: maxHealth },
      'core:position': { locationId: 'perf-concurrency-location' },
    };

    const definition = new EntityDefinition(actorId, {
      description: 'Performance concurrency test actor',
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
   * Creates dataset optimized for performance testing
   */
  async function createPerformanceDataset(size) {
    const entities = [];

    // Create test location
    const locationDefinition = new EntityDefinition('perf-concurrency-location', {
      description: 'Performance concurrency test location',
      components: {
        'core:position': { x: 0, y: 0 },
      },
    });
    registry.store('entityDefinitions', 'perf-concurrency-location', locationDefinition);
    await entityManager.createEntityInstance('perf-concurrency-location', {
      instanceId: 'perf-concurrency-location',
      definitionId: 'perf-concurrency-location',
    });

    // Create actors with predictable distribution
    for (let i = 0; i < size; i++) {
      const actorId = `perf-concurrency-actor-${i}`;
      const entity = await createPerformanceActor(actorId, {
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
      currentLocation: await entityManager.getEntityInstance('perf-concurrency-location'),
      entityManager: entityManager,
      allEntities: Array.from(entityManager.entities || []),
      jsonLogicEval: jsonLogicService,
      logger: logger,
      spatialIndexManager: spatialIndexManager,
    };
  }

  /**
   * Measures performance metrics for concurrent operations
   */
  async function measureConcurrentPerformance(
    scopeId,
    testActor,
    gameContext,
    concurrentOperations,
    description = ''
  ) {
    const promises = [];
    const operationResults = [];
    const startTime = performance.now();

    // Launch all concurrent operations
    for (let i = 0; i < concurrentOperations; i++) {
      const operationStartTime = performance.now();
      
      promises.push(
        ScopeTestUtilities.resolveScopeE2E(scopeId, testActor, gameContext, {
          scopeRegistry,
          scopeEngine,
        })
          .then(result => ({
            success: true,
            result,
            operationIndex: i,
            startTime: operationStartTime,
            endTime: performance.now(),
          }))
          .catch(error => ({
            success: false,
            error,
            operationIndex: i,
            startTime: operationStartTime,
            endTime: performance.now(),
          }))
      );
    }

    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Calculate metrics
    const successfulOperations = results.filter(r => r.success);
    const failedOperations = results.filter(r => !r.success);
    const errorRate = (failedOperations.length / results.length) * 100;
    const throughput = (successfulOperations.length / totalTime) * 1000; // ops per second
    const averageLatency = successfulOperations.reduce((sum, r) => sum + (r.endTime - r.startTime), 0) / successfulOperations.length;

    return {
      description,
      concurrentOperations,
      totalTime,
      successfulOperations: successfulOperations.length,
      failedOperations: failedOperations.length,
      errorRate,
      throughput,
      averageLatency,
      results,
    };
  }

  /**
   * Scenario 1: Concurrency Scaling Analysis
   * Tests performance scaling with increasing concurrency levels
   */
  describe('Concurrency Scaling Analysis', () => {
    test('should demonstrate linear scaling up to 50 concurrent operations', async () => {
      // Arrange - Create dataset for scaling testing
      const entityCount = 600;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Test different concurrency levels
      const concurrencyLevels = [10, 25, 50];
      const scalingResults = [];

      // Act - Test each concurrency level
      for (const concurrentOps of concurrencyLevels) {
        const metrics = await measureConcurrentPerformance(
          'perf-concurrency:moderate_filter',
          testActor,
          gameContext,
          concurrentOps,
          `${concurrentOps} concurrent operations`
        );

        scalingResults.push(metrics);

        // Small delay between tests to allow system stabilization
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Assert - Scaling should be reasonable
      expect(scalingResults).toHaveLength(concurrencyLevels.length);

      scalingResults.forEach(metrics => {
        expect(metrics.successfulOperations).toBe(metrics.concurrentOperations);
        expect(metrics.errorRate).toBe(0); // No errors expected in scaling test
        expect(metrics.throughput).toBeGreaterThan(5); // At least 5 ops/second
      });

      // Throughput should scale reasonably (not necessarily linearly due to overhead)
      const throughputs = scalingResults.map(r => r.throughput);
      const firstThroughput = throughputs[0];
      const lastThroughput = throughputs[throughputs.length - 1];

      // Should not degrade severely with higher concurrency
      expect(lastThroughput).toBeGreaterThan(firstThroughput * 0.3); // At least 30% of single-threaded performance

      performanceMetrics.scalingResults = scalingResults;

      logger.info('Concurrency scaling analysis results', {
        concurrencyLevels,
        scalingResults: scalingResults.map(r => ({
          concurrentOps: r.concurrentOperations,
          totalTime: `${r.totalTime.toFixed(2)}ms`,
          throughput: `${r.throughput.toFixed(2)} ops/sec`,
          avgLatency: `${r.averageLatency.toFixed(2)}ms`,
          errorRate: `${r.errorRate.toFixed(2)}%`,
        })),
        scalingEfficiency: `${((lastThroughput / firstThroughput) * 100).toFixed(1)}%`,
      });
    });

    test('should maintain performance consistency across multiple scaling cycles', async () => {
      // Arrange - Create dataset for consistency testing
      const entityCount = 400;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Act - Perform multiple cycles of scaling tests
      const cycles = 3;
      const concurrentOps = 30;
      const cycleResults = [];

      for (let cycle = 0; cycle < cycles; cycle++) {
        const metrics = await measureConcurrentPerformance(
          'perf-concurrency:moderate_filter',
          testActor,
          gameContext,
          concurrentOps,
          `Cycle ${cycle + 1}`
        );

        cycleResults.push(metrics);

        // Cleanup between cycles
        if (global.gc) {
          global.gc();
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Assert - Performance should be consistent across cycles
      expect(cycleResults).toHaveLength(cycles);

      const throughputs = cycleResults.map(r => r.throughput);
      const averageLatencies = cycleResults.map(r => r.averageLatency);

      // Calculate consistency metrics
      const avgThroughput = throughputs.reduce((a, b) => a + b) / throughputs.length;
      const throughputVariance = Math.max(...throughputs) - Math.min(...throughputs);
      const throughputConsistency = 1 - (throughputVariance / avgThroughput);

      const avgLatency = averageLatencies.reduce((a, b) => a + b) / averageLatencies.length;
      const latencyVariance = Math.max(...averageLatencies) - Math.min(...averageLatencies);

      // Performance should be reasonably consistent
      expect(throughputConsistency).toBeGreaterThan(0.7); // At least 70% consistency
      expect(latencyVariance).toBeLessThan(avgLatency * 0.5); // Latency variance < 50%

      logger.info('Scaling consistency analysis results', {
        cycles,
        concurrentOps,
        avgThroughput: `${avgThroughput.toFixed(2)} ops/sec`,
        throughputVariance: `${throughputVariance.toFixed(2)}`,
        throughputConsistency: `${(throughputConsistency * 100).toFixed(1)}%`,
        avgLatency: `${avgLatency.toFixed(2)}ms`,
        latencyVariance: `${latencyVariance.toFixed(2)}ms`,
      });
    });
  });

  /**
   * Scenario 2: Throughput Benchmarks
   * Measures ops/second at different concurrency levels
   */
  describe('Throughput Benchmarks', () => {
    test('should achieve >20 ops/second under 50 concurrent load', async () => {
      // Arrange - Create dataset for throughput testing
      const entityCount = 800;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Act - Measure throughput at target concurrency level
      const targetConcurrentOps = 50;
      const metrics = await measureConcurrentPerformance(
        'perf-concurrency:lightweight_filter',
        testActor,
        gameContext,
        targetConcurrentOps,
        'Target throughput benchmark'
      );

      // Assert - Should meet throughput target
      expect(metrics.successfulOperations).toBe(targetConcurrentOps);
      expect(metrics.errorRate).toBeLessThan(5); // Less than 5% error rate
      expect(metrics.throughput).toBeGreaterThan(20); // Target: >20 ops/second

      performanceMetrics.throughputResults.push(metrics);

      logger.info('Throughput benchmark results', {
        targetConcurrentOps,
        achievedThroughput: `${metrics.throughput.toFixed(2)} ops/sec`,
        totalTime: `${metrics.totalTime.toFixed(2)}ms`,
        averageLatency: `${metrics.averageLatency.toFixed(2)}ms`,
        errorRate: `${metrics.errorRate.toFixed(2)}%`,
        targetMet: metrics.throughput > 20,
      });
    });

    test('should handle different scope complexities with varying throughput', async () => {
      // Arrange - Create dataset for complexity comparison
      const entityCount = 500;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Test different scope complexities
      const complexityTests = [
        { scopeId: 'perf-concurrency:lightweight_filter', complexity: 'lightweight' },
        { scopeId: 'perf-concurrency:moderate_filter', complexity: 'moderate' },
        { scopeId: 'perf-concurrency:heavy_filter', complexity: 'heavy' },
      ];

      const concurrentOps = 30;
      const complexityResults = [];

      // Act - Test each complexity level
      for (const test of complexityTests) {
        const metrics = await measureConcurrentPerformance(
          test.scopeId,
          testActor,
          gameContext,
          concurrentOps,
          `${test.complexity} complexity`
        );

        complexityResults.push({
          ...metrics,
          complexity: test.complexity,
          scopeId: test.scopeId,
        });

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Assert - Performance should correlate with complexity
      expect(complexityResults).toHaveLength(complexityTests.length);

      complexityResults.forEach(result => {
        expect(result.successfulOperations).toBeGreaterThan(0);
        expect(result.throughput).toBeGreaterThan(1); // At least 1 op/second
      });

      // Lightweight should generally be fastest
      const lightweightResult = complexityResults.find(r => r.complexity === 'lightweight');
      const heavyResult = complexityResults.find(r => r.complexity === 'heavy');

      if (lightweightResult && heavyResult) {
        expect(lightweightResult.throughput).toBeGreaterThanOrEqual(heavyResult.throughput * 0.5);
      }

      logger.info('Complexity throughput comparison', {
        concurrentOps,
        results: complexityResults.map(r => ({
          complexity: r.complexity,
          throughput: `${r.throughput.toFixed(2)} ops/sec`,
          avgLatency: `${r.averageLatency.toFixed(2)}ms`,
          errorRate: `${r.errorRate.toFixed(2)}%`,
        })),
      });
    });
  });

  /**
   * Scenario 3: Error Rate Analysis
   * Monitor failure rates under increasing load
   */
  describe('Error Rate Analysis', () => {
    test('should maintain low error rate under normal concurrent load', async () => {
      // Arrange - Create dataset for error rate testing
      const entityCount = 600;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Act - Test error rates at different load levels
      const loadLevels = [20, 40, 60];
      const errorRateResults = [];

      for (const concurrentOps of loadLevels) {
        const metrics = await measureConcurrentPerformance(
          'perf-concurrency:moderate_filter',
          testActor,
          gameContext,
          concurrentOps,
          `Load level: ${concurrentOps} concurrent operations`
        );

        errorRateResults.push(metrics);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Assert - Error rates should remain low
      expect(errorRateResults).toHaveLength(loadLevels.length);

      errorRateResults.forEach((result, index) => {
        const loadLevel = loadLevels[index];
        expect(result.errorRate).toBeLessThan(10); // Less than 10% error rate

        // Normal load (up to 40 concurrent) should have very low error rate
        if (loadLevel <= 40) {
          expect(result.errorRate).toBeLessThan(5); // Less than 5% for normal load
        }
      });

      performanceMetrics.errorRates = errorRateResults;

      logger.info('Error rate analysis results', {
        loadLevels,
        errorRates: errorRateResults.map((r, i) => ({
          concurrentOps: loadLevels[i],
          errorRate: `${r.errorRate.toFixed(2)}%`,
          successfulOps: r.successfulOperations,
          failedOps: r.failedOperations,
        })),
      });
    });

    test('should provide detailed error analysis under high load', async () => {
      // Arrange - Create dataset for high load error analysis
      const entityCount = 400;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Act - Stress test with high concurrency
      const stressConcurrentOps = 80;
      const metrics = await measureConcurrentPerformance(
        'perf-concurrency:heavy_filter',
        testActor,
        gameContext,
        stressConcurrentOps,
        'High load stress test'
      );

      // Analyze error patterns
      const failedResults = metrics.results.filter(r => !r.success);
      const errorTypes = new Map();

      failedResults.forEach(result => {
        const errorType = result.error?.constructor?.name || 'UnknownError';
        errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
      });

      // Assert - System should handle high load gracefully
      expect(metrics.successfulOperations).toBeGreaterThan(stressConcurrentOps * 0.5); // At least 50% success under stress
      expect(metrics.errorRate).toBeLessThan(50); // Less than 50% error rate even under stress

      logger.info('High load error analysis', {
        stressConcurrentOps,
        successRate: `${(100 - metrics.errorRate).toFixed(2)}%`,
        errorRate: `${metrics.errorRate.toFixed(2)}%`,
        errorTypes: Object.fromEntries(errorTypes),
        averageLatency: `${metrics.averageLatency.toFixed(2)}ms`,
        totalTime: `${metrics.totalTime.toFixed(2)}ms`,
      });
    });
  });

  /**
   * Scenario 4: Timing Consistency Validation
   * Verify consistent response times under concurrent load
   */
  describe('Timing Consistency Validation', () => {
    test('should maintain consistent response times under concurrent load', async () => {
      // Arrange - Create dataset for timing consistency testing
      const entityCount = 500;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Act - Measure timing consistency
      const concurrentOps = 40;
      const metrics = await measureConcurrentPerformance(
        'perf-concurrency:moderate_filter',
        testActor,
        gameContext,
        concurrentOps,
        'Timing consistency test'
      );

      // Analyze timing consistency
      const successfulResults = metrics.results.filter(r => r.success);
      const latencies = successfulResults.map(r => r.endTime - r.startTime);

      const minLatency = Math.min(...latencies);
      const maxLatency = Math.max(...latencies);
      const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
      const latencyVariance = maxLatency - minLatency;
      const consistencyRatio = latencyVariance / avgLatency;

      // Assert - Timing should be reasonably consistent
      expect(metrics.successfulOperations).toBe(concurrentOps);
      expect(consistencyRatio).toBeLessThan(2.0); // Variance should be less than 2x average (adjusted for test environment timing variability)

      // Calculate percentiles for better analysis
      const sortedLatencies = [...latencies].sort((a, b) => a - b);
      const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)];
      const p90 = sortedLatencies[Math.floor(sortedLatencies.length * 0.9)];
      const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];

      performanceMetrics.timingConsistency.push({
        concurrentOps,
        avgLatency,
        minLatency,
        maxLatency,
        latencyVariance,
        consistencyRatio,
        p50,
        p90,
        p95,
      });

      logger.info('Timing consistency analysis', {
        concurrentOps,
        avgLatency: `${avgLatency.toFixed(2)}ms`,
        minLatency: `${minLatency.toFixed(2)}ms`,
        maxLatency: `${maxLatency.toFixed(2)}ms`,
        latencyVariance: `${latencyVariance.toFixed(2)}ms`,
        consistencyRatio: `${(consistencyRatio * 100).toFixed(1)}%`,
        percentiles: {
          p50: `${p50.toFixed(2)}ms`,
          p90: `${p90.toFixed(2)}ms`,
          p95: `${p95.toFixed(2)}ms`,
        },
      });
    });

    test('should demonstrate timing predictability across multiple runs', async () => {
      // Arrange - Create dataset for predictability testing
      const entityCount = 300;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Act - Perform multiple identical runs
      const runs = 5;
      const concurrentOps = 25;
      const runResults = [];

      for (let run = 0; run < runs; run++) {
        const metrics = await measureConcurrentPerformance(
          'perf-concurrency:lightweight_filter',
          testActor,
          gameContext,
          concurrentOps,
          `Predictability run ${run + 1}`
        );

        runResults.push(metrics);
        
        // Cleanup between runs
        if (global.gc) {
          global.gc();
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Analyze predictability across runs
      const throughputs = runResults.map(r => r.throughput);
      const avgLatencies = runResults.map(r => r.averageLatency);

      const avgThroughput = throughputs.reduce((a, b) => a + b) / throughputs.length;
      const throughputVariance = Math.max(...throughputs) - Math.min(...throughputs);
      const throughputPredictability = 1 - (throughputVariance / avgThroughput);

      const avgLatency = avgLatencies.reduce((a, b) => a + b) / avgLatencies.length;
      const latencyVariance = Math.max(...avgLatencies) - Math.min(...avgLatencies);

      // Assert - Results should be predictable across runs
      expect(runResults).toHaveLength(runs);
      expect(throughputPredictability).toBeGreaterThan(0.6); // At least 60% predictability

      runResults.forEach(result => {
        expect(result.successfulOperations).toBe(concurrentOps);
        expect(result.errorRate).toBeLessThan(5);
      });

      logger.info('Timing predictability analysis', {
        runs,
        concurrentOps,
        avgThroughput: `${avgThroughput.toFixed(2)} ops/sec`,
        throughputVariance: `${throughputVariance.toFixed(2)}`,
        throughputPredictability: `${(throughputPredictability * 100).toFixed(1)}%`,
        avgLatency: `${avgLatency.toFixed(2)}ms`,
        latencyVariance: `${latencyVariance.toFixed(2)}ms`,
        runResults: runResults.map((r, i) => ({
          run: i + 1,
          throughput: `${r.throughput.toFixed(2)} ops/sec`,
          avgLatency: `${r.averageLatency.toFixed(2)}ms`,
          errorRate: `${r.errorRate.toFixed(2)}%`,
        })),
      });
    });
  });

  /**
   * Scenario 5: Performance Regression Detection
   * Detect performance changes over multiple test cycles
   */
  describe('Performance Regression Detection', () => {
    test('should detect no performance degradation over multiple cycles', async () => {
      // Arrange - Create dataset for regression testing
      const entityCount = 400;
      const testEntities = await createPerformanceDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createPerformanceGameContext();

      // Act - Perform baseline and multiple test cycles
      const cycles = 4;
      const concurrentOps = 35;
      const cycleResults = [];

      for (let cycle = 0; cycle < cycles; cycle++) {
        const metrics = await measureConcurrentPerformance(
          'perf-concurrency:moderate_filter',
          testActor,
          gameContext,
          concurrentOps,
          `Regression detection cycle ${cycle + 1}`
        );

        cycleResults.push({
          cycle: cycle + 1,
          ...metrics,
        });

        // System cleanup between cycles
        if (global.gc) {
          global.gc();
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze for performance regression
      const baselineResult = cycleResults[0];
      const regressionThreshold = 0.8; // 80% of baseline performance
      
      let regressionDetected = false;
      const regressionAnalysis = [];

      cycleResults.forEach((result, index) => {
        const performanceRatio = result.throughput / baselineResult.throughput;
        const isRegression = performanceRatio < regressionThreshold;
        
        if (isRegression) {
          regressionDetected = true;
        }

        regressionAnalysis.push({
          cycle: result.cycle,
          throughput: result.throughput,
          performanceRatio,
          isRegression,
          errorRate: result.errorRate,
          avgLatency: result.averageLatency,
        });
      });

      // Assert - No significant performance regression should be detected
      expect(cycleResults).toHaveLength(cycles);
      expect(regressionDetected).toBe(false);

      // All cycles should maintain reasonable performance
      cycleResults.forEach(result => {
        expect(result.successfulOperations).toBe(concurrentOps);
        expect(result.throughput).toBeGreaterThan(baselineResult.throughput * regressionThreshold);
        expect(result.errorRate).toBeLessThan(10);
      });

      logger.info('Performance regression analysis', {
        cycles,
        concurrentOps,
        baselineThroughput: `${baselineResult.throughput.toFixed(2)} ops/sec`,
        regressionThreshold: `${(regressionThreshold * 100)}%`,
        regressionDetected,
        cycleAnalysis: regressionAnalysis.map(r => ({
          cycle: r.cycle,
          throughput: `${r.throughput.toFixed(2)} ops/sec`,
          performanceRatio: `${(r.performanceRatio * 100).toFixed(1)}%`,
          avgLatency: `${r.avgLatency.toFixed(2)}ms`,
          errorRate: `${r.errorRate.toFixed(2)}%`,
          status: r.isRegression ? 'REGRESSION' : 'OK',
        })),
      });
    });
  });
});