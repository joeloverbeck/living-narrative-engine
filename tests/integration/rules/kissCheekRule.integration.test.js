/**
 * @file Integration tests for the intimacy:kiss_cheek rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import kissCheekRule from '../../../data/mods/intimacy/rules/kiss_cheek.rule.json';
import eventIsActionKissCheek from '../../../data/mods/intimacy/conditions/event-is-action-kiss-cheek.condition.json';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the kiss_cheek rule.
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

describe('intimacy_handle_kiss_cheek rule integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(kissCheekRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...kissCheekRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'intimacy:event-is-action-kiss-cheek'
          ? eventIsActionKissCheek
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...kissCheekRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('performs kiss cheek action successfully', () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Actor' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'intimacy:closeness': { partners: ['target1'] },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Target' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'intimacy:closeness': { partners: ['actor1'] },
        },
      },
    ]);

    testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'actor1',
      actionId: 'intimacy:kiss_cheek',
      targetId: 'target1',
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
});
