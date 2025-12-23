import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import sitOnLapFacingAwayRule from '../../../../data/mods/straddling/rules/handle_sit_on_lap_from_sitting_facing_away.rule.json' assert { type: 'json' };
import eventIsActionSitOnLapFacingAway from '../../../../data/mods/straddling/conditions/event-is-action-sit-on-lap-from-sitting-facing-away.condition.json' assert { type: 'json' };

describe('sit_on_lap_from_sitting_facing_away - Action Execution', () => {
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

  describe('Component Manipulation', () => {
    it('should remove sitting_on component from actor', async () => {
      // Setup
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

      testFixture.reset([room, chair1, chair2, actor, target]);

      // Execute
      await testFixture.executeAction('actor1', 'target1');

      // Assert
      const updatedActor =
        testFixture.entityManager.getEntityInstance('actor1');
      expect(updatedActor.components['sitting-states:sitting_on']).toBeUndefined();
    });

    it('should add straddling_waist component with facing_away=true', async () => {
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

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const updatedActor =
        testFixture.entityManager.getEntityInstance('actor1');
      expect(
        updatedActor.components['straddling-states:straddling_waist']
      ).toBeDefined();
      expect(
        updatedActor.components['straddling-states:straddling_waist'].target_id
      ).toBe('target1');
      expect(
        updatedActor.components['straddling-states:straddling_waist'].facing_away
      ).toBe(true);
    });

    it('should add facing_away component to actor', async () => {
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

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const updatedActor =
        testFixture.entityManager.getEntityInstance('actor1');
      expect(updatedActor.components['positioning:facing_away']).toBeDefined();
      expect(
        updatedActor.components['positioning:facing_away'].facing_away_from
      ).toContain('target1');
    });

    it('should keep target sitting_on component unchanged', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
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
          furniture_id: 'chair1',
          spot_index: 1,
        })
        .build();

      testFixture.reset([room, chair, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const updatedTarget =
        testFixture.entityManager.getEntityInstance('target1');
      expect(updatedTarget.components['sitting-states:sitting_on']).toBeDefined();
      expect(
        updatedTarget.components['sitting-states:sitting_on'].furniture_id
      ).toBe('chair1');
      expect(
        updatedTarget.components['sitting-states:sitting_on'].spot_index
      ).toBe(1);
    });
  });

  describe('Event Dispatching', () => {
    it('should dispatch actor_turned_back event', async () => {
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

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const turnedBackEvent = testFixture.events.find(
        (e) => e.eventType === 'positioning:actor_turned_back'
      );
      expect(turnedBackEvent).toBeDefined();
      expect(turnedBackEvent.payload.actor).toBe('actor1');
      expect(turnedBackEvent.payload.target).toBe('target1');
    });

    it('should dispatch successful action result event', async () => {
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

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
    });
  });

  describe('Output Validation', () => {
    it('should generate correct log message', async () => {
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

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        "Alice sits on Bob's lap (facing away)."
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle actor transitioning from same furniture as target', async () => {
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
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')

        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 1,
        })
        .build();

      testFixture.reset([room, couch, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const updatedActor =
        testFixture.entityManager.getEntityInstance('actor1');
      expect(updatedActor.components['sitting-states:sitting_on']).toBeUndefined();
      expect(
        updatedActor.components['straddling-states:straddling_waist']
      ).toBeDefined();
      expect(
        updatedActor.components['straddling-states:straddling_waist'].target_id
      ).toBe('target1');
    });

    it('should handle actor transitioning from different furniture', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();
      const couch = new ModEntityBuilder('couch1')
        .withName('Couch')
        .atLocation('room1')
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
          furniture_id: 'couch1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair, couch, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const updatedActor =
        testFixture.entityManager.getEntityInstance('actor1');
      expect(updatedActor.components['sitting-states:sitting_on']).toBeUndefined();
      expect(
        updatedActor.components['straddling-states:straddling_waist']
      ).toBeDefined();
    });
  });
});
