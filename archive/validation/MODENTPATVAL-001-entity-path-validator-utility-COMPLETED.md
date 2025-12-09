# MODENTPATVAL-001: Entity Path Validator Utility

**Status:** COMPLETED
**Completed Date:** 2025-12-09
**Priority:** High (Phase 1 - Foundation)
**Estimated Effort:** 0.5 days
**Dependencies:** None

---

## Outcome

### Summary
Successfully implemented the Entity Path Validator utility as specified. All acceptance criteria met.

### Files Created
- `src/logic/utils/entityPathValidator.js` - Core validation module
- `tests/unit/logic/utils/entityPathValidator.test.js` - Comprehensive unit tests (39 test cases)

### Files Modified
None (as specified in Out of Scope)

### Discrepancies from Original Ticket
Minor implementation differences from the ticket's example code:
1. **Explicit null checks**: Changed `== null` to `=== null || === undefined` to satisfy ESLint's `eqeqeq` rule
2. **TypeScript compatibility**: Added JSDoc typedefs (`PathExtractionResult`, `ValidationError`, `ModifierCondition`) for TypeScript type checking
3. **Type assertions**: Used `/** @type {string} */` assertion for `result.error` in the validation loop to satisfy TypeScript strictness
4. **JSDoc enhancements**: Added `@see` reference to specs file, enhanced return type descriptions, and documented inner `traverse` function

### Validation Results
- **Unit Tests**: 39/39 tests pass
- **TypeScript**: No errors in entityPathValidator.js (pre-existing CLI errors unrelated)
- **ESLint**: 0 errors, 1 minor warning (`jsdoc/reject-any-type` for traverse function parameter)
- **Full Test Suite**: All 39,378 tests pass with no regressions

### Invariants Verified
1. **No changes to existing resolution logic** - `entityPathResolver.js` unchanged
2. **No changes to context building** - `ModifierContextBuilder.js` unchanged
3. **No changes to operators** - `BaseEquipmentOperator.js` unchanged
4. **All existing tests pass** - No regressions introduced
5. **Module is pure utility** - No side effects, no dependencies on runtime state

---

## Objective

Create a new utility module `EntityPathValidator` that validates modifier entity paths according to the documented invariants:
1. All modifier entity paths MUST start with `entity.`
2. Second path segment MUST be one of: `actor`, `primary`, `secondary`, `tertiary`, `location`

This utility will be used by later tickets to integrate validation at load-time and provide CLI tooling.

---

## Files to Touch

### New Files

- `src/logic/utils/entityPathValidator.js`
- `tests/unit/logic/utils/entityPathValidator.test.js`

### Modified Files

None

---

## Out of Scope

**DO NOT modify:**

- `src/logic/utils/entityPathResolver.js` (existing resolution logic unchanged)
- `src/combat/services/ModifierContextBuilder.js` (context building unchanged)
- `src/logic/operators/base/BaseEquipmentOperator.js` (operator unchanged)
- `src/loaders/actionLoader.js` (integration is separate ticket)
- `data/schemas/action.schema.json` (schema enhancement is separate ticket)
- Any mod files in `data/mods/`
- Any DI registration files
- Any other test files

---

## Implementation Details

### EntityPathValidator Module

Created `src/logic/utils/entityPathValidator.js` with the following exports:

- `VALID_ENTITY_ROLES` - Set of valid entity roles: actor, primary, secondary, tertiary, location
- `ENTITY_PREFIX` - Required prefix "entity."
- `validateModifierEntityPath(pathString)` - Validates a single entity path string
- `extractEntityPathsFromLogic(logicObject, operatorNames)` - Extracts entity paths from JSON Logic
- `validateModifierCondition(condition, operatorNames)` - Validates all paths in a modifier condition

---

## Acceptance Criteria

### Tests That Must Pass

All specified tests implemented and passing:

1. **Unit tests for validateModifierEntityPath:** 24 test cases covering valid paths, invalid paths (missing prefix, invalid role, malformed), and error messages

2. **Unit tests for extractEntityPathsFromLogic:** 8 test cases covering operator extraction, nested logic, edge cases

3. **Unit tests for validateModifierCondition:** 7 test cases covering full condition validation

4. **All existing tests continue to pass:** Verified with full test suite (39,378 tests)

5. **Validation commands pass:**
   - `npm run typecheck` - No errors in the new module
   - `npx eslint src/logic/utils/entityPathValidator.js` - 0 errors, 1 minor warning

### Invariants That Must Remain True

All invariants verified as passing.

---

## Verification Steps

All verification steps completed successfully:

```bash
# 1. Created the new files ✅

# 2. Run linting ✅
npx eslint src/logic/utils/entityPathValidator.js
# Result: 0 errors, 1 warning

# 3. Run typecheck ✅
npm run typecheck
# Result: No errors in entityPathValidator.js

# 4. Run unit tests ✅
NODE_ENV=test npx jest tests/unit/logic/utils/entityPathValidator.test.js
# Result: 39/39 tests pass

# 5. Run full test suite ✅
npm run test:unit
# Result: 39,378 tests pass
```

---

## Reference Files

- Existing resolver: `src/logic/utils/entityPathResolver.js`
- Existing resolver tests: `tests/unit/logic/utils/entityPathResolver.test.js`
- Context builder: `src/combat/services/ModifierContextBuilder.js`
- Spec document: `specs/modifier-entity-path-validation.md`

---

## Notes

- The validator is designed to be pure and stateless for easy testing
- The `extractEntityPathsFromLogic` function traverses JSON Logic to find operator calls
- Default operators are `isSlotExposed` and `isSocketCovered` but the set is configurable
- This utility will be consumed by MODENTPATVAL-002 (load-time integration) and MODENTPATVAL-004 (CLI tooling)
