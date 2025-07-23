/**
 * @file Integration tests for the intimacy:feel_arm_muscles action and rule.
 * @description Tests the rule execution after the feel_arm_muscles action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import feelArmMusclesRule from '../../../../data/mods/intimacy/rules/handle_feel_arm_muscles.rule.json';
import eventIsActionFeelArmMuscles from '../../../../data/mods/intimacy/conditions/event-is-action-feel-arm-muscles.condition.json';
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
 * Creates handlers needed for the feel_arm_muscles rule.
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

describe('intimacy:feel_arm_muscles action integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(feelArmMusclesRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...feelArmMusclesRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'intimacy:event-is-action-feel-arm-muscles'
          ? eventIsActionFeelArmMuscles
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...feelArmMusclesRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('performs feel arm muscles action successfully', async () => {
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
          'intimacy:closeness': { partners: ['bob'] },
        },
      },
      {
        id: 'bob',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'intimacy:closeness': { partners: ['alice'] },
          'anatomy:body': {
            body: {
              root: 'torso1',
            },
          },
        },
      },
      {
        id: 'torso1',
        components: {
          'anatomy:part': {
            parent: null,
            children: ['leftArm1', 'rightArm1'],
            subType: 'torso',
          },
        },
      },
      {
        id: 'leftArm1',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'arm',
          },
          'descriptors:build': {
            build: 'muscular',
          },
        },
      },
      {
        id: 'rightArm1',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'arm',
          },
          'descriptors:build': {
            build: 'muscular',
          },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'alice',
      actionId: 'intimacy:feel_arm_muscles',
      targetId: 'bob',
    });

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );

    // Verify the perception event was dispatched
    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();

    // Verify the success message was dispatched
    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toContain('feels the hard swell of');
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
          'intimacy:closeness': { partners: [] },
        },
      },
    ]);

    // This test verifies the rule handles missing entities gracefully
    // The action prerequisites would normally prevent this, but we test rule robustness
    await expect(async () => {
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'intimacy:feel_arm_muscles',
        actorId: 'alice',
        targetId: 'nonexistent',
      });
    }).not.toThrow();

    // With missing target, the rule should fail during GET_NAME operation
    // So only the initial attempt_action event should be present
    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(['core:attempt_action']);
  });

  it('correctly processes muscular arms description', async () => {
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
          'intimacy:closeness': { partners: ['bob'] },
        },
      },
      {
        id: 'bob',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'intimacy:closeness': { partners: ['alice'] },
          'anatomy:body': {
            body: {
              root: 'torso1',
            },
          },
        },
      },
      {
        id: 'torso1',
        components: {
          'anatomy:part': {
            parent: null,
            children: ['leftArm1'],
            subType: 'torso',
          },
        },
      },
      {
        id: 'leftArm1',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'arm',
          },
          'descriptors:build': {
            build: 'muscular',
          },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'alice',
      actionId: 'intimacy:feel_arm_muscles',
      targetId: 'bob',
    });

    // Find the display successful action result event
    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );

    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice feels the hard swell of Bob's muscles."
    );
  });
});
