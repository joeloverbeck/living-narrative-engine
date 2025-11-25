/**
 * @file Integration tests for wielding component workflow
 * Tests the positioning:wielding component addition during wield_threateningly action
 * Part of WIECOM-003 implementation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import wieldThreateninglyRule from '../../../../data/mods/weapons/rules/handle_wield_threateningly.rule.json' assert { type: 'json' };
import eventIsActionWieldThreateningly from '../../../../data/mods/weapons/conditions/event-is-action-wield-threateningly.condition.json' assert { type: 'json' };

const ACTION_ID = 'weapons:wield_threateningly';

describe('Wielding Component Workflow', () => {
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

  describe('First Wield - Component Creation', () => {
    it('should create positioning:wielding component when actor has no wielding component', async () => {
      // Arrange: Actor without wielding component
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['sword-id'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const sword = new ModEntityBuilder('sword-id')
        .withName('Sword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, sword]);

      // Act
      await fixture.executeAction('test-actor', 'sword-id');

      // Assert: Component should be created with weapon ID in array
      const wieldingComponent = fixture.entityManager.getComponent(
        'test-actor',
        'positioning:wielding'
      );
      expect(wieldingComponent).toBeDefined();
      expect(wieldingComponent.wielded_item_ids).toEqual(['sword-id']);
    });

    it('should complete successfully with turn ended', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['sword-id'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const sword = new ModEntityBuilder('sword-id')
        .withName('Sword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, sword]);

      await fixture.executeAction('test-actor', 'sword-id');

      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });
  });

  describe('Second Wield - Array Append', () => {
    it('should append second weapon to existing wielded_item_ids array', async () => {
      // Arrange: Actor already wielding sword
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['sword-id', 'dagger-id'],
          capacity: { maxWeight: 20, maxItems: 10 },
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

      const dagger = new ModEntityBuilder('dagger-id')
        .withName('Dagger')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, sword, dagger]);

      // Act: Wield the dagger
      await fixture.executeAction('test-actor', 'dagger-id');

      // Assert: Both weapons should be in the array
      const wieldingComponent = fixture.entityManager.getComponent(
        'test-actor',
        'positioning:wielding'
      );
      expect(wieldingComponent).toBeDefined();
      expect(wieldingComponent.wielded_item_ids).toEqual([
        'sword-id',
        'dagger-id',
      ]);
    });
  });

  describe('Duplicate Wield Prevention', () => {
    it('should not add duplicate weapon ID when wielding same weapon again', async () => {
      // Arrange: Actor already wielding sword
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

      // Act: Try to wield the same sword again
      await fixture.executeAction('test-actor', 'sword-id');

      // Assert: Array should still have only one entry (push_unique prevents duplicates)
      const wieldingComponent = fixture.entityManager.getComponent(
        'test-actor',
        'positioning:wielding'
      );
      expect(wieldingComponent).toBeDefined();
      expect(wieldingComponent.wielded_item_ids).toEqual(['sword-id']);
      expect(wieldingComponent.wielded_item_ids).toHaveLength(1);
    });
  });

  describe('Description Regeneration', () => {
    it('should trigger REGENERATE_DESCRIPTION operation', async () => {
      // This test verifies that the rule includes REGENERATE_DESCRIPTION
      // The actual description content depends on the activityNLGSystem
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['sword-id'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const sword = new ModEntityBuilder('sword-id')
        .withName('Sword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, sword]);

      // Act
      await fixture.executeAction('test-actor', 'sword-id');

      // Assert: Action completed successfully (REGENERATE_DESCRIPTION doesn't throw)
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);

      // Verify wielding component was created (proves operations ran in sequence)
      const wieldingComponent = fixture.entityManager.getComponent(
        'test-actor',
        'positioning:wielding'
      );
      expect(wieldingComponent).toBeDefined();
    });
  });

  describe('Rule Structure Validation', () => {
    it('should have QUERY_COMPONENT for existing wielding check', () => {
      const queryWieldingOp = wieldThreateninglyRule.actions.find(
        (action) =>
          action.type === 'QUERY_COMPONENT' &&
          action.parameters?.component_type === 'positioning:wielding'
      );
      expect(queryWieldingOp).toBeDefined();
      expect(queryWieldingOp.parameters.result_variable).toBe(
        'existingWielding'
      );
      expect(queryWieldingOp.parameters.missing_value).toBeNull();
    });

    it('should have IF operation with then_actions and else_actions', () => {
      const ifOp = wieldThreateninglyRule.actions.find(
        (action) => action.type === 'IF'
      );
      expect(ifOp).toBeDefined();
      expect(ifOp.parameters.condition).toEqual({
        var: 'context.existingWielding',
      });
      expect(ifOp.parameters.then_actions).toBeDefined();
      expect(ifOp.parameters.else_actions).toBeDefined();
    });

    it('should have MODIFY_ARRAY_FIELD in then_actions with push_unique mode', () => {
      const ifOp = wieldThreateninglyRule.actions.find(
        (action) => action.type === 'IF'
      );
      const modifyOp = ifOp.parameters.then_actions.find(
        (action) => action.type === 'MODIFY_ARRAY_FIELD'
      );
      expect(modifyOp).toBeDefined();
      expect(modifyOp.parameters.mode).toBe('push_unique');
      expect(modifyOp.parameters.field).toBe('wielded_item_ids');
    });

    it('should have ADD_COMPONENT in else_actions', () => {
      const ifOp = wieldThreateninglyRule.actions.find(
        (action) => action.type === 'IF'
      );
      const addOp = ifOp.parameters.else_actions.find(
        (action) => action.type === 'ADD_COMPONENT'
      );
      expect(addOp).toBeDefined();
      expect(addOp.parameters.component_type).toBe('positioning:wielding');
      expect(addOp.parameters.value.wielded_item_ids).toBeDefined();
    });

    it('should have REGENERATE_DESCRIPTION operation after IF', () => {
      const regenOp = wieldThreateninglyRule.actions.find(
        (action) => action.type === 'REGENERATE_DESCRIPTION'
      );
      expect(regenOp).toBeDefined();
      expect(regenOp.parameters.entity_ref).toBe('actor');
    });
  });
});
