/**
 * @file Integration tests for the stop_following rule.
 * @see tests/integration/rules/stopFollowingRule.integration.test.js
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import Ajv from 'ajv';
import ruleSchema from '../../../data/schemas/rule.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import stopFollowingRule from '../../../data/mods/core/rules/stop_following.rule.json';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import RemoveComponentHandler from '../../../src/logic/operationHandlers/removeComponentHandler.js';
import ModifyArrayFieldHandler from '../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import QueryComponentOptionalHandler from '../../../src/logic/operationHandlers/queryComponentOptionalHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import IfCoLocatedHandler from '../../../src/logic/operationHandlers/ifCoLocatedHandler.js';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';

/**
 * Minimal in-memory entity manager used for integration tests.
 *
 * @class SimpleEntityManager
 * @description Provides just enough of IEntityManager for the tested handlers.
 */
class SimpleEntityManager {
  /**
   * Create the manager with the provided entities.
   *
   * @param {Array<{id:string,components:object}>} entities - seed entities
   */
  constructor(entities) {
    this.entities = new Map();
    for (const e of entities) {
      this.entities.set(e.id, {
        id: e.id,
        components: { ...e.components },
      });
    }
  }

  /**
   * Return an entity instance.
   *
   * @param {string} id - entity id
   * @returns {object|undefined} entity object
   */
  getEntityInstance(id) {
    return this.entities.get(id);
  }

  /**
   * Retrieve component data.
   *
   * @param {string} id - entity id
   * @param {string} type - component type
   * @returns {any} component data or null
   */
  getComponentData(id, type) {
    return this.entities.get(id)?.components[type] ?? null;
  }

  /**
   * Check if an entity has a component.
   *
   * @param {string} id - entity id
   * @param {string} type - component type
   * @returns {boolean} true if present
   */
  hasComponent(id, type) {
    return Object.prototype.hasOwnProperty.call(
      this.entities.get(id)?.components || {},
      type
    );
  }

  /**
   * Add or replace a component on an entity.
   *
   * @param {string} id - entity id
   * @param {string} type - component type
   * @param {object} data - component data
   */
  addComponent(id, type, data) {
    const ent = this.entities.get(id);
    if (ent) {
      ent.components[type] = JSON.parse(JSON.stringify(data));
    }
  }

  /**
   * Remove a component from an entity.
   *
   * @param {string} id - entity id
   * @param {string} type - component type
   */
  removeComponent(id, type) {
    const ent = this.entities.get(id);
    if (ent) {
      delete ent.components[type];
    }
  }
}

/**
 * Helper to (re)initialize the interpreter with a fresh entity manager.
 *
 * @param {Array<{id:string,components:object}>} entities - initial entities
 */
function init(entities) {
  operationRegistry = new OperationRegistry({ logger });
  entityManager = new SimpleEntityManager(entities);

  operationInterpreter = new OperationInterpreter({
    logger,
    operationRegistry,
  });

  const handlers = {
    REMOVE_COMPONENT: new RemoveComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    MODIFY_ARRAY_FIELD: new ModifyArrayFieldHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    QUERY_COMPONENT_OPTIONAL: new QueryComponentOptionalHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({ dispatcher: eventBus, logger }),
    IF_CO_LOCATED: new IfCoLocatedHandler({
      entityManager,
      logger,
      operationInterpreter,
      safeEventDispatcher: safeDispatcher,
    }),
  };

  for (const [type, handler] of Object.entries(handlers)) {
    operationRegistry.register(type, handler.execute.bind(handler));
  }

  jsonLogic = new JsonLogicEvaluationService({ logger });

  interpreter = new SystemLogicInterpreter({
    logger,
    eventBus,
    dataRegistry,
    jsonLogicEvaluationService: jsonLogic,
    entityManager,
    operationInterpreter,
  });

  listener = null;
  interpreter.initialize();
}

let logger;
let eventBus;
let dataRegistry;
let entityManager;
let operationRegistry;
let operationInterpreter;
let jsonLogic;
let interpreter;
let events;
let listener;
let safeDispatcher;

describe('core_handle_stop_following rule integration', () => {
  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    events = [];
    eventBus = {
      subscribe: jest.fn((ev, l) => {
        if (ev === '*') listener = l;
      }),
      unsubscribe: jest.fn(),
      dispatch: jest.fn((eventType, payload) => {
        events.push({ eventType, payload });
        return Promise.resolve();
      }),
      listenerCount: jest.fn().mockReturnValue(1),
    };

    safeDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };

    dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([stopFollowingRule]),
    };

    init([]);
  });

  it('validates stop_following.rule.json against schema', () => {
    const ajv = new Ajv({ allErrors: true });
    ajv.addSchema(
      commonSchema,
      'http://example.com/schemas/common.schema.json'
    );
    ajv.addSchema(
      operationSchema,
      'http://example.com/schemas/operation.schema.json'
    );
    ajv.addSchema(
      jsonLogicSchema,
      'http://example.com/schemas/json-logic.schema.json'
    );
    const valid = ajv.validate(ruleSchema, stopFollowingRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('removes following relationship and emits perceptible event when co-located', () => {
    interpreter.shutdown();
    init([
      {
        id: 'f1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
          [FOLLOWING_COMPONENT_ID]: { leaderId: 'l1' },
        },
      },
      {
        id: 'l1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Leader' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
          [LEADING_COMPONENT_ID]: { followers: ['f1'] },
        },
      },
    ]);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'f1',
        actionId: 'core:stop_following',
        targetId: 'l1',
      },
    });

    expect(
      entityManager.getComponentData('f1', FOLLOWING_COMPONENT_ID)
    ).toBeNull();
    expect(entityManager.getComponentData('l1', LEADING_COMPONENT_ID)).toEqual({
      followers: [],
    });
    const types = events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );

    const successEvent = events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Follower stops following Leader.'
    );
  });

  it('omits perceptible event when actor and leader are in different locations', () => {
    interpreter.shutdown();
    init([
      {
        id: 'f1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
          [FOLLOWING_COMPONENT_ID]: { leaderId: 'l1' },
        },
      },
      {
        id: 'l1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Leader' },
          [POSITION_COMPONENT_ID]: { locationId: 'locB' },
          [LEADING_COMPONENT_ID]: { followers: ['f1'] },
        },
      },
    ]);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'f1',
        actionId: 'core:stop_following',
        targetId: 'l1',
      },
    });

    expect(
      entityManager.getComponentData('f1', FOLLOWING_COMPONENT_ID)
    ).toBeNull();
    expect(entityManager.getComponentData('l1', LEADING_COMPONENT_ID)).toEqual({
      followers: [],
    });
    const types = events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
    expect(types).not.toContain('core:perceptible_event');

    const successEvent = events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Follower stops following Leader.'
    );
  });

  it('handles not-following branch with error event', () => {
    interpreter.shutdown();
    init([
      {
        id: 'f1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
        },
      },
    ]);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: { actorId: 'f1', actionId: 'core:stop_following' },
    });

    expect(
      entityManager.getComponentData('f1', FOLLOWING_COMPONENT_ID)
    ).toBeNull();
    const types = events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:display_failed_action_result',
        'core:turn_ended',
      ])
    );
  });
});
