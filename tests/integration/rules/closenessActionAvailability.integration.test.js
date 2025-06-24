/**
 * @file Integration test ensuring closeness-dependent actions become available after executing the get_close rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import getCloseRule from '../../../data/mods/intimacy/rules/get_close.rule.json';
import adjustClothingAction from '../../../data/mods/intimacy/actions/adjust_clothing.action.json';
import thumbWipeCheekAction from '../../../data/mods/intimacy/actions/thumb_wipe_cheek.action.json';
import eventIsActionGetClose from '../../../data/mods/intimacy/conditions/event-is-action-get-close.condition.json';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';

import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import MergeClosenessCircleHandler from '../../../src/logic/operationHandlers/mergeClosenessCircleHandler.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import jsonLogic from 'json-logic-js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import AddPerceptionLogEntryHandler from '../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import {
  merge,
  dedupe,
  repair,
} from '../../../src/logic/services/closenessCircleService.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

/**
 * Creates handlers needed for the get_close rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @param validatedEventDispatcher
 * @param safeEventDispatcher
 * @returns {object} Handlers object
 */
function createHandlers(
  entityManager,
  eventBus,
  logger,
  validatedEventDispatcher,
  safeEventDispatcher
) {
  const closenessCircleService = { merge, dedupe, repair };
  return {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
    MERGE_CLOSENESS_CIRCLE: new MergeClosenessCircleHandler({
      logger,
      entityManager,
      safeEventDispatcher: safeEventDispatcher,
      closenessCircleService,
    }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      addPerceptionLogEntryHandler: new AddPerceptionLogEntryHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeEventDispatcher,
      }),
    }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeEventDispatcher,
      logger,
    }),
  };
}

describe('closeness action availability chain', () => {
  let testEnv;

  beforeEach(() => {
    const macroRegistry = {
      get: (type, id) =>
        type === 'macros' && id === 'core:logSuccessAndEndTurn'
          ? logSuccessMacro
          : undefined,
    };
    const expandedRule = {
      ...getCloseRule,
      actions: expandMacros(
        getCloseRule.actions,
        macroRegistry,
        testEnv?.logger
      ),
    };
    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'intimacy:event-is-action-get-close'
          ? eventIsActionGetClose
          : undefined
      ),
      getEventDefinition: jest.fn((eventName) => {
        const commonEvents = {
          'core:turn_ended': { payloadSchema: null },
        };
        return commonEvents[eventName] || null;
      }),
    };
    const testLogger = new ConsoleLogger('DEBUG');
    const bus = new EventBus();
    const schemaValidator = new AjvSchemaValidator(testLogger);
    const validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus: bus,
      gameDataRepository: dataRegistry,
      schemaValidator: schemaValidator,
      logger: testLogger,
    });
    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedEventDispatcher,
      logger: testLogger,
    });
    const entityManager = new SimpleEntityManager([]);
    const operationRegistry = new OperationRegistry({ logger: testLogger });
    const handlers = createHandlers(
      entityManager,
      bus,
      testLogger,
      validatedEventDispatcher,
      safeEventDispatcher
    );
    for (const [type, handler] of Object.entries(handlers)) {
      operationRegistry.register(type, handler.execute.bind(handler));
    }
    const operationInterpreter = new OperationInterpreter({
      logger: testLogger,
      operationRegistry,
    });
    const jsonLogic = new JsonLogicEvaluationService({
      logger: testLogger,
      gameDataRepository: dataRegistry,
    });
    const interpreter = new SystemLogicInterpreter({
      logger: testLogger,
      eventBus: bus,
      dataRegistry: dataRegistry,
      jsonLogicEvaluationService: jsonLogic,
      entityManager: entityManager,
      operationInterpreter,
    });
    const capturedEvents = [];
    bus.subscribe('core:turn_ended', (event) => {
      capturedEvents.push({ eventType: event.type, payload: event.payload });
    });
    interpreter.initialize();
    testEnv = {
      eventBus: bus,
      events: capturedEvents,
      operationRegistry,
      operationInterpreter,
      systemLogicInterpreter: interpreter,
      entityManager: entityManager,
      logger: testLogger,
      dataRegistry,
      validatedEventDispatcher,
      safeEventDispatcher,
      cleanup: () => {
        interpreter.shutdown();
      },
      reset: (newEntities = []) => {
        testEnv.cleanup();
        const newEntityManager = new SimpleEntityManager(newEntities);
        const newHandlers = createHandlers(
          newEntityManager,
          bus,
          testLogger,
          validatedEventDispatcher,
          safeEventDispatcher
        );
        const newOperationRegistry = new OperationRegistry({
          logger: testLogger,
        });
        for (const [type, handler] of Object.entries(newHandlers)) {
          newOperationRegistry.register(type, handler.execute.bind(handler));
        }
        const newOperationInterpreter = new OperationInterpreter({
          logger: testLogger,
          operationRegistry: newOperationRegistry,
        });
        const newInterpreter = new SystemLogicInterpreter({
          logger: testLogger,
          eventBus: bus,
          dataRegistry: dataRegistry,
          jsonLogicEvaluationService: jsonLogic,
          entityManager: newEntityManager,
          operationInterpreter: newOperationInterpreter,
        });
        newInterpreter.initialize();
        testEnv.operationRegistry = newOperationRegistry;
        testEnv.operationInterpreter = newOperationInterpreter;
        testEnv.systemLogicInterpreter = newInterpreter;
        testEnv.entityManager = newEntityManager;
        capturedEvents.length = 0;
      },
    };
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  /**
   *
   * @param actorId
   * @param targetId
   */
  function prerequisitesMet(actorId, targetId) {
    const closeness = testEnv.entityManager.getComponentData(
      actorId,
      'intimacy:closeness'
    );
    return (
      !!closeness &&
      Array.isArray(closeness.partners) &&
      closeness.partners.includes(targetId)
    );
  }

  it('enables intimacy actions after get_close is executed', () => {
    testEnv.reset([
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

    testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'a1',
      actionId: 'intimacy:get_close',
      targetId: 't1',
    });

    expect(prerequisitesMet('a1', 't1')).toBe(true);
    expect(prerequisitesMet('t1', 'a1')).toBe(true);

    // Verify that the closeness circle was created correctly
    const a1Closeness = testEnv.entityManager.getComponentData(
      'a1',
      'intimacy:closeness'
    );
    const t1Closeness = testEnv.entityManager.getComponentData(
      't1',
      'intimacy:closeness'
    );

    expect(a1Closeness).toEqual({ partners: ['t1'] });
    expect(t1Closeness).toEqual({ partners: ['a1'] });

    // Verify that the turn was ended
    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toContain('core:turn_ended');
  });
});
