/**
 * @file Integration tests for drop and pick up workflow.
 * @description Tests the full workflow of dropping and picking up items.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import dropItemRule from '../../../../data/mods/item-handling/rules/handle_drop_item.rule.json' assert { type: 'json' };
import pickUpItemRule from '../../../../data/mods/item-handling/rules/handle_pick_up_item.rule.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/item-handling/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };
import eventIsActionPickUpItem from '../../../../data/mods/item-handling/conditions/event-is-action-pick-up-item.condition.json' assert { type: 'json' };

describe('Items - Drop and Pick Up Workflow', () => {
  let dropFixture;
  let pickupFixture;

  beforeEach(async () => {
    // Note: For workflow tests with multiple actions, we create separate fixtures
    dropFixture = await ModTestFixture.forAction(
      'items',
      'item-handling:drop_item',
      dropItemRule,
      eventIsActionDropItem
    );
    // Load additional condition required by the rule's "or" block
    await dropFixture.loadDependencyConditions([
      'item-handling:event-is-action-drop-wielded-item',
    ]);
    pickupFixture = await ModTestFixture.forAction(
      'items',
      'item-handling:pick_up_item',
      pickUpItemRule,
      eventIsActionPickUpItem
    );
  });

  afterEach(() => {
    if (dropFixture) {
      dropFixture.cleanup();
    }
    if (pickupFixture) {
      pickupFixture.cleanup();
    }
  });

  it('should complete full drop and pickup cycle between actors', async () => {
    // Setup: Two actors in same location
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actor1Builder = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withGrabbingHands(2);
    const actor1 = actor1Builder.build();
    const actor1Hands = actor1Builder.getHandEntities();
    const actor2Builder = new ModEntityBuilder('test:actor2')
      .withName('Bob')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withGrabbingHands(2);
    const actor2 = actor2Builder.build();
    const actor2Hands = actor2Builder.getHandEntities();
    const item = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.05 })
      .build();

    dropFixture.reset([
      room,
      actor1,
      ...actor1Hands,
      actor2,
      ...actor2Hands,
      item,
    ]);

    // Actor 1 drops item
    await dropFixture.executeAction('test:actor1', 'letter-1');

    let actor1After =
      dropFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor1After.components['items:inventory'].items).not.toContain(
      'letter-1'
    );

    // Verify item is at location
    let itemAfterDrop = dropFixture.entityManager.getEntityInstance('letter-1');
    expect(itemAfterDrop.components['core:position']).toBeDefined();
    expect(itemAfterDrop.components['core:position'].locationId).toBe(
      'saloon1'
    );

    // Actor 2 picks up item (switch to pickup fixture)
    const currentActor1 =
      dropFixture.entityManager.getEntityInstance('test:actor1');
    const currentActor2 =
      dropFixture.entityManager.getEntityInstance('test:actor2');
    const currentItem = dropFixture.entityManager.getEntityInstance('letter-1');
    pickupFixture.reset([room, currentActor1, currentActor2, currentItem]);

    await pickupFixture.executeAction('test:actor2', 'letter-1');

    let actor2After =
      pickupFixture.entityManager.getEntityInstance('test:actor2');
    expect(actor2After.components['items:inventory'].items).toContain(
      'letter-1'
    );

    // Verify item no longer has position
    let itemAfterPickup =
      pickupFixture.entityManager.getEntityInstance('letter-1');
    expect(itemAfterPickup.components['core:position']).toBeUndefined();
  });

  it('should handle multiple items dropped at same location', async () => {
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actorBuilder = new ModEntityBuilder('test:actor1')
      .withName('Charlie')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1', 'gun-1', 'key-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();
    const letter = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.05 })
      .build();
    const gun = new ModEntityBuilder('gun-1')
      .withName('Gun')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 1.2 })
      .build();
    const key = new ModEntityBuilder('key-1')
      .withName('Key')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.02 })
      .build();

    dropFixture.reset([room, actor, ...handEntities, letter, gun, key]);

    // Drop first two items
    await dropFixture.executeAction('test:actor1', 'letter-1');
    await dropFixture.executeAction('test:actor1', 'gun-1');

    // Verify both items at location
    const letterPos = dropFixture.entityManager.getEntityInstance('letter-1');
    const gunPos = dropFixture.entityManager.getEntityInstance('gun-1');
    expect(letterPos.components['core:position'].locationId).toBe('saloon1');
    expect(gunPos.components['core:position'].locationId).toBe('saloon1');

    // Verify third item still in inventory
    const actorAfter =
      dropFixture.entityManager.getEntityInstance('test:actor1');
    expect(actorAfter.components['items:inventory'].items).toContain('key-1');
    expect(actorAfter.components['items:inventory'].items).toHaveLength(1);
  });

  it('should create perception events for both drop and pickup', async () => {
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actorBuilder = new ModEntityBuilder('test:actor1')
      .withName('Diana')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();
    const item = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.05 })
      .build();

    dropFixture.reset([room, actor, ...handEntities, item]);

    // Drop item
    await dropFixture.executeAction('test:actor1', 'letter-1');

    // Verify drop perception event
    const dropEvent = dropFixture.events.find(
      (e) =>
        e.eventType === 'core:perceptible_event' &&
        e.payload.perceptionType === 'item_dropped'
    );
    expect(dropEvent).toBeDefined();
    expect(dropEvent.payload.locationId).toBe('saloon1');

    // Pick up item (switch to pickup fixture)
    const currentActor =
      dropFixture.entityManager.getEntityInstance('test:actor1');
    const currentItem = dropFixture.entityManager.getEntityInstance('letter-1');
    pickupFixture.reset([room, currentActor, currentItem]);

    await pickupFixture.executeAction('test:actor1', 'letter-1');

    // Verify pickup perception event
    const pickupEvent = pickupFixture.events.find(
      (e) =>
        e.eventType === 'core:perceptible_event' &&
        e.payload.perceptionType === 'item_picked_up'
    );
    expect(pickupEvent).toBeDefined();
    expect(pickupEvent.payload.locationId).toBe('saloon1');
  });
});
