import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import liftOntoLapRule from '../../../../data/mods/straddling/rules/handle_lift_onto_lap_facing_away.rule.json' assert { type: 'json' };
import eventIsActionLiftOntoLap from '../../../../data/mods/straddling/conditions/event-is-action-lift-onto-lap-facing-away.condition.json' assert { type: 'json' };

describe('lift_onto_lap_facing_away - Action Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'straddling',
      'straddling:lift_onto_lap_facing_away',
      liftOntoLapRule,
      eventIsActionLiftOntoLap
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Component Manipulation', () => {
    it('should remove sitting_on component from PRIMARY target (not actor)', async () => {
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

      const updatedTarget =
        testFixture.entityManager.getEntityInstance('target1');
      expect(
        updatedTarget.components['sitting-states:sitting_on']
      ).toBeUndefined();
    });

    it('should add straddling_waist component to PRIMARY target with facing_away=true', async () => {
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

      const updatedTarget =
        testFixture.entityManager.getEntityInstance('target1');
      const straddling =
        updatedTarget.components['straddling-states:straddling_waist'];

      expect(straddling).toBeDefined();
      expect(straddling.target_id).toBe('actor1');
      expect(straddling.facing_away).toBe(true);
    });

    it('should add facing_away component to PRIMARY target', async () => {
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

      const updatedTarget =
        testFixture.entityManager.getEntityInstance('target1');
      const facingAway = updatedTarget.components['facing-states:facing_away'];

      expect(facingAway).toBeDefined();
      expect(facingAway.facing_away_from).toContain('actor1');
    });

    it('should keep ACTOR sitting_on component unchanged', async () => {
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
      const actorSitting = updatedActor.components['sitting-states:sitting_on'];

      expect(actorSitting).toBeDefined();
      expect(actorSitting.furniture_id).toBe('chair1');
      expect(actorSitting.spot_index).toBe(0);
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
        (e) => e.eventType === 'facing-states:actor_turned_back'
      );

      expect(turnedBackEvent).toBeDefined();
      expect(turnedBackEvent.payload.actor).toBe('target1');
      expect(turnedBackEvent.payload.target).toBe('actor1');
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

      expect(successEvent.payload.message).toBe(
        "Alice lifts Bob onto Alice's lap (facing away)."
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle lifting target from same furniture', async () => {
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

      const updatedTarget =
        testFixture.entityManager.getEntityInstance('target1');
      expect(
        updatedTarget.components['sitting-states:sitting_on']
      ).toBeUndefined();
      expect(
        updatedTarget.components['straddling-states:straddling_waist']
      ).toBeDefined();
      expect(updatedTarget.components['facing-states:facing_away']).toBeDefined();
    });

    it('should preserve target other components', async () => {
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

      const updatedTarget =
        testFixture.entityManager.getEntityInstance('target1');

      // Verify critical components preserved
      expect(updatedTarget.components['core:position']).toBeDefined();
      expect(updatedTarget.components['personal-space-states:closeness']).toBeDefined();
      expect(updatedTarget.components['core:actor']).toBeDefined();
    });
  });
});
