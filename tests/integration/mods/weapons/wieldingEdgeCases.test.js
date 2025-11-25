/**
 * @file Edge case tests for wielding system at integration level
 * Tests boundary conditions and unusual scenarios for the wielding component.
 * @see specs/wielding-component.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import wieldThreateninglyRule from '../../../../data/mods/weapons/rules/handle_wield_threateningly.rule.json' assert { type: 'json' };
import eventIsActionWieldThreateningly from '../../../../data/mods/weapons/conditions/event-is-action-wield-threateningly.condition.json' assert { type: 'json' };

const ACTION_ID = 'weapons:wield_threateningly';

describe('Wielding Edge Cases', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'weapons',
      ACTION_ID,
      wieldThreateninglyRule,
      eventIsActionWieldThreateningly
    );
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('Empty Array Handling', () => {
    it('should handle component with empty wielded_item_ids array without crashing', async () => {
      // Arrange: Actor with wielding component but empty array
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['dagger-id'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: [], // Empty array - valid but edge case
        })
        .build();

      const dagger = new ModEntityBuilder('dagger-id')
        .withName('Dagger')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, dagger]);

      // Act - wield a weapon to an existing but empty component
      await fixture.executeAction('test-actor', 'dagger-id');

      // Assert - should append to the empty array
      const wieldingComponent = fixture.entityManager.getComponent(
        'test-actor',
        'positioning:wielding'
      );
      expect(wieldingComponent).toBeDefined();
      expect(wieldingComponent.wielded_item_ids).toContain('dagger-id');
    });
  });

  describe('Namespaced ID Handling', () => {
    it('should handle namespaced weapon IDs correctly', async () => {
      // Arrange: Actor with namespaced weapon ID
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['weapons:silver_revolver'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('weapons:silver_revolver')
        .withName('Silver Revolver')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, weapon]);

      // Act
      await fixture.executeAction('test-actor', 'weapons:silver_revolver');

      // Assert
      const wieldingComponent = fixture.entityManager.getComponent(
        'test-actor',
        'positioning:wielding'
      );
      expect(wieldingComponent).toBeDefined();
      expect(wieldingComponent.wielded_item_ids).toEqual(['weapons:silver_revolver']);
    });

    it('should handle mixed namespaced and simple IDs', async () => {
      // Arrange: Actor with one weapon already wielded (namespaced), wielding another (simple)
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['weapons:silver_revolver', 'dagger-1'],
          capacity: { maxWeight: 20, maxItems: 10 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['weapons:silver_revolver'],
        })
        .build();

      const revolver = new ModEntityBuilder('weapons:silver_revolver')
        .withName('Silver Revolver')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const dagger = new ModEntityBuilder('dagger-1')
        .withName('Dagger')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, revolver, dagger]);

      // Act
      await fixture.executeAction('test-actor', 'dagger-1');

      // Assert
      const wieldingComponent = fixture.entityManager.getComponent(
        'test-actor',
        'positioning:wielding'
      );
      expect(wieldingComponent.wielded_item_ids).toEqual([
        'weapons:silver_revolver',
        'dagger-1',
      ]);
    });
  });

  describe('Component Removal', () => {
    it('should handle wielding component removal gracefully', async () => {
      // Arrange: Actor with wielding component
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['sword-id'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['sword-id'],
        })
        .build();

      const sword = new ModEntityBuilder('sword-id')
        .withName('Sword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, sword]);

      // Act: Remove the wielding component
      fixture.entityManager.removeComponent('test-actor', 'positioning:wielding');

      // Assert: Component should be removed (getComponent returns null when not found)
      const wieldingComponent = fixture.entityManager.getComponent(
        'test-actor',
        'positioning:wielding'
      );
      expect(wieldingComponent).toBeFalsy();
    });
  });

  describe('Many Wielded Items', () => {
    it('should handle many wielded items (5+) in array', async () => {
      // Arrange: Actor already wielding 4 weapons, wielding a 5th
      const weaponIds = ['weapon-1', 'weapon-2', 'weapon-3', 'weapon-4', 'weapon-5'];

      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: weaponIds,
          capacity: { maxWeight: 100, maxItems: 20 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: weaponIds.slice(0, 4), // First 4 weapons
        })
        .build();

      const weapons = weaponIds.map((id, index) =>
        new ModEntityBuilder(id)
          .withName(`Weapon ${index + 1}`)
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('weapons:weapon', {})
          .build()
      );

      fixture.reset([actor, ...weapons]);

      // Act: Wield the 5th weapon
      await fixture.executeAction('test-actor', 'weapon-5');

      // Assert: All 5 weapons should be in array
      const wieldingComponent = fixture.entityManager.getComponent(
        'test-actor',
        'positioning:wielding'
      );
      expect(wieldingComponent.wielded_item_ids).toHaveLength(5);
      expect(wieldingComponent.wielded_item_ids).toEqual(weaponIds);
    });
  });

  describe('Missing Weapon Entity', () => {
    it('should not crash when weapon entity does not exist (stale reference)', async () => {
      // Arrange: Actor wielding a weapon that doesn't exist in entity manager
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['existing-weapon'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['non-existent-weapon'], // This weapon doesn't exist
        })
        .build();

      const existingWeapon = new ModEntityBuilder('existing-weapon')
        .withName('Existing Weapon')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, existingWeapon]);

      // Act: Try to wield the existing weapon - should not crash
      await fixture.executeAction('test-actor', 'existing-weapon');

      // Assert: Should append to array even with stale reference
      const wieldingComponent = fixture.entityManager.getComponent(
        'test-actor',
        'positioning:wielding'
      );
      expect(wieldingComponent).toBeDefined();
      expect(wieldingComponent.wielded_item_ids).toContain('existing-weapon');
      // The stale reference remains (component doesn't clean up stale references)
      expect(wieldingComponent.wielded_item_ids).toContain('non-existent-weapon');
    });
  });

  describe('IDs with Special Characters', () => {
    it('should handle IDs with underscores correctly', async () => {
      const actor = new ModEntityBuilder('test_actor_1')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['weapon_with_underscore'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('weapon_with_underscore')
        .withName('Weapon')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, weapon]);

      // Act
      await fixture.executeAction('test_actor_1', 'weapon_with_underscore');

      // Assert
      const wieldingComponent = fixture.entityManager.getComponent(
        'test_actor_1',
        'positioning:wielding'
      );
      expect(wieldingComponent.wielded_item_ids).toEqual(['weapon_with_underscore']);
    });

    it('should handle IDs with hyphens correctly', async () => {
      const actor = new ModEntityBuilder('test-actor-1')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['weapon-with-hyphen'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('weapon-with-hyphen')
        .withName('Weapon')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, weapon]);

      // Act
      await fixture.executeAction('test-actor-1', 'weapon-with-hyphen');

      // Assert
      const wieldingComponent = fixture.entityManager.getComponent(
        'test-actor-1',
        'positioning:wielding'
      );
      expect(wieldingComponent.wielded_item_ids).toEqual(['weapon-with-hyphen']);
    });
  });
});
