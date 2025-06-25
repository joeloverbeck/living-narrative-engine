/**
 * @file Integration tests for follow_auto_move.rule.json.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import actorIsNotNull from '../../../data/mods/core/conditions/actor-is-not-null.condition.json';
import followAutoMoveRule from '../../../data/mods/core/rules/follow_auto_move.rule.json';
import autoMoveFollowerMacro from '../../../data/mods/core/macros/autoMoveFollower.macro.json';
import {
  expandMacros,
  findUnexpandedMacros,
} from '../../../src/utils/macroUtils.js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import RebuildLeaderListCacheHandler from '../../../src/logic/operationHandlers/rebuildLeaderListCacheHandler.js';
import QueryEntitiesHandler from '../../../src/logic/operationHandlers/queryEntitiesHandler.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import SystemMoveEntityHandler from '../../../src/logic/operationHandlers/systemMoveEntityHandler.js';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import AddPerceptionLogEntryHandler from '../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

/**
 * Creates handlers needed for the follow_auto_move rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @param {object} jsonLogicEvaluationService - JsonLogicEvaluationService instance
 * @param {object} validatedEventDispatcher - ValidatedEventDispatcher instance
 * @param {object} safeEventDispatcher - SafeEventDispatcher instance
 * @returns {object} Handlers object
 */
function createHandlers(
  entityManager,
  eventBus,
  logger,
  jsonLogicEvaluationService,
  validatedEventDispatcher,
  safeEventDispatcher
) {
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
    REBUILD_LEADER_LIST_CACHE: new RebuildLeaderListCacheHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    QUERY_ENTITIES: new QueryEntitiesHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
      jsonLogicEvaluationService,
    }),
    SYSTEM_MOVE_ENTITY: new SystemMoveEntityHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
  };
}

describe('core_handle_follow_auto_move rule integration', () => {
  let testEnv;
  let customEntityManager;

  beforeEach(() => {
    customEntityManager = new SimpleEntityManager([]);
    const macroRegistry = {
      get: (type, id) =>
        type === 'macros' && id === 'core:autoMoveFollower'
          ? autoMoveFollowerMacro
          : undefined,
    };
    const expandedActions = expandMacros(
      followAutoMoveRule.actions,
      macroRegistry,
      testEnv?.logger
    );
    const unexpanded = findUnexpandedMacros(expandedActions);
    if (unexpanded.length > 0) {
      console.error(
        'Unexpanded macros found in follow_auto_move.rule.json:',
        unexpanded
      );
      throw new Error('Unexpanded macros remain after expansion!');
    }
    const expandedRule = {
      ...followAutoMoveRule,
      actions: expandedActions,
    };

    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'core:actor-is-not-null' ? actorIsNotNull : undefined
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
      jsonLogic,
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

    // Debug: Check if there are any errors during initialization
    try {
      interpreter.initialize();
      console.log('DEBUG: Interpreter initialized successfully');
    } catch (error) {
      console.error('DEBUG: Error during interpreter initialization:', error);
    }

    // Debug: Check if the interpreter was initialized properly
    console.log(
      'DEBUG: After initialize - rule cache size:',
      interpreter._ruleCache?.size
    );
    console.log(
      'DEBUG: After initialize - rule cache keys:',
      Array.from(interpreter._ruleCache?.keys() || [])
    );
    console.log(
      'DEBUG: After initialize - dataRegistry.getAllSystemRules called:',
      dataRegistry.getAllSystemRules.mock?.calls?.length
    );

    // Debug: Check the rules being passed to the interpreter
    const rules = dataRegistry.getAllSystemRules();
    console.log('DEBUG: Rules passed to interpreter:', rules);
    console.log('DEBUG: Rule event_type:', rules[0]?.event_type);
    console.log('DEBUG: Rule condition:', rules[0]?.condition);

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
          jsonLogic,
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

  it('performs follow auto move action successfully', () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Actor' },
          [POSITION_COMPONENT_ID]: { locationId: 'room2' },
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

    testEnv.eventBus.dispatch('core:entity_moved', {
      entityId: 'actor1',
      previousLocationId: 'room1',
      currentLocationId: 'room2',
    });

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
      ])
    );
  });
});
