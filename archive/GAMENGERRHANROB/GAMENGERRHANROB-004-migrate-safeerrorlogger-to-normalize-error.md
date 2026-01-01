# GAMENGERRHANROB-004: Migrate safeErrorLogger.js to Use normalizeError()

## Summary

Replace all 2 inline error normalization patterns in `safeErrorLogger.js` with calls to the new `normalizeError()` utility. This file provides safe error logging with recursion protection.

## Dependencies

- **GAMENGERRHANROB-001** must be completed (`errorNormalization.js` utility exists)

## Files to Touch

### Modify

- `src/utils/safeErrorLogger.js` - Replace 2 error normalization patterns

### Reference (Read Only)

- `src/utils/errorNormalization.js` - Import the utility
- `tests/unit/utils/safeErrorLogger.withGameLoadingModeCleanup.test.js` - Primary cleanup tests
- `tests/unit/utils/safeErrorLogger.optionsNormalization.test.js` - Options normalization tests
- `tests/unit/utils/safeErrorLogger.additionalCoverage.test.js` - Additional coverage tests
- `tests/integration/logging/safeErrorLogger.realDependencies.integration.test.js` - Integration tests

## Out of Scope

- DO NOT modify `gameEngine.js` (GAMENGERRHANROB-002)
- DO NOT modify `engineErrorUtils.js` (GAMENGERRHANROB-003)
- DO NOT change the public API of `SafeErrorLogger` class
- DO NOT change recursion protection behavior
- DO NOT change game loading mode behavior
- DO NOT add new features or behaviors

## Acceptance Criteria

### Migration Requirements

Replace each of these 2 patterns:

| Line(s) | Location | Current Pattern |
|---------|----------|-----------------|
| 357-358 | `withGameLoadingMode()` finally block | `forceError instanceof Error ? forceError : new Error(String(forceError))` |
| 374-377 | `withGameLoadingMode()` finally block | `forceError instanceof Error ? forceError : new Error(String(forceError))` |

Both patterns are in the same function (`withGameLoadingMode()`), handling cleanup errors in the finally block.

### Tests That Must Pass

```bash
# Unit tests for safeErrorLogger (multiple test files exist)
npm run test:unit -- --testPathPattern=safeErrorLogger

# Integration tests
npm run test:integration -- --testPathPattern=safeErrorLogger

# Full unit test suite
npm run test:unit

# ESLint validation
npx eslint src/utils/safeErrorLogger.js
```

### Invariants

1. All errors MUST still be Error instances when logged
2. Recursion protection MUST continue to work
3. Game loading mode MUST continue to batch errors correctly
4. `withGameLoadingMode()` cleanup MUST still complete even on errors
5. All existing tests MUST continue to pass
6. Console fallback behavior MUST remain unchanged

## Implementation Notes

### Import Statement

Add at the top of `safeErrorLogger.js`:

```javascript
import { normalizeError } from './errorNormalization.js';
```

### Transformation for withGameLoadingMode()

**Before (lines 357-358, 374-377):**
```javascript
} catch (forceError) {
  const normalizedForceError =
    forceError instanceof Error
      ? forceError
      : new Error(String(forceError));
  // Handle the error...
}
```

**After:**
```javascript
} catch (forceError) {
  const normalizedForceError = normalizeError(forceError);
  // Handle the error...
}
```

### Minimal Change Approach

This file has only 2 patterns, both nearly identical. The transformation is straightforward:

1. Add import
2. Replace both ternary patterns with `normalizeError()` calls
3. Verify tests pass

No `safeAugmentError()` usage is needed in this file - the normalization patterns don't involve property augmentation.

## Verification Checklist

```bash
# Run any existing tests for this utility
npm run test:unit -- --testPathPattern=safeErrorLogger

# Full unit test suite
npm run test:unit

# Lint modified file
npx eslint src/utils/safeErrorLogger.js

# Type check
npm run typecheck

# Verify no patterns remain
grep -n "instanceof Error ? .* : new Error" src/utils/safeErrorLogger.js
# Should return empty
```

## Definition of Done

- [ ] Import statement added for `normalizeError`
- [ ] Both normalization patterns replaced with `normalizeError()` calls
- [ ] All existing tests pass
- [ ] Full test suite passes: `npm run test:unit`
- [ ] ESLint passes on modified file
- [ ] TypeScript type checking passes
- [ ] No inline `instanceof Error ? ... : new Error(...)` patterns remain
