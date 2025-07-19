/**
 * @file End-to-end test for the complete action discovery workflow
 * @see tests/e2e/actions/ActionDiscoveryWorkflow.e2e.test.js
 *
 * This test suite covers the entire action discovery pipeline from entity
 * components through to formatted actions ready for UI display, including:
 * - Action index building and initialization
 * - Component-based action filtering
 * - Prerequisites evaluation with JSON Logic
 * - Target resolution using scope DSL
 * - Action formatting for display
 * - Turn-scoped caching behavior
 * - Multi-actor discovery differences
 * - Cross-mod action integration
 * - Error handling and tracing
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { AvailableActionsProvider } from '../../../src/data/providers/availableActionsProvider.js';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { DEFAULT_TEST_WORLD } from '../../common/constants.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import {
  createEntityDefinition,
  createEntityInstance,
} from '../../common/entities/entityFactories.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';

/**
 * E2E test suite for the complete action discovery workflow
 * Tests the entire pipeline from component-based filtering to formatted actions
 */
describe('Complete Action Discovery Workflow E2E', () => {
  let container;
  let entityManager;
  let actionDiscoveryService;
  let actionIndex;
  let availableActionsProvider;
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
    actionDiscoveryService = container.resolve(tokens.IActionDiscoveryService);
    actionIndex = container.resolve(tokens.ActionIndex);
    availableActionsProvider = container.resolve(
      tokens.IAvailableActionsProvider
    );

    // Set up test world and actors
    await setupTestWorld();
    testActors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry: container.resolve(tokens.IDataRegistry),
    });
    await setupTestActions();
  });

  afterEach(async () => {
    // Clean up resources
    if (container) {
      // Clean up any resources if needed
    }
  });

  /**
   * Creates a trace context for action discovery testing
   *
   * @returns {TraceContext} A new trace context instance
   */
  function createTraceContext() {
    return new TraceContext();
  }

  /**
   * Sets up test actions and builds the action index
   */
  async function setupTestActions() {
    // Create basic action definitions
    const testActions = [
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
        scope: 'core:clear_directions',
        template: 'go to {target}',
        prerequisites: [],
        required_components: {
          actor: ['core:position'],
        },
      },
      {
        id: 'core:follow',
        name: 'Follow',
        description: 'Follow another actor.',
        scope: 'core:other_actors',
        template: 'follow {target}',
        prerequisites: [],
        required_components: {
          actor: ['core:following'],
        },
      },
    ];

    // Add action definitions to the registry
    const registry = container.resolve(tokens.IDataRegistry);
    for (const action of testActions) {
      registry.store('actions', action.id, action);
    }

    // Add condition definitions to the registry
    const testConditions = [
      {
        id: 'core:actor-can-move',
        description:
          'Checks if the actor has functioning legs capable of movement',
        logic: {
          '==': [{ var: 'actor.core:movement.locked' }, false],
        },
      },
      {
        id: 'core:exit-is-unblocked',
        description: 'Checks if an exit is unblocked',
        logic: {
          '==': [{ var: 'blocked' }, false],
        },
      },
    ];

    for (const condition of testConditions) {
      registry.store('conditions', condition.id, condition);
    }

    // Add scope definitions for testing
    const scopeRegistry = container.resolve(tokens.IScopeRegistry);
    const dslParser = container.resolve(tokens.DslParser);

    // Parse the DSL expressions to get the ASTs
    const clearDirectionsExpr =
      'location.core:exits[{"condition_ref": "core:exit-is-unblocked"}].target';
    const otherActorsExpr =
      'entities(core:actor)[{ var: "id", neq: { var: "actor.id" } }]';

    let clearDirectionsAst, otherActorsAst;
    try {
      clearDirectionsAst = dslParser.parse(clearDirectionsExpr);
      otherActorsAst = dslParser.parse(otherActorsExpr);
    } catch (e) {
      console.error('Failed to parse scope DSL expression', e);
      // Use simple fallbacks for testing
      clearDirectionsAst = { type: 'Source', kind: 'location' };
      otherActorsAst = {
        type: 'Source',
        kind: 'entities',
        param: 'core:actor',
      };
    }

    // Add the scope definitions with ASTs
    const scopeDefinitions = {
      'core:clear_directions': {
        id: 'core:clear_directions',
        expr: clearDirectionsExpr,
        ast: clearDirectionsAst,
        description:
          'Available exits from current location that are not blocked',
      },
      'core:other_actors': {
        id: 'core:other_actors',
        expr: otherActorsExpr,
        ast: otherActorsAst,
        description: 'Other actors in the game (excluding the current actor)',
      },
    };

    // Initialize the scope registry with our scope definitions
    try {
      scopeRegistry.initialize(scopeDefinitions);
    } catch (e) {
      console.warn('Could not initialize scope registry', e);
    }

    // Build the action index
    const gameDataRepository = container.resolve(tokens.IGameDataRepository);
    const logger = container.resolve(tokens.ILogger);

    // Build action index with the test actions
    actionIndex.buildIndex(testActions);

    logger.debug(`Built action index with ${testActions.length} test actions`);
  }

  /**
   * Sets up test world with multiple locations and scope definitions
   */
  async function setupTestWorld() {
    testWorld = {
      locations: [
        {
          id: 'test-location-1',
          name: 'Test Room 1',
          description: 'A test room for action discovery',
          components: {
            'core:name': { name: 'Test Room 1' },
            'core:description': {
              description: 'A test room for action discovery',
            },
            'core:position': { x: 0, y: 0, z: 0 },
            'core:exits': {
              north: 'test-location-2',
              south: null,
              east: null,
              west: null,
            },
          },
        },
        {
          id: 'test-location-2',
          name: 'Test Room 2',
          description: 'Another test room',
          components: {
            'core:name': { name: 'Test Room 2' },
            'core:description': { description: 'Another test room' },
            'core:position': { x: 1, y: 0, z: 0 },
            'core:exits': {
              north: null,
              south: 'test-location-1',
              east: null,
              west: null,
            },
          },
        },
      ],
    };

    // Create location definitions and instances
    for (const location of testWorld.locations) {
      const definition = createEntityDefinition(
        location.id,
        location.components
      );
      // Add the definition to the registry
      const registry = container.resolve(tokens.IDataRegistry);
      registry.store('entityDefinitions', location.id, definition);

      // Create the entity instance
      await entityManager.createEntityInstance(location.id, {
        instanceId: location.id,
        definitionId: location.id,
      });
    }
  }

  /**
   * Sets up test actors with different component configurations
   */
  async function setupTestActors() {
    testActors = {
      // Standard player actor with full component set
      player: {
        id: 'test-player',
        components: {
          'core:name': { name: 'Test Player' },
          'core:position': { locationId: 'test-location-1' },
          'core:actor': { isPlayer: true },
          'core:closeness': { relationships: {} },
          'core:following': { following: null, followers: [] },
          'core:movement': { locked: false },
        },
      },
    };

    // This function is now handled in beforeEach using ActionTestUtilities
    // Keeping this function for any tests that might reference it directly
    return testActors;
  }

  /**
   * Test: Action index building and initialization
   * Verifies that the action index is properly built at startup
   */
  test('should build action index with component-based filtering', async () => {
    // Verify action index is initialized
    expect(actionIndex).toBeDefined();

    // Test action index has been built
    const playerEntity = await entityManager.getEntityInstance(
      testActors.player.id
    );
    const trace = createTraceContext();
    const candidateActions = await actionIndex.getCandidateActions(
      playerEntity,
      trace
    );

    // Should have actions available for player
    expect(candidateActions).toBeDefined();
    expect(Array.isArray(candidateActions)).toBe(true);
    expect(candidateActions.length).toBeGreaterThan(0);

    // Should include core actions like 'go' and 'wait'
    const actionIds = candidateActions.map((action) => action.id);
    expect(actionIds).toContain('core:go');
    expect(actionIds).toContain('core:wait');
  });

  /**
   * Test: Basic action discovery for standard actor
   * Verifies the complete discovery pipeline works end-to-end
   */
  test('should complete full action discovery pipeline for player', async () => {
    const playerEntity = await entityManager.getEntityInstance(
      testActors.player.id
    );
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-location-1'),
      allEntities: Array.from(entityManager.entities),
    };

    // Test complete discovery workflow
    const discoveredActions = await actionDiscoveryService.getValidActions(
      playerEntity,
      baseContext,
      { trace: true }
    );

    // Should return valid actions
    expect(discoveredActions).toBeDefined();
    expect(discoveredActions.actions).toBeDefined();
    expect(Array.isArray(discoveredActions.actions)).toBe(true);
    expect(discoveredActions.actions.length).toBeGreaterThan(0);

    // Should have tracing information
    expect(discoveredActions.trace).toBeDefined();
    expect(discoveredActions.trace.logs).toBeDefined();
    expect(discoveredActions.trace.logs.length).toBeGreaterThan(0);

    // Verify action structure
    const firstAction = discoveredActions.actions[0];
    expect(firstAction).toHaveProperty('id');
    expect(firstAction).toHaveProperty('name');
    expect(firstAction).toHaveProperty('command');
    expect(firstAction).toHaveProperty('params');
  });

  /**
   * Test: Component-based action filtering
   * Verifies actions are correctly filtered based on actor components
   */
  test('should filter actions based on actor components', async () => {
    const playerEntity = await entityManager.getEntityInstance(
      testActors.player.id
    );
    const minimalEntity = await entityManager.getEntityInstance(
      testActors.minimalActor.id
    );

    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-location-1'),
      allEntities: Array.from(entityManager.entities),
    };

    // Get actions for both actors
    const playerActions = await actionDiscoveryService.getValidActions(
      playerEntity,
      baseContext,
      { trace: true }
    );
    const minimalActions = await actionDiscoveryService.getValidActions(
      minimalEntity,
      baseContext,
      { trace: true }
    );

    // Player should have more actions due to more components
    expect(playerActions.actions.length).toBeGreaterThan(0);
    expect(minimalActions.actions.length).toBeGreaterThan(0);

    // Actions requiring following component should only be available to player
    const playerActionIds = playerActions.actions.map((a) => a.id);
    const minimalActionIds = minimalActions.actions.map((a) => a.id);

    // Player should have all actions (has required components)
    expect(playerActionIds).toContain('core:go');
    expect(playerActionIds).toContain('core:wait');

    // Minimal actor should only have actions that don't require components
    expect(minimalActionIds).toContain('core:wait');
    // Minimal actor shouldn't have 'core:go' since it lacks 'core:position' component
    expect(minimalActionIds).not.toContain('core:go');

    // Following-related actions should only be available to actors with following component
    const followingActions = playerActionIds.filter(
      (id) => id.includes('follow') || id.includes('dismiss')
    );
    const minimalFollowingActions = minimalActionIds.filter(
      (id) => id.includes('follow') || id.includes('dismiss')
    );

    // Player has following component, minimal actor doesn't
    if (followingActions.length > 0) {
      expect(minimalFollowingActions.length).toBeLessThanOrEqual(
        followingActions.length
      );
    }
  });

  /**
   * Test: Prerequisites evaluation with JSON Logic
   * Verifies that action prerequisites are properly evaluated
   */
  test('should evaluate action prerequisites correctly', async () => {
    const playerEntity = await entityManager.getEntityInstance(
      testActors.player.id
    );
    const followerEntity = await entityManager.getEntityInstance(
      testActors.follower.id
    );

    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-location-1'),
      allEntities: Array.from(entityManager.entities),
    };

    // Get actions for both actors
    const playerActions = await actionDiscoveryService.getValidActions(
      playerEntity,
      baseContext
    );
    const followerActions = await actionDiscoveryService.getValidActions(
      followerEntity,
      baseContext
    );

    // Both should have valid actions
    expect(playerActions.actions.length).toBeGreaterThan(0);
    expect(followerActions.actions.length).toBeGreaterThan(0);

    // Check for actions with different prerequisites
    const playerActionIds = playerActions.actions.map((a) => a.id);
    const followerActionIds = followerActions.actions.map((a) => a.id);

    // Stop following should only be available to followers
    if (followerActionIds.includes('core:stop_following')) {
      expect(playerActionIds).not.toContain('core:stop_following');
    }

    // Dismiss should only be available to entities with followers
    if (playerActionIds.includes('core:dismiss')) {
      expect(followerActionIds).not.toContain('core:dismiss');
    }
  });

  /**
   * Test: Target resolution using scope DSL
   * Verifies that actions are correctly resolved with separate actions per target
   */
  test('should resolve action targets using scope DSL', async () => {
    const playerEntity = await entityManager.getEntityInstance(
      testActors.player.id
    );
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-location-1'),
      allEntities: Array.from(entityManager.entities),
    };

    const discoveredActions = await actionDiscoveryService.getValidActions(
      playerEntity,
      baseContext
    );

    // Find actions for movement (like 'go' action)
    const goActions = discoveredActions.actions.filter(
      (a) => a.id === 'core:go'
    );
    if (goActions.length > 0) {
      goActions.forEach((action) => {
        expect(action).toHaveProperty('id');
        expect(action).toHaveProperty('params');
        expect(action.params).toHaveProperty('targetId');
        expect(typeof action.params.targetId).toBe('string');
      });
    }

    // Find actions with entity targets (like social actions)
    const socialActions = discoveredActions.actions.filter(
      (a) => a.id.includes('intimacy:') || a.id.includes('follow')
    );

    socialActions.forEach((action) => {
      expect(action).toHaveProperty('params');
      expect(action.params).toHaveProperty('targetId');
      if (action.params.targetId) {
        expect(typeof action.params.targetId).toBe('string');
      }
    });
  });

  /**
   * Test: Action formatting for display
   * Verifies that actions are properly formatted for UI display
   */
  test('should format actions for display correctly', async () => {
    const playerEntity = await entityManager.getEntityInstance(
      testActors.player.id
    );
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-location-1'),
      allEntities: Array.from(entityManager.entities),
    };

    const discoveredActions = await actionDiscoveryService.getValidActions(
      playerEntity,
      baseContext
    );

    // Verify all actions have proper formatting
    discoveredActions.actions.forEach((action) => {
      // Required fields
      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('name');
      expect(action).toHaveProperty('command');
      expect(action).toHaveProperty('params');

      // Fields should be strings
      expect(typeof action.id).toBe('string');
      expect(typeof action.name).toBe('string');
      expect(typeof action.command).toBe('string');
      expect(typeof action.params).toBe('object');

      // Command should be formatted (not contain placeholders)
      expect(action.command).not.toContain('{');
      expect(action.command).not.toContain('}');

      // Params should contain targetId for actions that have targets
      if (
        action.params.targetId !== null &&
        action.params.targetId !== undefined
      ) {
        expect(typeof action.params.targetId).toBe('string');
      }
    });
  });

  /**
   * Test: Turn-scoped caching behavior
   * Verifies that actions are cached within turn scope
   */
  test('should cache actions within turn scope', async () => {
    const playerEntity = await entityManager.getEntityInstance(
      testActors.player.id
    );
    const turnContext = {
      turnNumber: 1,
      currentActor: playerEntity,
    };

    // Get logger from container
    const logger = container.resolve(tokens.ILogger);

    // First call should populate cache
    const firstCall = await availableActionsProvider.get(
      playerEntity,
      turnContext,
      logger
    );

    expect(firstCall).toBeDefined();
    expect(Array.isArray(firstCall)).toBe(true);
    expect(firstCall.length).toBeGreaterThan(0);

    // Second call with same turn context should use cache
    const secondCall = await availableActionsProvider.get(
      playerEntity,
      turnContext,
      logger
    );

    expect(secondCall).toBeDefined();
    expect(secondCall.length).toBe(firstCall.length);

    // Results should be identical (from cache)
    expect(secondCall).toEqual(firstCall);

    // Different turn should bypass cache
    const newTurnContext = {
      turnNumber: 2,
      currentActor: playerEntity,
    };

    const thirdCall = await availableActionsProvider.get(
      playerEntity,
      newTurnContext,
      logger
    );

    expect(thirdCall).toBeDefined();
    expect(Array.isArray(thirdCall)).toBe(true);
  });

  /**
   * Test: Multi-actor discovery differences
   * Verifies that different actors get different action sets
   */
  test('should provide different actions for different actors', async () => {
    const playerEntity = await entityManager.getEntityInstance(
      testActors.player.id
    );
    const npcEntity = await entityManager.getEntityInstance(testActors.npc.id);
    const followerEntity = await entityManager.getEntityInstance(
      testActors.follower.id
    );

    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-location-1'),
      allEntities: Array.from(entityManager.entities),
    };

    // Get actions for all actors
    const playerActions = await actionDiscoveryService.getValidActions(
      playerEntity,
      baseContext
    );
    const npcActions = await actionDiscoveryService.getValidActions(
      npcEntity,
      baseContext
    );
    const followerActions = await actionDiscoveryService.getValidActions(
      followerEntity,
      baseContext
    );

    // All should have some actions
    expect(playerActions.actions.length).toBeGreaterThan(0);
    expect(npcActions.actions.length).toBeGreaterThan(0);
    expect(followerActions.actions.length).toBeGreaterThan(0);

    // Extract action IDs for comparison
    const playerActionIds = playerActions.actions.map((a) => a.id);
    const npcActionIds = npcActions.actions.map((a) => a.id);
    const followerActionIds = followerActions.actions.map((a) => a.id);

    // All should have basic actions
    [playerActionIds, npcActionIds, followerActionIds].forEach((actionIds) => {
      expect(actionIds).toContain('core:wait');
      expect(actionIds).toContain('core:go');
    });

    // Check for role-specific actions
    const hasFollowingActions = (actionIds) =>
      actionIds.some((id) => id.includes('follow') || id.includes('dismiss'));

    // Player and NPC might have different following-related actions
    // based on their current following state
    const playerHasFollowing = hasFollowingActions(playerActionIds);
    const npcHasFollowing = hasFollowingActions(npcActionIds);
    const followerHasFollowing = hasFollowingActions(followerActionIds);

    // At least one should have following actions
    expect(playerHasFollowing || npcHasFollowing || followerHasFollowing).toBe(
      true
    );
  });

  /**
   * Test: Error handling and tracing
   * Verifies proper error handling and trace collection
   */
  test('should handle errors and provide comprehensive tracing', async () => {
    const playerEntity = await entityManager.getEntityInstance(
      testActors.player.id
    );
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-location-1'),
      allEntities: Array.from(entityManager.entities),
    };

    // Test with tracing enabled
    const result = await actionDiscoveryService.getValidActions(
      playerEntity,
      baseContext,
      { trace: true }
    );

    // Should have tracing information
    expect(result.trace).toBeDefined();
    expect(result.trace.logs).toBeDefined();
    expect(Array.isArray(result.trace.logs)).toBe(true);

    // Should have at least some trace entries
    expect(result.trace.logs.length).toBeGreaterThan(0);

    // Trace entries should have proper structure
    result.trace.logs.forEach((entry) => {
      expect(entry).toHaveProperty('message');
      expect(typeof entry.message).toBe('string');
      expect(entry.message.length).toBeGreaterThan(0);
    });

    // Should have both valid actions and any errors
    expect(result.actions).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);

    if (result.errors) {
      expect(Array.isArray(result.errors)).toBe(true);
      result.errors.forEach((error) => {
        expect(error).toHaveProperty('actionId');
        expect(error).toHaveProperty('phase');
        expect(error).toHaveProperty('message');
      });
    }
  });

  /**
   * Test: Cross-mod action integration
   * Verifies that actions from different mods work together
   */
  test('should integrate actions across different mods', async () => {
    const playerEntity = await entityManager.getEntityInstance(
      testActors.player.id
    );
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-location-1'),
      allEntities: Array.from(entityManager.entities),
    };

    const discoveredActions = await actionDiscoveryService.getValidActions(
      playerEntity,
      baseContext
    );

    // Group actions by mod
    const actionsByMod = {};
    discoveredActions.actions.forEach((action) => {
      const [mod] = action.id.split(':');
      if (!actionsByMod[mod]) {
        actionsByMod[mod] = [];
      }
      actionsByMod[mod].push(action);
    });

    // Should have actions from core mod at minimum
    expect(actionsByMod.core).toBeDefined();
    expect(actionsByMod.core.length).toBeGreaterThan(0);

    // Check for actions from other mods if they exist
    const availableMods = Object.keys(actionsByMod);
    expect(availableMods).toContain('core');

    // Verify each mod's actions are properly formatted
    Object.entries(actionsByMod).forEach(([mod, actions]) => {
      actions.forEach((action) => {
        expect(action.id).toStartWith(`${mod}:`);
        expect(action.name).toBeDefined();
        expect(action.description).toBeDefined();
        expect(action.command).toBeDefined();
      });
    });
  });

  /**
   * Test: Performance and validation
   * Verifies discovery performance is within acceptable limits
   */
  test('should complete discovery within performance limits', async () => {
    const playerEntity = await entityManager.getEntityInstance(
      testActors.player.id
    );
    const baseContext = {
      currentLocation: await entityManager.getEntityInstance('test-location-1'),
      allEntities: Array.from(entityManager.entities),
    };

    // Measure discovery time
    const startTime = Date.now();
    const result = await actionDiscoveryService.getValidActions(
      playerEntity,
      baseContext
    );
    const endTime = Date.now();

    const discoveryTime = endTime - startTime;

    // Should complete within reasonable time (adjust threshold as needed)
    expect(discoveryTime).toBeLessThan(5000); // 5 seconds max

    // Should return valid results
    expect(result.actions).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);
    expect(result.actions.length).toBeGreaterThan(0);

    // Test multiple discoveries for caching performance
    const cacheStartTime = Date.now();
    await actionDiscoveryService.getValidActions(playerEntity, baseContext);
    await actionDiscoveryService.getValidActions(playerEntity, baseContext);
    await actionDiscoveryService.getValidActions(playerEntity, baseContext);
    const cacheEndTime = Date.now();

    const cacheTime = cacheEndTime - cacheStartTime;

    // Multiple calls should be faster due to caching (allow more tolerance)
    // Cache time should be reasonable (under 100ms for 3 cached calls)
    expect(cacheTime).toBeLessThan(100);
  });
});
