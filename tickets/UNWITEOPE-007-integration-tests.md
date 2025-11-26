# UNWITEOPE-007: Integration Tests for UNWIELD_ITEM Operation

## Summary

Create integration tests that verify the `UNWIELD_ITEM` operation works correctly within the full rule execution context, including tests for drop wielded item and explicit unwield item scenarios.

## Files to Create

| File | Purpose |
|------|---------|
| `tests/integration/mods/items/unwieldItemOperation.test.js` | Integration test suite |

## Test Scenarios Required

### Core Operation Tests

| Test Case | Description | Verification Points |
|-----------|-------------|---------------------|
| Full unwield flow | Execute handle_unwield_item rule | Wielding component removed/updated, appendages unlocked |
| Unwield one of multiple | Actor wielding 2 items, unwield one | Wielding component keeps other item |
| Two-handed weapon unwield | Unwield two-handed weapon | Both appendages unlocked |

### Drop Wielded Item Tests

| Test Case | Description | Verification Points |
|-----------|-------------|---------------------|
| Drop wielded item | Drop item that is currently wielded | Item unwielded first, then dropped |
| Drop non-wielded item | Drop item not being wielded | Normal drop behavior (UNWIELD_ITEM no-op) |
| Drop one of multiple wielded | Drop one wielded item while wielding another | Only dropped item unwielded |

### Edge Case Tests

| Test Case | Description | Verification Points |
|-----------|-------------|---------------------|
| Item not wielded | Call unwield on non-wielded item | No error, success returned |
| Actor not wielding anything | Actor has no wielding component | No error, success returned |

## Implementation Details

### Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('UNWIELD_ITEM Operation Integration', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forRule('items', 'handle_unwield_item');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Full Unwield Flow', () => {
    it('should remove wielding component when unwielding only item', async () => {
      // Setup: Actor wielding single item with locked grabbing appendage
      // Execute: Dispatch attempt_action for unwield_item
      // Verify: positioning:wielding removed, appendages unlocked
    });

    it('should keep component when other items remain wielded', async () => {
      // Setup: Actor wielding two items
      // Execute: Unwield one item
      // Verify: positioning:wielding has remaining item
    });
  });

  describe('Drop Wielded Item Integration', () => {
    it('should unwield item before dropping', async () => {
      // Setup: Actor wielding item
      // Execute: Drop the wielded item
      // Verify: Item unwielded, then dropped at location
    });

    it('should handle drop of non-wielded item normally', async () => {
      // Setup: Actor with item in inventory but not wielded
      // Execute: Drop the item
      // Verify: Normal drop behavior
    });
  });

  describe('Edge Cases', () => {
    it('should succeed silently when item not wielded', async () => {
      // Setup: Actor not wielding the target item
      // Execute: Dispatch unwield for that item
      // Verify: Success, no errors
    });
  });
});
```

### Entity Setup Requirements

```javascript
// Actor with single wielded item
const createWieldingActor = (fixture) => {
  const actor = fixture.createEntity('actor-001', [
    { type: 'core:actor', data: {} },
    { type: 'core:position', data: { locationId: 'location-001' } },
    { type: 'positioning:wielding', data: { wielded_item_ids: ['sword-001'] } },
    { type: 'anatomy:grabbing_appendages', data: {
      appendages: [
        { id: 'right_hand', locked: true, holding_item_id: 'sword-001' },
        { id: 'left_hand', locked: false, holding_item_id: null }
      ]
    }}
  ]);
  return actor;
};

// Two-handed wielder
const createTwoHandedWielder = (fixture) => {
  const actor = fixture.createEntity('actor-001', [
    { type: 'core:actor', data: {} },
    { type: 'core:position', data: { locationId: 'location-001' } },
    { type: 'positioning:wielding', data: { wielded_item_ids: ['greatsword-001'] } },
    { type: 'anatomy:grabbing_appendages', data: {
      appendages: [
        { id: 'right_hand', locked: true, holding_item_id: 'greatsword-001' },
        { id: 'left_hand', locked: true, holding_item_id: 'greatsword-001' }
      ]
    }}
  ]);
  return actor;
};

// Item with grabbing requirements
const createTwoHandedWeapon = (fixture) => {
  return fixture.createEntity('greatsword-001', [
    { type: 'core:item', data: { name: 'Greatsword' } },
    { type: 'anatomy:requires_grabbing', data: { handsRequired: 2 } }
  ]);
};
```

### Verification Helpers

```javascript
// Check wielding state
const assertNotWielding = (entityManager, actorId, itemId) => {
  const wielding = entityManager.getComponent(actorId, 'positioning:wielding');
  if (wielding) {
    expect(wielding.wielded_item_ids).not.toContain(itemId);
  }
};

// Check appendages unlocked
const assertAppendagesUnlocked = (entityManager, actorId, itemId) => {
  const appendages = entityManager.getComponent(actorId, 'anatomy:grabbing_appendages');
  const holding = appendages.appendages.filter(a => a.holding_item_id === itemId);
  expect(holding.every(a => !a.locked)).toBe(true);
};

// Check item dropped at location
const assertItemAtLocation = (entityManager, itemId, locationId) => {
  const position = entityManager.getComponent(itemId, 'core:position');
  expect(position.locationId).toBe(locationId);
};
```

## Out of Scope

- **DO NOT** create the schema (UNWITEOPE-001)
- **DO NOT** create the handler (UNWITEOPE-002)
- **DO NOT** modify DI registrations (UNWITEOPE-003)
- **DO NOT** create unit tests (UNWITEOPE-004)
- **DO NOT** modify any rule files (UNWITEOPE-005, UNWITEOPE-006)
- **DO NOT** test handler internals (unit tests cover this)
- **DO NOT** test schema validation (covered by npm run validate)

## Acceptance Criteria

### Tests That Must Pass

```bash
# Run integration tests
NODE_ENV=test npx jest tests/integration/mods/items/unwieldItemOperation.test.js --no-coverage --verbose

# Run with coverage
NODE_ENV=test npx jest tests/integration/mods/items/unwieldItemOperation.test.js --coverage

# Full integration test suite
npm run test:integration
```

### Coverage Requirements

- [ ] All 8 test scenarios pass
- [ ] Tests verify actual entity state changes
- [ ] Tests verify event dispatch
- [ ] No flaky tests

### Invariants That Must Remain True

- [ ] Tests use ModTestFixture pattern
- [ ] Tests clean up after themselves
- [ ] Tests are deterministic
- [ ] Tests don't depend on execution order
- [ ] No modifications to files outside the file list
- [ ] `npm run test:ci` passes

## Dependencies

- **Depends on**: ALL previous tickets (UNWITEOPE-001 through UNWITEOPE-006)
- **Blocked by**: UNWITEOPE-005, UNWITEOPE-006 (needs both rules updated)
- **Blocks**: None (final ticket in series)

## Reference Files

| File | Purpose |
|------|---------|
| `tests/integration/mods/items/wieldWeaponRuleExecution.test.js` | Similar wielding integration test |
| `tests/integration/mods/items/dropItemRuleExecution.test.js` | Similar drop integration test |
| `tests/common/mods/ModTestFixture.js` | Test fixture utilities |
| `docs/testing/mod-testing-guide.md` | Testing patterns documentation |

## Event Verification

Tests should verify the following events are dispatched:

| Event | When | Payload |
|-------|------|---------|
| `items:item_unwielded` | Item successfully unwielded | `{ actorId, itemId, remainingWieldedItems }` |
| `items:item_dropped` | Item dropped (from drop rule) | `{ actorId, itemId, locationId }` |

## Success Metrics

Upon completion of this ticket:

- [ ] Full unwield workflow tested end-to-end
- [ ] Drop wielded item correctly unwields first
- [ ] Idempotent behavior verified
- [ ] Two-handed weapon handling verified
- [ ] Multiple wielded items scenario verified
- [ ] All edge cases covered
