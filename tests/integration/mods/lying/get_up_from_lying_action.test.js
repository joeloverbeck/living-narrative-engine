/**
 * @file Integration tests for the lying:get_up_from_lying action and rule.
 * @description Tests the rule execution after the get_up_from_lying action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

/**
 * Creates standardized lying scenario with actor already lying on furniture.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} furnitureName - Name for the furniture
 * @param {string} locationId - Location for the scenario
 * @returns {object} Object with actor, furniture, and location entities
 */
function setupActorLyingOnFurniture(
  actorName = 'Alice',
  furnitureName = 'Queen Bed',
  locationId = 'bedroom'
) {
  const room = new ModEntityBuilder(locationId).asRoom('Bedroom').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .withComponent('lying-states:lying_on', {
      furniture_id: 'test:bed1',
    })
    .build();

  const furniture = new ModEntityBuilder('test:bed1')
    .withName(furnitureName)
    .atLocation(locationId)
    .withComponent('lying:allows_lying_on', {})
    .build();

  return { room, actor, furniture };
}

describe('lying:get_up_from_lying action rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'lying',
      'get_up_from_lying'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successful getting up', () => {
    it('should remove lying_down component', async () => {
      // Arrange: Actor lying on bed
      const scenario = setupActorLyingOnFurniture();
      testFixture.reset([scenario.room, scenario.actor, scenario.furniture]);

      // Verify precondition
      const actorBefore =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorBefore.components['lying-states:lying_on']).toBeDefined();

      // Act: Get up
      await testFixture.executeAction('test:actor1', 'test:bed1');

      // Assert: Component removed
      const actorAfter =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorAfter.components['lying-states:lying_on']).toBeUndefined();
    });

    it('should unlock actor movement', async () => {
      // Arrange
      const scenario = setupActorLyingOnFurniture();
      testFixture.reset([scenario.room, scenario.actor, scenario.furniture]);

      // Note: Movement locking is handled by the positioning system through the lying_down component
      // We verify component removal as the indicator that movement is unlocked

      // Act: Get up
      await testFixture.executeAction('test:actor1', 'test:bed1');

      // Assert: lying_down component removed (movement restriction removed)
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['lying-states:lying_on']).toBeUndefined();
    });

    it('should dispatch perceptible event with correct message', async () => {
      // Arrange
      const scenario = setupActorLyingOnFurniture(
        'Alice',
        'Queen Bed',
        'bedroom'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.furniture]);

      // Act: Get up
      await testFixture.executeAction('test:actor1', 'test:bed1');

      // Assert: Check perceptible event
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const event = perceptibleEvents[0];
      expect(event.payload.descriptionText).toBe(
        'Alice gets up from Queen Bed.'
      );
      expect(event.payload.locationId).toBe('bedroom');
      expect(event.payload.actorId).toBe('test:actor1');
      expect(event.payload.targetId).toBe('test:bed1');
    });
  });

  describe('Getting up from different furniture', () => {
    it('should work when getting up from couch', async () => {
      const room = new ModEntityBuilder('living_room')
        .asRoom('Living Room')
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Bob')
        .atLocation('living_room')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:couch1',
        })
        .build();

      const couch = new ModEntityBuilder('test:couch1')
        .withName('Leather Couch')
        .atLocation('living_room')
        .withComponent('lying:allows_lying_on', {})
        .build();

      testFixture.reset([room, actor, couch]);

      // Act
      await testFixture.executeAction('test:actor1', 'test:couch1');

      // Assert
      const updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor.components['lying-states:lying_on']).toBeUndefined();
    });

    it('should work with any furniture type marked with allows_lying_on', async () => {
      // Test with a custom furniture type - hammock
      const room = new ModEntityBuilder('garden').asRoom('Garden').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Carol')
        .atLocation('garden')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:hammock1',
        })
        .build();

      const hammock = new ModEntityBuilder('test:hammock1')
        .withName('Garden Hammock')
        .atLocation('garden')
        .withComponent('lying:allows_lying_on', {})
        .build();

      testFixture.reset([room, actor, hammock]);

      // Act
      await testFixture.executeAction('test:actor1', 'test:hammock1');

      // Assert
      const updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor.components['lying-states:lying_on']).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should handle gracefully when actor is not actually lying', async () => {
      // Edge case: Action triggered but actor doesn't have lying_down component
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .build();
      // Note: NO lying_down component

      const bed = new ModEntityBuilder('test:bed1')
        .withName('Queen Bed')
        .atLocation('bedroom')
        .withComponent('lying:allows_lying_on', {})
        .build();

      testFixture.reset([room, actor, bed]);

      // Act: Try to get up (should throw validation error)
      await expect(async () => {
        await testFixture.executeAction('test:actor1', 'test:bed1');
      }).rejects.toThrow(/missing required component/);

      // Assert: Verify the system handled it without crashing
      const actor2 = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor2).toBeDefined();
    });

    it('should not crash when furniture has been deleted', async () => {
      // Edge case: Furniture deleted while actor lying
      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .withComponent('lying-states:lying_on', {
          furniture_id: 'test:nonexistent_bed', // References deleted furniture
        })
        .build();

      testFixture.reset([room, actor]);
      // Note: No bed entity registered

      // Act: Try to get up - should throw validation error
      await expect(async () => {
        await testFixture.executeAction('test:actor1', 'test:nonexistent_bed');
      }).rejects.toThrow(/does not exist/);

      // Assert: Should handle gracefully (implementation-dependent)
      // At minimum, should not crash the game
      const actorAfter =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorAfter).toBeDefined(); // Actor still exists
    });
  });

  describe('Complete cycle', () => {
    it('should restore actor to original state after lie down -> get up', async () => {
      // This is more of a workflow test but worth including
      const scenario = setupActorLyingOnFurniture();
      testFixture.reset([scenario.room, scenario.actor, scenario.furniture]);

      // Get initial state (already lying in this setup)
      const initialActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(initialActor.components['lying-states:lying_on']).toBeDefined();

      // Act: Get up
      await testFixture.executeAction('test:actor1', 'test:bed1');

      // Assert: Actor should be in "normal" state
      const finalActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(finalActor.components['lying-states:lying_on']).toBeUndefined();

      // Should be able to do other actions now
      // (More comprehensive testing in LYIFURSYS-007)
    });
  });

  describe('Rule validation', () => {
    it('should validate rule structure', () => {
      // The rule file should be loaded
      expect(testFixture.ruleFile).toBeDefined();
      expect(testFixture.ruleFile.rule_id).toBe('handle_get_up_from_lying');
      expect(testFixture.ruleFile.condition).toBeDefined();
      expect(testFixture.ruleFile.actions).toBeDefined();
    });

    it('should have correct condition file', () => {
      // The condition file should be loaded
      expect(testFixture.conditionFile).toBeDefined();
      expect(testFixture.conditionFile.id).toMatch(
        /get[-_]up[-_]from[-_]lying/
      );
    });

    it('should have valid rule actions', () => {
      // Check that the rule has the expected action structure
      expect(testFixture.ruleFile.actions).toBeDefined();
      expect(Array.isArray(testFixture.ruleFile.actions)).toBe(true);
      expect(testFixture.ruleFile.actions.length).toBeGreaterThan(0);
    });

    it('should include REMOVE_COMPONENT action in rule', () => {
      // Verify that the rule includes the operation to remove lying_down component
      const ifAction = testFixture.ruleFile.actions.find(
        (action) => action.type === 'IF'
      );
      expect(ifAction).toBeDefined();

      const removeComponentActions = ifAction.parameters.then_actions.filter(
        (action) => action.type === 'REMOVE_COMPONENT'
      );
      expect(removeComponentActions.length).toBeGreaterThan(0);

      const lyingDownComponentAction = removeComponentActions.find(
        (action) =>
          action.parameters.component_type === 'lying-states:lying_on'
      );
      expect(lyingDownComponentAction).toBeDefined();
    });

    it('should include UNLOCK_MOVEMENT action in rule', () => {
      // Verify that the rule includes the operation to unlock movement
      const ifAction = testFixture.ruleFile.actions.find(
        (action) => action.type === 'IF'
      );
      expect(ifAction).toBeDefined();

      const unlockMovementActions = ifAction.parameters.then_actions.filter(
        (action) => action.type === 'UNLOCK_MOVEMENT'
      );
      expect(unlockMovementActions.length).toBeGreaterThan(0);
    });
  });
});
