/**
 * @file Integration tests for the dismiss rule.
 * @see tests/integration/dismissRule.integration.test.js
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import eventIsActionDismiss from '../../../../data/mods/companionship/conditions/event-is-action-dismiss.condition.json';
import dismissRule from '../../../../data/mods/companionship/rules/dismiss.rule.json';
import displaySuccessAndEndTurn from '../../../../data/mods/core/macros/displaySuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../../src/utils/macroUtils.js';
import SystemLogicInterpreter from '../../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import RemoveComponentHandler from '../../../../src/logic/operationHandlers/removeComponentHandler.js';
import ModifyArrayFieldHandler from '../../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import IfCoLocatedHandler from '../../../../src/logic/operationHandlers/ifCoLocatedHandler.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import AddPerceptionLogEntryHandler from '../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../../src/events/eventBus.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';

/**
 * Creates handlers needed for the dismiss rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @param {ValidatedEventDispatcher} validatedEventDispatcher - Event dispatcher used for validation
 * @param {SafeEventDispatcher} safeEventDispatcher - Event dispatcher used for safe events
 * @returns {object} Handlers object
 */
function createHandlers(
  entityManager,
  eventBus,
  logger,
  validatedEventDispatcher,
  safeEventDispatcher
) {
  // Create mock routing policy service for recipient/exclusion validation
  const routingPolicyService = {
    validateAndHandle: jest.fn().mockReturnValue(true),
  };

  // Create mock recipient set builder
  const recipientSetBuilder = {
    build: jest.fn(({ locationId }) => ({
      entityIds: entityManager.getEntitiesInLocation
        ? entityManager.getEntitiesInLocation(locationId)
        : new Set(),
      mode: 'broadcast',
    })),
  };

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
      routingPolicyService,
      recipientSetBuilder,
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
    // Mock handler for REGENERATE_DESCRIPTION - satisfies fail-fast enforcement
    REGENERATE_DESCRIPTION: {
      execute: jest.fn().mockResolvedValue(undefined),
    },
    // Real handler for SET_VARIABLE - rule depends on variable values
    SET_VARIABLE: new SetVariableHandler({ logger }),
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
      actions: expandMacros(
        dismissRule.actions,
        macroRegistry,
        testEnv?.logger
      ),
    };

    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'companionship:event-is-action-dismiss'
          ? eventIsActionDismiss
          : undefined
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
    const schemaValidator = new AjvSchemaValidator({ logger: testLogger });
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
    const handlers = createHandlers(
      entityManager,
      bus,
      testLogger,
      validatedEventDispatcher,
      safeEventDispatcher
    );
    // eslint-disable-next-line no-unused-vars
    const { IF_CO_LOCATED_FACTORY: _unusedFactory, ...rest } = handlers;
    for (const [type, handler] of Object.entries(rest)) {
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
      entityManager: entityManager,
      operationInterpreter,
      bodyGraphService: mockBodyGraphService,
    });
    const capturedEvents = [];
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
        const newHandlers = createHandlers(
          newEntityManager,
          bus,
          testLogger,
          validatedEventDispatcher,
          safeEventDispatcher
        );
        // eslint-disable-next-line no-unused-vars
        const { IF_CO_LOCATED_FACTORY: _unusedNewFactory, ...newRest } =
          newHandlers;
        const newOperationRegistry = new OperationRegistry({
          logger: testLogger,
        });
        for (const [type, handler] of Object.entries(newRest)) {
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
          entityManager: newEntityManager,
          operationInterpreter: newOperationInterpreter,
          bodyGraphService: mockBodyGraphService,
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

  it('performs dismiss action successfully with legacy event format', async () => {
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

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'companionship:dismiss',
      targetId: 'target1',
      originalInput: 'dismiss target1',
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

  it('performs dismiss action successfully with multi-target event format', async () => {
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

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'companionship:dismiss',
      targets: {
        primary: 'target1',
      },
      targetId: 'target1', // Maintained for backward compatibility
      originalInput: 'dismiss Target',
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

  it('verifies rule processes both event formats identically', async () => {
    const setupEntities = () => [
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
    ];

    // Test legacy format
    testEnv.reset(setupEntities());
    let ifCoLocatedHandler = createHandlers(
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

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'companionship:dismiss',
      targetId: 'target1',
      originalInput: 'dismiss target1',
    });

    const legacyEvents = [...testEnv.events];

    // Test multi-target format
    testEnv.reset(setupEntities());
    ifCoLocatedHandler = createHandlers(
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

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'companionship:dismiss',
      targets: {
        primary: 'target1',
      },
      targetId: 'target1',
      originalInput: 'dismiss Target',
    });

    const multiTargetEvents = [...testEnv.events];

    // Both formats should produce the same event types
    const legacyTypes = [
      ...new Set(legacyEvents.map((e) => e.eventType)),
    ].sort();
    const multiTargetTypes = [
      ...new Set(multiTargetEvents.map((e) => e.eventType)),
    ].sort();
    expect(legacyTypes).toEqual(multiTargetTypes);

    // Both should successfully remove the following component
    const targetEntity = testEnv.entityManager.getEntityInstance('target1');
    expect(targetEntity.getComponentData(FOLLOWING_COMPONENT_ID)).toBeNull();

    // Both should update the leader's followers list
    const actorEntity = testEnv.entityManager.getEntityInstance('actor1');
    const leadingComponent = actorEntity.getComponentData(LEADING_COMPONENT_ID);
    expect(leadingComponent.followers).not.toContain('target1');
  });
});
