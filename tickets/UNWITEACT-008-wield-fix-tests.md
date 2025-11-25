# UNWITEACT-008: Add Tests for `wield_threateningly` LOCK_GRABBING Fix

## Summary

Add or update tests to verify that the `wield_threateningly` action now correctly locks grabbing appendages when wielding an item. These tests validate the fix implemented in UNWITEACT-005.

## Dependencies

- **UNWITEACT-005** (wield fix) must be completed - tests verify the fix

## File to Create/Modify

### Option A: Add tests to existing file

Update `tests/integration/mods/weapons/wield_threateningly_action.test.js` by adding new test cases.

### Option B: Create new focused test file (Recommended)

Create `tests/integration/mods/weapons/wield_threateningly_grabbing.test.js`

## Test File Content (Option B - New File)

```javascript
/**
 * @file Integration tests for wield_threateningly grabbing appendage locking
 * Tests that LOCK_GRABBING is called correctly when wielding items
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
        .withComponent('items:inventory', {
          items: ['dagger'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('dagger')
        .withName('Dagger')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
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

      // LOCK_GRABBING should have been called with count: 1
      // Verify through component state if accessible
      const actorEntity = fixture.entityManager.getEntity('test-actor');
      const wieldingComponent = actorEntity?.components?.get('positioning:wielding');
      expect(wieldingComponent).toBeDefined();
      expect(wieldingComponent.wielded_item_ids).toContain('dagger');
    });

    it('should lock correct number of grabbing appendages for two-handed weapon', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['greatsword'],
          capacity: { maxWeight: 20, maxItems: 5 },
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

      // Verify action completed successfully
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);

      // LOCK_GRABBING should have been called with count: 2
      const actorEntity = fixture.entityManager.getEntity('test-actor');
      const wieldingComponent = actorEntity?.components?.get('positioning:wielding');
      expect(wieldingComponent).toBeDefined();
      expect(wieldingComponent.wielded_item_ids).toContain('greatsword');
    });

    it('should default to 1 hand if requires_grabbing component is missing', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['revolver'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      // Weapon WITHOUT anatomy:requires_grabbing component
      const weapon = new ModEntityBuilder('revolver')
        .withName('Revolver')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
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

      const actorEntity = fixture.entityManager.getEntity('test-actor');
      const wieldingComponent = actorEntity?.components?.get('positioning:wielding');
      expect(wieldingComponent).toBeDefined();
      expect(wieldingComponent.wielded_item_ids).toContain('revolver');
    });

    it('should associate locked appendages with specific item via item_id', async () => {
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('items:inventory', {
          items: ['sword'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const weapon = new ModEntityBuilder('sword')
        .withName('Sword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('anatomy:requires_grabbing', { handsRequired: 1 })
        .build();

      fixture.reset([actor, weapon]);

      await fixture.executeAction('test-actor', 'sword');

      // Verify LOCK_GRABBING was called with item_id: 'sword'
      // This ensures appendages are associated with the specific weapon
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);

      // The item_id association is critical for UNLOCK_GRABBING to work correctly
      // when unwielding specific items
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
      expect(queryGrabbingOp.parameters.result_variable).toBe('targetGrabbingReqs');
      expect(queryGrabbingOp.parameters.missing_value).toEqual({ handsRequired: 1 });
    });

    it('should have LOCK_GRABBING operation in rule', () => {
      const lockGrabbingOp = wieldThreateninglyRule.actions.find(
        (action) => action.type === 'LOCK_GRABBING'
      );
      expect(lockGrabbingOp).toBeDefined();
      expect(lockGrabbingOp.parameters.actor_id).toBe('{event.payload.actorId}');
      expect(lockGrabbingOp.parameters.count).toBe('{context.targetGrabbingReqs.handsRequired}');
      expect(lockGrabbingOp.parameters.item_id).toBe('{event.payload.targetId}');
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
```

## Files to Modify (if using Option A)

If adding to existing file `tests/integration/mods/weapons/wield_threateningly_action.test.js`:
- Add new `describe` block for "Grabbing Appendage Locking"
- Add test cases from above

## Out of Scope

- **DO NOT** modify the rule file (already done in UNWITEACT-005)
- **DO NOT** modify any existing test assertions (only ADD new tests)
- **DO NOT** modify any production code
- **DO NOT** create tests for unwield_item (those are in UNWITEACT-006 and UNWITEACT-007)

## Test Categories Explained

### LOCK_GRABBING Operation Tests
- Verify single-handed weapons lock 1 appendage
- Verify two-handed weapons lock 2 appendages
- Verify default to 1 hand when `anatomy:requires_grabbing` is missing
- Verify `item_id` is passed to associate appendages with specific item

### Rule Structure Validation Tests
- Verify `QUERY_COMPONENT` for `anatomy:requires_grabbing` exists in rule
- Verify `LOCK_GRABBING` operation exists with correct parameters
- Verify operations are in correct order (query before lock)

## Acceptance Criteria

### Tests That Must Pass

```bash
# If Option B (new file):
npm run test:integration -- tests/integration/mods/weapons/wield_threateningly_grabbing.test.js

# If Option A (existing file):
npm run test:integration -- tests/integration/mods/weapons/wield_threateningly_action.test.js

# Full test suite:
npm run test:ci
```

### Manual Verification

1. New tests exist and pass
2. Tests correctly import the modified rule JSON
3. Rule structure validation tests verify the fix from UNWITEACT-005
4. Test descriptions clearly explain what is being tested

### Invariants That Must Remain True

1. All existing weapons tests still pass
2. If modifying existing test file, existing test assertions are NOT changed
3. No production code is modified
4. Test follows project testing patterns
