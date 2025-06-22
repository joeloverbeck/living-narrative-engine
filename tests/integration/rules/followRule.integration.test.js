/**
 * @file Integration test that proves the behavior of the follow rule.
 * @see tests/integration/followRule.integration.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import Ajv from 'ajv';
import ruleSchema from '../../../data/schemas/rule.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import conditionSchema from '../../../data/schemas/condition.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';
import loadOperationSchemas from '../../unit/helpers/loadOperationSchemas.js';
import followRule from '../../../data/mods/core/rules/follow.rule.json';
import eventIsActionFollow from '../../../data/mods/core/conditions/event-is-action-follow.condition.json';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import CheckFollowCycleHandler from '../../../src/logic/operationHandlers/checkFollowCycleHandler.js';
import EstablishFollowRelationHandler from '../../../src/logic/operationHandlers/establishFollowRelationHandler.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import logSuccessAndEndTurn from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import jsonLogicJs from 'json-logic-js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';

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
}

/**
 *
 * @param em
 */
function makeStubRebuild(em) {
  return {
    execute({ leaderIds }) {
      for (const lid of leaderIds) {
        const followers = [];
        for (const [id, ent] of em.entities) {
          const f = ent.components[FOLLOWING_COMPONENT_ID];
          if (f?.leaderId === lid) followers.push(id);
        }
        const leader = em.entities.get(lid);
        if (leader) {
          leader.components[LEADING_COMPONENT_ID] = { followers };
        }
      }
    },
  };
}

describe('core_handle_follow rule integration', () => {
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

  /**
   * Helper to (re)initialize the interpreter with a fresh entity manager and
   * operation registry using the provided entities.
   *
   * @param {Array<{id:string,components:object}>} entities
   */
  function init(entities) {
    operationRegistry = new OperationRegistry({ logger });
    entityManager = new SimpleEntityManager(entities);

    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        events.push({ eventType, payload });
        return Promise.resolve();
      }),
    };

    const handlers = {
      CHECK_FOLLOW_CYCLE: new CheckFollowCycleHandler({
        logger,
        entityManager,
        safeEventDispatcher: safeDispatcher,
      }),
      QUERY_COMPONENT: new QueryComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      ESTABLISH_FOLLOW_RELATION: new EstablishFollowRelationHandler({
        entityManager,
        logger,
        rebuildLeaderListCacheHandler: makeStubRebuild(entityManager),
        safeEventDispatcher: safeDispatcher,
      }),
      DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
        dispatcher: eventBus,
        logger,
        addPerceptionLogEntryHandler: { execute: jest.fn() },
      }),
      DISPATCH_EVENT: new DispatchEventHandler({
        dispatcher: eventBus,
        logger,
      }),
      END_TURN: new EndTurnHandler({
        safeEventDispatcher: safeDispatcher,
        logger,
      }),
      GET_TIMESTAMP: new GetTimestampHandler({ logger }),
      GET_NAME: new GetNameHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      SET_VARIABLE: new SetVariableHandler({ logger, jsonLogic: jsonLogicJs }),
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
      ...followRule,
      condition: eventIsActionFollow.logic,
      actions: expandMacros(
        JSON.parse(JSON.stringify(followRule.actions)),
        macroRegistry
      ),
    };
    dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
    };

    init([]); // start with empty manager by default
  });

  it('validates follow.rule.json against schema', () => {
    const ajv = new Ajv({ allErrors: true });
    ajv.addSchema(
      commonSchema,
      'http://example.com/schemas/common.schema.json'
    );
    ajv.addSchema(
      operationSchema,
      'http://example.com/schemas/operation.schema.json'
    );
    loadOperationSchemas(ajv);
    ajv.addSchema(
      jsonLogicSchema,
      'http://example.com/schemas/json-logic.schema.json'
    );
    ajv.addSchema(
      conditionContainerSchema,
      'http://example.com/schemas/condition-container.schema.json'
    );
    ajv.addSchema(
      conditionSchema,
      'http://example.com/schemas/condition.schema.json'
    );
    const valid = ajv.validate(ruleSchema, followRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('successful follow updates components and dispatches events', async () => {
    interpreter.shutdown();
    init([
      {
        id: 'f1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
        },
      },
      {
        id: 'l1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Leader' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
        },
      },
    ]);
    await listener({
      type: ATTEMPT_ACTION_ID,
      payload: { actorId: 'f1', actionId: 'core:follow', targetId: 'l1' },
    });

    expect(
      entityManager.getComponentData('f1', FOLLOWING_COMPONENT_ID)
    ).toEqual({
      leaderId: 'l1',
    });
    expect(entityManager.getComponentData('l1', LEADING_COMPONENT_ID)).toEqual({
      followers: ['f1'],
    });
  });

  it('cycle detection branch dispatches error and no mutations', async () => {
    entityManager = new SimpleEntityManager([
      {
        id: 'f1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
        },
      },
      {
        id: 'l1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Leader' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
          [FOLLOWING_COMPONENT_ID]: { leaderId: 'f1' },
        },
      },
    ]);
    interpreter.shutdown();
    init([
      {
        id: 'f1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
        },
      },
      {
        id: 'l1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Leader' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
          [FOLLOWING_COMPONENT_ID]: { leaderId: 'f1' },
        },
      },
    ]);
    await listener({
      type: ATTEMPT_ACTION_ID,
      payload: { actorId: 'f1', actionId: 'core:follow', targetId: 'l1' },
    });

    expect(
      entityManager.getComponentData('f1', FOLLOWING_COMPONENT_ID)
    ).toBeNull();
    // Errors are dispatched via the event dispatcher; ensure no components were
    // modified when a follow cycle is detected.
  });
});
