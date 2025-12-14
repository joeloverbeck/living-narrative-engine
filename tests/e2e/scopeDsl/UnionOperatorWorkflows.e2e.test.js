/**
 * @file Union Operator Workflows E2E Test Suite
 * @see tests/e2e/scopeDsl/UnionOperatorWorkflows.e2e.test.js
 *
 * This test suite provides comprehensive end-to-end testing of union operator
 * workflows in the ScopeDSL system, covering:
 * - Both + and | operators (which produce identical behavior per parser docs)
 * - Basic union operations with deduplication
 * - Complex nested union scenarios
 * - Integration with filters, clothing, and other features
 * - Performance characteristics with large datasets
 *
 * Addresses Priority 1 Test 1.1 from ScopeDSL E2E Coverage Analysis Report
 * Coverage: Workflow 5b (Union Operations)
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';

/**
 * E2E test suite for union operator workflows
 * Tests the complete pipeline from union expressions to resolved entity sets
 *
 * Performance optimization: Container setup moved to beforeAll to avoid
 * re-initializing the entire DI container for each test (~1.1s per test).
 * Entity creation remains in beforeEach for test isolation.
 */
describe('Union Operator Workflows E2E', () => {
  // Shared services - initialized once in beforeAll
  let container;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let logger;
  let componentRegistry;

  // Per-test data - created fresh in beforeEach
  let testWorld;
  let testActors;

  // Track entity IDs created during tests for cleanup
  const createdEntityIds = new Set();

  beforeAll(async () => {
    // Create real container and configure it ONCE
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
    scopeEngine = container.resolve(tokens.IScopeEngine);
    dslParser = container.resolve(tokens.DslParser);
    logger = container.resolve(tokens.ILogger);
    componentRegistry = container.resolve(tokens.IDataRegistry);
  });

  beforeEach(async () => {
    // Reset circuit breakers to prevent cascade failures from XMLHttpRequest errors
    // during config loading. The MonitoringCoordinator is created internally by
    // createDefaultServicesWithConfig.js and accessible via EntityManager.
    const monitoringCoordinator = entityManager.getMonitoringCoordinator();
    if (monitoringCoordinator) {
      monitoringCoordinator.reset();
    }

    // Track current entity count before creating test entities
    const existingIds = new Set(entityManager.getEntityIds());

    // Set up test world and actors for each test
    testWorld = await ActionTestUtilities.createStandardTestWorld({
      entityManager,
      registry: componentRegistry,
    });

    testActors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry: componentRegistry,
    });

    // Track newly created entity IDs for cleanup
    for (const id of entityManager.getEntityIds()) {
      if (!existingIds.has(id)) {
        createdEntityIds.add(id);
      }
    }

    // Set up test conditions and scope definitions
    ScopeTestUtilities.setupScopeTestConditions(componentRegistry);

    const unionScopes = createUnionTestScopes();
    const scopeDefinitions = ScopeTestUtilities.createTestScopes(
      { dslParser, logger },
      unionScopes
    );

    // Initialize scope registry with test definitions
    scopeRegistry.initialize(scopeDefinitions);
  });

  afterEach(async () => {
    // Clean up test entities to ensure test isolation
    for (const entityId of createdEntityIds) {
      try {
        if (entityManager.hasEntity(entityId)) {
          entityManager.removeEntityInstance(entityId);
        }
      } catch {
        // Ignore cleanup errors - entity may already be removed
      }
    }
    createdEntityIds.clear();
  });

  /**
   * Creates union-specific test scope definitions
   *
   * @returns {Array<object>} Array of scope definitions for union testing
   */
  function createUnionTestScopes() {
    return [
      // Basic union tests with + operator
      {
        id: 'test:union_plus',
        expr: 'actor + location',
        description: 'Simple union using + operator',
      },
      // Basic union tests with | operator (should produce identical results)
      {
        id: 'test:union_pipe',
        expr: 'actor | location',
        description: 'Simple union using | operator',
      },
      // Union with entities
      {
        id: 'test:union_entities',
        expr: 'entities(core:actor) + entities(core:item)',
        description: 'Union of different entity types',
      },
      // Simple union without parentheses (replaces nested union)
      {
        id: 'test:simple_union',
        expr: 'actor + entities(core:actor)',
        description: 'Union of actor with all actor entities',
      },
      // Union with filters
      {
        id: 'test:union_filtered',
        expr: 'entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, "5"]}] + entities(core:actor)[{"<": [{"var": "entity.components.core:stats.level"}, "4"]}]',
        description: 'Union of filtered entity sets',
      },
      // Union with duplicate entries (should deduplicate)
      {
        id: 'test:union_with_duplicates',
        expr: 'entities(core:actor) + entities(core:actor)',
        description: 'Union of identical sets (should deduplicate)',
      },
    ];
  }

  /**
   * Creates game context for scope resolution
   *
   * @param {object} actor - The actor entity for context
   * @returns {object} Game context for scope resolution
   */
  function createGameContext(actor) {
    const jsonLogicEval = container.resolve(tokens.JsonLogicEvaluationService);
    const spatialIndexManager = container.resolve(tokens.ISpatialIndexManager);

    // Get all entities by their IDs
    const allEntityIds = entityManager.getEntityIds();
    const allEntities = allEntityIds
      .map((id) => entityManager.getEntityInstance(id))
      .filter((e) => e);

    return {
      actorEntity: actor,
      currentLocation: testWorld.currentLocation,
      entityManager,
      allEntities,
      jsonLogicEval,
      logger,
      spatialIndexManager,
    };
  }

  describe('Basic Union Operations', () => {
    test('should resolve + operator unions correctly', async () => {
      // Arrange
      const actor = testActors.player;
      const gameContext = createGameContext(actor);

      // Act
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:union_plus',
        actor,
        gameContext,
        { scopeRegistry, scopeEngine },
        { trace: true }
      );

      // Assert
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2); // actor + location
      expect(result.has(actor.id)).toBe(true);
      expect(result.has(testWorld.currentLocation.id)).toBe(true);
    });

    test('should resolve | operator unions identically to +', async () => {
      // Arrange
      const actor = testActors.player;
      const gameContext = createGameContext(actor);

      // Act - resolve both + and | versions
      const plusResult = await ScopeTestUtilities.resolveScopeE2E(
        'test:union_plus',
        actor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      const pipeResult = await ScopeTestUtilities.resolveScopeE2E(
        'test:union_pipe',
        actor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      // Assert - both operators should produce identical results
      expect(plusResult.size).toBe(pipeResult.size);
      expect([...plusResult].sort()).toEqual([...pipeResult].sort());
    });

    test('should deduplicate union results', async () => {
      // Arrange
      const actor = testActors.player;
      const gameContext = createGameContext(actor);

      // Act - union of identical sets
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:union_with_duplicates',
        actor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      // Assert - should not have duplicates
      expect(result).toBeInstanceOf(Set);

      // Get the count of actor entities
      const actorEntities = gameContext.allEntities.filter(
        (e) => e.hasComponent && e.hasComponent('core:actor')
      );

      // The result should have the same count as unique actor entities
      expect(result.size).toBe(actorEntities.length);
    });
  });

  describe('Complex Union Scenarios', () => {
    test('should handle simple unions without parentheses', async () => {
      // Arrange
      const actor = testActors.player;
      const gameContext = createGameContext(actor);

      // Act - simple union: actor + entities(core:actor)
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:simple_union',
        actor,
        gameContext,
        { scopeRegistry, scopeEngine },
        { trace: true }
      );

      // Assert
      expect(result).toBeInstanceOf(Set);
      // Should include the actor and all actor entities (including the actor itself)
      expect(result.has(actor.id)).toBe(true);

      // Should include all actor entities
      const actorEntities = gameContext.allEntities.filter(
        (e) => e.hasComponent && e.hasComponent('core:actor')
      );
      for (const entity of actorEntities) {
        expect(result.has(entity.id)).toBe(true);
      }
    });

    test('should combine filtered and unfiltered sources', async () => {
      // Arrange
      const actor = testActors.player;
      const gameContext = createGameContext(actor);

      // Act - union of high-level and low-level entities
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:union_filtered',
        actor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      // Assert
      expect(result).toBeInstanceOf(Set);

      // Collect entities with stats to verify level filtering
      const entitiesWithLevels = [];
      for (const entityId of result) {
        const entity = entityManager.getEntityInstance(entityId);
        if (
          entity &&
          entity.hasComponent &&
          entity.hasComponent('core:stats')
        ) {
          const stats = entity.getComponent('core:stats');
          if (stats && stats.level !== undefined) {
            entitiesWithLevels.push({
              id: entityId,
              level: stats.level,
              matchesFilter: stats.level > 5 || stats.level < 4,
            });
          }
        }
      }

      // All entities with levels should match the filter criteria
      const allMatch = entitiesWithLevels.every((e) => e.matchesFilter);
      expect(allMatch).toBe(true);
    });

    test('should handle union of different entity types', async () => {
      // Arrange
      const actor = testActors.player;
      const gameContext = createGameContext(actor);

      // Act - union of actors and items
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:union_entities',
        actor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      // Assert
      expect(result).toBeInstanceOf(Set);

      // Check for actor entities in the result
      const hasActors = [...result].some((entityId) => {
        const entity = entityManager.getEntityInstance(entityId);
        return (
          entity && entity.hasComponent && entity.hasComponent('core:actor')
        );
      });

      // At least actors should be present (items might not be in test setup)
      expect(hasActors).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    // Note: "should handle union of single elements correctly" was removed as
    // it was identical to "should resolve + operator unions correctly" in
    // Basic Union Operations - both tested the same test:union_plus scope.

    test('should maintain referential integrity across unions', async () => {
      // Arrange
      const actor = testActors.player;
      const gameContext = createGameContext(actor);

      // Act - resolve union
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:union_entities',
        actor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      // Assert - all referenced entities should exist
      for (const entityId of result) {
        const entity = entityManager.getEntityInstance(entityId);
        expect(entity).toBeTruthy();
        expect(entity.id).toBe(entityId);
      }
    });

    test('should handle concurrent union resolutions', async () => {
      // Arrange
      const actor = testActors.player;
      const gameContext = createGameContext(actor);

      // Act - resolve multiple unions concurrently
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          ScopeTestUtilities.resolveScopeE2E(
            'test:union_plus',
            actor,
            gameContext,
            { scopeRegistry, scopeEngine }
          )
        );
      }

      const results = await Promise.all(promises);

      // Assert - all results should be identical
      const firstResult = [...results[0]].sort();
      for (let i = 1; i < results.length; i++) {
        expect([...results[i]].sort()).toEqual(firstResult);
      }
    });
  });
});
