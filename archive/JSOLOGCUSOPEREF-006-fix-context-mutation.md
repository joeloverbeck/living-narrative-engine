# JSOLOGCUSOPEREF-006: Fix Context Mutation Side Effects

**Priority**: 🟡 High
**Estimated Effort**: 2 hours
**Phase**: 2 - High-Priority Refactoring
**Status**: ✅ Complete

---

## Summary

Multiple operator classes mutate the evaluation context object by setting `context._currentPath`. This causes test pollution and unpredictable behavior when context objects are shared between evaluations (e.g., in `and`/`or` groups). The fix uses shallow context cloning before mutation.

---

## Scope Corrections (Discovered During Implementation)

### File Naming
- **Original**: camelCase file names (`baseBodyPartOperator.js`)
- **Actual**: PascalCase file names (`BaseBodyPartOperator.js`)

### Missing Files
The original ticket listed 3 files, but the mutation occurs in **6 files**:

| File | Line | Originally Listed? |
|------|------|--------------------|
| `src/logic/operators/base/BaseBodyPartOperator.js` | 70 | ✓ |
| `src/logic/operators/base/BaseFurnitureOperator.js` | 63 | ✓ |
| `src/logic/operators/base/BaseEquipmentOperator.js` | 61 | ❌ |
| `src/logic/operators/isActorLocationLitOperator.js` | 71 | ✓ |
| `src/logic/operators/hasOtherActorsAtLocationOperator.js` | 69 | ❌ |
| `src/logic/operators/locationHasExitsOperator.js` | 69 | ❌ |

### Cross-Operator Read Pattern
5 body-part operators read `_currentPath` set by `BaseBodyPartOperator`:
- `hasWoundedPartOperator.js:37`
- `hasPartWithStatusEffectOperator.js:46`
- `hasPartSubTypeContainingOperator.js:46`
- `hasPartOfTypeOperator.js:38`
- `hasPartWithComponentValueOperator.js:38`

This is acceptable because they are subclasses - the base sets `_currentPath`, then calls `evaluateInternal()` where subclasses read it from the local context. No cross-operator interference within this family.

---

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/logic/operators/base/BaseBodyPartOperator.js` | Modify - clone context before mutation |
| `src/logic/operators/base/BaseFurnitureOperator.js` | Modify - clone context before mutation |
| `src/logic/operators/base/BaseEquipmentOperator.js` | Modify - clone context before mutation |
| `src/logic/operators/isActorLocationLitOperator.js` | Modify - clone context before mutation |
| `src/logic/operators/hasOtherActorsAtLocationOperator.js` | Modify - clone context before mutation |
| `src/logic/operators/locationHasExitsOperator.js` | Modify - clone context before mutation |

---

## Out of Scope

**DO NOT modify:**
- Operator evaluation logic beyond context handling
- `JsonLogicCustomOperators` main class
- Any DI registration files
- Any other operator files not listed above

---

## Implementation Details

### Current Problem

```javascript
// All 6 files have this pattern:
context._currentPath = entityPath;
```

When multiple operators are evaluated within an `and`/`or` group in `JsonLogicEvaluationService`, they all receive the same context object. This causes mutations to persist across operator calls.

### Solution: Context Cloning

Clone context before mutation so the original context is preserved:

```javascript
// Before:
context._currentPath = entityPath;

// After:
const localContext = { ...context };
localContext._currentPath = entityPath;
// Use localContext for all subsequent operations
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/logic/operators/
npm run test:integration -- tests/integration/logic/
```

### Specific Test Assertions

1. **Context isolation**:
   - Running BodyPartOperator then FurnitureOperator doesn't share `_currentPath`
   - Original context object is not mutated

2. **No regression**:
   - All existing operator tests pass
   - Operators that depend on context path still function correctly

### Invariants That Must Remain True

1. **Original context preserved**: The original context object passed in is not modified
2. **Path tracking works**: Operators that rely on path tracking still function correctly (via local context)
3. **Test isolation**: Tests running in sequence produce same results as parallel
4. **Subclass access preserved**: Body-part subclasses can still read `_currentPath` from their local context

---

## Verification Commands

```bash
# Run tests in sequence to verify isolation
npm run test:unit -- tests/unit/logic/operators/ --runInBand --verbose

# Run body part operator tests specifically
npm run test:unit -- tests/unit/logic/operators/base/ --verbose

# Lint modified files
npx eslint src/logic/operators/base/BaseBodyPartOperator.js \
  src/logic/operators/base/BaseFurnitureOperator.js \
  src/logic/operators/base/BaseEquipmentOperator.js \
  src/logic/operators/isActorLocationLitOperator.js \
  src/logic/operators/hasOtherActorsAtLocationOperator.js \
  src/logic/operators/locationHasExitsOperator.js

# Full regression check
npm run test:ci
```

---

## Notes

- Context cloning is shallow - nested objects are shared by reference
- This is acceptable because `_currentPath` is a primitive string value
- Body-part subclasses read from `localContext` which is passed to `evaluateInternal()`
- No other code outside these operator families reads `context._currentPath`

---

## Outcome

### Implementation Completed

All 6 operator files were updated with context cloning:

1. `src/logic/operators/base/BaseBodyPartOperator.js` - Added `localContext` clone at line 68
2. `src/logic/operators/base/BaseFurnitureOperator.js` - Added `localContext` clone at line 61
3. `src/logic/operators/base/BaseEquipmentOperator.js` - Added `localContext` clone at line 59
4. `src/logic/operators/isActorLocationLitOperator.js` - Added `localContext` clone at line 69
5. `src/logic/operators/hasOtherActorsAtLocationOperator.js` - Added `localContext` clone at line 67
6. `src/logic/operators/locationHasExitsOperator.js` - Added `localContext` clone at line 67

### Tests Updated

Tests were updated to verify context isolation instead of context mutation:

| Test File | Changes |
|-----------|---------|
| `tests/unit/logic/operators/base/BaseBodyPartOperator.test.js` | Updated 4 assertions, added context isolation test |
| `tests/unit/logic/operators/base/BaseFurnitureOperator.test.js` | Updated 1 assertion |
| `tests/unit/logic/operators/base/BaseEquipmentOperator.test.js` | Updated 2 assertions |
| `tests/unit/logic/operators/isActorLocationLitOperator.test.js` | Renamed describe block, changed assertion |
| `tests/unit/logic/operators/locationHasExitsOperator.test.js` | Renamed describe block, changed assertion |
| `tests/unit/logic/operators/socketExposureOperator.test.js` | Updated 2 assertions for `evaluateInternal` calls |
| `tests/unit/logic/operators/isBodyPartAccessibleOperator.test.js` | Updated 2 assertions for `evaluateInternal` calls |

### Test Results

- **Unit tests**: 654 passed (all operator tests)
- **Integration tests**: 259 passed (all logic integration tests)
- **ESLint**: Only pre-existing warnings (no new issues introduced)

### Verification

```bash
NODE_ENV=test npx jest tests/unit/logic/operators/ --no-coverage --silent
# Test Suites: 31 passed, 31 total
# Tests:       654 passed, 654 total

NODE_ENV=test npx jest tests/integration/logic/ --no-coverage --silent
# Test Suites: 35 passed, 35 total
# Tests:       259 passed, 259 total
```

### Key Invariants Preserved

1. ✅ Original context objects are NOT mutated
2. ✅ Operators that depend on path tracking still function correctly (via local context)
3. ✅ Body-part subclasses can read `_currentPath` from their local context
4. ✅ All existing tests pass with no regressions
