/**
 * @file Integration tests for the items:hug_item_for_comfort rule.
 * @description Ensures hugging comfort items dispatches expected events and validates message content.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import hugItemForComfortRule from '../../../../data/mods/items/rules/handle_hug_item_for_comfort.rule.json' assert { type: 'json' };
import eventIsActionHugItemForComfort from '../../../../data/mods/items/conditions/event-is-action-hug-item-for-comfort.condition.json' assert { type: 'json' };

const ACTION_ID = 'items:hug_item_for_comfort';

describe('items:hug_item_for_comfort rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      ACTION_ID,
      hugItemForComfortRule,
      eventIsActionHugItemForComfort
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('broadcasts the soothing hug message and validates event structure', async () => {
    const room = new ModEntityBuilder('comfort-room')
      .asRoom('Comfort Room')
      .build();

    const actor = new ModEntityBuilder('actor_hugger')
      .withName('Sam')
      .atLocation('comfort-room')
      .asActor()
      .withComponent('items:inventory', {
        items: ['plush1'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .build();

    const plushToy = new ModEntityBuilder('plush1')
      .withName('soft teddy bear')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:allows_soothing_hug', {})
      .build();

    testFixture.reset([room, actor, plushToy]);

    await testFixture.executeAction('actor_hugger', 'plush1');

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Sam hugs soft teddy bear and feels calmer.'
    );
    expect(perceptibleEvent.payload.perceptionType).toBe('item.use');
    expect(perceptibleEvent.payload.actorId).toBe('actor_hugger');
    expect(perceptibleEvent.payload.targetId).toBe('plush1');

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Sam hugs soft teddy bear and feels calmer.'
    );

    const turnEnded = testFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(turnEnded).toBeDefined();
    expect(turnEnded.payload.success).toBe(true);

    const failureEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_failed_action_result'
    );
    expect(failureEvent).toBeUndefined();
  });

  it('keeps the comfort item in inventory after hugging', async () => {
    const room = new ModEntityBuilder('living-room')
      .asRoom('Living Room')
      .build();

    const actor = new ModEntityBuilder('actor_keeper')
      .withName('Riley')
      .atLocation('living-room')
      .asActor()
      .withComponent('items:inventory', {
        items: ['pillow1'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .build();

    const comfortPillow = new ModEntityBuilder('pillow1')
      .withName('memory foam pillow')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:allows_soothing_hug', {})
      .build();

    testFixture.reset([room, actor, comfortPillow]);

    await testFixture.executeAction('actor_keeper', 'pillow1');

    const actorInventory = testFixture.entityManager.getComponentData(
      'actor_keeper',
      'items:inventory'
    );
    expect(actorInventory?.items).toContain('pillow1');
  });

  it('successfully hugs a comfort item at the location', async () => {
    const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

    const actor = new ModEntityBuilder('actor_location')
      .withName('Taylor')
      .atLocation('bedroom')
      .asActor()
      .build();

    const locationPlush = new ModEntityBuilder('location_plush')
      .withName('large plush elephant')
      .atLocation('bedroom')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:allows_soothing_hug', {})
      .build();

    testFixture.reset([room, actor, locationPlush]);

    await testFixture.executeAction('actor_location', 'location_plush');

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Taylor hugs large plush elephant and feels calmer.'
    );

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.locationId).toBe('bedroom');
  });

  it('includes correct metadata in all dispatched events', async () => {
    const room = new ModEntityBuilder('study').asRoom('Study').build();

    const actor = new ModEntityBuilder('actor_meta')
      .withName('Jordan')
      .atLocation('study')
      .asActor()
      .withComponent('items:inventory', {
        items: ['stuffed1'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .build();

    const stuffedAnimal = new ModEntityBuilder('stuffed1')
      .withName('fuzzy bunny')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:allows_soothing_hug', {})
      .build();

    testFixture.reset([room, actor, stuffedAnimal]);

    await testFixture.executeAction('actor_meta', 'stuffed1');

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.perceptionType).toBe('item.use');
    expect(perceptibleEvent.payload.locationId).toBe('study');
    expect(perceptibleEvent.payload.actorId).toBe('actor_meta');
    expect(perceptibleEvent.payload.targetId).toBe('stuffed1');

    const turnEnded = testFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(turnEnded.payload.entityId).toBe('actor_meta');
    expect(turnEnded.payload.success).toBe(true);
  });
});
