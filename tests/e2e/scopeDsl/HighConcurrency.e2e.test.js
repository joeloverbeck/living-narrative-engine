/**
 * @file High Concurrency Scenarios E2E Test Suite
 * @see reports/scopedsl-e2e-coverage-analysis.md - Section 5: Priority 2 Test 2.1
 *
 * This E2E test suite validates system behavior under high concurrency scenarios,
 * focusing on functional correctness and system stability:
 * - 50+ concurrent scope resolutions with success validation
 * - Cache consistency validation under concurrent load
 * - Race condition prevention testing
 * - Resource contention handling
 * - Mixed scope complexity during concurrent operations
 *
 * Functional Targets:
 * - 50 concurrent operations complete successfully within 5 seconds
 * - Cache consistency maintained across all concurrent operations
 * - Zero race conditions or data corruption
 * - All operations produce consistent, correct results
 * - System remains stable under concurrent load
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

// Set longer timeout for concurrency tests
jest.setTimeout(60000);

/**
 * E2E test suite for high concurrency scenarios in ScopeDSL
 * Validates functional correctness and system stability under concurrent load
 */
describe('High Concurrency E2E', () => {
  let container;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let logger;
  let jsonLogicService;
  let spatialIndexManager;
  let registry;

  // Concurrent operation tracking
  let concurrentResults = [];
  let operationErrors = [];

  beforeEach(async () => {
    // Create real container for accurate concurrency testing
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

    // Set up test conditions for concurrency testing
    ScopeTestUtilities.setupScopeTestConditions(registry, [
      {
        id: 'concurrency:simple-condition',
        description: 'Simple condition for concurrency testing',
        logic: {
          '>': [{ var: 'entity.components.core:stats.level' }, 1],
        },
      },
      {
        id: 'concurrency:complex-condition',
        description: 'Complex condition for concurrency stress testing',
        logic: {
          and: [
            { '>': [{ var: 'entity.components.core:stats.level' }, 2] },
            {
              or: [
                {
                  '>=': [{ var: 'entity.components.core:stats.strength' }, 15],
                },
                {
                  and: [
                    {
                      '>=': [{ var: 'entity.components.core:stats.agility' }, 12],
                    },
                    {
                      '>': [{ var: 'entity.components.core:health.current' }, 50],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        id: 'concurrency:arithmetic-condition',
        description: 'Arithmetic condition for computation concurrency testing',
        logic: {
          '>': [
            {
              '*': [{ var: 'entity.components.core:stats.level' }, 2],
            },
            { var: 'entity.components.core:stats.strength' },
          ],
        },
      },
    ]);

    // Create concurrency test scopes with varying complexity
    const concurrencyScopes = ScopeTestUtilities.createTestScopes(
      { dslParser, logger },
      [
        {
          id: 'concurrency:simple_filter',
          expr: 'entities(core:actor)[{"condition_ref": "concurrency:simple-condition"}]',
          description: 'Simple filter for basic concurrency testing',
        },
        {
          id: 'concurrency:complex_filter',
          expr: 'entities(core:actor)[{"condition_ref": "concurrency:complex-condition"}]',
          description: 'Complex filter for concurrency stress testing',
        },
        {
          id: 'concurrency:arithmetic_filter',
          expr: 'entities(core:actor)[{"condition_ref": "concurrency:arithmetic-condition"}]',
          description: 'Arithmetic filter for computation concurrency testing',
        },
        {
          id: 'concurrency:chained_filter',
          expr: 'entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, 1]}][{"condition_ref": "concurrency:complex-condition"}]',
          description: 'Chained filter for multi-stage concurrency testing',
        },
        {
          id: 'concurrency:union_scope',
          expr: 'entities(core:actor)[{"condition_ref": "concurrency:simple-condition"}] + entities(core:actor)[{"condition_ref": "concurrency:arithmetic-condition"}]',
          description: 'Union scope for concurrency testing',
        },
      ]
    );

    // Initialize scope registry with concurrency test scopes
    scopeRegistry.initialize(concurrencyScopes);

    // Reset concurrent operation tracking
    concurrentResults = [];
    operationErrors = [];
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
   * Creates a concurrency test actor with specified configuration
   */
  async function createConcurrencyTestActor(actorId, config = {}) {
    const {
      level = Math.floor(Math.random() * 10) + 1,
      strength = Math.floor(Math.random() * 30) + 10,
      agility = Math.floor(Math.random() * 25) + 5,
      health = Math.floor(Math.random() * 80) + 20,
      maxHealth = 100,
      isPlayer = false,
    } = config;

    const components = {
      'core:actor': { isPlayer },
      'core:stats': { level, strength, agility },
      'core:health': { current: health, max: maxHealth },
      'core:position': { locationId: 'concurrency-test-location' },
    };

    const definition = new EntityDefinition(actorId, {
      description: 'Concurrency test actor',
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
   * Creates dataset for concurrency testing
   */
  async function createConcurrencyDataset(size) {
    const entities = [];

    // Create test location
    const locationDefinition = new EntityDefinition('concurrency-test-location', {
      description: 'Concurrency test location',
      components: {
        'core:position': { x: 0, y: 0 },
      },
    });
    registry.store('entityDefinitions', 'concurrency-test-location', locationDefinition);
    await entityManager.createEntityInstance('concurrency-test-location', {
      instanceId: 'concurrency-test-location',
      definitionId: 'concurrency-test-location',
    });

    // Create diverse actors for concurrency testing
    for (let i = 0; i < size; i++) {
      const actorId = `concurrency-actor-${i}`;
      const entity = await createConcurrencyTestActor(actorId, {
        isPlayer: i === 0,
      });
      entities.push(entity);
    }

    return entities;
  }

  /**
   * Creates game context for concurrency testing
   */
  async function createConcurrencyGameContext() {
    return {
      currentLocation: await entityManager.getEntityInstance('concurrency-test-location'),
      entityManager: entityManager,
      allEntities: Array.from(entityManager.entities || []),
      jsonLogicEval: jsonLogicService,
      logger: logger,
      spatialIndexManager: spatialIndexManager,
    };
  }

  /**
   * Scenario 1: Basic High Concurrency
   * Tests 50+ concurrent resolutions with success validation
   */
  describe('Basic High Concurrency', () => {
    test('should handle 50+ concurrent resolutions', async () => {
      // Arrange - Create dataset for concurrency testing
      const entityCount = 500;
      const testEntities = await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext();

      // Act - Perform 50 concurrent scope resolutions
      const concurrentOperations = 50;
      const promises = [];

      for (let i = 0; i < concurrentOperations; i++) {
        const scopeIds = [
          'concurrency:simple_filter',
          'concurrency:complex_filter',
          'concurrency:arithmetic_filter',
          'concurrency:chained_filter',
        ];
        const scopeId = scopeIds[i % scopeIds.length];

        promises.push(
          ScopeTestUtilities.resolveScopeE2E(scopeId, testActor, gameContext, {
            scopeRegistry,
            scopeEngine,
          }).catch(error => ({ error, scopeId, operationIndex: i }))
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Assert - All operations should complete successfully
      const successfulResults = results.filter(result => !result.error);
      const failedResults = results.filter(result => result.error);

      expect(successfulResults).toHaveLength(concurrentOperations);
      expect(failedResults).toHaveLength(0);

      // All successful results should be valid Sets
      successfulResults.forEach((result, index) => {
        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBeGreaterThanOrEqual(0);
      });

      // Should complete within reasonable time (5 seconds target)
      expect(totalTime).toBeLessThan(5000);

      logger.info('Basic high concurrency results', {
        concurrentOperations,
        entityCount,
        successfulOperations: successfulResults.length,
        failedOperations: failedResults.length,
        totalTime: `${totalTime}ms`,
        averageTimePerOp: `${(totalTime / concurrentOperations).toFixed(2)}ms`,
      });
    });

    test('should maintain result consistency across concurrent operations', async () => {
      // Arrange - Create smaller dataset for consistency testing
      const entityCount = 200;
      const testEntities = await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext();

      // Act - Perform multiple concurrent operations with same scope
      const concurrentOperations = 25;
      const scopeId = 'concurrency:simple_filter';
      const promises = [];

      for (let i = 0; i < concurrentOperations; i++) {
        promises.push(
          ScopeTestUtilities.resolveScopeE2E(scopeId, testActor, gameContext, {
            scopeRegistry,
            scopeEngine,
          })
        );
      }

      const results = await Promise.all(promises);

      // Assert - All results should be identical (same scope, same context)
      expect(results).toHaveLength(concurrentOperations);

      const firstResult = results[0];
      const firstResultArray = Array.from(firstResult).sort();

      results.forEach((result, index) => {
        expect(result).toBeInstanceOf(Set);
        const resultArray = Array.from(result).sort();
        expect(resultArray).toEqual(firstResultArray);
      });

      logger.info('Result consistency validation', {
        concurrentOperations,
        scopeId,
        resultSize: firstResult.size,
        allResultsIdentical: true,
      });
    });
  });

  /**
   * Scenario 2: Cache Consistency Under Load
   * Tests cache consistency with concurrent read/write operations
   */
  describe('Cache Consistency Under Load', () => {
    test('should maintain cache consistency under concurrent load', async () => {
      // Arrange - Create dataset for cache testing
      const entityCount = 300;
      const testEntities = await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext();

      // Act - Perform concurrent operations that should benefit from caching
      const rounds = 3;
      const operationsPerRound = 20;
      const allResults = [];

      for (let round = 0; round < rounds; round++) {
        const promises = [];
        const scopeId = 'concurrency:complex_filter';

        for (let op = 0; op < operationsPerRound; op++) {
          promises.push(
            ScopeTestUtilities.resolveScopeE2E(scopeId, testActor, gameContext, {
              scopeRegistry,
              scopeEngine,
            })
          );
        }

        const roundResults = await Promise.all(promises);
        allResults.push(...roundResults);

        // Small delay between rounds to allow cache stabilization
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Assert - All results should be consistent despite caching
      const totalOperations = rounds * operationsPerRound;
      expect(allResults).toHaveLength(totalOperations);

      // All results should be identical for the same scope/context
      const firstResult = allResults[0];
      const firstResultArray = Array.from(firstResult).sort();

      allResults.forEach((result, index) => {
        expect(result).toBeInstanceOf(Set);
        const resultArray = Array.from(result).sort();
        expect(resultArray).toEqual(firstResultArray);
      });

      logger.info('Cache consistency validation', {
        rounds,
        operationsPerRound,
        totalOperations,
        resultSize: firstResult.size,
        cacheConsistency: 'maintained',
      });
    });

    test('should handle concurrent access to different scopes', async () => {
      // Arrange - Create dataset for multi-scope testing
      const entityCount = 400;
      const testEntities = await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext();

      // Act - Perform concurrent operations on different scopes
      const concurrentOperations = 40;
      const scopeIds = [
        'concurrency:simple_filter',
        'concurrency:complex_filter',
        'concurrency:arithmetic_filter',
        'concurrency:chained_filter',
        'concurrency:union_scope',
      ];

      const promises = [];
      const operationMap = new Map();

      for (let i = 0; i < concurrentOperations; i++) {
        const scopeId = scopeIds[i % scopeIds.length];
        if (!operationMap.has(scopeId)) {
          operationMap.set(scopeId, []);
        }
        operationMap.get(scopeId).push(i);

        promises.push(
          ScopeTestUtilities.resolveScopeE2E(scopeId, testActor, gameContext, {
            scopeRegistry,
            scopeEngine,
          }).then(result => ({ result, scopeId, index: i }))
        );
      }

      const results = await Promise.all(promises);

      // Assert - Results should be consistent within each scope
      expect(results).toHaveLength(concurrentOperations);

      // Group results by scope and verify consistency within each scope
      const resultsByScope = new Map();
      results.forEach(({ result, scopeId, index }) => {
        if (!resultsByScope.has(scopeId)) {
          resultsByScope.set(scopeId, []);
        }
        resultsByScope.get(scopeId).push(result);
      });

      // Verify consistency within each scope
      resultsByScope.forEach((scopeResults, scopeId) => {
        const firstResult = scopeResults[0];
        const firstResultArray = Array.from(firstResult).sort();

        scopeResults.forEach((result, index) => {
          expect(result).toBeInstanceOf(Set);
          const resultArray = Array.from(result).sort();
          expect(resultArray).toEqual(firstResultArray);
        });
      });

      logger.info('Multi-scope concurrent access validation', {
        concurrentOperations,
        uniqueScopes: scopeIds.length,
        operationsPerScope: Math.floor(concurrentOperations / scopeIds.length),
        allScopesConsistent: true,
      });
    });
  });

  /**
   * Scenario 3: Race Condition Prevention
   * Tests same scope accessed simultaneously for race conditions
   */
  describe('Race Condition Prevention', () => {
    test('should prevent race conditions in same scope access', async () => {
      // Arrange - Create dataset for race condition testing
      const entityCount = 250;
      const testEntities = await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext();

      // Act - Perform many concurrent operations on the exact same scope
      const concurrentOperations = 30;
      const scopeId = 'concurrency:complex_filter';
      const promises = [];
      const operationTimestamps = [];

      // Launch all operations simultaneously
      for (let i = 0; i < concurrentOperations; i++) {
        const startTime = Date.now();
        promises.push(
          ScopeTestUtilities.resolveScopeE2E(scopeId, testActor, gameContext, {
            scopeRegistry,
            scopeEngine,
          }).then(result => {
            const endTime = Date.now();
            return {
              result,
              operationIndex: i,
              startTime,
              endTime,
              duration: endTime - startTime,
            };
          })
        );
        operationTimestamps.push(startTime);
      }

      const results = await Promise.all(promises);

      // Assert - All operations should produce identical results (no race conditions)
      expect(results).toHaveLength(concurrentOperations);

      const firstResult = results[0].result;
      const firstResultArray = Array.from(firstResult).sort();

      results.forEach(({ result, operationIndex, duration }) => {
        expect(result).toBeInstanceOf(Set);
        const resultArray = Array.from(result).sort();
        expect(resultArray).toEqual(firstResultArray);
        expect(duration).toBeGreaterThan(0);
      });

      // Verify operations were truly concurrent (overlapping timestamps)
      const minStartTime = Math.min(...operationTimestamps);
      const maxStartTime = Math.max(...operationTimestamps);
      const launchTimeSpread = maxStartTime - minStartTime;

      // Launch spread should be minimal (operations started nearly simultaneously)
      expect(launchTimeSpread).toBeLessThan(600); // Within 600ms (adjusted for test environment timing)

      logger.info('Race condition prevention validation', {
        concurrentOperations,
        scopeId,
        resultSize: firstResult.size,
        launchTimeSpread: `${launchTimeSpread}ms`,
        allResultsIdentical: true,
        raceConditionsDetected: 0,
      });
    });

    test('should handle rapid successive operations on varying scopes', async () => {
      // Arrange - Create dataset for rapid operation testing
      const entityCount = 350;
      const testEntities = await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext();

      // Act - Perform rapid successive operations with minimal delay
      const totalOperations = 60;
      const operationDelay = 5; // 5ms delay between launches
      const promises = [];
      const operationLog = [];

      const scopeIds = [
        'concurrency:simple_filter',
        'concurrency:complex_filter',
        'concurrency:arithmetic_filter',
      ];

      for (let i = 0; i < totalOperations; i++) {
        const scopeId = scopeIds[i % scopeIds.length];
        const startTime = Date.now();

        promises.push(
          ScopeTestUtilities.resolveScopeE2E(scopeId, testActor, gameContext, {
            scopeRegistry,
            scopeEngine,
          }).then(result => ({
            result,
            scopeId,
            operationIndex: i,
            startTime,
            endTime: Date.now(),
          }))
        );

        operationLog.push({ index: i, scopeId, launchTime: startTime });

        // Small delay between launches to create rapid succession
        if (i < totalOperations - 1) {
          await new Promise(resolve => setTimeout(resolve, operationDelay));
        }
      }

      const results = await Promise.all(promises);

      // Assert - All operations should complete successfully
      expect(results).toHaveLength(totalOperations);

      // Group by scope and verify consistency within each scope
      const resultsByScope = new Map();
      results.forEach(({ result, scopeId, operationIndex }) => {
        if (!resultsByScope.has(scopeId)) {
          resultsByScope.set(scopeId, []);
        }
        resultsByScope.get(scopeId).push({ result, operationIndex });
      });

      // Verify consistency within each scope type
      resultsByScope.forEach((scopeResults, scopeId) => {
        const firstResult = scopeResults[0].result;
        const firstResultArray = Array.from(firstResult).sort();

        scopeResults.forEach(({ result, operationIndex }) => {
          expect(result).toBeInstanceOf(Set);
          const resultArray = Array.from(result).sort();
          expect(resultArray).toEqual(firstResultArray);
        });
      });

      logger.info('Rapid successive operations validation', {
        totalOperations,
        operationDelay: `${operationDelay}ms`,
        uniqueScopes: scopeIds.length,
        allOperationsSuccessful: true,
        consistencyMaintained: true,
      });
    });
  });

  /**
   * Scenario 4: Mixed Complexity Concurrent Operations
   * Tests different scope complexities running simultaneously
   */
  describe('Mixed Complexity Concurrent Operations', () => {
    test('should handle mixed scope complexities concurrently', async () => {
      // Arrange - Create dataset for mixed complexity testing
      const entityCount = 450;
      const testEntities = await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext();

      // Act - Mix simple and complex operations
      const totalOperations = 45;
      const promises = [];
      const operationMix = [];

      const complexityLevels = [
        { scopeId: 'concurrency:simple_filter', complexity: 'simple', weight: 0.4 },
        { scopeId: 'concurrency:complex_filter', complexity: 'complex', weight: 0.3 },
        { scopeId: 'concurrency:arithmetic_filter', complexity: 'moderate', weight: 0.2 },
        { scopeId: 'concurrency:union_scope', complexity: 'complex', weight: 0.1 },
      ];

      for (let i = 0; i < totalOperations; i++) {
        // Select complexity level based on weights
        const rand = Math.random();
        let cumulativeWeight = 0;
        let selectedLevel;

        for (const level of complexityLevels) {
          cumulativeWeight += level.weight;
          if (rand <= cumulativeWeight) {
            selectedLevel = level;
            break;
          }
        }

        if (!selectedLevel) {
          selectedLevel = complexityLevels[0]; // fallback
        }

        operationMix.push({
          index: i,
          scopeId: selectedLevel.scopeId,
          complexity: selectedLevel.complexity,
        });

        promises.push(
          ScopeTestUtilities.resolveScopeE2E(selectedLevel.scopeId, testActor, gameContext, {
            scopeRegistry,
            scopeEngine,
          }).then(result => ({
            result,
            operationIndex: i,
            scopeId: selectedLevel.scopeId,
            complexity: selectedLevel.complexity,
          }))
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Assert - All operations should complete successfully
      expect(results).toHaveLength(totalOperations);

      results.forEach(({ result, complexity }) => {
        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBeGreaterThanOrEqual(0);
      });

      // Analyze performance by complexity
      const resultsByComplexity = new Map();
      results.forEach(({ result, complexity, scopeId }) => {
        if (!resultsByComplexity.has(complexity)) {
          resultsByComplexity.set(complexity, []);
        }
        resultsByComplexity.get(complexity).push({ result, scopeId });
      });

      // Verify results are consistent within each complexity/scope combination
      const consistencyResults = {};
      resultsByComplexity.forEach((complexityResults, complexity) => {
        const resultsByScope = new Map();
        complexityResults.forEach(({ result, scopeId }) => {
          if (!resultsByScope.has(scopeId)) {
            resultsByScope.set(scopeId, []);
          }
          resultsByScope.get(scopeId).push(result);
        });

        let complexityConsistent = true;
        resultsByScope.forEach((scopeResults, scopeId) => {
          if (scopeResults.length > 1) {
            const firstResult = Array.from(scopeResults[0]).sort();
            for (let i = 1; i < scopeResults.length; i++) {
              const currentResult = Array.from(scopeResults[i]).sort();
              if (!arraysEqual(firstResult, currentResult)) {
                complexityConsistent = false;
                break;
              }
            }
          }
        });

        consistencyResults[complexity] = complexityConsistent;
      });

      // All complexity levels should maintain consistency
      Object.values(consistencyResults).forEach(consistent => {
        expect(consistent).toBe(true);
      });

      logger.info('Mixed complexity concurrent operations validation', {
        totalOperations,
        complexityDistribution: Object.fromEntries(
          Array.from(resultsByComplexity.entries()).map(([complexity, results]) => [
            complexity,
            results.length,
          ])
        ),
        totalTime: `${totalTime}ms`,
        averageTimePerOp: `${(totalTime / totalOperations).toFixed(2)}ms`,
        consistencyByComplexity: consistencyResults,
        allOperationsSuccessful: true,
      });

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(6000); // 6 seconds for mixed complexity
    });
  });
});

// Helper function for array equality comparison
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}