/**
 * @file Integration tests for the intimacy:lick_lips action and rule.
 * @description Tests the rule execution after the lick_lips action is performed.
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
import lickLipsRule from '../../../../data/mods/intimacy/rules/lick_lips.rule.json';
import eventIsActionLickLips from '../../../../data/mods/intimacy/conditions/event-is-action-lick-lips.condition.json';
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
 * Creates handlers needed for the lick_lips rule.
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

describe('intimacy:lick_lips action integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(lickLipsRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...lickLipsRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'intimacy:event-is-action-lick-lips'
          ? eventIsActionLickLips
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...lickLipsRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('successfully executes lick lips action between close actors', async () => {
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
      actionId: 'intimacy:lick_lips',
      targetId: 'target1',
      originalInput: 'lick_lips target1',
    });

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice leans in and seductively licks Bob's lips."
    );

    const turnEndedEvent = testEnv.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perception log shows correct message for lick lips action', async () => {
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
      actionId: 'intimacy:lick_lips',
      targetId: 'target1',
      originalInput: 'lick_lips target1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Sarah leans in and seductively licks James's lips."
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

    // First lick Bob's lips
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:lick_lips',
      targetId: 'target1',
      originalInput: 'lick_lips target1',
    });

    let perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice leans in and seductively licks Bob's lips."
    );

    // Clear events for the next test
    testEnv.events.length = 0;

    // Then lick Charlie's lips
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:lick_lips',
      targetId: 'target2',
      originalInput: 'lick_lips target2',
    });

    perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice leans in and seductively licks Charlie's lips."
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
      actionId: 'intimacy:kiss_cheek',
      targetId: 'target1',
      originalInput: 'kiss_cheek target1',
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
      actionId: 'intimacy:lick_lips',
      targetId: 'target1',
      originalInput: 'lick_lips target1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Elena leans in and seductively licks Marcus's lips."
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
      actionId: 'intimacy:lick_lips',
      targetId: 'target1',
      originalInput: 'lick_lips target1',
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
      "Diana leans in and seductively licks Victor's lips."
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Diana leans in and seductively licks Victor's lips."
    );
  });
});
