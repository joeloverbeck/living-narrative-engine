import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import handleScootCloserRule from '../../../../data/mods/positioning/rules/handle_scoot_closer.rule.json' assert { type: 'json' };
import eventIsActionScootCloser from '../../../../data/mods/positioning/conditions/event-is-action-scoot-closer.condition.json' assert { type: 'json' };

describe('scoot_closer action discovery - Integration Tests', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:scoot_closer',
      handleScootCloserRule,
      eventIsActionScootCloser
    );

    // Add custom scope resolvers
    const { testEnv } = testFixture;
    const originalResolveSync = testEnv.unifiedScopeResolver.resolveSync;
    testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
      console.log(`🔍 Resolving scope: ${scopeName}`);

      // Custom resolver for furniture_actor_sitting_on
      if (scopeName === 'positioning:furniture_actor_sitting_on') {
        console.log(`  📌 Context actor ID: ${context?.actor?.id}`);
        const actorId = context?.actor?.id;
        if (!actorId) {
          console.log(`  ❌ No actor ID in context`);
          return { success: true, value: new Set() };
        }

        const actor = testFixture.entityManager.getEntityInstance(actorId);
        console.log(`  👤 Actor entity: ${actor ? 'found' : 'NOT FOUND'}`);
        const sittingOn = actor?.components?.['positioning:sitting_on'];
        console.log(`  🪑 Sitting component: ${JSON.stringify(sittingOn)}`);
        if (!sittingOn || !sittingOn.furniture_id) {
          console.log(`  ❌ No valid sitting_on component`);
          return { success: true, value: new Set() };
        }

        // Return the furniture entity the actor is sitting on
        const result = new Set([sittingOn.furniture_id]);
        console.log(`  ✅ Returning furniture: ${sittingOn.furniture_id}`);
        return { success: true, value: result };
      }

      // Custom resolver for closest_leftmost_occupant
      if (scopeName === 'positioning:closest_leftmost_occupant') {
        console.log(`  📌 Context actor ID: ${context?.actor?.id}, target ID: ${context?.target?.id}`);
        const actorId = context?.actor?.id;
        const furnitureId = context?.target?.id;

        if (!actorId || !furnitureId) {
          console.log(`  ❌ Missing actor or furniture ID`);
          return { success: true, value: new Set() };
        }

        const actor = testFixture.entityManager.getEntityInstance(actorId);
        const furniture = testFixture.entityManager.getEntityInstance(furnitureId);
        console.log(`  👤 Actor: ${actor ? 'found' : 'NOT FOUND'}, 🪑 Furniture: ${furniture ? 'found' : 'NOT FOUND'}`);

        const actorSitting = actor?.components?.['positioning:sitting_on'];
        const sittingComponent = furniture?.components?.['positioning:allows_sitting'];
        console.log(`  📍 Actor sitting: ${JSON.stringify(actorSitting)}`);
        console.log(`  🛋️ Furniture spots: ${JSON.stringify(sittingComponent?.spots)}`);

        if (!actorSitting || !sittingComponent || !Array.isArray(sittingComponent.spots)) {
          console.log(`  ❌ Invalid sitting components`);
          return { success: true, value: new Set() };
        }

        const actorIndex = actorSitting.spot_index;
        const spots = sittingComponent.spots;
        console.log(`  🎯 Actor at index ${actorIndex}, searching left...`);

        // Check if the spot immediately to the left is empty
        if (actorIndex === 0) {
          console.log(`  ⚠️ Actor is in leftmost position`);
          return { success: true, value: new Set() };
        }

        const spotToLeft = spots[actorIndex - 1];
        if (spotToLeft) {
          console.log(`  ⚠️ Spot immediately to left is occupied: ${spotToLeft}`);
          return { success: true, value: new Set() };
        }

        // The spot to the left is empty. Find the leftmost (first) occupant.
        let leftmostOccupantId = null;
        let leftmostIndex = -1;

        for (let i = actorIndex - 2; i >= 0; i--) {
          const occupantId = spots[i];
          console.log(`    Checking spot ${i}: ${occupantId}`);
          if (occupantId && typeof occupantId === 'string' && occupantId !== actorId) {
            leftmostOccupantId = occupantId;
            leftmostIndex = i;
            // Don't break - continue to find the LEFTMOST (lowest index)
          }
        }

        if (!leftmostOccupantId) {
          console.log(`  ⚠️ No occupant found to the left`);
          return { success: true, value: new Set() };
        }

        // Check if all spots between leftmost occupant and the empty spot are also empty
        // Valid pattern: [occupant, null, ..., null, actor] with no other occupants in between
        for (let i = leftmostIndex + 1; i < actorIndex - 1; i++) {
          if (spots[i]) {
            console.log(`  ⚠️ Another occupant exists between leftmost and actor at index ${i}: ${spots[i]}`);
            return { success: true, value: new Set() };
          }
        }

        // Valid scooting scenario - can move closer to leftmost occupant
        console.log(`  ✅ Found leftmost occupant at index ${leftmostIndex}: ${leftmostOccupantId}`);
        return { success: true, value: new Set([leftmostOccupantId]) };
      }

      // Fall back to original resolution for other scopes
      return originalResolveSync.call(testEnv.unifiedScopeResolver, scopeName, context);
    };
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Valid Discovery Scenarios', () => {
    it('should discover scoot_closer when actor can move closer', async () => {
      // Setup: Furniture with [occupant1, null, actor] - actor can scoot to middle
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['occupant1', null, 'actor1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, actor]);

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Debug output
      console.log(`\n🎬 DISCOVERED ACTIONS:`);
      console.log(`  Total: ${actions.length}`);
      console.log(`  Action IDs:`, actions.map(a => a.id));
      console.log(`  Full actions:`, JSON.stringify(actions, null, 2));

      // Assert
      const scootAction = actions.find(
        (a) => a.id === 'positioning:scoot_closer'
      );
      console.log(`\n🔍 scoot_closer action:`, scootAction ? 'FOUND ✅' : 'NOT FOUND ❌');
      if (scootAction) {
        console.log(`  Targets:`, JSON.stringify(scootAction.targets, null, 2));
      }
      expect(scootAction).toBeDefined();
      expect(scootAction.targets).toBeDefined();
      expect(scootAction.targets.primary).toBeDefined();
      expect(scootAction.targets.primary.scope).toBe('positioning:furniture_actor_sitting_on');
      expect(scootAction.targets.secondary).toBeDefined();
      expect(scootAction.targets.secondary.scope).toBe('positioning:closest_leftmost_occupant');
      expect(scootAction.targets.secondary.contextFrom).toBe('primary');
    });

    it('should discover scoot_closer with multiple empty spots', async () => {
      // Setup: Furniture with [occupant1, null, null, actor]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['occupant1', null, null, 'actor1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 3,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, actor]);

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Assert
      const scootAction = actions.find(
        (a) => a.id === 'positioning:scoot_closer'
      );
      expect(scootAction).toBeDefined();
      expect(scootAction.targets).toBeDefined();
      expect(scootAction.targets.primary).toBeDefined();
      expect(scootAction.targets.primary.scope).toBe('positioning:furniture_actor_sitting_on');
      expect(scootAction.targets.secondary).toBeDefined();
      expect(scootAction.targets.secondary.scope).toBe('positioning:closest_leftmost_occupant');
      expect(scootAction.targets.secondary.contextFrom).toBe('primary');
    });
  });

  describe('Invalid Discovery Scenarios', () => {
    it('should NOT discover when actor is in leftmost position', async () => {
      // Setup: Furniture with [actor, null, occupant2]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['actor1', null, 'occupant2'],
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const occupant2 = new ModEntityBuilder('occupant2')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, furniture, actor, occupant2]);

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Assert
      const scootAction = actions.find(
        (a) => a.id === 'positioning:scoot_closer'
      );
      expect(scootAction).toBeUndefined();
    });

    it('should NOT discover when spot to left is occupied', async () => {
      // Setup: Furniture with [occupant1, occupant2, actor]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['occupant1', 'occupant2', 'actor1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const occupant2 = new ModEntityBuilder('occupant2')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 1,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, occupant2, actor]);

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Assert
      const scootAction = actions.find(
        (a) => a.id === 'positioning:scoot_closer'
      );
      expect(scootAction).toBeUndefined();
    });

    it('should NOT discover when no occupant to the left', async () => {
      // Setup: Furniture with [null, null, actor]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: [null, null, 'actor1'],
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, furniture, actor]);

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Assert
      const scootAction = actions.find(
        (a) => a.id === 'positioning:scoot_closer'
      );
      expect(scootAction).toBeUndefined();
    });

    it('should NOT discover when gap exists between actor and leftmost occupant', async () => {
      // Setup: Furniture with [occupant1, null, occupant2, null, actor]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['occupant1', null, 'occupant2', null, 'actor1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const occupant2 = new ModEntityBuilder('occupant2')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 4,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, occupant2, actor]);

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Assert
      const scootAction = actions.find(
        (a) => a.id === 'positioning:scoot_closer'
      );
      expect(scootAction).toBeUndefined();
    });

    it('should NOT discover when actor is not sitting', async () => {
      // Setup: Actor without sitting_on component
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      testFixture.reset([room, actor]);

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Assert
      const scootAction = actions.find(
        (a) => a.id === 'positioning:scoot_closer'
      );
      expect(scootAction).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle two-spot furniture correctly', async () => {
      // Setup: Furniture with [occupant1, actor]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['occupant1', 'actor1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 1,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, actor]);

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Assert - spot to left is occupied, should not discover
      const scootAction = actions.find((a) => a.id === 'positioning:scoot_closer');
      expect(scootAction).toBeUndefined();
    });

    it('should handle single-spot furniture correctly', async () => {
      // Setup: Furniture with [actor]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['actor1'],
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, furniture, actor]);

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Assert - leftmost position, should not discover
      const scootAction = actions.find((a) => a.id === 'positioning:scoot_closer');
      expect(scootAction).toBeUndefined();
    });
  });
});
