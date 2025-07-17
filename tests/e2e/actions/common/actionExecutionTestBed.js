/**
 * @file actionExecutionTestBed.js
 * @description Test bed for action execution E2E tests
 *
 * Provides a comprehensive test environment for testing the complete action
 * execution pipeline from UI selection through game state updates.
 */

import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../../src/dependencyInjection/containerConfig.js';
import { createEntityDefinition } from '../../../common/entities/entityFactories.js';
import { DEFAULT_TEST_WORLD } from '../../../common/constants.js';

/**
 * Test bed for action execution pipeline testing
 *
 * Provides utilities for:
 * - Setting up test environment with full container
 * - Creating test world and actors
 * - Simulating UI action selection
 * - Monitoring event flow and state changes
 * - Asserting execution results
 */
export class ActionExecutionTestBed {
  constructor() {
    this.container = null;
    this.entityManager = null;
    this.commandProcessor = null;
    this.eventBus = null;
    this.turnManager = null;
    this.logger = null;
    this.registry = null;
    this.scopeRegistry = null;
    this.dslParser = null;
    this.events = [];
    this.stateChanges = [];
    this.eventSubscription = null;
    this.componentAddedSubscription = null;
    this.componentRemovedSubscription = null;
  }

  /**
   * Initialize the test bed with all required services
   */
  async initialize() {
    // Create and configure container
    this.container = new AppContainer();
    configureContainer(this.container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Resolve core services
    this.entityManager = this.container.resolve(tokens.IEntityManager);
    this.commandProcessor = this.container.resolve(tokens.ICommandProcessor);
    this.eventBus = this.container.resolve(tokens.IEventBus);
    this.turnManager = this.container.resolve(tokens.ITurnManager);
    this.logger = this.container.resolve(tokens.ILogger);
    this.registry = this.container.resolve(tokens.IDataRegistry);
    this.scopeRegistry = this.container.resolve(tokens.IScopeRegistry);
    this.dslParser = this.container.resolve(tokens.DslParser);

    // Set up event monitoring
    this.setupEventMonitoring();

    // Set up component change monitoring
    this.setupComponentChangeMonitoring();
  }

  /**
   * Clean up resources after tests
   */
  async cleanup() {
    if (this.eventSubscription) {
      // The subscription is a function that unsubscribes when called
      this.eventSubscription();
    }
    if (this.componentAddedSubscription) {
      this.componentAddedSubscription();
    }
    if (this.componentRemovedSubscription) {
      this.componentRemovedSubscription();
    }
    this.events = [];
    this.stateChanges = [];
  }

  /**
   * Set up monitoring of all events dispatched through the system
   */
  setupEventMonitoring() {
    this.eventSubscription = this.eventBus.subscribe('*', (event) => {
      this.events.push({
        timestamp: Date.now(),
        type: event.type,
        payload: event.payload,
      });
    });
  }

  /**
   * Set up monitoring of component changes
   */
  setupComponentChangeMonitoring() {
    // Monitor component changes through entity events
    this.componentAddedSubscription = this.eventBus.subscribe(
      'core:component_added',
      (event) => {
        this.stateChanges.push({
          type: 'component_added',
          entityId: event.payload.entity.id,
          componentId: event.payload.componentTypeId,
          data: event.payload.componentData,
          timestamp: Date.now(),
        });
      }
    );

    this.componentRemovedSubscription = this.eventBus.subscribe(
      'core:component_removed',
      (event) => {
        this.stateChanges.push({
          type: 'component_removed',
          entityId: event.payload.entity.id,
          componentId: event.payload.componentTypeId,
          timestamp: Date.now(),
        });
      }
    );
  }

  /**
   * Create a test world with locations and exits
   */
  async createTestWorld() {
    const locations = [
      {
        id: 'test-location-1',
        name: 'Test Room 1',
        description: 'First test room',
        components: {
          'core:name': { name: 'Test Room 1' },
          'core:description': { description: 'First test room' },
          'core:position': { x: 0, y: 0, z: 0 },
          'core:exits': {
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
          'core:exits': {
            north: { target: null, blocked: false },
            south: { target: 'test-location-1', blocked: false },
            east: { target: null, blocked: false },
            west: { target: null, blocked: false },
          },
        },
      },
    ];

    const registry = this.container.resolve(tokens.IDataRegistry);

    for (const location of locations) {
      const definition = createEntityDefinition(
        location.id,
        location.components
      );
      registry.store('entityDefinitions', location.id, definition);

      await this.entityManager.createEntityInstance(location.id, {
        instanceId: location.id,
        definitionId: location.id,
      });
    }

    return locations;
  }

  /**
   * Create test actors with various configurations
   */
  async createTestActors() {
    const actors = {
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
      npc: {
        id: 'test-npc',
        components: {
          'core:name': { name: 'Test NPC' },
          'core:position': { locationId: 'test-location-1' },
          'core:actor': { isPlayer: false },
          'core:closeness': { relationships: {} },
          'core:following': { following: null, followers: [] },
          'core:movement': { locked: false },
        },
      },
      follower: {
        id: 'test-follower',
        components: {
          'core:name': { name: 'Test Follower' },
          'core:position': { locationId: 'test-location-1' },
          'core:actor': { isPlayer: false },
          'core:following': { following: 'test-player', followers: [] },
          'core:movement': { locked: false },
        },
      },
    };

    const registry = this.container.resolve(tokens.IDataRegistry);

    for (const actor of Object.values(actors)) {
      const definition = createEntityDefinition(actor.id, actor.components);
      registry.store('entityDefinitions', actor.id, definition);

      await this.entityManager.createEntityInstance(actor.id, {
        instanceId: actor.id,
        definitionId: actor.id,
      });
    }

    return actors;
  }

  /**
   * Register test actions and supporting data
   */
  async registerTestActions() {
    // Register basic actions
    const actions = [
      {
        id: 'core:wait',
        name: 'Wait',
        description: 'Wait for a moment',
        scope: 'none',
        template: 'wait',
        prerequisites: [],
        required_components: { actor: [] },
      },
      {
        id: 'core:go',
        name: 'Go',
        description: 'Move to another location',
        scope: 'core:clear_directions',
        template: 'go to {target}',
        prerequisites: [],
        required_components: { actor: ['core:position'] },
      },
      {
        id: 'core:follow',
        name: 'Follow',
        description: 'Follow another actor',
        scope: 'core:other_actors',
        template: 'follow {target}',
        prerequisites: [],
        required_components: { actor: ['core:following'] },
      },
    ];

    for (const action of actions) {
      this.registry.store('actions', action.id, action);
    }

    // Build the action index with the registered actions
    const actionIndex = this.container.resolve(tokens.ActionIndex);
    actionIndex.buildIndex(actions);
    this.logger.debug(`Built action index with ${actions.length} test actions`);

    // Register conditions
    const conditions = [
      {
        id: 'core:actor-can-move',
        description: 'Actor can move',
        logic: { '==': [{ var: 'actor.core:movement.locked' }, false] },
      },
    ];

    for (const condition of conditions) {
      this.registry.store('conditions', condition.id, condition);
    }

    // Register scope definitions
    const clearDirectionsExpr =
      'location.core:exits[{"condition_ref": "core:exit-is-unblocked"}].target';
    const otherActorsExpr =
      'entities(core:actor)[{ var: "id", neq: { var: "actor.id" } }]';

    let clearDirectionsAst, otherActorsAst;
    try {
      clearDirectionsAst = this.dslParser.parse(clearDirectionsExpr);
      otherActorsAst = this.dslParser.parse(otherActorsExpr);
    } catch (e) {
      // Use simple fallbacks for testing
      clearDirectionsAst = { type: 'Source', kind: 'location' };
      otherActorsAst = {
        type: 'Source',
        kind: 'entities',
        param: 'core:actor',
      };
    }

    const scopeDefinitions = {
      'core:clear_directions': {
        id: 'core:clear_directions',
        expr: clearDirectionsExpr,
        ast: clearDirectionsAst,
        description: 'Available exits from current location',
      },
      'core:other_actors': {
        id: 'core:other_actors',
        expr: otherActorsExpr,
        ast: otherActorsAst,
        description: 'Other actors in the game',
      },
    };

    // Initialize the scope registry
    try {
      this.scopeRegistry.initialize(scopeDefinitions);
    } catch (e) {
      this.logger.warn('Could not initialize scope registry', e);
    }

    return { actions, conditions };
  }

  /**
   * Create a turn action as if selected from UI
   *
   * @param actionId
   * @param targetId
   * @param commandString
   */
  createTurnAction(actionId, targetId = null, commandString = null) {
    return {
      actionDefinitionId: actionId,
      resolvedParameters: targetId ? { targetId } : {},
      commandString: commandString || actionId,
    };
  }

  /**
   * Execute an action through the command processor
   *
   * @param actorId
   * @param turnAction
   */
  async executeAction(actorId, turnAction) {
    const actor = await this.entityManager.getEntityInstance(actorId);
    if (!actor) {
      throw new Error(`Actor ${actorId} not found`);
    }

    return await this.commandProcessor.dispatchAction(actor, turnAction);
  }

  /**
   * Get current turn context
   */
  getCurrentTurnContext() {
    return this.turnManager.getCurrentTurnContext();
  }

  /**
   * Wait for a specific event to be dispatched
   *
   * @param eventType
   * @param timeout
   */
  async waitForEvent(eventType, timeout = 1000) {
    return new Promise((resolve, reject) => {
      const subscription = this.eventBus.subscribe(eventType, (event) => {
        this.eventBus.unsubscribe(subscription);
        resolve(event);
      });

      setTimeout(() => {
        this.eventBus.unsubscribe(subscription);
        reject(new Error(`Timeout waiting for event ${eventType}`));
      }, timeout);
    });
  }

  /**
   * Get all events of a specific type
   *
   * @param eventType
   */
  getEventsByType(eventType) {
    return this.events.filter((e) => e.type === eventType);
  }

  /**
   * Get the most recent event of a specific type
   *
   * @param eventType
   */
  getLastEventOfType(eventType) {
    const events = this.getEventsByType(eventType);
    return events[events.length - 1];
  }

  /**
   * Get component changes for a specific entity
   *
   * @param entityId
   */
  getComponentChangesForEntity(entityId) {
    return this.stateChanges.filter((change) => change.entityId === entityId);
  }

  /**
   * Clear recorded events and state changes
   */
  clearRecordedData() {
    this.events = [];
    this.stateChanges = [];
  }

  /**
   * Get entity by ID
   *
   * @param entityId
   */
  async getEntity(entityId) {
    return await this.entityManager.getEntityInstance(entityId);
  }

  /**
   * Get component data for an entity
   *
   * @param entityId
   * @param componentId
   */
  async getEntityComponent(entityId, componentId) {
    const entity = await this.getEntity(entityId);
    if (!entity) return null;

    // Use the entity's getComponentData method
    if (typeof entity.getComponentData === 'function') {
      return entity.getComponentData(componentId);
    }

    // Fallback for different entity structures
    const components = entity.components || entity._components;
    if (components && components.has) {
      return components.has(componentId) ? components.get(componentId) : null;
    }

    return entity[componentId] || null;
  }
}

export default ActionExecutionTestBed;
