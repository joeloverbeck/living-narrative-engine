# APPGRAOCCSYS-009: Create Condition Files for Grabbing Checks

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

**Status**: COMPLETED

## Summary

Create reusable condition files that check whether an actor has free grabbing appendages. These conditions can be referenced in action prerequisites to validate that actors have enough free hands before presenting weapon-related actions.

## Dependencies

- APPGRAOCCSYS-001 (anatomy:can_grab component schema)
- APPGRAOCCSYS-006 (hasFreeGrabbingAppendages operator)

## Files Created

| File | Purpose |
|------|---------|
| `data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json` | Checks if actor has at least 1 free grabbing appendage |
| `data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json` | Checks if actor has at least 2 free grabbing appendages |
| `tests/unit/conditions/actor-has-free-grabbing-appendage.test.js` | Unit tests for grabbing appendage conditions |

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**:
   - [x] Condition files pass JSON schema validation
   - [x] `npm run validate:mod -- --mod=anatomy` passes

2. **Unit Tests**: `tests/unit/conditions/actor-has-free-grabbing-appendage.test.js`
   - [x] Condition logic evaluates to true when actor has free appendages
   - [x] Condition logic evaluates to false when actor has no free appendages
   - [x] Condition logic evaluates to false when actor has no grabbing appendages at all
   - [x] Two-appendage condition requires exactly 2+ free appendages

3. **Integration Tests**:
   - [x] `npm run test:ci` passes
   - [x] Conditions can be referenced by action prerequisites

4. **Existing Tests**: `npm run test:unit` should pass
   - [x] All 27 condition tests pass

### Invariants That Must Remain True

1. [x] Follows condition schema pattern from existing conditions
2. [x] Uses the `hasFreeGrabbingAppendages` operator (not direct component checks)
3. [x] Condition IDs follow `modId:condition-name` format
4. [x] Conditions are reusable across multiple actions
5. [x] No modification to existing conditions required

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Ticket Corrections Made Before Implementation:**

1. **Test file location**: Original ticket incorrectly specified `tests/unit/mods/anatomy/conditions/` but project pattern uses `tests/unit/conditions/`. Corrected before implementation.

2. **Test template rewrite**: Original test template used non-existent testBed methods (`getConditionEvaluator()`, `loadMods()`, `getCondition()`, `createActor()`, `addComponentToEntity()`). Replaced with correct pattern using `JsonLogicEvaluationService` and `JsonLogicCustomOperators` with mocked `grabbingUtils.countFreeGrabbingAppendages`.

3. **Validation command syntax**: `npm run validate:mod:anatomy` doesn't work; correct syntax is `npm run validate:mod -- --mod=anatomy`.

**Implementation Details:**

- Created `data/mods/anatomy/conditions/` folder (didn't exist)
- Created both condition JSON files exactly as specified
- Created comprehensive test file with 11 test cases covering:
  - Single appendage condition (4 tests)
  - Two appendages condition (4 tests)
  - Edge cases (3 tests): missing actor, null actor id, typical action context

**Test Results:**
- All 11 condition tests pass
- All 27 tests in `tests/unit/conditions/` pass
- Mod validation passes

**No Deviations from Corrected Plan:** After ticket corrections, implementation matched the corrected specifications exactly.
