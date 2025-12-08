/**
 * @file Integration tests for clothing:put_on_clothing rule execution.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import handlePutOnClothingRule from '../../../../data/mods/clothing/rules/handle_put_on_clothing.rule.json' assert { type: 'json' };
import eventIsActionPutOnClothing from '../../../../data/mods/clothing/conditions/event-is-action-put-on-clothing.condition.json' assert { type: 'json' };

describe('clothing:put_on_clothing rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:put_on_clothing',
      handlePutOnClothingRule,
      eventIsActionPutOnClothing
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('equips clothing from inventory and logs success', async () => {
    const actor = new ModEntityBuilder('actor_put_on')
      .withName('Alex')
      .asActor()
      .withComponent('clothing:equipment', { equipped: {} })
      .withComponent('items:inventory', {
        items: ['shirt1'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .atLocation('room_alpha')
      .build();

    const clothing = new ModEntityBuilder('shirt1')
      .withName('shirt')
      .withComponent('clothing:wearable', {
        layer: 'base',
        equipmentSlots: { primary: 'torso_upper' },
      })
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 1 })
      .build();

    testFixture.reset([actor, clothing]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: actor.id,
      actionId: 'clothing:put_on_clothing',
      targetId: clothing.id,
      originalInput: 'put on shirt',
    });

    const equipment = testFixture.entityManager.getComponentData(
      actor.id,
      'clothing:equipment'
    );
    expect(equipment.equipped.torso_upper.base).toBe(clothing.id);

    const inventory = testFixture.entityManager.getComponentData(
      actor.id,
      'items:inventory'
    );
    expect(inventory.items).not.toContain(clothing.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Alex puts on shirt.'
    );
    expect(perceptibleEvent.payload.targetId).toBe(clothing.id);
  });

  it('dispatches failure event when equip fails', async () => {
    const actor = new ModEntityBuilder('actor_fail_put_on')
      .withName('Blake')
      .asActor()
      .withComponent('clothing:equipment', { equipped: {} })
      .withComponent('items:inventory', {
        items: ['invalid_item'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .atLocation('room_beta')
      .build();

    const invalidClothing = new ModEntityBuilder('invalid_item')
      .withName('broken wrap')
      // Intentionally omit clothing:wearable to force equip failure
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 1 })
      .build();

    testFixture.reset([actor, invalidClothing]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: actor.id,
      actionId: 'clothing:put_on_clothing',
      targetId: invalidClothing.id,
      originalInput: 'try to wear broken wrap',
    });

    const failureEvent = testFixture.events.find(
      (e) => e.eventType === 'core:action_execution_failed'
    );
    expect(failureEvent).toBeDefined();
    expect(failureEvent.payload.reason).toBe('equip_failed');
    expect(failureEvent.payload.actorId).toBe(actor.id);
  });
});
