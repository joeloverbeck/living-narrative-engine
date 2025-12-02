/**
 * @file Integration tests for the intimacy step_back rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import ruleSchema from '../../../../../data/schemas/rule.schema.json';
import createTestAjv from '../../../../common/validation/createTestAjv.js';
import eventIsActionStepBack from '../../../../../data/mods/positioning/conditions/event-is-action-step-back.condition.json';
import stepBackRule from '../../../../../data/mods/positioning/rules/step_back.rule.json';
import logSuccessMacro from '../../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../../src/logic/operationHandlers/queryComponentHandler.js';
import ModifyArrayFieldHandler from '../../../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';
import RemoveComponentHandler from '../../../../../src/logic/operationHandlers/removeComponentHandler.js';
import ModifyComponentHandler from '../../../../../src/logic/operationHandlers/modifyComponentHandler.js';
import GetNameHandler from '../../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../../../src/logic/operationHandlers/setVariableHandler.js';
import RemoveFromClosenessCircleHandler from '../../../../../src/logic/operationHandlers/removeFromClosenessCircleHandler.js';
import AddPerceptionLogEntryHandler from '../../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import HasComponentHandler from '../../../../../src/logic/operationHandlers/hasComponentHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../../src/constants/eventIds.js';
import { buildABCDWorld } from '../../../fixtures/intimacyFixtures.js';
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
import { repair } from '../../../../../src/logic/services/closenessCircleService.js';

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
    HAS_COMPONENT: new HasComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
  };
}

describe('positioning_handle_step_back rule integration', () => {
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
        id === 'positioning:event-is-action-step-back'
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
          if (
            !bodyComponent ||
            !bodyComponent.body ||
            !bodyComponent.body.root
          ) {
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

  it('validates step_back.rule.json against schema', async () => {
    const ajv = createTestAjv();
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

  it('actor leaves a triad leaving remaining pair intact', async () => {
    testEnv.reset([
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'A' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['b1', 'c1'] },
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-a1',
              parts: {
                torso: 'body-a1',
                leg_left: 'leg-left-a1',
                leg_right: 'leg-right-a1',
              },
            },
          },
        },
      },
      {
        id: 'body-a1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-a1',
        components: {
          'anatomy:part': { parentId: 'body-a1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-a1',
        components: {
          'anatomy:part': { parentId: 'body-a1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'b1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'B' },
          'positioning:closeness': { partners: ['a1', 'c1'] },
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-b1',
              parts: {
                torso: 'body-b1',
                leg_left: 'leg-left-b1',
                leg_right: 'leg-right-b1',
              },
            },
          },
        },
      },
      {
        id: 'body-b1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-b1',
        components: {
          'anatomy:part': { parentId: 'body-b1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-b1',
        components: {
          'anatomy:part': { parentId: 'body-b1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'c1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'C' },
          'positioning:closeness': { partners: ['a1', 'b1'] },
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-c1',
              parts: {
                torso: 'body-c1',
                leg_left: 'leg-left-c1',
                leg_right: 'leg-right-c1',
              },
            },
          },
        },
      },
      {
        id: 'body-c1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-c1',
        components: {
          'anatomy:part': { parentId: 'body-c1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-c1',
        components: {
          'anatomy:part': { parentId: 'body-c1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'a1',
      actionId: 'positioning:step_back',
      originalInput: 'step_back',
    });

    expect(
      testEnv.entityManager.getComponentData('a1', 'positioning:closeness')
    ).toBeNull();
    // Check that movement components on legs are updated
    expect(
      testEnv.entityManager.getComponentData('leg-left-a1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-right-a1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    expect(
      testEnv.entityManager.getComponentData('b1', 'positioning:closeness')
    ).toEqual({
      partners: ['c1'],
    });
    expect(
      testEnv.entityManager.getComponentData('leg-left-b1', 'core:movement')
    ).toEqual({
      locked: true,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-right-b1', 'core:movement')
    ).toEqual({
      locked: true,
    });
    expect(
      testEnv.entityManager.getComponentData('c1', 'positioning:closeness')
    ).toEqual({
      partners: ['b1'],
    });
    expect(
      testEnv.entityManager.getComponentData('leg-left-c1', 'core:movement')
    ).toEqual({
      locked: true,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-right-c1', 'core:movement')
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

  it('actor stepping back from a pair frees the partner', async () => {
    testEnv.reset([
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'A' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['b1'] },
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-a1',
              parts: {
                torso: 'body-a1',
                leg_left: 'leg-left-a1',
                leg_right: 'leg-right-a1',
              },
            },
          },
        },
      },
      {
        id: 'body-a1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-a1',
        components: {
          'anatomy:part': { parentId: 'body-a1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-a1',
        components: {
          'anatomy:part': { parentId: 'body-a1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'b1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'B' },
          'positioning:closeness': { partners: ['a1'] },
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-b1',
              parts: {
                torso: 'body-b1',
                leg_left: 'leg-left-b1',
                leg_right: 'leg-right-b1',
              },
            },
          },
        },
      },
      {
        id: 'body-b1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-b1',
        components: {
          'anatomy:part': { parentId: 'body-b1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-b1',
        components: {
          'anatomy:part': { parentId: 'body-b1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'a1',
      actionId: 'positioning:step_back',
      originalInput: 'step_back',
    });

    expect(
      testEnv.entityManager.getComponentData('a1', 'positioning:closeness')
    ).toBeNull();
    // Check that movement components on legs are updated
    expect(
      testEnv.entityManager.getComponentData('leg-left-a1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-right-a1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    expect(
      testEnv.entityManager.getComponentData('b1', 'positioning:closeness')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('leg-left-b1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-right-b1', 'core:movement')
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

  it('actor leaves a poly circle leaving remaining triad intact', async () => {
    const entities = buildABCDWorld();
    // place all actors in same room and create a poly circle of four
    for (const id of ['a1', 'b1', 'c1', 'd1']) {
      const ent = entities.find((e) => e.id === id);
      ent.components[POSITION_COMPONENT_ID].locationId = 'room1';
      ent.components['positioning:closeness'] = {
        partners: ['a1', 'b1', 'c1', 'd1'].filter((p) => p !== id),
      };
      // Add anatomy:body component
      ent.components['anatomy:body'] = {
        recipeId: 'anatomy:human',
        body: {
          root: `body-${id}`,
          parts: {
            torso: `body-${id}`,
            leg_left: `leg-left-${id}`,
            leg_right: `leg-right-${id}`,
          },
        },
      };
    }

    // Add body and leg entities for each actor
    for (const id of ['a1', 'b1', 'c1', 'd1']) {
      entities.push(
        {
          id: `body-${id}`,
          components: {
            'anatomy:part': { parentId: null, type: 'body' },
          },
        },
        {
          id: `leg-left-${id}`,
          components: {
            'anatomy:part': { parentId: `body-${id}`, type: 'leg' },
            'core:movement': { locked: true },
          },
        },
        {
          id: `leg-right-${id}`,
          components: {
            'anatomy:part': { parentId: `body-${id}`, type: 'leg' },
            'core:movement': { locked: true },
          },
        }
      );
    }

    testEnv.reset(entities);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'a1',
      actionId: 'positioning:step_back',
      originalInput: 'step_back',
    });

    expect(
      testEnv.entityManager.getComponentData('a1', 'positioning:closeness')
    ).toBeNull();
    // Check that movement components on legs are updated
    expect(
      testEnv.entityManager.getComponentData('leg-left-a1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-right-a1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    for (const id of ['b1', 'c1', 'd1']) {
      const partners = testEnv.entityManager
        .getComponentData(id, 'positioning:closeness')
        .partners.sort();
      expect(partners).toEqual(
        ['b1', 'c1', 'd1'].filter((p) => p !== id).sort()
      );
      expect(
        testEnv.entityManager.getComponentData(
          `leg-left-${id}`,
          'core:movement'
        )
      ).toEqual({
        locked: true,
      });
      expect(
        testEnv.entityManager.getComponentData(
          `leg-right-${id}`,
          'core:movement'
        )
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

  it('removes facing_away component when actor with facing_away steps back', async () => {
    testEnv.reset([
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'A' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['b1'] },
          'positioning:facing_away': { facing_away_from: ['b1'] },
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-a1',
              parts: {
                torso: 'body-a1',
                leg_left: 'leg-left-a1',
                leg_right: 'leg-right-a1',
              },
            },
          },
        },
      },
      {
        id: 'body-a1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-a1',
        components: {
          'anatomy:part': { parentId: 'body-a1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-a1',
        components: {
          'anatomy:part': { parentId: 'body-a1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'b1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'B' },
          'positioning:closeness': { partners: ['a1'] },
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-b1',
              parts: {
                torso: 'body-b1',
                leg_left: 'leg-left-b1',
                leg_right: 'leg-right-b1',
              },
            },
          },
        },
      },
      {
        id: 'body-b1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-b1',
        components: {
          'anatomy:part': { parentId: 'body-b1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-b1',
        components: {
          'anatomy:part': { parentId: 'body-b1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'a1',
      actionId: 'positioning:step_back',
      originalInput: 'step_back',
    });

    // Verify both closeness and facing_away components are removed
    expect(
      testEnv.entityManager.getComponentData('a1', 'positioning:closeness')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('a1', 'positioning:facing_away')
    ).toBeNull();

    // Verify actor's movement components are unlocked
    expect(
      testEnv.entityManager.getComponentData('leg-left-a1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-right-a1', 'core:movement')
    ).toEqual({
      locked: false,
    });

    // Verify partner's closeness is removed and movement unlocked
    expect(
      testEnv.entityManager.getComponentData('b1', 'positioning:closeness')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('leg-left-b1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-right-b1', 'core:movement')
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

  it('handles actor stepping back when facing away from multiple partners', async () => {
    testEnv.reset([
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'A' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['b1', 'c1'] },
          'positioning:facing_away': { facing_away_from: ['b1', 'c1'] },
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-a1',
              parts: {
                torso: 'body-a1',
                leg_left: 'leg-left-a1',
                leg_right: 'leg-right-a1',
              },
            },
          },
        },
      },
      {
        id: 'body-a1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-a1',
        components: {
          'anatomy:part': { parentId: 'body-a1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-a1',
        components: {
          'anatomy:part': { parentId: 'body-a1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'b1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'B' },
          'positioning:closeness': { partners: ['a1', 'c1'] },
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-b1',
              parts: {
                torso: 'body-b1',
                leg_left: 'leg-left-b1',
                leg_right: 'leg-right-b1',
              },
            },
          },
        },
      },
      {
        id: 'body-b1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-b1',
        components: {
          'anatomy:part': { parentId: 'body-b1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-b1',
        components: {
          'anatomy:part': { parentId: 'body-b1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'c1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'C' },
          'positioning:closeness': { partners: ['a1', 'b1'] },
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-c1',
              parts: {
                torso: 'body-c1',
                leg_left: 'leg-left-c1',
                leg_right: 'leg-right-c1',
              },
            },
          },
        },
      },
      {
        id: 'body-c1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-c1',
        components: {
          'anatomy:part': { parentId: 'body-c1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-c1',
        components: {
          'anatomy:part': { parentId: 'body-c1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'a1',
      actionId: 'positioning:step_back',
      originalInput: 'step_back',
    });

    // Verify actor a1's components are completely cleaned
    expect(
      testEnv.entityManager.getComponentData('a1', 'positioning:closeness')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('a1', 'positioning:facing_away')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('leg-left-a1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-right-a1', 'core:movement')
    ).toEqual({
      locked: false,
    });

    // Verify remaining partners (b1, c1) form pair and stay locked
    expect(
      testEnv.entityManager.getComponentData('b1', 'positioning:closeness')
    ).toEqual({
      partners: ['c1'],
    });
    expect(
      testEnv.entityManager.getComponentData('c1', 'positioning:closeness')
    ).toEqual({
      partners: ['b1'],
    });
    expect(
      testEnv.entityManager.getComponentData('leg-left-b1', 'core:movement')
    ).toEqual({
      locked: true,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-left-c1', 'core:movement')
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

  it('step back works normally for actor without facing_away component (regression test)', async () => {
    testEnv.reset([
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'A' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['b1'] },
          // No facing_away component
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-a1',
              parts: {
                torso: 'body-a1',
                leg_left: 'leg-left-a1',
                leg_right: 'leg-right-a1',
              },
            },
          },
        },
      },
      {
        id: 'body-a1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-a1',
        components: {
          'anatomy:part': { parentId: 'body-a1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-a1',
        components: {
          'anatomy:part': { parentId: 'body-a1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'b1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'B' },
          'positioning:closeness': { partners: ['a1'] },
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-b1',
              parts: {
                torso: 'body-b1',
                leg_left: 'leg-left-b1',
                leg_right: 'leg-right-b1',
              },
            },
          },
        },
      },
      {
        id: 'body-b1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-b1',
        components: {
          'anatomy:part': { parentId: 'body-b1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-b1',
        components: {
          'anatomy:part': { parentId: 'body-b1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'a1',
      actionId: 'positioning:step_back',
      originalInput: 'step_back',
    });

    // Verify normal step back behavior works (regression test)
    expect(
      testEnv.entityManager.getComponentData('a1', 'positioning:closeness')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('a1', 'positioning:facing_away')
    ).toBeNull(); // Should still be null
    expect(
      testEnv.entityManager.getComponentData('leg-left-a1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-right-a1', 'core:movement')
    ).toEqual({
      locked: false,
    });

    // Verify partner is freed
    expect(
      testEnv.entityManager.getComponentData('b1', 'positioning:closeness')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('leg-left-b1', 'core:movement')
    ).toEqual({
      locked: false,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-right-b1', 'core:movement')
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

  it('complex state scenario: multiple actors with mixed facing states', async () => {
    testEnv.reset([
      {
        id: 'a1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'A' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['b1', 'c1', 'd1'] },
          'positioning:facing_away': { facing_away_from: ['b1', 'c1'] }, // facing away from b1 and c1
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-a1',
              parts: {
                torso: 'body-a1',
                leg_left: 'leg-left-a1',
                leg_right: 'leg-right-a1',
              },
            },
          },
        },
      },
      {
        id: 'body-a1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-a1',
        components: {
          'anatomy:part': { parentId: 'body-a1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-a1',
        components: {
          'anatomy:part': { parentId: 'body-a1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'b1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'B' },
          'positioning:closeness': { partners: ['a1', 'c1', 'd1'] },
          'positioning:facing_away': { facing_away_from: ['d1'] }, // facing away from d1
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-b1',
              parts: {
                torso: 'body-b1',
                leg_left: 'leg-left-b1',
                leg_right: 'leg-right-b1',
              },
            },
          },
        },
      },
      {
        id: 'body-b1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-b1',
        components: {
          'anatomy:part': { parentId: 'body-b1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-b1',
        components: {
          'anatomy:part': { parentId: 'body-b1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'c1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'C' },
          'positioning:closeness': { partners: ['a1', 'b1', 'd1'] },
          // No facing_away component
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-c1',
              parts: {
                torso: 'body-c1',
                leg_left: 'leg-left-c1',
                leg_right: 'leg-right-c1',
              },
            },
          },
        },
      },
      {
        id: 'body-c1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-c1',
        components: {
          'anatomy:part': { parentId: 'body-c1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-c1',
        components: {
          'anatomy:part': { parentId: 'body-c1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'd1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'D' },
          'positioning:closeness': { partners: ['a1', 'b1', 'c1'] },
          'positioning:facing_away': { facing_away_from: ['a1'] }, // facing away from a1
          'anatomy:body': {
            recipeId: 'anatomy:human',
            body: {
              root: 'body-d1',
              parts: {
                torso: 'body-d1',
                leg_left: 'leg-left-d1',
                leg_right: 'leg-right-d1',
              },
            },
          },
        },
      },
      {
        id: 'body-d1',
        components: {
          'anatomy:part': { parentId: null, type: 'body' },
        },
      },
      {
        id: 'leg-left-d1',
        components: {
          'anatomy:part': { parentId: 'body-d1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
      {
        id: 'leg-right-d1',
        components: {
          'anatomy:part': { parentId: 'body-d1', type: 'leg' },
          'core:movement': { locked: true },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'a1',
      actionId: 'positioning:step_back',
      originalInput: 'step_back',
    });

    // Verify a1 is completely removed from the intimate context
    expect(
      testEnv.entityManager.getComponentData('a1', 'positioning:closeness')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('a1', 'positioning:facing_away')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('leg-left-a1', 'core:movement')
    ).toEqual({
      locked: false,
    });

    // Verify remaining partners form triad
    expect(
      testEnv.entityManager.getComponentData('b1', 'positioning:closeness')
    ).toEqual({
      partners: ['c1', 'd1'],
    });
    expect(
      testEnv.entityManager.getComponentData('c1', 'positioning:closeness')
    ).toEqual({
      partners: ['b1', 'd1'],
    });
    expect(
      testEnv.entityManager.getComponentData('d1', 'positioning:closeness')
    ).toEqual({
      partners: ['b1', 'c1'],
    });

    // Verify facing states of remaining partners are preserved correctly
    expect(
      testEnv.entityManager.getComponentData('b1', 'positioning:facing_away')
    ).toEqual({
      facing_away_from: ['d1'], // b1 still facing away from d1
    });
    expect(
      testEnv.entityManager.getComponentData('c1', 'positioning:facing_away')
    ).toBeNull(); // c1 still has no facing_away component
    expect(
      testEnv.entityManager.getComponentData('d1', 'positioning:facing_away')
    ).toEqual({
      facing_away_from: ['a1'], // d1 still faces away from a1, but a1 no longer in closeness circle
    });

    // Verify remaining partners stay locked
    expect(
      testEnv.entityManager.getComponentData('leg-left-b1', 'core:movement')
    ).toEqual({
      locked: true,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-left-c1', 'core:movement')
    ).toEqual({
      locked: true,
    });
    expect(
      testEnv.entityManager.getComponentData('leg-left-d1', 'core:movement')
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
});
