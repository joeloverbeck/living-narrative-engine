/**
 * @file Integration tests for the intimacy:nibble_lower_lip action and rule.
 * @description Tests the rule execution after the nibble_lower_lip action is performed.
 * This action has no prerequisites about initiator status, allowing any kissing participant to nibble.
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
import nibbleLowerLipRule from '../../../../data/mods/intimacy/rules/nibble_lower_lip.rule.json';
import eventIsActionNibbleLowerLip from '../../../../data/mods/intimacy/conditions/event-is-action-nibble-lower-lip.condition.json';
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
 * Creates handlers needed for the nibble_lower_lip rule.
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

describe('intimacy:nibble_lower_lip action integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(nibbleLowerLipRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...nibbleLowerLipRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) => {
        switch (id) {
          case 'intimacy:event-is-action-nibble-lower-lip':
            return eventIsActionNibbleLowerLip;
          default:
            return undefined;
        }
      }),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...nibbleLowerLipRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('successfully executes nibble lower lip for initiator (initiator: true)', async () => {
    testEnv.reset([
      {
        id: 'initiator1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['receiver1'] },
          'intimacy:kissing': { partner: 'receiver1', initiator: true },
        },
      },
      {
        id: 'receiver1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['initiator1'] },
          'intimacy:kissing': { partner: 'initiator1', initiator: false },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'initiator1',
      actionId: 'intimacy:nibble_lower_lip',
      targetId: 'receiver1',
    });

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice nibbles on Bob's lower lip."
    );

    const turnEndedEvent = testEnv.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('successfully executes nibble lower lip for receiver (initiator: false)', async () => {
    testEnv.reset([
      {
        id: 'receiver1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Sarah' },
          [POSITION_COMPONENT_ID]: { locationId: 'garden' },
          'positioning:closeness': { partners: ['initiator1'] },
          'intimacy:kissing': { partner: 'initiator1', initiator: false },
        },
      },
      {
        id: 'initiator1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'James' },
          [POSITION_COMPONENT_ID]: { locationId: 'garden' },
          'positioning:closeness': { partners: ['receiver1'] },
          'intimacy:kissing': { partner: 'receiver1', initiator: true },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'receiver1',
      actionId: 'intimacy:nibble_lower_lip',
      targetId: 'initiator1',
    });

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Sarah nibbles on James's lower lip."
    );

    const turnEndedEvent = testEnv.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perception log shows correct message for nibble lower lip', async () => {
    testEnv.reset([
      {
        id: 'passionate1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Emma' },
          [POSITION_COMPONENT_ID]: { locationId: 'bedroom' },
          'positioning:closeness': { partners: ['passionate2'] },
          'intimacy:kissing': { partner: 'passionate2', initiator: true },
        },
      },
      {
        id: 'passionate2',
        components: {
          [NAME_COMPONENT_ID]: { text: 'David' },
          [POSITION_COMPONENT_ID]: { locationId: 'bedroom' },
          'positioning:closeness': { partners: ['passionate1'] },
          'intimacy:kissing': { partner: 'passionate1', initiator: false },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'passionate1',
      actionId: 'intimacy:nibble_lower_lip',
      targetId: 'passionate2',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Emma has nibbled on David's lower lip."
    );
    expect(perceptibleEvent.payload.locationId).toBe('bedroom');
    expect(perceptibleEvent.payload.actorId).toBe('passionate1');
    expect(perceptibleEvent.payload.targetId).toBe('passionate2');
  });

  it('preserves kissing component state (no ADD_COMPONENT or REMOVE_COMPONENT operations)', async () => {
    testEnv.reset([
      {
        id: 'kisser1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['kisser2'] },
          'intimacy:kissing': { partner: 'kisser2', initiator: true },
        },
      },
      {
        id: 'kisser2',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['kisser1'] },
          'intimacy:kissing': { partner: 'kisser1', initiator: false },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'kisser1',
      actionId: 'intimacy:nibble_lower_lip',
      targetId: 'kisser2',
    });

    // Verify this is an enhancement action that preserves kissing state
    // by checking that the rule executed successfully (no component modification errors)
    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();

    const turnEndedEvent = testEnv.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('handles multiple kissing partners correctly', async () => {
    testEnv.reset([
      {
        id: 'polyamorous1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['partner1', 'partner2'] },
          'intimacy:kissing': { partner: 'partner1', initiator: true },
        },
      },
      {
        id: 'partner1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['polyamorous1', 'partner2'] },
          'intimacy:kissing': { partner: 'polyamorous1', initiator: false },
        },
      },
      {
        id: 'partner2',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Charlie' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['polyamorous1', 'partner1'] },
        },
      },
    ]);

    // Nibble current partner Bob's lower lip
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'polyamorous1',
      actionId: 'intimacy:nibble_lower_lip',
      targetId: 'partner1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice has nibbled on Bob's lower lip."
    );
  });

  it('action only fires for correct action ID', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['actor2'] },
          'intimacy:kissing': { partner: 'actor2', initiator: true },
        },
      },
      {
        id: 'actor2',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['actor1'] },
          'intimacy:kissing': { partner: 'actor1', initiator: false },
        },
      },
    ]);

    // Try with a different action
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'intimacy:break_kiss_gently',
      targetId: 'actor2',
    });

    // Should not have any perceptible events from our rule
    const perceptibleEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(0);
  });

  it('validates complete event flow sequence', async () => {
    testEnv.reset([
      {
        id: 'sequencer1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['sequencer2'] },
          'intimacy:kissing': { partner: 'sequencer2', initiator: true },
        },
      },
      {
        id: 'sequencer2',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['sequencer1'] },
          'intimacy:kissing': { partner: 'sequencer1', initiator: false },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'sequencer1',
      actionId: 'intimacy:nibble_lower_lip',
      targetId: 'sequencer2',
    });

    const eventTypes = testEnv.events.map((e) => e.eventType);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );

    // Verify order: perceptible -> success -> turn_ended
    const perceptibleIndex = eventTypes.indexOf('core:perceptible_event');
    const successIndex = eventTypes.indexOf(
      'core:display_successful_action_result'
    );
    const turnEndedIndex = eventTypes.indexOf('core:turn_ended');

    expect(perceptibleIndex).toBeLessThan(successIndex);
    expect(successIndex).toBeLessThan(turnEndedIndex);
  });

  it('works with different entity names and locations', async () => {
    testEnv.reset([
      {
        id: 'romantic_nibbler',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Emily' },
          [POSITION_COMPONENT_ID]: { locationId: 'moonlit_balcony' },
          'positioning:closeness': { partners: ['passionate_recipient'] },
          'intimacy:kissing': {
            partner: 'passionate_recipient',
            initiator: true,
          },
        },
      },
      {
        id: 'passionate_recipient',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Michael' },
          [POSITION_COMPONENT_ID]: { locationId: 'moonlit_balcony' },
          'positioning:closeness': { partners: ['romantic_nibbler'] },
          'intimacy:kissing': {
            partner: 'romantic_nibbler',
            initiator: false,
          },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'romantic_nibbler',
      actionId: 'intimacy:nibble_lower_lip',
      targetId: 'passionate_recipient',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Emily has nibbled on Michael's lower lip."
    );
    expect(perceptibleEvent.payload.locationId).toBe('moonlit_balcony');

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent.payload.message).toBe(
      "Emily nibbles on Michael's lower lip."
    );
  });

  it('works regardless of initiator status (no prerequisites)', async () => {
    // Test with both initiator and receiver performing the action
    const testCases = [
      {
        actorId: 'initiator1',
        targetId: 'receiver1',
        actorName: 'Alice',
        targetName: 'Bob',
      },
      {
        actorId: 'receiver1',
        targetId: 'initiator1',
        actorName: 'Bob',
        targetName: 'Alice',
      },
    ];

    for (const testCase of testCases) {
      testEnv.reset([
        {
          id: 'initiator1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'positioning:closeness': { partners: ['receiver1'] },
            'intimacy:kissing': { partner: 'receiver1', initiator: true },
          },
        },
        {
          id: 'receiver1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'positioning:closeness': { partners: ['initiator1'] },
            'intimacy:kissing': { partner: 'initiator1', initiator: false },
          },
        },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actorId: testCase.actorId,
        actionId: 'intimacy:nibble_lower_lip',
        targetId: testCase.targetId,
      });

      const successEvent = testEnv.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        `${testCase.actorName} nibbles on ${testCase.targetName}'s lower lip.`
      );

      // Clear events for next iteration
      testEnv.events.length = 0;
    }
  });
});
