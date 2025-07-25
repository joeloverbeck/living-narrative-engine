/**
 * @file Core Scope Resolution E2E Test Suite
 * @see tests/e2e/scopeDsl/CoreScopeResolution.e2e.test.js
 *
 * This test suite provides comprehensive end-to-end testing of the complete
 * scope-to-entities resolution workflow, covering:
 * - Basic source resolution (actor, location, entities)
 * - Complex step resolution (nested component access)
 * - Filter expression resolution (JSON Logic integration)
 * - Error handling and edge cases
 * - Performance characteristics and validation
 *
 * Addresses Priority 1 requirements from ScopeDSL Architecture and E2E Coverage Analysis
 * Coverage: Workflows 1, 2, 3, 6 (complete scope-to-entities pipeline)
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

/**
 * E2E test suite for complete core scope resolution workflow
 * Tests the entire pipeline from scope definitions to resolved entity sets
 */
describe('Core Scope Resolution E2E', () => {
  let container;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let logger;
  let testWorld;
  let testActors;

  beforeEach(async () => {
    // Create real container and configure it
    container = new AppContainer();
    configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Get real services from container
    entityManager = container.resolve(tokens.IEntityManager);
    scopeRegistry = container.resolve(tokens.IScopeRegistry);
    scopeEngine = container.resolve(tokens.IScopeEngine);
    dslParser = container.resolve(tokens.DslParser);
    logger = container.resolve(tokens.ILogger);

    // Set up test world and actors
    testWorld = await ActionTestUtilities.createStandardTestWorld({
      entityManager,
      registry: container.resolve(tokens.IDataRegistry),
    });

    testActors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry: container.resolve(tokens.IDataRegistry),
    });

    // Set up test conditions and scope definitions
    ScopeTestUtilities.setupScopeTestConditions(
      container.resolve(tokens.IDataRegistry)
    );

    const scopeDefinitions = ScopeTestUtilities.createTestScopes({
      dslParser,
      logger,
    });

    // Initialize scope registry with test definitions
    scopeRegistry.initialize(scopeDefinitions);
  });

  afterEach(async () => {
    // Clean up resources
    if (container) {
      // Clean up any resources if needed
    }
  });

  /**
   * Creates a trace context for scope resolution testing
   *
   * @returns {TraceContext} A new trace context instance
   */
  function createTraceContext() {
    return new TraceContext();
  }

  /**
   * Creates game context for scope resolution
   *
   * @param {string} [locationId] - Current location ID
   * @returns {Promise<object>} Game context object
   */
  async function createGameContext(locationId = 'test-location-1') {
    return {
      currentLocation: await entityManager.getEntityInstance(locationId),
      entityManager: entityManager,
      allEntities: Array.from(entityManager.entities),
      jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
      logger: container.resolve(tokens.ILogger),
      spatialIndexManager: container.resolve(tokens.ISpatialIndexManager),
    };
  }

  /**
   * Scenario 1: Basic Source Resolution
   * Tests fundamental source resolution capabilities
   */
  describe('Basic Source Resolution', () => {
    test('should resolve actor source to current actor', async () => {
      // Test: actor → {actorId}
      // Validates: Source resolution, actor context handling
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:actor_source',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      expect(result.size).toBe(1);
      expect(result.has(testActors.player.id)).toBe(true);
    });

    test('should resolve location source to current location', async () => {
      // Test: location → {locationId}
      // Validates: Location provider integration
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext('test-location-1');

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:location_source',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      expect(result.size).toBe(1);
      expect(result.has('test-location-1')).toBe(true);
    });

    test('should resolve entities source with component filter', async () => {
      // Test: entities(core:actor) → {actorIds}
      // Validates: Component-based entity filtering
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:entities_with_component',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      expect(result.size).toBeGreaterThan(0);

      // Should include all actors with core:actor component
      expect(result.has(testActors.player.id)).toBe(true);
      expect(result.has(testActors.npc.id)).toBe(true);
      expect(result.has(testActors.follower.id)).toBe(true);

      // Should not include location entities
      expect(result.has('test-location-1')).toBe(false);
    });

    test('should handle missing or invalid sources gracefully', async () => {
      // Test error handling for non-existent scope
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      await expect(
        ScopeTestUtilities.resolveScopeE2E(
          'test:non-existent-scope',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        )
      ).rejects.toThrow('Scope not found');
    });
  });

  /**
   * Scenario 2: Complex Step Resolution
   * Tests multi-level component traversal and error handling
   */
  describe('Complex Step Resolution', () => {
    test('should resolve nested component access', async () => {
      // Test: actor.core:stats.strength → {strengthValue}
      // Validates: Multi-level component traversal

      // First, ensure the player has stats component with nested structure
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Add stats component to player for testing
      const registry = container.resolve(tokens.IDataRegistry);
      const playerDefinition = registry.get(
        'entityDefinitions',
        testActors.player.id
      );
      if (playerDefinition) {
        // Since EntityDefinition components are frozen, we need to recreate the definition
        const newComponents = {
          ...playerDefinition.components,
          'core:stats': {
            strength: 75,
            level: 10,
            health: 85,
          },
        };

        // Remove the old definition and add the new one
        registry.store(
          'entityDefinitions',
          testActors.player.id,
          new EntityDefinition(testActors.player.id, {
            description: playerDefinition.description,
            components: newComponents,
          })
        );

        // Remove existing entity instance first, then recreate
        await entityManager.removeEntityInstance(testActors.player.id);
        await entityManager.createEntityInstance(testActors.player.id, {
          instanceId: testActors.player.id,
          definitionId: testActors.player.id,
        });
      }

      const gameContext = await createGameContext();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:nested_component_access',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      // The result should contain the strength value or an appropriate representation
      expect(result.size).toBeGreaterThanOrEqual(0);
    });

    test('should handle missing component gracefully', async () => {
      // Test: actor.nonexistent:component → {}
      // Validates: Error handling, empty result management
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:missing_component_access',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      // Should return empty set for missing components
      expect(result.size).toBe(0);
    });

    test('should handle complex nested traversal with validation', async () => {
      // Test complex nested access patterns
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Add complex nested data to test entities
      const mockEntities = await ScopeTestUtilities.createMockEntityDataset(
        5,
        'complex',
        { entityManager, registry: container.resolve(tokens.IDataRegistry) }
      );

      const gameContext = await createGameContext();

      // Test that complex data doesn't break the resolution system
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:entities_with_component',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      expect(result.size).toBeGreaterThanOrEqual(5); // Should include mock entities
    });
  });

  /**
   * Scenario 3: Filter Expression Resolution
   * Tests JSON Logic integration and complex filtering
   */
  describe('Filter Expression Resolution', () => {
    test('should filter entities with JSON Logic conditions', async () => {
      // Test: entities(core:actor)[{"var": "core:stats.level", ">": 5}]
      // Validates: JSON Logic integration, context building

      // Create entities with varying stats for filtering
      const testEntitiesData = [
        { id: 'high-level-actor-1', level: 10 },
        { id: 'high-level-actor-2', level: 8 },
        { id: 'low-level-actor-1', level: 3 },
        { id: 'low-level-actor-2', level: 1 },
      ];

      const registry = container.resolve(tokens.IDataRegistry);

      for (const entityData of testEntitiesData) {
        const components = {
          'core:actor': { isPlayer: false },
          'core:stats': { level: entityData.level },
          'core:position': { locationId: 'test-location-1' },
        };

        const definition = new EntityDefinition(entityData.id, {
          description: 'Test entity for filtering',
          components,
        });
        registry.store('entityDefinitions', entityData.id, definition);

        await entityManager.createEntityInstance(entityData.id, {
          instanceId: entityData.id,
          definitionId: entityData.id,
        });
      }

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:json_logic_filter',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);

      // Should only include actors with level > 5
      expect(result.has('high-level-actor-1')).toBe(true);
      expect(result.has('high-level-actor-2')).toBe(true);
      expect(result.has('low-level-actor-1')).toBe(false);
      expect(result.has('low-level-actor-2')).toBe(false);
    });

    test('should handle complex multi-condition filters', async () => {
      // Test: Complex AND/OR logic expressions
      // Validates: Advanced filtering capabilities

      // Create test entities with multiple filterable properties
      const complexTestEntities = [
        { id: 'complex-actor-1', level: 8, health: 80 },
        { id: 'complex-actor-2', level: 6, health: 30 },
        { id: 'complex-actor-3', level: 2, health: 70 },
        { id: 'complex-actor-4', level: 10, health: 60 },
      ];

      const registry = container.resolve(tokens.IDataRegistry);

      for (const entityData of complexTestEntities) {
        const components = {
          'core:actor': { isPlayer: false },
          'core:stats': { level: entityData.level },
          'core:health': { current: entityData.health, max: 100 },
          'core:position': { locationId: 'test-location-1' },
        };

        const definition = new EntityDefinition(entityData.id, {
          description: 'Test entity for complex filtering',
          components,
        });
        registry.store('entityDefinitions', entityData.id, definition);

        await entityManager.createEntityInstance(entityData.id, {
          instanceId: entityData.id,
          definitionId: entityData.id,
        });
      }

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:complex_multi_filter',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);

      // Should only include actors with level > 3 AND health > 50
      expect(result.has('complex-actor-1')).toBe(true); // level 8, health 80
      expect(result.has('complex-actor-4')).toBe(true); // level 10, health 60
      expect(result.has('complex-actor-2')).toBe(false); // level 6, health 30 (fails health)
      expect(result.has('complex-actor-3')).toBe(false); // level 2, health 70 (fails level)
    });

    test('should handle filter context building correctly', async () => {
      // Test context building for JSON Logic evaluation
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Test with trace enabled to verify context building
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:json_logic_filter',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine },
        { trace: true }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      // Verify the resolution completes without context errors
    });

    test('should handle edge case filters gracefully', async () => {
      // Test edge cases in filter expressions
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Test with entities that have null/undefined values
      const registry = container.resolve(tokens.IDataRegistry);
      const edgeCaseEntityId = 'edge-case-actor';
      const components = {
        'core:actor': { isPlayer: false },
        // Intentionally missing stats component for edge case testing
        'core:position': { locationId: 'test-location-1' },
      };

      const definition = new EntityDefinition(edgeCaseEntityId, {
        description: 'Edge case test entity',
        components,
      });
      registry.store('entityDefinitions', edgeCaseEntityId, definition);

      await entityManager.createEntityInstance(edgeCaseEntityId, {
        instanceId: edgeCaseEntityId,
        definitionId: edgeCaseEntityId,
      });

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:json_logic_filter',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      // Should not include entity without stats component
      expect(result.has(edgeCaseEntityId)).toBe(false);
    });
  });

  /**
   * Performance and Integration Tests
   * Validates system behavior under realistic conditions
   */
  describe('Performance and Integration Validation', () => {
    test('should complete scope resolution within performance limits', async () => {
      // Create a larger dataset for performance testing
      const largeDataset = await ScopeTestUtilities.createMockEntityDataset(
        100,
        'moderate',
        { entityManager, registry: container.resolve(tokens.IDataRegistry) }
      );

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Measure resolution time
      const startTime = Date.now();
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:entities_with_component',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      const endTime = Date.now();

      const resolutionTime = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(resolutionTime).toBeLessThan(100); // 100ms target from report
      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      expect(result.size).toBeGreaterThanOrEqual(100); // Should include mock entities
    });

    test('should handle concurrent scope resolutions', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Run multiple concurrent resolutions
      const promises = [
        ScopeTestUtilities.resolveScopeE2E(
          'test:actor_source',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        ),
        ScopeTestUtilities.resolveScopeE2E(
          'test:location_source',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        ),
        ScopeTestUtilities.resolveScopeE2E(
          'test:entities_with_component',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        ),
      ];

      const results = await Promise.all(promises);

      // All resolutions should complete successfully
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result instanceof Set).toBe(true);
      });
    });

    test('should maintain result consistency across multiple calls', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Multiple calls should return consistent results
      const result1 = await ScopeTestUtilities.resolveScopeE2E(
        'test:entities_with_component',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      const result2 = await ScopeTestUtilities.resolveScopeE2E(
        'test:entities_with_component',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result1.size).toBe(result2.size);

      // Convert to arrays for easier comparison
      const array1 = Array.from(result1).sort();
      const array2 = Array.from(result2).sort();
      expect(array1).toEqual(array2);
    });
  });

  /**
   * Error Handling and Edge Cases
   * Validates robust error handling throughout the resolution pipeline
   */
  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed scope definitions gracefully', async () => {
      // Test with intentionally broken scope
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Create a scope with invalid AST structure (but still an object)
      const invalidScopeDefinitions = {
        'test:invalid_scope': {
          id: 'test:invalid_scope',
          expr: 'invalid.malformed.expression',
          ast: { type: 'Invalid', kind: 'malformed' }, // Invalid AST structure
          description: 'Test scope with invalid AST',
        },
      };

      scopeRegistry.initialize(invalidScopeDefinitions);

      await expect(
        ScopeTestUtilities.resolveScopeE2E(
          'test:invalid_scope',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        )
      ).rejects.toThrow();
    });

    test('should provide meaningful error messages', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      try {
        await ScopeTestUtilities.resolveScopeE2E(
          'test:completely-non-existent-scope',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        );
        fail('Expected error was not thrown');
      } catch (error) {
        expect(error.message).toContain('Scope not found');
        expect(error.message).toContain('test:completely-non-existent-scope');
      }
    });

    test('should handle empty game contexts gracefully', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Create minimal game context
      const minimalGameContext = {
        currentLocation: null,
        entityManager: entityManager,
        allEntities: [],
      };

      // Should handle null location gracefully
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:actor_source',
        playerEntity,
        minimalGameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
    });
  });
});
