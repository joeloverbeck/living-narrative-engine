/**
 * @file Integration tests for the intimacy:fondle_ass action with clothing layers.
 * @description Tests the multi-target fondle_ass action that includes clothing context.
 * This file specifically tests different clothing scenarios and layer priorities.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import fondleAssRule from '../../../../data/mods/intimacy/rules/handle_fondle_ass.rule.json';
import eventIsActionFondleAss from '../../../../data/mods/intimacy/conditions/event-is-action-fondle-ass.condition.json';
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
 * Creates handlers needed for the fondle_ass rule.
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

describe('intimacy:fondle_ass action with clothing layers', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(fondleAssRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...fondleAssRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'intimacy:event-is-action-fondle-ass'
          ? eventIsActionFondleAss
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...fondleAssRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('performs fondle ass action over outer layer clothing', async () => {
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
          'positioning:closeness': { partners: ['alice'] },
          'anatomy:body': {
            body: {
              root: 'torso1',
            },
          },
          'clothing:equipment': {
            equipped: {
              torso_lower: {
                underwear: ['panties1'],
                base: ['pants1'],
                outer: ['coat1'],
              },
            },
          },
        },
      },
      {
        id: 'coat1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'long coat' },
          'clothing:item': {
            slot: 'torso_lower',
            layer: 'outer',
          },
        },
      },
      {
        id: 'pants1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'jeans' },
          'clothing:item': {
            slot: 'torso_lower',
            layer: 'base',
          },
        },
      },
      {
        id: 'panties1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'silk panties' },
          'clothing:item': {
            slot: 'torso_lower',
            layer: 'underwear',
          },
        },
      },
      {
        id: 'torso1',
        components: {
          'anatomy:part': {
            parent: null,
            children: ['ass_cheek1', 'ass_cheek2'],
            subType: 'torso',
          },
        },
      },
      {
        id: 'ass_cheek1',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'ass_cheek',
          },
        },
      },
      {
        id: 'ass_cheek2',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'ass_cheek',
          },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'alice',
      actionId: 'intimacy:fondle_ass',
      primaryId: 'beth',
      secondaryId: 'coat1', // Topmost layer should be the outer layer
      originalInput: 'fondle beth ass over coat',
    });

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it('performs fondle ass action over base layer when no outer layer', async () => {
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
          'positioning:closeness': { partners: ['alice'] },
          'anatomy:body': {
            body: {
              root: 'torso1',
            },
          },
          'clothing:equipment': {
            equipped: {
              torso_lower: {
                underwear: ['panties1'],
                base: ['skirt1'],
                outer: null,
              },
            },
          },
        },
      },
      {
        id: 'skirt1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'pleated skirt' },
          'clothing:item': {
            slot: 'torso_lower',
            layer: 'base',
          },
        },
      },
      {
        id: 'panties1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'lace panties' },
          'clothing:item': {
            slot: 'torso_lower',
            layer: 'underwear',
          },
        },
      },
      {
        id: 'torso1',
        components: {
          'anatomy:part': {
            parent: null,
            children: ['ass_cheek1', 'ass_cheek2'],
            subType: 'torso',
          },
        },
      },
      {
        id: 'ass_cheek1',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'ass_cheek',
          },
        },
      },
      {
        id: 'ass_cheek2',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'ass_cheek',
          },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'alice',
      actionId: 'intimacy:fondle_ass',
      primaryId: 'beth',
      secondaryId: 'skirt1', // Base layer is topmost when no outer
      originalInput: 'fondle beth ass over skirt',
    });

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it('performs fondle ass action over underwear when only underwear present', async () => {
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
          'positioning:closeness': { partners: ['alice'] },
          'anatomy:body': {
            body: {
              root: 'torso1',
            },
          },
          'clothing:equipment': {
            equipped: {
              torso_lower: {
                underwear: ['boxers1'],
                base: null,
                outer: null,
              },
            },
          },
        },
      },
      {
        id: 'boxers1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'cotton boxers' },
          'clothing:item': {
            slot: 'torso_lower',
            layer: 'underwear',
          },
        },
      },
      {
        id: 'torso1',
        components: {
          'anatomy:part': {
            parent: null,
            children: ['ass_cheek1', 'ass_cheek2'],
            subType: 'torso',
          },
        },
      },
      {
        id: 'ass_cheek1',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'ass_cheek',
          },
        },
      },
      {
        id: 'ass_cheek2',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'ass_cheek',
          },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'alice',
      actionId: 'intimacy:fondle_ass',
      primaryId: 'beth',
      secondaryId: 'boxers1', // Underwear is topmost when it's the only layer
      originalInput: 'fondle beth ass over boxers',
    });

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it('handles different clothing item types correctly', async () => {
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
          'positioning:closeness': { partners: ['alice'] },
          'anatomy:body': {
            body: {
              root: 'torso1',
            },
          },
          'clothing:equipment': {
            equipped: {
              torso_lower: {
                underwear: null,
                base: ['shorts1'],
                outer: null,
              },
            },
          },
        },
      },
      {
        id: 'shorts1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'denim shorts' },
          'clothing:item': {
            slot: 'torso_lower',
            layer: 'base',
          },
        },
      },
      {
        id: 'torso1',
        components: {
          'anatomy:part': {
            parent: null,
            children: ['ass_cheek1', 'ass_cheek2'],
            subType: 'torso',
          },
        },
      },
      {
        id: 'ass_cheek1',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'ass_cheek',
          },
        },
      },
      {
        id: 'ass_cheek2',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'ass_cheek',
          },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'alice',
      actionId: 'intimacy:fondle_ass',
      primaryId: 'beth',
      secondaryId: 'shorts1',
      originalInput: 'fondle beth ass over shorts',
    });

    const perceptibleEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents.length).toBeGreaterThan(0);

    const successEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents.length).toBeGreaterThan(0);
  });
});
