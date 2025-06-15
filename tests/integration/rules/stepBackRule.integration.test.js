/**
 * @file Integration tests for the intimacy step_back rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import Ajv from 'ajv';
import ruleSchema from '../../../data/schemas/rule.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import stepBackRule from '../../../data/mods/intimacy/rules/step_back.rule.json';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import ModifyArrayFieldHandler from '../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';
import RemoveComponentHandler from '../../../src/logic/operationHandlers/removeComponentHandler.js';
import ModifyComponentHandler from '../../../src/logic/operationHandlers/modifyComponentHandler.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import { buildABCDWorld } from '../fixtures/intimacyFixtures.js';

/**
 * Minimal in-memory entity manager used for integration tests.
 * Provides just enough of IEntityManager for the tested handlers.
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
   * Determine if an entity has a component.
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
      return true;
    }
    return false;
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
      return true;
    }
    return false;
  }
}

/**
 * Helper to (re)initialize the interpreter with the provided entities.
 *
 * @param {Array<{id:string,components:object}>} entities - initial entities
 */
function init(entities) {
  operationRegistry = new OperationRegistry({ logger });
  entityManager = new SimpleEntityManager(entities);

  const handlers = {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    MODIFY_ARRAY_FIELD: new ModifyArrayFieldHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    REMOVE_COMPONENT: new RemoveComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    MODIFY_COMPONENT: new ModifyComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      addPerceptionLogEntryHandler: { execute: jest.fn() },
    }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({ dispatcher: eventBus, logger }),
  };

  for (const [type, handler] of Object.entries(handlers)) {
    operationRegistry.register(type, handler.execute.bind(handler));
  }

  operationInterpreter = new OperationInterpreter({
    logger,
    operationRegistry,
  });

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

describe('intimacy_handle_step_back rule integration', () => {
  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    events = [];
    safeDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
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

    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(stepBackRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });
    dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...stepBackRule, actions: expanded }]),
    };

    init([]);
  });

  it('validates step_back.rule.json against schema', () => {
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
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(stepBackRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });
    const sanitized = expanded.map((a) => {
      if (
        a.type === 'DISPATCH_PERCEPTIBLE_EVENT' &&
        a.parameters.perception_type === '{context.perceptionType}'
      ) {
        return {
          ...a,
          parameters: {
            ...a.parameters,
            perception_type: 'state_change_observable',
          },
        };
      }
      return a;
    });
    const valid = ajv.validate(ruleSchema, {
      ...stepBackRule,
      actions: sanitized,
    });
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('actor leaves a triad leaving remaining pair intact', () => {
    interpreter.shutdown();
    init([
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'A' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'intimacy:closeness': { partners: ['b1', 'c1'] },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'b1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'B' },
          'intimacy:closeness': { partners: ['a1', 'c1'] },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'c1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'C' },
          'intimacy:closeness': { partners: ['a1', 'b1'] },
          'core:movement': { locked: true },
        },
      },
    ]);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: { actorId: 'a1', actionId: 'intimacy:step_back' },
    });

    expect(
      entityManager.getComponentData('a1', 'intimacy:closeness')
    ).toBeNull();
    expect(entityManager.getComponentData('a1', 'core:movement')).toEqual({
      locked: false,
    });
    expect(entityManager.getComponentData('b1', 'intimacy:closeness')).toEqual({
      partners: ['c1'],
    });
    expect(entityManager.getComponentData('b1', 'core:movement')).toEqual({
      locked: true,
    });
    expect(entityManager.getComponentData('c1', 'intimacy:closeness')).toEqual({
      partners: ['b1'],
    });
    expect(entityManager.getComponentData('c1', 'core:movement')).toEqual({
      locked: true,
    });
    const types = events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it('actor stepping back from a pair frees the partner', () => {
    interpreter.shutdown();
    init([
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'A' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'intimacy:closeness': { partners: ['b1'] },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'b1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'B' },
          'intimacy:closeness': { partners: ['a1'] },
          'core:movement': { locked: true },
        },
      },
    ]);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: { actorId: 'a1', actionId: 'intimacy:step_back' },
    });

    expect(
      entityManager.getComponentData('a1', 'intimacy:closeness')
    ).toBeNull();
    expect(entityManager.getComponentData('a1', 'core:movement')).toEqual({
      locked: false,
    });
    expect(
      entityManager.getComponentData('b1', 'intimacy:closeness')
    ).toBeNull();
    expect(entityManager.getComponentData('b1', 'core:movement')).toEqual({
      locked: false,
    });
    const types = events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it('actor leaves a poly circle leaving remaining triad intact', () => {
    interpreter.shutdown();
    const entities = buildABCDWorld();
    // place all actors in same room and create a poly circle of four
    for (const id of ['a1', 'b1', 'c1', 'd1']) {
      const ent = entities.find((e) => e.id === id);
      ent.components[POSITION_COMPONENT_ID].locationId = 'room1';
      ent.components['intimacy:closeness'] = {
        partners: ['a1', 'b1', 'c1', 'd1'].filter((p) => p !== id),
      };
      ent.components['core:movement'].locked = true;
    }
    init(entities);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: { actorId: 'a1', actionId: 'intimacy:step_back' },
    });

    expect(
      entityManager.getComponentData('a1', 'intimacy:closeness')
    ).toBeNull();
    expect(entityManager.getComponentData('a1', 'core:movement')).toEqual({
      locked: false,
    });
    for (const id of ['b1', 'c1', 'd1']) {
      const partners = entityManager
        .getComponentData(id, 'intimacy:closeness')
        .partners.sort();
      expect(partners).toEqual(
        ['b1', 'c1', 'd1'].filter((p) => p !== id).sort()
      );
      expect(entityManager.getComponentData(id, 'core:movement')).toEqual({
        locked: true,
      });
    }
    const types = events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });
});
