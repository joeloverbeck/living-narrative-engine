# JSOLOGCUSOPEREF-009: Unify Operator Storage Pattern

**Priority**: 🟢 Medium
**Estimated Effort**: 2 hours
**Phase**: 3 - Medium-Priority Improvements
**Depends On**: JSOLOGCUSOPEREF-002 (cache management)
**Status**: ✅ COMPLETED

---

## Summary

~~Some operators are stored as instance properties (for cache clearing) while others are local variables (lost after registration). This inconsistency makes cache management incomplete and increases memory overhead. All operators should be stored in a unified registry Map.~~

**Corrected Summary**: After JSOLOGCUSOPEREF-004 (Extract Operator Factory) was completed, `OperatorRegistryFactory` already uses a Map to store all 27 operators. The remaining issue was that this Map reference wasn't persisted in `JsonLogicCustomOperators` after `registerOperators()` returns. This ticket adds persistent Map storage and a `getOperator()` method for unified access.

---

## Ticket Assumption Corrections

| Item | Original Claim | Actual Value |
|------|---------------|--------------|
| Operator count | 26 | **27** (26 class-based + 1 inline function `get_component_value`) |
| Storage pattern | "local variables lost after registration" | Map already exists in factory; issue was Map not persisted |
| Problem severity | "cache management incomplete" | Cache management works correctly via `#operatorsWithCaches` array |

---

## Files Modified

| File | Change Type |
|------|-------------|
| `src/logic/jsonLogicCustomOperators.js` | Added `#operators` Map, `getOperator()` method; removed instance properties |
| `tests/unit/logic/jsonLogicCustomOperators.test.js` | Updated to use `getOperator()`; added new `getOperator` test suite |

---

## Implementation Details

### Changes Made

1. **Added private `#operators` Map field** to store all operator instances
2. **Removed backward-compatible instance properties**:
   - `this.isSocketCoveredOp`
   - `this.socketExposureOp`
3. **Added `getOperator(name)` method** for unified operator access
4. **Updated tests** to use `getOperator()` instead of direct property access
5. **Added new test suite** for `getOperator()` with 4 test cases

### Code Changes

```javascript
// Added private field
#operators = new Map();

// In registerOperators() - replaced:
// this.isSocketCoveredOp = isSocketCoveredOp;
// this.socketExposureOp = socketExposureOp;
// With:
this.#operators = operators;

// Added new method
getOperator(name) {
  return this.#operators.get(name);
}
```

---

## Acceptance Criteria

### Tests That Must Pass ✅

```bash
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js  # PASSED
npm run test:integration -- tests/integration/logic/                     # 259 tests PASSED
```

### Specific Test Assertions ✅

1. **All operators registered**: `getRegisteredOperators().size === 27` ✅
2. **Cache clearing works**: All operators with caches are cleared ✅
3. **Operator access works**: `getOperator('isSocketCovered')` returns the operator instance ✅

### New Tests Added

- `should return operator instance by name after registration`
- `should return undefined for unknown operator name`
- `should return undefined before registerOperators is called`
- `should return all 27 operators via Map storage`

---

## Verification Commands

```bash
# All passed during implementation:
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js --verbose
npm run test:integration -- tests/integration/logic/
npm run test:integration -- tests/integration/anatomy/anatomyGenerationWithSlotMetadata.test.js
npx eslint src/logic/jsonLogicCustomOperators.js  # 0 errors, warnings only (pre-existing)
```

---

## Outcome

**Implementation completed successfully.**

Key changes:
- Unified operator storage in `#operators` Map
- Added `getOperator(name)` method for testing/debugging
- Removed backward-compatible instance properties in favor of unified access
- All 294+ tests passing (unit + integration)
- No breaking changes to external API (factory still returns individual operators for tests)

**Note**: The `OperatorRegistryFactory` continues to return `isSocketCoveredOp` and `socketExposureOp` in its return value for its own unit tests. This is appropriate as the factory is a separate concern from `JsonLogicCustomOperators`.
