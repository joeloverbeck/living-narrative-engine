/**
 * @file Integration tests for the item-handling:drop_item action and rule.
 * @description Tests the rule execution after the drop_item action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import dropItemRule from '../../../../data/mods/item-handling/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/item-handling/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };

describe('item-handling:drop_item action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'item-handling',
      'item-handling:drop_item',
      dropItemRule,
      eventIsActionDropItem
    );
    // The shared rule has a composite OR condition referencing both drop_item
    // and drop_wielded_item conditions. Load the other condition for rule execution.
    await testFixture.loadDependencyConditions([
      'item-handling:event-is-action-drop-wielded-item',
    ]);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful drop operations', () => {
    it('successfully executes drop item action', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'saloon1',
        roomName: 'Saloon',
        actor: {
          id: 'test:actor1',
          name: 'Alice',
          capacity: { maxWeight: 50, maxItems: 10 },
        },
        item: {
          id: 'letter-1',
          name: 'letter-1',
          weight: 0.05,
        },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      const actor = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actor).toHaveComponentData('inventory:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      });

      const item = testFixture.entityManager.getEntityInstance(
        scenario.item.id
      );
      expect(item).toHaveComponent('core:position');
      expect(item).toHaveComponentData('core:position', {
        locationId: scenario.room.id,
      });

      expect(testFixture.events).toDispatchEvent('inventory:item_dropped');
      expect(testFixture.events).toDispatchEvent('core:turn_ended');
      expect(testFixture.events).toHaveActionSuccess('Alice drops letter-1.');

      const itemDroppedEvent = testFixture.events.find(
        (event) => event.eventType === 'inventory:item_dropped'
      );
      expect(itemDroppedEvent?.payload.actorEntity).toBe(scenario.actor.id);
      expect(itemDroppedEvent?.payload.itemEntity).toBe(scenario.item.id);
      expect(itemDroppedEvent?.payload.locationId).toBe(scenario.room.id);
    });

    it('removes item from inventory and preserves capacity settings', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'garden',
        roomName: 'Garden',
        actor: {
          id: 'test:actor1',
          name: 'Sarah',
        },
        item: { id: 'revolver-1', name: 'revolver-1', weight: 1.2 },
        capacity: { maxWeight: 50, maxItems: 10 },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      const actor = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actor).toHaveComponentData('inventory:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      });
    });

    it('drops multiple items sequentially', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'tavern',
        roomName: 'Tavern',
        actor: {
          id: 'test:actor1',
          name: 'Bob',
        },
        item: { id: 'item1', name: 'item1', weight: 0.5 },
        additionalInventoryItems: [
          { id: 'item2', name: 'item2', weight: 0.3 },
          { id: 'item3', name: 'item3', weight: 0.2 },
        ],
        capacity: { maxWeight: 50, maxItems: 10 },
      });

      testFixture.reset([...scenario.entities]);

      const [secondItem, thirdItem] = scenario.additionalInventoryItems;

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);
      let actor = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actor).toHaveComponentData('inventory:inventory', {
        items: [secondItem.id, thirdItem.id],
      });

      let dropped = testFixture.entityManager.getEntityInstance(
        scenario.item.id
      );
      expect(dropped).toHaveComponentData('core:position', {
        locationId: scenario.room.id,
      });

      await testFixture.executeAction(scenario.actor.id, secondItem.id);
      actor = testFixture.entityManager.getEntityInstance(scenario.actor.id);
      expect(actor).toHaveComponentData('inventory:inventory', {
        items: [thirdItem.id],
      });

      dropped = testFixture.entityManager.getEntityInstance(secondItem.id);
      expect(dropped).toHaveComponentData('core:position', {
        locationId: scenario.room.id,
      });

      await testFixture.executeAction(scenario.actor.id, thirdItem.id);
      actor = testFixture.entityManager.getEntityInstance(scenario.actor.id);
      expect(actor).toHaveComponentData('inventory:inventory', {
        items: [],
      });

      dropped = testFixture.entityManager.getEntityInstance(thirdItem.id);
      expect(dropped).toHaveComponentData('core:position', {
        locationId: scenario.room.id,
      });
    });
  });

  describe('perception logging', () => {
    it('creates perception log entry when item dropped', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'saloon1',
        roomName: 'Saloon',
        actor: { id: 'test:actor1', name: 'Alice' },
        item: { id: 'letter-1', name: 'letter-1', weight: 0.05 },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      expect(testFixture.events).toDispatchEvent('core:perceptible_event');

      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent?.payload.locationId).toBe(scenario.room.id);
      expect(perceptibleEvent?.payload.perceptionType).toBe('item.drop');
      expect(perceptibleEvent?.payload.actorId).toBe(scenario.actor.id);
      expect(perceptibleEvent?.payload.targetId).toBe(scenario.item.id);
      expect(perceptibleEvent?.payload.involvedEntities).toEqual([]);
    });

    it('includes correct description in perception log', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'kitchen',
        roomName: 'Kitchen',
        actor: { id: 'test:actor1', name: 'Charlie' },
        item: { id: 'golden-watch', name: 'golden-watch', weight: 0.1 },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent?.payload.descriptionText).toContain('Charlie');
      expect(perceptibleEvent?.payload.descriptionText).toContain('drops');
      expect(perceptibleEvent?.payload.descriptionText).toContain(
        'golden-watch'
      );
    });

    it('includes sense-aware perspective fields in perception log', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'tavern',
        roomName: 'Tavern',
        actor: { id: 'test:actor1', name: 'Dave' },
        item: { id: 'old-key', name: 'old-key', weight: 0.02 },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();

      // Verify perspective-aware actor description (first-person)
      expect(perceptibleEvent?.payload.actorDescription).toBe(
        'I drop old-key.'
      );

      // Verify alternate descriptions for different senses
      expect(perceptibleEvent?.payload.alternateDescriptions).toBeDefined();
      expect(perceptibleEvent?.payload.alternateDescriptions.auditory).toBe(
        'I hear something drop to the ground nearby.'
      );
      expect(perceptibleEvent?.payload.alternateDescriptions.tactile).toBe(
        'I sense a faint vibration as something hits the ground nearby.'
      );
    });
  });

  describe('error scenarios', () => {
    it('handles error when item not in inventory', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'saloon1',
        roomName: 'Saloon',
        actor: {
          id: 'test:actor1',
          name: 'Alice',
          inventoryOverrides: { items: [] },
        },
        item: { id: 'not-in-inventory', name: 'NotInInventory', weight: 0.5 },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      expect(testFixture.events).toDispatchEvent('core:turn_ended');

      const actor = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actor).toHaveComponentData('inventory:inventory', { items: [] });
    });
  });

  describe('Drop Item - Wielded Items', () => {
    it('should unwield item before dropping when item is wielded', async () => {
      const weapon = new ModEntityBuilder('test-sword')
        .withName('Test Sword')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const room = new ModEntityBuilder('tavern')
        .withName('Tavern')
        .withComponent('core:location', {})
        .build();

      const actor = new ModEntityBuilder('test-actor')
        .withName('Fighter')
        .asActor()
        .withComponent('core:position', { locationId: 'tavern' })
        .withComponent('inventory:inventory', {
          items: ['test-sword'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['test-sword'],
        })
        .build();

      testFixture.reset([actor, weapon, room]);

      await testFixture.executeAction('test-actor', 'test-sword');

      // Verify item was dropped (has position at location)
      const item = testFixture.entityManager.getEntityInstance('test-sword');
      expect(item).toHaveComponent('core:position');
      expect(item).toHaveComponentData('core:position', {
        locationId: 'tavern',
      });

      // Verify item was removed from inventory
      const actorAfter =
        testFixture.entityManager.getEntityInstance('test-actor');
      expect(actorAfter).toHaveComponentData('inventory:inventory', { items: [] });

      // Verify wielding component was removed (since it was the only wielded item)
      const wieldingComponent = testFixture.entityManager.getComponentData(
        'test-actor',
        'item-handling-states:wielding'
      );
      expect(wieldingComponent).toBeNull();

      expect(testFixture.events).toDispatchEvent('core:turn_ended');
    });

    it('should handle dropping wielded item when actor has multiple wielded items', async () => {
      const sword = new ModEntityBuilder('sword')
        .withName('Sword')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const dagger = new ModEntityBuilder('dagger')
        .withName('Dagger')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const room = new ModEntityBuilder('arena')
        .withName('Arena')
        .withComponent('core:location', {})
        .build();

      const actor = new ModEntityBuilder('dual-wielder')
        .withName('Dual Wielder')
        .asActor()
        .withComponent('core:position', { locationId: 'arena' })
        .withComponent('inventory:inventory', {
          items: ['sword', 'dagger'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['sword', 'dagger'],
        })
        .build();

      testFixture.reset([actor, sword, dagger, room]);

      // Drop only the sword
      await testFixture.executeAction('dual-wielder', 'sword');

      // Verify sword was dropped
      const droppedSword = testFixture.entityManager.getEntityInstance('sword');
      expect(droppedSword).toHaveComponent('core:position');
      expect(droppedSword).toHaveComponentData('core:position', {
        locationId: 'arena',
      });

      // Verify sword removed from inventory, but dagger remains
      const actorAfter =
        testFixture.entityManager.getEntityInstance('dual-wielder');
      expect(actorAfter).toHaveComponentData('inventory:inventory', {
        items: ['dagger'],
      });

      // Verify wielding component still exists with just the dagger
      const wieldingComponent = testFixture.entityManager.getComponentData(
        'dual-wielder',
        'item-handling-states:wielding'
      );
      expect(wieldingComponent).not.toBeNull();
      expect(wieldingComponent.wielded_item_ids).toEqual(['dagger']);

      expect(testFixture.events).toDispatchEvent('core:turn_ended');
    });

    it('should handle dropping non-wielded item when actor has wielded items (idempotent)', async () => {
      const wielded = new ModEntityBuilder('wielded-sword')
        .withName('Wielded Sword')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const notWielded = new ModEntityBuilder('potion')
        .withName('Healing Potion')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .build();

      const room = new ModEntityBuilder('camp')
        .withName('Camp')
        .withComponent('core:location', {})
        .build();

      const actor = new ModEntityBuilder('adventurer')
        .withName('Adventurer')
        .asActor()
        .withComponent('core:position', { locationId: 'camp' })
        .withComponent('inventory:inventory', {
          items: ['wielded-sword', 'potion'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['wielded-sword'],
        })
        .build();

      testFixture.reset([actor, wielded, notWielded, room]);

      // Drop the potion (not wielded)
      await testFixture.executeAction('adventurer', 'potion');

      // Verify potion was dropped
      const droppedPotion =
        testFixture.entityManager.getEntityInstance('potion');
      expect(droppedPotion).toHaveComponent('core:position');
      expect(droppedPotion).toHaveComponentData('core:position', {
        locationId: 'camp',
      });

      // Verify potion removed from inventory, but sword remains
      const actorAfter =
        testFixture.entityManager.getEntityInstance('adventurer');
      expect(actorAfter).toHaveComponentData('inventory:inventory', {
        items: ['wielded-sword'],
      });

      // Verify wielding component still exists unchanged
      const wieldingComponent = testFixture.entityManager.getComponentData(
        'adventurer',
        'item-handling-states:wielding'
      );
      expect(wieldingComponent).not.toBeNull();
      expect(wieldingComponent.wielded_item_ids).toEqual(['wielded-sword']);

      expect(testFixture.events).toDispatchEvent('core:turn_ended');
    });
  });

  describe('Drop Item - Additional Edge Cases', () => {
    it('should handle dropping last item from inventory', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'saloon1',
        roomName: 'Saloon',
        actor: {
          id: 'test:actor1',
          name: 'Alice',
          capacity: { maxWeight: 50, maxItems: 10 },
        },
        item: { id: 'item-1', name: 'item-1', weight: 0.5 },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      const actorAfter = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actorAfter).toHaveComponentData('inventory:inventory', { items: [] });
    });

    it('should create position component with correct locationId', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'tavern',
        roomName: 'Tavern',
        actor: { id: 'test:actor1', name: 'Bob' },
        item: { id: 'letter-1', name: 'Letter', weight: 0.05 },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      const itemAfter = testFixture.entityManager.getEntityInstance(
        scenario.item.id
      );
      expect(itemAfter).toHaveComponent('core:position');
      expect(itemAfter).toHaveComponentData('core:position', {
        locationId: scenario.room.id,
      });
    });
  });
});
