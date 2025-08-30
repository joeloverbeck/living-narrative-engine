/**
 * @file Integration tests for the violence:sucker_punch rule.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import suckerPunchRule from '../../../../../data/mods/violence/rules/handle_sucker_punch.rule.json';
import eventIsActionSuckerPunch from '../../../../../data/mods/violence/conditions/event-is-action-sucker-punch.condition.json';
import logSuccessMacro from '../../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../../../src/logic/operationHandlers/setVariableHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../../common/engine/systemLogicTestEnv.js';

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

describe('handle_sucker_punch rule integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(suckerPunchRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const ruleWithExpandedActions = {
      ...suckerPunchRule,
      actions: expanded,
    };

    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([ruleWithExpandedActions]),
      getConditionDefinition: jest.fn((id) => {
        if (id === 'violence:event-is-action-sucker-punch') {
          return eventIsActionSuckerPunch;
        }
        return undefined;
      }),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [ruleWithExpandedActions],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('condition evaluates correctly', () => {
    // Test that the condition works correctly
    const condition = eventIsActionSuckerPunch.logic;
    const jsonLogic = testEnv.jsonLogic;

    // Check what the condition expects
    expect(condition).toEqual({
      '==': [{ var: 'event.payload.actionId' }, 'violence:sucker_punch'],
    });

    // The event structure for attempt_action events
    const matchingData = {
      event: {
        payload: {
          actionId: 'violence:sucker_punch',
        },
      },
    };

    expect(jsonLogic.evaluate(condition, matchingData)).toBe(true);

    // Should not match when actionId is different
    const nonMatchingData = {
      event: {
        payload: {
          actionId: 'violence:different_action',
        },
      },
    };
    expect(jsonLogic.evaluate(condition, nonMatchingData)).toBe(false);
  });

  it('performs sucker punch action successfully', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Beth' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'violence:sucker_punch',
      targetId: 'target1',
      originalInput: 'sucker_punch target1',
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

  it('perceptible event contains correct message', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Beth' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'violence:sucker_punch',
      targetId: 'target1',
      originalInput: 'sucker_punch target1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Alice sucker-punches Beth in the head.'
    );
  });

  it('rule does not fire for different action', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Beth' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:different_action',
      targetId: 'target1',
      originalInput: 'different_action target1',
    });

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).not.toContain('core:perceptible_event');
    expect(types).not.toContain('core:display_successful_action_result');
    expect(types).not.toContain('core:turn_ended');
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
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Beth' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'observer1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Charlie' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'violence:sucker_punch',
      targetId: 'target1',
      originalInput: 'sucker_punch target1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.locationId).toBe('room1');
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
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
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'violence:sucker_punch',
      targetId: 'target1',
      originalInput: 'sucker_punch target1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'John sucker-punches Mary in the head.'
    );
  });

  it('includes correct event payload structure', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Beth' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'violence:sucker_punch',
      targetId: 'target1',
      originalInput: 'sucker_punch target1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload).toMatchObject({
      descriptionText: 'Alice sucker-punches Beth in the head.',
      perceptionType: 'action_target_general',
      locationId: 'room1',
      targetId: 'target1',
    });
  });

  it('handles missing actor gracefully', async () => {
    testEnv.reset([
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Beth' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    // This should not throw, but may fail during GET_NAME operation
    await expect(async () => {
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'nonexistent',
        actionId: 'violence:sucker_punch',
        targetId: 'target1',
        originalInput: 'sucker_punch target1',
      });
    }).not.toThrow();

    // Should not generate perceptible event with missing actor
    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeUndefined();
  });
});
