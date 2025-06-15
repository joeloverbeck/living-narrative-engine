/**
 * @file Integration tests for the intimacy_show_onlookers rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import Ajv from 'ajv';
import ruleSchema from '../../../data/schemas/rule.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import showOnlookersRule from '../../../data/mods/intimacy/rules/intimacy_show_onlookers.rule.json';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import QueryEntitiesHandler from '../../../src/logic/operationHandlers/queryEntitiesHandler.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { buildABCDWorld } from '../fixtures/intimacyFixtures.js';

class SimpleEntityManager {
  constructor(entities) {
    this.entities = new Map();
    for (const e of entities) {
      this.entities.set(e.id, {
        id: e.id,
        components: { ...e.components },
      });
    }
    this.activeEntities = new Map(this.entities);
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

  addComponent(id, type, data) {
    const ent = this.entities.get(id);
    if (ent) {
      ent.components[type] = JSON.parse(JSON.stringify(data));
    }
  }

  getEntitiesInLocation(locationId) {
    const ids = new Set();
    for (const [id, ent] of this.entities) {
      const loc = ent.components[POSITION_COMPONENT_ID]?.locationId;
      if (loc === locationId) ids.add(id);
    }
    return ids;
  }
}

/**
 *
 * @param entities
 */
function init(entities) {
  operationRegistry = new OperationRegistry({ logger });
  entityManager = new SimpleEntityManager(entities);

  const handlers = {
    QUERY_ENTITIES: new QueryEntitiesHandler({
      entityManager,
      logger,
      jsonLogicEvaluationService: jsonLogic,
      safeEventDispatcher: eventBus,
    }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: eventBus,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
  };

  for (const [type, handler] of Object.entries(handlers)) {
    operationRegistry.register(type, handler.execute.bind(handler));
  }

  operationInterpreter = new OperationInterpreter({
    logger,
    operationRegistry,
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

describe('intimacy_show_onlookers rule integration', () => {
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
      getAllSystemRules: jest.fn().mockReturnValue([showOnlookersRule]),
    };

    jsonLogic = new JsonLogicEvaluationService({ logger });
    init([]);
  });

  it('validates intimacy_show_onlookers.rule.json against schema', () => {
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
    const valid = ajv.validate(ruleSchema, showOnlookersRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('dispatches a perceptible event when entering a room with a kissing pair', () => {
    interpreter.shutdown();
    const entities = buildABCDWorld();
    // place all in room1 and mark A/B as kissing
    entities.find((e) => e.id === 'd1').components[
      POSITION_COMPONENT_ID
    ].locationId = 'room2';
    entities.find((e) => e.id === 'a1').components['intimacy:kissing'] = {};
    entities.find((e) => e.id === 'b1').components['intimacy:kissing'] = {};
    init(entities);

    listener({
      type: 'core:entity_moved',
      payload: {
        eventName: 'core:entity_moved',
        entityId: 'd1',
        previousLocationId: 'room2',
        currentLocationId: 'room1',
        direction: null,
        originalCommand: 'go room1',
      },
    });

    const event = events.find((e) => e.eventType === 'core:perceptible_event');
    expect(event).toBeDefined();
    expect(event.payload.descriptionText).toContain('walks in on');
    expect(event.payload.actorId).toBe('d1');
  });
});
