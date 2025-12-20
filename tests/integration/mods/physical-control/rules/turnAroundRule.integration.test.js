/**
 * @file Integration tests for the physical-control:turn_around rule.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import turnAroundRule from '../../../../../data/mods/physical-control/rules/handle_turn_around.rule.json';
import eventIsActionTurnAround from '../../../../../data/mods/physical-control/conditions/event-is-action-turn-around.condition.json';
import logSuccessMacro from '../../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import logSuccessOutcomeMacro from '../../../../../data/mods/core/macros/logSuccessOutcomeAndEndTurn.macro.json';
import { expandMacros } from '../../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../../src/logic/operationHandlers/endTurnHandler.js';
import ModifyArrayFieldHandler from '../../../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';
import AddComponentHandler from '../../../../../src/logic/operationHandlers/addComponentHandler.js';
import RemoveComponentHandler from '../../../../../src/logic/operationHandlers/removeComponentHandler.js';
import SetVariableHandler from '../../../../../src/logic/operationHandlers/setVariableHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the turn_around rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @param {object} gameDataRepository - Game data repository instance
 * @returns {object} Handlers object
 */
function createHandlers(entityManager, eventBus, logger, gameDataRepository) {
  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      eventBus.dispatch(eventType, payload);
      return Promise.resolve(true);
    }),
  };
  const recipientSetBuilder = { build: jest.fn() };

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
      routingPolicyService: {
        validateAndHandle: jest.fn().mockReturnValue(true),
      },
      recipientSetBuilder,
    }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeDispatcher,
      logger,
    }),
    MODIFY_ARRAY_FIELD: new ModifyArrayFieldHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    ADD_COMPONENT: new AddComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      gameDataRepository,
    }),
    REMOVE_COMPONENT: new RemoveComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
  };
}

describe('physical_control_handle_turn_around rule integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = {
      'core:logSuccessAndEndTurn': logSuccessMacro,
      'core:logSuccessOutcomeAndEndTurn': logSuccessOutcomeMacro,
    };
    const expanded = expandMacros(turnAroundRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...turnAroundRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'physical-control:event-is-action-turn-around'
          ? eventIsActionTurnAround
          : undefined
      ),
      getComponentDefinition: jest.fn().mockReturnValue(null),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...turnAroundRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  describe('turning target around (first time)', () => {
    it('creates facing_away component and emits actor_turned_around event', async () => {
      testEnv.reset([
        {
          id: 'actor1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: ['target1'] },
          },
        },
        {
          id: 'target1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: ['actor1'] },
          },
        },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'actor1',
        actionId: 'physical-control:turn_around',
        targetId: 'target1',
        originalInput: 'turn_around target1',
      });

      // Check basic events first to ensure action triggered
      const types = testEnv.events.map((e) => e.eventType);
      expect(types).toContain('core:turn_ended');

      // Check that facing_away component was created
      const target = testEnv.entityManager.getEntityInstance('target1');
      expect(target?.components['positioning:facing_away']).toBeDefined();
      expect(
        target.components['positioning:facing_away'].facing_away_from
      ).toContain('actor1');

      // Only check for events that should exist if rule worked
      expect(types).toContain('physical-control:actor_turned_around');
      const turnedAroundEvent = testEnv.events.find(
        (e) => e.eventType === 'physical-control:actor_turned_around'
      );
      expect(turnedAroundEvent.payload).toEqual({
        actor: 'target1',
        turned_by: 'actor1',
      });
    });
  });

  describe('turning target to face forward (already facing away)', () => {
    it('removes actor from facing_away array and emits actor_faced_forward event', async () => {
      testEnv.reset([
        {
          id: 'actor1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: ['target1'] },
          },
        },
        {
          id: 'target1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: ['actor1'] },
            'positioning:facing_away': { facing_away_from: ['actor1'] },
          },
        },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'actor1',
        actionId: 'physical-control:turn_around',
        targetId: 'target1',
        originalInput: 'turn_around target1',
      });

      // Check that actor was removed from facing_away array
      const target = testEnv.entityManager.getEntityInstance('target1');
      expect(target.components['positioning:facing_away']).toBeUndefined();

      // Check events
      const types = testEnv.events.map((e) => e.eventType);
      expect(types).toContain('positioning:actor_faced_forward');
      expect(types).toContain('core:perceptible_event');
      expect(types).toContain('core:display_successful_action_result');
      expect(types).toContain('core:turn_ended');

      // Check actor_faced_forward event payload
      const facedForwardEvent = testEnv.events.find(
        (e) => e.eventType === 'positioning:actor_faced_forward'
      );
      expect(facedForwardEvent.payload).toEqual({
        actor: 'target1',
        facing: 'actor1',
      });
    });
  });

  describe('multiple actors in facing_away state', () => {
    it('maintains other actors in array when one is removed', async () => {
      testEnv.reset([
        {
          id: 'actor1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: ['target1', 'actor2'] },
          },
        },
        {
          id: 'actor2',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Charlie' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: ['target1', 'actor1'] },
          },
        },
        {
          id: 'target1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: ['actor1', 'actor2'] },
            'positioning:facing_away': {
              facing_away_from: ['actor1', 'actor2'],
            },
          },
        },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'actor1',
        actionId: 'physical-control:turn_around',
        targetId: 'target1',
        originalInput: 'turn_around target1',
      });

      // Check that only actor1 was removed
      const target = testEnv.entityManager.getEntityInstance('target1');
      expect(target.components['positioning:facing_away']).toBeDefined();
      expect(
        target.components['positioning:facing_away'].facing_away_from
      ).not.toContain('actor1');
      expect(
        target.components['positioning:facing_away'].facing_away_from
      ).toContain('actor2');
    });
  });

  describe('adding to existing facing_away component', () => {
    it('adds new actor to existing array', async () => {
      testEnv.reset([
        {
          id: 'actor1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: ['target1', 'actor2'] },
          },
        },
        {
          id: 'actor2',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Charlie' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: ['target1', 'actor1'] },
          },
        },
        {
          id: 'target1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: ['actor1', 'actor2'] },
            'positioning:facing_away': { facing_away_from: ['actor2'] },
          },
        },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'actor1',
        actionId: 'physical-control:turn_around',
        targetId: 'target1',
        originalInput: 'turn_around target1',
      });

      // Check that actor1 was added to existing array
      const target = testEnv.entityManager.getEntityInstance('target1');
      expect(
        target.components['positioning:facing_away'].facing_away_from
      ).toContain('actor1');
      expect(
        target.components['positioning:facing_away'].facing_away_from
      ).toContain('actor2');
      expect(
        target.components['positioning:facing_away'].facing_away_from
      ).toHaveLength(2);
    });
  });
});
