/**
 * @file Integration tests for the stop_following rule.
 * @see tests/integration/rules/stopFollowingRule.integration.test.js
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
import eventIsActionStopFollowing from '../../../data/mods/core/conditions/event-is-action-stop-following.condition.json';
import stopFollowingRule from '../../../data/mods/core/rules/stop_following.rule.json';
import logFailureAndEndTurn from '../../../data/mods/core/macros/logFailureAndEndTurn.macro.json';
import displaySuccessAndEndTurn from '../../../data/mods/core/macros/displaySuccessAndEndTurn.macro.json';
import {
  expandMacros,
  validateMacroExpansion,
} from '../../../src/utils/macroUtils.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import jsonLogic from 'json-logic-js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import BreakFollowRelationHandler from '../../../src/logic/operationHandlers/breakFollowRelationHandler.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import IfCoLocatedHandler from '../../../src/logic/operationHandlers/ifCoLocatedHandler.js';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';

console.log('DEBUG: Test started');
console.log('DEBUG: Before describe');

// Move makeStubRebuild definition here so it is accessible in all tests
const makeStubRebuild = (em) => ({
  execute({ leaderIds }) {
    for (const lid of leaderIds) {
      const followers = [];
      for (const [id, ent] of em.entities) {
        const f = ent.components[FOLLOWING_COMPONENT_ID];
        if (f?.leaderId === lid) followers.push(id);
      }
      const leader = em.entities.get(lid);
      if (leader) {
        leader.components[LEADING_COMPONENT_ID] = { followers };
      }
    }
  },
});

// Move createHandlers definition here so it is accessible in all tests
const createHandlers = (entityManager, eventBus, logger) => {
  return {
    BREAK_FOLLOW_RELATION: new BreakFollowRelationHandler({
      entityManager,
      logger,
      rebuildLeaderListCacheHandler: makeStubRebuild(entityManager),
      safeEventDispatcher: {
        dispatch: (...args) => eventBus.dispatch(...args),
      },
    }),
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager: {
        ...entityManager,
        getComponentData: (id, type) => {
          const result = entityManager.getComponentData(id, type);
          return result;
        },
      },
      logger,
      safeEventDispatcher: {
        dispatch: (...args) => eventBus.dispatch(...args),
      },
    }),
    SET_VARIABLE: new SetVariableHandler({ logger, jsonLogic }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    IF_CO_LOCATED_FACTORY: (operationInterpreter) =>
      new IfCoLocatedHandler({
        entityManager,
        operationInterpreter,
        logger,
        safeEventDispatcher: {
          dispatch: (...args) => eventBus.dispatch(...args),
        },
      }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: { dispatch: (...args) => eventBus.dispatch(...args) },
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

describe('stop_following rule integration', () => {
  let events = [];
  let testEnv;

  beforeEach(() => {
    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([stopFollowingRule]),
      getConditionDefinition: jest.fn((id) => {
        if (id === 'core:event-is-action-stop-following')
          return eventIsActionStopFollowing;
        return undefined;
      }),
    };

    // Prepare macro registry for expandMacros
    const macroRegistry = {
      get: (type, id) => {
        if (type === 'macros') {
          if (id === 'core:displaySuccessAndEndTurn')
            return displaySuccessAndEndTurn;
          if (id === 'core:logFailureAndEndTurn') return logFailureAndEndTurn;
        }
        return undefined;
      },
    };

    const originalActions = JSON.parse(
      JSON.stringify(stopFollowingRule.actions)
    );
    const expandedActions = expandMacros(originalActions, macroRegistry, {
      warn: jest.fn(),
      debug: jest.fn(),
    });

    // Validate that all macros were properly expanded
    if (
      !validateMacroExpansion(expandedActions, macroRegistry, {
        warn: jest.fn(),
        debug: jest.fn(),
      })
    ) {
      throw new Error('Some macros were not fully expanded');
    }

    const expandedRule = {
      ...stopFollowingRule,
      actions: expandedActions,
    };

    testEnv = createRuleTestEnvironment({
      createHandlers: (entityManager, eventBus, logger) => {
        const handlers = createHandlers(entityManager, eventBus, logger);
        const { IF_CO_LOCATED_FACTORY, ...rest } = handlers;
        return rest;
      },
      entities: [],
      rules: [expandedRule],
      dataRegistry: {
        getAllSystemRules: jest.fn().mockReturnValue([expandedRule]),
        getConditionDefinition: jest.fn((id) => {
          if (id === 'core:event-is-action-stop-following')
            return eventIsActionStopFollowing;
          return undefined;
        }),
      },
    });

    events = [];
    testEnv.eventBus.subscribe('*', (event) => {
      // Capture both type and eventType for robust event collection
      events.push({
        type: event.type,
        eventType: event.eventType,
        ...event,
      });
    });

    const ifCoLocatedHandler = createHandlers(
      testEnv.entityManager,
      testEnv.eventBus,
      testEnv.logger
    ).IF_CO_LOCATED_FACTORY(testEnv.operationInterpreter);
    testEnv.operationRegistry.register(
      'IF_CO_LOCATED',
      ifCoLocatedHandler.execute.bind(ifCoLocatedHandler)
    );

    console.log('DEBUG: FOLLOWING_COMPONENT_ID =', FOLLOWING_COMPONENT_ID);
    console.log('DEBUG: POSITION_COMPONENT_ID =', POSITION_COMPONENT_ID);
    console.log('DEBUG: LEADING_COMPONENT_ID =', LEADING_COMPONENT_ID);

    // Patch operationInterpreter to log each operation type as it is executed
    const origExecute = OperationInterpreter.prototype.execute;
    OperationInterpreter.prototype.execute = function (
      operation,
      executionContext
    ) {
      console.log(
        'DEBUG: OperationInterpreter.execute called with operation type:',
        operation?.type
      );
      return origExecute.call(this, operation, executionContext);
    };
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('validates stop_following.rule.json against schema', () => {
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
    const valid = ajv.validate(ruleSchema, stopFollowingRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  console.log('DEBUG: Test body started (describe block)');
  it('removes following relationship and emits perceptible event when co-located', async () => {
    console.log('DEBUG: Test body started');

    const entities = [
      {
        id: 'f1',
        components: {
          'core:following': { leaderId: 'l1' },
          'core:position': { locationId: 'loc1' },
        },
      },
      {
        id: 'l1',
        components: {
          'core:leading': { followers: ['f1'] },
          'core:position': { locationId: 'loc1' },
        },
      },
      { id: 'loc1', components: {} },
    ];
    console.log(
      'DEBUG: [test] entities before reset:',
      JSON.stringify(entities, null, 2)
    );
    testEnv.reset(entities);
    events = [];
    testEnv.eventBus.subscribe('*', (event) => {
      // Capture both type and eventType for robust event collection
      events.push({
        type: event.type,
        eventType: event.eventType,
        ...event,
      });
    });
    // Re-create and re-register IF_CO_LOCATED handler after reset
    const ifCoLocatedHandler = createHandlers(
      testEnv.entityManager,
      testEnv.eventBus,
      testEnv.logger
    ).IF_CO_LOCATED_FACTORY(testEnv.operationInterpreter);
    testEnv.operationRegistry.register(
      'IF_CO_LOCATED',
      ifCoLocatedHandler.execute.bind(ifCoLocatedHandler)
    );

    // Register DISPATCH_EVENT handler
    const dispatchEventHandler = createHandlers(
      testEnv.entityManager,
      testEnv.eventBus,
      testEnv.logger
    ).DISPATCH_EVENT;
    testEnv.operationRegistry.register(
      'DISPATCH_EVENT',
      dispatchEventHandler.execute.bind(dispatchEventHandler)
    );

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'f1',
      actionId: 'core:stop_following',
    });
    expect(
      testEnv.entityManager.getComponentData('f1', 'core:following')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('l1', 'core:leading')
    ).toEqual({
      followers: [],
    });
    const types = events.map((e) => e.type || e.eventType);
    expect(types).toContain('core:perceptible_event');
    expect(types).toContain('core:display_successful_action_result');
    expect(types).toContain('core:turn_ended');
  });

  it('omits perceptible event when actor and leader are in different locations', async () => {
    const entities = [
      {
        id: 'f1',
        components: {
          'core:following': { leaderId: 'l1' },
          'core:position': { locationId: 'loc1' },
        },
      },
      {
        id: 'l1',
        components: {
          'core:leading': { followers: ['f1'] },
          'core:position': { locationId: 'loc2' },
        },
      },
      { id: 'loc1', components: {} },
      { id: 'loc2', components: {} },
    ];
    testEnv.reset(entities);
    events = [];
    testEnv.eventBus.subscribe('*', (event) => {
      // Capture both type and eventType for robust event collection
      events.push({
        type: event.type,
        eventType: event.eventType,
        ...event,
      });
    });
    // Re-create and re-register IF_CO_LOCATED handler after reset
    const ifCoLocatedHandler = createHandlers(
      testEnv.entityManager,
      testEnv.eventBus,
      testEnv.logger
    ).IF_CO_LOCATED_FACTORY(testEnv.operationInterpreter);
    testEnv.operationRegistry.register(
      'IF_CO_LOCATED',
      ifCoLocatedHandler.execute.bind(ifCoLocatedHandler)
    );
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'f1',
      actionId: 'core:stop_following',
    });
    expect(
      testEnv.entityManager.getComponentData('f1', 'core:following')
    ).toBeNull();
    expect(
      testEnv.entityManager.getComponentData('l1', 'core:leading')
    ).toEqual({
      followers: [],
    });
    const types = events.map((e) => e.type || e.eventType);
    expect(types).not.toContain('core:perceptible_event');
    expect(types).toContain('core:display_successful_action_result');
    expect(types).toContain('core:turn_ended');
  });

  it('handles not-following branch with error event', async () => {
    const entities = [
      {
        id: 'f1',
        components: {
          'core:position': { locationId: 'loc1' },
        },
      },
      {
        id: 'l1',
        components: {
          'core:leading': { followers: [] },
          'core:position': { locationId: 'loc1' },
        },
      },
      { id: 'loc1', components: {} },
    ];
    testEnv.reset(entities);
    events = [];
    testEnv.eventBus.subscribe('*', (event) => {
      // Capture both type and eventType for robust event collection
      events.push({
        type: event.type,
        eventType: event.eventType,
        ...event,
      });
    });
    // Re-create and re-register IF_CO_LOCATED handler after reset
    const ifCoLocatedHandler = createHandlers(
      testEnv.entityManager,
      testEnv.eventBus,
      testEnv.logger
    ).IF_CO_LOCATED_FACTORY(testEnv.operationInterpreter);
    testEnv.operationRegistry.register(
      'IF_CO_LOCATED',
      ifCoLocatedHandler.execute.bind(ifCoLocatedHandler)
    );
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'f1',
      actionId: 'core:stop_following',
    });
    expect(
      testEnv.entityManager.getComponentData('f1', 'core:following')
    ).toBeNull();
    const types = events.map((e) => e.type || e.eventType);
    expect(types).toContain('core:display_failed_action_result');
    expect(types).toContain('core:turn_ended');
  });
});
