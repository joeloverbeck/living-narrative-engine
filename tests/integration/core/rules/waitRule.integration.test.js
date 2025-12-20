/**
 * @file Integration tests for the core wait rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import waitRule from '../../../../data/mods/core/rules/wait.rule.json';
import eventIsActionWait from '../../../../data/mods/core/conditions/event-is-action-wait.condition.json';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the wait rule.
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

  // Create mock routing policy service for recipient/exclusion validation
  const routingPolicyService = {
    validateAndHandle: jest.fn().mockReturnValue(true),
  };

  return {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      routingPolicyService,
    }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeDispatcher,
      logger,
    }),
  };
}

describe('core_handle_wait rule integration', () => {
  let testEnv;

  beforeEach(() => {
    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([waitRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'core:event-is-action-wait' ? eventIsActionWait : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [waitRule],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('ends turn when wait action is performed', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          name: { text: 'Test Actor' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'core:wait',
      originalInput: 'wait',
    });

    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toEqual(expect.arrayContaining(['core:turn_ended']));
  });

  it('throws when a handler lacks an execute method', () => {
    /**
     *
     */
    function badHandlers() {
      return { BAD_HANDLER: {} };
    }

    expect(() =>
      createRuleTestEnvironment({
        createHandlers: badHandlers,
      })
    ).toThrow(
      'Handler for BAD_HANDLER must be an object with an execute() method'
    );
  });
});
