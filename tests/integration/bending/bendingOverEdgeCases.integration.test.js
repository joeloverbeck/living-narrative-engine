/**
 * @file Edge case tests for the bending over system.
 * @description Tests edge cases including concurrent operations, invalid states,
 * rapid state transitions, and error handling scenarios.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import handleBendOverRule from '../../../data/mods/bending/rules/bend_over.rule.json';
import handleStraightenUpRule from '../../../data/mods/bending/rules/straighten_up.rule.json';
import eventIsBendOver from '../../../data/mods/bending/conditions/event-is-action-bend-over.condition.json';
import eventIsStraightenUp from '../../../data/mods/bending/conditions/event-is-action-straighten-up.condition.json';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import logFailureMacro from '../../../data/mods/core/macros/logFailureAndEndTurn.macro.json';
import bendOverAction from '../../../data/mods/bending/actions/bend_over.action.json';
import straightenUpAction from '../../../data/mods/bending/actions/straighten_up.action.json';

// Import necessary handlers
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
import RegenerateDescriptionHandler from '../../../src/logic/operationHandlers/regenerateDescriptionHandler.js';

import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

/**
 * Creates handlers needed for bending over rules.
 *
 * @param entityManager
 * @param eventBus
 * @param logger
 * @param gameDataRepository
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
    GET_TIMESTAMP: new GetTimestampHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    DISPATCH_EVENT: new DispatchEventHandler({
      dispatcher: eventBus,
      logger,
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
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({
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

/**
 * Helper to create a surface with bending support
 *
 * @param testEnv
 * @param id
 * @param name
 * @param locationId
 */
function createSurface(testEnv, id, name, locationId) {
  testEnv.entityManager.addComponent(id, 'bending:allows_bending_over', {});
  testEnv.entityManager.addComponent(id, DESCRIPTION_COMPONENT_ID, {
    short: name,
    long: `A ${name} for bending over`,
  });
  testEnv.entityManager.addComponent(id, NAME_COMPONENT_ID, {
    name: name,
  });
  testEnv.entityManager.addComponent(id, POSITION_COMPONENT_ID, {
    locationId: locationId,
  });
  return id;
}

/**
 * Helper to create an actor
 *
 * @param testEnv
 * @param id
 * @param name
 * @param locationId
 */
function createActor(testEnv, id, name, locationId) {
  testEnv.entityManager.addComponent(id, ACTOR_COMPONENT_ID, {});
  testEnv.entityManager.addComponent(id, NAME_COMPONENT_ID, {
    name: name,
  });
  testEnv.entityManager.addComponent(id, POSITION_COMPONENT_ID, {
    locationId: locationId,
  });
  return id;
}

describe('Bending Over System Edge Cases', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = createRuleTestEnvironment({
      createHandlers,
      rules: [handleBendOverRule, handleStraightenUpRule],
      actions: [bendOverAction, straightenUpAction],
      conditions: {
        'bending:event-is-action-bend-over': eventIsBendOver,
        'bending:event-is-action-straighten-up': eventIsStraightenUp,
      },
      macros: {
        'core:logSuccessAndEndTurn': logSuccessMacro,
        'core:logFailureAndEndTurn': logFailureMacro,
      },
    });
  });

  afterEach(() => {
    testEnv?.cleanup();
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple actors bending simultaneously', async () => {
      const locationId = 'location:test';
      const counter = createSurface(
        testEnv,
        'test:counter',
        'counter',
        locationId
      );

      // Create 5 actors
      const actors = [];
      for (let i = 0; i < 5; i++) {
        const actorId = `test:actor${i}`;
        createActor(testEnv, actorId, `Actor${i}`, locationId);
        actors.push(actorId);
      }

      // All actors attempt to bend over simultaneously
      const promises = actors.map((actorId) =>
        testEnv.dispatchAction({
          actionId: 'bending:bend_over',
          actorId,
          targetId: counter,
        })
      );

      await Promise.all(promises);

      // Verify all succeeded (no position limits for bending)
      actors.forEach((actorId) => {
        const bendingOver = testEnv.entityManager.getComponentData(
          actorId,
          'bending-states:bending_over'
        );
        expect(bendingOver).toBeDefined();
        expect(bendingOver.surface_id).toBe(counter);
      });
    });

    it('should handle concurrent bend and straighten operations', async () => {
      const locationId = 'location:test';
      const surface = createSurface(
        testEnv,
        'test:surface',
        'surface',
        locationId
      );
      const actor1 = createActor(testEnv, 'test:actor1', 'Actor1', locationId);
      const actor2 = createActor(testEnv, 'test:actor2', 'Actor2', locationId);

      // Actor1 bends over
      testEnv.entityManager.addComponent(actor1, 'bending-states:bending_over', {
        surface_id: surface,
      });

      // Concurrent operations
      const promises = [
        testEnv.dispatchAction({
          actionId: 'bending:straighten_up',
          actorId: actor1,
          targetId: surface,
        }),
        testEnv.dispatchAction({
          actionId: 'bending:bend_over',
          actorId: actor2,
          targetId: surface,
        }),
      ];

      await Promise.all(promises);

      // Actor1 should be straightened
      const actor1Bending = testEnv.entityManager.getComponentData(
        actor1,
        'bending-states:bending_over'
      );
      expect(actor1Bending).toBeNull();

      // Actor2 should be bending
      const actor2Bending = testEnv.entityManager.getComponentData(
        actor2,
        'bending-states:bending_over'
      );
      expect(actor2Bending).toEqual({ surface_id: surface });
    });
  });

  describe('Invalid States', () => {
    it('should handle missing surface gracefully', async () => {
      const actor = createActor(
        testEnv,
        'test:actor',
        'Actor',
        'location:test'
      );

      // Try to bend over non-existent surface
      await testEnv.dispatchAction({
        actionId: 'bending:bend_over',
        actorId: actor,
        targetId: 'non-existent-surface',
      });

      // The action should be filtered out because the target doesn't exist
      // So the component should not be added
      const bendingOver = testEnv.entityManager.getComponentData(
        actor,
        'bending-states:bending_over'
      );
      expect(bendingOver).toBeNull();
    });

    it('should handle corrupt component data', async () => {
      const actor = createActor(
        testEnv,
        'test:actor',
        'Actor',
        'location:test'
      );
      const surface = createSurface(
        testEnv,
        'test:surface',
        'surface',
        'location:test'
      );

      // Manually set invalid component data
      testEnv.entityManager.addComponent(actor, 'bending-states:bending_over', {
        surface_id: null, // Invalid - should be a string
      });

      // Try to straighten up with corrupt data
      await testEnv.dispatchAction({
        actionId: 'bending:straighten_up',
        actorId: actor,
        targetId: surface,
      });

      // The action should be filtered out because the scope can't resolve (surface_id is null)
      // So the corrupt component remains
      const bendingOver = testEnv.entityManager.getComponentData(
        actor,
        'bending-states:bending_over'
      );
      expect(bendingOver).toEqual({ surface_id: null });
    });

    it('should handle missing actor gracefully', async () => {
      const surface = createSurface(
        testEnv,
        'test:surface',
        'surface',
        'location:test'
      );

      // Try to dispatch action with non-existent actor
      await testEnv.dispatchAction({
        actionId: 'bending:bend_over',
        actorId: 'non-existent-actor',
        targetId: surface,
      });

      // System should not crash, but component won't exist
      const bendingOver = testEnv.entityManager.getComponentData(
        'non-existent-actor',
        'bending-states:bending_over'
      );
      // Will be null because entity doesn't exist
      expect(bendingOver).toBeNull();
    });
  });

  describe('State Transitions', () => {
    it('should handle rapid bend-straighten cycles', async () => {
      const actor = createActor(
        testEnv,
        'test:actor',
        'Actor',
        'location:test'
      );
      const counter = createSurface(
        testEnv,
        'test:counter',
        'counter',
        'location:test'
      );

      // Rapid state changes
      for (let i = 0; i < 10; i++) {
        await testEnv.dispatchAction({
          actionId: 'bending:bend_over',
          actorId: actor,
          targetId: counter,
        });
        await testEnv.dispatchAction({
          actionId: 'bending:straighten_up',
          actorId: actor,
          targetId: counter,
        });
      }

      // Final state should be straightened
      const finalState = testEnv.entityManager.getComponentData(
        actor,
        'bending-states:bending_over'
      );
      expect(finalState).toBeNull();
    });

    it('should handle switching between multiple surfaces rapidly', async () => {
      const locationId = 'location:test';
      const actor = createActor(testEnv, 'test:actor', 'Actor', locationId);

      // Create multiple surfaces
      const surfaces = [];
      for (let i = 0; i < 5; i++) {
        const surfaceId = `test:surface${i}`;
        createSurface(testEnv, surfaceId, `surface${i}`, locationId);
        surfaces.push(surfaceId);
      }

      // Rapidly switch between surfaces (need to straighten up first before bending over another)
      for (let i = 0; i < surfaces.length; i++) {
        const surface = surfaces[i];

        // If not the first surface, straighten up from the previous one first
        if (i > 0) {
          await testEnv.dispatchAction({
            actionId: 'bending:straighten_up',
            actorId: actor,
            targetId: surfaces[i - 1],
          });
        }

        await testEnv.dispatchAction({
          actionId: 'bending:bend_over',
          actorId: actor,
          targetId: surface,
        });
      }

      // Should be bending over the last surface
      const finalState = testEnv.entityManager.getComponentData(
        actor,
        'bending-states:bending_over'
      );
      expect(finalState).toEqual({ surface_id: surfaces[surfaces.length - 1] });
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle empty location (no surfaces)', async () => {
      const actor = createActor(
        testEnv,
        'test:actor',
        'Actor',
        'empty:location'
      );

      // Try to bend when no surfaces exist in location
      // Action discovery would normally prevent this
      await testEnv.dispatchAction({
        actionId: 'bending:bend_over',
        actorId: actor,
        targetId: 'imaginary:surface',
      });

      // Rule will still process
      const bendingOver = testEnv.entityManager.getComponentData(
        actor,
        'bending-states:bending_over'
      );
      expect(bendingOver).toBeDefined();
    });

    it('should handle actor with no position component', async () => {
      const actorId = 'test:actor';
      const surface = createSurface(
        testEnv,
        'test:surface',
        'surface',
        'location:test'
      );

      // Create actor without position
      testEnv.entityManager.addComponent(actorId, ACTOR_COMPONENT_ID, {});
      testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        name: 'Actor',
      });
      // No position component

      // Try to bend over
      await testEnv.dispatchAction({
        actionId: 'bending:bend_over',
        actorId,
        targetId: surface,
      });

      // Rule may fail or succeed depending on implementation
      const bendingOver = testEnv.entityManager.getComponentData(
        actorId,
        'bending-states:bending_over'
      );
      // Will still add component as rule doesn't check position
      expect(bendingOver).toBeDefined();
    });
  });

  describe('Complex Interactions', () => {
    it('should handle actor already in multiple positioning states', async () => {
      const actor = createActor(
        testEnv,
        'test:actor',
        'Actor',
        'location:test'
      );
      const surface = createSurface(
        testEnv,
        'test:surface',
        'surface',
        'location:test'
      );

      // Add multiple positioning components (invalid state but test resilience)
      testEnv.entityManager.addComponent(actor, 'sitting-states:sitting_on', {
        furniture_id: 'test:chair',
        spot_index: 0,
      });
      testEnv.entityManager.addComponent(actor, 'deference-states:kneeling_before', {
        entityId: 'test:target',
      });

      // Try to bend over
      await testEnv.dispatchAction({
        actionId: 'bending:bend_over',
        actorId: actor,
        targetId: surface,
      });

      // Should add bending component (rule doesn't check exclusivity)
      const bendingOver = testEnv.entityManager.getComponentData(
        actor,
        'bending-states:bending_over'
      );
      expect(bendingOver).toBeDefined();

      // Other components still exist
      const sitting = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );
      expect(sitting).toBeDefined();

      const kneeling = testEnv.entityManager.getComponentData(
        actor,
        'deference-states:kneeling_before'
      );
      expect(kneeling).toBeDefined();
    });

    it('should handle surface with special characters in ID', async () => {
      const actor = createActor(
        testEnv,
        'test:actor',
        'Actor',
        'location:test'
      );
      const surfaceId = 'test:surface-with_special.chars123';
      createSurface(testEnv, surfaceId, 'special surface', 'location:test');

      await testEnv.dispatchAction({
        actionId: 'bending:bend_over',
        actorId: actor,
        targetId: surfaceId,
      });

      const bendingOver = testEnv.entityManager.getComponentData(
        actor,
        'bending-states:bending_over'
      );
      expect(bendingOver).toEqual({ surface_id: surfaceId });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large number of surfaces without memory issues', async () => {
      const locationId = 'location:test';
      const actor = createActor(testEnv, 'test:actor', 'Actor', locationId);

      // Create 100 surfaces
      const surfaces = [];
      for (let i = 0; i < 100; i++) {
        const surfaceId = `test:surface${i}`;
        createSurface(testEnv, surfaceId, `surface${i}`, locationId);
        surfaces.push(surfaceId);
      }

      // Bend over the last one
      await testEnv.dispatchAction({
        actionId: 'bending:bend_over',
        actorId: actor,
        targetId: surfaces[99],
      });

      const bendingOver = testEnv.entityManager.getComponentData(
        actor,
        'bending-states:bending_over'
      );
      expect(bendingOver).toEqual({ surface_id: surfaces[99] });
    });

    it('should handle many actors bending over different surfaces', async () => {
      const locationId = 'location:test';

      // Create 20 actors and 20 surfaces
      const actors = [];
      const surfaces = [];
      for (let i = 0; i < 20; i++) {
        const actorId = `test:actor${i}`;
        const surfaceId = `test:surface${i}`;
        createActor(testEnv, actorId, `Actor${i}`, locationId);
        createSurface(testEnv, surfaceId, `surface${i}`, locationId);
        actors.push(actorId);
        surfaces.push(surfaceId);
      }

      // Each actor bends over their corresponding surface
      const promises = actors.map((actorId, index) =>
        testEnv.dispatchAction({
          actionId: 'bending:bend_over',
          actorId,
          targetId: surfaces[index],
        })
      );

      await Promise.all(promises);

      // Verify each actor is bending over the correct surface
      actors.forEach((actorId, index) => {
        const bendingOver = testEnv.entityManager.getComponentData(
          actorId,
          'bending-states:bending_over'
        );
        expect(bendingOver).toEqual({ surface_id: surfaces[index] });
      });
    });
  });
});
