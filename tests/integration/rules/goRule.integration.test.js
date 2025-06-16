/**
 * @file Integration tests for the go rule.
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
import goRule from '../../../data/mods/core/rules/go.rule.json';
import displaySuccessAndEndTurn from '../../../data/mods/core/macros/displaySuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import ResolveDirectionHandler from '../../../src/logic/operationHandlers/resolveDirectionHandler.js';
import ModifyComponentHandler from '../../../src/logic/operationHandlers/modifyComponentHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import goAction from '../../../data/mods/core/actions/go.action.json';
import { createJsonLogicContext } from '../../../src/logic/contextAssembler.js';

/**
 * Minimal in-memory entity manager used for integration tests.
 *
 * @class SimpleEntityManager
 * @description Provides just enough of IEntityManager for the tested handlers.
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
   * Return an entity instance.
   *
   * @param {string} id - entity id
   * @returns {object|undefined} entity object
   */
  getEntityInstance(id) {
    return this.entities.get(id);
  }

  /**
   * Retrieve component data.
   *
   * @param {string} id - entity id
   * @param {string} type - component type
   * @returns {any} component data or null
   */
  getComponentData(id, type) {
    return this.entities.get(id)?.components[type] ?? null;
  }

  /**
   * Check if an entity has a component.
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
      return true;
    }
    return false;
  }
}

/**
 * Very small world context implementation providing direction resolution.
 *
 * @class SimpleWorldContext
 */
class SimpleWorldContext {
  constructor(entityManager, logger) {
    this.entityManager = entityManager;
    this.logger = logger;
  }

  /**
   * Resolve a direction string to a target location id.
   *
   * @param {object} params - query parameters
   * @param {string} params.current_location_id - current location id
   * @param {string} params.direction_taken - direction string
   * @returns {string|null} resolved target location id or null
   */
  getTargetLocationForDirection({ current_location_id, direction_taken }) {
    const exits = this.entityManager.getComponentData(
      current_location_id,
      EXITS_COMPONENT_ID
    );
    if (!Array.isArray(exits)) return null;
    const found = exits.find((e) => e.direction === direction_taken);
    if (!found || found.blocker) return null;
    return this.entityManager.getEntityInstance(found.target)?.id ?? null;
  }
}

/**
 * Initialize interpreter and register handlers with seed entities.
 *
 * @param {Array<{id:string,components:object}>} entities - seed entities
 */
function init(entities) {
  operationRegistry = new OperationRegistry({ logger });
  entityManager = new SimpleEntityManager(entities);
  worldContext = new SimpleWorldContext(entityManager, logger);

  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      events.push({ eventType, payload });
      return Promise.resolve(true);
    }),
  };

  const handlers = {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    QUERY_COMPONENTS:
      new (require('../../../src/logic/operationHandlers/queryComponentsHandler.js').default)(
        {
          entityManager,
          logger,
          safeEventDispatcher: safeDispatcher,
        }
      ),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
    RESOLVE_DIRECTION: new ResolveDirectionHandler({
      worldContext,
      logger,
    }),
    MODIFY_COMPONENT: new ModifyComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: { dispatch: jest.fn().mockResolvedValue(true) },
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
let worldContext;
let operationRegistry;
let operationInterpreter;
let jsonLogic;
let interpreter;
let events;
let listener;

describe('core_handle_go rule integration', () => {
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

    const macroRegistry = {
      get: (type, id) =>
        type === 'macros'
          ? { 'core:displaySuccessAndEndTurn': displaySuccessAndEndTurn }[id]
          : undefined,
    };

    const expandedRule = {
      ...goRule,
      actions: expandMacros(goRule.actions, macroRegistry),
    };

    dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
    };

    init([]);
  });

  it('validates go.rule.json against schema', () => {
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
    ajv.addSchema(
      conditionContainerSchema,
      'http://example.com/schemas/condition-container.schema.json'
    );
    ajv.addSchema(
      conditionSchema,
      'http://example.com/schemas/condition.schema.json'
    );
    const valid = ajv.validate(ruleSchema, goRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('moves actor when pre-resolved targetId provided', () => {
    interpreter.shutdown();
    init([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Hero' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
        },
      },
      { id: 'locA', components: { [NAME_COMPONENT_ID]: { text: 'Loc A' } } },
      { id: 'locB', components: { [NAME_COMPONENT_ID]: { text: 'Loc B' } } },
    ]);
    entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
      { direction: 'north', target: 'locB' },
    ]);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'actor1',
        actionId: 'core:go',
        direction: 'north',
        targetId: 'locB',
        originalInput: 'go north',
      },
    });

    expect(
      entityManager.getComponentData('actor1', POSITION_COMPONENT_ID)
    ).toEqual({
      locationId: 'locB',
    });
    const types = events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:entity_moved',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it('moves actor using direction when targetId missing', () => {
    interpreter.shutdown();
    init([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Hero' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
        },
      },
      { id: 'locA', components: { [NAME_COMPONENT_ID]: { text: 'Loc A' } } },
      { id: 'locB', components: { [NAME_COMPONENT_ID]: { text: 'Loc B' } } },
    ]);
    entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
      { direction: 'east', target: 'locB' },
    ]);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'actor1',
        actionId: 'core:go',
        direction: 'east',
        targetId: null,
        originalInput: 'go east',
      },
    });

    expect(
      entityManager.getComponentData('actor1', POSITION_COMPONENT_ID)
    ).toEqual({
      locationId: 'locB',
    });
    const types = events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:entity_moved',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it('fails when direction cannot be resolved', () => {
    interpreter.shutdown();
    init([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Hero' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
        },
      },
      { id: 'locA', components: { [NAME_COMPONENT_ID]: { text: 'Loc A' } } },
    ]);
    entityManager.addComponent('locA', EXITS_COMPONENT_ID, []);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'actor1',
        actionId: 'core:go',
        direction: 'south',
        targetId: null,
        originalInput: 'go south',
      },
    });

    expect(
      entityManager.getComponentData('actor1', POSITION_COMPONENT_ID)
    ).toEqual({
      locationId: 'locA',
    });
    const types = events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:display_failed_action_result',
        'core:turn_ended',
      ])
    );
    expect(types).not.toContain('core:entity_moved');
  });

  it('movement succeeds when locked flag is false', () => {
    interpreter.shutdown();
    init([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Hero' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
          'core:movement': { locked: false },
        },
      },
      { id: 'locA', components: { [NAME_COMPONENT_ID]: { text: 'Loc A' } } },
      { id: 'locB', components: { [NAME_COMPONENT_ID]: { text: 'Loc B' } } },
    ]);
    entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
      { direction: 'north', target: 'locB' },
    ]);

    listener({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'actor1',
        actionId: 'core:go',
        direction: 'north',
        targetId: 'locB',
        originalInput: 'go north',
      },
    });

    expect(
      entityManager.getComponentData('actor1', POSITION_COMPONENT_ID)
    ).toEqual({ locationId: 'locB' });
    const types = events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:entity_moved',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
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
      logger
    );
    const result = jsonLogic.evaluate(prereq, ctx.context);
    expect(result).toBe(false);
  });
});
