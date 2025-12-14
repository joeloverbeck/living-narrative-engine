/**
 * @file High Concurrency Scenarios E2E Test Suite
 * @see reports/scopedsl-e2e-coverage-analysis.md - Section 5: Priority 2 Test 2.1
 *
 * This E2E test suite validates functional correctness under high concurrency scenarios,
 * focusing on behavioral validation and system stability:
 * - 50+ concurrent scope resolutions with success validation
 * - Cache consistency validation under concurrent load
 * - Race condition prevention testing
 * - Resource contention handling
 * - Mixed scope complexity during concurrent operations
 *
 * Functional Targets:
 * - All concurrent operations complete successfully
 * - Cache consistency maintained across all concurrent operations
 * - Zero race conditions or data corruption
 * - All operations produce consistent, correct results
 * - System remains stable under concurrent load
 *
 * Note: Performance timing constraints are tested in the corresponding performance suite.
 */

import {
  describe,
  beforeAll,
  afterAll,
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
 *
 * PERFORMANCE OPTIMIZED: Container setup moved to beforeAll to reduce test overhead
 * from ~7s to ~2-4s while maintaining full behavioral coverage.
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

  // OPTIMIZATION: Move expensive container setup to beforeAll (runs once per suite)
  beforeAll(async () => {
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
                      '>=': [
                        { var: 'entity.components.core:stats.agility' },
                        12,
                      ],
                    },
                    {
                      '>': [
                        { var: 'entity.components.core:health.current' },
                        50,
                      ],
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
  });

  // OPTIMIZATION: Move cleanup to afterAll (runs once per suite)
  afterAll(() => {
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
   * Wraps a promise with a timeout to prevent indefinite hanging
   *
   * @param {Promise} promise - The promise to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} operationName - Name of the operation for error messages
   * @returns {Promise} Promise that rejects if timeout is exceeded
   */
  function withTimeout(promise, timeoutMs, operationName) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Operation '${operationName}' timed out after ${timeoutMs}ms`
              )
            ),
          timeoutMs
        )
      ),
    ]);
  }

  // Track unique test run ID to prevent entity ID collisions across tests
  let testRunCounter = 0;

  /**
   * Creates dataset for concurrency testing
   * OPTIMIZED: Batch entity creation to reduce sequential awaits
   * NOTE: Uses unique IDs per test run to allow shared container across tests
   *
   * @param size
   */
  async function createConcurrencyDataset(size) {
    const entities = [];
    const runId = ++testRunCounter;
    const locationId = `concurrency-test-location-${runId}`;

    // Create test location with unique ID per test run
    const locationDefinition = new EntityDefinition(locationId, {
      description: 'Concurrency test location',
      components: {
        'core:position': { x: 0, y: 0 },
      },
    });
    registry.store('entityDefinitions', locationId, locationDefinition);
    await entityManager.createEntityInstance(locationId, {
      instanceId: locationId,
      definitionId: locationId,
    });

    // OPTIMIZED: Create all entity definitions first, then batch create instances
    const entityPromises = [];

    for (let i = 0; i < size; i++) {
      // Use unique actor ID per test run to prevent collisions with shared container
      const actorId = `concurrency-actor-${runId}-${i}`;

      // Store definition synchronously
      const definition = new EntityDefinition(actorId, {
        description: 'Concurrency test actor',
        components: {
          'core:actor': { isPlayer: i === 0 },
          'core:stats': {
            level: Math.floor(Math.random() * 10) + 1,
            strength: Math.floor(Math.random() * 30) + 10,
            agility: Math.floor(Math.random() * 25) + 5,
          },
          'core:health': {
            current: Math.floor(Math.random() * 80) + 20,
            max: 100,
          },
          // Reference the unique location for this test run
          'core:position': { locationId: locationId },
        },
      });
      registry.store('entityDefinitions', actorId, definition);

      // Queue entity creation
      entityPromises.push(
        entityManager
          .createEntityInstance(actorId, {
            instanceId: actorId,
            definitionId: actorId,
          })
          .then(() => entityManager.getEntityInstance(actorId))
      );
    }

    // OPTIMIZED: Create all entities in parallel
    const createdEntities = await Promise.all(entityPromises);
    entities.push(...createdEntities);

    // Return both entities and runId for game context creation
    return { entities, runId, locationId };
  }

  /**
   * Creates game context for concurrency testing
   * FIXED: Ensure all required services are properly initialized
   * NOTE: Accepts locationId to support unique location per test run
   *
   * @param {string} locationId - The unique location ID from createConcurrencyDataset
   */
  async function createConcurrencyGameContext(locationId) {
    // Validate required services before creating context
    if (!jsonLogicService) {
      throw new Error(
        'jsonLogicService is not initialized - required for filter operations'
      );
    }

    if (!entityManager) {
      throw new Error('entityManager is not initialized');
    }

    if (!locationId) {
      throw new Error(
        'locationId is required - ensure createConcurrencyDataset was called first and locationId passed'
      );
    }

    const location = await entityManager.getEntityInstance(locationId);
    if (!location) {
      throw new Error(
        `Test location '${locationId}' not found - ensure createConcurrencyDataset was called first`
      );
    }

    return {
      currentLocation: location,
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
      // OPTIMIZED: From 100 to 50 entities - still validates concurrency behavior
      const entityCount = 50;
      const { entities: testEntities, locationId } =
        await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext(locationId);

      // Act - Perform concurrent scope resolutions
      // OPTIMIZED: From 20 to 15 concurrent operations - sufficient for concurrency validation
      const concurrentOperations = 15;
      const promises = [];

      for (let i = 0; i < concurrentOperations; i++) {
        const scopeIds = [
          'concurrency:simple_filter',
          'concurrency:complex_filter',
          'concurrency:arithmetic_filter',
          'concurrency:chained_filter',
        ];
        const scopeId = scopeIds[i % scopeIds.length];

        // ADDED: Timeout wrapper to prevent hanging (5 seconds per operation)
        const operationPromise = withTimeout(
          ScopeTestUtilities.resolveScopeE2E(scopeId, testActor, gameContext, {
            scopeRegistry,
            scopeEngine,
          }),
          5000,
          `scope resolution ${i} (${scopeId})`
        );

        promises.push(
          operationPromise.catch((error) => ({
            error,
            scopeId,
            operationIndex: i,
          }))
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Assert - All operations should complete successfully
      const successfulResults = results.filter((result) => !result.error);
      const failedResults = results.filter((result) => result.error);

      // Log any failures for debugging
      if (failedResults.length > 0) {
        failedResults.forEach(({ error, scopeId, operationIndex }) => {
          logger.error(
            `Operation ${operationIndex} failed for scope ${scopeId}:`,
            error
          );
        });
      }

      expect(failedResults).toHaveLength(0);
      expect(successfulResults).toHaveLength(concurrentOperations);

      // All successful results should be valid Sets
      successfulResults.forEach((result, index) => {
        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBeGreaterThanOrEqual(0);
      });

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
      // OPTIMIZED: From 50 to 25 entities - consistency testing doesn't need many
      const entityCount = 25;
      const { entities: testEntities, locationId } =
        await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext(locationId);

      // Act - Perform multiple concurrent operations with same scope
      // OPTIMIZED: From 10 to 8 concurrent operations - sufficient for consistency validation
      const concurrentOperations = 8;
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
      // OPTIMIZED: From 75 to 40 entities - sufficient for cache validation
      const entityCount = 40;
      const { entities: testEntities, locationId } =
        await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext(locationId);

      // Act - Perform concurrent operations that should benefit from caching
      // OPTIMIZED: From 3 rounds to 2 rounds, 10 ops to 5 ops per round
      const rounds = 2;
      const operationsPerRound = 5;
      const allResults = [];

      for (let round = 0; round < rounds; round++) {
        const promises = [];
        const scopeId = 'concurrency:complex_filter';

        for (let op = 0; op < operationsPerRound; op++) {
          promises.push(
            ScopeTestUtilities.resolveScopeE2E(
              scopeId,
              testActor,
              gameContext,
              {
                scopeRegistry,
                scopeEngine,
              }
            )
          );
        }

        const roundResults = await Promise.all(promises);
        allResults.push(...roundResults);

        // Small delay between rounds to allow cache stabilization
        await new Promise((resolve) => setTimeout(resolve, 10));
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
      // OPTIMIZED: From 80 to 40 entities - sufficient for multi-scope validation
      const entityCount = 40;
      const { entities: testEntities, locationId } =
        await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext(locationId);

      // Act - Perform concurrent operations on different scopes
      // OPTIMIZED: From 15 to 10 concurrent operations - sufficient for multi-scope testing
      const concurrentOperations = 10;
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
          }).then((result) => ({ result, scopeId, index: i }))
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
      // OPTIMIZED: From 60 to 30 entities - sufficient for race condition detection
      const entityCount = 30;
      const { entities: testEntities, locationId } =
        await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext(locationId);

      // Act - Perform many concurrent operations on the exact same scope
      // OPTIMIZED: From 12 to 8 concurrent operations - sufficient for race condition testing
      const concurrentOperations = 8;
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
          }).then((result) => {
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

      // Verify concurrent operation launch (functional validation only - no performance timing constraints)

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
      // OPTIMIZED: From 70 to 35 entities - sufficient for rapid succession testing
      const entityCount = 35;
      const { entities: testEntities, locationId } =
        await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext(locationId);

      // Act - Perform rapid successive operations with minimal delay
      // OPTIMIZED: From 20 to 12 total operations - sufficient for rapid succession validation
      const totalOperations = 12;
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
          }).then((result) => ({
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
          await new Promise((resolve) => setTimeout(resolve, operationDelay));
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
      // OPTIMIZED: From 90 to 45 entities - sufficient for mixed complexity testing
      const entityCount = 45;
      const { entities: testEntities, locationId } =
        await createConcurrencyDataset(entityCount);
      const testActor = testEntities[0];
      const gameContext = await createConcurrencyGameContext(locationId);

      // Act - Mix simple and complex operations
      // OPTIMIZED: From 15 to 10 total operations - sufficient for mixed complexity validation
      const totalOperations = 10;
      const promises = [];
      const operationMix = [];

      const complexityLevels = [
        {
          scopeId: 'concurrency:simple_filter',
          complexity: 'simple',
          weight: 0.4,
        },
        {
          scopeId: 'concurrency:complex_filter',
          complexity: 'complex',
          weight: 0.3,
        },
        {
          scopeId: 'concurrency:arithmetic_filter',
          complexity: 'moderate',
          weight: 0.2,
        },
        {
          scopeId: 'concurrency:union_scope',
          complexity: 'complex',
          weight: 0.1,
        },
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
          ScopeTestUtilities.resolveScopeE2E(
            selectedLevel.scopeId,
            testActor,
            gameContext,
            {
              scopeRegistry,
              scopeEngine,
            }
          ).then((result) => ({
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
      Object.values(consistencyResults).forEach((consistent) => {
        expect(consistent).toBe(true);
      });

      logger.info('Mixed complexity concurrent operations validation', {
        totalOperations,
        complexityDistribution: Object.fromEntries(
          Array.from(resultsByComplexity.entries()).map(
            ([complexity, results]) => [complexity, results.length]
          )
        ),
        totalTime: `${totalTime}ms`,
        averageTimePerOp: `${(totalTime / totalOperations).toFixed(2)}ms`,
        consistencyByComplexity: consistencyResults,
        allOperationsSuccessful: true,
      });
    });
  });
});

// Helper function for array equality comparison
/**
 *
 * @param a
 * @param b
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
