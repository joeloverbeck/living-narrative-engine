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
import { ActionTestUtilities } from '../../../common/actions/actionTestUtilities.js';
import { TestDataFactory } from '../../../common/actions/testDataFactory.js';

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
   * Create a test world with locations and exits using shared utilities
   */
  async createTestWorld() {
    return await ActionTestUtilities.createStandardTestWorld({
      entityManager: this.entityManager,
      registry: this.registry,
    });
  }

  /**
   * Create a test world with additional entities (objects, items)
   */
  async createCompleteTestWorld() {
    const worldData = TestDataFactory.createTestWorld();
    const registry = this.container.resolve(tokens.IDataRegistry);

    // Create all entities (locations, objects, items)
    const allEntities = [
      ...worldData.locations,
      ...worldData.objects,
      ...worldData.items,
    ];

    for (const entity of allEntities) {
      const definition = createEntityDefinition(entity.id, entity.components);
      registry.store('entityDefinitions', entity.id, definition);

      await this.entityManager.createEntityInstance(entity.id, {
        instanceId: entity.id,
        definitionId: entity.id,
      });
    }

    return worldData;
  }

  /**
   * Create test actors with various configurations using shared utilities
   */
  async createTestActors() {
    return await ActionTestUtilities.createTestActors({
      entityManager: this.entityManager,
      registry: this.registry,
    });
  }

  /**
   * Create test actors with custom configurations
   *
   * @param actorConfigs
   */
  async createCustomTestActors(actorConfigs) {
    const registry = this.container.resolve(tokens.IDataRegistry);

    for (const actor of Object.values(actorConfigs)) {
      const definition = createEntityDefinition(actor.id, actor.components);
      registry.store('entityDefinitions', actor.id, definition);

      await this.entityManager.createEntityInstance(actor.id, {
        instanceId: actor.id,
        definitionId: actor.id,
      });
    }

    return actorConfigs;
  }

  /**
   * Register test actions and supporting data using shared utilities
   */
  async registerTestActions() {
    // Set up actions
    const actions = ActionTestUtilities.setupTestActions(this.registry);

    // Set up conditions
    const conditions = ActionTestUtilities.setupTestConditions(this.registry);

    // Set up scope definitions
    const scopes = ActionTestUtilities.setupScopeDefinitions({
      scopeRegistry: this.scopeRegistry,
      dslParser: this.dslParser,
      logger: this.logger,
    });

    // Build the action index
    const actionIndex = this.container.resolve(tokens.ActionIndex);
    actionIndex.buildIndex(actions);
    this.logger.debug(`Built action index with ${actions.length} test actions`);

    return { actions, conditions, scopes };
  }

  /**
   * Register comprehensive test data including edge cases
   */
  async registerComprehensiveTestData() {
    const dataset = TestDataFactory.createCompleteTestDataset();

    // Register all actions
    const allActions = [
      ...dataset.actions.basic,
      ...dataset.actions.comprehensive,
    ];

    for (const action of allActions) {
      this.registry.store('actions', action.id, action);
    }

    // Register all conditions
    const allConditions = [...dataset.conditions.basic];

    for (const condition of allConditions) {
      this.registry.store('conditions', condition.id, condition);
    }

    // Set up scope definitions
    const scopeDefinitions = {};
    for (const scope of dataset.scopes.basic) {
      let ast;
      try {
        ast = this.dslParser.parse(scope.expr);
      } catch (e) {
        this.logger.warn(`Failed to parse scope DSL: ${scope.id}`, e);
        ast = scope.fallbackAst;
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
      this.scopeRegistry.initialize(scopeDefinitions);
    } catch (e) {
      this.logger.warn('Could not initialize scope registry', e);
    }

    // Build the action index
    const actionIndex = this.container.resolve(tokens.ActionIndex);
    actionIndex.buildIndex(allActions);
    this.logger.debug(
      `Built comprehensive action index with ${allActions.length} actions`
    );

    return {
      actions: allActions,
      conditions: allConditions,
      scopes: scopeDefinitions,
    };
  }

  /**
   * Register edge case test data for error scenario testing
   */
  async registerEdgeCaseTestData() {
    const dataset = TestDataFactory.createCompleteTestDataset();

    // Register edge case actions
    const edgeCaseActions = dataset.actions.edgeCase;
    for (const action of edgeCaseActions) {
      this.registry.store('actions', action.id, action);
    }

    // Register edge case conditions
    const edgeCaseConditions = dataset.conditions.edgeCase;
    for (const condition of edgeCaseConditions) {
      this.registry.store('conditions', condition.id, condition);
    }

    // Set up edge case scope definitions
    const scopeDefinitions = {};
    for (const scope of dataset.scopes.edgeCase) {
      let ast;
      try {
        ast = this.dslParser.parse(scope.expr);
      } catch (e) {
        // Expected for edge case testing
        ast = scope.fallbackAst;
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
      this.scopeRegistry.initialize(scopeDefinitions);
    } catch (e) {
      // Expected for edge case testing
      this.logger.warn(
        'Could not initialize scope registry (expected for edge cases)',
        e
      );
    }

    return {
      actions: edgeCaseActions,
      conditions: edgeCaseConditions,
      scopes: scopeDefinitions,
    };
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
   * Create a trace context for action discovery
   */
  createTraceContext() {
    return ActionTestUtilities.createTraceContext();
  }

  /**
   * Performance measurement utilities
   *
   * @param actorId
   * @param turnAction
   * @param iterations
   */
  async measureActionPerformance(actorId, turnAction, iterations = 1) {
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const result = await this.executeAction(actorId, turnAction);
      const endTime = performance.now();

      results.push({
        iteration: i + 1,
        executionTime: endTime - startTime,
        success: result.success,
        result: result,
      });
    }

    return {
      results,
      averageTime:
        results.reduce((sum, r) => sum + r.executionTime, 0) / results.length,
      minTime: Math.min(...results.map((r) => r.executionTime)),
      maxTime: Math.max(...results.map((r) => r.executionTime)),
      successRate: results.filter((r) => r.success).length / results.length,
    };
  }

  /**
   * Specialized assertion helpers for action testing
   *
   * @param result
   * @param expectedActionId
   */
  assertActionExecutionSuccess(result, expectedActionId) {
    if (!result) {
      throw new Error('Action execution result is undefined');
    }

    if (!result.success) {
      throw new Error(
        `Action execution failed: ${result.failureMessage || result.internalError || 'Unknown error'}`
      );
    }

    if (
      expectedActionId &&
      result.actionResult?.actionId !== expectedActionId
    ) {
      throw new Error(
        `Expected action ID ${expectedActionId}, got ${result.actionResult?.actionId}`
      );
    }
  }

  assertEventWasDispatched(eventType, expectedPayload = null) {
    const events = this.getEventsByType(eventType);
    if (events.length === 0) {
      throw new Error(`Expected event ${eventType} was not dispatched`);
    }

    if (expectedPayload) {
      const lastEvent = events[events.length - 1];
      for (const [key, value] of Object.entries(expectedPayload)) {
        if (lastEvent.payload[key] !== value) {
          throw new Error(
            `Event payload mismatch: expected ${key}=${value}, got ${lastEvent.payload[key]}`
          );
        }
      }
    }
  }

  assertPerformanceWithinLimits(performanceResult, maxAverageTime = 100) {
    if (performanceResult.averageTime > maxAverageTime) {
      throw new Error(
        `Performance test failed: average time ${performanceResult.averageTime}ms exceeds limit ${maxAverageTime}ms`
      );
    }
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
