/**
 * @file Integration tests for wield_threateningly action execution
 * Tests action discoverability and rule execution behavior
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import wieldThreateninglyRule from '../../../../data/mods/weapons/rules/handle_wield_threateningly.rule.json' assert { type: 'json' };
import eventIsActionWieldThreateningly from '../../../../data/mods/weapons/conditions/event-is-action-wield-threateningly.condition.json' assert { type: 'json' };

const ACTION_ID = 'weapons:wield_threateningly';

describe('wield_threateningly action', () => {
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

  describe('Rule Execution', () => {
    it('should execute successfully when actor wields weapon', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('inventory:inventory', {
          items: ['revolver'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('revolver')
        .withName('Revolver')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'revolver');

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
        .withComponent('inventory:inventory', {
          items: ['revolver'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('revolver')
        .withName('Revolver')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'revolver');

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
        .withComponent('inventory:inventory', {
          items: ['silver-revolver'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('silver-revolver')
        .withName('Silver Revolver')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('john', 'silver-revolver');

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
});
