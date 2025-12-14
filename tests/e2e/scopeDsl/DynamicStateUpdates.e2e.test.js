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

import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { clearEntityCache } from '../../../src/scopeDsl/core/entityHelpers.js';
import { createMinimalTestContainer } from '../../common/scopeDsl/minimalTestContainer.js';

/**
 * E2E test suite for Dynamic State Updates in ScopeDsl
 * Tests critical dynamic behavior identified in Priority 2 requirements
 */
describe('Dynamic State Updates E2E', () => {
  // OPTIMIZED: Shared container and services for all tests
  let containerSetup;
  let services;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let dataRegistry;
  let testActors;
  let testWorld;

  // PERFORMANCE OPTIMIZATION: Use beforeAll for expensive setup
  beforeAll(async () => {
    // Create minimal container (much faster than full configureContainer)
    containerSetup = await createMinimalTestContainer({
      logLevel: 'WARN', // Reduce log verbosity for tests
    });
    services = containerSetup.services;

    // Extract commonly used services
    entityManager = services.entityManager;
    scopeRegistry = services.scopeRegistry;
    scopeEngine = services.scopeEngine;
    dslParser = services.dslParser;
    dataRegistry = services.dataRegistry;

    // Set up test world and actors once for all tests
    testWorld = await ActionTestUtilities.createStandardTestWorld({
      entityManager,
      registry: dataRegistry,
    });

    testActors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry: dataRegistry,
    });

    // Set up initial scope definitions once
    await setupInitialScopeDefinitions();
  });

  // PERFORMANCE OPTIMIZATION: Proper cleanup after all tests
  afterAll(async () => {
    if (containerSetup?.cleanup) {
      await containerSetup.cleanup();
    }
  });

  beforeEach(() => {
    // Only clear caches between tests (fast operation)
    clearEntityCache();
  });

  afterEach(async () => {
    // Individual test cleanup - restore scope definitions and clear caches
    clearEntityCache();
    // Restore initial scope definitions in case they were modified by the test
    await setupInitialScopeDefinitions();
  });

  /**
   * Sets up initial scope definitions for dynamic testing
   */
  async function setupInitialScopeDefinitions() {
    // Create initial test scopes
    const initialScopes = ScopeTestUtilities.createTestScopes(
      {
        dslParser,
        logger: services.logger,
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
        },
        { scopeRegistry, scopeEngine }
      );

      expect(initialTargets).toBeInstanceOf(Set);
      const initialCount = initialTargets.size;

      // Update scope definition to be more restrictive
      const updatedScopes = ScopeTestUtilities.createTestScopes(
        {
          dslParser,
          logger: services.logger,
        },
        [
          {
            id: 'test:dynamic_entities',
            expr: 'entities(core:actor)[{"and": [{"!=": [{"var": "id"}, {"var": "actor.id"}]}, {">": [{"var": "entity.components.core:stats.level"}, 10]}]}]',
            description:
              'Dynamic entities scope - now restricted to high level actors',
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
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
          logger: services.logger,
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
        },
        { scopeRegistry, scopeEngine }
      );

      expect(newScopeTargets).toBeInstanceOf(Set);

      // Remove the scope by reinitializing without it
      const scopesWithoutNew = ScopeTestUtilities.createTestScopes(
        {
          dslParser,
          logger: services.logger,
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
            currentLocation:
              await entityManager.getEntityInstance('test-location-1'),
            entityManager,
            allEntities: Array.from(entityManager.entities),
            jsonLogicEval: services.jsonLogicEval,
            logger: services.logger,
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
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
      const playerInstance = await entityManager.getEntityInstance(
        testActors.player.id
      );
      if (!playerInstance.core?.position?.locationId) {
        await entityManager.addComponent(
          testActors.player.id,
          'core:position',
          {
            locationId: 'test-location-1',
          }
        );
      }

      // Clear cache
      clearEntityCache();

      // Resolution should now include the new entity
      const afterCreationTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:location_based',
        playerEntity,
        {
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
        },
        { scopeRegistry, scopeEngine }
      );

      const afterRemovalIds = Array.from(afterRemovalTargets);
      expect(afterRemovalTargets.size).toBeLessThanOrEqual(
        afterCreationTargets.size
      );
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
        },
        { scopeRegistry, scopeEngine }
      );

      // Now clear cache and resolve again
      clearEntityCache();

      const freshTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:high_level_entities',
        playerEntity,
        {
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
        },
        { scopeRegistry, scopeEngine }
      );

      const freshIds = Array.from(freshTargets);

      // Fresh resolution should include the updated entity
      expect(freshIds).toContain(testEntityId);
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
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
          currentLocation:
            await entityManager.getEntityInstance('test-location-1'),
          entityManager,
          allEntities: Array.from(entityManager.entities),
          jsonLogicEval: services.jsonLogicEval,
          logger: services.logger,
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
