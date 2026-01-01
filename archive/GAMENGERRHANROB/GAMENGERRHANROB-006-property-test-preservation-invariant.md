# GAMENGERRHANROB-006: Property Test - Error Preservation Invariant

## Status: ✅ COMPLETED

## Summary

Add a property-based test to verify the Error Preservation Invariant: "Cascading failures preserve all error information." This tests the `cleanupErrors` accumulation pattern used in `gameEngine.js`.

## Dependencies

- **GAMENGERRHANROB-001** must be completed (`errorNormalization.js` utility exists) ✅
- **GAMENGERRHANROB-005** should be completed (establishes property test file structure) ✅

## Files to Touch

### Modify

- `tests/unit/utils/errorNormalization.property.test.js` - Add preservation property tests

### Reference (Read Only)

- `src/utils/errorNormalization.js` - The utility being tested
- `src/engine/gameEngine.js` - Lines 601-620 (`attachCleanupError()` pattern reference)
- `specs/gameEngine-error-handling-robustness.md` - Lines 274-281 (property test specification)

## Out of Scope

- DO NOT modify production code
- DO NOT modify existing unit tests
- DO NOT test gameEngine.js directly (this tests the utility patterns)
- DO NOT add property tests for augmentation safety (GAMENGERRHANROB-007)

## Acceptance Criteria

### Property Test Implementation

Implement the property test from the specification (lines 274-281):

```javascript
/**
 * Property: Cascading failures preserve all error information
 */
fc.assert(fc.property(fc.array(fc.string()), (errorMessages) => {
  const errors = errorMessages.map(m => new Error(m));
  const accumulated = accumulateErrors(errors);
  expect(accumulated.cleanupErrors).toHaveLength(errors.length - 1);
}));
```

### Helper Function Required

Create an `accumulateErrors()` helper that mirrors the gameEngine pattern:

```javascript
/**
 * Accumulates multiple errors onto a primary error.
 * Mirrors the pattern from gameEngine.js attachCleanupError().
 *
 * @param {Error[]} errors - Array of errors to accumulate
 * @returns {Error} Primary error with cleanupErrors array attached
 */
function accumulateErrors(errors) {
  if (errors.length === 0) {
    return new Error('No errors to accumulate');
  }

  const primaryError = errors[0];
  const cleanupErrors = errors.slice(1);

  if (cleanupErrors.length > 0) {
    primaryError.cleanupErrors = cleanupErrors;
  }

  return primaryError;
}
```

### Additional Properties to Test

1. **Non-Empty Array**: Primary error is always the first error
2. **All Errors Preserved**: Every cleanup error appears in the array
3. **Order Preservation**: Cleanup errors maintain their original order
4. **Empty Array Handling**: Single-element arrays have no cleanupErrors property

### Tests That Must Pass

```bash
# Property tests
npm run test:unit -- tests/unit/utils/errorNormalization.property.test.js

# Full unit test suite
npm run test:unit

# ESLint validation
npx eslint tests/unit/utils/errorNormalization.property.test.js
```

### Invariants

1. Primary error is the first error in the array
2. All cleanup errors are preserved (none lost)
3. Cleanup errors array length equals `errors.length - 1`
4. Error accumulation NEVER throws
5. Original error messages are preserved

## Implementation Notes

### Add to Property Test File

Add a new `describe` block to the existing property test file:

```javascript
describe('Error Accumulation Property Tests', () => {
  /**
   * Helper to accumulate errors, mirroring gameEngine pattern.
   */
  function accumulateErrors(errors) {
    if (errors.length === 0) {
      return { primary: null, cleanupErrors: [] };
    }

    const primaryError = errors[0];
    const cleanupErrors = errors.slice(1);

    if (cleanupErrors.length > 0) {
      if (!safeAugmentError(primaryError, 'cleanupErrors', cleanupErrors)) {
        // Fallback if augmentation fails
        return { primary: primaryError, cleanupErrors };
      }
    }

    return { primary: primaryError, cleanupErrors: primaryError.cleanupErrors || [] };
  }

  it('Property: cascading failures preserve all error information', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 20 }),
        (errorMessages) => {
          const errors = errorMessages.map((m) => new Error(m));
          const result = accumulateErrors(errors);

          expect(result.primary).toBe(errors[0]);
          expect(result.cleanupErrors).toHaveLength(errors.length - 1);

          // Verify all cleanup errors are preserved
          for (let i = 1; i < errors.length; i++) {
            expect(result.cleanupErrors).toContain(errors[i]);
          }
        }
      )
    );
  });

  it('Property: single error has no cleanupErrors', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const errors = [new Error(message)];
        const result = accumulateErrors(errors);

        expect(result.primary).toBe(errors[0]);
        expect(result.cleanupErrors).toHaveLength(0);
      })
    );
  });

  it('Property: error order is preserved in cleanupErrors', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 2, maxLength: 10 }),
        (errorMessages) => {
          const errors = errorMessages.map((m) => new Error(m));
          const result = accumulateErrors(errors);

          // Verify order matches
          for (let i = 1; i < errors.length; i++) {
            expect(result.cleanupErrors[i - 1]).toBe(errors[i]);
          }
        }
      )
    );
  });

  it('Property: error messages are preserved', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
        (errorMessages) => {
          const errors = errorMessages.map((m) => new Error(m));
          const result = accumulateErrors(errors);

          expect(result.primary.message).toBe(errorMessages[0]);

          for (let i = 1; i < errorMessages.length; i++) {
            expect(result.cleanupErrors[i - 1].message).toBe(errorMessages[i]);
          }
        }
      )
    );
  });
});
```

### Edge Cases to Consider

- Empty error array (handled by minLength constraint or explicit test)
- Single error (no cleanup errors to accumulate)
- Many errors (verify no truncation)
- Errors with special characters in messages
- Errors with very long messages

## Verification Checklist

```bash
# Run property tests
npm run test:unit -- tests/unit/utils/errorNormalization.property.test.js

# Verify no regressions
npm run test:unit

# Lint test file
npx eslint tests/unit/utils/errorNormalization.property.test.js
```

## Definition of Done

- [x] `accumulateErrors()` helper function added to property test file
- [x] Main preservation property tested: all errors preserved
- [x] Single error edge case tested
- [x] Order preservation tested
- [x] Message preservation tested
- [x] All property tests pass with default sample counts
- [x] ESLint passes on test file
- [x] Full test suite passes: `npm run test:unit`

---

## Outcome

### What Was Planned

Add property-based tests for the Error Preservation Invariant to verify that cascading failures preserve all error information.

### What Was Actually Changed

**Modified file**: `tests/unit/utils/errorNormalization.property.test.js`

Added a new `describe('Error Accumulation Property Tests')` block with:

1. **Helper function `accumulateErrors()`**: Mirrors the `attachCleanupError()` pattern from `gameEngine.js` (lines 601-620), using `safeAugmentError()` for safe property assignment with fallback handling.

2. **6 new property tests**:
   - `Property: cascading failures preserve all error information` - Core invariant test
   - `Property: single error has no cleanupErrors` - Edge case for single error
   - `Property: error order is preserved in cleanupErrors` - Order preservation
   - `Property: error messages are preserved` - Message preservation
   - `Property: empty array returns null primary with empty cleanupErrors` - Empty array edge case
   - `Property: accumulation never throws` - Safety invariant

### Deviations from Plan

1. **Minor deviation**: The helper function returns `{ primary, cleanupErrors }` object instead of the raw error, making tests more explicit about which property contains what. This is a cleaner interface that matches the spec's implementation notes.

2. **Additional test**: Added `Property: empty array returns null primary with empty cleanupErrors` as an explicit edge case test (not using property-based testing for this specific case since it's a single scenario).

3. **Additional test**: Added `Property: accumulation never throws` to verify Invariant #4 from the ticket ("Error accumulation NEVER throws").

### Verification Results

- All 13 property tests pass (7 existing + 6 new)
- ESLint passes with no errors
- All error normalization tests pass (50 total across both test files)
