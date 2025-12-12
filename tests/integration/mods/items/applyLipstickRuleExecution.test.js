/**
 * @file Integration tests for the items:apply_lipstick rule.
 * @description Ensures applying lipstick dispatches the expected events and leaves the item in inventory.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import applyLipstickRule from '../../../../data/mods/items/rules/handle_apply_lipstick.rule.json' assert { type: 'json' };
import eventIsActionApplyLipstick from '../../../../data/mods/items/conditions/event-is-action-apply-lipstick.condition.json' assert { type: 'json' };

const ACTION_ID = 'items:apply_lipstick';

describe('items:apply_lipstick rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      ACTION_ID,
      applyLipstickRule,
      eventIsActionApplyLipstick
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('broadcasts the lipstick application and keeps the item in inventory', async () => {
    const room = new ModEntityBuilder('dressing-room')
      .asRoom('Dressing Room')
      .build();

    const actor = new ModEntityBuilder('actor_lipstick_user')
      .withName('Elena')
      .atLocation('dressing-room')
      .asActor()
      .withComponent('items:inventory', {
        items: ['lipstick1'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .build();

    const lipstick = new ModEntityBuilder('lipstick1')
      .withName('red lipstick')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:can_apply_lipstick', {})
      .build();

    testFixture.reset([room, actor, lipstick]);

    await testFixture.executeAction('actor_lipstick_user', 'lipstick1');

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Elena coats their lips evenly with red lipstick.'
    );
    expect(perceptibleEvent.payload.perceptionType).toBe('item.use');
    expect(perceptibleEvent.payload.actorId).toBe('actor_lipstick_user');
    expect(perceptibleEvent.payload.targetId).toBe('lipstick1');

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Elena coats their lips evenly with red lipstick.'
    );

    const turnEnded = testFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(turnEnded).toBeDefined();
    expect(turnEnded.payload.success).toBe(true);

    const actorInventory = testFixture.entityManager.getComponentData(
      'actor_lipstick_user',
      'items:inventory'
    );
    expect(actorInventory?.items).toContain('lipstick1');

    const failureEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_failed_action_result'
    );
    expect(failureEvent).toBeUndefined();
  });
});
