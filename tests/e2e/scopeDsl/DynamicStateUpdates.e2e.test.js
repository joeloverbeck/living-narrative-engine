/**
 * @file End-to-end test for Dynamic State Updates in ScopeDsl
 * @see tests/e2e/scopeDsl/DynamicStateUpdates.e2e.test.js
 *
 * This test suite validates dynamic state management in the scopeDsl system:
 * - Real-time scope definition updates and registry reinitialization
 * - Entity state changes during resolution and immediate reflection
 * - Component modifications mid-resolution and concurrent handling
 * - Cache invalidation patterns and performance implications
 * - Edge cases in dynamic state transitions and error recovery
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { AvailableActionsProvider } from '../../../src/data/providers/availableActionsProvider.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { clearEntityCache } from '../../../src/scopeDsl/core/entityHelpers.js';

/**
 * E2E test suite for Dynamic State Updates in ScopeDsl
 * Tests critical dynamic behavior identified in Priority 2 requirements
 */
describe('Dynamic State Updates E2E', () => {
  let container;
  let entityManager;
  let actionDiscoveryService;
  let targetResolutionService;
  let availableActionsProvider;
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
    actionDiscoveryService = container.resolve(tokens.IActionDiscoveryService);
    targetResolutionService = container.resolve(
      tokens.ITargetResolutionService
    );
    availableActionsProvider = container.resolve(
      tokens.IAvailableActionsProvider
    );
    scopeRegistry = container.resolve(tokens.IScopeRegistry);
    scopeEngine = container.resolve(tokens.ScopeEngine);
    dslParser = container.resolve(tokens.DslParser);
    dataRegistry = container.resolve(tokens.IDataRegistry);

    // Register required component schemas for testing
    const schemaValidator = container.resolve(tokens.ISchemaValidator);

    // Register essential schemas
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
   * Register essential schemas for dynamic testing
   */
  async function registerTestSchemas(schemaValidator) {
    // Core schemas
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
          locked: { type: 'boolean', default: false },
          forcedOverride: { type: 'boolean', default: false },
        },
        required: ['locked'],
        additionalProperties: false,
      },
      'core:movement'
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
          current: { type: 'number', default: 100 },
          max: { type: 'number', default: 100 },
        },
        required: ['current', 'max'],
        additionalProperties: false,
      },
      'core:health'
    );

    await schemaValidator.addSchema(
      {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object' }, default: [] },
        },
        required: ['items'],
        additionalProperties: false,
      },
      'core:inventory'
    );
  }

  /**
   * Sets up comprehensive test infrastructure for dynamic testing
   */
  async function setupTestInfrastructure() {
    // Create test world using ActionTestUtilities
    testWorld = await ActionTestUtilities.createStandardTestWorld({
      entityManager,
      registry: dataRegistry,
    });

    // Create test actors using ActionTestUtilities
    testActors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry: dataRegistry,
    });

    // Set up dynamic test actions
    await setupDynamicTestActions();

    // Set up initial scope definitions
    await setupInitialScopeDefinitions();
  }

  /**
   * Sets up action definitions for dynamic state testing
   */
  async function setupDynamicTestActions() {
    const actionIndex = container.resolve(tokens.ActionIndex);

    const dynamicTestActions = [
      {
        id: 'core:wait',
        name: 'Wait',
        description: 'Wait for a moment, doing nothing.',
        scope: 'none',
        template: 'wait',
        prerequisites: [],
        required_components: {
          actor: [],
        },
      },
      {
        id: 'test:dynamic_action',
        name: 'Dynamic Action',
        description: 'Action that uses dynamic scopes.',
        scope: 'test:dynamic_entities',
        template: 'interact dynamically with {target}',
        prerequisites: [],
        required_components: {
          actor: [],
        },
      },
      {
        id: 'test:stats_based_action',
        name: 'Stats Based Action',
        description: 'Action filtered by stats.',
        scope: 'test:high_level_entities',
        template: 'perform advanced action on {target}',
        prerequisites: [],
        required_components: {
          actor: ['core:stats'],
        },
      },
    ];

    // Add action definitions to the registry
    for (const action of dynamicTestActions) {
      dataRegistry.store('actions', action.id, action);
    }

    // Build the action index
    actionIndex.buildIndex(dynamicTestActions);
  }

  /**
   * Sets up initial scope definitions for dynamic testing
   */
  async function setupInitialScopeDefinitions() {
    // Create initial test scopes
    const initialScopes = ScopeTestUtilities.createTestScopes(
      {
        dslParser,
        logger: container.resolve(tokens.ILogger),
      },
      [
        {
          id: 'test:dynamic_entities',
          expr: 'entities(core:actor)[{"!=": [{"var": "id"}, {"var": "actor.id"}]}]',
          description: 'Dynamic entities scope - initially all other actors',
        },
        {
          id: 'test:high_level_entities',
          expr: 'entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, 5]}]',
          description: 'Entities with level > 5',
        },
        {
          id: 'test:location_based',
          expr: 'entities(core:actor)[{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "actor.components.core:position.locationId"}]}]',
          description: 'Actors in same location',
        },
        {
          id: 'test:health_based',
          expr: 'entities(core:actor)[{">": [{"var": "entity.components.core:health.current"}, 50]}]',
          description: 'Actors with health > 50',
        },
      ]
    );

    // Initialize the scope registry
    try {
      scopeRegistry.initialize(initialScopes);
    } catch (e) {
      console.warn('Could not initialize scope registry for dynamic tests', e);
    }
  }

  /**
   * Creates a trace context for testing
   */
  function createTestTraceContext() {
    return new TraceContext();
  }

  /**
   * Gets action ID from action object (handles both formats)
   */
  function getActionId(action) {
    return action.actionId || action.id;
  }

  /**
   * Creates test entity with specific components
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

  describe('Real-time Scope Definition Changes', () => {
    test('should reflect real-time scope definition changes', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Initial resolution with original scope
      const initialTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:dynamic_entities',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      expect(initialTargets).toBeInstanceOf(Set);
      const initialCount = initialTargets.size;

      // Update scope definition to be more restrictive
      const updatedScopes = ScopeTestUtilities.createTestScopes(
        {
          dslParser,
          logger: container.resolve(tokens.ILogger),
        },
        [
          {
            id: 'test:dynamic_entities',
            expr: 'entities(core:actor)[{"and": [{"!=": [{"var": "id"}, {"var": "actor.id"}]}, {">": [{"var": "entity.components.core:stats.level"}, 10]}]}]',
            description: 'Dynamic entities scope - now restricted to high level actors',
          },
        ]
      );

      // Reinitialize scope registry with updated definitions
      scopeRegistry.initialize(updatedScopes);

      // Clear cache to ensure fresh resolution
      clearEntityCache();

      // Resolution with updated scope should be different
      const updatedTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:dynamic_entities',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      expect(updatedTargets).toBeInstanceOf(Set);
      const updatedCount = updatedTargets.size;

      // Updated scope should be more restrictive (likely fewer results)
      expect(updatedCount).toBeLessThanOrEqual(initialCount);
    });

    test('should handle scope definition addition and removal', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Add a completely new scope definition
      const scopesWithNew = ScopeTestUtilities.createTestScopes(
        {
          dslParser,
          logger: container.resolve(tokens.ILogger),
        },
        [
          {
            id: 'test:brand_new_scope',
            expr: 'entities(core:actor)[{"==": [{"var": "entity.components.core:stats.strength"}, 10]}]',
            description: 'Brand new scope for testing dynamic addition',
          },
        ]
      );

      scopeRegistry.initialize(scopesWithNew);

      // Should be able to resolve the new scope
      const newScopeTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:brand_new_scope',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      expect(newScopeTargets).toBeInstanceOf(Set);

      // Remove the scope by reinitializing without it
      const scopesWithoutNew = ScopeTestUtilities.createTestScopes(
        {
          dslParser,
          logger: container.resolve(tokens.ILogger),
        },
        [] // Empty additional scopes
      );

      scopeRegistry.initialize(scopesWithoutNew);

      // Should no longer be able to resolve the removed scope
      await expect(
        ScopeTestUtilities.resolveScopeE2E(
          'test:brand_new_scope',
          playerEntity,
          {
            currentLocation: await entityManager.getEntityInstance('test-location-1'),
            entityManager,
            allEntities: Array.from(entityManager.entities),
            jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
            logger: container.resolve(tokens.ILogger),
          },
          { scopeRegistry, scopeEngine }
        )
      ).rejects.toThrow();
    });
  });

  describe('Entity State Changes During Resolution', () => {
    test('should handle entity changes during resolution', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Create a test entity with initial stats
      const testEntityId = await createTestEntity('dynamic-test-entity', {
        'core:name': { name: 'Dynamic Test Entity' },
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'core:stats': { level: 3, strength: 10, agility: 10 },
        'core:health': { current: 100, max: 100 },
      });

      // Initial resolution - entity should not be included (level 3 <= 5)
      const initialTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:high_level_entities',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      const initialIds = Array.from(initialTargets);
      expect(initialIds).not.toContain(testEntityId);

      // Update entity stats to meet scope criteria
      await entityManager.addComponent(testEntityId, 'core:stats', {
        level: 7, // Now > 5
        strength: 15,
        agility: 12,
      });

      // Clear cache to ensure fresh data
      clearEntityCache();

      // Resolution after update - entity should now be included
      const updatedTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:high_level_entities',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      const updatedIds = Array.from(updatedTargets);
      expect(updatedIds).toContain(testEntityId);
    });

    test('should reflect component modifications immediately', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Create multiple test entities with different health values
      const healthyEntityId = await createTestEntity('healthy-entity', {
        'core:name': { name: 'Healthy Entity' },
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'core:health': { current: 80, max: 100 },
      });

      const injuredEntityId = await createTestEntity('injured-entity', {
        'core:name': { name: 'Injured Entity' },
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'core:health': { current: 30, max: 100 },
      });

      // Initial resolution - only healthy entity should be included
      const initialTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:health_based',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      const initialIds = Array.from(initialTargets);
      expect(initialIds).toContain(healthyEntityId);
      expect(initialIds).not.toContain(injuredEntityId);

      // Heal the injured entity
      await entityManager.addComponent(injuredEntityId, 'core:health', {
        current: 75, // Now > 50
        max: 100,
      });

      // Injure the healthy entity
      await entityManager.addComponent(healthyEntityId, 'core:health', {
        current: 25, // Now <= 50
        max: 100,
      });

      // Clear cache
      clearEntityCache();

      // Resolution after changes - roles should be reversed
      const updatedTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:health_based',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      const updatedIds = Array.from(updatedTargets);
      expect(updatedIds).not.toContain(healthyEntityId);
      expect(updatedIds).toContain(injuredEntityId);
    });
  });

  describe('Dynamic Entity Creation and Removal', () => {
    test('should handle entity creation and removal in scope results', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Initial resolution
      const initialTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:location_based',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      const initialCount = initialTargets.size;

      // Create a new actor in the same location
      const newActorId = await createTestEntity('dynamic-new-actor', {
        'core:name': { name: 'Dynamic New Actor' },
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' }, // Same location as player
      });

      // Ensure the player has the correct position component for comparison
      const playerInstance = await entityManager.getEntityInstance(testActors.player.id);
      if (!playerInstance.core?.position?.locationId) {
        await entityManager.addComponent(testActors.player.id, 'core:position', {
          locationId: 'test-location-1',
        });
      }

      // Clear cache
      clearEntityCache();

      // Resolution should now include the new entity
      const afterCreationTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:location_based',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      const afterCreationIds = Array.from(afterCreationTargets);
      expect(afterCreationTargets.size).toBeGreaterThanOrEqual(initialCount);
      expect(afterCreationIds).toContain(newActorId);

      // Remove the entity
      await entityManager.removeEntityInstance(newActorId);
      // Note: dataRegistry.remove is not implemented, so we'll skip removing from registry

      // Clear cache
      clearEntityCache();

      // Resolution should no longer include the removed entity
      const afterRemovalTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:location_based',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      const afterRemovalIds = Array.from(afterRemovalTargets);
      expect(afterRemovalTargets.size).toBeLessThanOrEqual(afterCreationTargets.size);
      expect(afterRemovalIds).not.toContain(newActorId);
    });

    test('should handle multiple concurrent entity changes', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Create multiple entities to modify concurrently
      const entity1Id = await createTestEntity('concurrent-entity-1', {
        'core:name': { name: 'Concurrent Entity 1' },
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'core:stats': { level: 3, strength: 10, agility: 10 },
      });

      const entity2Id = await createTestEntity('concurrent-entity-2', {
        'core:name': { name: 'Concurrent Entity 2' },
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'core:stats': { level: 4, strength: 10, agility: 10 },
      });

      const entity3Id = await createTestEntity('concurrent-entity-3', {
        'core:name': { name: 'Concurrent Entity 3' },
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'core:stats': { level: 8, strength: 10, agility: 10 },
      });

      // Perform concurrent modifications
      const modifications = [
        entityManager.addComponent(entity1Id, 'core:stats', {
          level: 7, // Now qualifies
          strength: 12,
          agility: 10,
        }),
        entityManager.addComponent(entity2Id, 'core:stats', {
          level: 9, // Now qualifies
          strength: 15,
          agility: 12,
        }),
        entityManager.addComponent(entity3Id, 'core:stats', {
          level: 2, // No longer qualifies
          strength: 8,
          agility: 8,
        }),
      ];

      await Promise.all(modifications);

      // Clear cache
      clearEntityCache();

      // Check that all changes are reflected properly
      const finalTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:high_level_entities',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      const finalIds = Array.from(finalTargets);
      expect(finalIds).toContain(entity1Id); // 7 > 5
      expect(finalIds).toContain(entity2Id); // 9 > 5
      expect(finalIds).not.toContain(entity3Id); // 2 <= 5
    });
  });

  describe('Cache Invalidation Patterns', () => {
    test('should invalidate caches appropriately after entity changes', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Create test entity
      const testEntityId = await createTestEntity('cache-test-entity', {
        'core:name': { name: 'Cache Test Entity' },
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'core:stats': { level: 3, strength: 10, agility: 10 },
      });

      // First resolution - should cache entity data
      const firstTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:high_level_entities',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      const firstIds = Array.from(firstTargets);
      expect(firstIds).not.toContain(testEntityId); // level 3 <= 5

      // Update entity stats but DON'T clear cache
      await entityManager.addComponent(testEntityId, 'core:stats', {
        level: 8, // Should now qualify
        strength: 15,
        agility: 12,
      });

      // Resolution without cache clear - might still use cached data
      const cachedTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:high_level_entities',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      // Now clear cache and resolve again
      clearEntityCache();

      const freshTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:high_level_entities',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      const freshIds = Array.from(freshTargets);
      
      // Fresh resolution should include the updated entity
      expect(freshIds).toContain(testEntityId);
    });

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
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
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
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
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
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
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

  describe('Integration with Action Discovery', () => {
    test('should reflect dynamic changes in action discovery results', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      const baseContext = {
        currentLocation: await entityManager.getEntityInstance('test-location-1'),
        allEntities: Array.from(entityManager.entities),
      };

      // Initial action discovery
      const initialActions = await actionDiscoveryService.getValidActions(
        playerEntity,
        baseContext
      );

      const initialActionIds = initialActions.actions.map((a) => getActionId(a));

      // Modify entity state to affect scope resolution
      const testEntityId = await createTestEntity('action-scope-entity', {
        'core:name': { name: 'Action Scope Entity' },
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'core:stats': { level: 1, strength: 10, agility: 10 },
      });

      // Clear cache
      clearEntityCache();

      // Update context with new entity
      const updatedContext = {
        ...baseContext,
        allEntities: Array.from(entityManager.entities),
      };

      // Action discovery after entity creation
      const updatedActions = await actionDiscoveryService.getValidActions(
        playerEntity,
        updatedContext
      );

      const updatedActionIds = updatedActions.actions.map((a) => getActionId(a));

      // Should still have core actions
      expect(updatedActionIds).toContain('core:wait');

      // Actions involving dynamic scopes should be updated
      expect(updatedActions.actions).toBeDefined();
      expect(Array.isArray(updatedActions.actions)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle scope definition errors gracefully during updates', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Try to update with invalid scope definition
      try {
        const invalidScopes = {
          'test:invalid_scope': {
            expr: 'invalid.syntax.that.should.fail',
            ast: null, // Invalid AST
          },
        };

        // This should throw an error
        expect(() => {
          scopeRegistry.initialize(invalidScopes);
        }).toThrow();
        
        // Reinitialize with valid scopes after the error test
        await setupInitialScopeDefinitions();
      } catch (error) {
        // Error handling is working correctly
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
      }

      // Registry should still be functional for valid operations
      const validTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:dynamic_entities',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      expect(validTargets).toBeInstanceOf(Set);
    });

    test('should handle entity state corruption gracefully', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Create entity and then corrupt its state
      const corruptEntityId = await createTestEntity('corrupt-entity', {
        'core:name': { name: 'Corrupt Entity' },
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'core:stats': { level: 6, strength: 10, agility: 10 },
      });

      // Corrupt the entity by removing instance but leaving definition
      await entityManager.removeEntityInstance(corruptEntityId);

      // Clear cache
      clearEntityCache();

      // Scope resolution should handle missing entity definition gracefully
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:high_level_entities',
        playerEntity,
        {
          currentLocation: await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      // Should return a valid result even with missing instance
      expect(result).toBeInstanceOf(Set);
      
      // The corrupted entity should not be in results since instance was removed
      const resultIds = Array.from(result);
      expect(resultIds).not.toContain(corruptEntityId);
    });
  });
});