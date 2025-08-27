/**
 * Debug script to identify issues with createPerformanceDataset function
 */

import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { ScopeTestUtilities } from '../common/scopeDsl/scopeTestUtilities.js';
import {
  createPerformanceContainer,
  resetContainerState,
  prewarmContainer,
  forceCleanup,
} from '../common/performanceContainerFactory.js';
import EntityDefinition from '../../src/entities/entityDefinition.js';

describe('Debug Performance Dataset', () => {
  let sharedContainer;
  let sharedCleanup;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let logger;
  let jsonLogicService;
  let spatialIndexManager;
  let registry;

  beforeAll(async () => {
    const containerSetup = await createPerformanceContainer({
      includeUI: false,
    });
    sharedContainer = containerSetup.container;
    sharedCleanup = containerSetup.cleanup;

    await prewarmContainer(sharedContainer);

    entityManager = sharedContainer.resolve(tokens.IEntityManager);
    scopeRegistry = sharedContainer.resolve(tokens.IScopeRegistry);
    scopeEngine = sharedContainer.resolve(tokens.IScopeEngine);
    dslParser = sharedContainer.resolve(tokens.DslParser);
    logger = sharedContainer.resolve(tokens.ILogger);
    jsonLogicService = sharedContainer.resolve(
      tokens.JsonLogicEvaluationService
    );
    spatialIndexManager = sharedContainer.resolve(tokens.ISpatialIndexManager);
    registry = sharedContainer.resolve(tokens.IDataRegistry);
  });

  // Replicate the exact createPerformanceActor function from the performance test
  /**
   *
   * @param actorId
   * @param config
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

  // Replicate the exact createPerformanceDataset function from the performance test
  /**
   *
   * @param size
   */
  async function createPerformanceDataset(size) {
    const entities = [];

    // Create test location
    const locationDefinition = new EntityDefinition(
      'perf-concurrency-location',
      {
        description: 'Performance test location',
        components: {
          'core:position': { x: 0, y: 0 },
        },
      }
    );
    registry.store(
      'entityDefinitions',
      'perf-concurrency-location',
      locationDefinition
    );
    await entityManager.createEntityInstance('perf-concurrency-location', {
      instanceId: 'perf-concurrency-location',
      definitionId: 'perf-concurrency-location',
    });

    // Batch create actors for better performance
    const createPromises = [];
    for (let i = 0; i < size; i++) {
      const actorId = `perf-concurrency-actor-${i}`;
      createPromises.push(
        createPerformanceActor(actorId, {
          isPlayer: i === 0,
        })
      );
    }

    // Create all actors in parallel
    const createdEntities = await Promise.all(createPromises);
    entities.push(...createdEntities);

    return entities;
  }

  // Replicate the exact createPerformanceGameContext function from the performance test
  /**
   *
   */
  async function createPerformanceGameContext() {
    return {
      currentLocation: await entityManager.getEntityInstance(
        'perf-concurrency-location'
      ),
      entityManager: entityManager,
      allEntities: Array.from(entityManager.entities || []),
      jsonLogicEval: jsonLogicService,
      logger: logger,
      spatialIndexManager: spatialIndexManager,
    };
  }

  test('should debug performance dataset creation and scope resolution', async () => {
    await resetContainerState(sharedContainer);

    // Setup test conditions
    console.log('Setting up test conditions...');
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
                {
                  '>=': [{ var: 'entity.components.core:stats.strength' }, 10],
                },
                {
                  '>=': [{ var: 'entity.components.core:health.current' }, 30],
                },
              ],
            },
          ],
        },
      },
    ]);

    // Create test scopes
    console.log('Creating test scopes...');
    const performanceScopes = ScopeTestUtilities.createTestScopes(
      { dslParser, logger },
      [
        {
          id: 'perf-concurrency:moderate_filter',
          expr: 'entities(core:actor)[{"condition_ref": "perf-concurrency:moderate-condition"}]',
          description: 'Moderate filter for scaling testing',
        },
      ]
    );

    // Initialize scope registry
    console.log('Initializing scope registry...');
    scopeRegistry.initialize(performanceScopes);

    // Create performance dataset (like the performance test does)
    console.log('Creating performance dataset with 10 entities...');
    const testEntities = await createPerformanceDataset(10);
    console.log(`Created ${testEntities.length} entities`);
    console.log('First entity:', testEntities[0] ? 'success' : 'failed');

    const testActor = testEntities[0];
    const gameContext = await createPerformanceGameContext();

    console.log(
      'Game context location:',
      gameContext.currentLocation ? 'found' : 'not found'
    );
    console.log('Game context entities count:', gameContext.allEntities.length);

    // Try scope resolution
    console.log('Attempting scope resolution...');
    try {
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'perf-concurrency:moderate_filter',
        testActor,
        gameContext,
        {
          scopeRegistry,
          scopeEngine,
        }
      );
      console.log('Scope resolution success! Result:', result);
      expect(result).toBeDefined();
    } catch (error) {
      console.error('Scope resolution error:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    }
  });

  afterAll(() => {
    if (sharedCleanup) {
      sharedCleanup();
    }
    forceCleanup();
  });
});
