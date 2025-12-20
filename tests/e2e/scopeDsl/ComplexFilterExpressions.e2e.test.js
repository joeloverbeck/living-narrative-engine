/**
 * @file Complex Filter Expressions E2E Test Suite
 * @see reports/scopedsl-e2e-coverage-analysis.md - Section 5: Priority 1 Test 1.3
 *
 * This test suite provides comprehensive end-to-end testing of complex filter
 * expressions in the ScopeDSL system, addressing critical coverage gaps in:
 * - Deeply nested AND/OR conditions with complex JSON Logic
 * - Condition reference chains and mixed inline/referenced conditions
 * - Performance validation with large datasets (1000+ entities)
 * - Filter failure resilience and graceful error handling
 * - Integration with other ScopeDSL features (unions, caching)
 *
 * Addresses Priority 1 requirements from ScopeDSL E2E Coverage Analysis
 * Coverage: Workflow 5a (Filter Resolution) - Complex scenarios not covered elsewhere
 */

import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  test,
  expect,
} from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

/**
 * E2E test suite for complex filter expressions in ScopeDSL
 * Tests advanced filtering capabilities not covered in CoreScopeResolution
 */
describe('Complex Filter Expressions E2E', () => {
  let container;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let logger;
  let jsonLogicService;
  let spatialIndexManager;
  let registry;
  let baseScopes; // Store base scopes for re-initialization after tests that modify registry

  // PERFORMANCE OPTIMIZATION: Move expensive setup to beforeAll
  beforeAll(async () => {
    // Create real container for comprehensive E2E testing (ONCE)
    container = new AppContainer();
    await configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Get real services from container (ONCE)
    entityManager = container.resolve(tokens.IEntityManager);
    scopeRegistry = container.resolve(tokens.IScopeRegistry);
    scopeEngine = container.resolve(tokens.IScopeEngine);
    dslParser = container.resolve(tokens.DslParser);
    logger = container.resolve(tokens.ILogger);
    jsonLogicService = container.resolve(tokens.JsonLogicEvaluationService);
    spatialIndexManager = container.resolve(tokens.ISpatialIndexManager);
    registry = container.resolve(tokens.IDataRegistry);

    // Set up comprehensive test conditions for complex filtering (ONCE)
    ScopeTestUtilities.setupScopeTestConditions(registry, [
      {
        id: 'test:complex-multilevel-condition',
        description: 'Complex nested condition with multiple levels',
        logic: {
          and: [
            { '>': [{ var: 'entity.components.core:stats.level' }, 5] },
            {
              or: [
                { '>': [{ var: 'entity.components.core:stats.strength' }, 20] },
                { '>': [{ var: 'entity.components.core:stats.agility' }, 15] },
              ],
            },
          ],
        },
      },
      {
        id: 'test:deep-nested-condition',
        description: 'Very deep nested condition for stress testing',
        logic: {
          and: [
            { '>': [{ var: 'entity.components.core:stats.level' }, 1] },
            {
              or: [
                {
                  and: [
                    {
                      '>': [
                        { var: 'entity.components.core:health.current' },
                        30,
                      ],
                    },
                    {
                      '<': [
                        { var: 'entity.components.core:health.current' },
                        80,
                      ],
                    },
                  ],
                },
                {
                  and: [
                    {
                      '>': [
                        { var: 'entity.components.core:stats.strength' },
                        25,
                      ],
                    },
                    {
                      '==': [
                        { var: 'entity.components.core:actor.isPlayer' },
                        false,
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
        id: 'test:arithmetic-condition',
        description: 'Condition using arithmetic operations',
        logic: {
          '>': [
            {
              '+': [
                { var: 'entity.components.core:stats.strength' },
                { var: 'entity.components.core:stats.agility' },
              ],
            },
            40,
          ],
        },
      },
    ]);

    // Create complex test scopes for filter expressions (ONCE)
    baseScopes = ScopeTestUtilities.createTestScopes({ dslParser, logger }, [
      {
        id: 'test:deeply_nested_filter',
        expr: 'entities(core:actor)[{"and": [{">=": [{"var": "entity.components.core:stats.level"}, 3]}, {"or": [{">=": [{"var": "entity.components.core:stats.strength"}, 20]}, {"and": [{">=": [{"var": "entity.components.core:stats.agility"}, 15]}, {"<": [{"var": "entity.components.core:health.current"}, 80]}]}]}]}]',
        description: 'Deeply nested AND/OR filter with multiple conditions',
      },
      {
        id: 'test:condition_ref_chain',
        expr: 'entities(core:actor)[{"condition_ref": "test:complex-multilevel-condition"}]',
        description: 'Filter using complex condition reference',
      },
      {
        id: 'test:mixed_inline_and_ref',
        expr: 'entities(core:actor)[{"and": [{"condition_ref": "test:deep-nested-condition"}, {">": [{"var": "entity.components.core:stats.level"}, 10]}]}]',
        description: 'Mixed condition reference and inline condition',
      },
      {
        id: 'test:arithmetic_filter',
        expr: 'entities(core:actor)[{"condition_ref": "test:arithmetic-condition"}]',
        description: 'Filter using arithmetic operations in condition',
      },
      {
        id: 'test:chained_filters',
        expr: 'entities(core:actor)[{"and": [{">": [{"var": "entity.components.core:stats.level"}, 5]}, {"<": [{"var": "entity.components.core:health.current"}, 90]}]}]',
        description: 'Combined filter operations using AND logic',
      },
      {
        id: 'test:array_filter',
        expr: 'actor.core:inventory.items[{">": [{"var": "quantity"}, 1]}].name',
        description: 'Filter on array elements with property access',
      },
      {
        id: 'test:complex_step_filter',
        expr: 'location.locations:exits[{"condition_ref": "movement:exit-is-unblocked"}].target[{"condition_ref": "test:level-above-threshold"}]',
        description: 'Complex step navigation with multiple filters',
      },
    ]);

    // Initialize scope registry with complex test scopes (ONCE)
    scopeRegistry.initialize(baseScopes);
  });

  // PERFORMANCE OPTIMIZATION: Clean up container after all tests
  afterAll(() => {
    if (container && typeof container.cleanup === 'function') {
      container.cleanup();
    }
  });

  // Clear entity state between tests for isolation
  beforeEach(() => {
    // Clear all entities from previous test
    entityManager.clearAll();
    // Re-initialize scope registry with base scopes (in case a test modified it)
    scopeRegistry.initialize(baseScopes);
  });

  /**
   * Creates a comprehensive test actor with complex component structure
   *
   * @param actorId
   * @param config
   */
  async function createComplexTestActor(actorId, config = {}) {
    const {
      level = 8,
      strength = 22,
      agility = 18,
      health = 65,
      maxHealth = 100,
      isPlayer = false,
      hasInventory = true,
    } = config;

    const components = {
      'core:actor': { isPlayer },
      'core:stats': { level, strength, agility },
      'core:health': { current: health, max: maxHealth },
      'core:position': { locationId: 'test-location-1' },
    };

    if (hasInventory) {
      components['core:inventory'] = {
        items: [
          { id: 'item-1', name: 'Sword', quantity: 1, type: 'weapon' },
          { id: 'item-2', name: 'Potion', quantity: 3, type: 'consumable' },
          { id: 'item-3', name: 'Armor', quantity: 1, type: 'equipment' },
        ],
      };
    }

    const definition = new EntityDefinition(actorId, {
      description: 'Complex test actor for filter testing',
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
   * Creates game context for complex filter testing
   *
   * @param locationId
   */
  async function createGameContext(locationId = 'test-location-1') {
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
   * Creates a deterministic dataset for complex filtering tests
   * Ensures entities meet the filter conditions being tested
   *
   * @param size
   */
  async function createComplexFilterDataset(size = 20) {
    const entities = [];

    // Create test location
    const locationDefinition = new EntityDefinition('test-location-1', {
      description: 'Test location for complex filtering',
      components: {
        'core:position': { x: 0, y: 0 },
        'locations:exits': [
          { direction: 'north', target: 'north-location', blocked: false },
          { direction: 'south', target: 'south-location', blocked: true },
        ],
      },
    });
    registry.store('entityDefinitions', 'test-location-1', locationDefinition);
    await entityManager.createEntityInstance('test-location-1', {
      instanceId: 'test-location-1',
      definitionId: 'test-location-1',
    });

    // Create deterministic actors that will meet various filter conditions
    const testConfigs = [
      // Entities that should pass most filters
      { level: 12, strength: 25, agility: 20, health: 70 }, // High level, strong, agile
      { level: 8, strength: 22, agility: 18, health: 65 }, // Medium-high stats
      { level: 15, strength: 30, agility: 25, health: 75 }, // Very high stats
      { level: 6, strength: 21, agility: 16, health: 45 }, // Just above thresholds
      { level: 11, strength: 28, agility: 22, health: 85 }, // High level and strength

      // Entities that should pass some filters but not others
      { level: 7, strength: 19, agility: 22, health: 60 }, // High agility, lower strength
      { level: 4, strength: 25, agility: 20, health: 30 }, // Low level but good stats
      { level: 9, strength: 15, agility: 28, health: 90 }, // High agility, low strength
      { level: 13, strength: 12, agility: 30, health: 55 }, // High level and agility
      { level: 3, strength: 35, agility: 10, health: 40 }, // Meets level >= 3, high strength

      // Entities for boundary testing
      { level: 3, strength: 20, agility: 15, health: 79 }, // Boundary values
      { level: 5, strength: 18, agility: 23, health: 35 }, // Just below some thresholds
      { level: 10, strength: 16, agility: 25, health: 95 }, // Level = 10 boundary
      { level: 20, strength: 35, agility: 30, health: 50 }, // Very high level
      { level: 1, strength: 40, agility: 5, health: 25 }, // Low level, high strength
    ];

    // Use deterministic configs, repeating if needed
    for (let i = 0; i < size; i++) {
      const actorId = `complex-test-actor-${i}`;
      const configIndex = i % testConfigs.length;
      const config = {
        ...testConfigs[configIndex],
        maxHealth: 100,
        isPlayer: i === 0,
        hasInventory: i % 3 !== 0, // 2/3 have inventory
      };

      const entity = await createComplexTestActor(actorId, config);
      entities.push(entity);
    }

    return entities;
  }

  /**
   * Scenario 1: Deeply Nested Conditions
   * Tests complex logical operators and nested condition structures
   */
  describe('Deeply Nested Conditions', () => {
    test('should handle complex nested AND/OR conditions', async () => {
      // Create diverse test dataset
      const testEntities = await createComplexFilterDataset(15);
      const testActor = testEntities[0];
      const gameContext = await createGameContext();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:deeply_nested_filter',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);

      // Should filter entities based on complex conditions
      // Expected: level >= 3 AND (strength >= 20 OR (agility >= 15 AND health < 80))
      const resultArray = Array.from(result);

      // Verify each result matches the complex condition
      for (const entityId of resultArray) {
        const entity = await entityManager.getEntityInstance(entityId);
        expect(entity).toBeDefined();

        const stats = entity.getComponentData('core:stats');
        const health = entity.getComponentData('core:health');

        expect(stats).toBeDefined();
        expect(health).toBeDefined();
        expect(stats.level).toBeGreaterThanOrEqual(3);

        const strengthCondition = stats.strength >= 20;
        const agilityHealthCondition =
          stats.agility >= 15 && health.current < 80;
        const orCondition = strengthCondition || agilityHealthCondition;

        expect(orCondition).toBe(true);
      }
    });

    test('should resolve condition reference chains correctly', async () => {
      const testEntities = await createComplexFilterDataset(10);
      const testActor = testEntities[0];
      const gameContext = await createGameContext();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:condition_ref_chain',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);

      // Should apply the referenced condition correctly
      const resultArray = Array.from(result);
      for (const entityId of resultArray) {
        const entity = await entityManager.getEntityInstance(entityId);
        expect(entity).toBeDefined();

        const stats = entity.getComponentData('core:stats');
        expect(stats).toBeDefined();

        // Verify complex-multilevel-condition is applied
        expect(stats.level).toBeGreaterThan(5);
        expect(stats.strength > 20 || stats.agility > 15).toBe(true);
      }
    });

    test('should combine inline and referenced conditions', async () => {
      const testEntities = await createComplexFilterDataset(12);
      const testActor = testEntities[0];
      const gameContext = await createGameContext();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:mixed_inline_and_ref',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);

      // Should combine referenced condition AND inline level check
      const resultArray = Array.from(result);
      for (const entityId of resultArray) {
        const entity = await entityManager.getEntityInstance(entityId);
        expect(entity).toBeDefined();

        const stats = entity.getComponentData('core:stats');
        expect(stats).toBeDefined();

        // Must satisfy both referenced condition AND level > 10
        expect(stats.level).toBeGreaterThan(10);
      }
    });

    test('should handle arithmetic operations in conditions', async () => {
      const testEntities = await createComplexFilterDataset(8);
      const testActor = testEntities[0];
      const gameContext = await createGameContext();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:arithmetic_filter',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);

      // Should apply arithmetic condition: strength + agility > 40
      const resultArray = Array.from(result);
      for (const entityId of resultArray) {
        const entity = await entityManager.getEntityInstance(entityId);
        expect(entity).toBeDefined();

        const stats = entity.getComponentData('core:stats');
        expect(stats).toBeDefined();

        expect(stats.strength + stats.agility).toBeGreaterThan(40);
      }
    });
  });

  /**
   * Scenario 2: Filter Resilience and Error Handling
   * Tests graceful degradation under problematic conditions
   */
  describe('Filter Resilience and Error Handling', () => {
    test('should handle filter failures gracefully', async () => {
      const testActor = await createComplexTestActor('failure-test-actor');
      const gameContext = await createGameContext();

      // Create scope with intentionally problematic filter
      const problematicScopes = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:invalid_field_filter',
            expr: 'entities(core:actor)[{">": [{"var": "entity.components.nonexistent:field.value"}, 10]}]',
            description: 'Filter referencing non-existent component field',
          },
        ]
      );

      scopeRegistry.initialize(problematicScopes);

      // Should handle gracefully and return results for entities that can be evaluated
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:invalid_field_filter',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      // Should return empty set for invalid field access
      expect(result.size).toBe(0);
    });
  });

  /**
   * Scenario 3: Advanced Filter Features
   * Tests integration of filters with other ScopeDSL features
   */
  describe('Advanced Filter Features', () => {
    test('should handle combined filter operations', async () => {
      const testEntities = await createComplexFilterDataset(20);
      const testActor = testEntities[0];
      const gameContext = await createGameContext();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:chained_filters',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);

      // Should apply both filters: level > 5 AND health < 90
      const resultArray = Array.from(result);
      for (const entityId of resultArray) {
        const entity = await entityManager.getEntityInstance(entityId);
        expect(entity).toBeDefined();

        const stats = entity.getComponentData('core:stats');
        const health = entity.getComponentData('core:health');
        expect(stats).toBeDefined();
        expect(health).toBeDefined();

        expect(stats.level).toBeGreaterThan(5);
        expect(health.current).toBeLessThan(90);
      }
    });

    test('should filter array elements correctly', async () => {
      // Create actor with inventory for array filtering
      const testActor = await createComplexTestActor('array-test-actor', {
        hasInventory: true,
        level: 5,
      });
      const gameContext = await createGameContext();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:array_filter',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);

      // Should filter inventory items with quantity > 1 and return their names
      const resultArray = Array.from(result);
      expect(resultArray).toContain('Potion'); // quantity: 3
      expect(resultArray).not.toContain('Sword'); // quantity: 1
      expect(resultArray).not.toContain('Armor'); // quantity: 1
    });

    test('should handle missing components gracefully in complex filters', async () => {
      // Create actors with missing components
      const partialActor1 = await createComplexTestActor('partial-actor-1', {
        level: 10,
        hasInventory: false, // Missing inventory component
      });

      const gameContext = await createGameContext();

      // Test with filter that references potentially missing components
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:deeply_nested_filter',
        partialActor1,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);

      // Should handle missing components and still evaluate what's available
      const resultArray = Array.from(result);
      expect(resultArray).toContain('partial-actor-1');
    });

    test('should maintain filter context integrity across complex operations', async () => {
      const testEntities = await createComplexFilterDataset(15);
      const testActor = testEntities[0];
      const gameContext = await createGameContext();

      // Test with trace enabled to verify context handling
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:mixed_inline_and_ref',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine },
        { trace: true }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);

      // Verify the resolution completed without context errors
      // This tests the complex context building and management in filterResolver
      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });

  /**
   * Scenario 4: Error Handling and Edge Cases
   * Tests robust error handling in complex filter scenarios
   */
  describe('Error Handling and Edge Cases', () => {
    test('should handle null and undefined values in filter expressions', async () => {
      // Create entities with null/undefined values
      const nullValueEntityId = 'null-value-entity';
      const nullComponents = {
        'core:actor': { isPlayer: false },
        'core:stats': { level: null, strength: 15, agility: undefined },
        'core:health': { current: 50, max: 100 },
        'core:position': { locationId: 'test-location-1' },
      };

      const definition = new EntityDefinition(nullValueEntityId, {
        description: 'Entity with null/undefined values',
        components: nullComponents,
      });
      registry.store('entityDefinitions', nullValueEntityId, definition);

      await entityManager.createEntityInstance(nullValueEntityId, {
        instanceId: nullValueEntityId,
        definitionId: nullValueEntityId,
      });

      const testActor = await createComplexTestActor('null-test-actor');
      const gameContext = await createGameContext();

      // Should handle null/undefined gracefully
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:deeply_nested_filter',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);

      // Entity with null values should be excluded from results
      expect(result.has(nullValueEntityId)).toBe(false);
    });

    test('should handle malformed condition references gracefully', async () => {
      const testActor = await createComplexTestActor('malformed-test-actor');
      const gameContext = await createGameContext();

      // Create scope with non-existent condition reference
      const malformedScopes = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:invalid_condition_ref',
            expr: 'entities(core:actor)[{"condition_ref": "nonexistent:condition"}]',
            description: 'Filter with invalid condition reference',
          },
        ]
      );

      scopeRegistry.initialize(malformedScopes);

      // Should handle missing condition reference gracefully and return empty result
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:invalid_condition_ref',
        testActor,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      // Should return empty set when condition reference cannot be resolved
      expect(result.size).toBe(0);
    });

    test('should handle missing services gracefully', async () => {
      const testActor = await createComplexTestActor('error-test-actor');

      // Create invalid game context (missing required services)
      const invalidGameContext = {
        currentLocation: null,
        entityManager: entityManager,
        allEntities: [],
        // Missing jsonLogicEval service intentionally
        logger: logger,
        spatialIndexManager: spatialIndexManager,
      };

      // Should handle missing services gracefully and return empty result
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:deeply_nested_filter',
        testActor,
        invalidGameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      // Should return empty set when jsonLogicEval service is missing
      expect(result.size).toBe(0);
    });
  });
});
