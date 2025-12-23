import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

describe('Sit on Lap → Dismount → Sit Again Workflow', () => {
  let testFixtureFacingAway;
  let testFixtureFacing;
  let testFixtureDismount;
  let testFixtureSitDown;

  beforeEach(async () => {
    // Load all four actions we need for the workflow
    testFixtureFacingAway = await ModTestFixture.forActionAutoLoad(
      'straddling',
      'straddling:sit_on_lap_from_sitting_facing_away'
    );
    testFixtureFacing = await ModTestFixture.forActionAutoLoad(
      'straddling',
      'straddling:sit_on_lap_from_sitting_facing'
    );
    testFixtureDismount = await ModTestFixture.forActionAutoLoad(
      'straddling',
      'straddling:dismount_from_straddling'
    );
    testFixtureSitDown = await ModTestFixture.forActionAutoLoad(
      'sitting',
      'sitting:sit_down'
    );
  });

  afterEach(() => {
    testFixtureFacingAway?.cleanup();
    testFixtureFacing?.cleanup();
    testFixtureDismount?.cleanup();
    testFixtureSitDown?.cleanup();
  });

  describe('Bug Reproduction: sit_on_lap_from_sitting_facing_away path', () => {
    it('should allow actor to sit on furniture after dismounting from straddling (facing away)', async () => {
      // Setup: room, two chairs, two actors sitting close to each other
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: [null, null, null],
        })
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: [null, null, null],
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      // Step 1: Execute sit_on_lap_from_sitting_facing_away
      testFixtureFacingAway.reset([room, chair1, chair2, actor, target]);
      await testFixtureFacingAway.executeAction('actor1', 'target1');

      // Verify Step 1: sitting_on removed, straddling_waist added, facing_away added
      let updatedActor =
        testFixtureFacingAway.entityManager.getEntityInstance('actor1');
      expect(updatedActor.components['sitting-states:sitting_on']).toBeUndefined();
      expect(
        updatedActor.components['straddling-states:straddling_waist']
      ).toBeDefined();
      expect(
        updatedActor.components['straddling-states:straddling_waist'].facing_away
      ).toBe(true);
      expect(updatedActor.components['facing-states:facing_away']).toBeDefined();

      // Step 2: Execute dismount_from_straddling
      // Transfer state to dismount fixture
      testFixtureDismount.reset([room, chair1, chair2, updatedActor, target]);
      await testFixtureDismount.executeAction('actor1', 'target1');

      // Verify Step 2: straddling_waist removed, facing_away removed, NO positional components
      updatedActor =
        testFixtureDismount.entityManager.getEntityInstance('actor1');
      console.log(
        'Components after dismount (facing_away path):',
        Object.keys(updatedActor.components)
      );
      expect(
        updatedActor.components['straddling-states:straddling_waist']
      ).toBeUndefined();
      expect(
        updatedActor.components['facing-states:facing_away']
      ).toBeUndefined();
      expect(updatedActor.components['sitting-states:sitting_on']).toBeUndefined();

      // Step 3: Try to sit on chair1 again
      // Transfer state to sit_down fixture
      testFixtureSitDown.reset([room, chair1, chair2, updatedActor, target]);
      await testFixtureSitDown.executeAction('actor1', 'chair1');

      // Verify Step 3: Should succeed - actor should be sitting on chair1
      updatedActor =
        testFixtureSitDown.entityManager.getEntityInstance('actor1');
      console.log(
        'Components after sit_down (facing_away path):',
        Object.keys(updatedActor.components)
      );
      expect(testFixtureSitDown.events).toHaveActionSuccess(
        'Alice sits down on Chair 1.'
      );
      expect(updatedActor.components['sitting-states:sitting_on']).toBeDefined();
      expect(
        updatedActor.components['sitting-states:sitting_on'].furniture_id
      ).toBe('chair1');
    });
  });

  describe('Working Case Comparison: sit_on_lap_from_sitting_facing path', () => {
    it('should allow actor to sit on furniture after dismounting from straddling (face-to-face)', async () => {
      // Setup: identical to the facing_away case
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: [null, null, null],
        })
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: [null, null, null],
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      // Step 1: Execute sit_on_lap_from_sitting_facing (face-to-face)
      testFixtureFacing.reset([room, chair1, chair2, actor, target]);
      await testFixtureFacing.executeAction('actor1', 'target1');

      // Verify Step 1: sitting_on removed, straddling_waist added, NO facing_away
      let updatedActor =
        testFixtureFacing.entityManager.getEntityInstance('actor1');
      expect(updatedActor.components['sitting-states:sitting_on']).toBeUndefined();
      expect(
        updatedActor.components['straddling-states:straddling_waist']
      ).toBeDefined();
      expect(
        updatedActor.components['straddling-states:straddling_waist'].facing_away
      ).toBe(false);
      expect(
        updatedActor.components['facing-states:facing_away']
      ).toBeUndefined();

      // Step 2: Execute dismount_from_straddling
      // Transfer state to dismount fixture
      testFixtureDismount.reset([room, chair1, chair2, updatedActor, target]);
      await testFixtureDismount.executeAction('actor1', 'target1');

      // Verify Step 2: straddling_waist removed, NO positional components
      updatedActor =
        testFixtureDismount.entityManager.getEntityInstance('actor1');
      console.log(
        'Components after dismount (facing path):',
        Object.keys(updatedActor.components)
      );
      expect(
        updatedActor.components['straddling-states:straddling_waist']
      ).toBeUndefined();
      expect(
        updatedActor.components['facing-states:facing_away']
      ).toBeUndefined();
      expect(updatedActor.components['sitting-states:sitting_on']).toBeUndefined();

      // Step 3: Try to sit on chair1 again
      // Transfer state to sit_down fixture
      testFixtureSitDown.reset([room, chair1, chair2, updatedActor, target]);
      await testFixtureSitDown.executeAction('actor1', 'chair1');

      // Verify Step 3: Should succeed - actor should be sitting on chair1
      updatedActor =
        testFixtureSitDown.entityManager.getEntityInstance('actor1');
      console.log(
        'Components after sit_down (facing path):',
        Object.keys(updatedActor.components)
      );
      expect(testFixtureSitDown.events).toHaveActionSuccess(
        'Alice sits down on Chair 1.'
      );
      expect(updatedActor.components['sitting-states:sitting_on']).toBeDefined();
      expect(
        updatedActor.components['sitting-states:sitting_on'].furniture_id
      ).toBe('chair1');
    });
  });

  describe('Component State Debugging', () => {
    it('should have identical component states after dismount regardless of facing direction', async () => {
      // This test compares the exact component state after dismounting
      // from both facing directions to identify any differences

      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: [null, null, null],
        })
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: [null, null, null],
        })
        .build();

      // Test facing_away path
      const actorAway = new ModEntityBuilder('actor_away')
        .withName('Alice Away')
        .atLocation('room1')
        .closeToEntity('target_away')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const targetAway = new ModEntityBuilder('target_away')
        .closeToEntity('actor_away')
        .withName('Bob Away')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      // Execute facing_away path
      testFixtureFacingAway.reset([
        room,
        chair1,
        chair2,
        actorAway,
        targetAway,
      ]);
      await testFixtureFacingAway.executeAction('actor_away', 'target_away');

      let updatedActorAway =
        testFixtureFacingAway.entityManager.getEntityInstance('actor_away');

      // Dismount
      testFixtureDismount.reset([
        room,
        chair1,
        chair2,
        updatedActorAway,
        targetAway,
      ]);
      await testFixtureDismount.executeAction('actor_away', 'target_away');

      const actorAwayAfterDismount =
        testFixtureDismount.entityManager.getEntityInstance('actor_away');
      const componentsAfterFacingAway = Object.keys(
        actorAwayAfterDismount.components
      ).sort();

      // Test facing path
      const actorFacing = new ModEntityBuilder('actor_facing')
        .withName('Alice Facing')
        .atLocation('room1')
        .closeToEntity('target_facing')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 1,
        })
        .build();

      const targetFacing = new ModEntityBuilder('target_facing')
        .closeToEntity('actor_facing')
        .withName('Bob Facing')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 1,
        })
        .build();

      // Execute facing path
      testFixtureFacing.reset([
        room,
        chair1,
        chair2,
        actorFacing,
        targetFacing,
      ]);
      await testFixtureFacing.executeAction('actor_facing', 'target_facing');

      let updatedActorFacing =
        testFixtureFacing.entityManager.getEntityInstance('actor_facing');

      // Dismount
      testFixtureDismount.reset([
        room,
        chair1,
        chair2,
        updatedActorFacing,
        targetFacing,
      ]);
      await testFixtureDismount.executeAction('actor_facing', 'target_facing');

      const actorFacingAfterDismount =
        testFixtureDismount.entityManager.getEntityInstance('actor_facing');
      const componentsAfterFacing = Object.keys(
        actorFacingAfterDismount.components
      ).sort();

      console.log(
        'Components after facing_away path:',
        componentsAfterFacingAway
      );
      console.log('Components after facing path:', componentsAfterFacing);

      // They should be identical
      expect(componentsAfterFacingAway).toEqual(componentsAfterFacing);
    });
  });
});
