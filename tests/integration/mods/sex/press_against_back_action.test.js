/**
 * @file Integration tests for the sex:press_against_back action and rule.
 * @description Tests the rule execution after the press_against_back action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly. For action discovery tests,
 * see pressAgainstBackActionDiscovery.integration.test.js.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import pressAgainstBackRule from '../../../../data/mods/sex/rules/handle_press_against_back.rule.json';
import eventIsActionPressAgainstBack from '../../../../data/mods/sex/conditions/event-is-action-press-against-back.condition.json';
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
 * Creates handlers needed for the press_against_back rule.
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

describe('sex:press_against_back action integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(pressAgainstBackRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...pressAgainstBackRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'sex:event-is-action-press-against-back'
          ? eventIsActionPressAgainstBack
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...pressAgainstBackRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('performs press against back action successfully', async () => {
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
          'positioning:closeness': { partners: ['beth'] },
          'anatomy:body': {
            body: {
              root: 'alice_torso',
            },
          },
        },
      },
      {
        id: 'beth',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Beth' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['alice'] },
          'positioning:facing_away': { facing_away_from: ['alice'] },
        },
      },
      {
        id: 'alice_torso',
        components: {
          'anatomy:part': {
            parent: null,
            children: ['alice_breast1', 'alice_breast2'],
            subType: 'torso',
          },
        },
      },
      {
        id: 'alice_breast1',
        components: {
          'anatomy:part': {
            parent: 'alice_torso',
            children: [],
            subType: 'breast',
          },
        },
      },
      {
        id: 'alice_breast2',
        components: {
          'anatomy:part': {
            parent: 'alice_torso',
            children: [],
            subType: 'breast',
          },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'alice',
      actionId: 'sex:press_against_back',
      targetId: 'beth',
      originalInput: 'press_against_back beth',
    });

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );

    // Verify the perceptible event contains the expected message
    const perceptibleEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(1);
    expect(perceptibleEvents[0].payload.descriptionText).toContain(
      'presses herself against'
    );
    expect(perceptibleEvents[0].payload.descriptionText).toContain('Alice');
    expect(perceptibleEvents[0].payload.descriptionText).toContain('Beth');
    expect(perceptibleEvents[0].payload.descriptionText).toContain(
      'her breasts getting squeezed against'
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
          'positioning:closeness': { partners: [] },
        },
      },
    ]);

    // This test verifies the rule handles missing entities gracefully
    // The action prerequisites would normally prevent this, but we test rule robustness
    await expect(async () => {
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sex:press_against_back',
        actorId: 'alice',
        targetId: 'nonexistent',
      });
    }).not.toThrow();

    // With missing target, the rule should fail during GET_NAME operation
    // So only the initial attempt_action event should be present
    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(['core:attempt_action']);
  });

  it('validates rule execution with proper variable setting and macro invocation', async () => {
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
          'positioning:closeness': { partners: ['beth'] },
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
      eventName: 'core:attempt_action',
      actorId: 'alice',
      actionId: 'sex:press_against_back',
      targetId: 'beth',
      originalInput: 'press_against_back beth',
    });

    // Verify all expected operations were performed
    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:attempt_action', // Initial action attempt
        'core:perceptible_event', // Message dispatched
        'core:display_successful_action_result', // Success result
        'core:turn_ended', // Turn ended
      ])
    );

    // Verify the perceptible event has correct structure
    const perceptibleEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(1);
    expect(perceptibleEvents[0].payload).toHaveProperty('descriptionText');
    expect(perceptibleEvents[0].payload).toHaveProperty('perceptionType', 'action_target_general');
    expect(perceptibleEvents[0].payload).toHaveProperty('locationId', 'room1');
    expect(perceptibleEvents[0].payload).toHaveProperty('targetId', 'beth');
  });
});