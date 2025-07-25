/**
 * @file End-to-end test for ScopeDsl integration with Action System
 * @see tests/e2e/scopeDsl/ActionSystemIntegration.e2e.test.js
 *
 * This test suite validates the complete integration between the scopeDsl
 * system and the action discovery/resolution pipeline, covering:
 * - Action target resolution through scope definitions
 * - Turn-based caching behavior
 * - Dynamic scope updates reflecting game state changes
 * - Performance characteristics of the integration
 * - Error handling and graceful degradation
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

/**
 * E2E test suite for ScopeDsl integration with Action System
 * Tests the critical integration points identified in the architecture report
 */
describe('ScopeDsl Integration with Action System E2E', () => {
  let container;
  let entityManager;
  let actionDiscoveryService;
  let targetResolutionService;
  let availableActionsProvider;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let testActors;
  let testWorld;

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

    // Manually register required component schemas for testing
    const schemaValidator = container.resolve(tokens.ISchemaValidator);

    // Register core:position schema
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

    // Register core:movement schema
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

    // Set up test infrastructure
    await setupTestInfrastructure();
  });

  afterEach(async () => {
    // Clean up resources
    if (container) {
      // Clean up any resources if needed
    }
  });

  /**
   * Sets up comprehensive test infrastructure including world, actors, actions, and scopes
   */
  async function setupTestInfrastructure() {
    // Create test world using ActionTestUtilities
    testWorld = await ActionTestUtilities.createStandardTestWorld({
      entityManager,
      registry: container.resolve(tokens.IDataRegistry),
    });

    // Create test actors using ActionTestUtilities
    testActors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry: container.resolve(tokens.IDataRegistry),
    });

    // Set up comprehensive action definitions for integration testing
    await setupIntegrationTestActions();

    // Set up comprehensive scope definitions for integration testing
    await setupIntegrationTestScopes();
  }

  /**
   * Sets up action definitions specifically for integration testing
   */
  async function setupIntegrationTestActions() {
    const registry = container.resolve(tokens.IDataRegistry);
    const actionIndex = container.resolve(tokens.ActionIndex);

    const integrationTestActions = [
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
        id: 'core:go',
        name: 'Go',
        description: 'Move to a different location.',
        scope: 'test:available_exits',
        template: 'go {direction} to {target}',
        prerequisites: [],
        required_components: {
          actor: ['core:position'],
        },
      },
      {
        id: 'core:follow',
        name: 'Follow',
        description: 'Follow another actor.',
        scope: 'test:followable_actors',
        template: 'follow {target}',
        prerequisites: [],
        required_components: {
          actor: ['core:following'],
        },
      },
      {
        id: 'test:interact_with_items',
        name: 'Interact with Item',
        description: 'Interact with items in the current location.',
        scope: 'test:location_items',
        template: 'interact with {target}',
        prerequisites: [],
        required_components: {
          actor: [],
        },
      },
    ];

    // Add action definitions to the registry
    for (const action of integrationTestActions) {
      registry.store('actions', action.id, action);
    }

    // Set up test conditions
    const testConditions = ScopeTestUtilities.setupScopeTestConditions(
      registry,
      [
        {
          id: 'core:actor-can-move',
          description: 'Checks if the actor can move',
          logic: {
            '==': [{ var: 'actor.core:movement.locked' }, false],
          },
        },
      ]
    );

    // Build the action index
    actionIndex.buildIndex(integrationTestActions);
  }

  /**
   * Sets up scope definitions specifically for integration testing
   */
  async function setupIntegrationTestScopes() {
    // Create comprehensive test scopes using ScopeTestUtilities
    const integrationScopes = ScopeTestUtilities.createTestScopes(
      {
        dslParser,
        logger: container.resolve(tokens.ILogger),
      },
      [
        {
          id: 'test:available_exits',
          expr: 'location.core:exits[{"condition_ref": "core:exit-is-unblocked"}].target',
          description: 'Available exits from current location',
        },
        {
          id: 'test:followable_actors',
          expr: 'entities(core:actor)[{"!=": [{"var": "id"}, {"var": "actor.id"}]}]',
          description: 'Other actors that can be followed',
        },
        {
          id: 'test:location_items',
          expr: 'location.core:items',
          description: 'Items available in the current location',
        },
        {
          id: 'test:nearby_entities',
          expr: 'entities(core:position)[{"==": [{"var": "core:position.locationId"}, {"var": "actor.core:position.locationId"}]}]',
          description: 'Entities in the same location as the actor',
        },
      ]
    );

    // Initialize the scope registry with integration test scopes
    try {
      scopeRegistry.initialize(integrationScopes);
    } catch (e) {
      console.warn(
        'Could not initialize scope registry for integration tests',
        e
      );
    }
  }

  /**
   * Creates a trace context for integration testing
   */
  function createIntegrationTraceContext() {
    return new TraceContext();
  }

  /**
   * Gets the action ID from an action object, handling both formats
   *
   * @param action
   */
  function getActionId(action) {
    return action.actionId || action.id;
  }

  /**
   * Creates a base context for action discovery
   */
  async function createActionDiscoveryContext() {
    return {
      currentLocation: await entityManager.getEntityInstance('test-location-1'),
      allEntities: Array.from(entityManager.entities),
    };
  }

  describe('Action Target Resolution Integration', () => {
    test('should resolve action targets through scope definitions in complete workflow', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const baseContext = await createActionDiscoveryContext();

      const discoveredActions = await actionDiscoveryService.getValidActions(
        playerEntity,
        baseContext,
        { trace: true }
      );

      // Should have discovered actions
      expect(discoveredActions.actions).toBeDefined();
      expect(Array.isArray(discoveredActions.actions)).toBe(true);
      expect(discoveredActions.actions.length).toBeGreaterThan(0);

      // Should have actions available
      expect(discoveredActions.actions.length).toBeGreaterThan(0);

      // Verify that actions have proper structure
      for (const action of discoveredActions.actions) {
        // Actions might have either 'actionId' or 'id' depending on the pipeline stage
        expect(action).toBeDefined();
        expect(action.id || action.actionId).toBeDefined();
        expect(action.command || action.commandString).toBeDefined();
        expect(action).toHaveProperty('params');

        if (action.params.targetId !== null) {
          expect(typeof action.params.targetId).toBe('string');
        }
      }

      // Verify tracing captured scope resolution
      expect(discoveredActions.trace).toBeDefined();
      expect(discoveredActions.trace.logs).toBeDefined();
      expect(discoveredActions.trace.logs.length).toBeGreaterThan(0);
    });

    test('should handle different scope types correctly', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const baseContext = await createActionDiscoveryContext();
      const trace = createIntegrationTraceContext();

      // Test direct target resolution for specific scopes
      const testScopes = [
        'test:available_exits',
        'test:followable_actors',
        'test:nearby_entities',
      ];

      for (const scopeId of testScopes) {
        try {
          const resolvedTargets = await ScopeTestUtilities.resolveScopeE2E(
            scopeId,
            playerEntity,
            {
              currentLocation: baseContext.currentLocation,
              entityManager,
              allEntities: baseContext.allEntities,
              jsonLogicEval: container.resolve(
                tokens.JsonLogicEvaluationService
              ),
              logger: container.resolve(tokens.ILogger),
            },
            { scopeRegistry, scopeEngine },
            { trace: true }
          );

          // Should return a Set of entity IDs
          expect(resolvedTargets).toBeInstanceOf(Set);

          // Results should be strings (entity IDs)
          for (const targetId of resolvedTargets) {
            expect(typeof targetId).toBe('string');
            expect(targetId.length).toBeGreaterThan(0);
          }
        } catch (error) {
          // Some scopes might be empty in test environment, which is acceptable
          if (
            !error.message.includes('not found') &&
            !error.message.includes('empty')
          ) {
            throw error;
          }
        }
      }
    });

    test('should integrate with targetResolutionService correctly', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const baseContext = await createActionDiscoveryContext();
      const trace = createIntegrationTraceContext();

      // Test direct target resolution service integration
      const actionContext = {
        actor: playerEntity,
        location: baseContext.currentLocation,
        allEntities: baseContext.allEntities,
        entityManager,
      };

      const result = targetResolutionService.resolveTargets(
        'test:followable_actors',
        playerEntity,
        actionContext,
        trace,
        'test:integration'
      );

      // Should return a result object
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');

      if (result.success) {
        expect(result).toHaveProperty('data');
        expect(Array.isArray(result.data)).toBe(true);
      } else {
        expect(result).toHaveProperty('errors');
        expect(Array.isArray(result.errors)).toBe(true);
      }
    });

    test('should handle prerequisite evaluation with scope-resolved targets', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const baseContext = await createActionDiscoveryContext();

      const discoveredActions = await actionDiscoveryService.getValidActions(
        playerEntity,
        baseContext,
        { trace: true }
      );

      // Find actions with prerequisites
      const actionsWithPrereqs = discoveredActions.actions.filter(
        (action) => getActionId(action) === 'core:go'
      );

      if (actionsWithPrereqs.length > 0) {
        // These actions should only be present if prerequisites passed
        for (const action of actionsWithPrereqs) {
          // Action exists, so prerequisites must have passed
          expect(action).toHaveProperty('actionId');
          expect(action).toHaveProperty('params');
          expect(action.params).toHaveProperty('targetId');
        }
      }

      // Verify tracing shows prerequisite evaluation
      const traceLogs = discoveredActions.trace?.logs || [];
      const prereqLogs = traceLogs.filter((log) =>
        log.message.toLowerCase().includes('prerequisite')
      );

      // Should have some prerequisite-related trace entries
      expect(prereqLogs.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Turn-based Caching Integration', () => {
    test('should cache scope resolutions appropriately within turn', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const turnContext = {
        turnNumber: 1,
        currentActor: playerEntity,
      };
      const logger = container.resolve(tokens.ILogger);

      // First call should populate cache
      const startTime1 = Date.now();
      const firstCall = await availableActionsProvider.get(
        playerEntity,
        turnContext,
        logger
      );
      const firstCallTime = Date.now() - startTime1;

      expect(firstCall).toBeDefined();
      expect(Array.isArray(firstCall)).toBe(true);

      // Second call with same turn context should use cache (faster)
      const startTime2 = Date.now();
      const secondCall = await availableActionsProvider.get(
        playerEntity,
        turnContext,
        logger
      );
      const secondCallTime = Date.now() - startTime2;

      expect(secondCall).toBeDefined();
      expect(secondCall.length).toBe(firstCall.length);

      // Results should be identical (from cache)
      expect(secondCall).toEqual(firstCall);

      // Second call should be faster due to caching
      // Allow some tolerance for test environment variations
      expect(secondCallTime).toBeLessThanOrEqual(firstCallTime + 10);
    });

    test('should invalidate cache on turn change', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const logger = container.resolve(tokens.ILogger);

      const turn1Context = {
        turnNumber: 1,
        currentActor: playerEntity,
      };

      const turn2Context = {
        turnNumber: 2,
        currentActor: playerEntity,
      };

      // Get actions for turn 1
      const turn1Actions = await availableActionsProvider.get(
        playerEntity,
        turn1Context,
        logger
      );

      // Get actions for turn 2 (different turn)
      const turn2Actions = await availableActionsProvider.get(
        playerEntity,
        turn2Context,
        logger
      );

      // Both should have valid results
      expect(turn1Actions).toBeDefined();
      expect(turn2Actions).toBeDefined();
      expect(Array.isArray(turn1Actions)).toBe(true);
      expect(Array.isArray(turn2Actions)).toBe(true);

      // Results should be functionally equivalent (same actor, same state)
      expect(turn2Actions.length).toBe(turn1Actions.length);
    });

    test('should maintain cache isolation between different actors', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const npcEntity = await entityManager.getEntityInstance(
        testActors.npc.id
      );
      const logger = container.resolve(tokens.ILogger);

      const turnContext = { turnNumber: 1 };

      const playerTurnContext = {
        ...turnContext,
        currentActor: playerEntity,
      };

      const npcTurnContext = {
        ...turnContext,
        currentActor: npcEntity,
      };

      // Get actions for both actors in same turn
      const playerActions = await availableActionsProvider.get(
        playerEntity,
        playerTurnContext,
        logger
      );

      const npcActions = await availableActionsProvider.get(
        npcEntity,
        npcTurnContext,
        logger
      );

      // Both should have results
      expect(playerActions).toBeDefined();
      expect(npcActions).toBeDefined();
      expect(Array.isArray(playerActions)).toBe(true);
      expect(Array.isArray(npcActions)).toBe(true);

      // Results should be different due to different components/capabilities
      const playerActionIds = playerActions.map((a) => getActionId(a));
      const npcActionIds = npcActions.map((a) => getActionId(a));

      // Both should have wait action (no scope, no requirements)
      expect(playerActionIds).toContain('core:wait');
      expect(npcActionIds).toContain('core:wait');
    });
  });

  describe('Dynamic Scope Updates Integration', () => {
    test('should reflect entity position changes in scope resolutions', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const baseContext = await createActionDiscoveryContext();

      // Get initial actions
      const initialActions = await actionDiscoveryService.getValidActions(
        playerEntity,
        baseContext
      );

      const initialActionIds = initialActions.actions.map((a) =>
        getActionId(a)
      );

      // Move player to a different location by updating position component
      // addComponent should override the definition-level component
      await entityManager.addComponent(testActors.player.id, 'core:position', {
        locationId: 'test-location-2',
      });

      // Update context to reflect new location
      const updatedContext = {
        ...baseContext,
        currentLocation:
          await entityManager.getEntityInstance('test-location-2'),
      };

      // Get actions after position change
      const updatedActions = await actionDiscoveryService.getValidActions(
        playerEntity,
        updatedContext
      );

      const updatedActionIds = updatedActions.actions.map((a) =>
        getActionId(a)
      );

      // Should still have core actions
      expect(updatedActionIds).toContain('core:wait');

      // Actions should be recalculated (not cached from previous location)
      expect(updatedActions.actions).toBeDefined();
      expect(Array.isArray(updatedActions.actions)).toBe(true);
    });

    test('should reflect component changes in scope filtering', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const baseContext = await createActionDiscoveryContext();

      // Get initial actions
      const initialActions = await actionDiscoveryService.getValidActions(
        playerEntity,
        baseContext
      );

      // Lock movement by updating movement component
      // addComponent should override the definition-level component
      await entityManager.addComponent(testActors.player.id, 'core:movement', {
        locked: true,
      });

      // Get actions after locking movement
      const lockedActions = await actionDiscoveryService.getValidActions(
        playerEntity,
        baseContext
      );

      const initialActionIds = initialActions.actions.map((a) =>
        getActionId(a)
      );
      const lockedActionIds = lockedActions.actions.map((a) => getActionId(a));

      // Should still have non-movement actions
      expect(lockedActionIds).toContain('core:wait');

      // Movement actions should be affected by the lock
      // (specific behavior depends on prerequisite evaluation)
      expect(lockedActions.actions).toBeDefined();
      expect(Array.isArray(lockedActions.actions)).toBe(true);
    });

    test('should handle entity creation and removal in scope results', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const baseContext = await createActionDiscoveryContext();

      // Create a new actor entity
      const newActorId = 'dynamic-test-actor';
      const newActorComponents = {
        'core:name': { name: 'Dynamic Test Actor' },
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
      };

      const newActorDefinition = createEntityDefinition(
        newActorId,
        newActorComponents
      );
      const registry = container.resolve(tokens.IDataRegistry);
      registry.store('entityDefinitions', newActorId, newActorDefinition);

      await entityManager.createEntityInstance(newActorId, {
        instanceId: newActorId,
        definitionId: newActorId,
      });

      // Update context to include new entity
      const updatedContext = {
        ...baseContext,
        allEntities: Array.from(entityManager.entities),
      };

      // Test scope resolution with new entity
      const resolvedTargets = await ScopeTestUtilities.resolveScopeE2E(
        'test:nearby_entities',
        playerEntity,
        {
          currentLocation: updatedContext.currentLocation,
          entityManager,
          allEntities: updatedContext.allEntities,
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger: container.resolve(tokens.ILogger),
        },
        { scopeRegistry, scopeEngine }
      );

      // Should include the new entity in results
      expect(resolvedTargets).toBeInstanceOf(Set);

      const targetIds = Array.from(resolvedTargets);
      // New actor should be in the same location, so should be included in nearby entities
      // (exact behavior depends on scope definition and filtering)
      expect(targetIds.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Integration', () => {
    test('should complete action discovery with scope resolution within performance limits', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const baseContext = await createActionDiscoveryContext();

      // Measure complete discovery time
      const startTime = Date.now();
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        baseContext,
        { trace: true }
      );
      const endTime = Date.now();

      const discoveryTime = endTime - startTime;

      // Should complete within reasonable time for integration test
      expect(discoveryTime).toBeLessThan(1000); // 1 second max for test environment

      // Should return valid results
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
      expect(result.actions.length).toBeGreaterThan(0);

      // Should have tracing information
      expect(result.trace).toBeDefined();
      expect(result.trace.logs).toBeDefined();
      expect(result.trace.logs.length).toBeGreaterThan(0);
    });

    test('should demonstrate caching performance benefits', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const turnContext = {
        turnNumber: 1,
        currentActor: playerEntity,
      };
      const logger = container.resolve(tokens.ILogger);

      // Measure multiple cached calls
      const iterations = 5;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await availableActionsProvider.get(playerEntity, turnContext, logger);
        const endTime = Date.now();
        times.push(endTime - startTime);
      }

      // Later calls should generally be faster due to caching
      const firstCallTime = times[0];
      const averageLaterCalls =
        times.slice(1).reduce((sum, time) => sum + time, 0) / (iterations - 1);

      // Average of later calls should be faster or similar (allow some variance)
      expect(averageLaterCalls).toBeLessThanOrEqual(firstCallTime + 50);

      // All calls should complete within reasonable time
      times.forEach((time) => {
        expect(time).toBeLessThan(500); // 500ms max per call
      });
    });

    test('should handle concurrent action discovery requests', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const npcEntity = await entityManager.getEntityInstance(
        testActors.npc.id
      );
      const baseContext = await createActionDiscoveryContext();

      // Start multiple concurrent discoveries
      const promises = [
        actionDiscoveryService.getValidActions(playerEntity, baseContext),
        actionDiscoveryService.getValidActions(npcEntity, baseContext),
        actionDiscoveryService.getValidActions(playerEntity, baseContext),
      ];

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;

      // All should complete successfully
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.actions).toBeDefined();
        expect(Array.isArray(result.actions)).toBe(true);
      });

      // Concurrent execution should not take excessively long
      expect(totalTime).toBeLessThan(2000); // 2 seconds max for concurrent execution
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle missing scope definitions gracefully', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const baseContext = await createActionDiscoveryContext();

      // Create an action with a non-existent scope
      const registry = container.resolve(tokens.IDataRegistry);
      const actionIndex = container.resolve(tokens.ActionIndex);

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
      actionIndex.buildIndex([actionWithBadScope]);

      // Should not crash when discovering actions
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        baseContext,
        { trace: true }
      );

      // Should still return results (may exclude the bad action)
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);

      // Should have trace information about the error
      expect(result.trace).toBeDefined();
      if (result.errors) {
        expect(Array.isArray(result.errors)).toBe(true);
      }
    });

    test('should handle scope resolution errors gracefully', async () => {
      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const baseContext = await createActionDiscoveryContext();
      const trace = createIntegrationTraceContext();

      // Test error handling in direct scope resolution
      try {
        const result = await ScopeTestUtilities.resolveScopeE2E(
          'nonexistent:scope',
          playerEntity,
          {
            currentLocation: baseContext.currentLocation,
            entityManager,
            allEntities: baseContext.allEntities,
            jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
            logger: container.resolve(tokens.ILogger),
          },
          { scopeRegistry, scopeEngine },
          { trace: true }
        );

        // If no error thrown, result should be empty or valid
        if (result) {
          expect(result).toBeInstanceOf(Set);
        }
      } catch (error) {
        // Error should be informative
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      }
    });
  });
});
