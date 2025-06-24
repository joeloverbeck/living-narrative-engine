/**
 * @file Integration tests for the intimacy step_back rule.
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
import eventIsActionStepBack from '../../../data/mods/intimacy/conditions/event-is-action-step-back.condition.json';
import stepBackRule from '../../../data/mods/intimacy/rules/step_back.rule.json';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../src/utils/macroUtils.js';
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
import RemoveFromClosenessCircleHandler from '../../../src/logic/operationHandlers/removeFromClosenessCircleHandler.js';
import AddPerceptionLogEntryHandler from '../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import jsonLogic from 'json-logic-js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import { buildABCDWorld } from '../fixtures/intimacyFixtures.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { repair } from '../../../src/logic/services/closenessCircleService.js';

const closenessCircleService = { repair };

/**
 * Creates handlers needed for the step_back rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @param {object} validatedEventDispatcher - Validated event dispatcher instance
 * @param {object} safeEventDispatcher - Safe event dispatcher instance
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
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    MODIFY_ARRAY_FIELD: new ModifyArrayFieldHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    REMOVE_COMPONENT: new RemoveComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    MODIFY_COMPONENT: new ModifyComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
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
    REMOVE_FROM_CLOSENESS_CIRCLE: new RemoveFromClosenessCircleHandler({
      logger,
      entityManager,
      safeEventDispatcher: safeEventDispatcher,
      closenessCircleService,
    }),
  };
}

describe('intimacy_handle_step_back rule integration', () => {
  let testEnv;
  let customEntityManager;

  beforeEach(() => {
    customEntityManager = new SimpleEntityManager([]);
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(
      stepBackRule.actions,
      {
        get: (type, id) => (type === 'macros' ? macros[id] : undefined),
      },
      null
    );

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...stepBackRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'intimacy:event-is-action-step-back'
          ? eventIsActionStepBack
          : undefined
      ),
      getEventDefinition: jest.fn((eventName) => {
        // Return a basic event definition for common events
        const commonEvents = {
          'core:turn_ended': { payloadSchema: null },
          'core:perceptible_event': { payloadSchema: null },
          'core:display_successful_action_result': { payloadSchema: null },
          'core:system_error_occurred': { payloadSchema: null },
        };
        return commonEvents[eventName] || null;
      }),
    };

    // Use actual ConsoleLogger instead of mock
    const testLogger = new ConsoleLogger('DEBUG');

    // Use actual EventBus instead of mock
    const bus = new EventBus();

    // Create actual schema validator
    const schemaValidator = new AjvSchemaValidator(testLogger);

    // Create actual ValidatedEventDispatcher
    const validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus: bus,
      gameDataRepository: dataRegistry,
      schemaValidator: schemaValidator,
      logger: testLogger,
    });

    // Create actual SafeEventDispatcher
    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedEventDispatcher,
      logger: testLogger,
    });

    // Create JSON logic evaluation service
    const jsonLogic = new JsonLogicEvaluationService({
      logger: testLogger,
      gameDataRepository: dataRegistry,
    });

    // Create operation registry with our custom entity manager
    const operationRegistry = new OperationRegistry({ logger: testLogger });
    const handlers = createHandlers(
      customEntityManager,
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

    const interpreter = new SystemLogicInterpreter({
      logger: testLogger,
      eventBus: bus,
      dataRegistry: dataRegistry,
      jsonLogicEvaluationService: jsonLogic,
      entityManager: customEntityManager,
      operationInterpreter,
    });

    interpreter.initialize();

    // Create a simple event capture mechanism for testing
    const capturedEvents = [];

    // Subscribe to the specific events we want to capture
    const eventsToCapture = [
      'core:perceptible_event',
      'core:display_successful_action_result',
      'core:turn_ended',
      'core:system_error_occurred',
    ];

    eventsToCapture.forEach((eventType) => {
      bus.subscribe(eventType, (event) => {
        capturedEvents.push({ eventType: event.type, payload: event.payload });
      });
    });

    testEnv = {
      eventBus: bus,
      events: capturedEvents,
      operationRegistry,
      operationInterpreter,
      jsonLogic,
      systemLogicInterpreter: interpreter,
      entityManager: customEntityManager,
      logger: testLogger,
      dataRegistry,
      cleanup: () => {
        interpreter.shutdown();
      },
      reset: (newEntities = []) => {
        testEnv.cleanup();
        // Create new entity manager with the new entities
        customEntityManager = new SimpleEntityManager(newEntities);

        // Recreate handlers with the new entity manager
        const newHandlers = createHandlers(
          customEntityManager,
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
          entityManager: customEntityManager,
          operationInterpreter: newOperationInterpreter,
        });

        newInterpreter.initialize();

        // Update test environment
        testEnv.operationRegistry = newOperationRegistry;
        testEnv.operationInterpreter = newOperationInterpreter;
        testEnv.systemLogicInterpreter = newInterpreter;
        testEnv.entityManager = customEntityManager;

        // Clear events
        capturedEvents.length = 0;
      },
    };
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
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
    loadOperationSchemas(ajv);
    loadConditionSchemas(ajv);
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
    testEnv.reset([
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

    testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'a1',
      actionId: 'intimacy:step_back',
    });

    expect(
      testEnv.entityManager.getComponentData('a1', 'intimacy:closeness')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('a1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    expect(
      testEnv.entityManager.getComponentData('b1', 'intimacy:closeness')
    ).toEqual({
      partners: ['c1'],
    });
    expect(
      testEnv.entityManager.getComponentData('b1', 'core:movement')
    ).toEqual({
      locked: true,
    });
    expect(
      testEnv.entityManager.getComponentData('c1', 'intimacy:closeness')
    ).toEqual({
      partners: ['b1'],
    });
    expect(
      testEnv.entityManager.getComponentData('c1', 'core:movement')
    ).toEqual({
      locked: true,
    });
    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it('actor stepping back from a pair frees the partner', () => {
    testEnv.reset([
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

    testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'a1',
      actionId: 'intimacy:step_back',
    });

    expect(
      testEnv.entityManager.getComponentData('a1', 'intimacy:closeness')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('a1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    expect(
      testEnv.entityManager.getComponentData('b1', 'intimacy:closeness')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('b1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it('actor leaves a poly circle leaving remaining triad intact', () => {
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
    testEnv.reset(entities);

    testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'a1',
      actionId: 'intimacy:step_back',
    });

    expect(
      testEnv.entityManager.getComponentData('a1', 'intimacy:closeness')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('a1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    for (const id of ['b1', 'c1', 'd1']) {
      const partners = testEnv.entityManager
        .getComponentData(id, 'intimacy:closeness')
        .partners.sort();
      expect(partners).toEqual(
        ['b1', 'c1', 'd1'].filter((p) => p !== id).sort()
      );
      expect(
        testEnv.entityManager.getComponentData(id, 'core:movement')
      ).toEqual({
        locked: true,
      });
    }
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
