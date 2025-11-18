/**
 * @file Lightweight test fixture optimized for performance testing
 * @description Provides minimal overhead infrastructure for measuring performance
 * without the heavy dependencies of full integration testing
 */

import { jest } from '@jest/globals';
import { createMockLogger } from '../mockFactories/index.js';

/**
 * Lightweight event bus for performance testing that can be cleared efficiently.
 */
class PerformanceEventBus {
  constructor() {
    this.events = [];
    this.listeners = new Map();
  }

  dispatch(eventType, payload) {
    const event = {
      type: eventType,
      payload,
      timestamp: Date.now(),
    };
    this.events.push(event);

    // Trigger any listeners (for compatibility)
    const listeners = this.listeners.get(eventType) || [];
    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        // Ignore listener errors in performance tests
      }
    });

    return Promise.resolve(true);
  }

  on(eventType, listener) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(listener);
  }

  clear() {
    this.events.length = 0;
  }

  get eventCount() {
    return this.events.length;
  }
}

/**
 * Minimal entity manager for performance testing.
 */
class PerformanceEntityManager {
  constructor() {
    this.entities = new Map();
  }

  createEntity(id, components = {}) {
    const entity = { id, components: { ...components } };
    this.entities.set(id, entity);
    return entity;
  }

  getEntityInstance(id) {
    return this.entities.get(id) || null;
  }

  hasComponent(entityId, componentId) {
    const entity = this.entities.get(entityId);
    return entity && entity.components && componentId in entity.components;
  }

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    return entity?.components?.[componentId] || null;
  }

  addComponent(entityId, componentId, data) {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.components[componentId] = data;
      return true;
    }
    return false;
  }

  removeEntity(entityId) {
    return this.entities.delete(entityId);
  }

  clear() {
    this.entities.clear();
  }

  get entityCount() {
    return this.entities.size;
  }

  getAllEntities() {
    return Array.from(this.entities.values());
  }
}

/**
 * Mock operation handlers optimized for performance.
 */
class PerformanceHandlers {
  constructor(entityManager, eventBus, logger) {
    this.entityManager = entityManager;
    this.eventBus = eventBus;
    this.logger = logger;
    this.executionCount = 0;
  }

  createHandlers() {
    return {
      GET_NAME: {
        execute: jest.fn(() => {
          this.executionCount++;
          return Promise.resolve('TestName');
        }),
      },
      LOG_MESSAGE: {
        execute: jest.fn((params) => {
          this.executionCount++;
          this.eventBus.dispatch('LOG_MESSAGE', {
            message: params.message || 'Test message',
            level: params.level || 'info',
          });
          return Promise.resolve(true);
        }),
      },
      ADD_COMPONENT: {
        execute: jest.fn((params) => {
          this.executionCount++;
          if (params.entityId && params.componentId) {
            this.entityManager.addComponent(
              params.entityId,
              params.componentId,
              params.componentData || {}
            );
            this.eventBus.dispatch('ADD_COMPONENT', {
              entityId: params.entityId,
              componentId: params.componentId,
            });
          }
          return Promise.resolve(true);
        }),
      },
      DISPATCH_EVENT: {
        execute: jest.fn((params) => {
          this.executionCount++;
          this.eventBus.dispatch(params.eventType, params.payload || {});
          return Promise.resolve(true);
        }),
      },
      END_TURN: {
        execute: jest.fn(() => {
          this.executionCount++;
          return Promise.resolve(true);
        }),
      },
    };
  }

  reset() {
    this.executionCount = 0;
  }
}

/**
 * Lightweight performance test fixture for infrastructure testing.
 *
 * This fixture eliminates heavy dependencies like SystemLogicInterpreter,
 * JsonLogicEvaluationService, ActionIndex, etc. and focuses on testing
 * the performance of basic infrastructure components.
 */
export class PerformanceTestFixture {
  constructor(options = {}) {
    this.options = options;
    this.eventBus = new PerformanceEventBus();
    this.entityManager = new PerformanceEntityManager();
    this.logger = createMockLogger();
    this.handlers = new PerformanceHandlers(
      this.entityManager,
      this.eventBus,
      this.logger
    );
    this.handlerRegistry = this.handlers.createHandlers();
    this.mockRules = [];
  }

  /**
   * Creates a mock rule that will execute the specified actions.
   *
   * @param ruleId
   * @param actions
   */
  createMockRule(ruleId, actions) {
    const rule = {
      rule_id: ruleId,
      event_type: 'core:attempt_action',
      actions: actions || [{ type: 'GET_NAME', parameters: {} }],
    };
    this.mockRules.push(rule);
    return rule;
  }

  /**
   * Creates standard actor-target entities for testing.
   *
   * @param names
   * @param options
   */
  createStandardActorTarget(names = ['Alice', 'Bob'], options = {}) {
    const [actorName, targetName] = names;

    const actor = this.entityManager.createEntity(
      `actor_${actorName.toLowerCase()}`,
      {
        'core:name': { name: actorName },
        'core:position': { locationId: 'room1' },
        ...(options.actorComponents || {}),
      }
    );

    const target = this.entityManager.createEntity(
      `target_${targetName.toLowerCase()}`,
      {
        'core:name': { name: targetName },
        'core:position': { locationId: 'room1' },
        ...(options.targetComponents || {}),
      }
    );

    return { actor, target };
  }

  /**
   * Creates multiple entities for large-scale testing.
   *
   * @param count
   * @param namePrefix
   * @param componentTemplate
   */
  createEntitySet(count, namePrefix = 'Entity', componentTemplate = {}) {
    const entities = [];
    for (let i = 0; i < count; i++) {
      const entity = this.entityManager.createEntity(
        `${namePrefix.toLowerCase()}_${i}`,
        {
          'core:name': { name: `${namePrefix}${i}` },
          'core:position': { locationId: 'room1' },
          ...componentTemplate,
        }
      );
      entities.push(entity);
    }
    return entities;
  }

  /**
   * Simulates action execution by directly calling handlers.
   * This bypasses the heavy rule engine for pure performance testing.
   *
   * @param actionId
   * @param actorId
   * @param targetId
   * @param ruleActions
   */
  async executeAction(actionId, actorId, targetId, ruleActions) {
    // Dispatch the initial attempt action event
    await this.eventBus.dispatch('core:attempt_action', {
      actionId,
      actorId,
      targetId: targetId || null,
      eventName: 'core:attempt_action',
    });

    // Execute the rule actions directly for performance testing
    const actions = ruleActions || [{ type: 'GET_NAME', parameters: {} }];

    for (const action of actions) {
      const handler = this.handlerRegistry[action.type];
      if (handler && handler.execute) {
        // Replace template variables for testing
        const params = { ...action.parameters };
        if (params.entityId === '{actorId}') {
          params.entityId = actorId;
        }
        if (params.message && params.message.includes('{')) {
          params.message = params.message.replace(/{actorId}/g, actorId);
        }

        await handler.execute(params);
      }
    }

    return true;
  }

  /**
   * Executes multiple actions in sequence for batch testing.
   *
   * @param actions
   */
  async executeBatchActions(actions) {
    const results = [];
    for (const actionData of actions) {
      const result = await this.executeAction(
        actionData.actionId,
        actionData.actorId,
        actionData.targetId,
        actionData.ruleActions
      );
      results.push(result);
    }
    return results;
  }

  /**
   * Clears all test state for clean measurements.
   */
  reset() {
    this.eventBus.clear();
    this.entityManager.clear();
    this.handlers.reset();
    this.mockRules.length = 0;
  }

  /**
   * Gets performance metrics for analysis.
   */
  getMetrics() {
    return {
      eventCount: this.eventBus.eventCount,
      entityCount: this.entityManager.entityCount,
      handlerExecutionCount: this.handlers.executionCount,
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Cleanup resources.
   */
  cleanup() {
    this.reset();
  }

  // Compatibility getters for existing test code
  get events() {
    return this.eventBus.events;
  }
}

/**
 * Creates a performance test fixture with commonly used mock configurations.
 *
 * @param options
 */
export function createPerformanceTestFixture(options = {}) {
  return new PerformanceTestFixture(options);
}

/**
 * Factory for creating standard performance test scenarios.
 */
export class PerformanceTestScenarios {
  /**
   * Creates a simple action execution scenario.
   *
   * @param fixture
   * @param actorName
   * @param targetName
   */
  static createSimpleActionScenario(
    fixture,
    actorName = 'Alice',
    targetName = 'Bob'
  ) {
    const { actor, target } = fixture.createStandardActorTarget([
      actorName,
      targetName,
    ]);
    const ruleActions = [{ type: 'GET_NAME', parameters: {} }];

    return {
      actor,
      target,
      ruleActions,
      execute: () =>
        fixture.executeAction(
          'test:simple_action',
          actor.id,
          target.id,
          ruleActions
        ),
    };
  }

  /**
   * Creates a complex action execution scenario with multiple operations.
   *
   * @param fixture
   * @param actorName
   * @param targetName
   */
  static createComplexActionScenario(
    fixture,
    actorName = 'Alice',
    targetName = 'Bob'
  ) {
    const { actor, target } = fixture.createStandardActorTarget([
      actorName,
      targetName,
    ]);
    const ruleActions = [
      { type: 'GET_NAME', parameters: {} },
      {
        type: 'LOG_MESSAGE',
        parameters: { message: 'Action executed', level: 'info' },
      },
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entityId: '{actorId}',
          componentId: 'test:action_result',
          componentData: { success: true },
        },
      },
      {
        type: 'DISPATCH_EVENT',
        parameters: {
          eventType: 'test:action_completed',
          payload: { actorId: '{actorId}' },
        },
      },
    ];

    return {
      actor,
      target,
      ruleActions,
      execute: () =>
        fixture.executeAction(
          'test:complex_action',
          actor.id,
          target.id,
          ruleActions
        ),
    };
  }

  /**
   * Creates a large event generation scenario for stress testing.
   *
   * @param fixture
   * @param eventCount
   */
  static createLargeEventScenario(fixture, eventCount = 20) {
    const { actor, target } = fixture.createStandardActorTarget();
    const ruleActions = Array.from({ length: eventCount }, (_, i) => ({
      type: 'LOG_MESSAGE',
      parameters: { message: `Event ${i}`, level: 'info' },
    }));

    return {
      actor,
      target,
      ruleActions,
      execute: () =>
        fixture.executeAction(
          'test:large_event_action',
          actor.id,
          target.id,
          ruleActions
        ),
    };
  }
}

export default PerformanceTestFixture;
