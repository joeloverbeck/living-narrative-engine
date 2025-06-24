/**
 * @file Integration tests for the core turn_started rule.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import turnStartedRule from '../../../data/mods/core/rules/turn_started.rule.json';
import eventIsTurnStarted from '../../../data/mods/core/conditions/event-is-turn_started.condition.json';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import AddComponentHandler from '../../../src/logic/operationHandlers/addComponentHandler.js';
import jsonLogic from 'json-logic-js';
import { TURN_STARTED_ID } from '../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the turn_started rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @returns {object} Handlers object
 */
function createHandlers(entityManager, eventBus, logger) {
  const safeEventDispatcher = { dispatch: jest.fn() };
  return {
    SET_VARIABLE: new SetVariableHandler({ logger }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    ADD_COMPONENT: new AddComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher,
    }),
  };
}

describe('core_handle_turn_started rule integration', () => {
  let testEnv;

  beforeEach(() => {
    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([turnStartedRule]),
      getConditionDefinition: jest.fn((id) =>
        id === 'core:event-is-turn-started' ? eventIsTurnStarted : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [turnStartedRule],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('adds current_actor component when turn_started is received', () => {
    testEnv.reset([
      {
        id: 'test-entity',
        components: {},
      },
    ]);

    testEnv.eventBus.dispatch(TURN_STARTED_ID, {
      entityId: 'test-entity',
    });

    // The rule should add a core:current_actor component to the entity
    const entity = testEnv.entityManager.getEntityInstance('test-entity');
    expect(entity).toBeDefined();
    expect(
      testEnv.entityManager.hasComponent('test-entity', 'core:current_actor')
    ).toBe(true);
  });
});
