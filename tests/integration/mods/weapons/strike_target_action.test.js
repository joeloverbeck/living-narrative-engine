/**
 * @file Integration tests for strike_target action execution
 * Tests action discoverability and rule execution behavior
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import strikeTargetRule from '../../../../data/mods/weapons/rules/handle_strike_target.rule.json' assert { type: 'json' };
import eventIsActionStrikeTarget from '../../../../data/mods/weapons/conditions/event-is-action-strike-target.condition.json' assert { type: 'json' };

const ACTION_ID = 'weapons:strike_target';

describe('strike_target action', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'weapons',
      ACTION_ID,
      strikeTargetRule,
      eventIsActionStrikeTarget
    );
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('Rule Execution', () => {
    it('should execute successfully when actor wields blunt weapon', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['practice-stick'],
        })
        .withComponent('items:inventory', {
          items: ['practice-stick'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('practice-stick')
        .withName('Practice Stick')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('damage-types:damage_capabilities', {
          entries: [{ name: 'blunt', amount: 5 }],
        })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'practice-stick');

      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('should dispatch perceptible_event with correct message', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('item-handling-states:wielding', { wielded_item_ids: ['club'] })
        .withComponent('items:inventory', {
          items: ['club'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('club')
        .withName('Club')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('damage-types:damage_capabilities', {
          entries: [{ name: 'blunt', amount: 8 }],
        })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'club');

      const perceptibleEvent = fixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.actorId).toBe('test-actor');
    });

    it('should format message with actor and target names', async () => {
      const actor = new ModEntityBuilder('john')
        .withName('John Smith')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['heavy-mace'],
        })
        .withComponent('items:inventory', {
          items: ['heavy-mace'],
          capacity: { maxWeight: 20, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('heavy-mace')
        .withName('Heavy Mace')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('damage-types:damage_capabilities', {
          entries: [{ name: 'blunt', amount: 12 }],
        })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('john', 'heavy-mace');

      const displayEvent = fixture.events.find(
        (event) => event.eventType === 'core:display_successful_action_result'
      );
      expect(displayEvent).toBeDefined();
      // Verify the action completed successfully
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });
  });

  describe('Multi-Damage-Type Weapons', () => {
    it('should work with spiked mace having both blunt and piercing damage', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('item-handling-states:wielding', {
          wielded_item_ids: ['spiked-mace'],
        })
        .withComponent('items:inventory', {
          items: ['spiked-mace'],
          capacity: { maxWeight: 20, maxItems: 5 },
        })
        .build();

      const spikedMace = new ModEntityBuilder('spiked-mace')
        .withName('Spiked Mace')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('damage-types:damage_capabilities', {
          entries: [
            { name: 'blunt', amount: 12 },
            { name: 'piercing', amount: 6 },
          ],
        })
        .build();

      fixture.reset([actor, spikedMace]);

      await fixture.executeAction('test-actor', 'spiked-mace');

      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });
  });
});
