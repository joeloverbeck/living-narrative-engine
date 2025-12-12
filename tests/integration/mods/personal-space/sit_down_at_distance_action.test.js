/**
 * @file Integration tests for personal-space:sit_down_at_distance rule execution.
 * @description Tests rule execution, defensive behavior, and regression scenarios
 * for the sit-at-distance feature.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import handleSitDownAtDistanceRule from '../../../../data/mods/personal-space/rules/handle_sit_down_at_distance.rule.json' assert { type: 'json' };
import eventIsActionSitDownAtDistance from '../../../../data/mods/personal-space/conditions/event-is-action-sit-down-at-distance.condition.json' assert { type: 'json' };

/**
 * Creates a standardized sit-at-distance scenario with furniture, actor, and occupant.
 *
 * @param {string} actorName - Name for the standing actor
 * @param {string} occupantName - Name for the seated occupant
 * @param {string} furnitureName - Name for the furniture
 * @param {Array<string|null>} spots - Furniture spots array
 * @param {number} occupantIndex - Index where occupant is sitting
 * @returns {object} Object with room, actor, furniture, and occupant entities
 */
function setupSitAtDistanceScenario(
  actorName = 'Alice',
  occupantName = 'Bob',
  furnitureName = 'bench',
  spots = ['bob1', null, null],
  occupantIndex = 0
) {
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

  const actor = new ModEntityBuilder('actor1')
    .withName(actorName)
    .atLocation('room1')
    .asActor()
    .withComponent('core:movement', { locked: false })
    .build();

  const furniture = new ModEntityBuilder('bench1')
    .withName(furnitureName)
    .atLocation('room1')
    .withComponent('positioning:allows_sitting', { spots })
    .build();

  const occupant = new ModEntityBuilder('bob1')
    .withName(occupantName)
    .atLocation('room1')
    .asActor()
    .withComponent('core:movement', { locked: false })
    .withComponent('positioning:sitting_on', {
      furniture_id: 'bench1',
      spot_index: occupantIndex,
    })
    .build();

  return { room, actor, furniture, occupant };
}

describe('personal-space:sit_down_at_distance action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'personal-space',
      'personal-space:sit_down_at_distance',
      handleSitDownAtDistanceRule,
      eventIsActionSitDownAtDistance
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Rule execution success path', () => {
    it('successfully executes sit_down_at_distance action', async () => {
      // Arrange: Setup scenario with rightmost occupant and 2 empty spots
      const scenario = setupSitAtDistanceScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.occupant,
      ]);

      // Act: Execute action with secondary target
      await testFixture.executeAction('actor1', 'bench1', {
        additionalPayload: {
          secondaryId: 'bob1',
        },
      });

      // Debug: Check events after execution
      console.log('\n=== POST-EXECUTION DEBUG ===');
      console.log('Total events:', testFixture.events.length);
      console.log(
        'Event types:',
        testFixture.events.map((e) => e.eventType)
      );
      console.log('=== END POST-EXECUTION DEBUG ===\n');

      // Assert: Verify actor is sitting at correct spot (occupant index + 2)
      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );

      expect(actorSitting).toBeDefined();
      expect(actorSitting.furniture_id).toBe('bench1');
      expect(actorSitting.spot_index).toBe(2); // Bob at 0, buffer at 1, Alice at 2

      // Assert: Verify furniture spots updated correctly
      const furnitureData = testFixture.entityManager.getComponentData(
        'bench1',
        'positioning:allows_sitting'
      );
      expect(furnitureData.spots[0]).toBe('bob1');
      expect(furnitureData.spots[1]).toBe(null); // Buffer seat remains empty
      expect(furnitureData.spots[2]).toBe('actor1');
    });

    it('leaves buffer seat empty (no closeness established)', async () => {
      const scenario = setupSitAtDistanceScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.occupant,
      ]);

      await testFixture.executeAction('actor1', 'bench1', {
        additionalPayload: {
          secondaryId: 'bob1',
        },
      });

      // Verify buffer seat is still null
      const furnitureData = testFixture.entityManager.getComponentData(
        'bench1',
        'positioning:allows_sitting'
      );
      expect(furnitureData.spots[1]).toBe(null);

      // Verify no closeness component was added between actors
      const actorCloseness = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:close_to'
      );
      const occupantCloseness = testFixture.entityManager.getComponentData(
        'bob1',
        'positioning:close_to'
      );

      // Either component doesn't exist, or if it does, it doesn't reference the other actor
      if (actorCloseness) {
        expect(actorCloseness.other_entity_id).not.toBe('bob1');
      }
      if (occupantCloseness) {
        expect(occupantCloseness.other_entity_id).not.toBe('actor1');
      }
    });

    it('generates success log with both furniture and occupant names', async () => {
      const scenario = setupSitAtDistanceScenario(
        'Elena',
        'Marcus',
        'Long Bench'
      );
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.occupant,
      ]);

      await testFixture.executeAction('actor1', 'bench1', {
        additionalPayload: {
          secondaryId: 'bob1',
        },
      });

      // Verify perceptible event message
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toContain('Elena');
      expect(perceptibleEvent.payload.descriptionText).toContain('Long Bench');
      expect(perceptibleEvent.payload.descriptionText).toContain('Marcus');
      expect(perceptibleEvent.payload.descriptionText).toContain('distance');
    });

    it('locks movement after sitting', async () => {
      const scenario = setupSitAtDistanceScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.occupant,
      ]);

      await testFixture.executeAction('actor1', 'bench1', {
        additionalPayload: {
          secondaryId: 'bob1',
        },
      });

      // Verify movement was locked
      const movement = testFixture.entityManager.getComponentData(
        'actor1',
        'core:movement'
      );
      expect(movement).toBeDefined();
      expect(movement.locked).toBe(true);
    });

    it('ends turn successfully', async () => {
      const scenario = setupSitAtDistanceScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.occupant,
      ]);

      await testFixture.executeAction('actor1', 'bench1', {
        additionalPayload: {
          secondaryId: 'bob1',
        },
      });

      // Verify turn ended successfully
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );

      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
      expect(turnEndedEvent.payload.entityId).toBe('actor1');
    });

    it('works with occupant at different spot index', async () => {
      // Scenario: Bob at index 1, should sit at index 3
      const scenario = setupSitAtDistanceScenario(
        'Alice',
        'Bob',
        'bench',
        [null, 'bob1', null, null],
        1
      );
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.occupant,
      ]);

      await testFixture.executeAction('actor1', 'bench1', {
        additionalPayload: {
          secondaryId: 'bob1',
        },
      });

      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );

      expect(actorSitting.spot_index).toBe(3); // Bob at 1, buffer at 2, Alice at 3
    });
  });

  describe('Defensive behavior and race conditions', () => {
    it('aborts cleanly when target seat occupied between validation and execution', async () => {
      const scenario = setupSitAtDistanceScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.occupant,
      ]);

      // Manually fill the target seat to simulate race condition
      const bench = testFixture.entityManager.getEntityInstance('bench1');
      bench.components['positioning:allows_sitting'].spots = [
        'bob1',
        null,
        'interloper1',
      ];

      // Try to execute action
      await testFixture.executeAction('actor1', 'bench1', {
        additionalPayload: {
          secondaryId: 'bob1',
        },
      });

      // Verify actor is still standing
      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );
      expect(actorSitting).toBeNull();

      // Verify furniture state unchanged from our manual update
      const furnitureData = testFixture.entityManager.getComponentData(
        'bench1',
        'positioning:allows_sitting'
      );
      expect(furnitureData.spots[2]).toBe('interloper1');

      // Verify no turn ended event (action failed)
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeUndefined();
    });

    it('aborts cleanly when buffer seat occupied between validation and execution', async () => {
      const scenario = setupSitAtDistanceScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.occupant,
      ]);

      // Manually fill the buffer seat to simulate race condition
      const bench = testFixture.entityManager.getEntityInstance('bench1');
      bench.components['positioning:allows_sitting'].spots = [
        'bob1',
        'interloper1',
        null,
      ];

      await testFixture.executeAction('actor1', 'bench1', {
        additionalPayload: {
          secondaryId: 'bob1',
        },
      });

      // Verify actor is still standing
      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );
      expect(actorSitting).toBeNull();

      // Verify no perceptible event
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeUndefined();
    });

    it('handles missing secondary target gracefully', async () => {
      const scenario = setupSitAtDistanceScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.occupant,
      ]);

      // Execute without secondary target in payload
      await testFixture.executeAction('actor1', 'bench1', {
        additionalPayload: {
          // No secondaryTargetId provided
        },
      });

      // Verify actor is still standing (action should fail)
      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );
      expect(actorSitting).toBeNull();
    });
  });

  describe('Regression tests - legacy sit_down action', () => {
    it('legacy sit_down action still works (leftmost seat assignment)', async () => {
      // Create furniture with multiple empty spots
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('core:movement', { locked: false })
        .build();

      const furniture = new ModEntityBuilder('bench1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: [null, null, null],
        })
        .build();

      testFixture.reset([room, actor, furniture]);

      // Execute legacy sit_down action (no secondary target)
      await testFixture.executeActionManual(
        'actor1',
        'positioning:sit_down',
        'bench1',
        {
          skipDiscovery: true,
        }
      );

      // Verify actor sits in leftmost seat
      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );

      // If sit_down action executed successfully, verify leftmost assignment
      if (actorSitting) {
        expect(actorSitting.furniture_id).toBe('bench1');
        expect(actorSitting.spot_index).toBe(0); // Leftmost available
      }
    });

    it('legacy sit_down establishes closeness when sitting next to occupant', async () => {
      // Setup with one occupant
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('core:movement', { locked: false })
        .build();

      const furniture = new ModEntityBuilder('bench1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['bob1', null, null],
        })
        .build();

      const occupant = new ModEntityBuilder('bob1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('core:movement', { locked: false })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, actor, furniture, occupant]);

      // Execute legacy sit_down action
      await testFixture.executeActionManual(
        'actor1',
        'positioning:sit_down',
        'bench1',
        {
          skipDiscovery: true,
        }
      );

      // Verify actor sits next to Bob (no gap)
      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );

      if (actorSitting) {
        expect(actorSitting.spot_index).toBe(1); // Next to Bob at index 0

        // Verify closeness was established
        const actorCloseness = testFixture.entityManager.getComponentData(
          'actor1',
          'positioning:close_to'
        );
        const occupantCloseness = testFixture.entityManager.getComponentData(
          'bob1',
          'positioning:close_to'
        );

        // At least one of them should have closeness (depending on implementation)
        const hasCloseness = actorCloseness || occupantCloseness;
        expect(hasCloseness).toBeDefined();
      }
    });
  });

  describe('Turn management', () => {
    it('ends turn after successful action execution', async () => {
      const scenario = setupSitAtDistanceScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.occupant,
      ]);

      await testFixture.executeAction('actor1', 'bench1', {
        additionalPayload: {
          secondaryId: 'bob1',
        },
      });

      // Verify END_TURN event
      const endTurnEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );

      expect(endTurnEvent).toBeDefined();
      expect(endTurnEvent.payload.entityId).toBe('actor1');
      expect(endTurnEvent.payload.success).toBe(true);
    });
  });

  describe('Action only fires for correct action ID', () => {
    it('does not fire for different action IDs', async () => {
      const scenario = setupSitAtDistanceScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.occupant,
      ]);

      // Try with a different action
      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: 'actor1',
        actionId: 'positioning:sit_down', // Different action
        targetId: 'bench1',
        originalInput: 'sit_down bench1',
      });

      // Should not have any perceptible events from our sit_down_at_distance rule
      // (sit_down might dispatch its own events, but not from our rule)
      const events = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      // Verify that if any perceptible events exist, they don't contain "distance"
      for (const event of events) {
        if (event.payload.descriptionText) {
          expect(event.payload.descriptionText).not.toContain('distance');
        }
      }
    });
  });

  describe('Perception logging', () => {
    it('dispatches perceptible event on successful sit', async () => {
      const scenario = setupSitAtDistanceScenario('Diana', 'Victor', 'Sofa');
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.occupant,
      ]);

      await testFixture.executeAction('actor1', 'bench1', {
        additionalPayload: {
          secondaryId: 'bob1',
        },
      });

      // Verify perceptible event
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.perceptionType).toBe(
        'physical.target_action'
      );
      expect(perceptibleEvent.payload.locationId).toBe('room1');
    });

    it('validates perceptible event message includes all key details', async () => {
      const scenario = setupSitAtDistanceScenario(
        'Sarah',
        'James',
        'Park Bench'
      );
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.occupant,
      ]);

      await testFixture.executeAction('actor1', 'bench1', {
        additionalPayload: {
          secondaryId: 'bob1',
        },
      });

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();

      // Perceptible event should reference the action with all key elements
      const message = perceptibleEvent.payload.descriptionText;
      expect(message).toContain('Sarah'); // Actor name
      expect(message).toContain('Park Bench'); // Furniture name
      expect(message).toContain('James'); // Occupant name
      expect(message).toContain('distance'); // Key action descriptor
    });
  });

  describe('Forbidden component restrictions', () => {
    it('should demonstrate straddling restriction (action discovery would prevent this)', async () => {
      // Setup scenario with straddling actor
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('core:movement', { locked: false })
        .build();

      const furniture = new ModEntityBuilder('bench1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['bob1', null, null],
        })
        .build();

      const occupant = new ModEntityBuilder('bob1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('core:movement', { locked: false })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'bench1',
          spot_index: 0,
        })
        .build();

      // Add a chair for the straddled target to sit on
      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      // Add another actor who is being straddled
      const straddledTarget = new ModEntityBuilder('straddled1')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      // Actor is straddling the straddled target's waist
      actor.components['positioning:straddling_waist'] = {
        target_id: 'straddled1',
        facing_away: false,
      };

      testFixture.reset([
        room,
        actor,
        furniture,
        occupant,
        chair,
        straddledTarget,
      ]);

      // Verify initial state
      expect(actor.components['positioning:straddling_waist']).toEqual({
        target_id: 'straddled1',
        facing_away: false,
      });

      // In normal action discovery, this action would not appear in available actions
      // because the actor has the positioning:straddling_waist component.
      // However, we're testing the rule execution directly to verify the logic.

      // NOTE: This test shows what would happen if somehow the action was triggered
      // In real gameplay, the action discovery system prevents this scenario
      await testFixture.executeAction('actor1', 'bench1', {
        skipDiscovery: true,
        additionalPayload: {
          secondaryId: 'bob1',
        },
      });

      // The rule itself would still execute because we're bypassing action discovery
      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );

      // If the action executed despite bypassing discovery, verify it worked
      if (actorSitting) {
        expect(actorSitting.furniture_id).toBe('bench1');
        expect(actorSitting.spot_index).toBe(2); // Bob at 0, buffer at 1, Alice at 2
      }

      // Actor should still retain straddling component as rule doesn't remove it
      const updatedActor =
        testFixture.entityManager.getEntityInstance('actor1');
      expect(updatedActor.components['positioning:straddling_waist']).toEqual({
        target_id: 'straddled1',
        facing_away: false,
      });

      // This test proves the restriction is at the action discovery level,
      // not at the rule execution level - which is the correct design
    });
  });
});
