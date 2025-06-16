/**
 * @file Integration tests for follow_auto_move.rule.json.
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
import actorIsNotNull from '../../../data/mods/core/conditions/actor-is-not-null.condition.json';
import followAutoMoveRule from '../../../data/mods/core/rules/follow_auto_move.rule.json';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import RebuildLeaderListCacheHandler from '../../../src/logic/operationHandlers/rebuildLeaderListCacheHandler.js';
import QueryEntitiesHandler from '../../../src/logic/operationHandlers/queryEntitiesHandler.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import SystemMoveEntityHandler from '../../../src/logic/operationHandlers/systemMoveEntityHandler.js';
import autoMoveFollowerMacro from '../../../data/mods/core/macros/autoMoveFollower.macro.json';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

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
    this.activeEntities = new Map(this.entities);
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
    }
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

  /**
   * Retrieve all entities that have the specified component.
   *
   * @param {string} componentType - component id
   * @returns {Array<object>} matching entities
   */
  getEntitiesWithComponent(componentType) {
    const result = [];
    for (const ent of this.entities.values()) {
      if (Object.prototype.hasOwnProperty.call(ent.components, componentType)) {
        result.push(ent);
      }
    }
    return result;
  }
}

/**
 * Helper to (re)initialize the interpreter with a fresh entity manager.
 *
 * @param {Array<{id:string,components:object}>} entities - initial entities
 */
function init(entities) {
  operationRegistry = new OperationRegistry({ logger });
  entityManager = new SimpleEntityManager(entities);

  const handlers = {
    REBUILD_LEADER_LIST_CACHE: new RebuildLeaderListCacheHandler({
      logger,
      entityManager,
      safeEventDispatcher: eventBus,
    }),
    QUERY_ENTITIES: new QueryEntitiesHandler({
      entityManager,
      logger,
      jsonLogicEvaluationService: jsonLogic,
      safeEventDispatcher: eventBus,
    }),
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: eventBus,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      addPerceptionLogEntryHandler: { execute: jest.fn() },
    }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    SYSTEM_MOVE_ENTITY: new SystemMoveEntityHandler({
      entityManager,
      safeEventDispatcher: eventBus,
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

describe('core_follow_auto_move rule integration', () => {
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

    const macros = { 'core:autoMoveFollower': autoMoveFollowerMacro };
    const expandedRule = {
      ...followAutoMoveRule,
      actions: expandMacros(followAutoMoveRule.actions, {
        get: (type, id) => (type === 'macros' ? macros[id] : undefined),
      }),
    };
    dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'core:actor-is-not-null' ? actorIsNotNull : undefined
      ),
    };

    jsonLogic = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: dataRegistry,
    });

    init([]);
  });

  it('validates follow_auto_move.rule.json against schema', () => {
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
    const valid = ajv.validate(ruleSchema, followAutoMoveRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('moves followers when leader moves locations', () => {
    interpreter.shutdown();
    init([
      {
        id: 'l1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Leader' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
        },
      },
      {
        id: 'f1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
          [FOLLOWING_COMPONENT_ID]: { leaderId: 'l1' },
        },
      },
      { id: 'locA', components: { [NAME_COMPONENT_ID]: { text: 'Loc A' } } },
      { id: 'locB', components: { [NAME_COMPONENT_ID]: { text: 'Loc B' } } },
    ]);

    listener({
      type: 'core:entity_moved',
      payload: {
        entityId: 'l1',
        previousLocationId: 'locA',
        currentLocationId: 'locB',
      },
    });

    expect(entityManager.getComponentData('f1', POSITION_COMPONENT_ID)).toEqual(
      {
        locationId: 'locB',
      }
    );
    expect(entityManager.getComponentData('l1', LEADING_COMPONENT_ID)).toEqual({
      followers: ['f1'],
    });
    const types = events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
      ])
    );
  });

  it('does nothing when no followers are in the previous location', () => {
    interpreter.shutdown();
    init([
      {
        id: 'l1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Leader' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
        },
      },
      {
        id: 'f1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'locC' },
          [FOLLOWING_COMPONENT_ID]: { leaderId: 'l1' },
        },
      },
      { id: 'locA', components: { [NAME_COMPONENT_ID]: { text: 'Loc A' } } },
      { id: 'locB', components: { [NAME_COMPONENT_ID]: { text: 'Loc B' } } },
    ]);

    listener({
      type: 'core:entity_moved',
      payload: {
        entityId: 'l1',
        previousLocationId: 'locA',
        currentLocationId: 'locB',
      },
    });

    expect(entityManager.getComponentData('f1', POSITION_COMPONENT_ID)).toEqual(
      {
        locationId: 'locC',
      }
    );
    const types = events.map((e) => e.eventType);
    expect(types).not.toContain('core:perceptible_event');
    expect(types).not.toContain('core:display_successful_action_result');
  });
});
