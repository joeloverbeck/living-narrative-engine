# EXPSYSROB-005: Test Utilities for Prototype Key Fallbacks

## Status: COMPLETED (2026-01-08)

## Summary

Add helper functions and constants to `tests/common/expressionTestUtils.js` for consistent handling of prototype key fallbacks in tests.

## Background

The integration test `expressionFlow.integration.test.js` already uses a fallback pattern for sexual keys:
```javascript
const effectiveSexualKeys = sexualKeys.length > 0
  ? sexualKeys
  : ['sex_excitation', 'sex_inhibition', 'baseline_libido'];
```

This pattern should be standardized in test utilities to:
1. Reduce duplication across tests
2. Ensure consistent fallback values
3. Make test intent clearer

## Assumptions Analysis (Verified 2026-01-08)

**Assumption 1**: "Fallback values match production core:sexual_prototypes lookup"
- **INCORRECT**: The values `['sex_excitation', 'sex_inhibition', 'baseline_libido']` are **input axis names** for the `core:sexual_state` component, not prototype entry keys.
- **Actual production keys** in `sexual_prototypes.lookup.json`: `sexual_lust`, `passion`, `sexual_sensual_pleasure`, etc.
- **Why this still works**: The tests mock `getSexualPrototypeKeys()` and `calculateSexualStates()` together, so the fallback values only need to be **consistent within the test mocks**, not match production.

**Assumption 2**: "DEFAULT_EMOTION_KEYS = ['joy', 'sadness', 'anger', 'fear', 'disgust', 'surprise']"
- **PARTIALLY CORRECT**: These are valid prototype keys from `emotion_prototypes.lookup.json`, but the lookup contains ~70+ emotions.
- **Acceptable**: For test purposes, a minimal subset is fine.

**Corrected Scope**: The fallback constants are for **test mocking consistency**, not production parity. The JSDoc comments should reflect this distinction.

## File List (Expected to Touch)

### Existing Files
- `tests/common/expressionTestUtils.js`

### Reference Files (may need updates)
- `tests/integration/expressions/expressionFlow.integration.test.js` (use new utilities)

## Out of Scope (MUST NOT Change)

- Production code in `src/`
- Test logic (only add utilities, don't change test behavior)
- Other test utility files
- Schema files

## Implementation Details

1. Add constants to `expressionTestUtils.js`:
   ```javascript
   /**
    * Default sexual state keys for tests where expressions don't reference sexual states.
    * These are arbitrary test values for mock consistency; production keys differ
    * (see core:sexual_prototypes lookup for actual prototype names).
    */
   export const DEFAULT_SEXUAL_KEYS = ['sex_excitation', 'sex_inhibition', 'baseline_libido'];

   /**
    * Default emotion keys for tests.
    * These represent a minimal subset for mock consistency; production lookup
    * contains ~70+ emotions (see core:emotion_prototypes).
    */
   export const DEFAULT_EMOTION_KEYS = ['joy', 'sadness', 'anger', 'fear', 'disgust', 'surprise'];
   ```

2. Add helper function:
   ```javascript
   /**
    * Ensures prototype keys array is non-empty, using fallback if needed.
    * Use this when collectExpressionStateKeys() returns empty arrays because
    * the expressions being tested don't reference certain state variables.
    * @param {string[]} collectedKeys - Keys collected from expressions
    * @param {string[]} fallbackKeys - Fallback keys if collected is empty
    * @returns {string[]} Non-empty key array
    */
   export const ensurePrototypeKeys = (collectedKeys, fallbackKeys) => {
     if (collectedKeys && collectedKeys.length > 0) {
       return collectedKeys;
     }
     return fallbackKeys;
   };
   ```

3. Update `expressionFlow.integration.test.js` to use new utilities (optional, for consistency)

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:integration -- --runInBand --testPathPattern="expressionFlow"`
2. `npm run test:integration -- --runInBand --testPathPattern="expressions"`

### Invariants That Must Remain True

1. Existing tests continue to pass without modification
2. New utilities are optional (tests can use them or not)
3. Fallback values are consistent test values (not required to match production lookups)
4. JSDoc comments explain usage and clarify test vs production distinction

---

## Outcome (2026-01-08)

### What Was Actually Changed

1. **`tests/common/expressionTestUtils.js`**: Added three new exports:
   - `DEFAULT_SEXUAL_KEYS` constant with fallback keys for test mocking
   - `DEFAULT_EMOTION_KEYS` constant with fallback keys for test mocking
   - `ensurePrototypeKeys(collectedKeys, fallbackKeys)` helper function

2. **`tests/integration/expressions/expressionFlow.integration.test.js`**: Refactored to use new utilities:
   - Replaced inline ternary fallback with `ensurePrototypeKeys()` call
   - Imported `DEFAULT_SEXUAL_KEYS` constant

3. **`tests/unit/common/expressionTestUtils.test.js`** (NEW): Created comprehensive unit tests:
   - 21 test cases covering all new exports
   - Tests for edge cases (null, undefined, empty arrays)
   - Integration tests with existing utilities (`buildStateMap`, `collectExpressionStateKeys`)

### Changes vs Original Plan

| Aspect | Original Plan | Actual Implementation |
|--------|---------------|----------------------|
| Fallback semantics | "Match production lookup" | Corrected to "test mocking consistency" (docs clarified) |
| JSDoc comments | Generic | Enhanced with production vs test distinction |
| Unit tests | Not specified | Added comprehensive unit test suite (21 tests) |
| Integration test update | Optional | Completed for consistency |

### Test Results

- All 12 expression integration test suites pass (57 tests)
- All 21 unit tests for expressionTestUtils pass
- No production code changes required

### Key Insight Documented

The ticket's original assumption that fallback values should match production lookups was incorrect. The values `['sex_excitation', 'sex_inhibition', 'baseline_libido']` are **input axis names**, not prototype entry keys. This works because tests mock both `getSexualPrototypeKeys()` and `calculateSexualStates()` together, requiring only internal consistency.
