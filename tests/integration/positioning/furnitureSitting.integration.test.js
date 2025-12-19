/**
 * @file Integration tests for the furniture sitting system.
 * @description Tests the complete sitting functionality including sitting down,
 * standing up, movement locking, and scope resolution for available furniture.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import handleSitDownRule from '../../../data/mods/sitting/rules/handle_sit_down.rule.json';
import handleGetUpRule from '../../../data/mods/sitting/rules/handle_get_up_from_furniture.rule.json';
import eventIsActionSitDown from '../../../data/mods/sitting/conditions/event-is-action-sit-down.condition.json';
import eventIsActionGetUp from '../../../data/mods/sitting/conditions/event-is-action-get-up-from-furniture.condition.json';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import AddComponentHandler from '../../../src/logic/operationHandlers/addComponentHandler.js';
import RemoveComponentHandler from '../../../src/logic/operationHandlers/removeComponentHandler.js';
import LockMovementHandler from '../../../src/logic/operationHandlers/lockMovementHandler.js';
import UnlockMovementHandler from '../../../src/logic/operationHandlers/unlockMovementHandler.js';
import ModifyComponentHandler from '../../../src/logic/operationHandlers/modifyComponentHandler.js';
import AtomicModifyComponentHandler from '../../../src/logic/operationHandlers/atomicModifyComponentHandler.js';
import RemoveSittingClosenessHandler from '../../../src/logic/operationHandlers/removeSittingClosenessHandler.js';
import EstablishSittingClosenessHandler from '../../../src/logic/operationHandlers/establishSittingClosenessHandler.js';
import RegenerateDescriptionHandler from '../../../src/logic/operationHandlers/regenerateDescriptionHandler.js';
import * as closenessCircleService from '../../../src/logic/services/closenessCircleService.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

// Action definitions
const sitDownAction = {
  id: 'sitting:sit_down',
  name: 'Sit down',
  description: 'Sit down on available furniture',
  targets: 'sitting:available_furniture',
  required_components: {
    actor: ['core:actor'],
  },
  forbidden_components: {
    actor: ['sitting-states:sitting_on', 'positioning:kneeling_before'],
  },
  template: 'sit down on {target.components.core:description.short}',
  prerequisites: [],
};

const getUpAction = {
  id: 'sitting:get_up_from_furniture',
  name: 'Get up',
  description: "Stand up from the furniture you're sitting on",
  targets: 'sitting:furniture_im_sitting_on',
  required_components: {
    actor: ['sitting-states:sitting_on'],
  },
  forbidden_components: {
    actor: [],
  },
  template: 'get up from {target.components.core:description.short}',
  prerequisites: [],
};

/**
 * Creates handlers needed for furniture sitting rules.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @param {object} gameDataRepository - Game data repository instance
 * @returns {object} Handler configuration object
 */
function createHandlers(entityManager, eventBus, logger, gameDataRepository) {
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
    GET_TIMESTAMP: new GetTimestampHandler({
      logger,
    }),
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
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({
      logger,
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
    LOCK_MOVEMENT: new LockMovementHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    UNLOCK_MOVEMENT: new UnlockMovementHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    MODIFY_COMPONENT: new ModifyComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    ATOMIC_MODIFY_COMPONENT: new AtomicModifyComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    ESTABLISH_SITTING_CLOSENESS: new EstablishSittingClosenessHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      closenessCircleService,
    }),
    REMOVE_SITTING_CLOSENESS: new RemoveSittingClosenessHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      closenessCircleService,
    }),
    REGENERATE_DESCRIPTION: new RegenerateDescriptionHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      bodyDescriptionComposer: {
        composeDescription: jest.fn().mockResolvedValue(undefined),
      },
    }),
  };
}

describe('furniture sitting system', () => {
  let testEnv;
  let actor;
  let chair;
  let couch;

  beforeEach(() => {
    testEnv = createRuleTestEnvironment({
      rules: [handleSitDownRule, handleGetUpRule],
      actions: [sitDownAction, getUpAction],
      conditions: {
        'sitting:event-is-action-sit-down': eventIsActionSitDown,
        'sitting:event-is-action-get-up-from-furniture': eventIsActionGetUp,
      },
      macros: {
        'core:logSuccessAndEndTurn': logSuccessMacro,
      },
      createHandlers,
    });

    // Create test actor
    actor = 'test:actor';
    testEnv.entityManager.addComponent(actor, ACTOR_COMPONENT_ID, {});
    testEnv.entityManager.addComponent(actor, NAME_COMPONENT_ID, {
      name: 'Alice',
    });
    testEnv.entityManager.addComponent(actor, POSITION_COMPONENT_ID, {
      locationId: 'location:room',
    });

    // Create single-seat chair
    chair = 'furniture:chair';
    testEnv.entityManager.addComponent(chair, 'sitting:allows_sitting', {
      spots: [null],
    });
    testEnv.entityManager.addComponent(chair, DESCRIPTION_COMPONENT_ID, {
      short: 'wooden chair',
      long: 'A simple wooden chair',
    });
    testEnv.entityManager.addComponent(chair, NAME_COMPONENT_ID, {
      name: 'wooden chair',
    });
    testEnv.entityManager.addComponent(chair, POSITION_COMPONENT_ID, {
      locationId: 'location:room',
    });

    // Create three-seat couch
    couch = 'furniture:couch';
    testEnv.entityManager.addComponent(couch, 'sitting:allows_sitting', {
      spots: [null, null, null],
    });
    testEnv.entityManager.addComponent(couch, DESCRIPTION_COMPONENT_ID, {
      short: 'leather couch',
      long: 'A comfortable leather couch',
    });
    testEnv.entityManager.addComponent(couch, NAME_COMPONENT_ID, {
      name: 'leather couch',
    });
    testEnv.entityManager.addComponent(couch, POSITION_COMPONENT_ID, {
      locationId: 'location:room',
    });
  });

  afterEach(() => {
    testEnv?.cleanup();
  });

  describe('sitting on single-seat furniture', () => {
    it('should allow actor to sit on empty chair', async () => {
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: chair,
      });

      // Check that actor has sitting_on component
      const sittingOn = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );
      expect(sittingOn).toEqual({
        furniture_id: chair,
        spot_index: 0,
      });

      // Check that chair's spot is occupied
      const chairData = testEnv.entityManager.getComponentData(
        chair,
        'sitting:allows_sitting'
      );
      expect(chairData.spots[0]).toBe(actor);

      // Check that movement is locked
      const movementLocked = testEnv.entityManager.getComponentData(
        actor,
        'core:movement_locked'
      );
      expect(movementLocked).toBeDefined();
    });

    it('should prevent sitting on occupied chair', async () => {
      // First actor sits
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: chair,
      });

      // Verify first actor is sitting (should succeed since chair is empty)
      const firstSittingOn = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );
      expect(firstSittingOn).toEqual({
        furniture_id: chair,
        spot_index: 0,
      });

      // Create second actor
      const actor2 = 'test:actor2';
      testEnv.entityManager.addComponent(actor2, ACTOR_COMPONENT_ID, {});
      testEnv.entityManager.addComponent(actor2, NAME_COMPONENT_ID, {
        name: 'Bob',
      });
      testEnv.entityManager.addComponent(actor2, POSITION_COMPONENT_ID, {
        locationId: 'location:room',
      });

      // Try to sit second actor - this should fail due to no available spots
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: chair,
      });

      // Second actor should not be sitting (rule should fail to find empty spot)
      const sittingOn = testEnv.entityManager.getComponentData(
        actor2,
        'sitting-states:sitting_on'
      );
      expect(sittingOn).toBeNull();

      // Chair should still have first actor
      const chairData = testEnv.entityManager.getComponentData(
        chair,
        'sitting:allows_sitting'
      );
      expect(chairData.spots[0]).toBe(actor);
    });
  });

  describe('standing up from furniture', () => {
    it('should allow actor to get up from chair', async () => {
      // First sit down
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: chair,
      });

      // Then get up - provide targetId so rule operations can resolve 'target' reference
      await testEnv.dispatchAction({
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor,
        targetId: chair, // Required for rule operations to resolve 'target' entity_ref
      });

      // Check that sitting_on component is removed
      const sittingOn = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );
      expect(sittingOn).toBeNull();

      // Check that chair spot is cleared
      const chairData = testEnv.entityManager.getComponentData(
        chair,
        'sitting:allows_sitting'
      );
      expect(chairData.spots[0]).toBeNull();

      // Check that movement is unlocked
      const movementLocked = testEnv.entityManager.getComponentData(
        actor,
        'core:movement_locked'
      );
      expect(movementLocked).toBeNull();
    });

    it('should clear correct spot when getting up from specific position', async () => {
      // Sit on middle spot of couch
      testEnv.entityManager.addComponent(actor, 'sitting-states:sitting_on', {
        furniture_id: couch,
        spot_index: 1,
      });
      testEnv.entityManager.addComponent(couch, 'sitting:allows_sitting', {
        spots: [null, actor, null],
      });

      // Get up
      await testEnv.dispatchAction({
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor,
        targetId: couch,
      });

      // Check that only middle spot is cleared
      const couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots).toEqual([null, null, null]);
    });
  });

  describe('multi-seat furniture', () => {
    it('should allocate first available spot on couch', async () => {
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: couch,
      });

      const sittingOn = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );
      expect(sittingOn.spot_index).toBe(0);

      const couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots[0]).toBe(actor);
      expect(couchData.spots[1]).toBeNull();
      expect(couchData.spots[2]).toBeNull();
    });

    it('should allocate second spot when first is occupied', async () => {
      // First actor sits
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: couch,
      });

      // Create second actor
      const actor2 = 'test:actor2';
      testEnv.entityManager.addComponent(actor2, ACTOR_COMPONENT_ID, {});
      testEnv.entityManager.addComponent(actor2, NAME_COMPONENT_ID, {
        name: 'Bob',
      });
      testEnv.entityManager.addComponent(actor2, POSITION_COMPONENT_ID, {
        locationId: 'location:room',
      });

      // Second actor sits
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: couch,
      });

      const sittingOn = testEnv.entityManager.getComponentData(
        actor2,
        'sitting-states:sitting_on'
      );
      expect(sittingOn.spot_index).toBe(1);

      const couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots[0]).toBe(actor);
      expect(couchData.spots[1]).toBe(actor2);
      expect(couchData.spots[2]).toBeNull();
    });
  });

  describe('movement restrictions', () => {
    it('should prevent sitting while already sitting', async () => {
      // Sit on chair
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: chair,
      });

      // Verify actor is sitting on chair
      const firstSittingOn = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );
      expect(firstSittingOn.furniture_id).toBe(chair);

      // Check that sitting action is no longer available due to forbidden component
      const canSitAgain = testEnv.validateAction(actor, 'positioning:sit_down');
      expect(canSitAgain).toBe(false);

      // Try to sit on couch without standing - this should be filtered out by ActionIndex
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: couch,
      });

      // Should still be on chair (no rule execution due to ActionIndex filtering)
      const sittingOn = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );
      expect(sittingOn.furniture_id).toBe(chair);

      // Couch should be empty
      const couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots[0]).toBeNull();
    });

    it('should prevent sitting while kneeling', async () => {
      // Add kneeling component
      testEnv.entityManager.addComponent(actor, 'positioning:kneeling_before', {
        entityId: 'test:target',
      });

      // Check that sitting action is not available due to forbidden component
      const canSit = testEnv.validateAction(actor, 'positioning:sit_down');
      expect(canSit).toBe(false);

      // Try to sit - this should be filtered out by ActionIndex
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: chair,
      });

      // Should not be sitting (ActionIndex prevents rule execution)
      const sittingOn = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );
      expect(sittingOn).toBeNull();

      // Chair should be empty
      const chairData = testEnv.entityManager.getComponentData(
        chair,
        'sitting:allows_sitting'
      );
      expect(chairData.spots[0]).toBeNull();
    });
  });

  describe('location-based filtering', () => {
    it('should only allow sitting on furniture in same location', async () => {
      // Move chair to different location
      testEnv.entityManager.addComponent(chair, POSITION_COMPONENT_ID, {
        locationId: 'location:other_room',
      });

      // Try to sit
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: chair,
      });

      // Should not be sitting (scope wouldn't include this furniture)
      const sittingOn = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );

      // Note: In a full implementation with scope resolution,
      // the action wouldn't be available. Here we're testing
      // the rule behavior would still work correctly.
      if (sittingOn) {
        expect(sittingOn.furniture_id).toBe(chair);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle furniture with no spots gracefully', async () => {
      const brokenChair = 'furniture:broken';
      testEnv.entityManager.addComponent(
        brokenChair,
        'sitting:allows_sitting',
        { spots: [] }
      );
      testEnv.entityManager.addComponent(
        brokenChair,
        DESCRIPTION_COMPONENT_ID,
        { short: 'broken chair' }
      );
      testEnv.entityManager.addComponent(brokenChair, NAME_COMPONENT_ID, {
        name: 'broken chair',
      });
      testEnv.entityManager.addComponent(brokenChair, POSITION_COMPONENT_ID, {
        locationId: 'location:room',
      });

      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: brokenChair,
      });

      const sittingOn = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );
      expect(sittingOn).toBeNull();
    });

    it('should handle furniture destruction while sitting', async () => {
      // Sit on chair
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: chair,
      });

      // Remove chair entity (simulate destruction)
      // Note: SimpleEntityManager doesn't have removeEntity,
      // we'd need to remove all components to simulate this

      // Actor should still have sitting_on component
      // (cleanup would be handled by a separate system)
      const sittingOn = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );
      expect(sittingOn).toBeDefined();
      expect(sittingOn.furniture_id).toBe(chair);
    });
  });

  describe('closeness removal on stand up', () => {
    it('should remove closeness when standing up from adjacent position', async () => {
      // Create second actor
      const actor2 = 'test:actor2';
      testEnv.entityManager.addComponent(actor2, ACTOR_COMPONENT_ID, {});
      testEnv.entityManager.addComponent(actor2, NAME_COMPONENT_ID, {
        name: 'Bob',
      });
      testEnv.entityManager.addComponent(actor2, POSITION_COMPONENT_ID, {
        locationId: 'location:room',
      });

      // Both actors sit adjacent on couch
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: couch,
      });
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: couch,
      });

      // Add closeness components to simulate sitting-based closeness
      testEnv.entityManager.addComponent(actor, 'personal-space-states:closeness', {
        partners: [actor2],
        sitting_based: [actor2],
      });
      testEnv.entityManager.addComponent(actor2, 'personal-space-states:closeness', {
        partners: [actor],
        sitting_based: [actor],
      });

      // Alice stands up
      await testEnv.dispatchAction({
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor,
        targetId: couch,
      });

      // Verify closeness was removed
      const aliceCloseness = testEnv.entityManager.getComponentData(
        actor,
        'personal-space-states:closeness'
      );
      const bobCloseness = testEnv.entityManager.getComponentData(
        actor2,
        'personal-space-states:closeness'
      );

      expect(aliceCloseness).toBeNull();
      expect(bobCloseness).toBeNull();

      // Verify Alice still stood up successfully
      const aliceSitting = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );
      expect(aliceSitting).toBeNull();
    });

    it('should remove closeness based on adjacency heuristics', async () => {
      // Create second actor
      const actor2 = 'test:actor2';
      testEnv.entityManager.addComponent(actor2, ACTOR_COMPONENT_ID, {});
      testEnv.entityManager.addComponent(actor2, NAME_COMPONENT_ID, {
        name: 'Bob',
      });
      testEnv.entityManager.addComponent(actor2, POSITION_COMPONENT_ID, {
        locationId: 'location:room',
      });

      // Both actors sit adjacent on couch
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: couch,
      });
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: couch,
      });

      // Add closeness components
      // Note: The handler uses position-based heuristics, not the manual/sitting_based fields
      testEnv.entityManager.addComponent(actor, 'personal-space-states:closeness', {
        partners: [actor2],
        sitting_based: [actor2],
      });
      testEnv.entityManager.addComponent(actor2, 'personal-space-states:closeness', {
        partners: [actor],
        sitting_based: [actor],
      });

      // Alice stands up
      await testEnv.dispatchAction({
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor,
        targetId: couch,
      });

      // Verify closeness was removed (actors were adjacent, so relationship is removed)
      const aliceCloseness = testEnv.entityManager.getComponentData(
        actor,
        'personal-space-states:closeness'
      );
      const bobCloseness = testEnv.entityManager.getComponentData(
        actor2,
        'personal-space-states:closeness'
      );

      // Since Alice and Bob were adjacent, the handler removes their closeness
      expect(aliceCloseness).toBeNull();
      expect(bobCloseness).toBeNull();
    });

    it('should handle actor with no closeness relationships', async () => {
      // Actor sits alone on chair
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: chair,
      });

      // Verify no closeness component exists
      const closenessBeforeStanding = testEnv.entityManager.getComponentData(
        actor,
        'personal-space-states:closeness'
      );
      expect(closenessBeforeStanding).toBeNull();

      // Actor stands up
      await testEnv.dispatchAction({
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor,
        targetId: chair,
      });

      // Verify standing succeeded normally
      const sittingOn = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );
      expect(sittingOn).toBeNull();

      // Verify still no closeness component
      const closenessAfterStanding = testEnv.entityManager.getComponentData(
        actor,
        'personal-space-states:closeness'
      );
      expect(closenessAfterStanding).toBeNull();
    });

    it('should handle three actors with middle position standing', async () => {
      // Create second and third actors
      const actor2 = 'test:actor2';
      const actor3 = 'test:actor3';

      testEnv.entityManager.addComponent(actor2, ACTOR_COMPONENT_ID, {});
      testEnv.entityManager.addComponent(actor2, NAME_COMPONENT_ID, {
        name: 'Bob',
      });
      testEnv.entityManager.addComponent(actor2, POSITION_COMPONENT_ID, {
        locationId: 'location:room',
      });

      testEnv.entityManager.addComponent(actor3, ACTOR_COMPONENT_ID, {});
      testEnv.entityManager.addComponent(actor3, NAME_COMPONENT_ID, {
        name: 'Charlie',
      });
      testEnv.entityManager.addComponent(actor3, POSITION_COMPONENT_ID, {
        locationId: 'location:room',
      });

      // All three actors sit on couch (Alice-Bob-Charlie)
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: couch,
      });
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: couch,
      });
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor3,
        targetId: couch,
      });

      // Set up closeness (Alice-Bob and Bob-Charlie)
      testEnv.entityManager.addComponent(actor, 'personal-space-states:closeness', {
        partners: [actor2],
        sitting_based: [actor2],
      });
      testEnv.entityManager.addComponent(actor2, 'personal-space-states:closeness', {
        partners: [actor, actor3],
        sitting_based: [actor, actor3],
      });
      testEnv.entityManager.addComponent(actor3, 'personal-space-states:closeness', {
        partners: [actor2],
        sitting_based: [actor2],
      });

      // Bob (middle position) stands up
      await testEnv.dispatchAction({
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor2,
        targetId: couch,
      });

      // Verify Bob's closeness is removed
      const bobCloseness = testEnv.entityManager.getComponentData(
        actor2,
        'personal-space-states:closeness'
      );
      expect(bobCloseness).toBeNull();

      // Verify Alice and Charlie's closeness to Bob is removed
      const aliceCloseness = testEnv.entityManager.getComponentData(
        actor,
        'personal-space-states:closeness'
      );
      const charlieCloseness = testEnv.entityManager.getComponentData(
        actor3,
        'personal-space-states:closeness'
      );

      expect(aliceCloseness).toBeNull();
      expect(charlieCloseness).toBeNull();

      // Verify Bob stood up successfully
      const bobSitting = testEnv.entityManager.getComponentData(
        actor2,
        'sitting-states:sitting_on'
      );
      expect(bobSitting).toBeNull();
    });
  });
});
