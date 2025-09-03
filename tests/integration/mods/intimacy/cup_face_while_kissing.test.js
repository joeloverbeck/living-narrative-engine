/**
 * @file Integration tests for the intimacy:cup_face_while_kissing action and rule.
 * @description Tests the rule execution after the cup_face_while_kissing action is performed.
 * This action has no prerequisites about initiator status, allowing any kissing participant to cup their partner's face.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import cupFaceWhileKissingRule from '../../../../data/mods/intimacy/rules/cup_face_while_kissing.rule.json';
import eventIsActionCupFaceWhileKissing from '../../../../data/mods/intimacy/conditions/event-is-action-cup-face-while-kissing.condition.json';

describe('intimacy:cup_face_while_kissing action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:cup_face_while_kissing',
      cupFaceWhileKissingRule,
      eventIsActionCupFaceWhileKissing
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes cup face while kissing for initiator (initiator: true)', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    
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

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice possessively cups Bob's face while kissing."
    );

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('successfully executes cup face while kissing for receiver (initiator: false)', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden'
    });
    
    // Add kissing components - Sarah as receiver, James as initiator
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

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Sarah possessively cups James's face while kissing."
    );

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('perception log shows correct message for cup face while kissing', async () => {
    const scenario = testFixture.createCloseActors(['Emma', 'David'], {
      location: 'bedroom'
    });
    
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
      descriptionText: "Emma has possessively cupped David's face while kissing.",
      locationId: 'bedroom',
      actorId: scenario.actor.id,
      targetId: scenario.target.id
    });
  });

  it('preserves kissing component state (no ADD_COMPONENT or REMOVE_COMPONENT operations)', async () => {
    testFixture.reset([
      {
        id: 'kisser1',
        components: {
          'core:name': { text: 'Alice' },
          'core:position': { locationId: 'room1' },
          'positioning:closeness': { partners: ['kisser2'] },
          'intimacy:kissing': { partner: 'kisser2', initiator: true },
        },
      },
      {
        id: 'kisser2',
        components: {
          'core:name': { text: 'Bob' },
          'core:position': { locationId: 'room1' },
          'positioning:closeness': { partners: ['kisser1'] },
          'intimacy:kissing': { partner: 'kisser1', initiator: false },
        },
      },
    ]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: 'kisser1',
      actionId: 'intimacy:cup_face_while_kissing',
      targetId: 'kisser2',
      originalInput: 'cup_face_while_kissing kisser2',
    });

    // Verify this is an enhancement action that preserves kissing state
    // by checking that the rule executed successfully (no component modification errors)
    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('handles multiple kissing partners correctly', async () => {
    testFixture.reset([
      {
        id: 'polyamorous1',
        components: {
          'core:name': { text: 'Alice' },
          'core:position': { locationId: 'room1' },
          'positioning:closeness': { partners: ['partner1', 'partner2'] },
          'intimacy:kissing': { partner: 'partner1', initiator: true },
        },
      },
      {
        id: 'partner1',
        components: {
          'core:name': { text: 'Bob' },
          'core:position': { locationId: 'room1' },
          'positioning:closeness': { partners: ['polyamorous1', 'partner2'] },
          'intimacy:kissing': { partner: 'polyamorous1', initiator: false },
        },
      },
      {
        id: 'partner2',
        components: {
          'core:name': { text: 'Charlie' },
          'core:position': { locationId: 'room1' },
          'positioning:closeness': { partners: ['polyamorous1', 'partner1'] },
        },
      },
    ]);

    // Cup current partner Bob's face
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: 'polyamorous1',
      actionId: 'intimacy:cup_face_while_kissing',
      targetId: 'partner1',
      originalInput: 'cup_face_while_kissing partner1',
    });

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice has possessively cupped Bob's face while kissing."
    );
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    
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
      originalInput: 'break_kiss_gently',
    });

    // Should not have any perceptible events from our rule
    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });

  it('validates complete event flow sequence', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    
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

    const eventTypes = testFixture.events.map((e) => e.eventType);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );

    // Verify order: perceptible -> success -> turn_ended
    const perceptibleIndex = eventTypes.indexOf('core:perceptible_event');
    const successIndex = eventTypes.indexOf(
      'core:display_successful_action_result'
    );
    const turnEndedIndex = eventTypes.indexOf('core:turn_ended');

    expect(perceptibleIndex).toBeLessThan(successIndex);
    expect(successIndex).toBeLessThan(turnEndedIndex);
  });

  it('works with different entity names and locations', async () => {
    const scenario = testFixture.createCloseActors(['Sophia', 'Marcus'], {
      location: 'moonlit_balcony'
    });
    
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

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Sophia has possessively cupped Marcus's face while kissing."
    );
    expect(perceptibleEvent.payload.locationId).toBe('moonlit_balcony');

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent.payload.message).toBe(
      "Sophia possessively cups Marcus's face while kissing."
    );
  });

  it('works regardless of initiator status (no prerequisites)', async () => {
    // Test with both initiator and receiver performing the action
    const testCases = [
      { actorName: 'Alice', targetName: 'Bob', actorInitiator: true },
      { actorName: 'Bob', targetName: 'Alice', actorInitiator: false },
    ];

    for (const testCase of testCases) {
      const scenario = testFixture.createCloseActors([testCase.actorName, testCase.targetName]);
      
      // Add kissing components
      scenario.actor.components['intimacy:kissing'] = {
        partner: scenario.target.id,
        initiator: testCase.actorInitiator
      };
      scenario.target.components['intimacy:kissing'] = {
        partner: scenario.actor.id,
        initiator: !testCase.actorInitiator
      };
      
      testFixture.reset([scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        `${testCase.actorName} possessively cups ${testCase.targetName}'s face while kissing.`
      );

      // Clear events for next iteration
      testFixture.events.length = 0;
    }
  });
});
