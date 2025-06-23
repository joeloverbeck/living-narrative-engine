/**
 * @file Integration tests for the core player_turn_prompt rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import playerTurnPromptRule from '../../../data/mods/core/rules/player_turn_prompt.rule.json';
import eventIsPlayerTurnPrompt from '../../../data/mods/core/conditions/event-is-player-turn_prompt.condition.json';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import { PLAYER_TURN_PROMPT_ID } from '../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the player_turn_prompt rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @returns {object} Handlers object
 */
function createHandlers(entityManager, eventBus, logger) {
  const safeDispatcher = {
    dispatch: jest.fn(() => Promise.resolve(true)),
  };

  return {
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
  };
}

describe('core_handle_player_turn_prompt rule integration', () => {
  let testEnv;

  beforeEach(() => {
    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([playerTurnPromptRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'core:event-is-player-turn-prompt'
          ? eventIsPlayerTurnPrompt
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [playerTurnPromptRule],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('dispatches perceptible event when player turn prompt is triggered', () => {
    testEnv.eventBus.dispatch('core:player_turn_prompt', {
      entityId: 'player1',
      availableActions: ['wait', 'go'],
    });

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toContain('core:enable_input');
    expect(types).toContain('core:update_available_actions');
  });
});
