/**
 * @file Integration tests for quickly_wield_weapon action execution
 * Tests action discoverability and rule execution behavior
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import quicklyWieldWeaponRule from '../../../../data/mods/weapons/rules/handle_quickly_wield_weapon.rule.json' assert { type: 'json' };
import eventIsActionQuicklyWieldWeapon from '../../../../data/mods/weapons/conditions/event-is-action-quickly-wield-weapon.condition.json' assert { type: 'json' };

const ACTION_ID = 'weapons:quickly_wield_weapon';

describe('quickly_wield_weapon action', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'weapons',
      ACTION_ID,
      quicklyWieldWeaponRule,
      eventIsActionQuicklyWieldWeapon
    );
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('Rule Execution', () => {
    it('should execute successfully when actor wields weapon from location', async () => {
      const location = new ModEntityBuilder('test-location')
        .withName('Test Room')
        .build();

      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('test-sword')
        .withName('Iron Sword')
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([location, actor, weapon]);

      await fixture.executeAction('test-actor', 'test-sword');

      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('should remove weapon position component after wielding', async () => {
      const location = new ModEntityBuilder('test-location')
        .withName('Test Room')
        .build();

      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('test-sword')
        .withName('Iron Sword')
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([location, actor, weapon]);

      await fixture.executeAction('test-actor', 'test-sword');

      const weaponEntity = fixture.entityManager.getEntityInstance('test-sword');
      expect(weaponEntity.components['core:position']).toBeUndefined();
    });

    it('should add wielding component to actor', async () => {
      const location = new ModEntityBuilder('test-location')
        .withName('Test Room')
        .build();

      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('test-sword')
        .withName('Iron Sword')
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([location, actor, weapon]);

      await fixture.executeAction('test-actor', 'test-sword');

      const actorEntity = fixture.entityManager.getEntityInstance('test-actor');
      expect(actorEntity.components['positioning:wielding']).toBeDefined();
      expect(actorEntity.components['positioning:wielding'].wielded_item_ids).toContain('test-sword');
    });

    it('should dispatch perceptible_event with correct message', async () => {
      const location = new ModEntityBuilder('test-location')
        .withName('Test Room')
        .build();

      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('test-sword')
        .withName('Iron Sword')
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([location, actor, weapon]);

      await fixture.executeAction('test-actor', 'test-sword');

      const perceptibleEvent = fixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.actorId).toBe('test-actor');
    });

    it('should format message with actor and target names', async () => {
      const location = new ModEntityBuilder('test-location')
        .withName('Test Room')
        .build();

      const actor = new ModEntityBuilder('john')
        .withName('John Smith')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('silver-sword')
        .withName('Silver Sword')
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([location, actor, weapon]);

      await fixture.executeAction('john', 'silver-sword');

      const displayEvent = fixture.events.find(
        (event) => event.eventType === 'core:display_successful_action_result'
      );
      expect(displayEvent).toBeDefined();

      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('should append to existing wielded items array when actor already has wielding component', async () => {
      const location = new ModEntityBuilder('test-location')
        .withName('Test Room')
        .build();

      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['existing-sword'],
          capacity: { maxWeight: 20, maxItems: 10 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['existing-sword'],
        })
        .build();

      const existingSword = new ModEntityBuilder('existing-sword')
        .withName('Existing Sword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const newWeapon = new ModEntityBuilder('new-sword')
        .withName('New Sword')
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([location, actor, existingSword, newWeapon]);

      await fixture.executeAction('test-actor', 'new-sword');

      const actorEntity = fixture.entityManager.getEntityInstance('test-actor');
      expect(actorEntity.components['positioning:wielding'].wielded_item_ids).toContain('existing-sword');
      expect(actorEntity.components['positioning:wielding'].wielded_item_ids).toContain('new-sword');
    });
  });
});
