/**
 * @file Integration tests for personal-space:sit_down_at_distance action discovery.
 * @description Tests action metadata, discoverability logic, and scope resolution
 * for the sit-at-distance feature.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import sitDownAtDistanceAction from '../../../../data/mods/personal-space/actions/sit_down_at_distance.action.json' assert { type: 'json' };
import sitDownAction from '../../../../data/mods/sitting/actions/sit_down.action.json' assert { type: 'json' };

describe('personal-space:sit_down_at_distance action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    // Auto-load rule and condition files
    testFixture = await ModTestFixture.forActionAutoLoad(
      'personal-space',
      'sit_down_at_distance'
    );

    // Add custom scope resolver for personal-space:actors_sitting_with_space_to_right
    // This scope finds actors sitting on furniture with 2 consecutive empty spots to their right,
    // and returns only the rightmost such actor
    const { testEnv } = testFixture;
    const originalResolveSync = testEnv.unifiedScopeResolver.resolveSync;
    testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
      if (scopeName === 'personal-space:actors_sitting_with_space_to_right') {
        // Get the target furniture from context
        const furnitureId = context?.target?.id;
        if (!furnitureId) {
          return { success: true, value: new Set() };
        }

        const furniture =
          testFixture.entityManager.getEntityInstance(furnitureId);
        const sittingComponent =
          furniture?.components?.['sitting:allows_sitting'];
        if (!sittingComponent || !Array.isArray(sittingComponent.spots)) {
          return { success: true, value: new Set() };
        }

        const spots = sittingComponent.spots;

        // Find all actors sitting on this furniture with 2 consecutive empty spots to their right
        const candidates = [];

        for (let i = 0; i < spots.length; i++) {
          const occupantId = spots[i];
          if (!occupantId || typeof occupantId !== 'string') {
            continue; // Empty spot
          }

          // Check if this occupant has positioning:sitting_on component
          const occupant =
            testFixture.entityManager.getEntityInstance(occupantId);
          const sittingOn = occupant?.components?.['positioning:sitting_on'];
          if (
            !sittingOn ||
            sittingOn.furniture_id !== furnitureId ||
            sittingOn.spot_index !== i
          ) {
            continue; // Not sitting on this furniture at this index
          }

          // Check if there are 2 consecutive empty spots to the right (indices i+1 and i+2)
          if (i + 2 >= spots.length) {
            continue; // Not enough spots to the right
          }

          const nextSpot = spots[i + 1];
          const secondNextSpot = spots[i + 2];

          if (nextSpot === null && secondNextSpot === null) {
            // This occupant has 2 consecutive empty spots to the right
            candidates.push({ occupantId, spotIndex: i });
          }
        }

        // Return only the rightmost candidate (highest spot_index)
        if (candidates.length === 0) {
          return { success: true, value: new Set() };
        }

        // Sort by spot_index descending to get rightmost
        candidates.sort((a, b) => b.spotIndex - a.spotIndex);
        const rightmost = candidates[0];

        return { success: true, value: new Set([rightmost.occupantId]) };
      }

      // Fall back to original resolver for other scopes
      return originalResolveSync.call(
        testEnv.unifiedScopeResolver,
        scopeName,
        context
      );
    };

    // Configure action discovery (required for discovery tests)
    configureActionDiscovery = () => {
      testEnv.actionIndex.buildIndex([sitDownAtDistanceAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action metadata validation', () => {
    it('should have correct action structure', () => {
      expect(sitDownAtDistanceAction).toBeDefined();
      expect(sitDownAtDistanceAction.id).toBe(
        'personal-space:sit_down_at_distance'
      );
      expect(sitDownAtDistanceAction.name).toBe('Sit Down With Space');
      expect(sitDownAtDistanceAction.description).toBe(
        'Sit on available furniture while leaving a one-seat buffer from a selected occupant.'
      );
    });

    it('should use correct scope for primary target (furniture)', () => {
      expect(sitDownAtDistanceAction.targets.primary).toBeDefined();
      expect(sitDownAtDistanceAction.targets.primary.scope).toBe(
        'sitting:available_furniture'
      );
      expect(sitDownAtDistanceAction.targets.primary.placeholder).toBe('seat');
    });

    it('should use correct scope for secondary target (occupant with space)', () => {
      expect(sitDownAtDistanceAction.targets.secondary).toBeDefined();
      expect(sitDownAtDistanceAction.targets.secondary.scope).toBe(
        'personal-space:actors_sitting_with_space_to_right'
      );
      expect(sitDownAtDistanceAction.targets.secondary.placeholder).toBe(
        'occupant'
      );
      expect(sitDownAtDistanceAction.targets.secondary.contextFrom).toBe(
        'primary'
      );
    });

    it('should have correct forbidden components', () => {
      expect(sitDownAtDistanceAction.forbidden_components).toBeDefined();
      expect(sitDownAtDistanceAction.forbidden_components.actor).toEqual([
        'positioning:sitting_on',
        'positioning:kneeling_before',
        'positioning:bending_over',
        'positioning:restraining',
        'positioning:fallen',
      ]);
    });

    it('should have correct template string', () => {
      expect(sitDownAtDistanceAction.template).toBe(
        'sit down on {seat} at a distance from {occupant}'
      );
    });
  });

  describe('Positive discoverability scenarios', () => {
    it('should discover action when valid configuration exists (rightmost with 2 spaces)', () => {
      // Setup: Furniture with rightmost occupant and 2 empty spots to the right
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const furniture = new ModEntityBuilder('bench1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['bob1', null, null],
        })
        .build();

      const occupant = new ModEntityBuilder('bob1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, actor, furniture, occupant]);
      configureActionDiscovery();

      // Discover actions
      const actions = testFixture.discoverActions('actor1');
      const sitAtDistanceActions = actions.filter(
        (a) => a.id === 'personal-space:sit_down_at_distance'
      );

      expect(sitAtDistanceActions.length).toBeGreaterThan(0);
    });

    it('should include both primary and secondary targets in action instances', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const furniture = new ModEntityBuilder('bench1')
        .withName('Long Bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['bob1', null, null],
        })
        .build();

      const occupant = new ModEntityBuilder('bob1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, actor, furniture, occupant]);
      configureActionDiscovery();

      const actions = testFixture.discoverActions('actor1');
      const sitAtDistanceActions = actions.filter(
        (a) => a.id === 'personal-space:sit_down_at_distance'
      );

      expect(sitAtDistanceActions.length).toBeGreaterThan(0);
      // Verify the action has the correct template with both placeholders
      const action = sitAtDistanceActions[0];
      expect(action.template).toBe(
        'sit down on {seat} at a distance from {occupant}'
      );
    });

    it('should coexist with legacy sit_down action when appropriate', () => {
      // Both actions should be available when furniture has empty spots
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const furniture = new ModEntityBuilder('bench1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['bob1', null, null],
        })
        .build();

      const occupant = new ModEntityBuilder('bob1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, actor, furniture, occupant]);

      // Configure action discovery with BOTH actions to test coexistence
      const { testEnv } = testFixture;
      testEnv.actionIndex.buildIndex([sitDownAtDistanceAction, sitDownAction]);

      const actions = testFixture.discoverActions('actor1');
      const actionIds = actions.map((a) => a.id);

      // Both sit_down_at_distance and sit_down should be available
      expect(actionIds).toContain('personal-space:sit_down_at_distance');
      expect(actionIds).toContain('sitting:sit_down');
    });
  });

  describe('Negative discoverability scenarios', () => {
    it('should NOT appear when furniture has only 2 spots (insufficient for buffer)', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const furniture = new ModEntityBuilder('chair1')
        .withName('Two-seater')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['bob1', null], // Only 2 spots - not enough for buffer
        })
        .build();

      const occupant = new ModEntityBuilder('bob1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, actor, furniture, occupant]);
      configureActionDiscovery();

      const actions = testFixture.discoverActions('actor1');
      const sitAtDistanceActions = actions.filter(
        (a) => a.id === 'personal-space:sit_down_at_distance'
      );

      expect(sitAtDistanceActions.length).toBe(0);
    });

    it('should NOT appear when middle seat is occupied (no two consecutive empty spots)', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const furniture = new ModEntityBuilder('bench1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['bob1', 'charlie1', null], // Middle seat occupied
        })
        .build();

      const occupant1 = new ModEntityBuilder('bob1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 0,
        })
        .build();

      const occupant2 = new ModEntityBuilder('charlie1')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 1,
        })
        .build();

      testFixture.reset([room, actor, furniture, occupant1, occupant2]);
      configureActionDiscovery();

      const actions = testFixture.discoverActions('actor1');
      const sitAtDistanceActions = actions.filter(
        (a) => a.id === 'personal-space:sit_down_at_distance'
      );

      expect(sitAtDistanceActions.length).toBe(0);
    });

    it('should NOT appear when non-rightmost occupant lacks two free spots', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const furniture = new ModEntityBuilder('bench1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['bob1', null, 'charlie1', null], // Bob at index 0, Charlie at index 2
        })
        .build();

      const occupant1 = new ModEntityBuilder('bob1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 0,
        })
        .build();

      const occupant2 = new ModEntityBuilder('charlie1')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, actor, furniture, occupant1, occupant2]);
      configureActionDiscovery();

      const actions = testFixture.discoverActions('actor1');
      const sitAtDistanceActions = actions.filter(
        (a) => a.id === 'personal-space:sit_down_at_distance'
      );

      // Bob doesn't have two free spots to the right (only one spot before Charlie)
      // Action should not be discovered for Bob as secondary target
      expect(sitAtDistanceActions.length).toBe(0);
    });

    it('should NOT appear when actor is already sitting', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const furniture = new ModEntityBuilder('bench1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['bob1', null, null],
        })
        .build();

      const occupant = new ModEntityBuilder('bob1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, actor, furniture, occupant]);
      configureActionDiscovery();

      const actions = testFixture.discoverActions('actor1');
      const sitAtDistanceActions = actions.filter(
        (a) => a.id === 'personal-space:sit_down_at_distance'
      );

      expect(sitAtDistanceActions.length).toBe(0);
    });
  });

  describe('Scope resolution integration tests', () => {
    it('should resolve single rightmost occupant with space', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const furniture = new ModEntityBuilder('bench1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['bob1', null, null],
        })
        .build();

      const occupant = new ModEntityBuilder('bob1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, actor, furniture, occupant]);

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
        target: {
          id: 'bench1',
          components:
            testFixture.entityManager.getEntityInstance('bench1').components,
        },
      };

      const scopeResult = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'personal-space:actors_sitting_with_space_to_right',
        scopeContext
      );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toEqual(['bob1']);
    });

    it('should return only rightmost occupant when multiple occupants exist', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const furniture = new ModEntityBuilder('bench1')
        .withName('Long Bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['bob1', null, 'charlie1', null, null], // Charlie is rightmost with space
        })
        .build();

      const occupant1 = new ModEntityBuilder('bob1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 0,
        })
        .build();

      const occupant2 = new ModEntityBuilder('charlie1')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, actor, furniture, occupant1, occupant2]);

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
        target: {
          id: 'bench1',
          components:
            testFixture.entityManager.getEntityInstance('bench1').components,
        },
      };

      const scopeResult = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'personal-space:actors_sitting_with_space_to_right',
        scopeContext
      );

      expect(scopeResult.success).toBe(true);
      // Only Charlie should be returned (rightmost with 2 spaces)
      expect(Array.from(scopeResult.value)).toEqual(['charlie1']);
    });

    it('should return empty set when no occupants have sufficient space', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const furniture = new ModEntityBuilder('bench1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['bob1', null, 'charlie1'], // No one has 2 consecutive spaces
        })
        .build();

      const occupant1 = new ModEntityBuilder('bob1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 0,
        })
        .build();

      const occupant2 = new ModEntityBuilder('charlie1')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, actor, furniture, occupant1, occupant2]);

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
        target: {
          id: 'bench1',
          components:
            testFixture.entityManager.getEntityInstance('bench1').components,
        },
      };

      const scopeResult = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'personal-space:actors_sitting_with_space_to_right',
        scopeContext
      );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toEqual([]);
    });

    it('should validate rightmost position logic with various configurations', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      // Configuration: spots = [null, 'bob1', null, null]
      // Bob at index 1 is rightmost with 2 spaces to the right
      const furniture = new ModEntityBuilder('bench1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: [null, 'bob1', null, null],
        })
        .build();

      const occupant = new ModEntityBuilder('bob1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 1,
        })
        .build();

      testFixture.reset([room, actor, furniture, occupant]);

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
        target: {
          id: 'bench1',
          components:
            testFixture.entityManager.getEntityInstance('bench1').components,
        },
      };

      const scopeResult = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'personal-space:actors_sitting_with_space_to_right',
        scopeContext
      );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toEqual(['bob1']);
    });
  });
});
