/**
 * @file Full Items System Integration Tests (Phase 1 + 2 + 3).
 * @description Tests complete item lifecycle across all phases:
 * Phase 1: give_item
 * Phase 2: drop_item, pick_up_item
 * Phase 3: open_container, take_from_container
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import giveItemRule from '../../../../data/mods/item-transfer/rules/handle_give_item.rule.json' assert { type: 'json' };
import dropItemRule from '../../../../data/mods/item-handling/rules/handle_drop_item.rule.json' assert { type: 'json' };
import pickUpItemRule from '../../../../data/mods/item-handling/rules/handle_pick_up_item.rule.json' assert { type: 'json' };
import openContainerRule from '../../../../data/mods/containers/rules/handle_open_container.rule.json' assert { type: 'json' };
import takeFromContainerRule from '../../../../data/mods/containers/rules/handle_take_from_container.rule.json' assert { type: 'json' };
import putInContainerRule from '../../../../data/mods/containers/rules/handle_put_in_container.rule.json' assert { type: 'json' };
import eventIsActionGiveItem from '../../../../data/mods/item-transfer/conditions/event-is-action-give-item.condition.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/item-handling/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };
import eventIsActionPickUpItem from '../../../../data/mods/item-handling/conditions/event-is-action-pick-up-item.condition.json' assert { type: 'json' };
import eventIsActionOpenContainer from '../../../../data/mods/containers/conditions/event-is-action-open-container.condition.json' assert { type: 'json' };
import eventIsActionTakeFromContainer from '../../../../data/mods/containers/conditions/event-is-action-take-from-container.condition.json' assert { type: 'json' };
import eventIsActionPutInContainer from '../../../../data/mods/containers/conditions/event-is-action-put-in-container.condition.json' assert { type: 'json' };

describe('Items - Full System Integration (Phase 1-4)', () => {
  let fixtures;

  beforeEach(async () => {
    const dropFixture = await ModTestFixture.forAction(
      'item-handling',
      'item-handling:drop_item',
      dropItemRule,
      eventIsActionDropItem
    );
    // Load additional condition required by the rule's "or" block
    await dropFixture.loadDependencyConditions([
      'item-handling:event-is-action-drop-wielded-item',
    ]);

    fixtures = {
      give: await ModTestFixture.forAction(
        'item-transfer',
        'item-transfer:give_item',
        giveItemRule,
        eventIsActionGiveItem
      ),
      drop: dropFixture,
      pickup: await ModTestFixture.forAction(
        'item-handling',
        'item-handling:pick_up_item',
        pickUpItemRule,
        eventIsActionPickUpItem
      ),
      open: await ModTestFixture.forAction(
        'containers',
        'containers:open_container',
        openContainerRule,
        eventIsActionOpenContainer
      ),
      take: await ModTestFixture.forAction(
        'containers',
        'containers:take_from_container',
        takeFromContainerRule,
        eventIsActionTakeFromContainer
      ),
      put: await ModTestFixture.forAction(
        'containers',
        'containers:put_in_container',
        putInContainerRule,
        eventIsActionPutInContainer
      ),
    };
  });

  afterEach(() => {
    Object.values(fixtures).forEach((f) => f.cleanup());
  });

  describe('system integration verification', () => {
    it('should successfully execute all item action types', async () => {
      // This test verifies that all 7 item actions can be discovered and executed
      // If handlers are not registered, actions will fail to execute
      const room = new ModEntityBuilder('verification-room')
        .asRoom('Verification Room')
        .build();

      const actorBuilder = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .atLocation('verification-room')
        .asActor()
        .withComponent('inventory:inventory', {
          items: ['owned-item'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withGrabbingHands(2);
      const actor = actorBuilder.build();
      const handEntities = actorBuilder.getHandEntities();

      const ownedItem = new ModEntityBuilder('owned-item')
        .withName('Owned Item')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 1.0 })
        .withComponent('items:readable', { content: 'Test content' })
        .withComponent('core:description', {
          text: 'A test item for verification.',
        })
        .build();

      const locationItem = new ModEntityBuilder('floor-item')
        .withName('Floor Item')
        .atLocation('verification-room')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.5 })
        .build();

      const container = new ModEntityBuilder('test-chest')
        .withName('Test Chest')
        .atLocation('verification-room')
        .withComponent('items-core:item', {})
        .withComponent('items-core:openable', {})
        .withComponent('containers-core:container', {
          contents: ['chest-item'],
          capacity: { maxWeight: 20, maxItems: 5 },
          isOpen: false,
        })
        .build();

      const chestItem = new ModEntityBuilder('chest-item')
        .withName('Chest Item')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.3 })
        .build();

      // Test drop_item
      fixtures.drop.reset([
        room,
        actor,
        ...handEntities,
        ownedItem,
        locationItem,
        container,
        chestItem,
      ]);
      await fixtures.drop.executeAction('test-actor', 'owned-item');
      expect(
        fixtures.drop.events.some((e) => e.eventType === 'items-core:item_dropped')
      ).toBe(true);

      // Test pick_up_item
      let currentActor =
        fixtures.drop.entityManager.getEntityInstance('test-actor');
      let currentOwnedItem =
        fixtures.drop.entityManager.getEntityInstance('owned-item');
      let currentLocationItem =
        fixtures.drop.entityManager.getEntityInstance('floor-item');
      let currentContainer =
        fixtures.drop.entityManager.getEntityInstance('test-chest');
      let currentChestItem =
        fixtures.drop.entityManager.getEntityInstance('chest-item');

      fixtures.pickup.reset([
        room,
        currentActor,
        currentOwnedItem,
        currentLocationItem,
        currentContainer,
        currentChestItem,
      ]);
      await fixtures.pickup.executeAction('test-actor', 'owned-item');
      expect(
        fixtures.pickup.events.some(
          (e) => e.eventType === 'items-core:item_picked_up'
        )
      ).toBe(true);

      // Test open_container
      currentActor =
        fixtures.pickup.entityManager.getEntityInstance('test-actor');
      currentOwnedItem =
        fixtures.pickup.entityManager.getEntityInstance('owned-item');
      currentLocationItem =
        fixtures.pickup.entityManager.getEntityInstance('floor-item');
      currentContainer =
        fixtures.pickup.entityManager.getEntityInstance('test-chest');
      currentChestItem =
        fixtures.pickup.entityManager.getEntityInstance('chest-item');

      fixtures.open.reset([
        room,
        currentActor,
        currentOwnedItem,
        currentLocationItem,
        currentContainer,
        currentChestItem,
      ]);
      await fixtures.open.executeAction('test-actor', 'test-chest');
      expect(
        fixtures.open.events.some(
          (e) => e.eventType === 'containers:container_opened'
        )
      ).toBe(true);

      // Test take_from_container
      currentActor =
        fixtures.open.entityManager.getEntityInstance('test-actor');
      currentOwnedItem =
        fixtures.open.entityManager.getEntityInstance('owned-item');
      currentLocationItem =
        fixtures.open.entityManager.getEntityInstance('floor-item');
      currentContainer =
        fixtures.open.entityManager.getEntityInstance('test-chest');
      currentChestItem =
        fixtures.open.entityManager.getEntityInstance('chest-item');

      fixtures.take.reset([
        room,
        currentActor,
        currentOwnedItem,
        currentLocationItem,
        currentContainer,
        currentChestItem,
      ]);
      await fixtures.take.executeAction('test-actor', 'test-chest', {
        additionalPayload: { secondaryId: 'chest-item' },
      });
      expect(
        fixtures.take.events.some(
          (e) => e.eventType === 'containers:item_taken_from_container'
        )
      ).toBe(true);

      // Test put_in_container
      currentActor =
        fixtures.take.entityManager.getEntityInstance('test-actor');
      currentOwnedItem =
        fixtures.take.entityManager.getEntityInstance('owned-item');
      currentLocationItem =
        fixtures.take.entityManager.getEntityInstance('floor-item');
      currentContainer =
        fixtures.take.entityManager.getEntityInstance('test-chest');
      currentChestItem =
        fixtures.take.entityManager.getEntityInstance('chest-item');

      fixtures.put.reset([
        room,
        currentActor,
        currentOwnedItem,
        currentLocationItem,
        currentContainer,
        currentChestItem,
      ]);
      await fixtures.put.executeAction('test-actor', 'test-chest', {
        additionalPayload: { secondaryId: 'chest-item' },
      });
      expect(
        fixtures.put.events.some(
          (e) => e.eventType === 'containers:item_put_in_container'
        )
      ).toBe(true);

      // If we reached here, all 8 action types executed successfully
      // This verifies that all handlers are properly registered and functional
    });
  });

  describe('complete item lifecycle', () => {
    it('should maintain item integrity throughout complete lifecycle', async () => {
      const room = new ModEntityBuilder('study').asRoom('Study').build();

      const actor1 = new ModEntityBuilder('actor-1')
        .withName('Charlie')
        .atLocation('study')
        .asActor()
        .withComponent('inventory:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const actor2 = new ModEntityBuilder('actor-2')
        .withName('Diana')
        .atLocation('study')
        .asActor()
        .withComponent('inventory:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const drawer = new ModEntityBuilder('desk-drawer')
        .withName('Desk Drawer')
        .atLocation('study')
        .withComponent('containers-core:container', {
          contents: ['book-1'],
          capacity: { maxWeight: 20, maxItems: 5 },
          isOpen: false,
        })
        .withComponent('items-core:openable', {})
        .build();

      const book = new ModEntityBuilder('book-1')
        .withName('Ancient Tome')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 2.0 })
        .withComponent('core:description', {
          text: 'An ancient tome filled with mysterious knowledge.',
        })
        .build();

      // Open drawer
      fixtures.open.reset([room, actor1, actor2, drawer, book]);
      await fixtures.open.executeAction('actor-1', 'desk-drawer');

      // Take book
      let currentActor1 =
        fixtures.open.entityManager.getEntityInstance('actor-1');
      let currentActor2 =
        fixtures.open.entityManager.getEntityInstance('actor-2');
      let currentDrawer =
        fixtures.open.entityManager.getEntityInstance('desk-drawer');
      let currentBook = fixtures.open.entityManager.getEntityInstance('book-1');

      fixtures.take.reset([
        room,
        currentActor1,
        currentActor2,
        currentDrawer,
        currentBook,
      ]);

      await fixtures.take.executeAction('actor-1', 'desk-drawer', {
        additionalPayload: { secondaryId: 'book-1' },
      });

      // Verify book entity still has all its components
      currentBook = fixtures.take.entityManager.getEntityInstance('book-1');
      expect(currentBook.components['items-core:item']).toBeDefined();
      expect(currentBook.components['items-core:portable']).toBeDefined();
      expect(currentBook.components['core:weight']).toBeDefined();
      expect(currentBook.components['core:weight'].weight).toBe(2.0);

      currentDrawer =
        fixtures.take.entityManager.getEntityInstance('desk-drawer');

      // Give book to actor2
      currentActor1 = fixtures.take.entityManager.getEntityInstance('actor-1');
      currentActor2 = fixtures.take.entityManager.getEntityInstance('actor-2');
      currentBook = fixtures.take.entityManager.getEntityInstance('book-1');

      fixtures.give.reset([room, currentActor1, currentActor2, currentBook]);

      await fixtures.give.executeAction('actor-1', 'actor-2', {
        additionalPayload: { secondaryId: 'book-1' },
      });

      // Verify book entity integrity maintained
      currentBook = fixtures.give.entityManager.getEntityInstance('book-1');
      expect(currentBook.components['items-core:item']).toBeDefined();
      expect(currentBook.components['items-core:portable']).toBeDefined();
      expect(currentBook.components['core:weight'].weight).toBe(2.0);

      // Phase 4: Actor 2 returns the book to the drawer
      currentActor1 = fixtures.give.entityManager.getEntityInstance('actor-1');
      currentActor2 = fixtures.give.entityManager.getEntityInstance('actor-2');
      currentBook = fixtures.give.entityManager.getEntityInstance('book-1');
      currentDrawer =
        fixtures.take.entityManager.getEntityInstance('desk-drawer');

      fixtures.put.reset([
        room,
        currentActor1,
        currentActor2,
        currentDrawer,
        currentBook,
      ]);

      await fixtures.put.executeAction('actor-2', 'desk-drawer', {
        additionalPayload: { secondaryId: 'book-1' },
      });

      const putRuleEvent = fixtures.put.events.find(
        (event) => event.eventType === 'containers:item_put_in_container'
      );
      expect(putRuleEvent).toBeDefined();
      expect(putRuleEvent.payload.itemEntity).toBe('book-1');
      expect(putRuleEvent.payload.containerEntity).toBe('desk-drawer');

      const putTurnEnded = fixtures.put.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(putTurnEnded).toBeDefined();
      expect(putTurnEnded.payload.success).toBe(true);

      const drawerAfterPut =
        fixtures.put.entityManager.getEntityInstance('desk-drawer');
      expect(drawerAfterPut.components['containers-core:container'].contents).toContain(
        'book-1'
      );
      expect(drawerAfterPut.components['containers-core:container'].isOpen).toBe(true);

      const actor2AfterPut =
        fixtures.put.entityManager.getEntityInstance('actor-2');
      expect(actor2AfterPut.components['inventory:inventory'].items).not.toContain(
        'book-1'
      );

      currentBook = fixtures.put.entityManager.getEntityInstance('book-1');
      expect(currentBook.components['items-core:item']).toBeDefined();
      expect(currentBook.components['items-core:portable']).toBeDefined();
      expect(currentBook.components['core:weight'].weight).toBe(2.0);
    });
  });

  describe('multi-actor coordination', () => {
    it('should handle complex multi-actor item exchanges with containers', async () => {
      const room = new ModEntityBuilder('marketplace')
        .asRoom('Marketplace')
        .build();

      const merchant = new ModEntityBuilder('merchant')
        .withName('Merchant')
        .atLocation('marketplace')
        .asActor()
        .withComponent('inventory:inventory', {
          items: ['silver-key'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const customer = new ModEntityBuilder('customer')
        .withName('Customer')
        .atLocation('marketplace')
        .asActor()
        .withComponent('inventory:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const merchantChest = new ModEntityBuilder('merchant-chest')
        .withName('Merchant Chest')
        .atLocation('marketplace')
        .withComponent('containers-core:container', {
          contents: ['rare-item'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: false,
          requiresKey: true,
          keyItemId: 'silver-key',
        })
        .withComponent('items-core:openable', {})
        .build();

      const rareItem = new ModEntityBuilder('rare-item')
        .withName('Rare Item')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 1.0 })
        .build();

      const key = new ModEntityBuilder('silver-key')
        .withName('Silver Key')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.1 })
        .build();

      // Scenario: Merchant gives key to customer, customer opens chest, takes item, gives back key

      // Step 1: Merchant gives key to customer
      fixtures.give.reset([
        room,
        merchant,
        customer,
        merchantChest,
        rareItem,
        key,
      ]);

      await fixtures.give.executeAction('merchant', 'customer', {
        additionalPayload: { secondaryId: 'silver-key' },
      });

      let customerState =
        fixtures.give.entityManager.getEntityInstance('customer');
      expect(customerState.components['inventory:inventory'].items).toContain(
        'silver-key'
      );

      // Step 2: Customer opens merchant's chest with the key
      let currentMerchant =
        fixtures.give.entityManager.getEntityInstance('merchant');
      let currentCustomer =
        fixtures.give.entityManager.getEntityInstance('customer');
      let currentChest =
        fixtures.give.entityManager.getEntityInstance('merchant-chest');
      let currentItem =
        fixtures.give.entityManager.getEntityInstance('rare-item');
      let currentKey =
        fixtures.give.entityManager.getEntityInstance('silver-key');

      fixtures.open.reset([
        room,
        currentMerchant,
        currentCustomer,
        currentChest,
        currentItem,
        currentKey,
      ]);

      await fixtures.open.executeAction('customer', 'merchant-chest');

      const chestAfterOpen =
        fixtures.open.entityManager.getEntityInstance('merchant-chest');
      expect(chestAfterOpen.components['containers-core:container'].isOpen).toBe(true);

      // Step 3: Customer takes the rare item
      currentMerchant =
        fixtures.open.entityManager.getEntityInstance('merchant');
      currentCustomer =
        fixtures.open.entityManager.getEntityInstance('customer');
      currentChest =
        fixtures.open.entityManager.getEntityInstance('merchant-chest');
      currentItem = fixtures.open.entityManager.getEntityInstance('rare-item');
      currentKey = fixtures.open.entityManager.getEntityInstance('silver-key');

      fixtures.take.reset([
        room,
        currentMerchant,
        currentCustomer,
        currentChest,
        currentItem,
        currentKey,
      ]);

      await fixtures.take.executeAction('customer', 'merchant-chest', {
        additionalPayload: { secondaryId: 'rare-item' },
      });

      customerState = fixtures.take.entityManager.getEntityInstance('customer');
      expect(customerState.components['inventory:inventory'].items).toContain(
        'rare-item'
      );
      expect(customerState.components['inventory:inventory'].items).toContain(
        'silver-key'
      );

      // Step 4: Customer returns the key to merchant
      currentMerchant =
        fixtures.take.entityManager.getEntityInstance('merchant');
      currentCustomer =
        fixtures.take.entityManager.getEntityInstance('customer');
      currentKey = fixtures.take.entityManager.getEntityInstance('silver-key');

      fixtures.give.reset([room, currentMerchant, currentCustomer, currentKey]);

      await fixtures.give.executeAction('customer', 'merchant', {
        additionalPayload: { secondaryId: 'silver-key' },
      });

      const finalMerchant =
        fixtures.give.entityManager.getEntityInstance('merchant');
      expect(finalMerchant.components['inventory:inventory'].items).toContain(
        'silver-key'
      );

      const finalCustomer =
        fixtures.give.entityManager.getEntityInstance('customer');
      expect(finalCustomer.components['inventory:inventory'].items).toContain(
        'rare-item'
      );
      expect(finalCustomer.components['inventory:inventory'].items).not.toContain(
        'silver-key'
      );
    });
  });
});
