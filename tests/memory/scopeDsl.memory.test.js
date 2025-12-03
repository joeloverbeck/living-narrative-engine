/**
 * @file Memory tests for ScopeDSL operations
 * @description Tests memory usage and cleanup for ScopeDSL resolution operations
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../src/dependencyInjection/containerConfig.js';
import { ScopeTestUtilities } from '../common/scopeDsl/scopeTestUtilities.js';
import EntityDefinition from '../../src/entities/entityDefinition.js';

describe('ScopeDSL - Memory Tests', () => {
  // Extended timeout for memory stabilization
  jest.setTimeout(120000); // 2 minutes

  let container;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let logger;
  let jsonLogicService;
  let spatialIndexManager;
  let registry;

  // Reuse DOM + container across tests to avoid repeated heavyweight bootstraps
  let outputDiv;
  let inputElement;
  let titleElement;

  beforeAll(async () => {
    await global.memoryTestUtils.forceGCAndWait();

    container = new AppContainer();

    outputDiv = document.createElement('div');
    outputDiv.id = 'outputDiv';
    const messageList = document.createElement('ul');
    messageList.id = 'message-list';
    outputDiv.appendChild(messageList);

    inputElement = document.createElement('input');
    inputElement.id = 'inputBox';

    titleElement = document.createElement('h1');
    titleElement.id = 'gameTitle';

    document.body.appendChild(outputDiv);
    document.body.appendChild(inputElement);
    document.body.appendChild(titleElement);

    try {
      await configureContainer(container, {
        outputDiv,
        inputElement,
        titleElement,
        document,
      });

      entityManager = container.resolve(tokens.IEntityManager);
      scopeRegistry = container.resolve(tokens.IScopeRegistry);
      scopeEngine = container.resolve(tokens.IScopeEngine);
      dslParser = container.resolve(tokens.DslParser);
      logger = container.resolve(tokens.ILogger);
      jsonLogicService = container.resolve(tokens.JsonLogicEvaluationService);
      spatialIndexManager = container.resolve(tokens.ISpatialIndexManager);
      registry = container.resolve(tokens.IDataRegistry);

      if (!entityManager || !scopeRegistry || !scopeEngine || !dslParser) {
        throw new Error(
          'Critical services not available after container configuration'
        );
      }

      await global.memoryTestUtils.forceGCAndWait();
    } catch (error) {
      console.error('Memory test beforeAll failed:', error);

      if (container && typeof container.cleanup === 'function') {
        container.cleanup();
      }

      throw new Error(`Memory test setup failed: ${error.message}`);
    }
  });

  beforeEach(async () => {
    // Reset state between tests without tearing everything down
    if (entityManager?.clearAll) {
      entityManager.clearAll();
    }
    if (spatialIndexManager?.clear) {
      spatialIndexManager.clear();
    }
    if (registry?.clear) {
      registry.clear();
    }
    if (scopeRegistry?.initialize) {
      scopeRegistry.initialize({});
    }
  });

  afterAll(async () => {
    if (container && typeof container.cleanup === 'function') {
      container.cleanup();
    }

    document.body.innerHTML = '';

    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('Memory Management', () => {
    test('should clean up resources properly after resolution', async () => {
      // Arrange - Create large dataset
      const testEntities = await createLargeEntityDataset(1000);

      const testScopes = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:memory_test_scope',
            expr: 'entities(core:actor)',
            description: 'Simple scope for memory testing',
          },
        ]
      );

      scopeRegistry.initialize(testScopes);

      const testActor = testEntities.actors[0];

      // Force garbage collection before test
      await global.memoryTestUtils.forceGCAndWait();

      const initialMemory = process.memoryUsage().heapUsed;

      // Act - Perform multiple resolutions
      const iterations = 50;
      const gameContext = await createGameContext(testEntities.location.id);

      for (let i = 0; i < iterations; i++) {
        await ScopeTestUtilities.resolveScopeE2E(
          'test:memory_test_scope',
          testActor,
          gameContext,
          { scopeRegistry, scopeEngine }
        );
      }

      // Force garbage collection after resolutions
      await global.memoryTestUtils.forceGCAndWait();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;

      // Assert - Memory growth should be minimal
      // Adjusted threshold for current system complexity
      const memoryThreshold = global.memoryTestUtils.isCI() ? 40 : 30; // More lenient in CI
      expect(memoryGrowth).toBeLessThan(memoryThreshold);

      logger.info('Memory management test', {
        iterations,
        memoryGrowth: `${memoryGrowth.toFixed(2)}MB`,
        avgGrowthPerIteration: `${(memoryGrowth / iterations).toFixed(3)}MB`,
        threshold: `${memoryThreshold}MB`,
        environment: global.memoryTestUtils.isCI() ? 'CI' : 'local',
      });
    });

    test('should maintain reasonable memory usage with 1000+ entities', async () => {
      // Arrange - Create large entity dataset
      const entityCount = 1000;
      const testEntities = await createLargeEntityDataset(entityCount);

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

      scopeRegistry.initialize(testScopes);

      const testActor = testEntities.actors[0];
      const gameContext = await createGameContext(testEntities.location.id);

      // Force GC before measurement
      await global.memoryTestUtils.forceGCAndWait();
      const startMemory = process.memoryUsage().heapUsed;

      // Act - Measure memory usage during resolution
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:high_level_actors',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = (endMemory - startMemory) / 1024 / 1024; // Convert to MB

      // Assert - Verify memory usage is reasonable
      // Adjusted threshold for current system complexity
      const memoryThreshold = global.memoryTestUtils.isCI() ? 80 : 60;
      expect(memoryUsed).toBeLessThan(memoryThreshold);
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBeGreaterThan(0);

      logger.info('Large dataset memory usage', {
        entityCount,
        memoryUsed: `${memoryUsed.toFixed(2)}MB`,
        resultCount: result.size,
        threshold: `${memoryThreshold}MB`,
        environment: global.memoryTestUtils.isCI() ? 'CI' : 'local',
      });
    });

    test('should handle 10000+ entities without excessive memory usage', async () => {
      // Arrange - Create very large entity dataset
      const entityCount = 10000;
      const testEntities = await createLargeEntityDataset(entityCount);

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

      // Force GC before measurement
      await global.memoryTestUtils.forceGCAndWait();
      const startMemory = process.memoryUsage().heapUsed;

      // Act - Measure memory usage with very large dataset
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:complex_filter',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = (endMemory - startMemory) / 1024 / 1024;

      // Assert - Verify memory usage scales reasonably
      // Adjusted threshold for current system complexity (10x data scale)
      const memoryThreshold = global.memoryTestUtils.isCI() ? 350 : 250;
      expect(memoryUsed).toBeLessThan(memoryThreshold);
      expect(result).toBeInstanceOf(Set);

      logger.info('Very large dataset memory usage', {
        entityCount,
        memoryUsed: `${memoryUsed.toFixed(2)}MB`,
        resultCount: result.size,
        threshold: `${memoryThreshold}MB`,
        environment: global.memoryTestUtils.isCI() ? 'CI' : 'local',
      });
    });

    test('should not leak memory during concurrent resolutions', async () => {
      // Arrange - Create test data
      const testEntities = await createLargeEntityDataset(500);

      const testScopes = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:concurrent_scope',
            expr: 'entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, 5]}]',
            description: 'Concurrent memory test scope',
          },
        ]
      );

      scopeRegistry.initialize(testScopes);

      const actors = testEntities.actors.slice(0, 10);
      const concurrentCount = 10;
      const gameContext = await createGameContext(testEntities.location.id);

      // Force GC before measurement
      await global.memoryTestUtils.forceGCAndWait();
      const startMemory = process.memoryUsage().heapUsed;

      // Act - Execute concurrent resolutions
      const resolutionPromises = [];
      for (let i = 0; i < concurrentCount; i++) {
        const actor = actors[i % actors.length];

        resolutionPromises.push(
          ScopeTestUtilities.resolveScopeE2E(
            'test:concurrent_scope',
            actor,
            gameContext,
            {
              scopeRegistry,
              scopeEngine,
            }
          )
        );
      }

      await Promise.all(resolutionPromises);

      // Force GC after resolutions
      await global.memoryTestUtils.forceGCAndWait();

      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = (endMemory - startMemory) / 1024 / 1024;

      // Assert - Memory usage should be reasonable for concurrent operations
      // Adjusted threshold for current system complexity (concurrent operations)
      const memoryThreshold = global.memoryTestUtils.isCI() ? 150 : 120;
      expect(memoryUsed).toBeLessThan(memoryThreshold);

      logger.info('Concurrent resolution memory usage', {
        concurrentCount,
        memoryUsed: `${memoryUsed.toFixed(2)}MB`,
        threshold: `${memoryThreshold}MB`,
        environment: global.memoryTestUtils.isCI() ? 'CI' : 'local',
      });
    });
  });

  // Helper functions

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

  /**
   * Creates a large dataset of entities for memory testing
   * Aligned with ScopeTestUtilities.createMockEntityDataset patterns
   *
   * @param {number} count - Number of entities to create
   * @returns {Promise<object>} Object containing actors, items, and location
   */
  async function createLargeEntityDataset(count) {
    const actors = [];
    const items = [];

    // Create test location using ScopeTestUtilities pattern
    const locationId = 'test-memory-location';
    const locationComponents = {
      'core:location': {
        name: 'Memory Test Arena',
        exits: [],
      },
    };

    // Use ScopeTestUtilities pattern for entity creation
    const locationDefinition = new EntityDefinition(locationId, {
      id: locationId,
      description: 'Test location for memory testing',
      components: locationComponents,
    });

    // Register location entity definition
    registry.store('entityDefinitions', locationId, locationDefinition);

    // Create location instance
    await entityManager.createEntityInstance(locationId, {
      instanceId: locationId,
      definitionId: locationId,
    });

    const entitySpecs = [];

    // Create actors with deterministic stats to avoid RNG overhead
    for (let i = 0; i < count; i++) {
      const actorId = `test-memory-actor-${i}`;
      const level = (i % 20) + 1;
      const strength = ((i * 7) % 30) + 5; // simple, deterministic spread
      const health = ((i * 11) % 100) + 1;
      const actorComponents = {
        'core:actor': {
          name: `Memory Test Actor ${i}`,
          isPlayer: i === 0,
        },
        'core:stats': {
          level,
          strength,
        },
        'core:health': {
          current: health,
          max: 100,
        },
        'core:location': { locationId: locationId },
      };

      const actorDefinition = new EntityDefinition(actorId, {
        id: actorId,
        description: `Test actor ${i} for memory testing`,
        components: actorComponents,
      });

      registry.store('entityDefinitions', actorId, actorDefinition);
      entitySpecs.push({ definitionId: actorId, instanceId: actorId });
      actors.push({ id: actorId });
    }

    // Create some items (10% of actor count)
    const itemCount = Math.floor(count / 10);
    for (let i = 0; i < itemCount; i++) {
      const itemId = `test-memory-item-${i}`;
      const itemComponents = {
        'core:item': {
          name: `Memory Test Item ${i}`,
        },
        'core:value': ((i + 3) * 13) % 500,
      };

      const itemDefinition = new EntityDefinition(itemId, {
        id: itemId,
        description: `Test item ${i} for memory testing`,
        components: itemComponents,
      });

      registry.store('entityDefinitions', itemId, itemDefinition);
      entitySpecs.push({ definitionId: itemId, instanceId: itemId });
      items.push({ id: itemId });
    }

    // Create entity instances in batches when supported to cut setup time
    if (entityManager?.hasBatchSupport?.()) {
      await entityManager.batchCreateEntities(
        entitySpecs.map((spec) => ({
          definitionId: spec.definitionId,
          opts: { instanceId: spec.instanceId },
        })),
        {
          batchSize: 250,
          enableParallel: false,
          stopOnError: true,
        }
      );
    } else {
      for (const spec of entitySpecs) {
        await entityManager.createEntityInstance(spec.definitionId, {
          instanceId: spec.instanceId,
        });
      }
    }

    return { actors, items, location: { id: locationId } };
  }
});
