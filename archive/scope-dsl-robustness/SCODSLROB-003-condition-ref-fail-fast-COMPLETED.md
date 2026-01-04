# SCODSLROB-003: Condition Reference Fail-Fast

## Status: COMPLETED

## Summary
Replace the `{ '==': [true, false] }` fallback for unresolved condition_refs with a thrown ScopeResolutionError. This enforces fail-fast behavior as specified by INV-EVAL-2.

## Dependencies
- ~~SCODSLROB-006 (for ConditionResolutionError type, OR use existing ScopeResolutionError)~~
- NONE - uses existing `ScopeResolutionError` class directly

## Assumptions Verified Against Codebase
1. **Line numbers**: `#resolveRule` is at lines 314-327 in `src/logic/jsonLogicEvaluationService.js` ✅
2. **Silent fallback exists**: Returns `{ '==': [true, false] }` for both circular AND unresolved refs ✅
3. **ScopeResolutionError exists**: Already defined at `src/scopeDsl/errors/scopeResolutionError.js` ✅
4. **Existing test expects false**: `additionalBranches.test.js` line 48-56 expects `false` when condition_ref cannot be resolved - this test MUST be updated to expect thrown error

## File List

### Files to Modify
1. `src/logic/jsonLogicEvaluationService.js` (lines 314-327)
   - Replace fallback logic for "Could not resolve" errors with thrown ScopeResolutionError
   - Keep circular reference behavior (log error then throw - already correct after fix)

2. `tests/unit/logic/jsonLogicEvaluationService.additionalBranches.test.js` (lines 48-56)
   - Update "returns false when condition_ref cannot be resolved" test to expect thrown error

### Out of Scope (Minimal Change Principle)
- NO changes to circular reference detection (throw, not fallback)
- NO Levenshtein distance suggestions (future enhancement)
- NO querying available conditions list (future enhancement)
- NO changes to the main evaluate() method
- NO changes to validation logic
- NO changes to filterResolver.js
- NO adding new MCP tools or external dependencies
- NO new error codes needed (use existing ScopeResolutionError)

## Implementation Details

### Current Code (Problem)
```javascript
#resolveRule(rule) {
  try {
    return resolveConditionRefs(rule, this.#gameDataRepository, this.#logger);
  } catch (err) {
    if (
      err.message.startsWith('Circular condition_ref detected') ||
      err.message.startsWith('Could not resolve condition_ref')
    ) {
      this.#logger.error(err.message);
      return { '==': [true, false] }; // SILENT FAILURE for BOTH cases
    }
    throw err;
  }
}
```

### Proposed Code (Minimal Solution)
```javascript
#resolveRule(rule) {
  try {
    return resolveConditionRefs(rule, this.#gameDataRepository, this.#logger);
  } catch (err) {
    if (err.message.startsWith('Circular condition_ref detected')) {
      // Log and throw for circular refs (fail-fast)
      this.#logger.error(err.message);
      throw err;
    }
    if (err.message.startsWith('Could not resolve condition_ref')) {
      // Extract condition name from error message
      const match = err.message.match(/condition_ref '([^']+)'/);
      const conditionRef = match ? match[1] : 'unknown';

      throw new ScopeResolutionError(
        `Condition reference '${conditionRef}' not found`,
        {
          phase: 'condition_resolution',
          parameters: { conditionRef },
          hint: 'Check that the condition is defined in your mod and the ID is correct',
          originalError: err
        }
      );
    }
    throw err;
  }
}
```

Note: Requires adding import at top of file:
```javascript
import { ScopeResolutionError } from '../scopeDsl/errors/scopeResolutionError.js';
```

## Acceptance Criteria

### Tests That Must Pass
1. All existing tests in `tests/unit/logic/jsonLogicEvaluationService.test.js`
2. Updated test in `tests/unit/logic/jsonLogicEvaluationService.additionalBranches.test.js`:
   - "should throw ScopeResolutionError when condition_ref cannot be resolved"
3. Existing test: "rethrows unexpected errors from resolveConditionRefs" (no change needed)
4. Circular ref tests continue to work (now throws instead of returning fallback)

### Invariants That Must Remain True
- INV-EVAL-2: Condition references produce resolved logic OR thrown error (never silent fallback)
- Circular reference detection continues to throw
- Other error types continue to propagate

## Outcome

### Implementation Summary
All changes implemented as specified with minimal code modifications.

### Files Modified

1. **`src/logic/jsonLogicEvaluationService.js`**
   - Added import: `import { ScopeResolutionError } from '../scopeDsl/errors/scopeResolutionError.js';`
   - Modified `#resolveRule` method (lines 316-342) to:
     - Throw original error for circular refs (after logging)
     - Throw `ScopeResolutionError` with context for unresolved condition_refs
     - Removed silent `{ '==': [true, false] }` fallback

2. **`tests/unit/logic/jsonLogicEvaluationService.additionalBranches.test.js`**
   - Added import for `ScopeResolutionError`
   - Updated test "returns false when condition_ref cannot be resolved" → "throws ScopeResolutionError when condition_ref cannot be resolved (INV-EVAL-2)"
   - Test now expects `toThrow(ScopeResolutionError)` instead of `toBe(false)`

3. **`tests/unit/logic/jsonLogicEvaluationService.test.js`**
   - Updated 3 tests to expect throw behavior:
     - "should allow condition_ref as it is whitelisted" → now expects throw after validation passes
     - "should warn when no gameDataRepository is provided" → expects throw instead of false
     - "should handle circular condition_ref errors" → renamed to include "(INV-EVAL-2 fail-fast)", expects throw

### Test Results
- All 258 `jsonLogicEvaluationService` unit tests pass
- All 45 `filterResolver` unit tests pass
- All 477 `scopeDsl` integration tests pass

### Invariants Verified
- **INV-EVAL-2**: ✅ Condition references now produce resolved logic OR thrown error (never silent fallback)
- **Circular ref handling**: ✅ Continues to throw with error logged
- **Error propagation**: ✅ Other error types continue to propagate unchanged
