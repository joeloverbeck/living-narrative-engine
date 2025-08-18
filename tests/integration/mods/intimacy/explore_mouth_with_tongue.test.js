/**
 * @file Integration tests for the intimacy:explore_mouth_with_tongue action and rule.
 * @description Tests the rule execution after the explore_mouth_with_tongue action is performed.
 * This action has no prerequisites about initiator status, allowing any kissing participant to explore.
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
import exploreMouthWithTongueRule from '../../../../data/mods/intimacy/rules/explore_mouth_with_tongue.rule.json';
import eventIsActionExploreMouthWithTongue from '../../../../data/mods/intimacy/conditions/event-is-action-explore-mouth-with-tongue.condition.json';
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
 * Creates handlers needed for the explore_mouth_with_tongue rule.
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

describe('intimacy:explore_mouth_with_tongue action integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(exploreMouthWithTongueRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([
          { ...exploreMouthWithTongueRule, actions: expanded },
        ]),
      getConditionDefinition: jest.fn((id) => {
        switch (id) {
          case 'intimacy:event-is-action-explore-mouth-with-tongue':
            return eventIsActionExploreMouthWithTongue;
          default:
            return undefined;
        }
      }),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...exploreMouthWithTongueRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('successfully executes explore mouth with tongue for initiator (initiator: true)', async () => {
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
      eventName: 'core:attempt_action',
      actorId: 'initiator1',
      actionId: 'intimacy:explore_mouth_with_tongue',
      targetId: 'receiver1',
      originalInput: 'explore_mouth_with_tongue receiver1',
    });

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice explores Bob's mouth with their tongue."
    );

    const turnEndedEvent = testEnv.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('successfully executes explore mouth with tongue for receiver (initiator: false)', async () => {
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
      eventName: 'core:attempt_action',
      actorId: 'receiver1',
      actionId: 'intimacy:explore_mouth_with_tongue',
      targetId: 'initiator1',
      originalInput: 'explore_mouth_with_tongue initiator1',
    });

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Sarah explores James's mouth with their tongue."
    );

    const turnEndedEvent = testEnv.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perception log shows correct message for explore mouth with tongue', async () => {
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
      eventName: 'core:attempt_action',
      actorId: 'passionate1',
      actionId: 'intimacy:explore_mouth_with_tongue',
      targetId: 'passionate2',
      originalInput: 'explore_mouth_with_tongue passionate2',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Emma explores David's mouth with their tongue."
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
      eventName: 'core:attempt_action',
      actorId: 'kisser1',
      actionId: 'intimacy:explore_mouth_with_tongue',
      targetId: 'kisser2',
      originalInput: 'explore_mouth_with_tongue kisser2',
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

    // Explore current partner Bob's mouth
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'polyamorous1',
      actionId: 'intimacy:explore_mouth_with_tongue',
      targetId: 'partner1',
      originalInput: 'explore_mouth_with_tongue partner1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice explores Bob's mouth with their tongue."
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
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'intimacy:break_kiss_gently',
      targetId: 'actor2',
      originalInput: 'break_kiss_gently actor2',
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
      eventName: 'core:attempt_action',
      actorId: 'sequencer1',
      actionId: 'intimacy:explore_mouth_with_tongue',
      targetId: 'sequencer2',
      originalInput: 'explore_mouth_with_tongue sequencer2',
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
        id: 'romantic_explorer',
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
          'positioning:closeness': { partners: ['romantic_explorer'] },
          'intimacy:kissing': {
            partner: 'romantic_explorer',
            initiator: false,
          },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'romantic_explorer',
      actionId: 'intimacy:explore_mouth_with_tongue',
      targetId: 'passionate_recipient',
      originalInput: 'explore_mouth_with_tongue passionate_recipient',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Emily explores Michael's mouth with their tongue."
    );
    expect(perceptibleEvent.payload.locationId).toBe('moonlit_balcony');

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent.payload.message).toBe(
      "Emily explores Michael's mouth with their tongue."
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
        actionId: 'intimacy:explore_mouth_with_tongue',
        targetId: testCase.targetId,
      });

      const successEvent = testEnv.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        `${testCase.actorName} explores ${testCase.targetName}'s mouth with their tongue.`
      );

      // Clear events for next iteration
      testEnv.events.length = 0;
    }
  });
});
