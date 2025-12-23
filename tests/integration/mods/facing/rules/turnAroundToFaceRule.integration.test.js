/**
 * @file Integration tests for the facing:turn_around_to_face rule.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import turnAroundToFaceRule from '../../../../../data/mods/facing/rules/turn_around_to_face.rule.json';
import eventIsActionTurnAroundToFace from '../../../../../data/mods/facing/conditions/event-is-action-turn-around-to-face.condition.json';
import logSuccessMacro from '../../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../../src/logic/operationHandlers/endTurnHandler.js';
import RemoveComponentHandler from '../../../../../src/logic/operationHandlers/removeComponentHandler.js';
import SetVariableHandler from '../../../../../src/logic/operationHandlers/setVariableHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the turn_around_to_face rule.
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
    GET_TIMESTAMP: new GetTimestampHandler({
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    DISPATCH_EVENT: new DispatchEventHandler({
      dispatcher: eventBus,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      routingPolicyService: {
        validateAndHandle: jest.fn().mockReturnValue(true),
      },
      recipientSetBuilder,
    }),
    END_TURN: new EndTurnHandler({
      eventBus,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    REMOVE_COMPONENT: new RemoveComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
  };
}

describe('Turn Around to Face Rule', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(turnAroundToFaceRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...turnAroundToFaceRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'facing:event-is-action-turn-around-to-face'
          ? eventIsActionTurnAroundToFace
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...turnAroundToFaceRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  describe('Basic Functionality', () => {
    it('should remove the facing_away component from the actor', async () => {
      testEnv.reset([
        {
          id: 'alice',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['bob'] },
            'facing-states:facing_away': { facing_away_from: ['bob'] },
          },
        },
        {
          id: 'bob',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['alice'] },
          },
        },
      ]);

      // Verify actor has facing_away component before action
      const aliceBefore = testEnv.entityManager.getEntityInstance('alice');
      expect(aliceBefore.components['facing-states:facing_away']).toBeDefined();

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'alice',
        actionId: 'facing:turn_around_to_face',
        targetId: 'bob',
        originalInput: 'turn_around_to_face bob',
      });

      // Verify facing_away component was removed
      const aliceAfter = testEnv.entityManager.getEntityInstance('alice');
      expect(aliceAfter.components['facing-states:facing_away']).toBeUndefined();
    });

    it('should dispatch the actor_faced_everyone event', async () => {
      testEnv.reset([
        {
          id: 'alice',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['bob'] },
            'facing-states:facing_away': { facing_away_from: ['bob'] },
          },
        },
        {
          id: 'bob',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['alice'] },
          },
        },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'alice',
        actionId: 'facing:turn_around_to_face',
        targetId: 'bob',
        originalInput: 'turn_around_to_face bob',
      });

      const types = testEnv.events.map((e) => e.eventType);
      expect(types).toContain('positioning:actor_faced_everyone');

      const facedEvent = testEnv.events.find(
        (e) => e.eventType === 'positioning:actor_faced_everyone'
      );
      expect(facedEvent.payload.actor).toBe('alice');
      expect(facedEvent.payload.faced).toBe('Bob');
    });

    it('should create a perceptible event with correct message', async () => {
      testEnv.reset([
        {
          id: 'alice',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['bob'] },
            'facing-states:facing_away': { facing_away_from: ['bob'] },
          },
        },
        {
          id: 'bob',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['alice'] },
          },
        },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'alice',
        actionId: 'facing:turn_around_to_face',
        targetId: 'bob',
        originalInput: 'turn_around_to_face bob',
      });

      const types = testEnv.events.map((e) => e.eventType);
      expect(types).toContain('core:perceptible_event');

      const perceptibleEvent = testEnv.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent.payload.descriptionText).toBe(
        'Alice turns around to face Bob.'
      );
      expect(perceptibleEvent.payload.locationId).toBe('test-location');
      expect(perceptibleEvent.payload.perceptionType).toBe(
        'physical.target_action'
      );
      expect(perceptibleEvent.payload.actorId).toBe('alice');
      expect(perceptibleEvent.payload.targetId).toBe('bob');
    });

    it('should end the turn', async () => {
      testEnv.reset([
        {
          id: 'alice',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['bob'] },
            'facing-states:facing_away': { facing_away_from: ['bob'] },
          },
        },
        {
          id: 'bob',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['alice'] },
          },
        },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'alice',
        actionId: 'facing:turn_around_to_face',
        targetId: 'bob',
        originalInput: 'turn_around_to_face bob',
      });

      const types = testEnv.events.map((e) => e.eventType);
      expect(types).toContain('core:turn_ended');

      const turnEndedEvent = testEnv.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent.payload.entityId).toBe('alice');
    });
  });

  describe('Multiple Entities in facing_away_from', () => {
    it('should remove entire facing_away component even with multiple entities', async () => {
      testEnv.reset([
        {
          id: 'alice',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['bob', 'charlie'] },
            'facing-states:facing_away': { facing_away_from: ['bob', 'charlie'] },
          },
        },
        {
          id: 'bob',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['alice', 'charlie'] },
          },
        },
        {
          id: 'charlie',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Charlie' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['alice', 'bob'] },
          },
        },
      ]);

      // Verify Alice is facing away from both Bob and Charlie
      const aliceBefore = testEnv.entityManager.getEntityInstance('alice');
      expect(
        aliceBefore.components['facing-states:facing_away'].facing_away_from
      ).toContain('bob');
      expect(
        aliceBefore.components['facing-states:facing_away'].facing_away_from
      ).toContain('charlie');

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'alice',
        actionId: 'facing:turn_around_to_face',
        targetId: 'bob',
        originalInput: 'turn_around_to_face bob',
      });

      // Verify entire component was removed
      const aliceAfter = testEnv.entityManager.getEntityInstance('alice');
      expect(aliceAfter.components['facing-states:facing_away']).toBeUndefined();
    });

    it('should still dispatch event with specific target name', async () => {
      testEnv.reset([
        {
          id: 'alice',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['bob', 'charlie'] },
            'facing-states:facing_away': { facing_away_from: ['bob', 'charlie'] },
          },
        },
        {
          id: 'bob',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['alice', 'charlie'] },
          },
        },
        {
          id: 'charlie',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Charlie' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['alice', 'bob'] },
          },
        },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'alice',
        actionId: 'facing:turn_around_to_face',
        targetId: 'bob',
        originalInput: 'turn_around_to_face bob',
      });

      const facedEvent = testEnv.events.find(
        (e) => e.eventType === 'positioning:actor_faced_everyone'
      );
      expect(facedEvent.payload.faced).toBe('Bob');
      // Even though Alice faces everyone, the event includes the specific target
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing target entity gracefully', async () => {
      testEnv.reset([
        {
          id: 'alice',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['bob'] },
            'facing-states:facing_away': { facing_away_from: ['bob'] },
          },
        },
        // Bob doesn't exist
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'alice',
        actionId: 'facing:turn_around_to_face',
        targetId: 'bob',
        originalInput: 'turn_around_to_face bob',
      });

      // Verify facing_away component was still removed
      const alice = testEnv.entityManager.getEntityInstance('alice');
      expect(alice.components['facing-states:facing_away']).toBeUndefined();
    });

    it('should handle actor without facing_away component', async () => {
      testEnv.reset([
        {
          id: 'alice',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['bob'] },
            // No facing_away component
          },
        },
        {
          id: 'bob',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['alice'] },
          },
        },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'alice',
        actionId: 'facing:turn_around_to_face',
        targetId: 'bob',
        originalInput: 'turn_around_to_face bob',
      });

      // The rule should execute without error
      const alice = testEnv.entityManager.getEntityInstance('alice');
      expect(alice.components['facing-states:facing_away']).toBeUndefined();
    });

    it('should handle empty facing_away_from array', async () => {
      testEnv.reset([
        {
          id: 'alice',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['bob'] },
            'facing-states:facing_away': { facing_away_from: [] },
          },
        },
        {
          id: 'bob',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['alice'] },
          },
        },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: 'alice',
        actionId: 'facing:turn_around_to_face',
        targetId: 'bob',
        originalInput: 'turn_around_to_face bob',
      });

      // Component should still be removed
      const alice = testEnv.entityManager.getEntityInstance('alice');
      expect(alice.components['facing-states:facing_away']).toBeUndefined();
    });
  });

  describe('Condition Matching', () => {
    it('should not execute for different action', async () => {
      testEnv.reset([
        {
          id: 'alice',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['bob'] },
            'facing-states:facing_away': { facing_away_from: ['bob'] },
          },
        },
        {
          id: 'bob',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
            'personal-space-states:closeness': { partners: ['alice'] },
          },
        },
      ]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actorId: 'alice',
        actionId: 'physical-control:turn_around', // Different action
        targetId: 'bob',
      });

      // Verify the rule didn't execute - facing_away should still exist
      const alice = testEnv.entityManager.getEntityInstance('alice');
      expect(alice.components['facing-states:facing_away']).toBeDefined();

      // Verify no actor_faced_everyone event was dispatched
      const types = testEnv.events.map((e) => e.eventType);
      expect(types).not.toContain('positioning:actor_faced_everyone');
    });
  });
});
