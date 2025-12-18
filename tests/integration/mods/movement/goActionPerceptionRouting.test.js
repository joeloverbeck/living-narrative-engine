/**
 * @file Integration tests for go action perception routing.
 * @description Verifies that actor_description is correctly routed to the actor
 * while observers receive description_text.
 *
 * Bug being fixed: Actor sees third-person messages ("Jorren 'Mudsong' Weir leaves...")
 * instead of first-person messages ("I leave to go to...").
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import goRule from '../../../../data/mods/movement/rules/go.rule.json';
import logPerceptibleEventsRule from '../../../../data/mods/core/rules/log_perceptible_events.rule.json';
import displaySuccessAndEndTurn from '../../../../data/mods/core/macros/displaySuccessAndEndTurn.macro.json';
import eventIsActionGo from '../../../../data/mods/movement/conditions/event-is-action-go.condition.json';
import { expandMacros } from '../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import ModifyComponentHandler from '../../../../src/logic/operationHandlers/modifyComponentHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import AddPerceptionLogEntryHandler from '../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import QueryComponentsHandler from '../../../../src/logic/operationHandlers/queryComponentsHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
  PERCEPTION_LOG_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../../src/events/eventBus.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import SystemLogicInterpreter from '../../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';

describe('Go Action - Perception Routing', () => {
  let testEnv;
  let customEntityManager;
  let events = [];

  function setupListener() {
    events = [];
    testEnv.eventBus.subscribe('*', (event) => {
      events.push(event);
    });
  }

  function createHandlers(
    entityManager,
    eventBus,
    logger,
    safeEventDispatcher
  ) {
    return {
      QUERY_COMPONENT: new QueryComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher,
      }),
      QUERY_COMPONENTS: new QueryComponentsHandler({
        entityManager,
        logger,
        safeEventDispatcher,
      }),
      GET_TIMESTAMP: new GetTimestampHandler({ logger }),
      SET_VARIABLE: new SetVariableHandler({ logger }),
      MODIFY_COMPONENT: new ModifyComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher,
      }),
      DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
        dispatcher: eventBus,
        logger,
        addPerceptionLogEntryHandler: new AddPerceptionLogEntryHandler({
          entityManager,
          logger,
          safeEventDispatcher,
        }),
      }),
      DISPATCH_EVENT: new DispatchEventHandler({
        dispatcher: eventBus,
        logger,
      }),
      END_TURN: new EndTurnHandler({
        safeEventDispatcher,
        logger,
      }),
      ADD_PERCEPTION_LOG_ENTRY: new AddPerceptionLogEntryHandler({
        entityManager,
        logger,
        safeEventDispatcher,
      }),
      IF: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
    };
  }

  beforeEach(() => {
    customEntityManager = new SimpleEntityManager([]);
    const macroRegistry = {
      get: (type, id) =>
        type === 'macros'
          ? { 'core:displaySuccessAndEndTurn': displaySuccessAndEndTurn }[id]
          : undefined,
    };

    const expandedGoRule = {
      ...goRule,
      actions: expandMacros(goRule.actions, macroRegistry, null),
    };

    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([
        expandedGoRule,
        logPerceptibleEventsRule,
      ]),
      getConditionDefinition: jest.fn((id) =>
        id === 'movement:event-is-action-go' ? eventIsActionGo : undefined
      ),
      getEventDefinition: jest.fn((eventName) => {
        const commonEvents = {
          'core:turn_ended': { payloadSchema: null },
          'core:perceptible_event': { payloadSchema: null },
          'core:display_successful_action_result': { payloadSchema: null },
          'core:display_failed_action_result': { payloadSchema: null },
          'core:entity_moved': { payloadSchema: null },
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
      schemaValidator,
      logger: testLogger,
    });

    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger: testLogger,
    });

    const jsonLogic = new JsonLogicEvaluationService({
      logger: testLogger,
      gameDataRepository: dataRegistry,
    });

    const operationRegistry = new OperationRegistry({ logger: testLogger });
    const handlers = createHandlers(
      customEntityManager,
      bus,
      testLogger,
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
      dataRegistry,
      jsonLogicEvaluationService: jsonLogic,
      entityManager: customEntityManager,
      operationInterpreter,
      bodyGraphService: mockBodyGraphService,
    });

    interpreter.initialize();

    testEnv = {
      eventBus: bus,
      events,
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
        customEntityManager = new SimpleEntityManager(newEntities);

        const newHandlers = createHandlers(
          customEntityManager,
          bus,
          testLogger,
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
          dataRegistry,
          jsonLogicEvaluationService: jsonLogic,
          entityManager: customEntityManager,
          operationInterpreter: newOperationInterpreter,
          bodyGraphService: mockBodyGraphService,
        });

        newInterpreter.initialize();

        testEnv.operationRegistry = newOperationRegistry;
        testEnv.operationInterpreter = newOperationInterpreter;
        testEnv.systemLogicInterpreter = newInterpreter;
        testEnv.entityManager = customEntityManager;

        events.length = 0;
      },
    };

    setupListener();
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  describe('actor_description routing', () => {
    it('should deliver first-person departure message to actor', async () => {
      // Setup: actor and observer in location A, actor moves to location B
      testEnv.reset([
        {
          id: 'actor1',
          components: {
            [NAME_COMPONENT_ID]: { text: "Jorren 'Mudsong' Weir" },
            [POSITION_COMPONENT_ID]: { locationId: 'locA' },
            [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 50, logEntries: [] },
            'anatomy:body': { rootEntityId: 'body-actor1' },
          },
        },
        {
          id: 'body-actor1',
          components: {
            'anatomy:part': { parentId: null, type: 'body' },
          },
        },
        {
          id: 'leg-left-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: 'leg-right-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: 'observer1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Observer' },
            [POSITION_COMPONENT_ID]: { locationId: 'locA' },
            [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 50, logEntries: [] },
          },
        },
        {
          id: 'locA',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Service Stair' },
          },
        },
        {
          id: 'locB',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Lower Gallery' },
          },
        },
      ]);
      setupListener();
      testEnv.entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
        { direction: 'north', target: 'locB' },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actorId: 'actor1',
        actionId: 'movement:go',
        targetId: 'locB',
        originalInput: 'go north',
      });

      // Verify actor's perception log - should have first-person message
      const actorPerceptionLog = testEnv.entityManager.getComponentData(
        'actor1',
        PERCEPTION_LOG_COMPONENT_ID
      );

      // Find the departure entry
      const departureEntry = actorPerceptionLog.logEntries.find(
        (entry) => entry.perceptionType === 'movement.departure'
      );

      expect(departureEntry).toBeDefined();
      // Actor should see first-person: "I leave to go to Lower Gallery."
      // NOT third-person: "Jorren 'Mudsong' Weir leaves to go to Lower Gallery."
      expect(departureEntry.descriptionText).toBe(
        'I leave to go to Lower Gallery.'
      );
      expect(departureEntry.perceivedVia).toBe('self');
    });

    it('should deliver first-person arrival message to actor', async () => {
      // Setup: actor in location A, observer in location B
      testEnv.reset([
        {
          id: 'actor1',
          components: {
            [NAME_COMPONENT_ID]: { text: "Jorren 'Mudsong' Weir" },
            [POSITION_COMPONENT_ID]: { locationId: 'locA' },
            [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 50, logEntries: [] },
            'anatomy:body': { rootEntityId: 'body-actor1' },
          },
        },
        {
          id: 'body-actor1',
          components: {
            'anatomy:part': { parentId: null, type: 'body' },
          },
        },
        {
          id: 'leg-left-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: 'leg-right-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: 'observer2',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Observer at Destination' },
            [POSITION_COMPONENT_ID]: { locationId: 'locB' },
            [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 50, logEntries: [] },
          },
        },
        {
          id: 'locA',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Service Stair' },
          },
        },
        {
          id: 'locB',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Lower Gallery' },
          },
        },
      ]);
      setupListener();
      testEnv.entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
        { direction: 'north', target: 'locB' },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actorId: 'actor1',
        actionId: 'movement:go',
        targetId: 'locB',
        originalInput: 'go north',
      });

      // Verify actor's perception log - should have first-person arrival message
      const actorPerceptionLog = testEnv.entityManager.getComponentData(
        'actor1',
        PERCEPTION_LOG_COMPONENT_ID
      );

      // Find the arrival entry
      const arrivalEntry = actorPerceptionLog.logEntries.find(
        (entry) => entry.perceptionType === 'movement.arrival'
      );

      expect(arrivalEntry).toBeDefined();
      // Actor should see first-person: "I arrive from Service Stair."
      expect(arrivalEntry.descriptionText).toBe('I arrive from Service Stair.');
      expect(arrivalEntry.perceivedVia).toBe('self');
    });

    it('should deliver third-person departure message to observers in origin location', async () => {
      testEnv.reset([
        {
          id: 'actor1',
          components: {
            [NAME_COMPONENT_ID]: { text: "Jorren 'Mudsong' Weir" },
            [POSITION_COMPONENT_ID]: { locationId: 'locA' },
            [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 50, logEntries: [] },
            'anatomy:body': { rootEntityId: 'body-actor1' },
          },
        },
        {
          id: 'body-actor1',
          components: {
            'anatomy:part': { parentId: null, type: 'body' },
          },
        },
        {
          id: 'leg-left-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: 'leg-right-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: 'observer1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Observer' },
            [POSITION_COMPONENT_ID]: { locationId: 'locA' },
            [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 50, logEntries: [] },
          },
        },
        {
          id: 'locA',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Service Stair' },
          },
        },
        {
          id: 'locB',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Lower Gallery' },
          },
        },
      ]);
      setupListener();
      testEnv.entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
        { direction: 'north', target: 'locB' },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actorId: 'actor1',
        actionId: 'movement:go',
        targetId: 'locB',
        originalInput: 'go north',
      });

      // Verify observer's perception log - should have third-person message
      const observerPerceptionLog = testEnv.entityManager.getComponentData(
        'observer1',
        PERCEPTION_LOG_COMPONENT_ID
      );

      const departureEntry = observerPerceptionLog.logEntries.find(
        (entry) => entry.perceptionType === 'movement.departure'
      );

      expect(departureEntry).toBeDefined();
      // Observer should see third-person: "Jorren 'Mudsong' Weir leaves to go to Lower Gallery."
      expect(departureEntry.descriptionText).toBe(
        "Jorren 'Mudsong' Weir leaves to go to Lower Gallery."
      );
      // Observer does NOT have 'self' perceivedVia
      expect(departureEntry.perceivedVia).not.toBe('self');
    });

    it('should deliver third-person arrival message to observers in destination location', async () => {
      testEnv.reset([
        {
          id: 'actor1',
          components: {
            [NAME_COMPONENT_ID]: { text: "Jorren 'Mudsong' Weir" },
            [POSITION_COMPONENT_ID]: { locationId: 'locA' },
            [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 50, logEntries: [] },
            'anatomy:body': { rootEntityId: 'body-actor1' },
          },
        },
        {
          id: 'body-actor1',
          components: {
            'anatomy:part': { parentId: null, type: 'body' },
          },
        },
        {
          id: 'leg-left-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: 'leg-right-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: 'observer2',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Observer at Destination' },
            [POSITION_COMPONENT_ID]: { locationId: 'locB' },
            [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 50, logEntries: [] },
          },
        },
        {
          id: 'locA',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Service Stair' },
          },
        },
        {
          id: 'locB',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Lower Gallery' },
          },
        },
      ]);
      setupListener();
      testEnv.entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
        { direction: 'north', target: 'locB' },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actorId: 'actor1',
        actionId: 'movement:go',
        targetId: 'locB',
        originalInput: 'go north',
      });

      // Verify observer's perception log - should have third-person arrival message
      const observerPerceptionLog = testEnv.entityManager.getComponentData(
        'observer2',
        PERCEPTION_LOG_COMPONENT_ID
      );

      const arrivalEntry = observerPerceptionLog.logEntries.find(
        (entry) => entry.perceptionType === 'movement.arrival'
      );

      expect(arrivalEntry).toBeDefined();
      // Observer should see: "Jorren 'Mudsong' Weir arrives from Service Stair."
      expect(arrivalEntry.descriptionText).toBe(
        "Jorren 'Mudsong' Weir arrives from Service Stair."
      );
      expect(arrivalEntry.perceivedVia).not.toBe('self');
    });
  });
});
