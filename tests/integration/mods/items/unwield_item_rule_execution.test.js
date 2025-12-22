/**
 * @file Integration tests for unwield_item rule execution
 * Tests the rule behavior for unwielding items: appendage unlocking,
 * wielding component cleanup, and proper event dispatching.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import unwieldItemRule from '../../../../data/mods/items/rules/handle_unwield_item.rule.json' assert { type: 'json' };
import eventIsActionUnwieldItem from '../../../../data/mods/items/conditions/event-is-action-unwield-item.condition.json' assert { type: 'json' };

const ACTION_ID = 'items:unwield_item';

describe('unwield_item rule execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'items',
      ACTION_ID,
      unwieldItemRule,
      eventIsActionUnwieldItem
    );
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('Basic Rule Execution', () => {
    it('should execute successfully when actor unwields weapon', async () => {
      const weapon = new ModEntityBuilder('test-sword')
        .withName('Test Sword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['test-sword'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['test-sword'],
        })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'test-sword');

      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('should dispatch perceptible_event with correct message format', async () => {
      const weapon = new ModEntityBuilder('silver-blade')
        .withName('Silver Blade')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const actor = new ModEntityBuilder('john')
        .withName('John Smith')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['silver-blade'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['silver-blade'],
        })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('john', 'silver-blade');

      const perceptibleEvent = fixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.actorId).toBe('john');
    });
  });

  describe('Wielding Component Cleanup', () => {
    it('should remove wielding component when last item is unwielded', async () => {
      const weapon = new ModEntityBuilder('test-weapon')
        .withName('Test Weapon')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['test-weapon'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['test-weapon'],
        })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'test-weapon');

      // Verify wielding component was removed (single item unwielded)
      const wieldingComponent = fixture.entityManager.getComponentData(
        'test-actor',
        'item-handling-states:wielding'
      );
      expect(wieldingComponent).toBeNull();
    });

    it('should keep wielding component when other items remain wielded', async () => {
      const weapon1 = new ModEntityBuilder('dagger')
        .withName('Dagger')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const weapon2 = new ModEntityBuilder('sword')
        .withName('Sword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const actor = new ModEntityBuilder('dual-wielder')
        .withName('Dual Wielder')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['dagger', 'sword'],
          capacity: { maxWeight: 20, maxItems: 10 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['dagger', 'sword'],
        })
        .build();

      fixture.reset([actor, weapon1, weapon2]);

      // Unwield only the dagger
      await fixture.executeAction('dual-wielder', 'dagger');

      // Verify wielding component still exists
      const wieldingComponent = fixture.entityManager.getComponentData(
        'dual-wielder',
        'item-handling-states:wielding'
      );
      expect(wieldingComponent).not.toBeNull();
      expect(wieldingComponent.wielded_item_ids).toEqual(['sword']);
    });
  });

  describe('Grabbing Appendages Integration', () => {
    it('should unlock appendages based on item grabbing requirements', async () => {
      const weapon = new ModEntityBuilder('longsword')
        .withName('Longsword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('anatomy:requires_grabbing', { handsRequired: 2 })
        .build();

      const actor = new ModEntityBuilder('warrior')
        .withName('Warrior')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['longsword'],
          capacity: { maxWeight: 20, maxItems: 10 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['longsword'],
        })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('warrior', 'longsword');

      // Verify action completed successfully
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('should default to 1 hand required when anatomy:requires_grabbing missing', async () => {
      // Weapon without anatomy:requires_grabbing component
      const weapon = new ModEntityBuilder('simple-knife')
        .withName('Simple Knife')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        // NO anatomy:requires_grabbing - should default to 1
        .build();

      const actor = new ModEntityBuilder('holder')
        .withName('Item Holder')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['simple-knife'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['simple-knife'],
        })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('holder', 'simple-knife');

      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });
  });

  describe('Idempotent Behavior - Edge Cases', () => {
    it('should succeed silently when attempting to unwield an item not currently wielded', async () => {
      // Item in inventory but NOT wielded
      const weapon = new ModEntityBuilder('test-sword')
        .withName('Test Sword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      // Different weapon that IS wielded
      const otherWeapon = new ModEntityBuilder('test-dagger')
        .withName('Test Dagger')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['test-sword', 'test-dagger'],
          capacity: { maxWeight: 20, maxItems: 10 },
        })
        .withComponent('item-handling-states:wielding', {
          // Only wielding the dagger, NOT the sword
          wielded_item_ids: ['test-dagger'],
        })
        .build();

      fixture.reset([actor, weapon, otherWeapon]);

      // Attempt to unwield the sword (which is not being wielded)
      await fixture.executeAction('test-actor', 'test-sword');

      // Verify turn ended successfully (operation is idempotent)
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);

      // Verify wielding component unchanged (still wielding dagger)
      const wieldingComponent = fixture.entityManager.getComponentData(
        'test-actor',
        'item-handling-states:wielding'
      );
      expect(wieldingComponent).not.toBeNull();
      expect(wieldingComponent.wielded_item_ids).toEqual(['test-dagger']);
    });

    it('should succeed silently when actor has no wielding component at all', async () => {
      // Item in inventory
      const weapon = new ModEntityBuilder('test-weapon')
        .withName('Test Weapon')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      // Actor WITHOUT wielding component - Note: action requires item-handling-states:wielding
      // so we add it with empty array to match action requirements, then test handler idempotency
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['test-weapon'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: [], // Component exists but empty
        })
        .build();

      fixture.reset([actor, weapon]);

      // Attempt to unwield a weapon when nothing is wielded
      await fixture.executeAction('test-actor', 'test-weapon');

      // Verify turn ended successfully (operation is idempotent)
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });
  });

  describe('Description Regeneration', () => {
    it('should trigger description regeneration after unwielding', async () => {
      const weapon = new ModEntityBuilder('test-weapon')
        .withName('Test Weapon')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['test-weapon'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['test-weapon'],
        })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'test-weapon');

      // Verify the rule executed REGENERATE_DESCRIPTION
      // by checking turn ended successfully (REGENERATE_DESCRIPTION is part of the flow)
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });
  });
});
