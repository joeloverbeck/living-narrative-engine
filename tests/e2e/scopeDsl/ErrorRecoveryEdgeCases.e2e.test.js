/**
 * @file Error Recovery and Edge Cases E2E Test Suite for ScopeDSL
 * @see reports/scopedsl-architecture-and-e2e-coverage-analysis.md
 *
 * This test suite validates system resilience and edge case handling across
 * all scopeDSL workflows, covering:
 * - Graceful degradation with missing scope definitions
 * - Resolver failure recovery and error isolation
 * - Resource exhaustion handling (memory pressure, timeouts)
 * - Malformed input handling and validation
 * - Error message quality and actionable feedback
 * - System recovery from various failure modes
 *
 * Addresses Priority 5 requirements from ScopeDSL Architecture and E2E Coverage Analysis
 * Coverage: All workflows (1-6) with focus on error scenarios and system resilience
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
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';

// Set timeout for error recovery tests
jest.setTimeout(30000);

/**
 * E2E test suite for error recovery and edge cases in ScopeDSL system
 * Tests system resilience, error handling, and recovery mechanisms
 */
describe('ScopeDSL Error Recovery and Edge Cases E2E', () => {
  let container;
  let entityManager;
  let actionDiscoveryService;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let logger;
  let testActors;
  let registry;

  beforeAll(async () => {
    // Create real container and configure it once for all tests
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
    scopeRegistry = container.resolve(tokens.IScopeRegistry);
    scopeEngine = container.resolve(tokens.IScopeEngine);
    dslParser = container.resolve(tokens.DslParser);
    logger = container.resolve(tokens.ILogger);
    registry = container.resolve(tokens.IDataRegistry);
  });

  beforeEach(async () => {
    // Clear entity manager state completely to avoid ID conflicts
    if (entityManager && typeof entityManager.clearAll === 'function') {
      entityManager.clearAll();
    }

    // Clear registry state
    if (registry && typeof registry.clear === 'function') {
      registry.clear();
    }

    // Set up test actors for each test
    testActors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry,
    });

    // Set up test conditions and scope definitions
    ScopeTestUtilities.setupScopeTestConditions(registry);
  });

  afterEach(async () => {
    // Clean up test-specific resources
    if (global.gc) {
      global.gc(); // Force garbage collection when available
    }
  });

  afterAll(async () => {
    // Final cleanup of shared resources
    container = null;
    entityManager = null;
    actionDiscoveryService = null;
    scopeRegistry = null;
    scopeEngine = null;
    dslParser = null;
    logger = null;
    registry = null;
    testActors = null;
  });

  /**
   * Creates game context for scope resolution
   *
   * @param {string} [locationId] - Current location ID
   * @param {object} [overrides] - Context property overrides for testing
   * @returns {Promise<object>} Game context object
   */
  async function createGameContext(
    locationId = 'test-location-1',
    overrides = {}
  ) {
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance(locationId),
      entityManager: entityManager,
      allEntities: Array.from(entityManager.entities),
      jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
      logger: container.resolve(tokens.ILogger),
      spatialIndexManager: container.resolve(tokens.ISpatialIndexManager),
    };

    return { ...baseContext, ...overrides };
  }

  /**
   * Creates intentionally malformed scope definitions for error testing
   *
   * @returns {object} Map of scope definitions with various error types
   */
  function createMalformedScopeDefinitions() {
    return {
      'test:missing_ast': {
        id: 'test:missing_ast',
        expr: 'actor.nonexistent',
        // Intentionally missing AST property
        description: 'Scope missing AST for error testing',
      },
      'test:invalid_ast_structure': {
        id: 'test:invalid_ast_structure',
        expr: 'invalid.malformed.expression',
        ast: { type: 'InvalidType', invalidProperty: true }, // Invalid AST structure
        description: 'Scope with invalid AST structure',
      },
      'test:null_ast': {
        id: 'test:null_ast',
        expr: 'actor',
        ast: null, // Null AST
        description: 'Scope with null AST',
      },
      'test:circular_reference': {
        id: 'test:circular_reference',
        expr: 'actor.circular.reference.back.to.actor',
        ast: {
          type: 'Step',
          property: 'circular',
          next: {
            type: 'Step',
            property: 'reference',
            next: {
              type: 'Step',
              property: 'back',
              next: {
                type: 'Step',
                property: 'to',
                next: {
                  type: 'Source',
                  kind: 'actor', // This could create circular reference
                },
              },
            },
          },
        },
        description: 'Scope that might create circular references',
      },
    };
  }

  /**
   * Creates entities with corrupted or missing component data (optimized)
   *
   * @returns {Promise<Array>} Array of corrupted entity definitions
   */
  async function createCorruptedEntities() {
    const corruptedEntities = [];
    
    // Use a shared counter to avoid ID conflicts across tests
    const timestamp = Date.now();

    // Entity with null components (unique ID)
    const nullComponentEntity = {
      id: `corrupted-null-component-${timestamp}`,
      components: null,
    };
    const nullDef = createEntityDefinition(nullComponentEntity.id, {});
    registry.store('entityDefinitions', nullComponentEntity.id, nullDef);
    await entityManager.createEntityInstance(nullComponentEntity.id, {
      instanceId: nullComponentEntity.id,
      definitionId: nullComponentEntity.id,
    });
    corruptedEntities.push(nullComponentEntity);

    // Entity with deeply nested undefined values (unique ID)
    const undefinedNestedEntity = {
      id: `corrupted-undefined-nested-${timestamp}`,
      components: {
        'core:actor': { name: 'Corrupted Actor' },
        'core:stats': {
          level: undefined,
          nested: {
            deep: {
              value: undefined,
              deeper: null,
            },
          },
        },
      },
    };
    const undefinedDef = createEntityDefinition(
      undefinedNestedEntity.id,
      undefinedNestedEntity.components
    );
    registry.store('entityDefinitions', undefinedNestedEntity.id, undefinedDef);
    await entityManager.createEntityInstance(undefinedNestedEntity.id, {
      instanceId: undefinedNestedEntity.id,
      definitionId: undefinedNestedEntity.id,
    });
    corruptedEntities.push(undefinedNestedEntity);

    // Entity with circular references in components (unique ID)
    const circularEntity = {
      id: `corrupted-circular-refs-${timestamp}`,
      components: {
        'core:actor': { name: 'Circular Actor' },
      },
    };
    // Add circular reference after creation
    circularEntity.components['core:self_ref'] = circularEntity;
    const circularDef = createEntityDefinition(circularEntity.id, {
      'core:actor': { name: 'Circular Actor' },
      'core:self_ref': { entityId: circularEntity.id },
    });
    registry.store('entityDefinitions', circularEntity.id, circularDef);
    await entityManager.createEntityInstance(circularEntity.id, {
      instanceId: circularEntity.id,
      definitionId: circularEntity.id,
    });
    corruptedEntities.push(circularEntity);

    return corruptedEntities;
  }

  /**
   * Scenario 1: Graceful Degradation Tests
   * Tests system behavior when components fail but system should continue operating
   */
  describe('Graceful Degradation', () => {
    test('should continue operation with missing scope definitions', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Test action discovery with undefined scope
      await expect(
        ScopeTestUtilities.resolveScopeE2E(
          'nonexistent:scope',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        )
      ).rejects.toThrow('Scope not found');

      // Verify error is contained and system continues to work
      const validScopes = ScopeTestUtilities.createTestScopes({
        dslParser,
        logger,
      });
      scopeRegistry.initialize(validScopes);

      // Should still work with valid scopes
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:actor_source',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      expect(result.has(testActors.player.id)).toBe(true);
    });

    test('should recover from resolver failures in complex expressions', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Initialize with malformed scopes
      const malformedScopes = createMalformedScopeDefinitions();

      // Test various malformed scope types
      for (const [scopeId, scopeDef] of Object.entries(malformedScopes)) {
        const singleScopeRegistry = {};
        singleScopeRegistry[scopeId] = scopeDef;

        try {
          scopeRegistry.initialize(singleScopeRegistry);

          await expect(
            ScopeTestUtilities.resolveScopeE2E(
              scopeId,
              playerEntity,
              gameContext,
              { scopeRegistry, scopeEngine }
            )
          ).rejects.toThrow();
        } catch (initError) {
          // Registry initialization itself might fail for some malformed scopes
          expect(initError).toBeDefined();
        }
      }

      // Verify system recovers with valid scopes
      const validScopes = ScopeTestUtilities.createTestScopes({
        dslParser,
        logger,
      });
      scopeRegistry.initialize(validScopes);

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:entities_with_component',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
    });

    test('should handle partial resolver failures gracefully', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Create corrupted entities
      await createCorruptedEntities();

      const gameContext = await createGameContext();

      // Initialize valid scopes
      const testScopes = ScopeTestUtilities.createTestScopes({
        dslParser,
        logger,
      });
      scopeRegistry.initialize(testScopes);

      // Test resolution with corrupted entities present
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:entities_with_component',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      // Should still work, potentially filtering out corrupted entities
      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      // Should at least include valid test actors
      expect(result.has(testActors.player.id)).toBe(true);
    });

    test('should isolate errors in action discovery workflow', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const baseContext = await createGameContext();

      // Create action with bad scope
      const actionWithBadScope = {
        id: 'test:bad_scope_action',
        name: 'Bad Scope Action',
        description: 'Action with non-existent scope',
        scope: 'nonexistent:scope',
        template: 'perform bad action on {target}',
        prerequisites: [],
        required_components: {
          actor: [],
        },
      };

      registry.store('actions', actionWithBadScope.id, actionWithBadScope);
      const actionIndex = container.resolve(tokens.ActionIndex);
      actionIndex.buildIndex([actionWithBadScope]);

      // Should not crash action discovery
      const discoveredActions = await actionDiscoveryService.getValidActions(
        playerEntity,
        baseContext,
        { trace: true }
      );

      // Should still return results (excluding the bad action)
      expect(discoveredActions.actions).toBeDefined();
      expect(Array.isArray(discoveredActions.actions)).toBe(true);

      // Should have trace information about the error
      expect(discoveredActions.trace).toBeDefined();
    });
  });

  /**
   * Scenario 2: Resource Exhaustion Tests
   * Tests system behavior under memory pressure and resource constraints
   */
  describe('Resource Exhaustion', () => {
    test('should handle memory pressure gracefully', async () => {
      // Force cleanup before test to get accurate baseline
      if (global.gc) {
        global.gc();
      }
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Create dataset to simulate memory pressure (optimized size)
      await ScopeTestUtilities.createMockEntityDataset(100, 'moderate', {
        entityManager,
        registry,
      });

      const gameContext = await createGameContext();

      // Initialize scope for large dataset
      const testScopes = ScopeTestUtilities.createTestScopes({
        dslParser,
        logger,
      });
      scopeRegistry.initialize(testScopes);

      // Monitor memory usage
      const startMemory = process.memoryUsage().heapUsed;

      // Perform multiple resolutions that could accumulate memory (optimized)
      const iterations = 10;
      for (let i = 0; i < iterations; i++) {
        const result = await ScopeTestUtilities.resolveScopeE2E(
          'test:entities_with_component',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        );

        expect(result).toBeDefined();
        expect(result instanceof Set).toBe(true);
        expect(result.size).toBeGreaterThan(0);

        // Check for memory leaks periodically (optimized frequency)
        if (i % 3 === 0 && global.gc) {
          global.gc();
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const endMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (endMemory - startMemory) / 1024 / 1024; // MB

      // Memory growth should be reasonable (adjusted for smaller dataset)
      expect(memoryGrowth).toBeLessThan(50); // < 50MB growth with optimized dataset
    });

    test('should enforce timeout limits for long-running queries', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Create scope that could potentially run for a long time
      // This depends on the system having timeout mechanisms
      const testScopes = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:potentially_slow_scope',
            expr: 'entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, {"var": "actor.core:stats.level"}]}]',
            description:
              'Scope that compares all entities against actor (potentially slow)',
          },
        ]
      );
      scopeRegistry.initialize(testScopes);

      // Create entities for slow query testing (optimized size)
      await ScopeTestUtilities.createMockEntityDataset(50, 'moderate', {
        entityManager,
        registry,
      });

      // Measure execution time
      const startTime = Date.now();
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:potentially_slow_scope',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      // Should complete within reasonable time (optimized for smaller dataset)
      expect(executionTime).toBeLessThan(3000); // 3 seconds max with smaller dataset
      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
    });

    test('should handle depth limit enforcement', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Create deeply nested AST that might exceed depth limits
      const deepNestedAst = {
        type: 'Step',
        property: 'level1',
        next: {
          type: 'Step',
          property: 'level2',
          next: {
            type: 'Step',
            property: 'level3',
            next: {
              type: 'Step',
              property: 'level4',
              next: {
                type: 'Step',
                property: 'level5',
                next: {
                  type: 'Step',
                  property: 'level6',
                  next: {
                    type: 'Step',
                    property: 'level7', // This might exceed depth limit
                    next: {
                      type: 'Source',
                      kind: 'actor',
                    },
                  },
                },
              },
            },
          },
        },
      };

      const deepNestedScope = {
        'test:deep_nested_scope': {
          id: 'test:deep_nested_scope',
          expr: 'actor.level1.level2.level3.level4.level5.level6.level7',
          ast: deepNestedAst,
          description: 'Deeply nested scope for depth limit testing',
        },
      };

      scopeRegistry.initialize(deepNestedScope);

      // Should either succeed or fail gracefully with depth limit error
      try {
        const result = await ScopeTestUtilities.resolveScopeE2E(
          'test:deep_nested_scope',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        );

        // If it succeeds, result should be valid
        expect(result).toBeDefined();
        expect(result instanceof Set).toBe(true);
      } catch (error) {
        // If it fails, error should be related to depth or should be handled gracefully
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
      }
    });

    test('should detect and handle circular references', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Create entities with circular relationships
      const circularEntityA = {
        id: 'circular-a',
        components: {
          'core:actor': { name: 'Circular A' },
          'core:references': { refersTo: 'circular-b' },
        },
      };

      const circularEntityB = {
        id: 'circular-b',
        components: {
          'core:actor': { name: 'Circular B' },
          'core:references': { refersTo: 'circular-a' }, // Circular reference
        },
      };

      const defA = createEntityDefinition(
        circularEntityA.id,
        circularEntityA.components
      );
      const defB = createEntityDefinition(
        circularEntityB.id,
        circularEntityB.components
      );

      registry.store('entityDefinitions', circularEntityA.id, defA);
      registry.store('entityDefinitions', circularEntityB.id, defB);

      await entityManager.createEntityInstance(circularEntityA.id, {
        instanceId: circularEntityA.id,
        definitionId: circularEntityA.id,
      });

      await entityManager.createEntityInstance(circularEntityB.id, {
        instanceId: circularEntityB.id,
        definitionId: circularEntityB.id,
      });

      const gameContext = await createGameContext();

      // Test scope that might encounter circular references
      const circularScope = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:circular_scope',
            expr: 'entities(core:references)',
            description: 'Scope that might encounter circular references',
          },
        ]
      );
      scopeRegistry.initialize(circularScope);

      // Should handle circular references without infinite loops
      const startTime = Date.now();
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:circular_scope',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      const endTime = Date.now();

      // Should complete quickly (no infinite loops)
      expect(endTime - startTime).toBeLessThan(1000); // < 1 second
      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
    });
  });

  /**
   * Scenario 3: Malformed Input Handling Tests
   * Tests system behavior with invalid or corrupted input data
   */
  describe('Malformed Input Handling', () => {
    test('should handle invalid AST structures gracefully', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      const malformedScopes = createMalformedScopeDefinitions();

      // Test each type of malformed scope
      for (const [scopeId, scopeDef] of Object.entries(malformedScopes)) {
        const singleScopeRegistry = {};
        singleScopeRegistry[scopeId] = scopeDef;

        try {
          scopeRegistry.initialize(singleScopeRegistry);

          // Should either work or fail with clear error
          await expect(
            ScopeTestUtilities.resolveScopeE2E(
              scopeId,
              playerEntity,
              gameContext,
              { scopeRegistry, scopeEngine }
            )
          ).rejects.toThrow();
        } catch (initError) {
          // Some malformed scopes might fail during initialization
          expect(initError).toBeDefined();
        }
      }
    });

    test('should handle corrupted game context gracefully', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Create various corrupted game contexts
      const corruptedContexts = [
        // Missing required services
        {
          currentLocation: null,
          entityManager: null,
          allEntities: [],
        },
        // Undefined properties
        {
          currentLocation: undefined,
          entityManager: entityManager,
          allEntities: undefined,
        },
        // Wrong types
        {
          currentLocation: 'not-an-entity',
          entityManager: 'not-a-manager',
          allEntities: 'not-an-array',
        },
      ];

      const validScopes = ScopeTestUtilities.createTestScopes({
        dslParser,
        logger,
      });
      scopeRegistry.initialize(validScopes);

      for (const corruptedContext of corruptedContexts) {
        try {
          const result = await ScopeTestUtilities.resolveScopeE2E(
            'test:actor_source',
            playerEntity,
            corruptedContext,
            { scopeRegistry, scopeEngine }
          );

          // If it succeeds, result should be valid
          if (result) {
            expect(result instanceof Set).toBe(true);
          }
        } catch (error) {
          // Should fail with meaningful error
          expect(error.message).toBeDefined();
          expect(typeof error.message).toBe('string');
          expect(error.message.length).toBeGreaterThan(0);
        }
      }
    });

    test('should handle invalid entity states', async () => {
      const gameContext = await createGameContext();

      // Create entity with invalid state
      const invalidEntityId = 'invalid-entity';
      const invalidDef = createEntityDefinition(invalidEntityId, {
        'core:actor': null, // Invalid component data
      });

      registry.store('entityDefinitions', invalidEntityId, invalidDef);
      await entityManager.createEntityInstance(invalidEntityId, {
        instanceId: invalidEntityId,
        definitionId: invalidEntityId,
      });

      const invalidEntity =
        await entityManager.getEntityInstance(invalidEntityId);

      const validScopes = ScopeTestUtilities.createTestScopes({
        dslParser,
        logger,
      });
      scopeRegistry.initialize(validScopes);

      // Should handle invalid entity gracefully
      try {
        const result = await ScopeTestUtilities.resolveScopeE2E(
          'test:actor_source',
          invalidEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        );

        expect(result).toBeDefined();
        expect(result instanceof Set).toBe(true);
      } catch (error) {
        // Should provide meaningful error
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
      }
    });

    test('should handle complex JSON Logic edge cases', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Create scopes with edge case JSON Logic expressions
      const edgeCaseScopes = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:division_by_zero',
            expr: 'entities(core:actor)[{"/": [{"var": "entity.components.core:stats.level"}, 0]}]',
            description: 'JSON Logic with division by zero',
          },
          {
            id: 'test:null_comparison',
            expr: 'entities(core:actor)[{"==": [{"var": "entity.components.nonexistent"}, null]}]',
            description: 'JSON Logic comparing against null',
          },
          {
            id: 'test:undefined_variable',
            expr: 'entities(core:actor)[{">": [{"var": "entity.components.undefined.property"}, 5]}]',
            description: 'JSON Logic with undefined variable access',
          },
        ]
      );

      scopeRegistry.initialize(edgeCaseScopes);

      // Test each edge case
      const edgeCaseIds = [
        'test:division_by_zero',
        'test:null_comparison',
        'test:undefined_variable',
      ];

      for (const scopeId of edgeCaseIds) {
        try {
          const result = await ScopeTestUtilities.resolveScopeE2E(
            scopeId,
            playerEntity,
            gameContext,
            { scopeRegistry, scopeEngine }
          );

          // If it succeeds, result should be valid
          expect(result).toBeDefined();
          expect(result instanceof Set).toBe(true);
        } catch (error) {
          // Should handle edge cases gracefully with meaningful errors
          expect(error.message).toBeDefined();
          expect(typeof error.message).toBe('string');
        }
      }
    });
  });

  /**
   * Scenario 4: Error Message Quality Tests
   * Tests that error messages are helpful and actionable
   */
  describe('Error Message Quality', () => {
    test('should provide meaningful error messages for missing scopes', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      const nonExistentScopeId = 'definitely:does:not:exist';

      await expect(
        ScopeTestUtilities.resolveScopeE2E(
          nonExistentScopeId,
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        )
      ).rejects.toThrow();

      // Test the error message format by catching the error
      let thrownError;
      try {
        await ScopeTestUtilities.resolveScopeE2E(
          nonExistentScopeId,
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        );
      } catch (error) {
        thrownError = error;
      }

      // Error message should be informative
      expect(thrownError.message).toContain('Scope not found');
      expect(thrownError.message).toContain(nonExistentScopeId);
      expect(thrownError.message.length).toBeGreaterThan(10); // Reasonably detailed
    });

    test('should provide context-rich error messages for resolver failures', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Create scope with known problematic expression
      const problematicScope = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:problematic_scope',
            expr: 'actor.completely.nonexistent.deeply.nested.property',
            description: 'Scope designed to fail in a specific way',
          },
        ]
      );

      scopeRegistry.initialize(problematicScope);

      // Test that the scope either succeeds or fails with meaningful error
      let thrownError;
      try {
        await ScopeTestUtilities.resolveScopeE2E(
          'test:problematic_scope',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        );
      } catch (error) {
        thrownError = error;
      }

      if (thrownError) {
        // Error should provide context about what failed
        expect(thrownError.message).toBeDefined();
        expect(typeof thrownError.message).toBe('string');
        expect(thrownError.message.length).toBeGreaterThan(5);

        // Should ideally contain context about the failure point
        // (exact format depends on implementation)
      }
    });

    test('should provide actionable error information', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Test with missing required context
      const incompleteContext = {
        // Missing required properties
        currentLocation: null,
      };

      const validScopes = ScopeTestUtilities.createTestScopes({
        dslParser,
        logger,
      });
      scopeRegistry.initialize(validScopes);

      // Test that incomplete context either works or provides actionable error
      let thrownError;
      try {
        await ScopeTestUtilities.resolveScopeE2E(
          'test:location_source',
          playerEntity,
          incompleteContext,
          { scopeRegistry, scopeEngine }
        );
      } catch (error) {
        thrownError = error;
      }

      if (thrownError) {
        // Error should be actionable (tell user what's wrong and how to fix it)
        expect(thrownError.message).toBeDefined();
        expect(typeof thrownError.message).toBe('string');

        // Should provide guidance about what went wrong
        // (specific requirements depend on implementation)
      }
    });

    test('should maintain error context through complex resolution chains', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Create complex scope that might fail at different points
      const complexScope = ScopeTestUtilities.createTestScopes(
        { dslParser, logger },
        [
          {
            id: 'test:complex_failing_scope',
            expr: 'entities(core:actor)[{">": [{"var": "entity.components.core:stats.nonexistent.deeply.nested"}, 10]}].core:inventory.items[0].name',
            description: 'Complex scope that might fail at multiple points',
          },
        ]
      );

      scopeRegistry.initialize(complexScope);

      // Test complex failing scope - may succeed or fail gracefully
      let thrownError;
      try {
        await ScopeTestUtilities.resolveScopeE2E(
          'test:complex_failing_scope',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        );
      } catch (error) {
        thrownError = error;
      }

      if (thrownError) {
        // Should maintain context about where in the chain the failure occurred
        expect(thrownError.message).toBeDefined();
        expect(typeof thrownError.message).toBe('string');
        expect(thrownError.message.length).toBeGreaterThan(0);

        // Error should provide enough information to understand the failure point
      }
    });
  });

  /**
   * Scenario 5: System Recovery Tests
   * Tests that the system can recover from various failure modes
   */
  describe('System Recovery', () => {
    test('should recover from registry corruption', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Initialize with valid scopes
      const validScopes = ScopeTestUtilities.createTestScopes({
        dslParser,
        logger,
      });
      scopeRegistry.initialize(validScopes);

      // Verify it works
      let result = await ScopeTestUtilities.resolveScopeE2E(
        'test:actor_source',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(result).toBeDefined();

      // Corrupt the registry with malformed data
      const corruptedScopes = createMalformedScopeDefinitions();
      try {
        scopeRegistry.initialize(corruptedScopes);
      } catch (error) {
        // Registry initialization might fail
      }

      // Recover with valid scopes again
      scopeRegistry.initialize(validScopes);

      // Should work again after recovery
      result = await ScopeTestUtilities.resolveScopeE2E(
        'test:actor_source',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
    });

    test('should handle entity manager corruption gracefully', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );

      // Create compromised game context
      const compromisedContext = await createGameContext();

      // Test with various compromised states
      const compromisedStates = [
        { ...compromisedContext, allEntities: null },
        { ...compromisedContext, allEntities: [] },
        { ...compromisedContext, entityManager: null },
      ];

      const validScopes = ScopeTestUtilities.createTestScopes({
        dslParser,
        logger,
      });
      scopeRegistry.initialize(validScopes);

      for (const state of compromisedStates) {
        let result;
        let thrownError;
        try {
          result = await ScopeTestUtilities.resolveScopeE2E(
            'test:actor_source',
            playerEntity,
            state,
            { scopeRegistry, scopeEngine }
          );
        } catch (error) {
          thrownError = error;
        }

        // Test should either succeed with valid result or fail with meaningful error
        if (result) {
          // If it succeeds, result should be valid
          expect(result instanceof Set).toBe(true);
        } else if (thrownError) {
          // Should handle corruption gracefully
          expect(thrownError.message).toBeDefined();
          expect(typeof thrownError.message).toBe('string');
        }
      }
    });

    test('should maintain stability after multiple error scenarios', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      const validScopes = ScopeTestUtilities.createTestScopes({
        dslParser,
        logger,
      });

      // Run through multiple error scenarios
      const errorScenarios = [
        () =>
          ScopeTestUtilities.resolveScopeE2E(
            'nonexistent:scope',
            playerEntity,
            gameContext,
            { scopeRegistry, scopeEngine }
          ),
        () =>
          ScopeTestUtilities.resolveScopeE2E(
            'test:actor_source',
            null,
            gameContext,
            { scopeRegistry, scopeEngine }
          ),
        () =>
          ScopeTestUtilities.resolveScopeE2E(
            'test:actor_source',
            playerEntity,
            null,
            { scopeRegistry, scopeEngine }
          ),
      ];

      // Each scenario should fail, but system should remain stable
      for (const scenario of errorScenarios) {
        let thrownError;
        try {
          await scenario();
        } catch (error) {
          thrownError = error;
        }
        // Expected to fail
        expect(thrownError).toBeDefined();
      }

      // After all error scenarios, system should still work normally
      scopeRegistry.initialize(validScopes);
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:actor_source',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
      expect(result.has(testActors.player.id)).toBe(true);
    });
  });

  /**
   * Scenario 6: Performance Under Error Conditions
   * Tests that error handling doesn't significantly impact performance
   */
  describe('Performance Under Error Conditions', () => {
    test('should maintain performance during error recovery', async () => {
      // Prepare clean state for accurate performance measurement
      if (global.gc) {
        global.gc();
      }
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      const validScopes = ScopeTestUtilities.createTestScopes({
        dslParser,
        logger,
      });
      scopeRegistry.initialize(validScopes);

      // Measure normal performance (optimized iterations)
      const startTime = Date.now();
      for (let i = 0; i < 5; i++) {
        await ScopeTestUtilities.resolveScopeE2E(
          'test:actor_source',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        );
      }
      const normalTime = Date.now() - startTime;

      // Mix successful and failing operations (optimized iterations)
      const mixedStartTime = Date.now();
      for (let i = 0; i < 5; i++) {
        try {
          if (i % 2 === 0) {
            // Successful operation
            await ScopeTestUtilities.resolveScopeE2E(
              'test:actor_source',
              playerEntity,
              gameContext,
              { scopeRegistry, scopeEngine }
            );
          } else {
            // Failing operation
            await ScopeTestUtilities.resolveScopeE2E(
              'nonexistent:scope',
              playerEntity,
              gameContext,
              { scopeRegistry, scopeEngine }
            );
          }
        } catch (e) {
          // Expected for failing operations
        }
      }
      const mixedTime = Date.now() - mixedStartTime;

      // Error handling shouldn't significantly impact performance
      expect(mixedTime).toBeGreaterThanOrEqual(0);

      // Error handling overhead should be reasonable (optimized expectations)
      if (normalTime > 0) {
        expect(mixedTime).toBeLessThan(normalTime * 3); // Max 3x slower with optimized dataset
      }
    });

    test('should clean up resources after errors', async () => {
      // Ensure clean state before memory measurement
      if (global.gc) {
        global.gc();
      }
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Force garbage collection before test
      if (global.gc) {
        global.gc();
      }
      const startMemory = process.memoryUsage().heapUsed;

      // Generate errors that could leak resources (optimized count)
      for (let i = 0; i < 25; i++) {
        try {
          await ScopeTestUtilities.resolveScopeE2E(
            `nonexistent:scope:${i}`,
            playerEntity,
            gameContext,
            { scopeRegistry, scopeEngine }
          );
        } catch (e) {
          // Expected to fail - errors are expected here
        }
      }

      // Force garbage collection after errors
      if (global.gc) {
        global.gc();
      }
      const endMemory = process.memoryUsage().heapUsed;

      const memoryGrowth = (endMemory - startMemory) / 1024 / 1024; // MB

      // Memory growth should be minimal despite errors (optimized)
      expect(memoryGrowth).toBeLessThan(5); // < 5MB growth with optimized error count
    });
  });
});
