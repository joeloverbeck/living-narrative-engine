# ANAGRAGENARCANA-001: Add Duplicate Key Detection to mapSlotToEntity

## Metadata
- **ID**: ANAGRAGENARCANA-001
- **Priority**: CRITICAL
- **Severity**: P1
- **Effort**: Low
- **Source**: `reports/anatomy-graph-generation-architecture-analysis.md` - R1
- **Related Issue**: CRITICAL-01 (Silent Slot-to-Entity Mapping Overwrites)
- **Status**: ✅ COMPLETED
- **Completed Date**: 2025-12-02

---

## Problem Statement

The `mapSlotToEntity()` method in `AnatomyGraphContext` silently overwrites existing mappings when a duplicate slot key is used. This allows data corruption to occur without any warning or error.

### Current Behavior
```javascript
// src/anatomy/anatomyGraphContext.js:143-146 (corrected from ticket's 144-146)
mapSlotToEntity(slotKey, entityId) {
  this.#slotToEntity.set(slotKey, entityId);  // Silent overwrite - NO DUPLICATE CHECK
}
```

### Impact
- If two slots have the same key, the second one silently replaces the first
- The first entity becomes orphaned and unreachable via slot lookups
- This was the root cause of the "chicken bug" where one leg's children were overwritten by the other's

---

## Affected Files

| File | Line(s) | Change Type |
|------|---------|-------------|
| `src/anatomy/anatomyGraphContext.js` | 7, 147-156 | Modify (import + method) |

---

## Acceptance Criteria

- [x] `mapSlotToEntity()` throws `ValidationError` when duplicate key detected
- [x] Error message includes: slot key, existing entity ID, and new entity ID
- [x] Existing functionality for unique slot keys unchanged
- [x] Unit tests cover duplicate detection and error content
- [x] Integration test verifies fail-fast behavior during graph creation
- [x] No silent data corruption possible via this code path
- [x] All existing tests pass

---

## Outcome

### What Was Changed

1. **`src/anatomy/anatomyGraphContext.js`**:
   - Added import for `ValidationError` from `../errors/validationError.js`
   - Modified `mapSlotToEntity()` method to check if slot key already exists in the map
   - If duplicate detected, throws `ValidationError` with descriptive message containing slot key, existing entity ID, and attempted new entity ID

2. **`tests/unit/anatomy/anatomyGraphContext.test.js`**:
   - Added 3 new test cases:
     - `throws ValidationError when mapping duplicate slot key`
     - `allows mapping different slot keys to different entities`
     - `includes both entity IDs and slot key in error message for duplicate slot`

3. **`tests/integration/anatomy/anatomyGraphContextDuplicateSlotKey.integration.test.js`** (NEW):
   - 3 integration tests verifying fail-fast behavior:
     - `should fail immediately when duplicate slot key is mapped`
     - `should prevent partial graph corruption by failing before second mapping`
     - `should provide clear error message for debugging duplicate slot issues`

### Differences from Plan

- **Line number correction**: Ticket stated lines 144-146, actual implementation was at lines 143-146 (1-line offset)
- **Implementation matched plan exactly** - no deviations from the proposed solution

### Test Results

- All 11 tests pass (8 unit + 3 integration)
- ESLint: 0 errors, 3 pre-existing warnings (unrelated jsdoc warnings)

---

## Dependencies

- None (this is the highest priority ticket)

---

## Notes

- This is a fail-fast validation that prevents silent data corruption
- The error bubbles up to the recipe validation level with clear context
- This fix addresses the systemic issue exposed by the "chicken bug"
