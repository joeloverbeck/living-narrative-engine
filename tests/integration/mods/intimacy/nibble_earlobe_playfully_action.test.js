/**
 * @file Integration tests for the intimacy:nibble_earlobe_playfully action and rule.
 * @description Tests the rule execution after the nibble_earlobe_playfully action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import nibbleEarlobePlayfullyRule from '../../../../data/mods/intimacy/rules/handle_nibble_earlobe_playfully.rule.json';
import eventIsActionNibbleEarlobePlayfully from '../../../../data/mods/intimacy/conditions/event-is-action-nibble-earlobe-playfully.condition.json';


describe('intimacy:nibble_earlobe_playfully action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:nibble_earlobe_playfully',
      nibbleEarlobePlayfullyRule,
      eventIsActionNibbleEarlobePlayfully
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes nibble earlobe playfully action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], { location: 'room1' });
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    testFixture.assertActionSuccess("Alice nibbles on Bob's earlobe playfully.");
  });

  it('perception log shows correct message for nibble earlobe playfully action', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], { location: 'garden' });
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    testFixture.assertPerceptibleEvent({
      descriptionText: "Sarah nibbles on James's earlobe playfully.",
      locationId: 'garden',
      actorId: scenario.actor.id,
      targetId: scenario.target.id
    });
  });

  it('handles multiple close partners correctly', async () => {
    const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob', 'Charlie'], { location: 'room1' });
    
    // First nibble Bob's earlobe
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    const perceptibleEvent1 = testFixture.events.find(e => e.eventType === 'core:perceptible_event');
    expect(perceptibleEvent1.payload.descriptionText).toBe("Alice nibbles on Bob's earlobe playfully.");
    
    // Clear events for the next test
    testFixture.clearEvents();
    
    // Then nibble Charlie's earlobe
    await testFixture.executeAction(scenario.actor.id, scenario.observers[0].id);
    
    const perceptibleEvent2 = testFixture.events.find(e => e.eventType === 'core:perceptible_event');
    expect(perceptibleEvent2.payload.descriptionText).toBe("Alice nibbles on Charlie's earlobe playfully.");
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], { location: 'room1' });
    
    // Try with a different action - manually dispatch different actionId
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:kiss_neck_sensually',
      targetId: scenario.target.id,
      originalInput: 'kiss_neck_sensually ' + scenario.target.id
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
    expect(perceptibleEvent.payload.descriptionText).toBe("Elena nibbles on Marcus's earlobe playfully.");
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
    const expectedMessage = "Diana nibbles on Victor's earlobe playfully.";
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
  });

  it('works correctly when actor is behind target', async () => {
    const scenario = testFixture.createCloseActors(['Emma', 'Liam'], { location: 'living_room' });
    
    // Add facing_away component to simulate being behind
    scenario.target.components['positioning:facing_away'] = {
      facing_away_from: [scenario.actor.id]
    };
    
    testFixture.reset([scenario.actor, scenario.target]);
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    testFixture.assertActionSuccess("Emma nibbles on Liam's earlobe playfully.");
  });
});
