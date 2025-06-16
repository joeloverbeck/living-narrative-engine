/**
 * @file Integration tests for player_turn_prompt.rule.json.
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
import playerTurnPromptRule from '../../../data/mods/core/rules/player_turn_prompt.rule.json';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';

/**
 * Minimal in-memory entity manager used for integration tests.
 * Provides enough IEntityManager functionality for the tested handlers.
 */
class SimpleEntityManager {
  /**
   * Create the manager with the provided entities.
   *
   * @param {Array<{id:string,components:object}>} entities - initial entities
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
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
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

describe('player_turn_prompt rule integration', () => {
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
      getAllSystemRules: jest.fn().mockReturnValue([playerTurnPromptRule]),
    };

    init([]);
  });

  it('validates player_turn_prompt.rule.json against schema', () => {
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
    const valid = ajv.validate(ruleSchema, playerTurnPromptRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('dispatches enable_input and update_available_actions events', () => {
    listener({
      type: 'core:player_turn_prompt',
      payload: {
        entityId: 'player1',
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            params: {},
            description: 'skip',
          },
        ],
      },
    });

    const types = events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:enable_input',
        'core:update_available_actions',
      ])
    );

    const update = events.find(
      (e) => e.eventType === 'core:update_available_actions'
    );
    expect(update).toBeDefined();
    expect(update.payload).toEqual({
      actorId: 'player1',
      actions: [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          params: {},
          description: 'skip',
        },
      ],
    });
  });

  it('handles empty availableActions array', () => {
    events.length = 0;
    listener({
      type: 'core:player_turn_prompt',
      payload: { entityId: 'player1', availableActions: [] },
    });

    const update = events.find(
      (e) => e.eventType === 'core:update_available_actions'
    );
    expect(update).toBeDefined();
    expect(update.payload).toEqual({ actorId: 'player1', actions: [] });
  });
});
