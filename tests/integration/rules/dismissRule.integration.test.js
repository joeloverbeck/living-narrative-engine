/**
 * @file Integration tests for the dismiss rule.
 * @see tests/integration/dismissRule.integration.test.js
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import Ajv from 'ajv';
import ruleSchema from '../../../data/schemas/rule.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import conditionSchema from '../../../data/schemas/condition.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';
import loadOperationSchemas from '../../unit/helpers/loadOperationSchemas.js';
import loadConditionSchemas from '../../unit/helpers/loadConditionSchemas.js';
import eventIsActionDismiss from '../../../data/mods/core/conditions/event-is-action-dismiss.condition.json';
import dismissRule from '../../../data/mods/core/rules/dismiss.rule.json';
import displaySuccessAndEndTurn from '../../../data/mods/core/macros/displaySuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import RemoveComponentHandler from '../../../src/logic/operationHandlers/removeComponentHandler.js';
import ModifyArrayFieldHandler from '../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';
import HasComponentHandler from '../../../src/logic/operationHandlers/hasComponentHandler.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import IfCoLocatedHandler from '../../../src/logic/operationHandlers/ifCoLocatedHandler.js';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
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

/**
 * Creates handlers needed for the dismiss rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @returns {object} Handlers object
 */
function createHandlers(entityManager, eventBus, logger, validatedEventDispatcher, safeEventDispatcher) {
  return {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      addPerceptionLogEntryHandler: new AddPerceptionLogEntryHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeEventDispatcher,
      }),
    }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeEventDispatcher,
      logger,
    }),
    REMOVE_COMPONENT: new RemoveComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    MODIFY_ARRAY_FIELD: new ModifyArrayFieldHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    IF_CO_LOCATED_FACTORY: (operationInterpreter) =>
      new IfCoLocatedHandler({
        entityManager,
        operationInterpreter,
        logger,
        safeEventDispatcher: safeEventDispatcher,
      }),
  };
}

describe('core_handle_dismiss rule integration', () => {
  let testEnv;

  beforeEach(() => {
    const macroRegistry = {
      get: (type, id) =>
        type === 'macros' && id === 'core:displaySuccessAndEndTurn'
          ? displaySuccessAndEndTurn
          : undefined,
    };
    const expandedRule = {
      ...dismissRule,
      actions: expandMacros(dismissRule.actions, macroRegistry, testEnv?.logger),
    };

    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'core:event-is-action-dismiss' ? eventIsActionDismiss : undefined
      ),
      getEventDefinition: jest.fn((eventName) => {
        const commonEvents = {
          'core:turn_ended': { payloadSchema: null },
          'core:perceptible_event': { payloadSchema: null },
          'core:display_successful_action_result': { payloadSchema: null },
          'core:system_error_occurred': { payloadSchema: null },
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
    const jsonLogic = new JsonLogicEvaluationService({
      logger: testLogger,
      gameDataRepository: dataRegistry,
    });
    const entityManager = new SimpleEntityManager([]);
    const operationRegistry = new OperationRegistry({ logger: testLogger });
    const handlers = createHandlers(entityManager, bus, testLogger, validatedEventDispatcher, safeEventDispatcher);
    const { IF_CO_LOCATED_FACTORY, ...rest } = handlers;
    for (const [type, handler] of Object.entries(rest)) {
      operationRegistry.register(type, handler.execute.bind(handler));
    }
    const operationInterpreter = new OperationInterpreter({
      logger: testLogger,
      operationRegistry,
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
    const eventsToCapture = [
      'core:perceptible_event',
      'core:display_successful_action_result',
      'core:turn_ended',
      'core:system_error_occurred',
    ];
    eventsToCapture.forEach(eventType => {
      bus.subscribe(eventType, (event) => {
        capturedEvents.push({ eventType: event.type, payload: event.payload });
      });
    });
    interpreter.initialize();
    testEnv = {
      eventBus: bus,
      events: capturedEvents,
      operationRegistry,
      operationInterpreter,
      jsonLogic,
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
        const newHandlers = createHandlers(newEntityManager, bus, testLogger, validatedEventDispatcher, safeEventDispatcher);
        const { IF_CO_LOCATED_FACTORY: newIfCoLocatedFactory, ...newRest } = newHandlers;
        const newOperationRegistry = new OperationRegistry({ logger: testLogger });
        for (const [type, handler] of Object.entries(newRest)) {
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
    const ifCoLocatedHandler = createHandlers(
      testEnv.entityManager,
      testEnv.eventBus,
      testEnv.logger,
      testEnv.validatedEventDispatcher,
      testEnv.safeEventDispatcher
    ).IF_CO_LOCATED_FACTORY(testEnv.operationInterpreter);
    testEnv.operationRegistry.register(
      'IF_CO_LOCATED',
      ifCoLocatedHandler.execute.bind(ifCoLocatedHandler)
    );
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('performs dismiss action successfully', () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Actor' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          [LEADING_COMPONENT_ID]: { followers: ['target1'] },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Target' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          [FOLLOWING_COMPONENT_ID]: { leaderId: 'actor1' },
        },
      },
    ]);

    // Re-register IF_CO_LOCATED handler after reset
    const ifCoLocatedHandler = createHandlers(
      testEnv.entityManager,
      testEnv.eventBus,
      testEnv.logger,
      testEnv.validatedEventDispatcher,
      testEnv.safeEventDispatcher
    ).IF_CO_LOCATED_FACTORY(testEnv.operationInterpreter);
    testEnv.operationRegistry.register(
      'IF_CO_LOCATED',
      ifCoLocatedHandler.execute.bind(ifCoLocatedHandler)
    );

    testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'core:dismiss',
      targetId: 'target1',
    });

    // Debug: log all captured events
    console.log('DEBUG: All captured events:', testEnv.events);

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });
});
