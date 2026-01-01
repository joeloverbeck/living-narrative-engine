# GAMENGERRHANROB-005: Property Test - Error Normalization Invariant

## Summary

Add a property-based test to verify the Error Normalization Invariant: "All caught non-Error values produce valid Error instances." This uses fast-check to exhaustively test the `normalizeError()` function against arbitrary inputs.

## Dependencies

- **GAMENGERRHANROB-001** must be completed (`errorNormalization.js` utility exists)

## Files to Touch

### Create

- `tests/unit/utils/errorNormalization.property.test.js` - Property tests for normalization

### Reference (Read Only)

- `src/utils/errorNormalization.js` - The utility being tested
- `tests/unit/validation/componentIdFormat.property.test.js` - Pattern reference for fast-check usage
- `tests/unit/anatomy/bodyDescriptorRegistry.property.test.js` - Additional pattern reference
- `specs/gameEngine-error-handling-robustness.md` - Lines 264-270 (property test specification)

## Out of Scope

- DO NOT modify production code
- DO NOT modify existing unit tests
- DO NOT add property tests for error accumulation (GAMENGERRHANROB-006)
- DO NOT add property tests for augmentation safety (GAMENGERRHANROB-007)

## Acceptance Criteria

### Property Test Implementation

Implement the property test from the specification (lines 264-270):

```javascript
/**
 * Property: All caught non-Error values produce valid Error instances
 */
fc.assert(fc.property(fc.anything(), (value) => {
  const result = normalizeError(value);
  expect(result).toBeInstanceOf(Error);
  expect(result.message).toBeDefined();
}));
```

### Additional Properties to Test

1. **Identity for Errors**: `normalizeError(error) === error` when input is already an Error
2. **Message Content**: Non-Error inputs have message equal to `String(value)`
3. **Context Preservation**: When context is provided, it appears on the result
4. **No Double-Wrapping**: `normalizeError(normalizeError(x)) === normalizeError(x)` for Error inputs

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

1. `normalizeError()` ALWAYS returns an Error instance for ANY input
2. `normalizeError()` NEVER throws for ANY input
3. Error instances pass through unchanged (referential equality)
4. Message property is always defined (never undefined/null)
5. Test runs quickly (<5s even with 1000+ samples)

## Implementation Notes

### File Structure

```javascript
/**
 * @file Property-based tests for error normalization utility.
 * Tests the invariant: All caught non-Error values produce valid Error instances.
 */

import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import { normalizeError, safeAugmentError } from '../../../src/utils/errorNormalization.js';

describe('Error Normalization Property Tests', () => {
  describe('normalizeError()', () => {
    it('Property: always returns an Error instance for any input', () => {
      fc.assert(
        fc.property(fc.anything(), (value) => {
          const result = normalizeError(value);
          expect(result).toBeInstanceOf(Error);
          expect(result.message).toBeDefined();
        })
      );
    });

    it('Property: Error instances pass through unchanged', () => {
      fc.assert(
        fc.property(fc.string(), (message) => {
          const original = new Error(message);
          const result = normalizeError(original);
          expect(result).toBe(original); // Same reference
        })
      );
    });

    it('Property: non-Error values have String(value) as message', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.float(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined)
          ),
          (value) => {
            const result = normalizeError(value);
            expect(result.message).toBe(String(value));
          }
        )
      );
    });

    it('Property: context is attached when provided', () => {
      fc.assert(
        fc.property(fc.anything(), fc.string(), (value, context) => {
          const result = normalizeError(value, context);
          if (!(value instanceof Error) && context) {
            expect(result.context).toBe(context);
          }
        })
      );
    });

    it('Property: normalization is idempotent for Errors', () => {
      fc.assert(
        fc.property(fc.string(), (message) => {
          const error = new Error(message);
          const once = normalizeError(error);
          const twice = normalizeError(once);
          expect(twice).toBe(once);
          expect(twice).toBe(error);
        })
      );
    });
  });
});
```

### fast-check Generators to Use

- `fc.anything()` - Any JavaScript value (strings, numbers, objects, arrays, etc.)
- `fc.string()` - Random strings
- `fc.integer()` - Random integers
- `fc.float()` - Random floats (including edge cases like NaN, Infinity)
- `fc.boolean()` - true/false
- `fc.constant(null)` - Explicit null
- `fc.constant(undefined)` - Explicit undefined
- `fc.object()` - Random objects
- `fc.array()` - Random arrays

### Edge Cases to Consider

The `fc.anything()` generator will produce edge cases including:
- Empty strings
- Very long strings
- Special characters
- Objects with circular references
- Arrays
- Functions
- Symbols
- BigInt values
- Frozen/sealed objects

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

- [x] Property test file created at `tests/unit/utils/errorNormalization.property.test.js`
- [x] Main invariant tested: all inputs produce valid Error instances
- [x] Identity property tested: Errors pass through unchanged
- [x] Message content property tested: String(value) for non-Errors
- [x] Context preservation tested
- [x] Idempotence tested for Error inputs
- [x] All property tests pass with default sample counts
- [x] ESLint passes on test file
- [x] Full test suite passes: `npm run test:unit`

## Status: COMPLETED

Completed on: 2026-01-01

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**
- Create property test file with 5 properties from the template

**Actual Implementation:**
- Created `tests/unit/utils/errorNormalization.property.test.js` with **7 properties** (2 additional):
  1. `Property: always returns an Error instance for any input` - Core invariant
  2. `Property: Error instances pass through unchanged` - Identity property
  3. `Property: non-Error values have String(value) as message` - Message content
  4. `Property: context is attached when provided for non-Error values` - Context preservation
  5. `Property: normalization is idempotent for Errors` - Idempotence
  6. `Property: never throws for any input` - **Added** to strengthen never-throws invariant
  7. `Property: message is always a string (never undefined or null)` - **Added** to verify message type invariant

**Minor Deviation from Template:**
- The template's context test used conditional `expect()` which violates `jest/no-conditional-expect` lint rule
- Refactored to use a generator that excludes Error instances, avoiding the conditional entirely

**No Production Code Changes:** As specified in "Out of Scope"

### Test Results
- All 7 property tests pass
- Full unit test suite (42085 tests) passes
- ESLint passes on new test file
