/**
 * @file Integration test ensuring closeness-dependent actions become available after executing the get_close rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import getCloseRule from '../../../data/mods/intimacy/rules/get_close.rule.json';
import adjustClothingAction from '../../../data/mods/intimacy/actions/adjust_clothing.action.json';
import thumbWipeCheekAction from '../../../data/mods/intimacy/actions/thumb_wipe_cheek.action.json';
import eventIsActionGetClose from '../../../data/mods/intimacy/conditions/event-is-action-get-close.condition.json';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';

import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import jsonLogicJs from 'json-logic-js';
import MergeClosenessCircleHandler from '../../../src/logic/operationHandlers/mergeClosenessCircleHandler.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

/**
 *
 * @param entities
 */
function init(entities) {
  operationRegistry = new OperationRegistry({ logger });
  entityManager = new SimpleEntityManager(entities);

  const safeDispatcher = {
    dispatch: jest.fn(() => Promise.resolve(true)),
  };

  const closenessCircleService = {
    merge: jest.fn((...arrays) => [...new Set(arrays.flat())]),
  };

  const handlers = {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger, jsonLogic: jsonLogicJs }),
    MERGE_CLOSENESS_CIRCLE: new MergeClosenessCircleHandler({
      logger,
      entityManager,
      safeEventDispatcher: safeDispatcher,
      closenessCircleService,
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

  jsonLogic = new JsonLogicEvaluationService({
    logger,
    gameDataRepository: dataRegistry,
  });

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
let listener;

beforeEach(() => {
  logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  eventBus = {
    subscribe: jest.fn((ev, l) => {
      if (ev === '*') listener = l;
    }),
    unsubscribe: jest.fn(),
    dispatch: jest.fn(() => Promise.resolve()),
    listenerCount: jest.fn().mockReturnValue(1),
  };

  const macroRegistry = {
    get: (type, id) =>
      type === 'macros' && id === 'core:logSuccessAndEndTurn'
        ? logSuccessMacro
        : undefined,
  };
  const expandedRule = {
    ...getCloseRule,
    actions: expandMacros(getCloseRule.actions, macroRegistry, logger),
  };
  dataRegistry = {
    getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
    getConditionDefinition: jest.fn((id) =>
      id === 'intimacy:event-is-action-get-close'
        ? eventIsActionGetClose
        : undefined
    ),
  };

  init([]);
});

/**
 *
 * @param actorId
 * @param targetId
 */
function prerequisitesMet(actorId, targetId) {
  const closeness = entityManager.getComponentData(
    actorId,
    'intimacy:closeness'
  );
  return (
    !!closeness &&
    Array.isArray(closeness.partners) &&
    closeness.partners.includes(targetId)
  );
}

describe('closeness action availability chain', () => {
  it('enables intimacy actions after get_close is executed', () => {
    interpreter.shutdown();
    init([
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Actor' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          [ACTOR_COMPONENT_ID]: {},
          'core:movement': { locked: false },
        },
      },
      {
        id: 't1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Target' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          [ACTOR_COMPONENT_ID]: {},
          'core:movement': { locked: false },
        },
      },
    ]);

    expect(prerequisitesMet('a1', 't1')).toBe(false);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'a1',
        actionId: 'intimacy:get_close',
        targetId: 't1',
      },
    });

    expect(prerequisitesMet('a1', 't1')).toBe(true);
  });
});
