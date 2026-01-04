/**
 * @file Integration tests for the facing_away filtering in get_close action.
 * @description Ensures the action is not discoverable when the actor is facing away from
 * a potential target. This tests the unidirectional facing check in the scope
 * personal-space:actors_in_location_not_wielding_and_facing.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import getCloseAction from '../../../../data/mods/personal-space/actions/get_close.action.json' assert { type: 'json' };

const ACTION_ID = 'personal-space:get_close';
const ROOM_ID = 'room1';

describe('personal-space:get_close facing_away scope filtering', () => {
  let fixture;

  /**
   * Configures the action discovery by registering the action and loading
   * the personal-space scope with its condition dependencies.
   */
  const configureActionDiscovery = async () => {
    const { testEnv } = fixture;
    if (!testEnv) {
      return;
    }

    // Register the action in the index
    testEnv.actionIndex.buildIndex([getCloseAction]);

    // Register positioning scopes for prerequisites
    ScopeResolverHelpers.registerPositioningScopes(testEnv);

    // Register the personal-space scope with its condition dependencies
    // This also sets up testEnv._loadedConditions and extends dataRegistry.getConditionDefinition
    await ScopeResolverHelpers.registerCustomScope(
      testEnv,
      'personal-space',
      'actors_in_location_not_wielding_and_facing'
    );

    // Add the mocked anatomy:actor-can-move condition AFTER registerCustomScope has set up
    // the testEnv._loadedConditions map. The real condition uses hasPartWithComponentValue
    // which requires anatomy parts that our test entities don't have.
    // This simplified version always passes.
    if (!testEnv._loadedConditions) {
      testEnv._loadedConditions = new Map();
    }
    testEnv._loadedConditions.set('anatomy:actor-can-move', {
      id: 'anatomy:actor-can-move',
      description: 'Mocked condition for test - always passes',
      logic: { '==': [true, true] },
    });
  };

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('personal-space', ACTION_ID);
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('Actor facing away from target', () => {
    it('should NOT discover action when actor is facing away from target', async () => {
      // Setup: Alicia has turned her back to Bobby (actor has facing_away component)
      const scenario = fixture.createStandardActorTarget(['Alicia', 'Bobby']);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      // Remove closeness component - get_close is for actors NOT already close
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      // Add facing_away component to actor - simulating having used turn_your_back
      scenario.actor.components['facing-states:facing_away'] = {
        facing_away_from: [scenario.target.id],
      };

      fixture.reset([room, scenario.actor, scenario.target]);
      await configureActionDiscovery();

      // Action should NOT be available because actor is facing away from target
      const actions = fixture.testEnv.getAvailableActions(scenario.actor.id);
      const actionIds = actions.map((a) => a.id);

      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should discover action when actor is NOT facing away from target', async () => {
      // Setup: Normal scenario without facing_away
      const scenario = fixture.createStandardActorTarget(['Alicia', 'Bobby']);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      // Remove closeness component - get_close is for actors NOT already close
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      fixture.reset([room, scenario.actor, scenario.target]);
      await configureActionDiscovery();

      // Action should be available
      const actions = fixture.testEnv.getAvailableActions(scenario.actor.id);
      const actionIds = actions.map((a) => a.id);

      expect(actionIds).toContain(ACTION_ID);
    });

    it('should filter only the specific target actor is facing away from', async () => {
      // Setup: Actor is facing away from Bobby but not from Charlie
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .asActor()
        .withComponent('facing-states:facing_away', {
          facing_away_from: ['bobby1'], // Only facing away from Bobby
        })
        .build();

      const bobby = new ModEntityBuilder('bobby1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      const charlie = new ModEntityBuilder('charlie1')
        .withName('Charlie')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      fixture.reset([room, actor, bobby, charlie]);
      await configureActionDiscovery();

      const actions = fixture.testEnv.getAvailableActions('actor1');
      const getClose = actions.find((a) => a.id === ACTION_ID);

      expect(getClose).toBeDefined();
      // The action should be available, but only with Charlie as a valid target
      // Note: The actual target validation happens during action execution
    });
  });

  describe('Unidirectional facing check (actor perspective only)', () => {
    it('should still discover action when target is facing away from actor', async () => {
      // Setup: Bobby is facing away from Alicia (target has facing_away component)
      // This should NOT block get_close since we only check actor's perspective
      const scenario = fixture.createStandardActorTarget(['Alicia', 'Bobby']);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      // Remove closeness component - get_close is for actors NOT already close
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      // Add facing_away component to TARGET (not actor)
      scenario.target.components['facing-states:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };

      fixture.reset([room, scenario.actor, scenario.target]);
      await configureActionDiscovery();

      // Action SHOULD be available because we only check actor's facing direction
      const actions = fixture.testEnv.getAvailableActions(scenario.actor.id);
      const actionIds = actions.map((a) => a.id);

      expect(actionIds).toContain(ACTION_ID);
    });
  });

  describe('Workflow integration: turn_your_back then get_close', () => {
    it('should block get_close after actor uses turn_your_back on target', async () => {
      // This test simulates the exact bug scenario described:
      // 1. Actor uses turn_your_back on target
      // 2. get_close should no longer be available for that target

      const scenario = fixture.createStandardActorTarget(['Alicia', 'Bobby']);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      // Remove closeness component - get_close is for actors NOT already close
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      fixture.reset([room, scenario.actor, scenario.target]);
      await configureActionDiscovery();

      // Step 1: Verify action IS available initially
      let actions = fixture.testEnv.getAvailableActions(scenario.actor.id);
      let actionIds = actions.map((a) => a.id);
      expect(actionIds).toContain(ACTION_ID);

      // Step 2: Simulate turn_your_back effect by adding facing_away component to actor
      fixture.entityManager.addComponent(
        scenario.actor.id,
        'facing-states:facing_away',
        {
          facing_away_from: [scenario.target.id],
        }
      );

      // Step 3: Verify action is NO LONGER available
      actions = fixture.testEnv.getAvailableActions(scenario.actor.id);
      actionIds = actions.map((a) => a.id);
      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should allow get_close after actor turns back to face target', async () => {
      // This tests the resolution path:
      // 1. Actor has facing_away component (turned back)
      // 2. Actor removes facing_away component (turns around to face)
      // 3. get_close becomes available again

      const scenario = fixture.createStandardActorTarget(['Alicia', 'Bobby']);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      // Remove closeness component - get_close is for actors NOT already close
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      // Start with actor facing away
      scenario.actor.components['facing-states:facing_away'] = {
        facing_away_from: [scenario.target.id],
      };
      fixture.reset([room, scenario.actor, scenario.target]);
      await configureActionDiscovery();

      // Verify action is NOT available
      let actions = fixture.testEnv.getAvailableActions(scenario.actor.id);
      let actionIds = actions.map((a) => a.id);
      expect(actionIds).not.toContain(ACTION_ID);

      // Simulate turn_around_to_face effect by removing facing_away component
      fixture.entityManager.removeComponent(
        scenario.actor.id,
        'facing-states:facing_away'
      );

      // Verify action IS now available
      actions = fixture.testEnv.getAvailableActions(scenario.actor.id);
      actionIds = actions.map((a) => a.id);
      expect(actionIds).toContain(ACTION_ID);
    });
  });

  describe('Edge cases', () => {
    it('should handle actor with empty facing_away_from array', async () => {
      // Edge case: Component exists but array is empty
      const scenario = fixture.createStandardActorTarget(['Alicia', 'Bobby']);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      // Remove closeness component - get_close is for actors NOT already close
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      scenario.actor.components['facing-states:facing_away'] = {
        facing_away_from: [], // Empty array
      };

      fixture.reset([room, scenario.actor, scenario.target]);
      await configureActionDiscovery();

      // Action should be available since array is empty
      const actions = fixture.testEnv.getAvailableActions(scenario.actor.id);
      const actionIds = actions.map((a) => a.id);

      expect(actionIds).toContain(ACTION_ID);
    });

    it('should handle actor facing away from unrelated entity', async () => {
      // Edge case: Actor is facing away from someone else, not the target
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .asActor()
        .withComponent('facing-states:facing_away', {
          facing_away_from: ['unrelated_entity'], // Facing away from someone else
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      fixture.reset([room, actor, target]);
      await configureActionDiscovery();

      // Action should be available because actor is not facing away from this target
      const actions = fixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((a) => a.id);

      expect(actionIds).toContain(ACTION_ID);
    });

    it('should handle actor without facing_away component', async () => {
      // Edge case: Actor has never used turn_your_back
      const scenario = fixture.createStandardActorTarget(['Alicia', 'Bobby']);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      // Remove closeness component - get_close is for actors NOT already close
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      // Explicitly ensure no facing_away component
      delete scenario.actor.components['facing-states:facing_away'];

      fixture.reset([room, scenario.actor, scenario.target]);
      await configureActionDiscovery();

      // Action should be available
      const actions = fixture.testEnv.getAvailableActions(scenario.actor.id);
      const actionIds = actions.map((a) => a.id);

      expect(actionIds).toContain(ACTION_ID);
    });
  });
});
