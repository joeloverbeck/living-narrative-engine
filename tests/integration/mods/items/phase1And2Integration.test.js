/**
 * @file Integration tests for Phase 1 and Phase 2 combined workflows.
 * @description Tests that give_item, drop_item, and pick_up_item work together.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import giveItemRule from '../../../../data/mods/item-transfer/rules/handle_give_item.rule.json' assert { type: 'json' };
import dropItemRule from '../../../../data/mods/items/rules/handle_drop_item.rule.json' assert { type: 'json' };
import pickUpItemRule from '../../../../data/mods/items/rules/handle_pick_up_item.rule.json' assert { type: 'json' };
import eventIsActionGiveItem from '../../../../data/mods/item-transfer/conditions/event-is-action-give-item.condition.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/items/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };
import eventIsActionPickUpItem from '../../../../data/mods/items/conditions/event-is-action-pick-up-item.condition.json' assert { type: 'json' };

describe('Items - Phase 1 and 2 Integration', () => {
  let giveFixture;
  let dropFixture;
  let pickupFixture;

  beforeEach(async () => {
    // Load all three action rules for comprehensive workflow testing
    giveFixture = await ModTestFixture.forAction(
      'item-transfer',
      'item-transfer:give_item',
      giveItemRule,
      eventIsActionGiveItem
    );
    dropFixture = await ModTestFixture.forAction(
      'items',
      'items:drop_item',
      dropItemRule,
      eventIsActionDropItem
    );
    // Load additional condition required by the rule's "or" block
    await dropFixture.loadDependencyConditions([
      'items:event-is-action-drop-wielded-item',
    ]);
    pickupFixture = await ModTestFixture.forAction(
      'items',
      'items:pick_up_item',
      pickUpItemRule,
      eventIsActionPickUpItem
    );
  });

  afterEach(() => {
    if (giveFixture) {
      giveFixture.cleanup();
    }
    if (dropFixture) {
      dropFixture.cleanup();
    }
    if (pickupFixture) {
      pickupFixture.cleanup();
    }
  });

  it('should support give, drop, and pickup in sequence', async () => {
    // Setup: Two actors with inventories
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actor1 = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();
    // Actor2 needs grabbing hands for dropping items
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
      .withComponent('items:weight', { weight: 0.05 })
      .build();

    giveFixture.reset([room, actor1, actor2, ...actor2Hands, item]);

    // Step 1: Give item from actor1 to actor2
    await giveFixture.executeAction('test:actor1', 'test:actor2', {
      additionalPayload: { secondaryId: 'letter-1' },
    });

    let actor2AfterGive = giveFixture.entityManager.getEntityInstance('test:actor2');
    expect(actor2AfterGive.components['items:inventory'].items).toContain('letter-1');

    // Step 2: Actor2 drops item (switch to drop fixture)
    let currentActor1 = giveFixture.entityManager.getEntityInstance('test:actor1');
    let currentActor2 = giveFixture.entityManager.getEntityInstance('test:actor2');
    let currentItem = giveFixture.entityManager.getEntityInstance('letter-1');
    // Include hand entities for actor2's drop action prerequisite
    const currentHands = actor2Hands.map((h) =>
      giveFixture.entityManager.getEntityInstance(h.id)
    );
    dropFixture.reset([room, currentActor1, currentActor2, ...currentHands, currentItem]);

    await dropFixture.executeAction('test:actor2', 'letter-1');

    let itemAfterDrop = dropFixture.entityManager.getEntityInstance('letter-1');
    expect(itemAfterDrop.components['core:position']).toBeDefined();
    expect(itemAfterDrop.components['core:position'].locationId).toBe('saloon1');

    // Step 3: Actor1 picks up item (switch to pickup fixture)
    currentActor1 = dropFixture.entityManager.getEntityInstance('test:actor1');
    currentActor2 = dropFixture.entityManager.getEntityInstance('test:actor2');
    currentItem = dropFixture.entityManager.getEntityInstance('letter-1');
    pickupFixture.reset([room, currentActor1, currentActor2, currentItem]);

    await pickupFixture.executeAction('test:actor1', 'letter-1');

    let actor1AfterPickup = pickupFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor1AfterPickup.components['items:inventory'].items).toContain('letter-1');

    // Verify full circle complete
    let itemFinal = pickupFixture.entityManager.getEntityInstance('letter-1');
    expect(itemFinal.components['core:position']).toBeUndefined();
  });

  it('should handle complex multi-actor item exchanges', async () => {
    // Setup: Three actors and multiple items
    const room = new ModEntityBuilder('marketplace').asRoom('Marketplace').build();
    // Actor1 needs grabbing hands for dropping items
    const actor1Builder = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('marketplace')
      .asActor()
      .withComponent('items:inventory', {
        items: ['gold-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withGrabbingHands(2);
    const actor1 = actor1Builder.build();
    const actor1Hands = actor1Builder.getHandEntities();
    const actor2 = new ModEntityBuilder('test:actor2')
      .withName('Bob')
      .atLocation('marketplace')
      .asActor()
      .withComponent('items:inventory', {
        items: ['silver-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();
    const actor3 = new ModEntityBuilder('test:actor3')
      .withName('Charlie')
      .atLocation('marketplace')
      .asActor()
      .withComponent('items:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();
    const gold = new ModEntityBuilder('gold-1')
      .withName('Gold Coin')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:weight', { weight: 0.02 })
      .build();
    const silver = new ModEntityBuilder('silver-1')
      .withName('Silver Coin')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:weight', { weight: 0.015 })
      .build();

    dropFixture.reset([room, actor1, ...actor1Hands, actor2, actor3, gold, silver]);

    // Step 1: Alice drops gold
    await dropFixture.executeAction('test:actor1', 'gold-1');

    let currentActor1 = dropFixture.entityManager.getEntityInstance('test:actor1');
    let currentActor2 = dropFixture.entityManager.getEntityInstance('test:actor2');
    let currentActor3 = dropFixture.entityManager.getEntityInstance('test:actor3');
    let currentGold = dropFixture.entityManager.getEntityInstance('gold-1');
    let currentSilver = dropFixture.entityManager.getEntityInstance('silver-1');
    // Get current state of hand entities
    const currentActor1Hands = actor1Hands.map((h) =>
      dropFixture.entityManager.getEntityInstance(h.id)
    );

    // Step 2: Bob gives silver to Charlie (switch to give fixture)
    giveFixture.reset([room, currentActor1, ...currentActor1Hands, currentActor2, currentActor3, currentGold, currentSilver]);

    await giveFixture.executeAction('test:actor2', 'test:actor3', {
      additionalPayload: { secondaryId: 'silver-1' },
    });

    currentActor1 = giveFixture.entityManager.getEntityInstance('test:actor1');
    currentActor2 = giveFixture.entityManager.getEntityInstance('test:actor2');
    currentActor3 = giveFixture.entityManager.getEntityInstance('test:actor3');
    currentGold = giveFixture.entityManager.getEntityInstance('gold-1');
    currentSilver = giveFixture.entityManager.getEntityInstance('silver-1');
    // Get current state of hand entities
    const handsAfterGive = actor1Hands.map((h) =>
      giveFixture.entityManager.getEntityInstance(h.id)
    );

    // Step 3: Charlie picks up gold from ground (switch to pickup fixture)
    pickupFixture.reset([room, currentActor1, ...handsAfterGive, currentActor2, currentActor3, currentGold, currentSilver]);

    await pickupFixture.executeAction('test:actor3', 'gold-1');

    // Verify final state
    const actor1Final = pickupFixture.entityManager.getEntityInstance('test:actor1');
    const actor2Final = pickupFixture.entityManager.getEntityInstance('test:actor2');
    const actor3Final = pickupFixture.entityManager.getEntityInstance('test:actor3');

    expect(actor1Final.components['items:inventory'].items).toEqual([]);
    expect(actor2Final.components['items:inventory'].items).toEqual([]);
    expect(actor3Final.components['items:inventory'].items).toContain('silver-1');
    expect(actor3Final.components['items:inventory'].items).toContain('gold-1');
    expect(actor3Final.components['items:inventory'].items).toHaveLength(2);
  });
});
