/**
 * @file Integration tests for the intimacy:lick_lips action and rule.
 * @description Tests the rule execution after the lick_lips action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import lickLipsRule from '../../../../data/mods/intimacy/rules/lick_lips.rule.json';
import eventIsActionLickLips from '../../../../data/mods/intimacy/conditions/event-is-action-lick-lips.condition.json';


describe('intimacy:lick_lips action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:lick_lips',
      lickLipsRule,
      eventIsActionLickLips
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes lick lips action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], { location: 'room1' });
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    testFixture.assertActionSuccess("Alice leans in and seductively licks Bob's lips.");
  });

  it('perception log shows correct message for lick lips action', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], { location: 'garden' });
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    testFixture.assertPerceptibleEvent({
      descriptionText: "Sarah leans in and seductively licks James's lips.",
      locationId: 'garden',
      actorId: scenario.actor.id,
      targetId: scenario.target.id
    });
  });

  it('handles multiple close partners correctly', async () => {
    const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob', 'Charlie'], { location: 'room1' });
    
    // First lick Bob's lips
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    const perceptibleEvent1 = testFixture.events.find(e => e.eventType === 'core:perceptible_event');
    expect(perceptibleEvent1.payload.descriptionText).toBe("Alice leans in and seductively licks Bob's lips.");
    
    // Clear events for the next test
    testFixture.clearEvents();
    
    // Then lick Charlie's lips
    await testFixture.executeAction(scenario.actor.id, scenario.observers[0].id);
    
    const perceptibleEvent2 = testFixture.events.find(e => e.eventType === 'core:perceptible_event');
    expect(perceptibleEvent2.payload.descriptionText).toBe("Alice leans in and seductively licks Charlie's lips.");
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], { location: 'room1' });
    
    // Try with a different action - manually dispatch different actionId
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:kiss_cheek',
      targetId: scenario.target.id,
      originalInput: 'kiss_cheek ' + scenario.target.id
    });
    
    // Should not have any perceptible events from our rule
    const perceptibleEvents = testFixture.events.filter(e => e.eventType === 'core:perceptible_event');
    expect(perceptibleEvents).toHaveLength(0);
  });

  it('generates proper perceptible event for observers', async () => {
    const scenario = testFixture.createCloseActors(['Elena', 'Marcus'], { location: 'bedroom' });
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    const perceptibleEvent = testFixture.events.find(e => e.eventType === 'core:perceptible_event');
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe('action_target_general');
    expect(perceptibleEvent.payload.descriptionText).toBe("Elena leans in and seductively licks Marcus's lips.");
    expect(perceptibleEvent.payload.involvedEntities).toEqual([]);
  });

  it('validates perceptible event message matches action success message', async () => {
    const scenario = testFixture.createCloseActors(['Diana', 'Victor'], { location: 'library' });
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    const successEvent = testFixture.events.find(e => e.eventType === 'core:display_successful_action_result');
    const perceptibleEvent = testFixture.events.find(e => e.eventType === 'core:perceptible_event');
    
    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();
    
    // Both should have the same descriptive message
    const expectedMessage = "Diana leans in and seductively licks Victor's lips.";
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
  });
});
