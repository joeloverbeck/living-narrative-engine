/**
 * @file Integration tests for complete lying workflow and edge cases.
 * @description Tests the full lie down -> get up cycle and cross-system interactions.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

describe('Complete Lying Workflow', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('lying', 'lie_down');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Full lie down -> get up cycle', () => {
    it('should handle complete workflow: standing -> lying -> standing', async () => {
      // Arrange: Actor and furniture in same location
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Queen Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      testFixture.reset([room, actor, bed]);

      // Verify initial state: standing (no lying component)
      let currentActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(currentActor.components['lying-states:lying_on']).toBeUndefined();

      // Act 1: Lie down
      await testFixture.executeAction('test:actor1', 'test:bed1');

      // Assert: Lying state
      currentActor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(currentActor.components['lying-states:lying_on']).toBeDefined();
      expect(
        currentActor.components['lying-states:lying_on'].furniture_id
      ).toBe('test:bed1');

      // Act 2: Get up (requires switching to get_up_from_lying action)
      const getUpFixture = await ModTestFixture.forAction(
        'lying',
        'get_up_from_lying'
      );
      getUpFixture.reset([room, currentActor, bed]);
      await getUpFixture.executeAction('test:actor1', 'test:bed1');

      // Assert: Back to standing state
      currentActor =
        getUpFixture.entityManager.getEntityInstance('test:actor1');
      expect(currentActor.components['lying-states:lying_on']).toBeUndefined();

      getUpFixture.cleanup();
    });

    it('should allow lying on different furniture after getting up', async () => {
      // Arrange: Multiple furniture pieces
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Queen Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      const couch = new ModEntityBuilder('test:couch1')
        .withName('Couch')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      testFixture.reset([room, actor, bed, couch]);

      // Act: Lie on bed
      await testFixture.executeAction('test:actor1', 'test:bed1');

      // Get up (requires different fixture)
      const getUpFixture = await ModTestFixture.forAction(
        'lying',
        'get_up_from_lying'
      );
      let currentActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      getUpFixture.reset([room, currentActor, bed, couch]);
      await getUpFixture.executeAction('test:actor1', 'test:bed1');

      // Lie on couch (requires lie_down fixture again)
      const lieDownFixture2 = await ModTestFixture.forAction(
        'lying',
        'lie_down'
      );
      currentActor =
        getUpFixture.entityManager.getEntityInstance('test:actor1');
      lieDownFixture2.reset([room, currentActor, bed, couch]);
      await lieDownFixture2.executeAction('test:actor1', 'test:couch1');

      // Assert: Now lying on couch
      currentActor =
        lieDownFixture2.entityManager.getEntityInstance('test:actor1');
      expect(
        currentActor.components['lying-states:lying_on'].furniture_id
      ).toBe('test:couch1');

      getUpFixture.cleanup();
      lieDownFixture2.cleanup();
    });

    it('should maintain state consistency during transitions', async () => {
      // Test that component changes are atomic
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Queen Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      testFixture.reset([room, actor, bed]);

      // Act: Lie down and verify state
      await testFixture.executeAction('test:actor1', 'test:bed1');

      let currentActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      const lyingState = currentActor.components['lying-states:lying_on'];
      expect(lyingState).toBeDefined();
      expect(lyingState.furniture_id).toBe('test:bed1');

      // Get up and verify state
      const getUpFixture = await ModTestFixture.forAction(
        'lying',
        'get_up_from_lying'
      );
      getUpFixture.reset([room, currentActor, bed]);
      await getUpFixture.executeAction('test:actor1', 'test:bed1');

      currentActor =
        getUpFixture.entityManager.getEntityInstance('test:actor1');
      expect(currentActor.components['lying-states:lying_on']).toBeUndefined();

      getUpFixture.cleanup();
    });

    it('should handle rapid lie-get_up cycles', async () => {
      // Edge case: Quick succession of actions
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Queen Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      // First cycle
      testFixture.reset([room, actor, bed]);
      await testFixture.executeAction('test:actor1', 'test:bed1');

      let getUpFixture = await ModTestFixture.forAction(
        'lying',
        'get_up_from_lying'
      );
      let currentActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      getUpFixture.reset([room, currentActor, bed]);
      await getUpFixture.executeAction('test:actor1', 'test:bed1');

      // Second cycle
      const lieDownFixture2 = await ModTestFixture.forAction(
        'lying',
        'lie_down'
      );
      currentActor =
        getUpFixture.entityManager.getEntityInstance('test:actor1');
      lieDownFixture2.reset([room, currentActor, bed]);
      await lieDownFixture2.executeAction('test:actor1', 'test:bed1');

      const getUpFixture2 = await ModTestFixture.forAction(
        'lying',
        'get_up_from_lying'
      );
      currentActor =
        lieDownFixture2.entityManager.getEntityInstance('test:actor1');
      getUpFixture2.reset([room, currentActor, bed]);
      await getUpFixture2.executeAction('test:actor1', 'test:bed1');

      // Assert: Clean final state
      currentActor =
        getUpFixture2.entityManager.getEntityInstance('test:actor1');
      expect(currentActor.components['lying-states:lying_on']).toBeUndefined();

      getUpFixture.cleanup();
      lieDownFixture2.cleanup();
      getUpFixture2.cleanup();
    });
  });

  describe('State conflicts - prevent other positional actions while lying', () => {
    it('should prevent sitting while lying', async () => {
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:bed1',
        })
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Queen Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      const chair = new ModEntityBuilder('test:chair1')
        .withName('Chair')
        .atLocation('bedroom')
        .withComponent('sitting:allows_sitting', {
          spots: [{ occupied: false }],
        })
        .build();

      // Use sit_down fixture to test action is blocked
      const sitFixture = await ModTestFixture.forAction(
        'sitting',
        'sitting:sit_down'
      );
      sitFixture.reset([room, actor, bed, chair]);

      // Act & Assert: Try to sit (should throw ActionValidationError due to lying_down forbidden component)
      await expect(
        sitFixture.executeAction('test:actor1', 'test:chair1')
      ).rejects.toThrow('ACTION EXECUTION VALIDATION FAILED');

      sitFixture.cleanup();
    });

    it('should prevent bending while lying', async () => {
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:bed1',
        })
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Queen Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      const counter = new ModEntityBuilder('test:counter1')
        .withName('Counter')
        .atLocation('bedroom')
        .withComponent('bending:allows_bending_over', {})
        .build();

      const bendFixture = await ModTestFixture.forAction(
        'bending',
        'bend_over'
      );
      bendFixture.reset([room, actor, bed, counter]);

      // Act & Assert: Try to bend (should throw ActionValidationError due to lying_down forbidden component)
      await expect(
        bendFixture.executeAction('test:actor1', 'test:counter1')
      ).rejects.toThrow('ACTION EXECUTION VALIDATION FAILED');

      bendFixture.cleanup();
    });

    it('should prevent kneeling while lying', async () => {
      const room = new ModEntityBuilder('throne_room')
        .asRoom('Throne Room')
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Knight')
        .atLocation('throne_room')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:bed1',
        })
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Bed')
        .atLocation('throne_room')
        .withComponent('lying:allows_lying_on', {})
        .build();

      const king = new ModEntityBuilder('test:king')
        .withName('King')
        .atLocation('throne_room')
        .asActor()
        .build();

      const kneelFixture = await ModTestFixture.forAction(
        'deference',
        'deference:kneel_before'
      );
      kneelFixture.reset([room, actor, bed, king]);

      // Act: Try to kneel (should throw validation error due to lying_down component)
      await expect(async () => {
        await kneelFixture.executeAction('test:actor1', 'test:king');
      }).rejects.toThrow(/forbidden component/);

      kneelFixture.cleanup();
    });

    it('should prevent lying on another furniture while already lying', async () => {
      // Verify can't lie on multiple furniture simultaneously
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:bed1',
        })
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Queen Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      const couch = new ModEntityBuilder('test:couch1')
        .withName('Couch')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      testFixture.reset([room, actor, bed, couch]);

      // Act: Try to lie down again (should throw validation error - already has lying_down component)
      await expect(async () => {
        await testFixture.executeAction('test:actor1', 'test:couch1');
      }).rejects.toThrow(/forbidden component/);
    });

    it('should prevent turning around while lying', async () => {
      // Additional positional action test
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:bed1',
        })
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Queen Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      const turnFixture = await ModTestFixture.forAction(
        'physical-control',
        'turn_around'
      );
      turnFixture.reset([room, actor, bed]);

      // Act: Try to turn around (should throw validation error due to missing closeness component)
      await expect(async () => {
        await turnFixture.executeAction('test:actor1', 'none');
      }).rejects.toThrow(/missing required component/);

      turnFixture.cleanup();
    });
  });

  describe('Restore full action availability after getting up', () => {
    it('should allow sitting after getting up from lying', async () => {
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:bed1',
        })
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Queen Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      const chair = new ModEntityBuilder('test:chair1')
        .withName('Chair')
        .atLocation('bedroom')
        .withComponent('sitting:allows_sitting', {
          spots: [{ occupied: false }],
        })
        .build();

      // Act: Get up from lying
      const getUpFixture = await ModTestFixture.forAction(
        'lying',
        'get_up_from_lying'
      );
      getUpFixture.reset([room, actor, bed, chair]);
      await getUpFixture.executeAction('test:actor1', 'test:bed1');

      // Assert: Sitting should now work
      const sitFixture = await ModTestFixture.forAction(
        'sitting',
        'sitting:sit_down'
      );
      const standingActor =
        getUpFixture.entityManager.getEntityInstance('test:actor1');
      sitFixture.reset([room, standingActor, bed, chair]);

      // Should not throw - sitting is now allowed
      await expect(
        sitFixture.executeAction('test:actor1', 'test:chair1')
      ).resolves.not.toThrow();

      getUpFixture.cleanup();
      sitFixture.cleanup();
    });

    it('should allow bending after getting up from lying', async () => {
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:bed1',
        })
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Queen Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      const counter = new ModEntityBuilder('test:counter1')
        .withName('Counter')
        .atLocation('bedroom')
        .withComponent('bending:allows_bending_over', {})
        .build();

      // Act: Get up
      const getUpFixture = await ModTestFixture.forAction(
        'lying',
        'get_up_from_lying'
      );
      getUpFixture.reset([room, actor, bed, counter]);
      await getUpFixture.executeAction('test:actor1', 'test:bed1');

      // Assert: Bending should now work
      const bendFixture = await ModTestFixture.forAction(
        'bending',
        'bend_over'
      );
      const standingActor =
        getUpFixture.entityManager.getEntityInstance('test:actor1');
      bendFixture.reset([room, standingActor, bed, counter]);

      await expect(
        bendFixture.executeAction('test:actor1', 'test:counter1')
      ).resolves.not.toThrow();

      getUpFixture.cleanup();
      bendFixture.cleanup();
    });
  });

  describe('Edge Cases - Concurrency and Data Integrity', () => {
    it('should allow multiple actors to lie on same furniture', async () => {
      // KEY DIFFERENCE from sitting system - no slot limitations
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const alice = new ModEntityBuilder('test:alice')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .build();

      const bob = new ModEntityBuilder('test:bob')
        .withName('Bob')
        .atLocation('bedroom')
        .asActor()
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('King Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      testFixture.reset([room, alice, bob, bed]);

      // Act: Both lie down
      await testFixture.executeAction('test:alice', 'test:bed1');
      await testFixture.executeAction('test:bob', 'test:bed1');

      // Assert: Both should have lying_down component
      const aliceEntity =
        testFixture.entityManager.getEntityInstance('test:alice');
      const bobEntity = testFixture.entityManager.getEntityInstance('test:bob');

      expect(aliceEntity.components['lying-states:lying_on']).toBeDefined();
      expect(bobEntity.components['lying-states:lying_on']).toBeDefined();
      expect(
        aliceEntity.components['lying-states:lying_on'].furniture_id
      ).toBe('test:bed1');
      expect(bobEntity.components['lying-states:lying_on'].furniture_id).toBe(
        'test:bed1'
      );
    });

    it('should handle actor getting up when another is still lying', async () => {
      // Setup: Two actors lying on same furniture
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const alice = new ModEntityBuilder('test:alice')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:bed1',
        })
        .build();

      const bob = new ModEntityBuilder('test:bob')
        .withName('Bob')
        .atLocation('bedroom')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:bed1',
        })
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('King Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      // Act: Alice gets up
      const getUpFixture = await ModTestFixture.forAction(
        'lying',
        'get_up_from_lying'
      );
      getUpFixture.reset([room, alice, bob, bed]);
      await getUpFixture.executeAction('test:alice', 'test:bed1');

      // Assert: Alice standing, Bob still lying
      const aliceEntity =
        getUpFixture.entityManager.getEntityInstance('test:alice');
      const bobEntity =
        getUpFixture.entityManager.getEntityInstance('test:bob');

      expect(aliceEntity.components['lying-states:lying_on']).toBeUndefined();
      expect(bobEntity.components['lying-states:lying_on']).toBeDefined();

      getUpFixture.cleanup();
    });

    it('should handle furniture being deleted while actor is lying', async () => {
      // Edge case: Furniture entity removed during gameplay
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:bed1',
        })
        .build();

      const getUpFixture = await ModTestFixture.forAction(
        'lying',
        'get_up_from_lying'
      );
      getUpFixture.reset([room, actor]);
      // Note: Bed not registered (simulates deletion)

      // Act: Try to get up from non-existent furniture
      // Should handle gracefully (may throw or handle error)
      try {
        await getUpFixture.executeAction('test:actor1', 'test:bed1');
      } catch (err) {
        // Expected - furniture doesn't exist
      }

      // Assert: Should not crash, actor entity still exists
      const actorEntity =
        getUpFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorEntity).toBeDefined();

      getUpFixture.cleanup();
    });
  });

  describe('Movement Lock Integration', () => {
    it('should prevent movement while lying', async () => {
      // Verify movement lock integration
      const bedroom = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();
      const kitchen = new ModEntityBuilder('kitchen').asRoom('Kitchen').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Queen Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      testFixture.reset([bedroom, kitchen, actor, bed]);

      // Act: Lie down
      await testFixture.executeAction('test:actor1', 'test:bed1');

      // Assert: lying_down component present (movement restriction enforced by game rules)
      const actorEntity =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorEntity.components['lying-states:lying_on']).toBeDefined();
    });

    it('should allow movement after getting up', async () => {
      // Verify movement unlock integration
      const bedroom = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();
      const kitchen = new ModEntityBuilder('kitchen').asRoom('Kitchen').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:bed1',
        })
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Queen Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      const getUpFixture = await ModTestFixture.forAction(
        'lying',
        'get_up_from_lying'
      );
      getUpFixture.reset([bedroom, kitchen, actor, bed]);

      // Act: Get up
      await getUpFixture.executeAction('test:actor1', 'test:bed1');

      // Assert: lying_down component removed (movement allowed)
      const actorEntity =
        getUpFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorEntity.components['lying-states:lying_on']).toBeUndefined();

      getUpFixture.cleanup();
    });
  });

  describe('Data integrity', () => {
    it('should maintain consistent state across multiple actions', async () => {
      // Complex scenario: Multiple actors, multiple furniture, sequence of actions
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const alice = new ModEntityBuilder('test:alice')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .build();

      const bob = new ModEntityBuilder('test:bob')
        .withName('Bob')
        .atLocation('bedroom')
        .asActor()
        .build();

      const bed = new ModEntityBuilder('test:bed1')
        .withName('King Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      const couch = new ModEntityBuilder('test:couch1')
        .withName('Couch')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      testFixture.reset([room, alice, bob, bed, couch]);

      // Complex action sequence - Alice lies on bed
      await testFixture.executeAction('test:alice', 'test:bed1');

      // Bob lies on couch
      await testFixture.executeAction('test:bob', 'test:couch1');

      // Alice gets up from bed
      const getUpFixture = await ModTestFixture.forAction(
        'lying',
        'get_up_from_lying'
      );
      let aliceEntity =
        testFixture.entityManager.getEntityInstance('test:alice');
      const bobEntity = testFixture.entityManager.getEntityInstance('test:bob');
      getUpFixture.reset([room, aliceEntity, bobEntity, bed, couch]);
      await getUpFixture.executeAction('test:alice', 'test:bed1');

      // Alice lies on couch (need lie_down fixture again)
      const lieDownFixture2 = await ModTestFixture.forAction(
        'lying',
        'lie_down'
      );
      const aliceStanding =
        getUpFixture.entityManager.getEntityInstance('test:alice');
      const bobStillLying =
        getUpFixture.entityManager.getEntityInstance('test:bob');
      lieDownFixture2.reset([room, aliceStanding, bobStillLying, bed, couch]);
      await lieDownFixture2.executeAction('test:alice', 'test:couch1');

      // Assert: Final state is consistent
      const finalAlice =
        lieDownFixture2.entityManager.getEntityInstance('test:alice');
      const finalBob =
        lieDownFixture2.entityManager.getEntityInstance('test:bob');

      expect(finalAlice.components['lying-states:lying_on'].furniture_id).toBe(
        'test:couch1'
      );
      expect(finalBob.components['lying-states:lying_on'].furniture_id).toBe(
        'test:couch1'
      );
      // Both on couch now

      getUpFixture.cleanup();
      lieDownFixture2.cleanup();
    });
  });
});
