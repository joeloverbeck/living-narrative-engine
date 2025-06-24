/**
 * @file Integration tests for the stop_following rule.
 * @see tests/integration/rules/stopFollowingRule.integration.test.js
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
import eventIsActionStopFollowing from '../../../data/mods/core/conditions/event-is-action-stop-following.condition.json';
import stopFollowingRule from '../../../data/mods/core/rules/stop_following.rule.json';
import logFailureAndEndTurn from '../../../data/mods/core/macros/logFailureAndEndTurn.macro.json';
import displaySuccessAndEndTurn from '../../../data/mods/core/macros/displaySuccessAndEndTurn.macro.json';
import {
  expandMacros,
  validateMacroExpansion,
} from '../../../src/utils/macroUtils.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import BreakFollowRelationHandler from '../../../src/logic/operationHandlers/breakFollowRelationHandler.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import IfCoLocatedHandler from '../../../src/logic/operationHandlers/ifCoLocatedHandler.js';
import jsonLogic from 'json-logic-js';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import AddPerceptionLogEntryHandler from '../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

console.log('DEBUG: Test started');
console.log('DEBUG: Before describe');

// Move makeStubRebuild definition here so it is accessible in all tests
const makeStubRebuild = (em) => ({
  execute({ leaderIds }) {
    for (const lid of leaderIds) {
      const followers = [];
      for (const [id, ent] of em.entities) {
        const f = ent.components[FOLLOWING_COMPONENT_ID];
        if (f?.leaderId === lid) followers.push(id);
      }
      const leader = em.entities.get(lid);
      if (leader) {
        leader.components[LEADING_COMPONENT_ID] = { followers };
      }
    }
  },
});

// Move createHandlers definition here so it is accessible in all tests
const createHandlers = (
  entityManager,
  eventBus,
  logger,
  validatedEventDispatcher,
  safeEventDispatcher
) => {
  return {
    BREAK_FOLLOW_RELATION: new BreakFollowRelationHandler({
      entityManager,
      logger,
      rebuildLeaderListCacheHandler: makeStubRebuild(entityManager),
      safeEventDispatcher: safeEventDispatcher,
    }),
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager: {
        ...entityManager,
        getComponentData: (id, type) => {
          const result = entityManager.getComponentData(id, type);
          return result;
        },
      },
      logger,
      safeEventDispatcher: safeEventDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    IF_CO_LOCATED_FACTORY: (operationInterpreter) =>
      new IfCoLocatedHandler({
        entityManager,
        operationInterpreter,
        logger,
        safeEventDispatcher: safeEventDispatcher,
      }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: { dispatch: (...args) => eventBus.dispatch(...args) },
      logger,
      addPerceptionLogEntryHandler: new AddPerceptionLogEntryHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeEventDispatcher,
      }),
    }),
    DISPATCH_EVENT: new DispatchEventHandler({
      dispatcher: eventBus,
      logger,
    }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeEventDispatcher,
      logger,
    }),
  };
};

describe('stop_following rule integration', () => {
  let events = [];
  let testEnv;

  beforeEach(() => {
    // Prepare macro registry for expandMacros
    const macroRegistry = {
      get: (type, id) => {
        if (type === 'macros') {
          if (id === 'core:displaySuccessAndEndTurn')
            return displaySuccessAndEndTurn;
          if (id === 'core:logFailureAndEndTurn') return logFailureAndEndTurn;
        }
        return undefined;
      },
    };

    const originalActions = JSON.parse(
      JSON.stringify(stopFollowingRule.actions)
    );
    const expandedActions = expandMacros(originalActions, macroRegistry, {
      warn: jest.fn(),
      debug: jest.fn(),
    });

    // Validate that all macros were properly expanded
    if (
      !validateMacroExpansion(expandedActions, macroRegistry, {
        warn: jest.fn(),
        debug: jest.fn(),
      })
    ) {
      throw new Error('Some macros were not fully expanded');
    }

    const expandedRule = {
      ...stopFollowingRule,
      actions: expandedActions,
    };

    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
      getConditionDefinition: jest.fn((id) => {
        if (id === 'core:event-is-action-stop-following')
          return eventIsActionStopFollowing;
        return undefined;
      }),
      getEventDefinition: jest.fn((eventName) => {
        // Return a basic event definition for common events
        const commonEvents = {
          'core:turn_ended': { payloadSchema: null },
          'core:perceptible_event': { payloadSchema: null },
          'core:display_successful_action_result': { payloadSchema: null },
          'core:system_error_occurred': { payloadSchema: null },
          'core:display_failed_action_result': { payloadSchema: null },
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

    // Create entity manager
    const entityManager = new SimpleEntityManager([]);

    // Create operation registry
    const operationRegistry = new OperationRegistry({ logger: testLogger });
    const handlers = createHandlers(
      entityManager,
      bus,
      testLogger,
      validatedEventDispatcher,
      safeEventDispatcher
    );
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
        // Create new entity manager with the new entities
        const newEntityManager = new SimpleEntityManager(newEntities);

        // Recreate handlers with the new entity manager
        const newHandlers = createHandlers(
          newEntityManager,
          bus,
          testLogger,
          validatedEventDispatcher,
          safeEventDispatcher
        );
        const { IF_CO_LOCATED_FACTORY: newIfCoLocatedFactory, ...newRest } =
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

        const newInterpreter = new SystemLogicInterpreter({
          logger: testLogger,
          eventBus: bus,
          dataRegistry: dataRegistry,
          jsonLogicEvaluationService: jsonLogic,
          entityManager: newEntityManager,
          operationInterpreter: newOperationInterpreter,
        });

        newInterpreter.initialize();

        // Update test environment
        testEnv.operationRegistry = newOperationRegistry;
        testEnv.operationInterpreter = newOperationInterpreter;
        testEnv.systemLogicInterpreter = newInterpreter;
        testEnv.entityManager = newEntityManager;

        // Clear events
        capturedEvents.length = 0;
      },
    };

    events = [];
    testEnv.eventBus.subscribe('*', (event) => {
      // Capture both type and eventType for robust event collection
      events.push({
        type: event.type,
        eventType: event.eventType,
        ...event,
      });
    });

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

    console.log('DEBUG: FOLLOWING_COMPONENT_ID =', FOLLOWING_COMPONENT_ID);
    console.log('DEBUG: POSITION_COMPONENT_ID =', POSITION_COMPONENT_ID);
    console.log('DEBUG: LEADING_COMPONENT_ID =', LEADING_COMPONENT_ID);

    // Patch operationInterpreter to log each operation type as it is executed
    const origExecute = OperationInterpreter.prototype.execute;
    OperationInterpreter.prototype.execute = function (
      operation,
      executionContext
    ) {
      console.log(
        'DEBUG: OperationInterpreter.execute called with operation type:',
        operation?.type
      );
      return origExecute.call(this, operation, executionContext);
    };
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('validates stop_following.rule.json against schema', () => {
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
    const valid = ajv.validate(ruleSchema, stopFollowingRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  console.log('DEBUG: Test body started (describe block)');
  it('removes following relationship and emits perceptible event when co-located', async () => {
    console.log('DEBUG: Test body started');

    const entities = [
      {
        id: 'f1',
        components: {
          'core:following': { leaderId: 'l1' },
          'core:position': { locationId: 'loc1' },
        },
      },
      {
        id: 'l1',
        components: {
          'core:leading': { followers: ['f1'] },
          'core:position': { locationId: 'loc1' },
        },
      },
      { id: 'loc1', components: {} },
    ];
    console.log(
      'DEBUG: [test] entities before reset:',
      JSON.stringify(entities, null, 2)
    );
    testEnv.reset(entities);
    events = [];
    testEnv.eventBus.subscribe('*', (event) => {
      // Capture both type and eventType for robust event collection
      events.push({
        type: event.type,
        eventType: event.eventType,
        ...event,
      });
    });
    // Re-create and re-register IF_CO_LOCATED handler after reset
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

    // Register DISPATCH_EVENT handler
    const dispatchEventHandler = createHandlers(
      testEnv.entityManager,
      testEnv.eventBus,
      testEnv.logger,
      testEnv.validatedEventDispatcher,
      testEnv.safeEventDispatcher
    ).DISPATCH_EVENT;
    testEnv.operationRegistry.register(
      'DISPATCH_EVENT',
      dispatchEventHandler.execute.bind(dispatchEventHandler)
    );

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'f1',
      actionId: 'core:stop_following',
    });
    expect(
      testEnv.entityManager.getComponentData('f1', 'core:following')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('l1', 'core:leading')
    ).toEqual({
      followers: [],
    });
    const types = events.map((e) => e.type || e.eventType);
    expect(types).toContain('core:perceptible_event');
    expect(types).toContain('core:display_successful_action_result');
    expect(types).toContain('core:turn_ended');
  });

  it('omits perceptible event when actor and leader are in different locations', async () => {
    const entities = [
      {
        id: 'f1',
        components: {
          'core:following': { leaderId: 'l1' },
          'core:position': { locationId: 'loc1' },
        },
      },
      {
        id: 'l1',
        components: {
          'core:leading': { followers: ['f1'] },
          'core:position': { locationId: 'loc2' },
        },
      },
      { id: 'loc1', components: {} },
      { id: 'loc2', components: {} },
    ];
    testEnv.reset(entities);
    events = [];
    testEnv.eventBus.subscribe('*', (event) => {
      // Capture both type and eventType for robust event collection
      events.push({
        type: event.type,
        eventType: event.eventType,
        ...event,
      });
    });
    // Re-create and re-register IF_CO_LOCATED handler after reset
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
      actorId: 'f1',
      actionId: 'core:stop_following',
    });
    expect(
      testEnv.entityManager.getComponentData('f1', 'core:following')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('l1', 'core:leading')
    ).toEqual({
      followers: [],
    });
    const types = events.map((e) => e.type || e.eventType);
    expect(types).not.toContain('core:perceptible_event');
    expect(types).toContain('core:display_successful_action_result');
    expect(types).toContain('core:turn_ended');
  });

  it('handles not-following branch with error event', async () => {
    const entities = [
      {
        id: 'f1',
        components: {
          'core:position': { locationId: 'loc1' },
        },
      },
      {
        id: 'l1',
        components: {
          'core:leading': { followers: [] },
          'core:position': { locationId: 'loc1' },
        },
      },
      { id: 'loc1', components: {} },
    ];
    testEnv.reset(entities);
    events = [];
    testEnv.eventBus.subscribe('*', (event) => {
      // Capture both type and eventType for robust event collection
      events.push({
        type: event.type,
        eventType: event.eventType,
        ...event,
      });
    });
    // Re-create and re-register IF_CO_LOCATED handler after reset
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
      actorId: 'f1',
      actionId: 'core:stop_following',
    });
    expect(
      testEnv.entityManager.getComponentData('f1', 'core:following')
    ).toBeNull();
    const types = events.map((e) => e.type || e.eventType);
    expect(types).toContain('core:display_failed_action_result');
    expect(types).toContain('core:turn_ended');
  });
});
