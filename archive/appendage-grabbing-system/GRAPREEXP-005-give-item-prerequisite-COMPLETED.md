# GRAPREEXP-005: Add Free Grabbing Appendage Prerequisite to Give Item Action

## Status: ✅ COMPLETED

## Summary

Add a prerequisite to the `items:give_item` action requiring the actor to have at least one free grabbing appendage (hand/tentacle/claw). Uses the existing `anatomy:actor-has-free-grabbing-appendage` condition.

## Outcome

### What Was Changed (vs Originally Planned)

**All changes matched the original plan exactly:**

1. **`data/mods/items/actions/give_item.action.json`** - Added `prerequisites` array with `anatomy:actor-has-free-grabbing-appendage` condition reference
2. **`tests/integration/mods/items/give_item_prerequisites.test.js`** - Created new test file with 14 tests covering:
   - Action definition structure (4 tests)
   - Prerequisite evaluation pass cases (3 tests)
   - Prerequisite evaluation fail cases (2 tests)
   - Edge cases (2 tests)
   - Condition definition validation (2 tests)
   - Additional invariant test

3. **`tests/integration/mods/items/giveItemActionDiscovery.test.js`** - Updated existing test that incorrectly asserted `prerequisites` should be undefined. Changed to verify the new prerequisite is correctly defined (GRAPREEXP-005 reference added in comment).

### Files Modified

| File                                                           | Change                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `data/mods/items/actions/give_item.action.json`                | Added `prerequisites` array after `forbidden_components`                                                     |
| `tests/integration/mods/items/giveItemActionDiscovery.test.js` | Updated test from "should not have prerequisites" to "should have prerequisites for free grabbing appendage" |

### Files Created

| File                                                           | Purpose                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| `tests/integration/mods/items/give_item_prerequisites.test.js` | Integration tests for prerequisite evaluation (14 tests) |

## Verification

All acceptance criteria passed:

```bash
# New test file - 14/14 tests passing
NODE_ENV=test npx jest tests/integration/mods/items/give_item_prerequisites.test.js --no-coverage --verbose
# ✅ PASS

# Existing give_item tests - 28/28 tests passing
NODE_ENV=test npx jest tests/integration/mods/items/giveItem --no-coverage --silent
# ✅ PASS (all 4 test files)

# Schema validation
npm run validate
# ✅ PASS - 0 violations across 44 mods

# Lint
npx eslint tests/integration/mods/items/give_item_prerequisites.test.js tests/integration/mods/items/giveItemActionDiscovery.test.js
# ✅ PASS (only JSDoc style warnings matching reference pattern)
```

### Invariants Verified

- [x] Action ID remains `items:give_item`
- [x] `generateCombinations` remains `true`
- [x] Template remains `give {item} to {recipient}`
- [x] Primary target scope remains `core:actors_in_location`
- [x] Secondary target scope remains `items:actor_inventory_items`
- [x] `required_components` remain unchanged (`actor: ["items:inventory"]`)
- [x] `forbidden_components` remain unchanged (`actor: ["positioning:bending_over"]`)
- [x] `visual` properties remain unchanged
- [x] Existing tests in the project continue to pass
- [x] JSON schema validation passes

## Dependencies

- **Depends on**: Nothing (uses existing infrastructure)
- **Blocked by**: Nothing
- **Blocks**: Nothing

## Reference Files

| File                                                                            | Purpose                                  |
| ------------------------------------------------------------------------------- | ---------------------------------------- |
| `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`      | Test pattern template (followed exactly) |
| `data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json` | Condition to reference                   |
| `specs/grabbing-prerequisites-expansion.md`                                     | Full specification                       |

---

## Original Ticket Content

### Implementation Details

#### give_item.action.json

**Current State (lines 10-13)**:

```json
  "forbidden_components": {
    "actor": ["positioning:bending_over"]
  },
  "targets": {
```

**New State**:

```json
  "forbidden_components": {
    "actor": ["positioning:bending_over"]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to give an item."
    }
  ],
  "targets": {
```

### Test File Structure

Follow the pattern from `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`:

```javascript
/**
 * @jest-environment node
 *
 * @file Integration tests for items:give_item action prerequisites
 * @description Tests that the action correctly requires one free grabbing appendage
 *
 * @see data/mods/items/actions/give_item.action.json
 * @see data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json
 * @see tickets/GRAPREEXP-005-give-item-prerequisite.md
 */
```

### Out of Scope

- **DO NOT** modify the operator (`src/logic/operators/hasFreeGrabbingAppendagesOperator.js`)
- **DO NOT** modify the condition definition (`actor-has-free-grabbing-appendage.condition.json`)
- **DO NOT** modify any other action files
- **DO NOT** modify the test pattern reference file (`wield_threateningly_prerequisites.test.js`)
- **DO NOT** change any other properties in `give_item.action.json` (visual, targets, required_components, forbidden_components, etc.)

### Required Test Suites

#### 1. Action Definition Structure

- `should have prerequisites array defined`
- `should reference anatomy:actor-has-free-grabbing-appendage condition`
- `should have failure_message for user feedback`
- `should preserve other action properties` (id, generateCombinations, targets, required_components, forbidden_components, visual)

#### 2. Prerequisite Evaluation - Pass Cases

- `should pass when actor has exactly one free grabbing appendage`
- `should pass when actor has multiple free grabbing appendages`
- `should pass for actor with two hands both free`

#### 3. Prerequisite Evaluation - Fail Cases

- `should fail when actor has zero free grabbing appendages`
- `should fail when all appendages are locked (holding items)`

#### 4. Edge Cases

- `should handle missing actor gracefully`
- `should handle actor with no grabbing appendages`

#### 5. Condition Definition Validation

- `should use hasFreeGrabbingAppendages operator with parameter 1`
- `condition ID should match what the action references`
