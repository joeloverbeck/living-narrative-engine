/**
 * @file Integration tests for the intimacy:thumb_wipe_cheek rule.
 * @see tests/integration/rules/intimacy/thumbWipeCheekRule.integration.test.js
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import Ajv from 'ajv';
import ruleSchema from '../../../data/schemas/rule.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import conditionSchema from '../../../data/schemas/condition.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';
import loadOperationSchemas from '../../helpers/loadOperationSchemas.js';
import loadConditionSchemas from '../../helpers/loadConditionSchemas.js';
import eventIsActionThumbWipeCheek from '../../../data/mods/intimacy/conditions/event-is-action-thumb-wipe-cheek.condition.json';
import thumbWipeCheekRule from '../../../data/mods/intimacy/rules/thumb_wipe_cheek.rule.json';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js'; // Import the new handler
import { expandMacros } from '../../../src/utils/macroUtils.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';

/**
 * Simple entity manager used in integration tests.
 */
class SimpleEntityManager {
  constructor(entities) {
    this.entities = new Map();
    for (const e of entities) {
      this.entities.set(e.id, {
        id: e.id,
        components: { ...e.components },
      });
    }
  }

  getEntityInstance(id) {
    return this.entities.get(id);
  }

  getComponentData(id, type) {
    return this.entities.get(id)?.components[type] ?? null;
  }

  /**
   * Check if an entity has a component.
   *
   * @description Checks if an entity has a component.
   * @param {string} id - entity id
   * @param {string} type - component type
   * @returns {boolean} true if component exists
   */
  hasComponent(id, type) {
    return Object.prototype.hasOwnProperty.call(
      this.entities.get(id)?.components || {},
      type
    );
  }
}

let logger;
let eventBus;
let dataRegistry;
let entityManager;
let operationRegistry;
let operationInterpreter;
let jsonLogic;
let interpreter;
let events;
let listener;
let safeDispatcher;

/**
 * Initializes the interpreter and registers handlers for this test suite.
 *
 * @param {Array<{id:string,components:object}>} entities - Seed entities.
 */
function init(entities) {
  operationRegistry = new OperationRegistry({ logger });
  entityManager = new SimpleEntityManager(entities);
  operationInterpreter = new OperationInterpreter({
    logger,
    operationRegistry,
  });

  const handlers = {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      addPerceptionLogEntryHandler: { execute: jest.fn() },
    }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeDispatcher,
      logger,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    // Register the new handler needed by the updated rule
    SET_VARIABLE: new SetVariableHandler({ logger }),
  };

  for (const [type, handler] of Object.entries(handlers)) {
    operationRegistry.register(type, handler.execute.bind(handler));
  }

  jsonLogic = new JsonLogicEvaluationService({
    logger,
    gameDataRepository: dataRegistry,
  });

  interpreter = new SystemLogicInterpreter({
    logger,
    eventBus,
    dataRegistry,
    jsonLogicEvaluationService: jsonLogic,
    entityManager,
    operationInterpreter,
  });

  listener = null;
  interpreter.initialize();
}

describe('intimacy:handle_thumb_wipe_cheek rule integration', () => {
  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    events = [];
    eventBus = {
      subscribe: jest.fn((ev, l) => {
        if (ev === '*') listener = l;
      }),
      unsubscribe: jest.fn(),
      dispatch: jest.fn((eventType, payload) => {
        events.push({ eventType, payload });
        return Promise.resolve();
      }),
      listenerCount: jest.fn().mockReturnValue(1),
    };

    safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        events.push({ eventType, payload });
        return Promise.resolve(true);
      }),
    };

    const macroRegistry = {
      get: (type, id) =>
        type === 'macros' && id === 'core:logSuccessAndEndTurn'
          ? logSuccessMacro
          : undefined,
    };

    const expandedRule = {
      ...thumbWipeCheekRule,
      actions: expandMacros(
        JSON.parse(JSON.stringify(thumbWipeCheekRule.actions)),
        macroRegistry,
        logger
      ),
    };

    dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'intimacy:event-is-action-thumb-wipe-cheek'
          ? eventIsActionThumbWipeCheek
          : undefined
      ),
    };

    init([]);
  });

  it('validates the rule against the schema', () => {
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

    const valid = ajv.validate(ruleSchema, thumbWipeCheekRule);
    if (!valid) {
      console.error('Validation errors:', ajv.errors);
    }
    expect(valid).toBe(true);
  });

  it('should dispatch correct third-person events for actor and observers', () => {
    // 1. Setup: Create an actor and a target with all necessary components.
    interpreter.shutdown();
    init([
      {
        id: 'hero',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Hero' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'friend',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Friend' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    // 2. Act: Trigger the rule by simulating the action attempt.
    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'hero',
        actionId: 'intimacy:thumb_wipe_cheek',
        targetId: 'friend',
      },
    });

    const expectedMessage =
      "Hero gently brushes their thumb across Friend's cheek.";

    // 3. Assert: Check that the correct events were dispatched with the correct payloads.
    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );

    const perceptibleEvent = events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();

    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
    expect(perceptibleEvent.payload.actorId).toBe('hero');
    expect(perceptibleEvent.payload.targetId).toBe('friend');

    const uiEvent = events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(uiEvent).toBeDefined();

    expect(uiEvent.payload.message).toBeDefined();

    // Assert the turn ended correctly
    const turnEvent = events.find((e) => e.eventType === 'core:turn_ended');
    expect(turnEvent).toBeDefined();
    expect(turnEvent.payload).toEqual({ entityId: 'hero', success: true });
  });

  it('should function gracefully if name or position components are missing', () => {
    // 1. Setup: Actor is missing a name, target is missing a position.
    interpreter.shutdown();
    init([
      {
        id: 'hero',
        components: {
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'friend',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Friend' },
          // No position component on target
        },
      },
    ]);

    // 2. Act: Trigger the rule.
    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'hero',
        actionId: 'intimacy:thumb_wipe_cheek',
        targetId: 'friend',
      },
    });

    // 3. Assert: The system does not crash and completes the action.
    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toContain('core:turn_ended');

    const expectedMessage =
      "Unnamed Character gently brushes their thumb across Friend's cheek.";

    // Assert the messages are formed with default names (e.g., "unknown")

    const perceptibleEvent = events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();

    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);

    const uiEvent = events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(uiEvent).toBeDefined();

    expect(uiEvent.payload.message).toBeDefined();
  });
});
