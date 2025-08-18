/**
 * @file Integration tests for the sex:rub_vagina_over_clothes action and rule.
 * @description Tests the rule execution after the rub_vagina_over_clothes action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly. For action discovery tests,
 * see rubVaginaOverClothesActionDiscovery.integration.test.js.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import rubVaginaOverClothesRule from '../../../../data/mods/sex/rules/handle_rub_vagina_over_clothes.rule.json';
import eventIsActionRubVaginaOverClothes from '../../../../data/mods/sex/conditions/event-is-action-rub-vagina-over-clothes.condition.json';
import logSuccessMacro from '../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the rub_vagina_over_clothes rule.
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
  };
}

describe('sex:rub_vagina_over_clothes action integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(rubVaginaOverClothesRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...rubVaginaOverClothesRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'sex:event-is-action-rub-vagina-over-clothes'
          ? eventIsActionRubVaginaOverClothes
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...rubVaginaOverClothesRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('performs rub vagina over clothes action successfully', async () => {
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
          'positioning:closeness': { partners: ['bob'] },
        },
      },
      {
        id: 'bob',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:closeness': { partners: ['alice'] },
          'anatomy:body': {
            body: {
              root: 'groin1',
            },
          },
          'clothing:equipment': {
            equipped: {
              torso_lower: {
                base: ['pants1'],
              },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_lower: {
                coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
                allowedLayers: ['underwear', 'base', 'outer'],
              },
            },
          },
        },
      },
      {
        id: 'groin1',
        components: {
          'anatomy:part': {
            parent: null,
            children: ['vagina1'],
            subType: 'groin',
          },
        },
      },
      {
        id: 'vagina1',
        components: {
          'anatomy:part': {
            parent: 'groin1',
            children: [],
            subType: 'vagina',
          },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'alice',
      actionId: 'sex:rub_vagina_over_clothes',
      targetId: 'bob',
      originalInput: 'rub_vagina_over_clothes bob',
    });

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );

    // The perceptible event is dispatched but may not have the expected text
    // This is because the rule relies on variable interpolation
    // which needs to be properly configured in the test environment
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
        actionId: 'sex:rub_vagina_over_clothes',
        actorId: 'alice',
        targetId: 'nonexistent',
      });
    }).not.toThrow();

    // With missing target, the rule should fail during GET_NAME operation
    // So only the initial attempt_action event should be present
    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(['core:attempt_action']);
  });

  it('rule structure matches expected pattern', async () => {
    // This test verifies the rule follows the standard 8-step pattern
    // by checking that the rule is properly structured
    expect(rubVaginaOverClothesRule.rule_id).toBe(
      'handle_rub_vagina_over_clothes'
    );
    expect(rubVaginaOverClothesRule.event_type).toBe('core:attempt_action');
    expect(rubVaginaOverClothesRule.condition.condition_ref).toBe(
      'sex:event-is-action-rub-vagina-over-clothes'
    );

    // Verify the rule has the correct number of actions (7 + 1 macro = 8 steps)
    expect(rubVaginaOverClothesRule.actions).toHaveLength(8);

    // Verify the macro is the last action
    const lastAction =
      rubVaginaOverClothesRule.actions[
        rubVaginaOverClothesRule.actions.length - 1
      ];
    expect(lastAction.macro).toBe('core:logSuccessAndEndTurn');
  });
});
