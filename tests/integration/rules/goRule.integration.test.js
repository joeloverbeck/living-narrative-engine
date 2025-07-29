/**
 * @file Integration tests for the go rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import Ajv from 'ajv';
import ruleSchema from '../../../data/schemas/rule.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import loadOperationSchemas from '../../unit/helpers/loadOperationSchemas.js';
import loadConditionSchemas from '../../unit/helpers/loadConditionSchemas.js';
import eventIsActionGo from '../../../data/mods/core/conditions/event-is-action-go.condition.json';
import goRule from '../../../data/mods/core/rules/go.rule.json';
import displaySuccessAndEndTurn from '../../../data/mods/core/macros/displaySuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import ModifyComponentHandler from '../../../src/logic/operationHandlers/modifyComponentHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import AddPerceptionLogEntryHandler from '../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import QueryComponentsHandler from '../../../src/logic/operationHandlers/queryComponentsHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import goAction from '../../../data/mods/core/actions/go.action.json';
import { createJsonLogicContext } from '../../../src/logic/contextAssembler.js';
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

describe('core_handle_go rule integration', () => {
  let testEnv;
  let customEntityManager;
  let events = [];

  /**
   *
   */
  function setupListener() {
    events = [];
    testEnv.eventBus.subscribe('*', (event) => {
      events.push(event);
    });
  }

  /**
   * Creates handlers needed for the go rule.
   *
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @param {object} safeEventDispatcher - Safe event dispatcher instance
   * @returns {object} Handlers object
   */
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
        safeEventDispatcher: safeEventDispatcher,
      }),
      QUERY_COMPONENTS: new QueryComponentsHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeEventDispatcher,
      }),
      GET_TIMESTAMP: new GetTimestampHandler({ logger }),
      SET_VARIABLE: new SetVariableHandler({ logger }),
      MODIFY_COMPONENT: new ModifyComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeEventDispatcher,
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
      DISPATCH_EVENT: new DispatchEventHandler({
        dispatcher: eventBus,
        logger,
      }),
      END_TURN: new EndTurnHandler({
        safeEventDispatcher: safeEventDispatcher,
        logger,
      }),
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

    const expandedRule = {
      ...goRule,
      actions: expandMacros(goRule.actions, macroRegistry, null),
    };

    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'core:event-is-action-go' ? eventIsActionGo : undefined
      ),
      getEventDefinition: jest.fn((eventName) => {
        // Return a basic event definition for common events
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

    testEnv = {
      eventBus: bus,
      events: events,
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

  it('validates go.rule.json against schema', () => {
    const ajv = new Ajv({ allErrors: true });
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );
    ajv.addSchema(
      operationSchema,
      'schema://living-narrative-engine/operation.schema.json'
    );
    loadOperationSchemas(ajv);
    loadConditionSchemas(ajv);
    ajv.addSchema(
      jsonLogicSchema,
      'schema://living-narrative-engine/json-logic.schema.json'
    );
    const valid = ajv.validate(ruleSchema, goRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('moves actor when pre-resolved targetId provided', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Hero' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
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
      { id: 'locA', components: { [NAME_COMPONENT_ID]: { text: 'Loc A' } } },
      { id: 'locB', components: { [NAME_COMPONENT_ID]: { text: 'Loc B' } } },
    ]);
    setupListener();
    testEnv.entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
      { direction: 'north', target: 'locB' },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'core:go',
      targetId: 'locB',
      originalInput: 'go north',
    });

    expect(
      testEnv.entityManager.getComponentData('actor1', POSITION_COMPONENT_ID)
    ).toEqual({
      locationId: 'locB',
    });
    const types = events.map((e) => e.type);
    expect(types).toContain('core:perceptible_event');
    expect(types).toContain('core:entity_moved');
    expect(types).toContain('core:display_successful_action_result');
    expect(types).toContain('core:turn_ended');
  });

  // DELETED: The invalid test case 'moves actor using direction when targetId missing' was here.

  it('fails when targetId is missing', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Hero' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
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
      { id: 'locA', components: { [NAME_COMPONENT_ID]: { text: 'Loc A' } } },
    ]);
    setupListener();
    testEnv.entityManager.addComponent('locA', EXITS_COMPONENT_ID, []);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'core:go',
      targetId: null,
      originalInput: 'go south',
    });

    expect(
      testEnv.entityManager.getComponentData('actor1', POSITION_COMPONENT_ID)
    ).toEqual({
      locationId: 'locA',
    });
    const types = events.map((e) => e.type);
    expect(types).toContain('core:display_failed_action_result');
    expect(types).toContain('core:turn_ended');
    expect(types).not.toContain('core:entity_moved');
  });

  it('movement succeeds when locked flag is false', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Hero' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
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
      { id: 'locA', components: { [NAME_COMPONENT_ID]: { text: 'Loc A' } } },
      { id: 'locB', components: { [NAME_COMPONENT_ID]: { text: 'Loc B' } } },
    ]);
    setupListener();
    testEnv.entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
      { direction: 'north', target: 'locB' },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'core:go',
      targetId: 'locB',
      originalInput: 'go north',
    });

    expect(
      testEnv.entityManager.getComponentData('actor1', POSITION_COMPONENT_ID)
    ).toEqual({ locationId: 'locB' });
    const types = events.map((e) => e.type);
    expect(types).toContain('core:perceptible_event');
    expect(types).toContain('core:entity_moved');
    expect(types).toContain('core:display_successful_action_result');
    expect(types).toContain('core:turn_ended');
  });

  it('prerequisite check fails when movement locked', () => {
    const prereq = goAction.prerequisites[0].logic;
    const ctx = createJsonLogicContext(
      {
        type: ATTEMPT_ACTION_ID,
        payload: { actorId: 'actor1', actionId: 'core:go' },
      },
      'actor1',
      null,
      {
        getComponentData(id, type) {
          if (type === 'core:movement') return { locked: true };
          if (type === 'core:name') return { text: 'Hero' };
          if (type === 'core:position') return { locationId: 'locA' };
          return null;
        },
        getEntityInstance(id) {
          return { id };
        },
        hasComponent() {
          return true;
        },
      },
      testEnv.logger
    );
    const result = testEnv.jsonLogic.evaluate(prereq, ctx.context);
    expect(result).toBe(false);
  });

  describe('Multi-target backward compatibility', () => {
    it('handles multi-target event payload format', async () => {
      testEnv.reset([
        {
          id: 'actor1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Hero' },
            [POSITION_COMPONENT_ID]: { locationId: 'locA' },
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
        { id: 'locA', components: { [NAME_COMPONENT_ID]: { text: 'Loc A' } } },
        { id: 'locB', components: { [NAME_COMPONENT_ID]: { text: 'Loc B' } } },
      ]);
      setupListener();
      testEnv.entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
        { direction: 'north', target: 'locB' },
      ]);

      // Test with new multi-target event structure
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actorId: 'actor1',
        actionId: 'core:go',
        targets: { primary: 'locB' },
        targetId: 'locB', // Backward compatibility
        originalInput: 'go north',
      });

      // Same assertions as legacy test
      expect(
        testEnv.entityManager.getComponentData('actor1', POSITION_COMPONENT_ID)
      ).toEqual({ locationId: 'locB' });

      const types = events.map((e) => e.type);
      expect(types).toContain('core:perceptible_event');
      expect(types).toContain('core:entity_moved');
      expect(types).toContain('core:display_successful_action_result');
      expect(types).toContain('core:turn_ended');
    });

    it('maintains backward compatibility with legacy event format', async () => {
      testEnv.reset([
        {
          id: 'actor1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Hero' },
            [POSITION_COMPONENT_ID]: { locationId: 'locA' },
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
        { id: 'locA', components: { [NAME_COMPONENT_ID]: { text: 'Loc A' } } },
        { id: 'locB', components: { [NAME_COMPONENT_ID]: { text: 'Loc B' } } },
      ]);
      setupListener();
      testEnv.entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
        { direction: 'north', target: 'locB' },
      ]);

      // Test with legacy event structure (no targets field)
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actorId: 'actor1',
        actionId: 'core:go',
        targetId: 'locB',
        originalInput: 'go north',
      });

      // Same results expected
      expect(
        testEnv.entityManager.getComponentData('actor1', POSITION_COMPONENT_ID)
      ).toEqual({ locationId: 'locB' });

      const types = events.map((e) => e.type);
      expect(types).toContain('core:perceptible_event');
      expect(types).toContain('core:entity_moved');
      expect(types).toContain('core:display_successful_action_result');
      expect(types).toContain('core:turn_ended');
    });
  });
});
