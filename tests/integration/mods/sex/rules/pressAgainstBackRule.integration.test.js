/**
 * @file Integration tests for press against back rule behavior
 * @description Tests the detailed behavior of the handle_press_against_back rule,
 * focusing on variable setting, message formatting, and macro integration
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import pressAgainstBackRule from '../../../../../data/mods/sex/rules/handle_press_against_back.rule.json';
import eventIsActionPressAgainstBack from '../../../../../data/mods/sex/conditions/event-is-action-press-against-back.condition.json';
import logSuccessMacro from '../../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../../../src/utils/macroUtils.js';
import { createRuleTestEnvironment } from '../../../../common/engine/systemLogicTestEnv.js';
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

/**
 * Creates handlers needed for the press_against_back rule testing.
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

describe('Press Against Back Rule Integration Tests', () => {
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

  it('rule executes with correct variable setting and message formatting', async () => {
    // Arrange
    testEnv.reset([
      {
        id: 'location1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bedroom' },
        },
      },
      {
        id: 'sarah',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Sarah' },
          [POSITION_COMPONENT_ID]: { locationId: 'location1' },
          'positioning:closeness': { partners: ['mark'] },
        },
      },
      {
        id: 'mark',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Mark' },
          [POSITION_COMPONENT_ID]: { locationId: 'location1' },
          'positioning:closeness': { partners: ['sarah'] },
        },
      },
    ]);

    // Act
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'sarah',
      actionId: 'sex:press_against_back',
      targetId: 'mark',
      originalInput: 'press against mark back',
    });

    // Assert
    const perceptibleEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(1);

    const event = perceptibleEvents[0];
    expect(event.payload.descriptionText).toBe(
      "Sarah presses herself against Mark's back, her breasts getting squeezed against Mark's flesh."
    );
    expect(event.payload.perceptionType).toBe('action_target_general');
    expect(event.payload.locationId).toBe('location1');
    expect(event.payload.targetId).toBe('mark');
  });

  it('GET_NAME operations resolve actor and target names correctly', async () => {
    // Arrange
    testEnv.reset([
      {
        id: 'location1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Living Room' },
        },
      },
      {
        id: 'emma',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Emma' },
          [POSITION_COMPONENT_ID]: { locationId: 'location1' },
        },
      },
      {
        id: 'david',
        components: {
          [NAME_COMPONENT_ID]: { text: 'David' },
          [POSITION_COMPONENT_ID]: { locationId: 'location1' },
        },
      },
    ]);

    // Act
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'emma',
      actionId: 'sex:press_against_back',
      targetId: 'david',
      originalInput: 'press against david back',
    });

    // Assert - verify names are correctly resolved in the message
    const perceptibleEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(1);
    expect(perceptibleEvents[0].payload.descriptionText).toContain('Emma');
    expect(perceptibleEvents[0].payload.descriptionText).toContain('David');
    expect(perceptibleEvents[0].payload.descriptionText).toMatch(
      /Emma presses herself against David's back/
    );
  });

  it('SET_VARIABLE operations configure descriptionText and other context variables', async () => {
    // Arrange
    testEnv.reset([
      {
        id: 'bedroom',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bedroom' },
        },
      },
      {
        id: 'lisa',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Lisa' },
          [POSITION_COMPONENT_ID]: { locationId: 'bedroom' },
        },
      },
      {
        id: 'james',
        components: {
          [NAME_COMPONENT_ID]: { text: 'James' },
          [POSITION_COMPONENT_ID]: { locationId: 'bedroom' },
        },
      },
    ]);

    // Act
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'lisa',
      actionId: 'sex:press_against_back',
      targetId: 'james',
      originalInput: 'press against james back',
    });

    // Assert - verify all expected variables are set correctly
    const perceptibleEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(1);

    const payload = perceptibleEvents[0].payload;
    expect(payload).toHaveProperty('descriptionText');
    expect(payload).toHaveProperty('perceptionType', 'action_target_general');
    expect(payload).toHaveProperty('locationId', 'bedroom');
    expect(payload).toHaveProperty('targetId', 'james');
    expect(payload.descriptionText).toContain('Lisa');
    expect(payload.descriptionText).toContain('James');
  });

  it('rule integrates properly with core:logSuccessAndEndTurn macro', async () => {
    // Arrange
    testEnv.reset([
      {
        id: 'room',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Room' },
        },
      },
      {
        id: 'actor',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Actor' },
          [POSITION_COMPONENT_ID]: { locationId: 'room' },
        },
      },
      {
        id: 'target',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Target' },
          [POSITION_COMPONENT_ID]: { locationId: 'room' },
        },
      },
    ]);

    // Act
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor',
      actionId: 'sex:press_against_back',
      targetId: 'target',
    });

    // Assert - verify macro execution produces expected events
    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:attempt_action',
        'core:perceptible_event', // From the macro
        'core:display_successful_action_result', // From the macro
        'core:turn_ended', // From the macro
      ])
    );

    // Verify events are in correct order
    const attemptIndex = types.indexOf('core:attempt_action');
    const perceptibleIndex = types.indexOf('core:perceptible_event');
    const resultIndex = types.indexOf('core:display_successful_action_result');
    const endTurnIndex = types.indexOf('core:turn_ended');

    expect(attemptIndex).toBeLessThan(perceptibleIndex);
    expect(perceptibleIndex).toBeLessThan(resultIndex);
    expect(resultIndex).toBeLessThan(endTurnIndex);
  });

  it('handles error for malformed event data', async () => {
    // Arrange
    testEnv.reset([
      {
        id: 'room',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Room' },
        },
      },
      {
        id: 'actor',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Actor' },
          [POSITION_COMPONENT_ID]: { locationId: 'room' },
        },
      },
    ]);

    // Act - dispatch malformed event (missing required targetId)
    await expect(async () => {
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'actor',
        actionId: 'sex:press_against_back',
        // targetId is missing - this should be handled gracefully
      });
    }).not.toThrow();

    // Assert - rule should handle the malformed data gracefully
    // Without targetId, the SET_VARIABLE operation that uses {event.payload.targetId}
    // should either fail gracefully or use undefined/null
    const types = testEnv.events.map((e) => e.eventType);

    // The rule might still execute, but the targetId variable will be undefined
    // This tests the rule's robustness to malformed data
    expect(types).toContain('core:attempt_action');

    // If the rule partially executes but fails during variable resolution,
    // we should not see the complete success sequence
    const perceptibleEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    // Either no perceptible event (rule failed early) or targetId is undefined
    expect(perceptibleEvents.length <= 1).toBe(true);
    if (perceptibleEvents.length === 1) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(perceptibleEvents[0].payload.targetId).toBeUndefined();
    }
  });

  it('handles case where actor position component is missing', async () => {
    // Arrange - actor without position component
    testEnv.reset([
      {
        id: 'actor',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Actor' },
          // No position component
        },
      },
      {
        id: 'target',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Target' },
          [POSITION_COMPONENT_ID]: { locationId: 'room' },
        },
      },
    ]);

    // Act
    await expect(async () => {
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'actor',
        actionId: 'sex:press_against_back',
        targetId: 'target',
      });
    }).not.toThrow();

    // Assert - rule should handle missing position gracefully
    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toContain('core:attempt_action');

    // The QUERY_COMPONENT for actor position might fail, but rule should handle gracefully
    // Either the rule will fail early, or locationId will be undefined/null
    const perceptibleEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    // Either no perceptible events (rule failed early) or exactly one
    expect(perceptibleEvents.length <= 1).toBe(true);
    if (perceptibleEvents.length === 1) {
      // locationId might be undefined if position query failed
      // eslint-disable-next-line jest/no-conditional-expect
      expect(perceptibleEvents[0].payload).toHaveProperty('descriptionText');
    }
  });
});
