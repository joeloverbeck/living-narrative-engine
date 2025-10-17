/**
 * @file Integration tests for the affection:hold_hand action and rule.
 * @description Tests the rule execution after the hold_hand action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import holdHandRule from '../../../../data/mods/affection/rules/handle_hold_hand.rule.json';
import eventIsActionHoldHand from '../../../../data/mods/affection/conditions/event-is-action-hold-hand.condition.json';

describe('affection:hold_hand action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      'affection:hold_hand',
      holdHandRule,
      eventIsActionHoldHand
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes hold hand action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'living_room',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice reaches and holds Bob's hand."
    );

    testFixture.assertPerceptibleEvent({
      descriptionText: "Alice reaches and holds Bob's hand.",
      locationId: 'living_room',
      perceptionType: 'action_target_general',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.entityId).toBe(scenario.actor.id);
    expect(turnEndedEvent.payload.success).toBe(true);

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance.components['affection:holding_hand']).toEqual({
      held_entity_id: scenario.target.id,
      initiated: true,
    });
    expect(targetInstance.components['affection:hand_held']).toEqual({
      holding_entity_id: scenario.actor.id,
      consented: true,
    });
  });

  it('formats message correctly with different names', async () => {
    const scenario = testFixture.createCloseActors(
      ['Sir Lancelot', 'Lady Guinevere'],
      {
        location: 'castle_hall',
      }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent.payload.message).toBe(
      "Sir Lancelot reaches and holds Lady Guinevere's hand."
    );
  });

  it('handles action with correct perception type', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'garden',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
    expect(perceptibleEvent.payload.locationId).toBe('garden');
  });

  it('prevents action when actor has stale hand_held component', async () => {
    const scenario = testFixture.createCloseActors(['Iris', 'Julian'], {
      location: 'sunroom',
    });

    // Actor has stale hand_held component from previous interaction
    scenario.actor.components['affection:hand_held'] = {
      holding_entity_id: 'old_partner',
      consented: false,
    };

    const room = ModEntityScenarios.createRoom('sunroom', 'Sun Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    // Action should be blocked - actor must first release their held hand
    const result = await testFixture.executeAction(
      scenario.actor.id,
      scenario.target.id
    );

    expect(result).toMatchObject({ blocked: true });

    // Verify no components were changed
    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance.components['affection:hand_held']).toEqual({
      holding_entity_id: 'old_partner',
      consented: false,
    });
    expect(actorInstance.components['affection:holding_hand']).toBeUndefined();
    expect(targetInstance.components['affection:holding_hand']).toBeUndefined();
    expect(targetInstance.components['affection:hand_held']).toBeUndefined();
  });

  it('prevents repeated attempts to hold hands while already connected', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const initialEventCount = testFixture.events.length;
    const result = await testFixture.executeAction(
      scenario.actor.id,
      scenario.target.id
    );

    expect(result).toMatchObject({ blocked: true });
    expect(testFixture.events.length).toBe(initialEventCount);

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance.components['affection:holding_hand']).toEqual({
      held_entity_id: scenario.target.id,
      initiated: true,
    });
    expect(targetInstance.components['affection:hand_held']).toEqual({
      holding_entity_id: scenario.actor.id,
      consented: true,
    });
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    // Try with a different action
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'affection:hug_tight',
      targetId: scenario.target.id,
      originalInput: 'hug_tight target',
    });

    // Should not have triggered hold_hand rule
    const holdHandEvents = testFixture.events.filter(
      (e) =>
        e.eventType === 'core:perceptible_event' &&
        e.payload.descriptionText?.includes('holds') &&
        e.payload.descriptionText?.includes('hand')
    );
    expect(holdHandEvents).toHaveLength(0);
  });

  it('generates proper perceptible event for observers', async () => {
    const scenario = testFixture.createCloseActors(['Elena', 'Marcus'], {
      location: 'bedroom',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Elena reaches and holds Marcus's hand."
    );
    expect(perceptibleEvent.payload.involvedEntities).toEqual([]);
  });

  it('validates perceptible event message matches action success message', async () => {
    const scenario = testFixture.createCloseActors(['Diana', 'Victor'], {
      location: 'library',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();

    // Both should have the same descriptive message
    const expectedMessage = "Diana reaches and holds Victor's hand.";
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
  });
});
