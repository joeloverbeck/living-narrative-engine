/**
 * @file Integration tests for the violence:sucker_punch action and rule.
 * @description Tests the rule execution after the sucker_punch action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly. For action discovery tests,
 * see sucker_punch_action_discovery.test.js.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import suckerPunchRule from '../../../../data/mods/violence/rules/handle_sucker_punch.rule.json';
import eventIsActionSuckerPunch from '../../../../data/mods/violence/conditions/event-is-action-sucker-punch.condition.json';
import logSuccessMacro from '../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the sucker_punch rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @returns {object} Handlers object
 */
function createHandlers(entityManager, eventBus, logger) {
  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      eventBus.dispatch(eventType, payload);
      return Promise.resolve(true);
    }),
  };

  return {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
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
    SET_VARIABLE: new SetVariableHandler({ logger }),
  };
}

describe('violence:sucker_punch action integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(suckerPunchRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...suckerPunchRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'violence:event-is-action-sucker-punch'
          ? eventIsActionSuckerPunch
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...suckerPunchRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('performs sucker punch action successfully', async () => {
    testEnv.reset([
      {
        id: 'room1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Room' },
        },
      },
      {
        id: 'alice',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'beth',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Beth' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'alice',
      actionId: 'violence:sucker_punch',
      targetId: 'beth',
    });

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it('does not fire rule for different action', async () => {
    testEnv.reset([
      {
        id: 'room1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Room' },
        },
      },
      {
        id: 'alice',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    const initialEventCount = testEnv.events.length;

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actionId: 'core:wait',
      actorId: 'alice',
    });

    // Rule should not trigger for a different action
    const newEventCount = testEnv.events.length;
    expect(newEventCount).toBe(initialEventCount + 1); // Only the dispatched event
  });

  it('handles missing target gracefully', async () => {
    testEnv.reset([
      {
        id: 'room1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Room' },
        },
      },
      {
        id: 'alice',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    // This test verifies the rule handles missing entities gracefully
    // The action prerequisites would normally prevent this, but we test rule robustness
    await expect(async () => {
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'violence:sucker_punch',
        actorId: 'alice',
        targetId: 'nonexistent',
      });
    }).not.toThrow();

    // With missing target, the rule should fail during GET_NAME operation
    // So only the initial attempt_action event should be present
    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(['core:attempt_action']);
  });

  it('generates correct perceptible event message', async () => {
    testEnv.reset([
      {
        id: 'room1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Living Room' },
        },
      },
      {
        id: 'alice',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'beth',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Beth' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'alice',
      actionId: 'violence:sucker_punch',
      targetId: 'beth',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Alice sucker-punches Beth.'
    );
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.locationId).toBe('room1');
    expect(perceptibleEvent.payload.targetId).toBe('beth');
  });

  it('works with multiple actors in location', async () => {
    testEnv.reset([
      {
        id: 'room1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Living Room' },
        },
      },
      {
        id: 'alice',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'beth',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Beth' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'charlie',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Charlie' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'alice',
      actionId: 'violence:sucker_punch',
      targetId: 'beth',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.locationId).toBe('room1');
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    // Charlie would observe this action in a real game
  });

  it('works with different actor and target names', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'John' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Mary' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'violence:sucker_punch',
      targetId: 'target1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'John sucker-punches Mary.'
    );
  });
});