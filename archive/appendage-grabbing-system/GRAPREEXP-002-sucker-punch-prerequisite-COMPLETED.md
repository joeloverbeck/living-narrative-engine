# GRAPREEXP-002: Add Free Grabbing Appendage Prerequisite to Sucker Punch Action

**Status**: ✅ COMPLETED

## Summary

Add a prerequisite to the `violence:sucker_punch` action requiring the actor to have at least one free grabbing appendage (hand/tentacle/claw). Uses the existing `anatomy:actor-has-free-grabbing-appendage` condition.

## Files to Modify

| File | Change |
|------|--------|
| `data/mods/violence/actions/sucker_punch.action.json` | Add `prerequisites` array after `forbidden_components` |

## Files to Create

| File | Purpose |
|------|---------|
| `tests/integration/mods/violence/sucker_punch_prerequisites.test.js` | Integration tests for prerequisite evaluation |

## Implementation Details

### sucker_punch.action.json

**Current State (lines 13-16)**:
```json
  "forbidden_components": {
    "actor": ["positioning:hugging", "positioning:giving_blowjob", "positioning:doing_complex_performance", "positioning:bending_over"]
  },
  "template": "sucker-punch {target}",
```

**New State**:
```json
  "forbidden_components": {
    "actor": ["positioning:hugging", "positioning:giving_blowjob", "positioning:doing_complex_performance", "positioning:bending_over"]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to throw a punch."
    }
  ],
  "template": "sucker-punch {target}",
```

### Test File Structure

Follow the pattern from `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`:

```javascript
/**
 * @jest-environment node
 *
 * @file Integration tests for violence:sucker_punch action prerequisites
 * @description Tests that the action correctly requires one free grabbing appendage
 *
 * @see data/mods/violence/actions/sucker_punch.action.json
 * @see data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json
 * @see tickets/GRAPREEXP-002-sucker-punch-prerequisite.md
 */
```

## Out of Scope

- **DO NOT** modify the operator (`src/logic/operators/hasFreeGrabbingAppendagesOperator.js`)
- **DO NOT** modify the condition definition (`actor-has-free-grabbing-appendage.condition.json`)
- **DO NOT** modify any other action files
- **DO NOT** modify the test pattern reference file (`wield_threateningly_prerequisites.test.js`)
- **DO NOT** change any other properties in `sucker_punch.action.json` (visual, targets, etc.)

## Acceptance Criteria

### Tests That Must Pass

```bash
# New test file
NODE_ENV=test npx jest tests/integration/mods/violence/sucker_punch_prerequisites.test.js --no-coverage --verbose

# Schema validation
npm run validate

# Lint
npx eslint data/mods/violence/actions/sucker_punch.action.json tests/integration/mods/violence/sucker_punch_prerequisites.test.js
```

### Required Test Suites

#### 1. Action Definition Structure
- `should have prerequisites array defined`
- `should reference anatomy:actor-has-free-grabbing-appendage condition`
- `should have failure_message for user feedback`
- `should preserve other action properties` (id, template, targets, forbidden_components, visual)

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

- [x] Action ID remains `violence:sucker_punch`
- [x] Template remains `sucker-punch {target}`
- [x] Targets remain unchanged (`core:actors_in_location`)
- [x] `forbidden_components` remain unchanged
- [x] `visual` properties remain unchanged
- [x] Existing tests in the project continue to pass
- [x] JSON schema validation passes

## Dependencies

- **Depends on**: Nothing (uses existing infrastructure)
- **Blocked by**: Nothing
- **Blocks**: Nothing (can be done in parallel with other GRAPREEXP tickets)

## Reference Files

| File | Purpose |
|------|---------|
| `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js` | Test pattern template |
| `data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json` | Condition to reference |
| `specs/grabbing-prerequisites-expansion.md` | Full specification |

---

## Outcome

**Completed**: 2025-11-26

### What was changed

1. **Modified** `data/mods/violence/actions/sucker_punch.action.json`:
   - Added `prerequisites` array with `anatomy:actor-has-free-grabbing-appendage` condition reference
   - No other properties modified

2. **Created** `tests/integration/mods/violence/sucker_punch_prerequisites.test.js`:
   - 14 tests covering action definition structure, pass cases, fail cases, edge cases, and condition validation
   - Follows the established pattern from `wield_threateningly_prerequisites.test.js`

### Validation Results

- ✅ All 14 new tests pass
- ✅ `npm run validate` passes
- ✅ ESLint passes (only JSDoc warnings matching the reference pattern)
- ✅ Reference test `wield_threateningly_prerequisites.test.js` continues to pass

### Discrepancies from original plan

**None** - Implementation matched the ticket exactly. All assumptions about file locations, current state, and required changes were accurate.
