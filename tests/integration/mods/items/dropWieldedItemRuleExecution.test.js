/**
 * @file Integration tests for the item-handling:drop_wielded_item action and rule.
 * @description Tests the rule execution after the drop_wielded_item action is performed.
 * This tests the specific behavior for dropping items that are currently being wielded,
 * which does NOT require a free grabbing appendage (since releasing, not grabbing).
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import dropItemRule from '../../../../data/mods/item-handling/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropWieldedItem from '../../../../data/mods/item-handling/conditions/event-is-action-drop-wielded-item.condition.json' assert { type: 'json' };

describe('item-handling:drop_wielded_item action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'item-handling',
      'item-handling:drop_wielded_item',
      dropItemRule,
      eventIsActionDropWieldedItem
    );
    // The shared rule has a composite OR condition referencing both drop_item
    // and drop_wielded_item conditions. Load the other condition for rule execution.
    await testFixture.loadDependencyConditions([
      'item-handling:event-is-action-drop-item',
    ]);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful drop wielded operations', () => {
    it('successfully drops a wielded item', async () => {
      const sword = new ModEntityBuilder('wielded-sword')
        .withName('Iron Sword')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const room = new ModEntityBuilder('tavern')
        .withName('Tavern')
        .withComponent('core:location', {})
        .build();

      const actor = new ModEntityBuilder('fighter')
        .withName('Fighter')
        .asActor()
        .withComponent('core:position', { locationId: 'tavern' })
        .withComponent('inventory:inventory', {
          items: ['wielded-sword'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['wielded-sword'],
        })
        .build();

      testFixture.reset([actor, sword, room]);

      await testFixture.executeAction('fighter', 'wielded-sword');

      // Verify item was dropped (has position at location)
      const droppedItem =
        testFixture.entityManager.getEntityInstance('wielded-sword');
      expect(droppedItem).toHaveComponent('core:position');
      expect(droppedItem).toHaveComponentData('core:position', {
        locationId: 'tavern',
      });

      // Verify item was removed from inventory
      const actorAfter = testFixture.entityManager.getEntityInstance('fighter');
      expect(actorAfter).toHaveComponentData('inventory:inventory', { items: [] });

      // Verify wielding component was removed (it was the only wielded item)
      const wieldingComponent = testFixture.entityManager.getComponentData(
        'fighter',
        'item-handling-states:wielding'
      );
      expect(wieldingComponent).toBeNull();

      expect(testFixture.events).toDispatchEvent('items-core:item_dropped');
      expect(testFixture.events).toDispatchEvent('core:turn_ended');
      expect(testFixture.events).toHaveActionSuccess(
        'Fighter drops Iron Sword.'
      );
    });

    it('drops wielded item when actor has no free grabbing appendage (two-handed weapon)', async () => {
      // This is the KEY test case - drop_wielded_item should work even without free appendage
      const greatsword = new ModEntityBuilder('greatsword')
        .withName('Greatsword')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', { twoHanded: true })
        .build();

      const room = new ModEntityBuilder('arena')
        .withName('Arena')
        .withComponent('core:location', {})
        .build();

      // Actor with two-handed weapon (no free appendages)
      const actor = new ModEntityBuilder('warrior')
        .withName('Warrior')
        .asActor()
        .withComponent('core:position', { locationId: 'arena' })
        .withComponent('inventory:inventory', {
          items: ['greatsword'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['greatsword'],
        })
        .withComponent('anatomy:can_grab', {
          appendages: [
            { id: 'left_hand', label: 'left hand', free: false },
            { id: 'right_hand', label: 'right hand', free: false },
          ],
        })
        .build();

      testFixture.reset([actor, greatsword, room]);

      // Even though actor has no free appendages, they can still DROP the wielded item
      await testFixture.executeAction('warrior', 'greatsword');

      // Verify item was dropped
      const droppedItem =
        testFixture.entityManager.getEntityInstance('greatsword');
      expect(droppedItem).toHaveComponent('core:position');
      expect(droppedItem).toHaveComponentData('core:position', {
        locationId: 'arena',
      });

      // Verify success
      expect(testFixture.events).toDispatchEvent('items-core:item_dropped');
      expect(testFixture.events).toDispatchEvent('core:turn_ended');
      expect(testFixture.events).toHaveActionSuccess(
        'Warrior drops Greatsword.'
      );
    });

    it('drops one wielded item when dual wielding', async () => {
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
  });

  describe('perception logging', () => {
    it('creates perception log entry when wielded item dropped', async () => {
      const weapon = new ModEntityBuilder('pistol')
        .withName('Pistol')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const room = new ModEntityBuilder('saloon')
        .withName('Saloon')
        .withComponent('core:location', {})
        .build();

      const actor = new ModEntityBuilder('gunslinger')
        .withName('Gunslinger')
        .asActor()
        .withComponent('core:position', { locationId: 'saloon' })
        .withComponent('inventory:inventory', {
          items: ['pistol'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['pistol'],
        })
        .build();

      testFixture.reset([actor, weapon, room]);

      await testFixture.executeAction('gunslinger', 'pistol');

      expect(testFixture.events).toDispatchEvent('core:perceptible_event');

      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent?.payload.locationId).toBe('saloon');
      expect(perceptibleEvent?.payload.perceptionType).toBe('item.drop');
      expect(perceptibleEvent?.payload.actorId).toBe('gunslinger');
      expect(perceptibleEvent?.payload.targetId).toBe('pistol');
    });

    it('includes correct description in perception log', async () => {
      const weapon = new ModEntityBuilder('rifle')
        .withName('Hunting Rifle')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const room = new ModEntityBuilder('cabin')
        .withName('Cabin')
        .withComponent('core:location', {})
        .build();

      const actor = new ModEntityBuilder('hunter')
        .withName('Hunter')
        .asActor()
        .withComponent('core:position', { locationId: 'cabin' })
        .withComponent('inventory:inventory', {
          items: ['rifle'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['rifle'],
        })
        .build();

      testFixture.reset([actor, weapon, room]);

      await testFixture.executeAction('hunter', 'rifle');

      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent?.payload.descriptionText).toContain('Hunter');
      expect(perceptibleEvent?.payload.descriptionText).toContain('drops');
      expect(perceptibleEvent?.payload.descriptionText).toContain(
        'Hunting Rifle'
      );
    });
  });

  describe('item_dropped event payload', () => {
    it('should dispatch item_dropped event with correct payload', async () => {
      const weapon = new ModEntityBuilder('axe')
        .withName('Battle Axe')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const room = new ModEntityBuilder('forge')
        .withName('Forge')
        .withComponent('core:location', {})
        .build();

      const actor = new ModEntityBuilder('blacksmith')
        .withName('Blacksmith')
        .asActor()
        .withComponent('core:position', { locationId: 'forge' })
        .withComponent('inventory:inventory', {
          items: ['axe'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['axe'],
        })
        .build();

      testFixture.reset([actor, weapon, room]);

      await testFixture.executeAction('blacksmith', 'axe');

      expect(testFixture.events).toDispatchEvent('items-core:item_dropped');

      const itemDroppedEvent = testFixture.events.find(
        (event) => event.eventType === 'items-core:item_dropped'
      );

      expect(itemDroppedEvent?.payload.actorEntity).toBe('blacksmith');
      expect(itemDroppedEvent?.payload.itemEntity).toBe('axe');
      expect(itemDroppedEvent?.payload.locationId).toBe('forge');
    });
  });

  describe('rule condition composite behavior', () => {
    it('should use the same rule as drop_item action', async () => {
      // Both drop_item and drop_wielded_item use handle_drop_item rule
      // with a composite OR condition
      expect(dropItemRule.rule_id).toBe('handle_drop_item');
      expect(dropItemRule.condition.or).toBeDefined();
      expect(dropItemRule.condition.or).toHaveLength(2);

      // Verify both conditions are referenced
      const conditionRefs = dropItemRule.condition.or.map(
        (c) => c.condition_ref
      );
      expect(conditionRefs).toContain('item-handling:event-is-action-drop-item');
      expect(conditionRefs).toContain(
        'item-handling:event-is-action-drop-wielded-item'
      );
    });
  });
});
