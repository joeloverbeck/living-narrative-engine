/**
 * @file Integration tests for the intimacy:hug_tight action and rule.
 * @description Tests the rule execution after the hug_tight action is performed.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import hugTightRule from '../../../../data/mods/intimacy/rules/handle_hug_tight.rule.json';
import eventIsActionHugTight from '../../../../data/mods/intimacy/conditions/event-is-action-hug-tight.condition.json';
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
 * Creates handlers needed for the hug_tight rule.
 *
 * @param entityManager
 * @param eventBus
 * @param logger
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

describe('intimacy:hug_tight action rule execution', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(hugTightRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...hugTightRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'intimacy:event-is-action-hug-tight'
          ? eventIsActionHugTight
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...hugTightRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('performs hug tight action successfully', async () => {
    // Setup entities
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'living_room' },
          'positioning:closeness': {
            partners: [
              {
                entityId: 'test:actor2',
                mutualConsent: true,
                initiator: 'test:actor1',
              },
            ],
          },
        },
      },
      {
        id: 'test:actor2',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'living_room' },
          'positioning:closeness': {
            partners: [
              {
                entityId: 'test:actor1',
                mutualConsent: true,
                initiator: 'test:actor1',
              },
            ],
          },
        },
      },
    ]);

    // Dispatch the action event
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'intimacy:hug_tight',
      targetId: 'test:actor2',
      originalInput: 'hug bob tight',
    });

    // Check success message
    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Alice closes their arms around Bob tenderly, hugging Bob tight.'
    );

    // Check perceptible event
    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Alice closes their arms around Bob tenderly, hugging Bob tight.'
    );
    expect(perceptibleEvent.payload.locationId).toBe('living_room');
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.actorId).toBe('test:actor1');
    expect(perceptibleEvent.payload.targetId).toBe('test:actor2');

    // Check turn ended
    const turnEndedEvent = testEnv.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.entityId).toBe('test:actor1');
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('formats message correctly with different names', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Sir Lancelot' },
          [POSITION_COMPONENT_ID]: { locationId: 'castle_hall' },
        },
      },
      {
        id: 'test:actor2',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Lady Guinevere' },
          [POSITION_COMPONENT_ID]: { locationId: 'castle_hall' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'intimacy:hug_tight',
      targetId: 'test:actor2',
      originalInput: 'hug guinevere tight',
    });

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent.payload.message).toBe(
      'Sir Lancelot closes their arms around Lady Guinevere tenderly, hugging Lady Guinevere tight.'
    );
  });

  it('handles action with correct perception type', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'garden' },
        },
      },
      {
        id: 'test:actor2',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'garden' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'intimacy:hug_tight',
      targetId: 'test:actor2',
      originalInput: 'hug bob tight',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    // Verify perception type is action_target_general (for targeted actions)
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );

    // Verify target is properly set
    expect(perceptibleEvent.payload.targetId).toBe('test:actor2');

    // Verify location is correct
    expect(perceptibleEvent.payload.locationId).toBe('garden');
  });
});
