/**
 * @file Integration tests for the affection:brush_hand action and rule.
 * @description Tests the rule execution after the brush_hand action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import brushHandRule from '../../../../data/mods/affection/rules/brush_hand.rule.json';
import eventIsActionBrushHand from '../../../../data/mods/affection/conditions/event-is-action-brush-hand.condition.json';

describe('affection:brush_hand action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      'affection:brush_hand',
      brushHandRule,
      eventIsActionBrushHand
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes brush hand action between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toContain('hand');
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

  it('rejects the action when the actor is being hugged', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:closeness', { partners: ['target1'] })
      .withComponent('positioning:being_hugged', {
        hugging_entity_id: 'target1',
      })
      .build();

    const target = new ModEntityBuilder('target1')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:closeness', { partners: ['actor1'] })
      .build();

    testFixture.reset([room, actor, target]);

    await expect(
      testFixture.executeAction(actor.id, target.id)
    ).rejects.toThrow(/forbidden component.*positioning:being_hugged/i);
  });
});
