/**
 * @file Integration tests for wield_threateningly grabbing appendage locking
 * Tests that LOCK_GRABBING is called correctly when wielding items
 * Validates the fix from UNWITEACT-005
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import wieldThreateninglyRule from '../../../../data/mods/weapons/rules/handle_wield_threateningly.rule.json' assert { type: 'json' };
import eventIsActionWieldThreateningly from '../../../../data/mods/weapons/conditions/event-is-action-wield-threateningly.condition.json' assert { type: 'json' };

const ACTION_ID = 'weapons:wield_threateningly';

describe('wield_threateningly action - Grabbing Appendage Locking', () => {
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

  describe('LOCK_GRABBING Operation', () => {
    it('should lock correct number of grabbing appendages for single-handed weapon', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('inventory:inventory', {
          items: ['dagger'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('dagger')
        .withName('Dagger')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('anatomy:requires_grabbing', { handsRequired: 1 })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'dagger');

      // Verify action completed successfully
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);

      // Verify wielding component was created with the weapon
      const actorInstance =
        fixture.entityManager.getEntityInstance('test-actor');
      expect(actorInstance).toHaveComponentData('item-handling-states:wielding', {
        wielded_item_ids: ['dagger'],
      });
    });

    it('should lock correct number of grabbing appendages for two-handed weapon', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('inventory:inventory', {
          items: ['greatsword'],
          capacity: { maxWeight: 20, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('greatsword')
        .withName('Greatsword')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('anatomy:requires_grabbing', { handsRequired: 2 })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'greatsword');

      // Verify action completed successfully
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);

      // Verify wielding component was created with the weapon
      const actorInstance =
        fixture.entityManager.getEntityInstance('test-actor');
      expect(actorInstance).toHaveComponentData('item-handling-states:wielding', {
        wielded_item_ids: ['greatsword'],
      });
    });

    it('should default to 1 hand if requires_grabbing component is missing', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('inventory:inventory', {
          items: ['revolver'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      // Weapon WITHOUT anatomy:requires_grabbing component
      const weapon = new ModEntityBuilder('revolver')
        .withName('Revolver')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        // NOTE: No anatomy:requires_grabbing component - should default to 1
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'revolver');

      // Should succeed with default of 1 hand
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);

      // Verify wielding component was created with the weapon
      const actorInstance =
        fixture.entityManager.getEntityInstance('test-actor');
      expect(actorInstance).toHaveComponentData('item-handling-states:wielding', {
        wielded_item_ids: ['revolver'],
      });
    });

    it('should associate locked appendages with specific item via item_id', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('inventory:inventory', {
          items: ['sword'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('sword')
        .withName('Sword')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('anatomy:requires_grabbing', { handsRequired: 1 })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'sword');

      // Verify action completed and weapon is wielded
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);

      // Verify wielding component exists with the specific weapon
      // The item_id association is critical for UNLOCK_GRABBING to work correctly
      // when unwielding specific items
      const actorInstance =
        fixture.entityManager.getEntityInstance('test-actor');
      expect(actorInstance).toHaveComponentData('item-handling-states:wielding', {
        wielded_item_ids: ['sword'],
      });
    });
  });

  describe('Rule Structure Validation', () => {
    it('should have QUERY_COMPONENT for anatomy:requires_grabbing in rule', () => {
      const queryGrabbingOp = wieldThreateninglyRule.actions.find(
        (action) =>
          action.type === 'QUERY_COMPONENT' &&
          action.parameters?.component_type === 'anatomy:requires_grabbing'
      );
      expect(queryGrabbingOp).toBeDefined();
      expect(queryGrabbingOp.parameters.result_variable).toBe(
        'targetGrabbingReqs'
      );
      expect(queryGrabbingOp.parameters.missing_value).toEqual({
        handsRequired: 1,
      });
    });

    it('should have LOCK_GRABBING operation in rule', () => {
      const lockGrabbingOp = wieldThreateninglyRule.actions.find(
        (action) => action.type === 'LOCK_GRABBING'
      );
      expect(lockGrabbingOp).toBeDefined();
      expect(lockGrabbingOp.parameters.actor_id).toBe(
        '{event.payload.actorId}'
      );
      expect(lockGrabbingOp.parameters.count).toBe(
        '{context.targetGrabbingReqs.handsRequired}'
      );
      expect(lockGrabbingOp.parameters.item_id).toBe(
        '{event.payload.targetId}'
      );
    });

    it('should query grabbing requirements before locking', () => {
      const actions = wieldThreateninglyRule.actions;
      const queryIndex = actions.findIndex(
        (action) =>
          action.type === 'QUERY_COMPONENT' &&
          action.parameters?.component_type === 'anatomy:requires_grabbing'
      );
      const lockIndex = actions.findIndex(
        (action) => action.type === 'LOCK_GRABBING'
      );

      expect(queryIndex).toBeGreaterThan(-1);
      expect(lockIndex).toBeGreaterThan(-1);
      expect(queryIndex).toBeLessThan(lockIndex);
    });
  });
});
