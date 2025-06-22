/**
 * @file Integration tests for the core turn_ended rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import turnEndedRule from '../../../data/mods/core/rules/turn_ended.rule.json';
import eventIsTurnEnded from '../../../data/mods/core/conditions/event-is-turn_ended.condition.json';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import RemoveComponentHandler from '../../../src/logic/operationHandlers/removeComponentHandler.js';
import jsonLogic from 'json-logic-js';
import { TURN_ENDED_ID } from '../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import AddPerceptionLogEntryHandler from '../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

/**
 * Creates handlers needed for the turn_ended rule.
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
  return {
    SET_VARIABLE: new SetVariableHandler({ logger, jsonLogic }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    REMOVE_COMPONENT: new RemoveComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
  };
}

describe('core_handle_turn_ended rule integration', () => {
  let testEnv;

  beforeEach(() => {
    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([turnEndedRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'core:event-is-turn-ended' ? eventIsTurnEnded : undefined
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
      entityManager: entityManager,
      operationInterpreter,
      jsonLogicEvaluationService: jsonLogic,
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
        const newJsonLogic = new JsonLogicEvaluationService({
          logger: testLogger,
          gameDataRepository: dataRegistry,
        });
        const newInterpreter = new SystemLogicInterpreter({
          logger: testLogger,
          eventBus: bus,
          dataRegistry: dataRegistry,
          entityManager: newEntityManager,
          operationInterpreter: newOperationInterpreter,
          jsonLogicEvaluationService: newJsonLogic,
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

  it('dispatches turn_started event when turn_ended is received', () => {
    testEnv.reset([
      {
        id: 'entity1',
        components: {
          'core:current_actor': {},
        },
      },
    ]);

    testEnv.eventBus.dispatch('core:turn_ended', {
      entityId: 'entity1',
    });

    const currentActorComponent = testEnv.entityManager.getComponentData(
      'entity1',
      'core:current_actor'
    );
    expect(currentActorComponent).toBeNull();
  });
});
