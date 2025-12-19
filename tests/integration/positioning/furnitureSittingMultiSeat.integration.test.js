/**
 * @file Integration tests for multi-seat furniture behavior.
 * @description Tests advanced scenarios with multiple actors sitting on the same
 * furniture, spot allocation order, and clearing specific spots.
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
import { expandMacros } from '../../../src/utils/macroUtils.js';
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
import EstablishSittingClosenessHandler from '../../../src/logic/operationHandlers/establishSittingClosenessHandler.js';
import RemoveSittingClosenessHandler from '../../../src/logic/operationHandlers/removeSittingClosenessHandler.js';
import IfHandler from '../../../src/logic/operationHandlers/ifHandler.js';
import * as closenessCircleService from '../../../src/logic/services/closenessCircleService.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';

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
    // Mock handler for REGENERATE_DESCRIPTION - satisfies fail-fast enforcement
    REGENERATE_DESCRIPTION: {
      execute: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('multi-seat furniture behavior', () => {
  let testEnv;
  let actor1, actor2, actor3, actor4;
  let couch;

  beforeEach(() => {
    testEnv = createRuleTestEnvironment({
      rules: [handleSitDownRule, handleGetUpRule],
      conditions: {
        'sitting:event-is-action-sit-down': eventIsActionSitDown,
        'sitting:event-is-action-get-up-from-furniture': eventIsActionGetUp,
      },
      macros: {
        'core:logSuccessAndEndTurn': logSuccessMacro,
      },
      createHandlers,
    });

    // Create test actors
    actor1 = 'test:actor1';
    testEnv.entityManager.addComponent(actor1, ACTOR_COMPONENT_ID, {});
    testEnv.entityManager.addComponent(actor1, NAME_COMPONENT_ID, {
      name: 'Alice',
    });
    testEnv.entityManager.addComponent(actor1, POSITION_COMPONENT_ID, {
      locationId: 'location:room',
    });

    actor2 = 'test:actor2';
    testEnv.entityManager.addComponent(actor2, ACTOR_COMPONENT_ID, {});
    testEnv.entityManager.addComponent(actor2, NAME_COMPONENT_ID, {
      name: 'Bob',
    });
    testEnv.entityManager.addComponent(actor2, POSITION_COMPONENT_ID, {
      locationId: 'location:room',
    });

    actor3 = 'test:actor3';
    testEnv.entityManager.addComponent(actor3, ACTOR_COMPONENT_ID, {});
    testEnv.entityManager.addComponent(actor3, NAME_COMPONENT_ID, {
      name: 'Charlie',
    });
    testEnv.entityManager.addComponent(actor3, POSITION_COMPONENT_ID, {
      locationId: 'location:room',
    });

    actor4 = 'test:actor4';
    testEnv.entityManager.addComponent(actor4, ACTOR_COMPONENT_ID, {});
    testEnv.entityManager.addComponent(actor4, NAME_COMPONENT_ID, {
      name: 'Diana',
    });
    testEnv.entityManager.addComponent(actor4, POSITION_COMPONENT_ID, {
      locationId: 'location:room',
    });

    // Create three-seat couch
    couch = 'furniture:couch';
    testEnv.entityManager.addComponent(couch, 'sitting:allows_sitting', {
      spots: [null, null, null],
    });
    testEnv.entityManager.addComponent(couch, DESCRIPTION_COMPONENT_ID, {
      short: 'leather couch',
      long: 'A comfortable three-person leather couch',
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

  describe('sequential spot allocation', () => {
    it('should fill spots in order: first, second, third', async () => {
      // First actor sits
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor1,
        targetId: couch,
      });

      // Second actor sits
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: couch,
      });

      // Third actor sits
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor3,
        targetId: couch,
      });

      // Verify spots are allocated in order
      const couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots).toEqual([actor1, actor2, actor3]);

      // Verify each actor knows their position
      const sitting1 = testEnv.entityManager.getComponentData(
        actor1,
        'positioning:sitting_on'
      );
      expect(sitting1.spot_index).toBe(0);

      const sitting2 = testEnv.entityManager.getComponentData(
        actor2,
        'positioning:sitting_on'
      );
      expect(sitting2.spot_index).toBe(1);

      const sitting3 = testEnv.entityManager.getComponentData(
        actor3,
        'positioning:sitting_on'
      );
      expect(sitting3.spot_index).toBe(2);
    });

    it('should prevent fourth actor from sitting on full couch', async () => {
      // Fill all three spots
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor1,
        targetId: couch,
      });

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: couch,
      });

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor3,
        targetId: couch,
      });

      // Fourth actor tries to sit
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor4,
        targetId: couch,
      });

      // Fourth actor should not be sitting
      const sitting4 = testEnv.entityManager.getComponentData(
        actor4,
        'positioning:sitting_on'
      );
      expect(sitting4).toBeNull();

      // Couch should still have only three actors
      const couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots).toEqual([actor1, actor2, actor3]);
    });
  });

  describe('gap filling behavior', () => {
    it('should fill first available spot when middle actor stands', async () => {
      // Setup: Three actors sitting
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor1,
        targetId: couch,
      });

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: couch,
      });

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor3,
        targetId: couch,
      });

      // Middle actor stands
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor2,
        targetId: couch,
      });

      // Fourth actor sits (should take middle spot)
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor4,
        targetId: couch,
      });

      // Verify fourth actor took middle spot
      const sitting4 = testEnv.entityManager.getComponentData(
        actor4,
        'positioning:sitting_on'
      );
      expect(sitting4.spot_index).toBe(1);

      const couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots).toEqual([actor1, actor4, actor3]);
    });

    it('should fill first gap when first actor stands', async () => {
      // Setup: Two actors in spots 0 and 2
      testEnv.entityManager.addComponent(couch, 'sitting:allows_sitting', {
        spots: [actor1, null, actor3],
      });
      testEnv.entityManager.addComponent(actor1, 'positioning:sitting_on', {
        furniture_id: couch,
        spot_index: 0,
      });
      testEnv.entityManager.addComponent(actor3, 'positioning:sitting_on', {
        furniture_id: couch,
        spot_index: 2,
      });

      // First actor stands
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor1,
        targetId: couch,
      });

      // New actor sits (should take first spot)
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: couch,
      });

      // Verify actor2 took first spot
      const sitting2 = testEnv.entityManager.getComponentData(
        actor2,
        'positioning:sitting_on'
      );
      expect(sitting2.spot_index).toBe(0);

      const couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots).toEqual([actor2, null, actor3]);
    });
  });

  describe('independent spot management', () => {
    it('should maintain other spots when one actor stands', async () => {
      // Three actors sit
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor1,
        targetId: couch,
      });

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: couch,
      });

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor3,
        targetId: couch,
      });

      // First actor stands
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor1,
        targetId: couch,
      });

      // Verify only first spot is cleared
      const couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots[0]).toBeNull();
      expect(couchData.spots[1]).toBe(actor2);
      expect(couchData.spots[2]).toBe(actor3);

      // Other actors should still be sitting
      const sitting2 = testEnv.entityManager.getComponentData(
        actor2,
        'positioning:sitting_on'
      );
      expect(sitting2).toBeDefined();
      expect(sitting2.spot_index).toBe(1);

      const sitting3 = testEnv.entityManager.getComponentData(
        actor3,
        'positioning:sitting_on'
      );
      expect(sitting3).toBeDefined();
      expect(sitting3.spot_index).toBe(2);
    });

    it('should handle all actors standing in random order', async () => {
      // Three actors sit
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor1,
        targetId: couch,
      });

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: couch,
      });

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor3,
        targetId: couch,
      });

      // Stand in random order: 2, 3, 1
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor2,
        targetId: couch,
      });

      let couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots).toEqual([actor1, null, actor3]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor3,
        targetId: couch,
      });

      couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots).toEqual([actor1, null, null]);

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor1,
        targetId: couch,
      });

      couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots).toEqual([null, null, null]);
    });
  });

  describe('movement locking for multiple actors', () => {
    it('should lock movement for all sitting actors', async () => {
      // Three actors sit
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor1,
        targetId: couch,
      });

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: couch,
      });

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor3,
        targetId: couch,
      });

      // All should have movement locked
      const locked1 = testEnv.entityManager.getComponentData(
        actor1,
        'core:movement_locked'
      );
      expect(locked1).toBeDefined();

      const locked2 = testEnv.entityManager.getComponentData(
        actor2,
        'core:movement_locked'
      );
      expect(locked2).toBeDefined();

      const locked3 = testEnv.entityManager.getComponentData(
        actor3,
        'core:movement_locked'
      );
      expect(locked3).toBeDefined();
    });

    it('should only unlock movement for actor who stands', async () => {
      // Three actors sit
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor1,
        targetId: couch,
      });

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: couch,
      });

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor3,
        targetId: couch,
      });

      // Middle actor stands
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor2,
        targetId: couch,
      });

      // Only actor2 should have movement unlocked
      const locked1 = testEnv.entityManager.getComponentData(
        actor1,
        'core:movement_locked'
      );
      expect(locked1).toBeDefined();

      const locked2 = testEnv.entityManager.getComponentData(
        actor2,
        'core:movement_locked'
      );
      expect(locked2).toBeNull();

      const locked3 = testEnv.entityManager.getComponentData(
        actor3,
        'core:movement_locked'
      );
      expect(locked3).toBeDefined();
    });
  });

  describe('concurrent access patterns', () => {
    it('should handle rapid successive sitting attempts', async () => {
      // Simulate rapid sitting attempts
      const events = [
        {
          type: ATTEMPT_ACTION_ID,
          payload: {
            actionId: 'sitting:sit_down',
            actorId: actor1,
            targetId: couch,
          },
        },
        {
          type: ATTEMPT_ACTION_ID,
          payload: {
            actionId: 'sitting:sit_down',
            actorId: actor2,
            targetId: couch,
          },
        },
        {
          type: ATTEMPT_ACTION_ID,
          payload: {
            actionId: 'sitting:sit_down',
            actorId: actor3,
            targetId: couch,
          },
        },
      ];

      // Process events sequentially (simulating event queue)
      for (const event of events) {
        await testEnv.eventBus.dispatch(event.type, event.payload);
      }

      // All three should be seated correctly
      const couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots).toEqual([actor1, actor2, actor3]);
    });

    it('should maintain consistency with interleaved sit/stand actions', async () => {
      // Actor1 sits
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor1,
        targetId: couch,
      });

      // Actor2 sits
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor2,
        targetId: couch,
      });

      // Actor1 stands
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:get_up_from_furniture',
        actorId: actor1,
        targetId: couch,
      });

      // Actor3 sits (should take first spot)
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor3,
        targetId: couch,
      });

      // Actor4 sits (should take third spot)
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actionId: 'sitting:sit_down',
        actorId: actor4,
        targetId: couch,
      });

      // Verify final state
      const couchData = testEnv.entityManager.getComponentData(
        couch,
        'sitting:allows_sitting'
      );
      expect(couchData.spots).toEqual([actor3, actor2, actor4]);
    });
  });
});
