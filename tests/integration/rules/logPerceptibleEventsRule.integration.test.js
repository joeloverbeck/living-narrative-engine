/**
 * @file Integration tests for log_perceptible_events.rule.json.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import Ajv from 'ajv';
import ruleSchema from '../../../data/schemas/rule.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import loadOperationSchemas from '../../helpers/loadOperationSchemas.js';
import logPerceptibleEventsRule from '../../../data/mods/core/rules/log_perceptible_events.rule.json';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import AddPerceptionLogEntryHandler from '../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import {
  PERCEPTION_LOG_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

/**
 * Simple in-memory entity manager for integration tests.
 * Provides minimal IEntityManager functionality required by handlers.
 */
class SimpleEntityManager {
  /**
   * Create the manager with provided entities.
   *
   * @param {Array<{id:string,components:object}>} entities - seed entities
   */
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

  /**
   * Retrieve entity instance.
   *
   * @param {string} id - entity id
   * @returns {object|undefined} entity object
   */
  getEntityInstance(id) {
    return this.entities.get(id);
  }

  /**
   * Get component data from an entity.
   *
   * @param {string} id - entity id
   * @param {string} type - component type
   * @returns {any} component data or null
   */
  getComponentData(id, type) {
    return this.entities.get(id)?.components[type] ?? null;
  }

  /**
   * Determine if an entity has a component.
   *
   * @param {string} id - entity id
   * @param {string} type - component type
   * @returns {boolean} true if present
   */
  hasComponent(id, type) {
    return Object.prototype.hasOwnProperty.call(
      this.entities.get(id)?.components || {},
      type
    );
  }

  /**
   * Add or replace a component on an entity.
   *
   * @param {string} id - entity id
   * @param {string} type - component type
   * @param {object} data - component data
   */
  addComponent(id, type, data) {
    const ent = this.entities.get(id);
    if (ent) {
      ent.components[type] = JSON.parse(JSON.stringify(data));
    }
  }

  /**
   * Get IDs of entities in a specific location.
   *
   * @param {string} locationId - location identifier
   * @returns {Set<string>} entity IDs
   */
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
 * Initialize interpreter and register handlers with provided entities.
 *
 * @param {Array<{id:string,components:object}>} entities - initial entities
 */
function init(entities) {
  operationRegistry = new OperationRegistry({ logger });
  entityManager = new SimpleEntityManager(entities);

  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      events.push({ eventType, payload });
      return Promise.resolve();
    }),
  };

  const handlers = {
    ADD_PERCEPTION_LOG_ENTRY: new AddPerceptionLogEntryHandler({
      logger,
      entityManager,
      safeEventDispatcher: safeDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
  };

  for (const [type, handler] of Object.entries(handlers)) {
    operationRegistry.register(type, handler.execute.bind(handler));
  }

  operationInterpreter = new OperationInterpreter({
    logger,
    operationRegistry,
  });

  jsonLogic = new JsonLogicEvaluationService({ logger });

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

describe('log_perceptible_events rule integration', () => {
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
      getAllSystemRules: jest.fn().mockReturnValue([logPerceptibleEventsRule]),
    };

    init([]);
  });

  it('validates log_perceptible_events.rule.json against schema', () => {
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
    ajv.addSchema(
      jsonLogicSchema,
      'http://example.com/schemas/json-logic.schema.json'
    );
    const valid = ajv.validate(ruleSchema, logPerceptibleEventsRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('writes perception log entries for perceivers in the event location', () => {
    interpreter.shutdown();
    const now = '2025-01-01T00:00:00.000Z';
    init([
      {
        id: 'p1',
        components: {
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          [PERCEPTION_LOG_COMPONENT_ID]: { maxEntries: 5, logEntries: [] },
        },
      },
      {
        id: 'o1',
        components: {
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    listener({
      type: 'core:perceptible_event',
      payload: {
        locationId: 'room1',
        descriptionText: 'A bell rings',
        timestamp: now,
        perceptionType: 'sound',
        actorId: 'npc:bell',
        targetId: null,
        involvedEntities: [],
      },
    });

    const log = entityManager.getComponentData(
      'p1',
      PERCEPTION_LOG_COMPONENT_ID
    );
    expect(log.logEntries.length).toBe(1);
    expect(log.logEntries[0]).toEqual({
      descriptionText: 'A bell rings',
      timestamp: now,
      perceptionType: 'sound',
      actorId: 'npc:bell',
      targetId: null,
      involvedEntities: [],
    });
  });

  it('does nothing when no entities in location have perception logs', () => {
    interpreter.shutdown();
    init([
      {
        id: 'a1',
        components: { [POSITION_COMPONENT_ID]: { locationId: 'room1' } },
      },
      {
        id: 'b1',
        components: { [POSITION_COMPONENT_ID]: { locationId: 'room1' } },
      },
    ]);

    listener({
      type: 'core:perceptible_event',
      payload: {
        locationId: 'room1',
        descriptionText: 'Silence',
        timestamp: '2025-01-01T00:00:00.000Z',
        perceptionType: 'sound',
        actorId: 'npc:quiet',
        targetId: null,
        involvedEntities: [],
      },
    });

    expect(
      entityManager.getComponentData('a1', PERCEPTION_LOG_COMPONENT_ID)
    ).toBeNull();
    expect(
      entityManager.getComponentData('b1', PERCEPTION_LOG_COMPONENT_ID)
    ).toBeNull();
  });
});
