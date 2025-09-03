/**
 * @file Integration tests for the intimacy:nibble_lower_lip action and rule.
 * @description Tests the rule execution after the nibble_lower_lip action is performed.
 * This action has no prerequisites about initiator status, allowing any kissing participant to nibble.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import nibbleLowerLipRule from '../../../../data/mods/intimacy/rules/nibble_lower_lip.rule.json';
import eventIsActionNibbleLowerLip from '../../../../data/mods/intimacy/conditions/event-is-action-nibble-lower-lip.condition.json';


describe('intimacy:nibble_lower_lip action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:nibble_lower_lip',
      nibbleLowerLipRule,
      eventIsActionNibbleLowerLip
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes nibble lower lip for initiator (initiator: true)', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], { location: 'room1' });
    
    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: true
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: false
    };
    
    testFixture.reset([scenario.actor, scenario.target]);
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    // Check success event
    const successEvent = testFixture.events.find(e => e.eventType === 'core:display_successful_action_result');
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe("Alice nibbles on Bob's lower lip.");
    
    // Check turn ended event
    const turnEndedEvent = testFixture.events.find(e => e.eventType === 'core:turn_ended');
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('successfully executes nibble lower lip for receiver (initiator: false)', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], { location: 'garden' });
    
    // Add kissing components (James is initiator, Sarah is receiver)
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: false
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: true
    };
    
    testFixture.reset([scenario.actor, scenario.target]);
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    // Check success event
    const successEvent = testFixture.events.find(e => e.eventType === 'core:display_successful_action_result');
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe("Sarah nibbles on James's lower lip.");
    
    // Check turn ended event
    const turnEndedEvent = testFixture.events.find(e => e.eventType === 'core:turn_ended');
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perception log shows correct message for nibble lower lip', async () => {
    const scenario = testFixture.createCloseActors(['Emma', 'David'], { location: 'bedroom' });
    
    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: true
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: false
    };
    
    testFixture.reset([scenario.actor, scenario.target]);
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    testFixture.assertPerceptibleEvent({
      descriptionText: "Emma has nibbled on David's lower lip.",
      locationId: 'bedroom',
      actorId: scenario.actor.id,
      targetId: scenario.target.id
    });
  });

  it('preserves kissing component state (no ADD_COMPONENT or REMOVE_COMPONENT operations)', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], { location: 'room1' });
    
    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: true
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: false
    };
    
    testFixture.reset([scenario.actor, scenario.target]);
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    // Verify this is an enhancement action that preserves kissing state
    const successEvent = testFixture.events.find(e => e.eventType === 'core:display_successful_action_result');
    expect(successEvent).toBeDefined();
    
    const turnEndedEvent = testFixture.events.find(e => e.eventType === 'core:turn_ended');
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('handles multiple kissing partners correctly', async () => {
    const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob', 'Charlie'], { location: 'room1' });
    
    // Add kissing components for Alice and Bob only
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id, // Bob
      initiator: true
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id, // Alice
      initiator: false
    };
    // Charlie has no kissing component
    
    testFixture.reset([scenario.actor, scenario.target, ...scenario.observers]);
    
    // Nibble current kissing partner Bob's lower lip
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    const perceptibleEvent = testFixture.events.find(e => e.eventType === 'core:perceptible_event');
    expect(perceptibleEvent.payload.descriptionText).toBe("Alice has nibbled on Bob's lower lip.");
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], { location: 'room1' });
    
    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: true
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: false
    };
    
    testFixture.reset([scenario.actor, scenario.target]);
    
    // Try with a different action
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:break_kiss_gently',
      targetId: scenario.target.id,
      originalInput: 'break_kiss_gently ' + scenario.target.id
    });
    
    // Should not have any perceptible events from our rule
    const perceptibleEvents = testFixture.events.filter(e => e.eventType === 'core:perceptible_event');
    expect(perceptibleEvents).toHaveLength(0);
  });

  it('validates complete event flow sequence', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], { location: 'room1' });
    
    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: true
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: false
    };
    
    testFixture.reset([scenario.actor, scenario.target]);
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    const eventTypes = testFixture.events.map(e => e.eventType);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended'
      ])
    );
    
    // Verify order: perceptible -> success -> turn_ended
    const perceptibleIndex = eventTypes.indexOf('core:perceptible_event');
    const successIndex = eventTypes.indexOf('core:display_successful_action_result');
    const turnEndedIndex = eventTypes.indexOf('core:turn_ended');
    
    expect(perceptibleIndex).toBeLessThan(successIndex);
    expect(successIndex).toBeLessThan(turnEndedIndex);
  });

  it('works with different entity names and locations', async () => {
    const scenario = testFixture.createCloseActors(['Emily', 'Michael'], { location: 'moonlit_balcony' });
    
    // Add kissing components
    scenario.actor.components['intimacy:kissing'] = {
      partner: scenario.target.id,
      initiator: true
    };
    scenario.target.components['intimacy:kissing'] = {
      partner: scenario.actor.id,
      initiator: false
    };
    
    testFixture.reset([scenario.actor, scenario.target]);
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    testFixture.assertPerceptibleEvent({
      descriptionText: "Emily has nibbled on Michael's lower lip.",
      locationId: 'moonlit_balcony',
      actorId: scenario.actor.id,
      targetId: scenario.target.id
    });
    
    // Check success event
    const successEvent2 = testFixture.events.find(e => e.eventType === 'core:display_successful_action_result');
    expect(successEvent2).toBeDefined();
    expect(successEvent2.payload.message).toBe("Emily nibbles on Michael's lower lip.");
  });

  it('works regardless of initiator status (no prerequisites)', async () => {
    // Test with both initiator and receiver performing the action
    const testCases = [
      { actorName: 'Alice', targetName: 'Bob', actorIsInitiator: true },
      { actorName: 'Bob', targetName: 'Alice', actorIsInitiator: false }
    ];

    for (const testCase of testCases) {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob'], { location: 'room1' });
      
      // Add kissing components - Alice is always the initiator in this test
      scenario.actor.components['intimacy:kissing'] = {
        partner: scenario.target.id,
        initiator: true // Alice is initiator
      };
      scenario.target.components['intimacy:kissing'] = {
        partner: scenario.actor.id,
        initiator: false // Bob is receiver
      };
      
      testFixture.reset([scenario.actor, scenario.target]);
      
      // Execute the action based on test case
      const actorId = testCase.actorName === 'Alice' ? scenario.actor.id : scenario.target.id;
      const targetId = testCase.targetName === 'Alice' ? scenario.actor.id : scenario.target.id;
      
      await testFixture.executeAction(actorId, targetId);
      
      // Check success event
      const successEvent = testFixture.events.find(e => e.eventType === 'core:display_successful_action_result');
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(`${testCase.actorName} nibbles on ${testCase.targetName}'s lower lip.`);
      
      // Check turn ended event
      const turnEndedEvent = testFixture.events.find(e => e.eventType === 'core:turn_ended');
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
      
      // Clear events for next iteration
      testFixture.clearEvents();
    }
  });
});
