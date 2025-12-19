/**
 * @file Integration tests for the affection:place_hand_on_waist action and rule.
 * @description Tests the rule execution after the place_hand_on_waist action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import placeHandOnWaistRule from '../../../../data/mods/affection/rules/place_hand_on_waist.rule.json';
import eventIsActionPlaceHandOnWaist from '../../../../data/mods/affection/conditions/event-is-action-place-hand-on-waist.condition.json';

describe('affection:place_hand_on_waist action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      'affection:place_hand_on_waist',
      placeHandOnWaistRule,
      eventIsActionPlaceHandOnWaist
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes place hand on waist action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toContain('hand');
    expect(successEvent.payload.message).toContain('waist');
  });

  it('handles multiple close actors correctly', async () => {
    const scenario = testFixture.createMultiActorScenario(
      ['Alice', 'Bob', 'Charlie'],
      {
        location: 'room1',
      }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
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
    expect(successEvent.payload.message).toBe(
      perceptibleEvent.payload.descriptionText
    );
  });

  it('rejects placing a hand on the waist while the actor is hugging someone', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('personal-space-states:closeness', { partners: ['target1'] })
      .withComponent('positioning:hugging', {
        embraced_entity_id: 'target1',
        initiated: true,
        consented: true,
      })
      .build();

    const target = new ModEntityBuilder('target1')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
      .withComponent('positioning:being_hugged', {
        hugging_entity_id: 'actor1',
        consented: true,
      })
      .build();

    testFixture.reset([room, actor, target]);

    await expect(
      testFixture.executeAction(actor.id, target.id)
    ).rejects.toThrow(/forbidden component.*positioning:hugging/i);
  });
});
