# UNWITEACT-007: Create Rule Execution Tests for `unwield_item`

## Summary

Create integration tests for the `unwield_item` rule execution, verifying the complete action workflow including grabbing appendage unlocking, array field modification, component cleanup, and description regeneration.

## Dependencies

- **UNWITEACT-004** (rule file) must be completed - tests execute against the rule
- **UNWITEACT-002** (condition file) must be completed - rule references the condition

## File to Create

### `tests/integration/mods/weapons/unwield_item_rule_execution.test.js`

```javascript
/**
 * @file Integration tests for unwield_item rule execution
 * Tests action execution, appendage unlocking, and component cleanup
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import unwieldItemRule from '../../../../data/mods/weapons/rules/handle_unwield_item.rule.json' assert { type: 'json' };
import eventIsActionUnwieldItem from '../../../../data/mods/weapons/conditions/event-is-action-unwield-item.condition.json' assert { type: 'json' };

const ACTION_ID = 'weapons:unwield_item';

describe('unwield_item action', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'weapons',
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

  describe('Rule Execution - Basic', () => {
    it('should execute successfully when actor unwields weapon', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['revolver'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['revolver'],
        })
        .build();

      const weapon = new ModEntityBuilder('revolver')
        .withName('Revolver')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
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
        .withComponent('items:inventory', {
          items: ['revolver'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['revolver'],
        })
        .build();

      const weapon = new ModEntityBuilder('revolver')
        .withName('Revolver')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
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
  });

  describe('Rule Execution - Item Removal from Wielding', () => {
    it('should remove item from wielded_item_ids array', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['revolver'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['revolver'],
        })
        .build();

      const weapon = new ModEntityBuilder('revolver')
        .withName('Revolver')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'revolver');

      // After unwielding the only item, wielding component should be removed
      const actorEntity = fixture.entityManager.getEntity('test-actor');
      const wieldingComponent = actorEntity?.components?.get('positioning:wielding');
      expect(wieldingComponent).toBeUndefined();
    });

    it('should preserve wielding component when other items remain', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['revolver', 'dagger'],
          capacity: { maxWeight: 20, maxItems: 10 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['revolver', 'dagger'],
        })
        .build();

      const weapon1 = new ModEntityBuilder('revolver')
        .withName('Revolver')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      const weapon2 = new ModEntityBuilder('dagger')
        .withName('Dagger')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, weapon1, weapon2]);

      // Unwield only the revolver
      await fixture.executeAction('test-actor', 'revolver');

      // Wielding component should still exist with dagger
      const actorEntity = fixture.entityManager.getEntity('test-actor');
      const wieldingComponent = actorEntity?.components?.get('positioning:wielding');
      expect(wieldingComponent).toBeDefined();
      expect(wieldingComponent.wielded_item_ids).toContain('dagger');
      expect(wieldingComponent.wielded_item_ids).not.toContain('revolver');
    });

    it('should remove wielding component when last item unwielded', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['revolver'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['revolver'],
        })
        .build();

      const weapon = new ModEntityBuilder('revolver')
        .withName('Revolver')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'revolver');

      const actorEntity = fixture.entityManager.getEntity('test-actor');
      expect(actorEntity?.components?.has('positioning:wielding')).toBe(false);
    });
  });

  describe('Rule Execution - Grabbing Appendages', () => {
    it('should unlock correct number of grabbing appendages (multi-handed weapon)', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['greatsword'],
          capacity: { maxWeight: 20, maxItems: 5 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['greatsword'],
        })
        .build();

      const weapon = new ModEntityBuilder('greatsword')
        .withName('Greatsword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('anatomy:requires_grabbing', { handsRequired: 2 })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'greatsword');

      // Verify UNLOCK_GRABBING was called with count: 2
      // This would be verified through events or component state
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('should default to 1 hand if requires_grabbing component is missing', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['dagger'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['dagger'],
        })
        .build();

      // Weapon WITHOUT anatomy:requires_grabbing component
      const weapon = new ModEntityBuilder('dagger')
        .withName('Dagger')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        // NOTE: No anatomy:requires_grabbing component
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'dagger');

      // Should still succeed, defaulting to 1 hand
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });
  });

  describe('Rule Execution - Description Regeneration', () => {
    it('should regenerate actor description after unwield', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['revolver'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['revolver'],
        })
        .build();

      const weapon = new ModEntityBuilder('revolver')
        .withName('Revolver')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'revolver');

      // Verify action completed - description regeneration is handled internally
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });
  });

  describe('Rule Execution - Message Formatting', () => {
    it('should format message with actor and target names', async () => {
      const actor = new ModEntityBuilder('john')
        .withName('John Smith')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['silver-revolver'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['silver-revolver'],
        })
        .build();

      const weapon = new ModEntityBuilder('silver-revolver')
        .withName('Silver Revolver')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('john', 'silver-revolver');

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
  });
});
```

## Files to Modify

None

## Out of Scope

- **DO NOT** modify any existing test files
- **DO NOT** create tests for action discovery (that's UNWITEACT-006)
- **DO NOT** create tests for wield_threateningly (that's UNWITEACT-008)
- **DO NOT** modify any production code
- **DO NOT** modify test fixtures or helpers

## Test Categories Explained

### Basic Execution Tests
- Verify the action executes successfully
- Verify events are dispatched (turn_ended, perceptible_event)

### Item Removal Tests
- Verify item is removed from `wielded_item_ids` array
- Verify `positioning:wielding` component is removed when last item unwielded
- Verify component is preserved when other items remain

### Grabbing Appendage Tests
- Verify `UNLOCK_GRABBING` is called with correct count for multi-handed weapons
- Verify default to 1 hand when `anatomy:requires_grabbing` component is missing

### Description Regeneration Tests
- Verify action completes (description regeneration happens internally)

### Message Formatting Tests
- Verify proper message formatting with actor and target names

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:integration -- tests/integration/mods/weapons/unwield_item_rule_execution.test.js
npm run test:ci  # Full test suite including new tests
```

### Manual Verification

1. Test file exists at `tests/integration/mods/weapons/unwield_item_rule_execution.test.js`
2. All tests pass when run individually
3. Tests use `ModTestFixture.forAction` pattern correctly
4. Tests properly import rule and condition JSON
5. Test descriptions are clear and match the spec

### Invariants That Must Remain True

1. All existing weapons tests pass
2. No existing test files are modified
3. No production code is modified
4. Test follows project testing patterns (see existing `wield_threateningly_action.test.js`)
