# JSOLOGCUSOPEREF-002: Complete Cache Management System

**Priority**: 🔴 Critical → 🟢 Medium (corrected)
**Estimated Effort**: 1 hour → 30 minutes (corrected)
**Phase**: 1 - Critical Fixes
**Status**: ✅ COMPLETED

---

## Summary

~~The `clearCaches()` method in `JsonLogicCustomOperators` only clears the cache for `socketExposureOp`, but `IsSocketCoveredOperator` has its own internal cache (`#socketToSlotCache`) that isn't being cleared. This causes test isolation failures and potential stale data issues.~~

**CORRECTED**: The original premise was incorrect. The cache IS being cleared correctly through the delegation chain:
- `JsonLogicCustomOperators.clearCaches()` → `SocketExposureOperator.clearCache()` → `IsSocketCoveredOperator.clearCache()` → clears `#socketToSlotCache`

The **actual improvement** is for maintainability: adding a tracking array (`#operatorsWithCaches`) so future operators with caches are automatically included in `clearCaches()` without requiring manual updates.

---

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/logic/jsonLogicCustomOperators.js` | Modify - track all operators with caches and clear them all |

---

## Out of Scope

**DO NOT modify:**
- Individual operator files (they already have `clearCache()` methods where needed)
- Test files (unless adding new tests for cache clearing)
- Any DI registration files
- Any other source files

---

## Implementation Details

### Step 1: Add Operator Tracking Array

Add a private field to track all operators that have caches:

```javascript
#operatorsWithCaches = [];
```

### Step 2: Track Operators During Registration

In `registerOperators()`, after creating each operator that has a cache, add it to the tracking array:

```javascript
// Existing code
this.isSocketCoveredOp = new IsSocketCoveredOperator({...});
// Add tracking
this.#operatorsWithCaches.push(this.isSocketCoveredOp);

// Existing code
this.socketExposureOp = new SocketExposureOperator({...});
// Add tracking
this.#operatorsWithCaches.push(this.socketExposureOp);
```

### Step 3: Update clearCaches() Method

Replace the current implementation:

```javascript
clearCaches() {
  this.#logger.debug('Clearing custom operator caches');
  for (const operator of this.#operatorsWithCaches) {
    if (typeof operator.clearCache === 'function') {
      operator.clearCache();
    }
  }
}
```

### Step 4: Verify Operators with Caches

Check these operator files for `clearCache()` methods:
- `src/logic/operators/isSocketCoveredOperator.js` - Has `#socketToSlotCache`
- `src/logic/operators/socketExposureOperator.js` - May delegate to `IsSocketCoveredOperator`

---

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js
npm run test:integration -- tests/integration/logic/
```

### Specific Test Assertions

1. **Cache clearing test**:
   - After calling `clearCaches()`, `IsSocketCoveredOperator.#socketToSlotCache` must be empty
   - Multiple operators' caches are cleared in single call

2. **Test isolation**:
   - Running tests in sequence with `--runInBand` should produce same results as parallel execution
   - No stale socket-to-slot mappings persisting between tests

### Invariants That Must Remain True

1. **All caches cleared**: Every operator with a cache must have its cache cleared when `clearCaches()` is called
2. **No errors on empty**: Calling `clearCaches()` before any operators are registered must not throw
3. **Logging preserved**: Debug logging of cache clearing must still occur
4. **Type safety**: Only operators with `clearCache()` method are called

---

## Verification Commands

```bash
# Run cache-related tests
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js --testNamePattern="cache" --verbose

# Run tests in sequence to verify isolation
npm run test:unit -- tests/unit/logic/ --runInBand --verbose

# Verify no regressions
npm run test:ci

# Lint modified file
npx eslint src/logic/jsonLogicCustomOperators.js
```

---

## Notes

- The `#socketToSlotCache` in `IsSocketCoveredOperator` is the primary cache causing issues
- `SocketExposureOperator` may delegate to `IsSocketCoveredOperator` for caching - verify this relationship
- Consider adding a test that specifically verifies cache clearing works correctly

---

## Outcome

### What Was Originally Planned
The ticket assumed the `clearCaches()` method was broken and not clearing `IsSocketCoveredOperator`'s internal cache. The plan was to:
1. Fix the broken cache clearing
2. Add tracking for all operators with caches

### What Was Actually Changed
**Analysis revealed the ticket premise was incorrect.** The cache delegation chain already worked correctly:
- `clearCaches()` → `socketExposureOp.clearCache()` → `isSocketCoveredOp.clearCache()` → clears `#socketToSlotCache`

**Actual changes made** (for maintainability/extensibility):
1. Added `#operatorsWithCaches` private tracking array to `JsonLogicCustomOperators`
2. Updated `clearCaches()` to iterate over tracked operators with type guards
3. Added test for graceful handling of operators without `clearCache()` method

### Files Modified
- `src/logic/jsonLogicCustomOperators.js` - Added tracking array and updated `clearCaches()` method
- `tests/unit/logic/jsonLogicCustomOperators.test.js` - Added extensibility test

### Tests Added/Modified
| Test | Rationale |
|------|-----------|
| `handles operators without clearCache method gracefully` | Verifies type safety of the new iterator pattern |

### Verification
- All 75 tests in `jsonLogicCustomOperators.test.js` pass
- ESLint reports no errors on modified files
- Pre-existing functionality preserved (cache delegation still works)
