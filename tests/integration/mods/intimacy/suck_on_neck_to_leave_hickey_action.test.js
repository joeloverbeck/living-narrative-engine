/**
 * @file Integration tests for the intimacy:suck_on_neck_to_leave_hickey action and rule.
 * @description Tests the rule execution after the suck_on_neck_to_leave_hickey action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import suckOnNeckToLeaveHickeyRule from '../../../../data/mods/intimacy/rules/handle_suck_on_neck_to_leave_hickey.rule.json';
import eventIsActionSuckOnNeckToLeaveHickey from '../../../../data/mods/intimacy/conditions/event-is-action-suck-on-neck-to-leave-hickey.condition.json';
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
 * Creates handlers needed for the suck_on_neck_to_leave_hickey rule.
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

describe('intimacy:suck_on_neck_to_leave_hickey action integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(suckOnNeckToLeaveHickeyRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([
          { ...suckOnNeckToLeaveHickeyRule, actions: expanded },
        ]),
      getConditionDefinition: jest.fn((id) =>
        id === 'intimacy:event-is-action-suck-on-neck-to-leave-hickey'
          ? eventIsActionSuckOnNeckToLeaveHickey
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...suckOnNeckToLeaveHickeyRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('successfully executes suck on neck to leave hickey action between close actors', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['target1'] },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['actor1'] },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:suck_on_neck_to_leave_hickey',
      targetId: 'target1',
      originalInput: 'suck_on_neck_to_leave_hickey target1',
    });

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice has sucked on Bob's neck, leaving a hickey."
    );

    const turnEndedEvent = testEnv.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perception log shows correct message for suck on neck to leave hickey action', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Sarah' },
          [POSITION_COMPONENT_ID]: { locationId: 'garden' },
          'positioning:closeness': { partners: ['target1'] },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'James' },
          [POSITION_COMPONENT_ID]: { locationId: 'garden' },
          'positioning:closeness': { partners: ['actor1'] },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:suck_on_neck_to_leave_hickey',
      targetId: 'target1',
      originalInput: 'suck_on_neck_to_leave_hickey target1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Sarah has sucked on James's neck, leaving a hickey."
    );
    expect(perceptibleEvent.payload.locationId).toBe('garden');
    expect(perceptibleEvent.payload.actorId).toBe('actor1');
    expect(perceptibleEvent.payload.targetId).toBe('target1');
  });

  it('handles multiple close partners correctly', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['target1', 'target2'] },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['actor1', 'target2'] },
        },
      },
      {
        id: 'target2',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Charlie' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['actor1', 'target1'] },
        },
      },
    ]);

    // First suck on Bob's neck to leave a hickey
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:suck_on_neck_to_leave_hickey',
      targetId: 'target1',
      originalInput: 'suck_on_neck_to_leave_hickey target1',
    });

    let perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice has sucked on Bob's neck, leaving a hickey."
    );

    // Clear events for the next test
    testEnv.events.length = 0;

    // Then suck on Charlie's neck to leave a hickey
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:suck_on_neck_to_leave_hickey',
      targetId: 'target2',
      originalInput: 'suck_on_neck_to_leave_hickey target2',
    });

    perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice has sucked on Charlie's neck, leaving a hickey."
    );
  });

  it('action only fires for correct action ID', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['target1'] },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['actor1'] },
        },
      },
    ]);

    // Try with a different action
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:kiss_neck_sensually',
      targetId: 'target1',
      originalInput: 'kiss_neck_sensually target1',
    });

    // Should not have any perceptible events from our rule
    const perceptibleEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(0);
  });

  it('generates proper perceptible event for observers', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Elena' },
          [POSITION_COMPONENT_ID]: { locationId: 'bedroom' },
          'positioning:closeness': { partners: ['target1'] },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Marcus' },
          [POSITION_COMPONENT_ID]: { locationId: 'bedroom' },
          'positioning:closeness': { partners: ['actor1'] },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:suck_on_neck_to_leave_hickey',
      targetId: 'target1',
      originalInput: 'suck_on_neck_to_leave_hickey target1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Elena has sucked on Marcus's neck, leaving a hickey."
    );
    expect(perceptibleEvent.payload.involvedEntities).toEqual([]);
  });

  it('validates perceptible event message matches action success message', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Diana' },
          [POSITION_COMPONENT_ID]: { locationId: 'library' },
          'positioning:closeness': { partners: ['target1'] },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Victor' },
          [POSITION_COMPONENT_ID]: { locationId: 'library' },
          'positioning:closeness': { partners: ['actor1'] },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:suck_on_neck_to_leave_hickey',
      targetId: 'target1',
      originalInput: 'suck_on_neck_to_leave_hickey target1',
    });

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();

    // Both should have the same descriptive message
    expect(successEvent.payload.message).toBe(
      "Diana has sucked on Victor's neck, leaving a hickey."
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Diana has sucked on Victor's neck, leaving a hickey."
    );
  });

  it('works correctly when actor is behind target', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Emma' },
          [POSITION_COMPONENT_ID]: { locationId: 'living_room' },
          'positioning:closeness': { partners: ['target1'] },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Liam' },
          [POSITION_COMPONENT_ID]: { locationId: 'living_room' },
          'positioning:closeness': { partners: ['actor1'] },
          'positioning:facing_away': { facing_away_from: ['actor1'] },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:suck_on_neck_to_leave_hickey',
      targetId: 'target1',
      originalInput: 'suck_on_neck_to_leave_hickey target1',
    });

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Emma has sucked on Liam's neck, leaving a hickey."
    );
  });

  it('demonstrates intimate and possessive nature of the action', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Aria' },
          [POSITION_COMPONENT_ID]: { locationId: 'private_room' },
          'positioning:closeness': { partners: ['target1'] },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Kai' },
          [POSITION_COMPONENT_ID]: { locationId: 'private_room' },
          'positioning:closeness': { partners: ['actor1'] },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:suck_on_neck_to_leave_hickey',
      targetId: 'target1',
      originalInput: 'suck_on_neck_to_leave_hickey target1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();

    // The message should convey the intimate and marking nature of the action
    expect(perceptibleEvent.payload.descriptionText).toContain('sucked on');
    expect(perceptibleEvent.payload.descriptionText).toContain('neck');
    expect(perceptibleEvent.payload.descriptionText).toContain('hickey');
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Aria has sucked on Kai's neck, leaving a hickey."
    );
  });
});
