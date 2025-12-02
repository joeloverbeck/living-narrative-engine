/**
 * @file Integration tests for the intimacy get_close rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import ruleSchema from '../../../../../data/schemas/rule.schema.json';
import createTestAjv from '../../../../common/validation/createTestAjv.js';
import getCloseRule from '../../../../../data/mods/positioning/rules/get_close.rule.json';
import eventIsActionGetClose from '../../../../../data/mods/positioning/conditions/event-is-action-get-close.condition.json';
import SetVariableHandler from '../../../../../src/logic/operationHandlers/setVariableHandler.js';
import MergeClosenessCircleHandler from '../../../../../src/logic/operationHandlers/mergeClosenessCircleHandler.js';
import GetNameHandler from '../../../../../src/logic/operationHandlers/getNameHandler.js';
import QueryComponentHandler from '../../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetTimestampHandler from '../../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../../src/logic/operationHandlers/endTurnHandler.js';
import AddPerceptionLogEntryHandler from '../../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import { expandMacros } from '../../../../../src/utils/macroUtils.js';
import logSuccessAndEndTurn from '../../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../../src/constants/componentIds.js';
import { buildABCDWorld } from '../../../fixtures/intimacyFixtures.js';
import { ATTEMPT_ACTION_ID } from '../../../../../src/constants/eventIds.js';
import { SimpleEntityManager } from '../../../../common/entities/index.js';
import { SafeEventDispatcher } from '../../../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../../../src/events/eventBus.js';
import AjvSchemaValidator from '../../../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../../../src/logging/consoleLogger.js';
import SystemLogicInterpreter from '../../../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../../../src/logic/jsonLogicEvaluationService.js';
import { merge } from '../../../../../src/logic/services/closenessCircleService.js';

/**
 * Creates handlers needed for the get_close rule.
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
  const closenessCircleService = { merge };

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

describe('positioning_handle_get_close rule integration', () => {
  let testEnv;
  let customEntityManager;

  beforeEach(() => {
    customEntityManager = new SimpleEntityManager([]);
    const macroRegistry = {
      get: (type, id) =>
        type === 'macros' && id === 'core:logSuccessAndEndTurn'
          ? logSuccessAndEndTurn
          : undefined,
    };
    const expandedRule = {
      ...getCloseRule,
      actions: expandMacros(getCloseRule.actions, macroRegistry, null),
    };

    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'positioning:event-is-action-get-close'
          ? eventIsActionGetClose
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
    const schemaValidator = new AjvSchemaValidator({ logger: testLogger });

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

    // Create bodyGraphService mock that checks entity components
    const mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(
        (bodyComponent, componentId, propertyPath, expectedValue) => {
          if (!bodyComponent || !bodyComponent.rootEntityId) {
            return { found: false };
          }

          // Check all entities in the manager
          const allEntities = customEntityManager.getAllEntities();
          for (const entity of allEntities) {
            if (entity.components && entity.components[componentId]) {
              const component = entity.components[componentId];
              const actualValue = propertyPath
                ? component[propertyPath]
                : component;
              if (actualValue === expectedValue) {
                return { found: true, partId: entity.id };
              }
            }
          }

          return { found: false };
        }
      ),
    };

    const interpreter = new SystemLogicInterpreter({
      logger: testLogger,
      eventBus: bus,
      dataRegistry: dataRegistry,
      jsonLogicEvaluationService: jsonLogic,
      entityManager: customEntityManager,
      operationInterpreter,
      bodyGraphService: mockBodyGraphService,
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

        // Create bodyGraphService mock for the new interpreter
        const newMockBodyGraphService = {
          hasPartWithComponentValue: jest.fn(
            (bodyComponent, componentId, propertyPath, expectedValue) => {
              if (!bodyComponent || !bodyComponent.rootEntityId) {
                return { found: false };
              }

              // Check all entities in the manager
              const allEntities = customEntityManager.getAllEntities();
              for (const entity of allEntities) {
                if (entity.components && entity.components[componentId]) {
                  const component = entity.components[componentId];
                  const actualValue = propertyPath
                    ? component[propertyPath]
                    : component;
                  if (actualValue === expectedValue) {
                    return { found: true, partId: entity.id };
                  }
                }
              }

              return { found: false };
            }
          ),
        };

        const newInterpreter = new SystemLogicInterpreter({
          logger: testLogger,
          eventBus: bus,
          dataRegistry: dataRegistry,
          jsonLogicEvaluationService: jsonLogic,
          entityManager: customEntityManager,
          operationInterpreter: newOperationInterpreter,
          bodyGraphService: newMockBodyGraphService,
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

  it('validates get_close.rule.json against schema', () => {
    const ajv = createTestAjv();
    const valid = ajv.validate(ruleSchema, getCloseRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('creates closeness circle between two actors', async () => {
    testEnv.reset([
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'A' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'b1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'B' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'a1',
      actionId: 'positioning:get_close',
      targetId: 'b1',
      originalInput: 'get_close b1',
    });

    expect(
      testEnv.entityManager.getComponentData('a1', 'positioning:closeness')
    ).toEqual({
      partners: ['b1'],
    });
    expect(
      testEnv.entityManager.getComponentData('b1', 'positioning:closeness')
    ).toEqual({
      partners: ['a1'],
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

  it('merges existing closeness circles', async () => {
    testEnv.reset([
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'A' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['b1'] },
        },
      },
      {
        id: 'b1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'B' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['a1'] },
        },
      },
      {
        id: 'c1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'C' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['d1'] },
        },
      },
      {
        id: 'd1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'D' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['c1'] },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'a1',
      actionId: 'positioning:get_close',
      targetId: 'c1',
      originalInput: 'get_close c1',
    });

    // All actors should now be in the same closeness circle
    const expectedPartners = ['a1', 'b1', 'c1', 'd1'];
    for (const id of expectedPartners) {
      const partners = testEnv.entityManager
        .getComponentData(id, 'positioning:closeness')
        .partners.sort();
      expect(partners).toEqual(expectedPartners.filter((p) => p !== id).sort());
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

  it('handles complex poly relationships', async () => {
    const entities = buildABCDWorld();
    // place all actors in same room
    for (const id of ['a1', 'b1', 'c1', 'd1']) {
      const ent = entities.find((e) => e.id === id);
      ent.components[POSITION_COMPONENT_ID].locationId = 'room1';
    }
    testEnv.reset(entities);

    // Create a complex poly relationship
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'a1',
      actionId: 'positioning:get_close',
      targetId: 'b1',
      originalInput: 'get_close b1',
    });

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'b1',
      actionId: 'positioning:get_close',
      targetId: 'c1',
      originalInput: 'get_close c1',
    });

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'c1',
      actionId: 'positioning:get_close',
      targetId: 'd1',
      originalInput: 'get_close d1',
    });

    // All actors should be in the same closeness circle
    const expectedPartners = ['a1', 'b1', 'c1', 'd1'];
    for (const id of expectedPartners) {
      const partners = testEnv.entityManager
        .getComponentData(id, 'positioning:closeness')
        .partners.sort();
      expect(partners).toEqual(expectedPartners.filter((p) => p !== id).sort());
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
