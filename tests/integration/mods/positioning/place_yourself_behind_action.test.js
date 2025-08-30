/**
 * @file Integration tests for the positioning:place_yourself_behind action and rule.
 * @description Tests the rule execution after the place_yourself_behind action is performed.
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
import placeYourselfBehindRule from '../../../../data/mods/positioning/rules/place_yourself_behind.rule.json';
import eventIsActionPlaceYourselfBehind from '../../../../data/mods/positioning/conditions/event-is-action-place-yourself-behind.condition.json';
import logSuccessMacro from '../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import AddComponentHandler from '../../../../src/logic/operationHandlers/addComponentHandler.js';
import ModifyArrayFieldHandler from '../../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the place_yourself_behind rule.
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
    DISPATCH_EVENT: new DispatchEventHandler({
      dispatcher: eventBus,
      logger,
    }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      addPerceptionLogEntryHandler: { execute: jest.fn() },
    }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeDispatcher,
      logger,
    }),
    SET_VARIABLE: new SetVariableHandler({
      logger,
    }),
    ADD_COMPONENT: new AddComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    MODIFY_ARRAY_FIELD: new ModifyArrayFieldHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
  };
}

describe('Place Yourself Behind Action Integration Tests', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(placeYourselfBehindRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getCondition: (id) => {
        if (id === eventIsActionPlaceYourselfBehind.id) {
          return eventIsActionPlaceYourselfBehind;
        }
        return null;
      },
      getConditionDefinition: (id) => {
        if (id === eventIsActionPlaceYourselfBehind.id) {
          return eventIsActionPlaceYourselfBehind;
        }
        return null;
      },
      getAllSystemRules: () => [
        { ...placeYourselfBehindRule, actions: expanded },
      ],
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      dataRegistry,
      entities: [],
      rules: [{ ...placeYourselfBehindRule, actions: expanded }],
    });
  });

  afterEach(() => {
    testEnv?.cleanup?.();
    jest.clearAllMocks();
  });

  it('should successfully execute place_yourself_behind action with proper component assignment', async () => {
    // Arrange
    const actorId = 'test:player';
    const targetId = 'test:npc';
    const locationId = 'test:room';

    testEnv.reset([
      {
        id: actorId,
        components: {
          [NAME_COMPONENT_ID]: {
            first: 'Player',
            last: 'Character',
          },
          [POSITION_COMPONENT_ID]: {
            locationId,
          },
        },
      },
      {
        id: targetId,
        components: {
          [NAME_COMPONENT_ID]: {
            first: 'Guard',
            last: 'NPC',
          },
        },
      },
    ]);

    // Act - Dispatch the action attempt event
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId,
      actionId: 'positioning:place_yourself_behind',
      targetId,
      originalInput: 'place yourself behind test:npc',
    });

    // Assert - Check basic events first to ensure action triggered
    const types = testEnv.events.map((e) => e.eventType);
    expect(types).toContain('core:turn_ended');

    // Assert - Verify target receives the facing_away component
    const target = testEnv.entityManager.getEntityInstance(targetId);
    expect(target?.components['positioning:facing_away']).toBeDefined();
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain(actorId);

    // Assert - Verify actor does NOT receive the facing_away component
    const actor = testEnv.entityManager.getEntityInstance(actorId);
    expect(actor?.components['positioning:facing_away']).toBeUndefined();

    // Assert - Verify proper event dispatch
    expect(types).toContain('positioning:actor_placed_behind');
    const placedBehindEvent = testEnv.events.find(
      (e) => e.eventType === 'positioning:actor_placed_behind'
    );
    expect(placedBehindEvent.payload.actor).toBe(actorId);
    expect(placedBehindEvent.payload.target).toBe(targetId);
  });

  it('should handle multiple actors placing themselves behind the same target', async () => {
    // Arrange
    const actor1Id = 'test:player1';
    const actor2Id = 'test:player2';
    const targetId = 'test:npc';
    const locationId = 'test:room';

    testEnv.reset([
      {
        id: actor1Id,
        components: {
          [NAME_COMPONENT_ID]: {
            first: 'Player',
            last: 'One',
          },
          [POSITION_COMPONENT_ID]: {
            locationId,
          },
        },
      },
      {
        id: actor2Id,
        components: {
          [NAME_COMPONENT_ID]: {
            first: 'Player',
            last: 'Two',
          },
          [POSITION_COMPONENT_ID]: {
            locationId,
          },
        },
      },
      {
        id: targetId,
        components: {
          [NAME_COMPONENT_ID]: {
            first: 'Guard',
            last: 'NPC',
          },
        },
      },
    ]);

    // Act - First actor places themselves behind target
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: actor1Id,
      actionId: 'positioning:place_yourself_behind',
      targetId,
      originalInput: 'place yourself behind test:npc',
    });

    // Act - Second actor places themselves behind same target
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: actor2Id,
      actionId: 'positioning:place_yourself_behind',
      targetId,
      originalInput: 'place yourself behind test:npc',
    });

    // Assert - Target should be facing away from both actors
    const target = testEnv.entityManager.getEntityInstance(targetId);
    expect(target?.components['positioning:facing_away']).toBeDefined();
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain(actor1Id);
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain(actor2Id);
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toHaveLength(2);
  });

  it('should work with entities that already have facing_away relationships', async () => {
    // Arrange
    const actorId = 'test:player';
    const targetId = 'test:npc';
    const existingActorId = 'test:existing';
    const locationId = 'test:room';

    testEnv.reset([
      {
        id: actorId,
        components: {
          [NAME_COMPONENT_ID]: {
            first: 'Player',
            last: 'Character',
          },
          [POSITION_COMPONENT_ID]: {
            locationId,
          },
        },
      },
      {
        id: targetId,
        components: {
          [NAME_COMPONENT_ID]: {
            first: 'Guard',
            last: 'NPC',
          },
          'positioning:facing_away': {
            facing_away_from: [existingActorId],
          },
        },
      },
    ]);

    // Act - Player places themselves behind target
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId,
      actionId: 'positioning:place_yourself_behind',
      targetId,
      originalInput: 'place yourself behind test:npc',
    });

    // Assert - Target should be facing away from both original and new actor
    const target = testEnv.entityManager.getEntityInstance(targetId);
    expect(target?.components['positioning:facing_away']).toBeDefined();
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain(existingActorId);
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain(actorId);
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toHaveLength(2);
  });
});
