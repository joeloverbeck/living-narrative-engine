/**
 * @file Performance benchmarks for Dynamic State Updates in ScopeDsl
 * @description Tests focused on measuring cache performance and invalidation impact
 * during dynamic state changes in the scopeDsl system
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { clearEntityCache } from '../../../src/scopeDsl/core/entityHelpers.js';

describe('Dynamic State Updates Performance', () => {
  let container;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let dataRegistry;
  let testActors;
  let testWorld;

  beforeEach(async () => {
    // Create real container and configure it
    container = new AppContainer();
    await configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Get real services from container
    entityManager = container.resolve(tokens.IEntityManager);
    scopeRegistry = container.resolve(tokens.IScopeRegistry);
    scopeEngine = container.resolve(tokens.ScopeEngine);
    dslParser = container.resolve(tokens.DslParser);
    dataRegistry = container.resolve(tokens.IDataRegistry);

    // Register required component schemas for testing
    const schemaValidator = container.resolve(tokens.ISchemaValidator);
    await registerTestSchemas(schemaValidator);

    // Set up test infrastructure
    await setupTestInfrastructure();
  });

  afterEach(async () => {
    // Clean up caches and state
    clearEntityCache();

    if (container) {
      // Additional cleanup if needed
    }
  });

  /**
   * Register essential schemas for performance testing
   *
   * @param schemaValidator
   */
  async function registerTestSchemas(schemaValidator) {
    await schemaValidator.addSchema(
      {
        type: 'object',
        properties: {
          locationId: { type: 'string' },
        },
        required: ['locationId'],
        additionalProperties: false,
      },
      'core:position'
    );

    await schemaValidator.addSchema(
      {
        type: 'object',
        properties: {
          level: { type: 'number', default: 1 },
          strength: { type: 'number', default: 10 },
          agility: { type: 'number', default: 10 },
        },
        required: ['level', 'strength', 'agility'],
        additionalProperties: false,
      },
      'core:stats'
    );

    await schemaValidator.addSchema(
      {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      },
      'core:name'
    );

    await schemaValidator.addSchema(
      {
        type: 'object',
        properties: {
          isPlayer: { type: 'boolean' },
        },
        required: ['isPlayer'],
        additionalProperties: false,
      },
      'core:actor'
    );
  }

  /**
   * Sets up test infrastructure for performance testing
   */
  async function setupTestInfrastructure() {
    // Create test world
    testWorld = await ActionTestUtilities.createStandardTestWorld({
      entityManager,
      registry: dataRegistry,
    });

    // Create test actors
    testActors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry: dataRegistry,
    });

    // Set up initial scope definitions
    await setupInitialScopeDefinitions();
  }

  /**
   * Sets up initial scope definitions for performance testing
   */
  async function setupInitialScopeDefinitions() {
    const initialScopes = ScopeTestUtilities.createTestScopes(
      {
        dslParser,
        logger: container.resolve(tokens.ILogger),
      },
      [
        {
          id: 'test:high_level_entities',
          expr: 'entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, 5]}]',
          description: 'Entities with level > 5',
        },
      ]
    );

    try {
      scopeRegistry.initialize(initialScopes);
    } catch (e) {
      console.warn(
        'Could not initialize scope registry for performance tests',
        e
      );
    }
  }

  /**
   * Creates test entity with specific components
   *
   * @param entityId
   * @param components
   */
  async function createTestEntity(entityId, components) {
    const entityDefinition = createEntityDefinition(entityId, components);
    dataRegistry.store('entityDefinitions', entityId, entityDefinition);

    await entityManager.createEntityInstance(entityId, {
      instanceId: entityId,
      definitionId: entityId,
    });

    return entityId;
  }

  describe('Cache Performance and Invalidation', () => {
    test('should demonstrate caching performance benefits and invalidation impact', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Create multiple entities for more realistic performance testing
      for (let i = 0; i < 10; i++) {
        await createTestEntity(`perf-entity-${i}`, {
          'core:name': { name: `Performance Entity ${i}` },
          'core:actor': { isPlayer: false },
          'core:position': { locationId: 'test-location-1' },
          'core:stats': { level: i + 1, strength: 10 + i, agility: 10 },
        });
      }

      // Measure first resolution (cache population)
      const startTime1 = Date.now();
      const firstResult = await ScopeTestUtilities.resolveScopeE2E(
        'test:high_level_entities',
        playerEntity,
        {
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );
      const firstTime = Date.now() - startTime1;

      // Measure second resolution (cached)
      const startTime2 = Date.now();
      const cachedResult = await ScopeTestUtilities.resolveScopeE2E(
        'test:high_level_entities',
        playerEntity,
        {
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );
      const cachedTime = Date.now() - startTime2;

      // Results should be identical
      expect(cachedResult.size).toBe(firstResult.size);

      // Clear cache and measure fresh resolution
      clearEntityCache();

      const startTime3 = Date.now();
      const freshResult = await ScopeTestUtilities.resolveScopeE2E(
        'test:high_level_entities',
        playerEntity,
        {
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );
      const freshTime = Date.now() - startTime3;

      // Fresh result should still be consistent
      expect(freshResult.size).toBe(firstResult.size);

      // All operations should complete within reasonable time
      expect(firstTime).toBeLessThan(1000);
      expect(cachedTime).toBeLessThan(1000);
      expect(freshTime).toBeLessThan(1000);

      // Cached resolution should be reasonably fast (allow some variance)
      expect(cachedTime).toBeLessThanOrEqual(firstTime + 50);
    });
  });
});
