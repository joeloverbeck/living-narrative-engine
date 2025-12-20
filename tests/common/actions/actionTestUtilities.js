/**
 * @file Test utilities for action system E2E tests
 * @description Provides shared utilities to reduce duplication in action tests
 */

import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import { createEntityDefinition } from '../entities/entityFactories.js';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

/**
 * Shared test utilities for action system E2E tests
 *
 * Provides standardized methods for:
 * - Setting up test worlds with locations
 * - Creating test actors with standard components
 * - Registering test actions and conditions
 * - Building action indexes
 * - Creating trace contexts
 */
export class ActionTestUtilities {
  /**
   * Creates a standard test world with connected locations
   *
   * @param {object} dependencies - Required services
   * @param {object} dependencies.entityManager - Entity manager service
   * @param {object} dependencies.registry - Data registry service
   * @returns {Promise<object>} Test world configuration with location data
   */
  static async createStandardTestWorld({ entityManager, registry }) {
    const testWorld = {
      locations: [
        {
          id: 'test-location-1',
          name: 'Test Room 1',
          description: 'First test room',
          components: {
            'core:name': { name: 'Test Room 1' },
            'core:description': { description: 'First test room' },
            'core:position': { x: 0, y: 0, z: 0 },
            'locations:exits': {
              north: { target: 'test-location-2', blocked: false },
              south: { target: null, blocked: false },
              east: { target: null, blocked: false },
              west: { target: null, blocked: false },
            },
          },
        },
        {
          id: 'test-location-2',
          name: 'Test Room 2',
          description: 'Second test room',
          components: {
            'core:name': { name: 'Test Room 2' },
            'core:description': { description: 'Second test room' },
            'core:position': { x: 1, y: 0, z: 0 },
            'locations:exits': {
              north: { target: null, blocked: false },
              south: { target: 'test-location-1', blocked: false },
              east: { target: 'test-location-3', blocked: false },
              west: { target: null, blocked: false },
            },
          },
        },
        {
          id: 'test-location-3',
          name: 'Test Room 3',
          description: 'Third test room',
          components: {
            'core:name': { name: 'Test Room 3' },
            'core:description': { description: 'Third test room' },
            'core:position': { x: 2, y: 0, z: 0 },
            'locations:exits': {
              north: { target: null, blocked: false },
              south: { target: null, blocked: false },
              east: { target: null, blocked: false },
              west: { target: 'test-location-2', blocked: false },
            },
          },
        },
      ],
    };

    // Store location definitions synchronously (fast)
    for (const location of testWorld.locations) {
      const definition = createEntityDefinition(
        location.id,
        location.components
      );
      registry.store('entityDefinitions', location.id, definition);
    }

    // Create entity instances in parallel for better performance
    await Promise.all(
      testWorld.locations.map((location) =>
        entityManager.createEntityInstance(location.id, {
          instanceId: location.id,
          definitionId: location.id,
        })
      )
    );

    // Add currentLocation property that tests expect
    testWorld.currentLocation =
      entityManager.getEntityInstance('test-location-1');

    return testWorld;
  }

  /**
   * Creates standard test actors with different component configurations
   *
   * @param {object} dependencies - Required services
   * @param {object} dependencies.entityManager - Entity manager service
   * @param {object} dependencies.registry - Data registry service
   * @returns {Promise<object>} Test actors data
   */
  static async createTestActors({ entityManager, registry }) {
    const testActors = {
      // Standard player actor with full component set
      player: {
        id: 'test-player',
        components: {
          'core:name': { name: 'Test Player' },
          'core:position': { locationId: 'test-location-1' },
          'core:actor': { isPlayer: true },
          'core:movement': { locked: false },
          [FOLLOWING_COMPONENT_ID]: { targetId: null },
          'core:health': { current: 100, max: 100 },
        },
      },
      // NPC with limited components
      npc: {
        id: 'test-npc',
        components: {
          'core:name': { name: 'Test NPC' },
          'core:position': { locationId: 'test-location-1' },
          'core:actor': { isPlayer: false },
          'core:movement': { locked: false },
          'core:health': { current: 80, max: 100 },
        },
      },
      // Actor with movement locked (for testing prerequisites)
      lockedActor: {
        id: 'test-locked-actor',
        components: {
          'core:name': { name: 'Locked Actor' },
          'core:position': { locationId: 'test-location-2' },
          'core:actor': { isPlayer: false },
          'core:movement': { locked: true },
        },
      },
      // Actor without required components (for testing filtering)
      minimalActor: {
        id: 'test-minimal-actor',
        components: {
          'core:name': { name: 'Minimal Actor' },
          'core:actor': { isPlayer: false },
        },
      },
      // Actor currently following another actor (for testing follow mechanics)
      follower: {
        id: 'test-follower',
        components: {
          'core:name': { name: 'Test Follower' },
          'core:position': { locationId: 'test-location-1' },
          'core:actor': { isPlayer: false },
          'core:movement': { locked: false },
          [FOLLOWING_COMPONENT_ID]: { targetId: 'test-player' },
          'core:health': { current: 90, max: 100 },
        },
      },
    };

    // Store actor definitions synchronously (fast)
    for (const [key, actor] of Object.entries(testActors)) {
      const definition = createEntityDefinition(actor.id, actor.components);
      registry.store('entityDefinitions', actor.id, definition);
    }

    // Create actor instances in parallel for better performance
    await Promise.all(
      Object.values(testActors).map((actor) =>
        entityManager.createEntityInstance(actor.id, {
          instanceId: actor.id,
          definitionId: actor.id,
        })
      )
    );

    return testActors;
  }

  /**
   * Sets up and builds the action index with test actions
   *
   * @param {object} dependencies - Required services
   * @param {object} dependencies.registry - Data registry service
   * @param {object} dependencies.actionIndex - Action index service
   * @param {Array} [additionalActions] - Additional actions to register
   * @returns {Promise<void>}
   */
  static async setupActionIndex(
    { registry, actionIndex },
    additionalActions = []
  ) {
    const basicActions = [
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
        id: 'movement:go',
        name: 'Go',
        description: 'Move to a different location.',
        scope: 'movement:clear_directions',
        template: 'go to {target}',
        prerequisites: ['anatomy:actor-can-move'],
        required_components: {
          actor: ['core:position'],
        },
      },
      {
        id: 'companionship:follow',
        name: 'Follow',
        description: 'Follow another actor.',
        scope: 'core:other_actors',
        template: 'follow {target}',
        prerequisites: ['anatomy:actor-can-move'],
        required_components: {
          actor: [FOLLOWING_COMPONENT_ID, 'core:position'],
        },
      },
      {
        id: 'core:attack',
        name: 'Attack',
        description: 'Attack a target.',
        scope: 'core:nearby_actors',
        template: 'attack {target}',
        prerequisites: ['anatomy:actor-can-move'],
        required_components: {
          actor: ['core:position', 'core:health'],
        },
      },
    ];

    const allActions = [...basicActions, ...additionalActions];

    // Add action definitions to the registry
    for (const action of allActions) {
      registry.store('actions', action.id, action);
    }

    // Build action index
    actionIndex.buildIndex(allActions);
  }

  /**
   * Creates a new trace context for action discovery
   *
   * @returns {TraceContext} A new trace context instance
   */
  static createTraceContext() {
    return new TraceContext();
  }

  /**
   * Sets up test actions in the registry
   *
   * @param {object} registry - Data registry service
   * @param {Array} [additionalActions] - Additional actions to register
   * @returns {Array} All registered actions
   */
  static setupTestActions(registry, additionalActions = []) {
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
        id: 'movement:go',
        name: 'Go',
        description: 'Move to a different location.',
        scope: 'movement:clear_directions',
        template: 'go to {target}',
        prerequisites: ['anatomy:actor-can-move'],
        required_components: {
          actor: ['core:position'],
        },
      },
      {
        id: 'companionship:follow',
        name: 'Follow',
        description: 'Follow another actor.',
        scope: 'core:other_actors',
        template: 'follow {target}',
        prerequisites: ['anatomy:actor-can-move'],
        required_components: {
          actor: [FOLLOWING_COMPONENT_ID, 'core:position'],
        },
      },
    ];

    const allActions = [...testActions, ...additionalActions];

    // Add action definitions to the registry
    for (const action of allActions) {
      registry.store('actions', action.id, action);
    }

    return allActions;
  }

  /**
   * Sets up test conditions in the registry
   *
   * @param {object} registry - Data registry service
   * @param {Array} [additionalConditions] - Additional conditions to register
   * @returns {Array} All registered conditions
   */
  static setupTestConditions(registry, additionalConditions = []) {
    const testConditions = [
      {
        id: 'anatomy:actor-can-move',
        description:
          'Checks if the actor has functioning legs capable of movement',
        logic: {
          '==': [{ var: 'actor.core:movement.locked' }, false],
        },
      },
      {
        id: 'movement:exit-is-unblocked',
        description: 'Checks if an exit is unblocked',
        logic: {
          '==': [{ var: 'blocked' }, false],
        },
      },
      {
        id: 'core:has-health',
        description: 'Checks if the actor has health component',
        logic: {
          has: [{ var: 'actor' }, 'core:health'],
        },
      },
    ];

    const allConditions = [...testConditions, ...additionalConditions];

    for (const condition of allConditions) {
      registry.store('conditions', condition.id, condition);
    }

    return allConditions;
  }

  /**
   * Sets up scope definitions with parsed ASTs
   *
   * @param {object} dependencies - Required services
   * @param {object} dependencies.scopeRegistry - Scope registry service
   * @param {object} dependencies.dslParser - DSL parser service
   * @param {object} dependencies.logger - Logger service
   * @param {Array} [additionalScopes] - Additional scope definitions
   * @returns {object} Scope definitions with ASTs
   */
  static setupScopeDefinitions(
    { scopeRegistry, dslParser, logger },
    additionalScopes = []
  ) {
    // Base scope expressions
    const baseScopes = [
      {
        id: 'movement:clear_directions',
        expr: 'location.locations:exits[{"condition_ref": "movement:exit-is-unblocked"}].target',
        description:
          'Available exits from current location that are not blocked',
      },
      {
        id: 'core:other_actors',
        expr: 'entities(core:actor)[{ var: "id", neq: { var: "actor.id" } }]',
        description: 'Other actors in the game (excluding the current actor)',
      },
      {
        id: 'core:nearby_actors',
        expr: 'entities(core:actor)[{ var: "core:position.locationId", eq: { var: "actor.core:position.locationId" } }][{ var: "id", neq: { var: "actor.id" } }]',
        description: 'Other actors in the same location',
      },
    ];

    const allScopes = [...baseScopes, ...additionalScopes];
    const scopeDefinitions = {};

    // Parse each scope's DSL expression
    for (const scope of allScopes) {
      let ast;
      try {
        ast = dslParser.parse(scope.expr);
      } catch (e) {
        logger.warn(`Failed to parse scope DSL expression: ${scope.id}`, e);
        // Use a simple fallback AST
        ast = { type: 'Source', kind: 'none' };
      }

      scopeDefinitions[scope.id] = {
        id: scope.id,
        expr: scope.expr,
        ast: ast,
        description: scope.description,
      };
    }

    // Initialize the scope registry
    try {
      scopeRegistry.initialize(scopeDefinitions);
    } catch (e) {
      logger.warn('Could not initialize scope registry', e);
    }

    return scopeDefinitions;
  }
}

export default ActionTestUtilities;
