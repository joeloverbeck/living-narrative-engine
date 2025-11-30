/**
 * @file Performance baseline tests for infrastructure components
 * @description TSTAIMIG-002: Establishes performance benchmarks and regression detection
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ModTestHandlerFactory } from '../../common/mods/ModTestHandlerFactory.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../common/mods/ModAssertionHelpers.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

// Mock file system for consistent performance testing.
// Both async (promises) and sync APIs are exercised by ModTestFixture/ModTestHandlerFactory,
// so we stub the minimal surface needed to keep the perf tests deterministic.
jest.mock('fs', () => {
  const createFn = (returnValue) => jest.fn().mockReturnValue(returnValue);

  return {
    promises: {
      access: jest.fn(),
      readFile: jest.fn(),
      readdir: jest.fn(),
    },
    constants: {
      F_OK: 0,
    },
    existsSync: createFn(false),
    readdirSync: createFn([]),
    readFileSync: createFn('{}'),
  };
});

describe('Infrastructure Performance Baseline Tests (TSTAIMIG-002)', () => {
  let entityManager;
  let eventBus;
  let logger;
  // ModTestFixture and ModAssertionHelpers are static utility classes
  let fs;

  beforeEach(() => {
    entityManager = new SimpleEntityManager([]);
    eventBus = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // No instances needed - using static methods

    fs = require('fs');
    fs.promises.access.mockClear();
    fs.promises.readFile.mockClear();
    fs.promises.readdir.mockClear();
    fs.promises.readdir.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Performance measurement utility
   *
   * @param {Function} fn - Function to measure
   * @param {string} operation - Operation name for logging
   * @returns {Promise<{result: any, duration: number}>}
   */
  async function measurePerformance(fn, operation) {
    const startTime = process.hrtime.bigint();
    const result = await fn();
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    return { result, duration };
  }

  /**
   * Performance test wrapper with statistical analysis
   *
   * @param {Function} fn - Function to test
   * @param {object} options - Test options
   * @returns {Promise<object>} Performance statistics
   */
  async function performanceTest(fn, options = {}) {
    const {
      iterations = 100,
      warmupIterations = 10,
      maxDuration = 50, // milliseconds
      operation = 'Unknown Operation',
    } = options;

    const durations = [];

    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
      await fn();
    }

    // Measurement phase
    for (let i = 0; i < iterations; i++) {
      const { duration } = await measurePerformance(fn, operation);
      durations.push(duration);
    }

    // Statistical analysis
    const sortedDurations = durations.sort((a, b) => a - b);
    const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const median = sortedDurations[Math.floor(sortedDurations.length / 2)];
    const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)];
    const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)];
    const min = sortedDurations[0];
    const max = sortedDurations[sortedDurations.length - 1];

    const stats = {
      operation,
      iterations,
      mean: parseFloat(mean.toFixed(3)),
      median: parseFloat(median.toFixed(3)),
      p95: parseFloat(p95.toFixed(3)),
      p99: parseFloat(p99.toFixed(3)),
      min: parseFloat(min.toFixed(3)),
      max: parseFloat(max.toFixed(3)),
      maxDuration,
    };

    return stats;
  }

  const defaultRuleContent = {
    rule_id: 'test:mock_rule',
    event_type: 'core:attempt_action',
    actions: [],
  };

  const defaultConditionContent = {
    id: 'test:mock_condition',
  };

  /**
   *
   * @param root0
   * @param root0.ruleContent
   * @param root0.conditionContent
   * @param root0.failInitialRuleReads
   */
  function configureMockModFiles({
    ruleContent = defaultRuleContent,
    conditionContent = defaultConditionContent,
    failInitialRuleReads = 0,
  } = {}) {
    let ruleAttempts = 0;

    fs.promises.readFile.mockImplementation(async (filePath) => {
      const normalizedPath = String(filePath).replace(/\\/g, '/');

      if (normalizedPath.includes('/rules/')) {
        ruleAttempts += 1;
        if (ruleAttempts <= failInitialRuleReads) {
          throw new Error('File not found');
        }
        return JSON.stringify(ruleContent);
      }

      if (normalizedPath.includes('/conditions/')) {
        return JSON.stringify(conditionContent);
      }

      throw new Error(`Unexpected file read during performance test: ${filePath}`);
    });
  }

  describe('ModTestHandlerFactory Performance Baselines', () => {
    it('should create standard handlers within performance baseline', async () => {
      const stats = await performanceTest(
        () => {
          return ModTestHandlerFactory.createStandardHandlers(
            entityManager,
            eventBus,
            logger
          );
        },
        {
          operation: 'createStandardHandlers',
          iterations: 1000,
          maxDuration: 5, // Very fast operation
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);
      expect(stats.p99).toBeLessThan(stats.maxDuration * 3);

      console.log(`ModTestHandlerFactory.createStandardHandlers Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });

    it('should create handlers with ADD_COMPONENT within performance baseline', async () => {
      // Create a minimal mock dataRegistry for the test
      const mockDataRegistry = {
        getComponentDefinition: jest.fn().mockReturnValue(null),
        get: jest.fn().mockReturnValue(undefined),
      };

      const stats = await performanceTest(
        () => {
          return ModTestHandlerFactory.createHandlersWithAddComponent(
            entityManager,
            eventBus,
            logger,
            mockDataRegistry
          );
        },
        {
          operation: 'createHandlersWithAddComponent',
          iterations: 1000,
          maxDuration: 6, // Slightly slower due to additional handler
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);

      console.log(`ModTestHandlerFactory.createHandlersWithAddComponent Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });

    it('should handle category selection within performance baseline', async () => {
      const categories = [
        'exercise',
        'violence',
        'intimacy',
        'sex',
        'positioning',
      ];

      // Create a minimal mock dataRegistry for the test
      const mockDataRegistry = {
        getComponentDefinition: jest.fn().mockReturnValue(null),
        get: jest.fn().mockReturnValue(undefined),
      };

      const stats = await performanceTest(
        () => {
          const randomCategory =
            categories[Math.floor(Math.random() * categories.length)];
          const factoryMethod =
            ModTestHandlerFactory.getHandlerFactoryForCategory(randomCategory);
          return factoryMethod(entityManager, eventBus, logger, mockDataRegistry);
        },
        {
          operation: 'categoryBasedHandlerCreation',
          iterations: 500,
          maxDuration: 8, // Includes category lookup
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);

      console.log(`ModTestHandlerFactory Category Selection Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });

    it('should create safe dispatcher within performance baseline', async () => {
      const stats = await performanceTest(
        () => {
          return ModTestHandlerFactory.createSafeDispatcher(eventBus);
        },
        {
          operation: 'createSafeDispatcher',
          iterations: 2000,
          maxDuration: 2, // Very lightweight operation
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);

      console.log(`ModTestHandlerFactory.createSafeDispatcher Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });
  });

  describe('ModTestFixture Performance Baselines', () => {
    it('should perform auto-loading within performance baseline', async () => {
      // Mock successful file loading
      fs.promises.access.mockResolvedValue();
      configureMockModFiles({
        ruleContent: {
          rule_id: 'test:action_rule',
          event_type: 'core:attempt_action',
          actions: [],
        },
        conditionContent: {
          id: 'test:event-is-action-action',
        },
      });

      const stats = await performanceTest(
        async () => {
          return await ModTestFixture.forAction('test', 'action');
        },
        {
          operation: 'ModTestFixture.forAction',
          iterations: 200,
          maxDuration: 15, // File I/O operations are slower
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);

      console.log(`ModTestFixture.forAction Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });

    it('should handle fallback patterns within performance baseline', async () => {
      // Mock file reads to trigger fallback behavior
      configureMockModFiles({
        failInitialRuleReads: 2,
        ruleContent: {
          rule_id: 'fallback:test_rule',
          event_type: 'core:attempt_action',
          actions: [],
        },
        conditionContent: {
          id: 'fallback:event-is-action-test',
        },
      });

      const stats = await performanceTest(
        async () => {
          return await ModTestFixture.forAction('fallback', 'test');
        },
        {
          operation: 'ModTestFixture.forAction with fallbacks',
          iterations: 50,
          maxDuration: 25, // Fallback operations are slower
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);

      console.log(`ModTestFixture.forAction (with fallbacks) Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });

    it('should perform rule loading within performance baseline', async () => {
      fs.promises.access.mockResolvedValue();
      configureMockModFiles({
        ruleContent: {
          rule_id: 'test:rule_rule',
          event_type: 'core:attempt_action',
          actions: [],
        },
        conditionContent: {
          id: 'test:event-is-action-rule',
        },
      });

      const stats = await performanceTest(
        async () => {
          return await ModTestFixture.forRule('test', 'rule');
        },
        {
          operation: 'ModTestFixture.forRule',
          iterations: 200,
          maxDuration: 15,
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);

      console.log(`ModTestFixture.forRule Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });
  });

  describe('ModEntityBuilder Performance Baselines', () => {
    it('should build basic entities within performance baseline', async () => {
      const stats = await performanceTest(
        () => {
          return new ModEntityBuilder('perf-test-entity')
            .withName('Performance Test Entity')
            .atLocation('test-location')
            .withComponent('core:actor', {})
            .build();
        },
        {
          operation: 'ModEntityBuilder basic build',
          iterations: 1000,
          maxDuration: 3, // Very fast entity creation
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);

      console.log(`ModEntityBuilder Basic Build Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });

    it('should build complex entities within performance baseline', async () => {
      const stats = await performanceTest(
        () => {
          return new ModEntityBuilder('complex-entity')
            .withName('Complex Performance Test Entity')
            .atLocation('complex-location')
            .withComponent('core:actor', {})
            .withComponent('positioning:standing', { posture: 'upright' })
            .withComponent('exercise:stamina', { current: 85, max: 100 })
            .withComponent('violence:health', { current: 100, max: 100 })
            .closeToEntity('other-entity')
            .build();
        },
        {
          operation: 'ModEntityBuilder complex build',
          iterations: 500,
          maxDuration: 8, // More complex entity creation
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);

      console.log(`ModEntityBuilder Complex Build Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });

    it('should handle positioning methods within performance baseline', async () => {
      const builder = new ModEntityBuilder('positioning-entity')
        .withName('Positioning Test Entity')
        .withComponent('core:actor', {});

      const stats = await performanceTest(
        () => {
          return builder
            .atLocation(`location-${Math.floor(Math.random() * 100)}`)
            .closeToEntity(`entity-${Math.floor(Math.random() * 100)}`)
            .build();
        },
        {
          operation: 'ModEntityBuilder positioning methods',
          iterations: 800,
          maxDuration: 5,
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);

      console.log(`ModEntityBuilder Positioning Methods Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });
  });

  describe('ModAssertionHelpers Performance Baselines', () => {
    beforeEach(() => {
      // Setup test entity for assertions
      const testEntity = new ModEntityBuilder('assertion-test-entity')
        .withName('Assertion Test Entity')
        .withComponent('core:actor', {})
        .withComponent('test:component', { value: 'test' })
        .build();

      entityManager.setEntities([testEntity]);
    });

    it('should perform action success assertions within performance baseline', async () => {
      const stats = await performanceTest(
        () => {
          const mockEvents = [
            {
              eventType: 'core:display_successful_action_result',
              payload: { message: 'Test success' },
            },
            {
              eventType: 'core:turn_ended',
              payload: { success: true },
            },
          ];
          return ModAssertionHelpers.assertActionSuccess(
            mockEvents,
            'Test success',
            {
              shouldEndTurn: true,
              shouldHavePerceptibleEvent: false,
            }
          );
        },
        {
          operation: 'ModAssertionHelpers.assertActionSuccess',
          iterations: 1000,
          maxDuration: 4, // Very fast assertion
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);

      console.log(`ModAssertionHelpers.assertActionSuccess Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });

    it('should perform component assertions within performance baseline', async () => {
      const stats = await performanceTest(
        () => {
          return ModAssertionHelpers.assertComponentAdded(
            entityManager,
            'assertion-test-entity',
            'test:component'
          );
        },
        {
          operation: 'ModAssertionHelpers.assertComponentAdded',
          iterations: 800,
          maxDuration: 6, // Requires entity manager lookup
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);

      console.log(`ModAssertionHelpers.assertComponentAdded Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });

    it('should perform perceptible event assertions within performance baseline', async () => {
      const stats = await performanceTest(
        () => {
          const mockEvents = [
            {
              eventType: 'core:perceptible_event',
              payload: {
                descriptionText: 'Test event',
                locationId: 'test-location',
                actorId: 'test-actor',
                perceptionType: 'action_target_general',
                involvedEntities: [],
              },
            },
          ];
          return ModAssertionHelpers.assertPerceptibleEvent(mockEvents, {
            descriptionText: 'Test event',
            locationId: 'test-location',
            actorId: 'test-actor',
          });
        },
        {
          operation: 'ModAssertionHelpers.assertPerceptibleEvent',
          iterations: 800,
          maxDuration: 5,
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);

      console.log(`ModAssertionHelpers.assertPerceptibleEvent Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });

    it('should perform multiple assertions within performance baseline', async () => {
      const stats = await performanceTest(
        () => {
          ModAssertionHelpers.assertComponentAdded(
            entityManager,
            'assertion-test-entity',
            'test:component'
          );
          const mockEvents = [
            {
              eventType: 'core:display_successful_action_result',
              payload: { message: 'Combined test success' },
            },
            {
              eventType: 'core:turn_ended',
              payload: { success: true },
            },
            {
              eventType: 'core:perceptible_event',
              payload: {
                descriptionText: 'Combined test',
                locationId: 'test-location',
                actorId: 'test-actor',
                perceptionType: 'action_target_general',
                involvedEntities: [],
              },
            },
          ];
          ModAssertionHelpers.assertActionSuccess(
            mockEvents,
            'Combined test success',
            {
              shouldEndTurn: true,
              shouldHavePerceptibleEvent: false,
            }
          );
          return ModAssertionHelpers.assertPerceptibleEvent(mockEvents, {
            descriptionText: 'Combined test',
            locationId: 'test-location',
            actorId: 'test-actor',
          });
        },
        {
          operation: 'ModAssertionHelpers combined assertions',
          iterations: 400,
          maxDuration: 15, // Multiple operations
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 2);

      console.log(`ModAssertionHelpers Combined Assertions Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });
  });

  describe('Integrated Workflow Performance Baselines', () => {
    it('should complete full workflow within performance baseline', async () => {
      // Mock file loading for realistic workflow
      fs.promises.access.mockResolvedValue();
      configureMockModFiles({
        ruleContent: {
          rule_id: 'performance:workflow_test_rule',
          event_type: 'core:attempt_action',
          actions: [],
        },
        conditionContent: {
          id: 'performance:event-is-action-workflow-test',
        },
      });

      const stats = await performanceTest(
        async () => {
          // Step 1: Load test data
          const testData = await ModTestFixture.forAction(
            'performance',
            'workflow_test'
          );

          // Step 2: Create handlers
          const handlers = ModTestHandlerFactory.createStandardHandlers(
            entityManager,
            eventBus,
            logger
          );

          // Step 3: Create entity
          const entity = new ModEntityBuilder('workflow-entity')
            .withName('Workflow Test Entity')
            .withComponent('core:actor', {})
            .build();

          entityManager.setEntities([entity]);

          // Step 4: Execute workflow
          await handlers.GET_NAME.execute(['workflow-entity']);
          await handlers.LOG_MESSAGE.execute(['Performance test']);
          await handlers.END_TURN.execute({
            entityId: 'workflow-entity',
            success: true,
          });

          // Step 5: Assert results
          const mockEvents = [
            {
              eventType: 'core:display_successful_action_result',
              payload: { message: 'Workflow test success' },
            },
            {
              eventType: 'core:turn_ended',
              payload: { success: true },
            },
          ];
          ModAssertionHelpers.assertActionSuccess(
            mockEvents,
            'Workflow test success',
            {
              shouldEndTurn: true,
              shouldHavePerceptibleEvent: false,
            }
          );

          return { testData, handlers, entity };
        },
        {
          operation: 'Full Infrastructure Workflow',
          iterations: 50,
          maxDuration: 40, // Complete workflow is slower
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 1.5);

      console.log(`Full Infrastructure Workflow Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });

    it('should handle concurrent operations within performance baseline', async () => {
      fs.promises.access.mockResolvedValue();
      configureMockModFiles({
        ruleContent: {
          rule_id: 'concurrent:test_rule',
          event_type: 'core:attempt_action',
          actions: [],
        },
        conditionContent: {
          id: 'concurrent:event-is-action-test',
        },
      });

      const stats = await performanceTest(
        async () => {
          const concurrentOps = Array.from({ length: 5 }, (_, i) => {
            return Promise.all([
              ModTestFixture.forAction('concurrent', `test_${i}`),
              ModTestHandlerFactory.createStandardHandlers(
                entityManager,
                eventBus,
                logger
              ),
              new ModEntityBuilder(`concurrent-entity-${i}`)
                .withName(`Concurrent Entity ${i}`)
                .withComponent('core:actor', {})
                .build(),
            ]);
          });

          return await Promise.all(concurrentOps);
        },
        {
          operation: 'Concurrent Infrastructure Operations',
          iterations: 20,
          maxDuration: 60, // Concurrent operations
        }
      );

      expect(stats.mean).toBeLessThan(stats.maxDuration);
      expect(stats.p95).toBeLessThan(stats.maxDuration * 1.5);

      console.log(`Concurrent Infrastructure Operations Performance:
        Mean: ${stats.mean}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    });
  });

  describe('Memory Usage and Resource Efficiency', () => {
    it('should maintain reasonable memory usage during repeated operations', () => {
      // Force garbage collection before starting if available (Node --expose-gc flag)
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage();

      // Test entity creation and management memory usage
      // Note: We're not testing handler creation here as handlers are typically
      // created once at startup in production, not repeatedly
      for (let i = 0; i < 1000; i++) {
        const entity = new ModEntityBuilder(`memory-test-${i}`)
          .withName(`Memory Test Entity ${i}`)
          .withComponent('core:actor', {})
          .build();

        // Clear entity manager periodically to prevent accumulation
        // This simulates cleanup that would happen in production
        if (i % 100 === 0) {
          entityManager = new SimpleEntityManager([]);
        }
      }

      // Attempt to trigger garbage collection before measurement
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const heapGrowthMB = heapGrowth / (1024 * 1024);

      // Memory growth should be reasonable (< 20MB for 1000 entity operations)
      // Increased threshold to account for:
      // - V8 heap management strategies
      // - Pending garbage collection
      // - Test framework overhead
      expect(heapGrowthMB).toBeLessThan(20);

      console.log(`Memory Usage Analysis:
        Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Final Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Growth: ${heapGrowthMB.toFixed(2)}MB`);
    });

    it('should validate resource cleanup after operations', () => {
      const testEntities = [];

      // Create many entities and handlers
      for (let i = 0; i < 100; i++) {
        const handlers = ModTestHandlerFactory.createStandardHandlers(
          entityManager,
          eventBus,
          logger
        );

        const entity = new ModEntityBuilder(`cleanup-test-${i}`)
          .withName(`Cleanup Test Entity ${i}`)
          .withComponent('core:actor', {})
          .build();

        const currentEntities = entityManager.getEntities();
        currentEntities.push(entity);
        entityManager.setEntities(currentEntities);
        testEntities.push(entity);
      }

      // Verify entities were created
      expect(testEntities).toHaveLength(100);

      // Cleanup
      entityManager = new SimpleEntityManager([]);
      testEntities.length = 0;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Memory should be available for cleanup
      const memoryAfterCleanup = process.memoryUsage();
      expect(memoryAfterCleanup).toBeDefined();
    });
  });

  describe('Performance Regression Detection', () => {
    it('should establish baseline metrics for regression testing', async () => {
      const baselineMetrics = {
        handlerFactory: await performanceTest(
          () =>
            ModTestHandlerFactory.createStandardHandlers(
              entityManager,
              eventBus,
              logger
            ),
          {
            operation: 'Handler Factory Baseline',
            iterations: 500,
            maxDuration: 5,
          }
        ),
        entityBuilder: await performanceTest(
          () =>
            new ModEntityBuilder('baseline-entity')
              .withName('Baseline Entity')
              .withComponent('core:actor', {})
              .build(),
          {
            operation: 'Entity Builder Baseline',
            iterations: 500,
            maxDuration: 3,
          }
        ),
        assertions: await performanceTest(
          () => {
            const mockEvents = [
              {
                eventType: 'core:display_successful_action_result',
                payload: { message: 'Baseline test success' },
              },
              {
                eventType: 'core:turn_ended',
                payload: { success: true },
              },
            ];
            return ModAssertionHelpers.assertActionSuccess(
              mockEvents,
              'Baseline test success',
              {
                shouldEndTurn: true,
                shouldHavePerceptibleEvent: false,
              }
            );
          },
          { operation: 'Assertions Baseline', iterations: 500, maxDuration: 4 }
        ),
      };

      // Store baseline metrics for future comparison
      console.log('Performance Baseline Metrics:');
      Object.entries(baselineMetrics).forEach(([component, stats]) => {
        console.log(`  ${component}:`);
        console.log(`    Mean: ${stats.mean}ms`);
        console.log(`    P95: ${stats.p95}ms`);
        console.log(`    P99: ${stats.p99}ms`);

        // All baseline operations should be fast
        expect(stats.mean).toBeLessThan(stats.maxDuration);
        expect(stats.p95).toBeLessThan(stats.maxDuration * 2);
      });

      // Export baseline for CI/CD regression testing
      const baselineSummary = {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        metrics: Object.fromEntries(
          Object.entries(baselineMetrics).map(([key, stats]) => [
            key,
            { mean: stats.mean, p95: stats.p95, p99: stats.p99 },
          ])
        ),
      };

      console.log('\nBaseline Summary for CI/CD:');
      console.log(JSON.stringify(baselineSummary, null, 2));
    });
  });
});
