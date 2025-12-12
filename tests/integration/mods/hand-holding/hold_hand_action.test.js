/**
 * @file Integration tests for the hand-holding:hold_hand action and rule.
 * @description Tests the rule execution after the hold_hand action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import holdHandRule from '../../../../data/mods/hand-holding/rules/handle_hold_hand.rule.json';
import eventIsActionHoldHand from '../../../../data/mods/hand-holding/conditions/event-is-action-hold-hand.condition.json';

describe('hand-holding:hold_hand action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'hand-holding',
      'hand-holding:hold_hand',
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
      perceptionType: 'physical.target_action',
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

    expect(actorInstance.components['hand-holding:holding_hand']).toEqual({
      held_entity_id: scenario.target.id,
      initiated: true,
    });
    expect(targetInstance.components['hand-holding:hand_held']).toEqual({
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
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
    expect(perceptibleEvent.payload.locationId).toBe('garden');
  });

  it('prevents action when actor has stale hand_held component', async () => {
    const scenario = testFixture.createCloseActors(['Iris', 'Julian'], {
      location: 'sunroom',
    });

    // Actor has stale hand_held component from previous interaction
    scenario.actor.components['hand-holding:hand_held'] = {
      holding_entity_id: 'old_partner',
      consented: false,
    };

    const room = ModEntityScenarios.createRoom('sunroom', 'Sun Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    // Action should be blocked by validation - actor must first release their held hand
    await expect(
      testFixture.executeAction(scenario.actor.id, scenario.target.id)
    ).rejects.toThrow('forbidden component');

    // Verify no components were changed
    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance.components['hand-holding:hand_held']).toEqual({
      holding_entity_id: 'old_partner',
      consented: false,
    });
    expect(
      actorInstance.components['hand-holding:holding_hand']
    ).toBeUndefined();
    expect(
      targetInstance.components['hand-holding:holding_hand']
    ).toBeUndefined();
    expect(targetInstance.components['hand-holding:hand_held']).toBeUndefined();
  });

  it('prevents repeated attempts to hold hands while already connected', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const initialEventCount = testFixture.events.length;

    // Second attempt should be blocked by validation
    await expect(
      testFixture.executeAction(scenario.actor.id, scenario.target.id)
    ).rejects.toThrow('forbidden component');

    expect(testFixture.events.length).toBe(initialEventCount);

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance.components['hand-holding:holding_hand']).toEqual({
      held_entity_id: scenario.target.id,
      initiated: true,
    });
    expect(targetInstance.components['hand-holding:hand_held']).toEqual({
      holding_entity_id: scenario.actor.id,
      consented: true,
    });
  });

  it('prevents the action when the actor is currently hugging someone', async () => {
    const scenario = testFixture.createCloseActors(['Nora', 'Orion'], {
      location: 'conservatory',
      includeRoom: false,
    });

    scenario.actor.components['positioning:hugging'] = {
      embraced_entity_id: scenario.target.id,
      initiated: true,
    };

    const room = ModEntityScenarios.createRoom('conservatory', 'Conservatory');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await expect(
      testFixture.executeAction(scenario.actor.id, scenario.target.id)
    ).rejects.toThrow('forbidden component');

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );

    expect(actorInstance.components['positioning:hugging']).toEqual({
      embraced_entity_id: scenario.target.id,
      initiated: true,
    });
    expect(
      actorInstance.components['hand-holding:holding_hand']
    ).toBeUndefined();
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    // Try with a different action
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'hand-holding:hug_tight',
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
      'physical.target_action'
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
