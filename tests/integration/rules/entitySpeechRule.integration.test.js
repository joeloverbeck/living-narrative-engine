/**
 * @file Integration tests for entity_speech.rule.json.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import Ajv from 'ajv';
import ruleSchema from '../../../data/schemas/rule.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import entitySpeechRule from '../../../data/mods/core/rules/entity_speech.rule.json';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import QueryComponentOptionalHandler from '../../../src/logic/operationHandlers/queryComponentOptionalHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchSpeechHandler from '../../../src/logic/operationHandlers/dispatchSpeechHandler.js';
import IfHandler from '../../../src/logic/operationHandlers/ifHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import {
  ENTITY_SPOKE_ID,
  DISPLAY_SPEECH_ID,
} from '../../../src/constants/eventIds.js';

class SimpleEntityManager {
  constructor(entities) {
    this.entities = new Map();
    for (const e of entities) {
      this.entities.set(e.id, {
        id: e.id,
        components: { ...e.components },
        getComponentData(type) {
          return this.components[type] ?? null;
        },
        hasComponent(type) {
          return Object.prototype.hasOwnProperty.call(this.components, type);
        },
      });
    }
  }

  getEntityInstance(id) {
    return this.entities.get(id);
  }

  getComponentData(id, type) {
    return this.entities.get(id)?.components[type] ?? null;
  }

  hasComponent(id, type) {
    return Object.prototype.hasOwnProperty.call(
      this.entities.get(id)?.components || {},
      type
    );
  }
}

/**
 *
 * @param entities
 */
function init(entities) {
  operationRegistry = new OperationRegistry({ logger });
  entityManager = new SimpleEntityManager(entities);

  jsonLogic = new JsonLogicEvaluationService({ logger });

  const safeDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };

  operationInterpreter = new OperationInterpreter({
    logger,
    operationRegistry,
  });

  const handlers = {
    QUERY_COMPONENT_OPTIONAL: new QueryComponentOptionalHandler({
      entityManager,
      logger,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    DISPATCH_SPEECH: new DispatchSpeechHandler({
      dispatcher: eventBus,
      logger,
    }),
    IF: new IfHandler({
      logger,
      jsonLogicEvaluationService: jsonLogic,
      operationInterpreter,
    }),
  };

  for (const [type, handler] of Object.entries(handlers)) {
    operationRegistry.register(type, handler.execute.bind(handler));
  }

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

describe('core_entity_speech rule integration', () => {
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

    dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([entitySpeechRule]),
    };

    init([]);
  });

  it('validates entity_speech.rule.json against schema', () => {
    const ajv = new Ajv({ allErrors: true });
    ajv.addSchema(
      commonSchema,
      'http://example.com/schemas/common.schema.json'
    );
    ajv.addSchema(
      operationSchema,
      'http://example.com/schemas/operation.schema.json'
    );
    ajv.addSchema(
      jsonLogicSchema,
      'http://example.com/schemas/json-logic.schema.json'
    );
    const valid = ajv.validate(ruleSchema, entitySpeechRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('dispatches perceptible and display_speech events when requirements met', () => {
    interpreter.shutdown();
    jest.useFakeTimers();
    const fixedDate = new Date('2025-01-01T00:00:00.000Z');
    jest.setSystemTime(fixedDate);
    init([
      {
        id: 's1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Speaker' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    listener({
      type: ENTITY_SPOKE_ID,
      payload: { entityId: 's1', speechContent: 'Hello there' },
    });

    const perceptible = events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptible).toBeDefined();
    expect(perceptible.payload.descriptionText).toBe(
      'Speaker says: "Hello there"'
    );
    expect(perceptible.payload.timestamp).toBe(fixedDate.toISOString());

    const display = events.find((e) => e.eventType === DISPLAY_SPEECH_ID);
    expect(display).toBeDefined();
    expect(display.payload).toEqual({
      entityId: 's1',
      speechContent: 'Hello there',
      allowHtml: false,
    });
    jest.useRealTimers();
  });

  it('does nothing when required components are missing', () => {
    interpreter.shutdown();
    init([
      {
        id: 's1',
        components: {},
      },
    ]);

    listener({
      type: ENTITY_SPOKE_ID,
      payload: { entityId: 's1', speechContent: 'Hi' },
    });

    expect(events.map((e) => e.eventType)).not.toContain(
      'core:perceptible_event'
    );
    expect(events.map((e) => e.eventType)).not.toContain(DISPLAY_SPEECH_ID);
  });
});
