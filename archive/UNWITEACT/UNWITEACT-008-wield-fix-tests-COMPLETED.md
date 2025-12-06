# UNWITEACT-008: Add Tests for `wield_threateningly` LOCK_GRABBING Fix

## Status: ✅ COMPLETED

## Summary

Add or update tests to verify that the `wield_threateningly` action now correctly locks grabbing appendages when wielding an item. These tests validate the fix implemented in UNWITEACT-005.

## Dependencies

- **UNWITEACT-005** (wield fix) must be completed - tests verify the fix ✅

## Assumption Corrections (Updated During Implementation)

### Original Ticket Assumptions vs Actual API

| Issue               | Original (Incorrect)                     | Corrected                                   |
| ------------------- | ---------------------------------------- | ------------------------------------------- |
| Entity access       | `fixture.entityManager.getEntity()`      | `fixture.entityManager.getEntityInstance()` |
| Component access    | `entity.components.get('...')` (Map)     | `entity.components['...']` (plain object)   |
| Preferred assertion | Manual `expect(component).toBeDefined()` | `toHaveComponentData()` matcher             |

### Rule File Status

The ticket originally assumed UNWITEACT-005 was pending. At implementation time, the rule file `handle_wield_threateningly.rule.json` already contains:

- `QUERY_COMPONENT` for `anatomy:requires_grabbing` with `missing_value: { handsRequired: 1 }`
- `LOCK_GRABBING` with `actor_id`, `count`, and `item_id` parameters

## File Created

### `tests/integration/mods/weapons/wield_threateningly_grabbing.test.js`

See the file for the complete implementation with corrected API usage.

## Test Categories

### LOCK_GRABBING Operation Tests

- ✅ Verify single-handed weapons complete action successfully and create wielding component
- ✅ Verify two-handed weapons complete action successfully and create wielding component
- ✅ Verify default to 1 hand when `anatomy:requires_grabbing` is missing
- ✅ Verify `item_id` is passed to associate appendages with specific item

### Rule Structure Validation Tests

- ✅ Verify `QUERY_COMPONENT` for `anatomy:requires_grabbing` exists in rule
- ✅ Verify `LOCK_GRABBING` operation exists with correct parameters
- ✅ Verify operations are in correct order (query before lock)

## Out of Scope

- **DO NOT** modify the rule file (already done in UNWITEACT-005)
- **DO NOT** modify any existing test assertions (only ADD new tests)
- **DO NOT** modify any production code
- **DO NOT** create tests for unwield_item (those are in UNWITEACT-006 and UNWITEACT-007)

## Acceptance Criteria

### Tests That Must Pass

```bash
# New file:
npm run test:integration -- tests/integration/mods/weapons/wield_threateningly_grabbing.test.js

# Full test suite:
npm run test:ci
```

### Manual Verification

1. ✅ New tests exist and pass
2. ✅ Tests correctly import the rule JSON
3. ✅ Rule structure validation tests verify the fix from UNWITEACT-005
4. ✅ Test descriptions clearly explain what is being tested

### Invariants That Must Remain True

1. ✅ All existing weapons tests still pass
2. ✅ No existing test assertions changed
3. ✅ No production code modified
4. ✅ Test follows project testing patterns

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**

- Create new test file `wield_threateningly_grabbing.test.js` with test code from the ticket

**Actual Changes:**

1. **Created**: `tests/integration/mods/weapons/wield_threateningly_grabbing.test.js` with 7 test cases
2. **Corrected ticket assumptions**: Updated API usage patterns in test code:
   - Changed `fixture.entityManager.getEntity()` → `fixture.entityManager.getEntityInstance()`
   - Changed `entity.components.get()` → `entity.components['...']` (plain object)
   - Used `toHaveComponentData()` domain matcher instead of manual assertions

**No Production Code Changes**: The ticket correctly identified that no production code changes were needed (UNWITEACT-005 was already completed).

### Test Results

- All 7 new tests pass
- All 133 existing weapons tests continue to pass
- No regressions introduced
