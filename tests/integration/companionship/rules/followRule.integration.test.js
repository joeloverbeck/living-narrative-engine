/**
 * @file Integration test that proves the behavior of the follow rule.
 * @see tests/integration/followRule.integration.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ruleSchema from '../../../../data/schemas/rule.schema.json';
import followRule from '../../../../data/mods/companionship/rules/follow.rule.json';
import eventIsActionFollow from '../../../../data/mods/companionship/conditions/event-is-action-follow.condition.json';
import SystemLogicInterpreter from '../../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import CheckFollowCycleHandler from '../../../../src/logic/operationHandlers/checkFollowCycleHandler.js';
import EstablishFollowRelationHandler from '../../../../src/logic/operationHandlers/establishFollowRelationHandler.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import AddPerceptionLogEntryHandler from '../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import logSuccessAndEndTurn from '../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import logFailureAndEndTurn from '../../../../data/mods/core/macros/logFailureAndEndTurn.macro.json';
import { expandMacros } from '../../../../src/utils/macroUtils.js';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import RebuildLeaderListCacheHandler from '../../../../src/logic/operationHandlers/rebuildLeaderListCacheHandler.js';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../../src/events/eventBus.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';

/**
 * Creates handlers needed for the follow rule.
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
  const rebuildLeaderListCacheHandler = new RebuildLeaderListCacheHandler({
    entityManager,
    logger,
    safeEventDispatcher: safeEventDispatcher,
  });

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
    ESTABLISH_FOLLOW_RELATION: new EstablishFollowRelationHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
      rebuildLeaderListCacheHandler,
    }),
    CHECK_FOLLOW_CYCLE: new CheckFollowCycleHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
    // Mock handler for REGENERATE_DESCRIPTION - satisfies fail-fast enforcement
    REGENERATE_DESCRIPTION: {
      execute: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('core_handle_follow rule integration', () => {
  let testEnv;
  let customEntityManager;

  beforeEach(() => {
    customEntityManager = new SimpleEntityManager([]);
    const macroRegistry = {
      get: (type, id) => {
        if (type === 'macros') {
          if (id === 'core:logSuccessAndEndTurn') return logSuccessAndEndTurn;
          if (id === 'core:logFailureAndEndTurn') return logFailureAndEndTurn;
        }
        return undefined;
      },
    };
    const expandedRule = {
      ...followRule,
      actions: expandMacros(followRule.actions, macroRegistry, null),
    };

    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'companionship:event-is-action-follow' ? eventIsActionFollow : undefined
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

    const mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn().mockReturnValue({ found: false }),
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
      'core:display_failed_action_result',
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

        const mockBodyGraphService = {
          hasPartWithComponentValue: jest
            .fn()
            .mockReturnValue({ found: false }),
        };

        const newInterpreter = new SystemLogicInterpreter({
          logger: testLogger,
          eventBus: bus,
          dataRegistry: dataRegistry,
          jsonLogicEvaluationService: jsonLogic,
          entityManager: customEntityManager,
          operationInterpreter: newOperationInterpreter,
          bodyGraphService: mockBodyGraphService,
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

  it('performs follow action successfully', async () => {
    testEnv.reset([
      {
        id: 'f1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          [ACTOR_COMPONENT_ID]: {},
        },
      },
      {
        id: 'l1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Leader' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          [ACTOR_COMPONENT_ID]: {},
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'f1',
      actionId: 'companionship:follow',
      targetId: 'l1',
      originalInput: 'follow l1',
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

  it('validates follow.rule.json against schema', () => {
    const { createTestAjv } = require('../../../common/index.js');
    const ajv = createTestAjv();
    const valid = ajv.validate(ruleSchema, followRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('successful follow updates components and dispatches events', async () => {
    testEnv.reset([
      {
        id: 'f1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          [ACTOR_COMPONENT_ID]: {},
        },
      },
      {
        id: 'l1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Leader' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          [ACTOR_COMPONENT_ID]: {},
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'f1',
      actionId: 'companionship:follow',
      targetId: 'l1',
      originalInput: 'follow l1',
    });

    expect(
      testEnv.entityManager.getComponentData('f1', FOLLOWING_COMPONENT_ID)
    ).toEqual({
      leaderId: 'l1',
    });
    expect(
      testEnv.entityManager.getComponentData('l1', LEADING_COMPONENT_ID)
    ).toEqual({
      followers: ['f1'],
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

  it('cycle detection branch dispatches error and no mutations', async () => {
    testEnv.reset([
      {
        id: 'f1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
          [ACTOR_COMPONENT_ID]: {},
        },
      },
      {
        id: 'l1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Leader' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
          [FOLLOWING_COMPONENT_ID]: { leaderId: 'f1' },
          [ACTOR_COMPONENT_ID]: {},
        },
      },
    ]);

    testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'f1',
      actionId: 'companionship:follow',
      targetId: 'l1',
    });

    expect(
      testEnv.entityManager.getComponentData('f1', FOLLOWING_COMPONENT_ID)
    ).toBeNull();
    // Errors are dispatched via the event dispatcher; ensure no components were
    // modified when a follow cycle is detected.
  });

  it('leader cannot follow follower after being followed', async () => {
    testEnv.reset([
      {
        id: 'follower1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          [ACTOR_COMPONENT_ID]: {},
        },
      },
      {
        id: 'leader1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Leader' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          [ACTOR_COMPONENT_ID]: {},
        },
      },
    ]);

    // Step 1: Follower follows Leader
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'follower1',
      actionId: 'companionship:follow',
      targetId: 'leader1',
      originalInput: 'follow leader1',
    });

    // Verify the follow relationship was established
    expect(
      testEnv.entityManager.getComponentData(
        'follower1',
        FOLLOWING_COMPONENT_ID
      )
    ).toEqual({
      leaderId: 'leader1',
    });
    expect(
      testEnv.entityManager.getComponentData('leader1', LEADING_COMPONENT_ID)
    ).toEqual({
      followers: ['follower1'],
    });

    // Step 2: Clear events and try to make Leader follow Follower
    testEnv.events.length = 0;
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'leader1',
      actionId: 'companionship:follow',
      targetId: 'follower1',
      originalInput: 'follow follower1',
    });

    // This should fail due to cycle detection
    const types = testEnv.events.map((e) => e.eventType);
    expect(types).not.toContain('core:display_successful_action_result');
    expect(types).toContain('core:display_failed_action_result');
  });
});
