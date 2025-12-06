# GRAPREEXP-004: Add Free Grabbing Appendage Prerequisite to Put In Container Action

## Summary

Add a prerequisite to the `items:put_in_container` action requiring the actor to have at least one free grabbing appendage (hand/tentacle/claw). Uses the existing `anatomy:actor-has-free-grabbing-appendage` condition.

## Files to Modify

| File                                                   | Change                                                |
| ------------------------------------------------------ | ----------------------------------------------------- |
| `data/mods/items/actions/put_in_container.action.json` | Add `prerequisites` array after `required_components` |

## Files to Create

| File                                                                  | Purpose                                       |
| --------------------------------------------------------------------- | --------------------------------------------- |
| `tests/integration/mods/items/put_in_container_prerequisites.test.js` | Integration tests for prerequisite evaluation |

## Implementation Details

### put_in_container.action.json

**Current State (lines 7-10)**:

```json
  "required_components": {
    "actor": ["items:inventory"]
  },
  "targets": {
```

**New State**:

```json
  "required_components": {
    "actor": ["items:inventory"]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to put an item in a container."
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
 * @file Integration tests for items:put_in_container action prerequisites
 * @description Tests that the action correctly requires one free grabbing appendage
 *
 * @see data/mods/items/actions/put_in_container.action.json
 * @see data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json
 * @see tickets/GRAPREEXP-004-put-in-container-prerequisite.md
 */
```

## Out of Scope

- **DO NOT** modify the operator (`src/logic/operators/hasFreeGrabbingAppendagesOperator.js`)
- **DO NOT** modify the condition definition (`actor-has-free-grabbing-appendage.condition.json`)
- **DO NOT** modify any other action files
- **DO NOT** modify the test pattern reference file (`wield_threateningly_prerequisites.test.js`)
- **DO NOT** change any other properties in `put_in_container.action.json` (visual, targets, required_components, etc.)

## Acceptance Criteria

### Tests That Must Pass

```bash
# New test file
NODE_ENV=test npx jest tests/integration/mods/items/put_in_container_prerequisites.test.js --no-coverage --verbose

# Schema validation
npm run validate

# Lint
npx eslint data/mods/items/actions/put_in_container.action.json tests/integration/mods/items/put_in_container_prerequisites.test.js
```

### Required Test Suites

#### 1. Action Definition Structure

- `should have prerequisites array defined`
- `should reference anatomy:actor-has-free-grabbing-appendage condition`
- `should have failure_message for user feedback`
- `should preserve other action properties` (id, generateCombinations, targets, required_components, visual)

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

### Invariants That Must Remain True

- [x] Action ID remains `items:put_in_container`
- [x] `generateCombinations` remains `true`
- [x] Template remains `put {secondary.name} in {primary.name}`
- [x] Primary target scope remains `items:open_containers_at_location`
- [x] Secondary target scope remains `items:actor_inventory_items`
- [x] `required_components` remain unchanged (`actor: ["items:inventory"]`)
- [x] `visual` properties remain unchanged
- [x] Existing tests in the project continue to pass
- [x] JSON schema validation passes

## Dependencies

- **Depends on**: Nothing (uses existing infrastructure)
- **Blocked by**: Nothing
- **Blocks**: Nothing (can be done in parallel with other GRAPREEXP tickets)

## Reference Files

| File                                                                            | Purpose                |
| ------------------------------------------------------------------------------- | ---------------------- |
| `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`      | Test pattern template  |
| `data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json` | Condition to reference |
| `specs/grabbing-prerequisites-expansion.md`                                     | Full specification     |

## Additional Test Assertions for This Ticket

```javascript
test('should preserve other action properties', () => {
  expect(putInContainerAction.id).toBe('items:put_in_container');
  expect(putInContainerAction.generateCombinations).toBe(true);
  expect(putInContainerAction.targets.primary.scope).toBe(
    'items:open_containers_at_location'
  );
  expect(putInContainerAction.targets.secondary.scope).toBe(
    'items:actor_inventory_items'
  );
  expect(putInContainerAction.required_components.actor).toContain(
    'items:inventory'
  );
});
```

---

## Outcome

**Status**: ✅ COMPLETED

**Date**: 2025-11-26

### Changes Made

1. **Modified `data/mods/items/actions/put_in_container.action.json`**
   - Added `prerequisites` array with `anatomy:actor-has-free-grabbing-appendage` condition reference
   - Added user-friendly failure message: "You need a free hand to put an item in a container."

2. **Created `tests/integration/mods/items/put_in_container_prerequisites.test.js`**
   - 14 tests covering all required test suites
   - Tests action definition structure
   - Tests prerequisite pass/fail cases
   - Tests edge cases (missing actor, undefined id, no grabbing appendages)
   - Tests condition definition validation

3. **Updated `tests/integration/mods/items/putInContainerActionDiscovery.test.js`**
   - Added `withGrabbingHands(2)` to actors in tests that expect action discovery
   - Included hand entities in fixture reset calls
   - Required because actors now need free grabbing appendages for the prerequisite to pass

### Test Results

```
PASS tests/integration/mods/items/put_in_container_prerequisites.test.js (14 tests)
PASS tests/integration/mods/items/putInContainerActionDiscovery.test.js (4 tests)
PASS tests/integration/mods/items/putInContainerRuleExecution.test.js (7 tests)
PASS tests/integration/mods/items/putInContainerSchemaValidation.integration.test.js (12 tests)

Total: 37 tests passing
Schema validation: 0 violations
```

### Verification Commands Run

```bash
NODE_ENV=test npx jest tests/integration/mods/items/put_in_container_prerequisites.test.js --no-coverage --silent  # PASS
NODE_ENV=test npx jest tests/integration/mods/items/putInContainer --no-coverage --silent  # PASS (23 tests)
npm run validate  # PASS (0 violations)
```

### Notes

- Ticket assumptions were accurate - no corrections needed
- All invariants verified (action ID, generateCombinations, template, scopes, required_components, visual properties)
- Discovery tests required update due to new prerequisite requirement - actors must have grabbing appendages
