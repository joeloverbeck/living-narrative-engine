import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import sitOnLapFacingAwayRule from '../../../../data/mods/straddling/rules/handle_sit_on_lap_from_sitting_facing_away.rule.json' assert { type: 'json' };
import eventIsActionSitOnLapFacingAway from '../../../../data/mods/straddling/conditions/event-is-action-sit-on-lap-from-sitting-facing-away.condition.json' assert { type: 'json' };

describe('Sit on Lap from Sitting - Workflow Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'straddling',
      'straddling:sit_on_lap_from_sitting_facing_away',
      sitOnLapFacingAwayRule,
      eventIsActionSitOnLapFacingAway
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Complete Workflows', () => {
    it('should allow transition: both sitting -> sit on lap facing away', async () => {
      // Setup: Both actors sitting on separate chairs
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')

        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      // Execute: Actor sits on target's lap
      await testFixture.executeAction('actor1', 'target1');

      // Assert: Correct state transitions
      const updatedActor =
        testFixture.entityManager.getEntityInstance('actor1');
      const updatedTarget =
        testFixture.entityManager.getEntityInstance('target1');

      // Actor no longer sitting on furniture, now straddling target
      expect(updatedActor.components['positioning:sitting_on']).toBeUndefined();
      expect(
        updatedActor.components['positioning:straddling_waist']
      ).toBeDefined();
      expect(
        updatedActor.components['positioning:straddling_waist'].target_id
      ).toBe('target1');
      expect(
        updatedActor.components['positioning:straddling_waist'].facing_away
      ).toBe(true);
      expect(updatedActor.components['positioning:facing_away']).toBeDefined();

      // Target still sitting on original furniture
      expect(updatedTarget.components['positioning:sitting_on']).toBeDefined();
      expect(
        updatedTarget.components['positioning:sitting_on'].furniture_id
      ).toBe('chair2');
    });

    it('should handle both actors sitting on same furniture', async () => {
      // Setup: Two actors on same couch
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const couch = new ModEntityBuilder('couch1')
        .withName('Couch')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')

        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 1,
        })
        .build();

      testFixture.reset([room, couch, actor, target]);

      // Execute: One sits on the other's lap
      await testFixture.executeAction('actor1', 'target1');

      // Assert: Correct furniture spot management
      const updatedActor =
        testFixture.entityManager.getEntityInstance('actor1');
      const updatedTarget =
        testFixture.entityManager.getEntityInstance('target1');

      // Actor no longer has sitting_on (moved from spot 0)
      expect(updatedActor.components['positioning:sitting_on']).toBeUndefined();

      // Target still on same couch at same spot
      expect(updatedTarget.components['positioning:sitting_on']).toBeDefined();
      expect(
        updatedTarget.components['positioning:sitting_on'].furniture_id
      ).toBe('couch1');
      expect(
        updatedTarget.components['positioning:sitting_on'].spot_index
      ).toBe(1);

      // Actor now straddling target
      expect(
        updatedActor.components['positioning:straddling_waist']
      ).toBeDefined();
      expect(
        updatedActor.components['positioning:straddling_waist'].target_id
      ).toBe('target1');
    });
  });

  describe('State Validation', () => {
    it('should properly remove sitting_on before adding straddling_waist', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')

        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      // Using facing_away action (the one loaded in fixture)
      await testFixture.executeAction('actor1', 'target1');

      const updatedActor =
        testFixture.entityManager.getEntityInstance('actor1');

      // Should never have both components simultaneously
      expect(
        updatedActor.components['positioning:straddling_waist']
      ).toBeDefined();
      expect(updatedActor.components['positioning:sitting_on']).toBeUndefined();
    });

    it('should maintain target sitting_on throughout transition', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const targetOriginalSittingOn = {
        furniture_id: 'chair2',
        spot_index: 0,
      };

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')

        .asActor()
        .withComponent('positioning:sitting_on', targetOriginalSittingOn)
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const updatedTarget =
        testFixture.entityManager.getEntityInstance('target1');

      // Target sitting_on should be completely unchanged
      expect(updatedTarget.components['positioning:sitting_on']).toEqual(
        targetOriginalSittingOn
      );
    });
  });
});
