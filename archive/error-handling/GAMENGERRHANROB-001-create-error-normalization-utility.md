# GAMENGERRHANROB-001: Create Error Normalization Utility

## Status: COMPLETED

## Summary

Create a reusable `normalizeError()` utility function to eliminate the 17+ duplicate error normalization patterns scattered across the codebase. This establishes a single source of truth for error normalization logic.

## Dependencies

- None (foundational ticket)

## Files to Touch

### Create

- `src/utils/errorNormalization.js` - The new utility module
- `tests/unit/utils/errorNormalization.test.js` - Unit tests for the utility

### Reference (Read Only)

- `src/engine/gameEngine.js` - Lines 147, 164, 244, etc. (pattern reference)
- `src/utils/engineErrorUtils.js` - Lines 117-120, 129-132, 173-174 (pattern reference)
- `src/utils/safeErrorLogger.js` - Lines 357-358, 374-377 (pattern reference)
- `tests/unit/validation/componentIdFormat.property.test.js` - Property test pattern reference

## Out of Scope

- DO NOT modify `gameEngine.js` (GAMENGERRHANROB-002)
- DO NOT modify `engineErrorUtils.js` (GAMENGERRHANROB-003)
- DO NOT modify `safeErrorLogger.js` (GAMENGERRHANROB-004)
- DO NOT create property tests yet (GAMENGERRHANROB-005, 006, 007)
- DO NOT create the `GameEngineError` class (explicitly skipped per user decision)
- DO NOT modify any existing production code

## Acceptance Criteria

### Implementation Requirements

1. **`normalizeError(err, context?)` function**
   - Returns `err` unchanged if it's already an `Error` instance
   - Wraps non-Error values in a new `Error` with `String(err)` as message
   - Optionally attaches `context` property if provided
   - Never throws (safe for use in catch blocks)

2. **`safeAugmentError(error, propName, value)` function**
   - Safely attaches properties to Error objects
   - Wraps in try-catch to handle frozen/sealed objects
   - Returns `true` if successful, `false` if augmentation failed
   - Never throws

3. **Module exports**
   - Named exports: `normalizeError`, `safeAugmentError`
   - JSDoc documentation with `@param` and `@returns` annotations

### Tests That Must Pass

```bash
# Unit tests for the new utility
npm run test:unit -- tests/unit/utils/errorNormalization.test.js

# Full unit test suite (no regressions)
npm run test:unit

# ESLint validation
npx eslint src/utils/errorNormalization.js tests/unit/utils/errorNormalization.test.js
```

### Invariants

1. `normalizeError()` ALWAYS returns an `Error` instance
2. `normalizeError()` NEVER throws
3. `safeAugmentError()` NEVER throws
4. Original Error instances pass through unchanged (no re-wrapping)
5. Non-Error values (strings, numbers, objects, null, undefined) all produce valid Error instances
6. Existing tests continue to pass (no behavioral changes elsewhere)

## Implementation Notes

### Function Signature

```javascript
/**
 * Normalizes any thrown value to an Error instance.
 * Use at catch boundaries, not at throw sites.
 *
 * @param {unknown} err - The caught value
 * @param {string} [context] - Optional context string to attach
 * @returns {Error} Always returns an Error instance
 */
export function normalizeError(err, context = '') {
  if (err instanceof Error) return err;
  const normalized = new Error(String(err));
  if (context) normalized.context = context;
  return normalized;
}

/**
 * Safely augments an Error with additional properties.
 * Handles frozen objects, non-writable properties, etc.
 *
 * @param {Error} error - The Error to augment
 * @param {string} propName - Property name to set
 * @param {unknown} value - Value to assign
 * @returns {boolean} True if augmentation succeeded
 */
export function safeAugmentError(error, propName, value) {
  try {
    error[propName] = value;
    return true;
  } catch {
    return false;
  }
}
```

### Test Coverage Requirements

1. **normalizeError() tests**
   - Pass-through: `Error` → same `Error`
   - String conversion: `"message"` → `Error("message")`
   - Number conversion: `42` → `Error("42")`
   - Object conversion: `{foo: 'bar'}` → `Error("[object Object]")`
   - Null handling: `null` → `Error("null")`
   - Undefined handling: `undefined` → `Error("undefined")`
   - Context attachment: verify `.context` property
   - No double-wrapping: normalized errors don't get re-wrapped

2. **safeAugmentError() tests**
   - Normal augmentation succeeds
   - Frozen object returns false
   - Sealed object with new property returns false
   - Non-writable property returns false
   - Never throws on any input

## Future Work (Not in Scope)

After migration tickets (002-004) are complete, the following test simplifications may become possible:

- Reduce `jest.isolateModulesAsync` usage by 50%
- Eliminate `Object.defineProperty` hacks for `cause` blocking
- Replace conditional `isRegistered()` mocks with proper DI patterns

These improvements are tracked as notes, not separate tickets.

## Verification Checklist

```bash
# Create and test the new utility
npm run test:unit -- tests/unit/utils/errorNormalization.test.js

# Verify no regressions
npm run test:unit

# Lint new files
npx eslint src/utils/errorNormalization.js tests/unit/utils/errorNormalization.test.js

# Type check
npm run typecheck
```

## Definition of Done

- [x] `src/utils/errorNormalization.js` created with `normalizeError()` and `safeAugmentError()`
- [x] `tests/unit/utils/errorNormalization.test.js` with comprehensive test coverage
- [x] All test cases pass
- [x] ESLint passes on new files
- [x] TypeScript type checking passes
- [x] Full unit test suite passes: `npm run test:unit`

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**
- Create `normalizeError(err, context?)` function
- Create `safeAugmentError(error, propName, value)` function
- Create comprehensive unit tests

**Actually Changed:**
- ✅ Created `src/utils/errorNormalization.js` with both functions as planned
- ✅ Created `tests/unit/utils/errorNormalization.test.js` with 37 test cases
- **Enhancement:** Added defensive try-catch around `String(err)` to handle objects with throwing `toString()` methods - this ensures the "never throws" invariant is truly guaranteed
- **Enhancement:** Added TypeScript type annotations (`@typedef NormalizedError`, `Record<string, unknown>`) to pass type checking

**Test Coverage Summary:**
- normalizeError tests: 27 tests covering all input types, context attachment, pass-through, and never-throws invariant
- safeAugmentError tests: 10 tests covering normal augmentation, frozen/sealed objects, non-writable properties, and never-throws invariant

**Files Created:**
1. `src/utils/errorNormalization.js` (49 lines)
2. `tests/unit/utils/errorNormalization.test.js` (319 lines)

**No regressions introduced** - only new files added, existing code unchanged as required by the ticket's "Out of Scope" section.
