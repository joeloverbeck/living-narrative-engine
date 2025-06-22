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
import loadOperationSchemas from '../../unit/helpers/loadOperationSchemas.js';
import loadConditionSchemas from '../../unit/helpers/loadConditionSchemas.js';
import eventIsActionGo from '../../../data/mods/core/conditions/event-is-action-go.condition.json';
import goRule from '../../../data/mods/core/rules/go.rule.json';
import displaySuccessAndEndTurn from '../../../data/mods/core/macros/displaySuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import jsonLogic from 'json-logic-js';
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
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';

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

describe('core_handle_go rule integration', () => {
  let testEnv;
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

  beforeEach(() => {
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

    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'core:event-is-action-go' ? eventIsActionGo : undefined
      ),
    };

    // Create handlers with dependencies
    const createHandlers = (entityManager, eventBus, logger) => {
      const worldContext = new SimpleWorldContext(entityManager, logger);

      return {
        QUERY_COMPONENT: new QueryComponentHandler({
          entityManager,
          logger,
          safeEventDispatcher: { dispatch: jest.fn().mockResolvedValue(true) },
        }),
        QUERY_COMPONENTS:
          new (require('../../../src/logic/operationHandlers/queryComponentsHandler.js').default)(
            {
              entityManager,
              logger,
              safeEventDispatcher: {
                dispatch: jest.fn().mockResolvedValue(true),
              },
            }
          ),
        GET_TIMESTAMP: new GetTimestampHandler({ logger }),
        SET_VARIABLE: new SetVariableHandler({ logger, jsonLogic }),
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
        DISPATCH_EVENT: new DispatchEventHandler({
          dispatcher: eventBus,
          logger,
        }),
        END_TURN: new EndTurnHandler({
          safeEventDispatcher: {
            dispatch: (...args) => eventBus.dispatch(...args),
          },
          logger,
        }),
      };
    };

    // Create test environment
    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [expandedRule],
      dataRegistry,
    });

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
    const valid = ajv.validate(ruleSchema, goRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('moves actor when pre-resolved targetId provided', () => {
    testEnv.reset([
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
    setupListener();
    testEnv.entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
      { direction: 'north', target: 'locB' },
    ]);

    testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'core:go',
      direction: 'north',
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

  it('moves actor using direction when targetId missing', () => {
    testEnv.reset([
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
    setupListener();
    testEnv.entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
      { direction: 'east', target: 'locB' },
    ]);

    testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'core:go',
      direction: 'east',
      targetId: null,
      originalInput: 'go east',
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

  it('fails when direction cannot be resolved', () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Hero' },
          [POSITION_COMPONENT_ID]: { locationId: 'locA' },
        },
      },
      { id: 'locA', components: { [NAME_COMPONENT_ID]: { text: 'Loc A' } } },
    ]);
    setupListener();
    testEnv.entityManager.addComponent('locA', EXITS_COMPONENT_ID, []);

    testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'core:go',
      direction: 'south',
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

  it('movement succeeds when locked flag is false', () => {
    testEnv.reset([
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
    setupListener();
    testEnv.entityManager.addComponent('locA', EXITS_COMPONENT_ID, [
      { direction: 'north', target: 'locB' },
    ]);

    testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'core:go',
      direction: 'north',
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
});
