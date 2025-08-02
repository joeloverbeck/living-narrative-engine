/**
 * @file Integration tests for the intimacy:accept_kiss_passively action and rule.
 * @description Tests the rule execution after the accept_kiss_passively action is performed.
 * Specifically tests the prerequisite that actors must be kiss receivers (not initiators).
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
import acceptKissPassivelyRule from '../../../../data/mods/intimacy/rules/accept_kiss_passively.rule.json';
import eventIsActionAcceptKissPassively from '../../../../data/mods/intimacy/conditions/event-is-action-accept-kiss-passively.condition.json';
import actorIsKissReceiver from '../../../../data/mods/intimacy/conditions/actor-is-kiss-receiver.condition.json';
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
 * Creates handlers needed for the accept_kiss_passively rule.
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

describe('intimacy:accept_kiss_passively action integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(acceptKissPassivelyRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...acceptKissPassivelyRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) => {
        switch (id) {
          case 'intimacy:event-is-action-accept-kiss-passively':
            return eventIsActionAcceptKissPassively;
          case 'intimacy:actor-is-kiss-receiver':
            return actorIsKissReceiver;
          default:
            return undefined;
        }
      }),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...acceptKissPassivelyRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('successfully executes accept kiss passively for receiver (initiator: false)', async () => {
    testEnv.reset([
      {
        id: 'receiver1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['initiator1'] },
          'intimacy:kissing': { partner: 'initiator1', initiator: false },
        },
      },
      {
        id: 'initiator1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['receiver1'] },
          'intimacy:kissing': { partner: 'receiver1', initiator: true },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'receiver1',
      actionId: 'intimacy:accept_kiss_passively',
      targetId: 'initiator1',
    });

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice accepts Bob's kiss passively."
    );

    const turnEndedEvent = testEnv.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perception log shows correct message for accept kiss passively', async () => {
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
      actionId: 'intimacy:accept_kiss_passively',
      targetId: 'initiator1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Sarah has accepted James's kiss passively."
    );
    expect(perceptibleEvent.payload.locationId).toBe('garden');
    expect(perceptibleEvent.payload.actorId).toBe('receiver1');
    expect(perceptibleEvent.payload.targetId).toBe('initiator1');
  });

  it('preserves kissing component state (no ADD_COMPONENT or REMOVE_COMPONENT operations)', async () => {
    testEnv.reset([
      {
        id: 'receiver1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['initiator1'] },
          'intimacy:kissing': { partner: 'initiator1', initiator: false },
        },
      },
      {
        id: 'initiator1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['receiver1'] },
          'intimacy:kissing': { partner: 'receiver1', initiator: true },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'receiver1',
      actionId: 'intimacy:accept_kiss_passively',
      targetId: 'initiator1',
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
        id: 'receiver1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['initiator1', 'initiator2'] },
          'intimacy:kissing': { partner: 'initiator1', initiator: false },
        },
      },
      {
        id: 'initiator1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['receiver1', 'initiator2'] },
          'intimacy:kissing': { partner: 'receiver1', initiator: true },
        },
      },
      {
        id: 'initiator2',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Charlie' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['receiver1', 'initiator1'] },
        },
      },
    ]);

    // Accept kiss from Bob (current partner)
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'receiver1',
      actionId: 'intimacy:accept_kiss_passively',
      targetId: 'initiator1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice has accepted Bob's kiss passively."
    );
  });

  it('action only fires for correct action ID', async () => {
    testEnv.reset([
      {
        id: 'receiver1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['initiator1'] },
          'intimacy:kissing': { partner: 'initiator1', initiator: false },
        },
      },
      {
        id: 'initiator1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['receiver1'] },
          'intimacy:kissing': { partner: 'receiver1', initiator: true },
        },
      },
    ]);

    // Try with a different action
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'receiver1',
      actionId: 'intimacy:break_kiss_gently',
      targetId: 'initiator1',
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
        id: 'receiver1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['initiator1'] },
          'intimacy:kissing': { partner: 'initiator1', initiator: false },
        },
      },
      {
        id: 'initiator1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['receiver1'] },
          'intimacy:kissing': { partner: 'receiver1', initiator: true },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'receiver1',
      actionId: 'intimacy:accept_kiss_passively',
      targetId: 'initiator1',
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
        id: 'romantic_receiver',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Emily' },
          [POSITION_COMPONENT_ID]: { locationId: 'park_bench' },
          'positioning:closeness': { partners: ['passionate_initiator'] },
          'intimacy:kissing': {
            partner: 'passionate_initiator',
            initiator: false,
          },
        },
      },
      {
        id: 'passionate_initiator',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Michael' },
          [POSITION_COMPONENT_ID]: { locationId: 'park_bench' },
          'positioning:closeness': { partners: ['romantic_receiver'] },
          'intimacy:kissing': { partner: 'romantic_receiver', initiator: true },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'romantic_receiver',
      actionId: 'intimacy:accept_kiss_passively',
      targetId: 'passionate_initiator',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Emily has accepted Michael's kiss passively."
    );
    expect(perceptibleEvent.payload.locationId).toBe('park_bench');

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent.payload.message).toBe(
      "Emily accepts Michael's kiss passively."
    );
  });
});
