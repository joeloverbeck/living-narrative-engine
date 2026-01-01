# GAMENGERRHANROB-007: Property Test - Augmentation Safety Invariant

**Status: ✅ COMPLETED**

## Summary

Add a property-based test to verify the Augmentation Safety Invariant: "Error augmentation never throws." This tests the `safeAugmentError()` function against arbitrary inputs and edge cases.

## Dependencies

- **GAMENGERRHANROB-001** must be completed (`errorNormalization.js` utility exists) ✅
- **GAMENGERRHANROB-005** should be completed (establishes property test file structure) ✅

## Files to Touch

### Modify

- `tests/unit/utils/errorNormalization.property.test.js` - Add augmentation safety property tests

### Reference (Read Only)

- `src/utils/errorNormalization.js` - The utility being tested
- `specs/gameEngine-error-handling-robustness.md` - Lines 283-289 (property test specification)

## Out of Scope

- DO NOT modify production code
- DO NOT modify existing unit tests
- DO NOT test gameEngine.js directly

## Acceptance Criteria

### Property Test Implementation

Implement the property test from the specification (lines 283-289):

```javascript
/**
 * Property: Error augmentation never throws
 */
fc.assert(fc.property(fc.anything(), (value) => {
  expect(() => safeAugmentError(new Error('test'), 'prop', value)).not.toThrow();
}));
```

### Additional Properties to Test

1. **Return Value**: Always returns boolean (true or false)
2. **Success Verification**: When true, property is actually set
3. **Frozen Objects**: Returns false for frozen Error objects
4. **Sealed Objects**: Returns false for new properties on sealed objects
5. **Non-Writable Properties**: Returns false when trying to overwrite non-writable

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

1. `safeAugmentError()` NEVER throws for ANY input
2. Return value is ALWAYS a boolean
3. When returning true, the property IS set on the object
4. When returning false, the object is unchanged (or change failed)

## Implementation Notes

### Add to Property Test File

Add a new `describe` block to the existing property test file:

```javascript
describe('safeAugmentError() Property Tests', () => {
  it('Property: error augmentation never throws', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        expect(() =>
          safeAugmentError(new Error('test'), 'prop', value)
        ).not.toThrow();
      })
    );
  });

  it('Property: always returns a boolean', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const result = safeAugmentError(new Error('test'), 'prop', value);
        expect(typeof result).toBe('boolean');
      })
    );
  });

  it('Property: when true, property is actually set', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.anything(),
        (propName, value) => {
          // Skip reserved property names that might conflict
          fc.pre(
            !['message', 'stack', 'name', 'cause'].includes(propName)
          );

          const error = new Error('test');
          const result = safeAugmentError(error, propName, value);

          if (result === true) {
            expect(error[propName]).toBe(value);
          }
        }
      )
    );
  });

  it('Property: frozen objects return false', () => {
    fc.assert(
      fc.property(fc.string(), fc.anything(), (propName, value) => {
        const error = Object.freeze(new Error('frozen'));
        const result = safeAugmentError(error, propName, value);
        expect(result).toBe(false);
      })
    );
  });

  it('Property: sealed objects return false for new properties', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const error = Object.seal(new Error('sealed'));
        // 'newProp' doesn't exist on the sealed object
        const result = safeAugmentError(error, 'newProp', value);
        expect(result).toBe(false);
      })
    );
  });

  it('Property: non-writable properties return false', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const error = new Error('test');
        Object.defineProperty(error, 'readonly', {
          value: 'original',
          writable: false,
          configurable: false,
        });
        const result = safeAugmentError(error, 'readonly', value);
        expect(result).toBe(false);
      })
    );
  });

  it('Property: augmentation never modifies Error message', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.anything(),
        (message, propName, value) => {
          // Skip 'message' property itself
          fc.pre(propName !== 'message');

          const error = new Error(message);
          safeAugmentError(error, propName, value);
          expect(error.message).toBe(message);
        }
      )
    );
  });
});
```

### Edge Cases to Consider

The `fc.anything()` generator will produce edge cases including:
- Circular references (objects referencing themselves)
- Symbols as values
- Functions as values
- Very large objects
- Deeply nested objects
- Proxy objects

### Frozen/Sealed Object Tests

These are important because gameEngine.js uses try-catch around property assignment specifically to handle these cases:

```javascript
try {
  primaryError.cause = secondaryError;
} catch {
  primaryError.engineResetError = secondaryError;
}
```

The `safeAugmentError()` function encapsulates this pattern.

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

- [x] Main safety property tested: never throws for any input
- [x] Boolean return value property tested
- [x] Success verification property tested
- [x] Frozen object handling tested
- [x] Sealed object handling tested
- [x] Non-writable property handling tested
- [x] Message preservation tested
- [x] All property tests pass with default sample counts
- [x] ESLint passes on test file
- [x] Full test suite passes: `npm run test:unit`

---

## Outcome

### Completed: 2026-01-01

### What Was Actually Changed vs Originally Planned

**Originally Planned:**
- Add 7 new property tests for `safeAugmentError()` to the existing property test file

**Actually Changed:**
- Added 7 new property tests to `tests/unit/utils/errorNormalization.property.test.js`:
  1. `Property: error augmentation never throws`
  2. `Property: always returns a boolean`
  3. `Property: when true, property is actually set`
  4. `Property: frozen objects return false`
  5. `Property: sealed objects return false for new properties`
  6. `Property: non-writable properties return false`
  7. `Property: augmentation never modifies Error message`

**Minor Deviation:**
- The "when true, property is actually set" test was refactored from using a conditional `if (result === true)` with `expect()` to using `fc.pre(result === true)` to satisfy the ESLint `jest/no-conditional-expect` rule. This is semantically equivalent but more idiomatic for property-based testing.

### Test Results
- Property tests: 20/20 passing (13 original + 7 new)
- ESLint: No errors
- All errorNormalization tests: 57/57 passing

### Files Modified
- `tests/unit/utils/errorNormalization.property.test.js` - Added `safeAugmentError() Property Tests` describe block

### No Production Code Changes
As specified in the ticket's "Out of Scope" section, no production code was modified.
