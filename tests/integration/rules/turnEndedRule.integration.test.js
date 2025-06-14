/**
 * @file Integration tests for turn_ended.rule.json.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import Ajv from 'ajv';
import ruleSchema from '../../../data/schemas/rule.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import turnEndedRule from '../../../data/mods/core/rules/turn_ended.rule.json';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import RemoveComponentHandler from '../../../src/logic/operationHandlers/removeComponentHandler.js';
import { CURRENT_ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';

/**
 * Minimal in-memory entity manager for integration tests.
 * Provides just enough of IEntityManager for the tested handlers.
 */
class SimpleEntityManager {
  /**
   * Create the manager with provided entities.
   *
   * @param {Array<{id:string,components:object}>} entities - initial entities
   */
  constructor(entities) {
    this.entities = new Map();
    for (const e of entities) {
      this.entities.set(e.id, {
        id: e.id,
        components: { ...e.components },
      });
    }
  }

  /**
   * Retrieve an entity instance.
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
   * Remove a component from an entity.
   *
   * @param {string} id - entity id
   * @param {string} type - component type
   */
  removeComponent(id, type) {
    const ent = this.entities.get(id);
    if (ent) {
      delete ent.components[type];
    }
  }
}

/**
 * Initialize interpreter and register handlers with provided seed entities.
 *
 * @param {Array<{id:string,components:object}>} entities - seed entities
 */
function init(entities) {
  operationRegistry = new OperationRegistry({ logger });
  entityManager = new SimpleEntityManager(entities);

  const handlers = {
    REMOVE_COMPONENT: new RemoveComponentHandler({
      entityManager,
      logger,
    }),
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

describe('turn_ended rule integration', () => {
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
      getAllSystemRules: jest.fn().mockReturnValue([turnEndedRule]),
    };

    init([]);
  });

  it('validates turn_ended.rule.json against schema', () => {
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
    const valid = ajv.validate(ruleSchema, turnEndedRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('removes current_actor component from the payload entity', () => {
    interpreter.shutdown();
    init([
      {
        id: 'p1',
        components: { [CURRENT_ACTOR_COMPONENT_ID]: {} },
      },
    ]);

    listener({
      type: 'core:turn_ended',
      payload: { entityId: 'p1', success: true },
    });

    expect(
      entityManager.getComponentData('p1', CURRENT_ACTOR_COMPONENT_ID)
    ).toBeNull();
    expect(events).toEqual([]);
  });

  it('handles entity without current_actor component gracefully', () => {
    interpreter.shutdown();
    init([
      {
        id: 'p2',
        components: {},
      },
    ]);

    listener({
      type: 'core:turn_ended',
      payload: { entityId: 'p2', success: false },
    });

    expect(
      entityManager.getComponentData('p2', CURRENT_ACTOR_COMPONENT_ID)
    ).toBeNull();
    expect(events).toEqual([]);
  });
});
