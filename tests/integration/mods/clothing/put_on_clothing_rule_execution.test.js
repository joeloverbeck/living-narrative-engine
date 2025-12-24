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
    const actorBuilder = new ModEntityBuilder('actor_put_on')
      .withName('Alex')
      .asActor()
      .withGrabbingHands(2)
      .withComponent('clothing:equipment', { equipped: {} })
      .withComponent('inventory:inventory', {
        items: ['shirt1'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .atLocation('room_alpha');

    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    const clothing = new ModEntityBuilder('shirt1')
      .withName('shirt')
      .withComponent('clothing:wearable', {
        layer: 'base',
        equipmentSlots: { primary: 'torso_upper' },
      })
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 1 })
      .build();

    testFixture.reset([actor, ...handEntities, clothing]);

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
      'inventory:inventory'
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
    expect(perceptibleEvent.payload.perceptionType).toBe('physical.self_action');

    const equippedEvent = testFixture.events.find(
      (e) => e.eventType === 'clothing:equipped'
    );
    expect(equippedEvent).toBeDefined();
    expect(equippedEvent.payload.clothingItemId).toBe(clothing.id);
  });

  it('relocates displaced clothing to inventory when equipping into an occupied slot', async () => {
    const actorBuilder = new ModEntityBuilder('actor_put_on_conflict')
      .withName('Casey')
      .asActor()
      .withGrabbingHands(2)
      .withComponent('clothing:equipment', {
        equipped: {
          torso_upper: { base: 'base_tunic' },
        },
      })
      .withComponent('inventory:inventory', {
        items: ['fresh_shirt'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .atLocation('room_gamma');

    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    const displacedClothing = new ModEntityBuilder('base_tunic')
      .withName('tunic')
      .withComponent('clothing:wearable', {
        layer: 'base',
        equipmentSlots: { primary: 'torso_upper' },
      })
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 1 })
      .build();

    const newClothing = new ModEntityBuilder('fresh_shirt')
      .withName('shirt')
      .withComponent('clothing:wearable', {
        layer: 'base',
        equipmentSlots: { primary: 'torso_upper' },
      })
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 1 })
      .build();

    testFixture.reset([
      actor,
      ...handEntities,
      displacedClothing,
      newClothing,
    ]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: actor.id,
      actionId: 'clothing:put_on_clothing',
      targetId: newClothing.id,
      originalInput: 'put on shirt',
    });

    const equipment = testFixture.entityManager.getComponentData(
      actor.id,
      'clothing:equipment'
    );
    expect(equipment.equipped.torso_upper.base).toBe(newClothing.id);

    const inventory = testFixture.entityManager.getComponentData(
      actor.id,
      'inventory:inventory'
    );
    expect(inventory.items).toContain(displacedClothing.id);
    expect(inventory.items).not.toContain(newClothing.id);

    const equipEvent = testFixture.events.find(
      (e) => e.eventType === 'clothing:equipped'
    );
    expect(equipEvent).toBeDefined();
    expect(equipEvent.payload.conflictResolution).toBe('auto_remove');
  });

  it('dispatches failure event when equip fails', async () => {
    const actorBuilder = new ModEntityBuilder('actor_fail_put_on')
      .withName('Blake')
      .asActor()
      .withGrabbingHands(2)
      .withComponent('clothing:equipment', { equipped: {} })
      .withComponent('inventory:inventory', {
        items: ['invalid_item'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .atLocation('room_beta');

    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    const invalidClothing = new ModEntityBuilder('invalid_item')
      .withName('broken wrap')
      // Intentionally omit clothing:wearable to force equip failure
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 1 })
      .build();

    testFixture.reset([actor, ...handEntities, invalidClothing]);

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

    const equipment = testFixture.entityManager.getComponentData(
      actor.id,
      'clothing:equipment'
    );
    expect(equipment.equipped).toEqual({});

    const inventory = testFixture.entityManager.getComponentData(
      actor.id,
      'inventory:inventory'
    );
    expect(inventory.items).toContain(invalidClothing.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeUndefined();
  });
});
