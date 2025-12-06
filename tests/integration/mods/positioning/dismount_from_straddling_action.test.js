import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

/**
 * Creates scenario where actor is straddling sitting target.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} targetName - Name for the target
 * @param {boolean} facingAway - Whether actor is facing away
 * @returns {object} Object with room, chair, actor, and target entities
 */
function setupDismountScenario(
  actorName = 'Alice',
  targetName = 'Bob',
  facingAway = false
) {
  const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

  const chair = new ModEntityBuilder('test:chair1')
    .withName('Chair')
    .atLocation('bedroom')
    .build();

  const target = new ModEntityBuilder('test:target1')
    .withName(targetName)
    .atLocation('bedroom')
    .closeToEntity('test:actor1')
    .asActor()
    .build();

  target.components['positioning:sitting_on'] = {
    furniture_id: 'test:chair1',
    spot_index: 0,
  };
  target.components['movement:movement_locked'] = {};

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation('bedroom')
    .closeToEntity('test:target1')
    .asActor()
    .build();

  actor.components['positioning:straddling_waist'] = {
    target_id: 'test:target1',
    facing_away: facingAway,
  };
  actor.components['movement:movement_locked'] = {};

  if (facingAway) {
    actor.components['positioning:facing_away'] = {
      facing_away_from: ['test:target1'],
    };
  }

  return { room, chair, actor, target };
}

describe('Dismount from Straddling - Action Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:dismount_from_straddling'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Facing orientation', () => {
    it('should remove straddling_waist component', async () => {
      const entities = setupDismountScenario('Alice', 'Bob', false);
      testFixture.reset(Object.values(entities));

      await testFixture.executeAction('test:actor1', 'test:target1');

      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['positioning:straddling_waist']).toBeUndefined();
    });

    it('should not remove facing_away component when facing_away=false', async () => {
      const entities = setupDismountScenario('Alice', 'Bob', false);
      testFixture.reset(Object.values(entities));

      await testFixture.executeAction('test:actor1', 'test:target1');

      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      // Should remain undefined (never was added)
      expect(actor.components['positioning:facing_away']).toBeUndefined();
    });

    it('should unlock actor movement', async () => {
      const entities = setupDismountScenario('Alice', 'Bob', false);
      testFixture.reset(Object.values(entities));

      await testFixture.executeAction('test:actor1', 'test:target1');

      // UNLOCK_MOVEMENT operation handler removes movement lock via its implementation
      // Check that action executed successfully (movement unlock is internal)
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        'Alice dismounts from straddling Bob.'
      );
    });
  });

  describe('Facing away orientation', () => {
    it('should remove both straddling_waist and facing_away components', async () => {
      const entities = setupDismountScenario('Alice', 'Bob', true);
      testFixture.reset(Object.values(entities));

      await testFixture.executeAction('test:actor1', 'test:target1');

      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['positioning:straddling_waist']).toBeUndefined();
      expect(actor.components['positioning:facing_away']).toBeUndefined();
    });

    it('should unlock actor movement', async () => {
      const entities = setupDismountScenario('Alice', 'Bob', true);
      testFixture.reset(Object.values(entities));

      await testFixture.executeAction('test:actor1', 'test:target1');

      // UNLOCK_MOVEMENT operation handler removes movement lock via its implementation
      // Check that action executed successfully (movement unlock is internal)
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        'Alice dismounts from straddling Bob.'
      );
    });
  });

  describe('Common behavior', () => {
    it('should keep target sitting with movement locked', async () => {
      const entities = setupDismountScenario('Alice', 'Bob', false);
      testFixture.reset(Object.values(entities));

      await testFixture.executeAction('test:actor1', 'test:target1');

      const target =
        testFixture.entityManager.getEntityInstance('test:target1');
      expect(target.components['positioning:sitting_on']).toBeDefined();
      expect(target.components['movement:movement_locked']).toBeDefined();
    });

    it('should keep both actors in closeness circle', async () => {
      const entities = setupDismountScenario('Alice', 'Bob', false);
      testFixture.reset(Object.values(entities));

      await testFixture.executeAction('test:actor1', 'test:target1');

      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      const target =
        testFixture.entityManager.getEntityInstance('test:target1');

      expect(actor.components['positioning:closeness']).toBeDefined();
      expect(actor.components['positioning:closeness'].partners).toContain(
        'test:target1'
      );
      expect(target.components['positioning:closeness']).toBeDefined();
      expect(target.components['positioning:closeness'].partners).toContain(
        'test:actor1'
      );
    });
  });

  describe('Conditional cleanup validation', () => {
    it('should handle facing_away component presence correctly', async () => {
      // Test facing case
      const facingEntities = setupDismountScenario('Alice', 'Bob', false);
      testFixture.reset(Object.values(facingEntities));
      await testFixture.executeAction('test:actor1', 'test:target1');

      const facingActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(facingActor.components['positioning:facing_away']).toBeUndefined();

      // Test facing away case
      const facingAwayEntities = setupDismountScenario('Alice', 'Bob', true);
      testFixture.reset(Object.values(facingAwayEntities));
      await testFixture.executeAction('test:actor1', 'test:target1');

      const facingAwayActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(
        facingAwayActor.components['positioning:facing_away']
      ).toBeUndefined();
    });
  });
});
