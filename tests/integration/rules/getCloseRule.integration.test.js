/**
 * @file Integration tests for the intimacy get_close rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import Ajv from 'ajv';
import ruleSchema from '../../../data/schemas/rule.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import getCloseRule from '../../../data/mods/intimacy/rules/get_close.rule.json';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import ModifyContextArrayHandler from '../../../src/logic/operationHandlers/modifyContextArrayHandler.js';
import AddComponentHandler from '../../../src/logic/operationHandlers/addComponentHandler.js';
import ModifyComponentHandler from '../../../src/logic/operationHandlers/modifyComponentHandler.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import logSuccessAndEndTurn from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { buildABCDWorld } from '../fixtures/intimacyFixtures.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';

// This entity manager is now simpler, as it no longer needs the context-aware hack.
class SimpleEntityManager {
  constructor(entities) {
    this.entities = new Map();
    for (const e of entities) {
      this.entities.set(e.id, {
        id: e.id,
        components: { ...e.components },
        getComponentData(type) {
          return this.components[type] ?? null;
        },
        hasComponent(type) {
          return Object.prototype.hasOwnProperty.call(this.components, type);
        },
      });
    }
  }

  getEntityInstance(id) {
    return this.entities.get(id);
  }

  getComponentData(id, type) {
    return this.entities.get(id)?.components[type] ?? null;
  }

  hasComponent(id, type) {
    return Object.prototype.hasOwnProperty.call(
      this.entities.get(id)?.components || {},
      type
    );
  }

  addComponent(id, type, data) {
    const ent = this.entities.get(id);
    if (ent) {
      ent.components[type] = JSON.parse(JSON.stringify(data));
    }
  }

  removeComponent(id, type) {
    const ent = this.entities.get(id);
    if (ent) {
      delete ent.components[type];
    }
  }
}

/**
 *
 * @param entities
 */
function init(entities) {
  operationRegistry = new OperationRegistry({ logger });
  entityManager = new SimpleEntityManager(entities);

  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      events.push({ eventType, payload });
      return Promise.resolve(true);
    }),
  };

  // Register all necessary handlers for the rule to run
  const handlers = {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
    // ADD THE NEW HANDLER
    MODIFY_CONTEXT_ARRAY: new ModifyContextArrayHandler({
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    ADD_COMPONENT: new AddComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    MODIFY_COMPONENT: new ModifyComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      addPerceptionLogEntryHandler: { execute: jest.fn() },
    }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeDispatcher,
      logger,
    }),
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

describe('intimacy_handle_get_close rule integration', () => {
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

    const macroRegistry = {
      get: (type, id) =>
        type === 'macros' && id === 'core:logSuccessAndEndTurn'
          ? logSuccessAndEndTurn
          : undefined,
    };
    const expandedRule = {
      ...getCloseRule,
      actions: expandMacros(getCloseRule.actions, macroRegistry, logger),
    };
    dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
    };

    // The context-aware mocks are no longer needed, so they are removed.
    init([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validates get_close.rule.json against schema', () => {
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
    const valid = ajv.validate(ruleSchema, getCloseRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('forms a new circle when neither participant has partners', () => {
    interpreter.shutdown();
    init([
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Actor' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
          'core:movement': { locked: false },
        },
      },
      {
        id: 't1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Target' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
          'core:movement': { locked: false },
        },
      },
    ]);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'a1',
        actionId: 'intimacy:get_close',
        targetId: 't1',
      },
    });

    expect(entityManager.getComponentData('a1', 'intimacy:closeness')).toEqual({
      partners: ['t1'],
    });
    expect(entityManager.getComponentData('t1', 'intimacy:closeness')).toEqual({
      partners: ['a1'],
    });
    expect(entityManager.getComponentData('a1', 'core:movement').locked).toBe(
      true
    );
    expect(entityManager.getComponentData('t1', 'core:movement').locked).toBe(
      true
    );
    const types = events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it("merges actor's existing circle with the target", () => {
    interpreter.shutdown();
    init([
      {
        id: 'p1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Partner' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
          'intimacy:closeness': { partners: ['a1'] },
          'core:movement': { locked: false },
        },
      },
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Actor' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
          'intimacy:closeness': { partners: ['p1'] },
          'core:movement': { locked: false },
        },
      },
      {
        id: 't1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Target' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
          'core:movement': { locked: false },
        },
      },
    ]);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'a1',
        actionId: 'intimacy:get_close',
        targetId: 't1',
      },
    });

    expect(entityManager.getComponentData('a1', 'intimacy:closeness')).toEqual({
      partners: ['t1', 'p1'],
    });
    expect(entityManager.getComponentData('t1', 'intimacy:closeness')).toEqual({
      partners: ['a1', 'p1'],
    });
    expect(entityManager.getComponentData('p1', 'intimacy:closeness')).toEqual({
      partners: ['a1', 't1'],
    });
    expect(entityManager.getComponentData('p1', 'core:movement').locked).toBe(
      true
    );
  });

  it('merges two existing circles and deduplicates partners', () => {
    interpreter.shutdown();
    init([
      {
        id: 'p1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Partner1' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
          'intimacy:closeness': { partners: ['a1'] },
          'core:movement': { locked: false },
        },
      },
      {
        id: 'p2',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Partner2' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
          'intimacy:closeness': { partners: ['t1'] },
          'core:movement': { locked: false },
        },
      },
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Actor' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
          'intimacy:closeness': { partners: ['p1'] },
          'core:movement': { locked: false },
        },
      },
      {
        id: 't1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Target' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
          'intimacy:closeness': { partners: ['p2'] },
          'core:movement': { locked: false },
        },
      },
    ]);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'a1',
        actionId: 'intimacy:get_close',
        targetId: 't1',
      },
    });

    const aPartners = entityManager.getComponentData(
      'a1',
      'intimacy:closeness'
    ).partners;
    const tPartners = entityManager.getComponentData(
      't1',
      'intimacy:closeness'
    ).partners;
    const p1Partners = entityManager.getComponentData(
      'p1',
      'intimacy:closeness'
    ).partners;
    const p2Partners = entityManager.getComponentData(
      'p2',
      'intimacy:closeness'
    ).partners;

    expect(aPartners.sort()).toEqual(['p1', 'p2', 't1']);
    expect(tPartners.sort()).toEqual(['a1', 'p1', 'p2']);
    expect(p1Partners.sort()).toEqual(['a1', 'p2', 't1']);
    expect(p2Partners.sort()).toEqual(['a1', 'p1', 't1']);
  });

  it("uses target's circle when actor has none", () => {
    interpreter.shutdown();
    init([
      {
        id: 'p1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Partner' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
          'intimacy:closeness': { partners: ['t1'] },
          'core:movement': { locked: false },
        },
      },
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Actor' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
          'core:movement': { locked: false },
        },
      },
      {
        id: 't1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Target' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc1' },
          'intimacy:closeness': { partners: ['p1'] },
          'core:movement': { locked: false },
        },
      },
    ]);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'a1',
        actionId: 'intimacy:get_close',
        targetId: 't1',
      },
    });

    expect(entityManager.getComponentData('a1', 'intimacy:closeness')).toEqual({
      partners: ['t1', 'p1'],
    });
    expect(
      entityManager.getComponentData('t1', 'intimacy:closeness').partners
    ).toEqual(expect.arrayContaining(['p1', 'a1']));
    expect(
      entityManager.getComponentData('p1', 'intimacy:closeness').partners
    ).toEqual(expect.arrayContaining(['t1', 'a1']));
  });

  it('merges an existing triad with a new member', () => {
    interpreter.shutdown();
    const entities = buildABCDWorld();
    // place D in the same room as the triad
    entities.find((e) => e.id === 'd1').components[
      POSITION_COMPONENT_ID
    ].locationId = 'room1';
    // establish initial triad A-B-C
    entities.find((e) => e.id === 'a1').components['intimacy:closeness'] = {
      partners: ['b1', 'c1'],
    };
    entities.find((e) => e.id === 'b1').components['intimacy:closeness'] = {
      partners: ['a1', 'c1'],
    };
    entities.find((e) => e.id === 'c1').components['intimacy:closeness'] = {
      partners: ['a1', 'b1'],
    };
    init(entities);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'd1',
        actionId: 'intimacy:get_close',
        targetId: 'a1',
      },
    });

    const ids = ['a1', 'b1', 'c1', 'd1'];
    for (const id of ids) {
      const partners = entityManager
        .getComponentData(id, 'intimacy:closeness')
        .partners.sort();
      expect(partners).toEqual(ids.filter((p) => p !== id).sort());
      expect(entityManager.getComponentData(id, 'core:movement').locked).toBe(
        true
      );
    }
  });
});
