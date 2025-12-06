# ANAGRAGENARCANA-002: Add Blueprint-Level Socket Collision Pre-Validation

## Metadata

- **ID**: ANAGRAGENARCANA-002
- **Priority**: HIGH (downgraded from CRITICAL)
- **Severity**: P3 (downgraded from P2)
- **Effort**: Low (reduced from Medium)
- **Source**: `reports/anatomy-graph-generation-architecture-analysis.md` - R2
- **Related Issue**: CRITICAL-02 (No Socket ID Collision Detection)
- **Status**: ✅ COMPLETED

---

## Problem Statement (Corrected)

### Original Ticket Assumptions (INCORRECT)

The original ticket claimed:

- "No validation exists" → **FALSE**
- "Silent corruption occurs" → **FALSE**

### Actual Current Behavior (CORRECTED)

Runtime socket collision validation **already exists** in `SocketManager.validateSocketAvailability()`:

```javascript
if (this.isSocketOccupied(parentId, socketId, socketOccupancy)) {
  const error = `Socket '${socketId}' is already occupied on parent '${parentId}'`;
  if (isRequired) {
    return { valid: false, error };
  }
}
```

This runtime validation correctly prevents duplicate socket usage and throws a `ValidationError` when a required slot tries to use an already-occupied socket.

### Remaining Value: Early Blueprint-Level Validation

The value of this ticket is providing **earlier and more helpful error messages** by validating the blueprint structure **before** entity creation begins:

1. **Current error** (at runtime, after some entities created):

   ```
   Socket 'shoulder' is already occupied on parent 'entity-body-123'
   ```

2. **Proposed error** (at blueprint level, before any entities created):
   ```
   Socket collision detected: socket 'shoulder' on parent 'body' is used by both
   slots 'left_arm' and 'right_arm'. Each socket can only attach one child per
   parent entity instance.
   ```

The proposed error is **more helpful** because it identifies **which slot keys** are conflicting, making it easier for modders to fix their blueprints.

### The Chicken Bug Scenario (Clarified)

The actual chicken bug was caused by **non-unique socket IDs in the entity definition**, not by missing validation. The fix was making socket IDs unique (e.g., `left_foot`, `right_foot` instead of just `foot`). This ticket adds an **additional safety net** to catch similar configuration errors earlier.

---

## Affected Files

| File                                                             | Line(s)          | Change Type             |
| ---------------------------------------------------------------- | ---------------- | ----------------------- |
| `src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js` | Before slot loop | Add validation function |

---

## Implementation Steps (Simplified)

### Step 1: Add Socket Uniqueness Pre-Validation Function

Add a simple validation function that runs before the slot processing loop:

```javascript
/**
 * Pre-validates blueprint for socket collisions before entity creation.
 * Provides early, helpful error messages identifying conflicting slot keys.
 *
 * @param {Object} blueprint - The processed blueprint with slots
 * @throws {ValidationError} If socket collision is detected
 */
function validateBlueprintSocketUniqueness(blueprint) {
  const socketUsage = new Map();

  for (const [slotKey, slot] of Object.entries(blueprint.slots || {})) {
    if (!slot.parent || !slot.socket) continue;

    const fullSocketKey = `${slot.parent}:${slot.socket}`;

    if (socketUsage.has(fullSocketKey)) {
      const conflictingSlot = socketUsage.get(fullSocketKey);
      throw new ValidationError(
        `Socket collision detected: socket '${slot.socket}' on parent '${slot.parent}' ` +
          `is used by both slots '${conflictingSlot}' and '${slotKey}'. ` +
          `Each socket can only attach one child per parent entity instance.`
      );
    }

    socketUsage.set(fullSocketKey, slotKey);
  }
}
```

### Step 2: Call Validation at Start of processBlueprintSlots

Add the validation call before the slot processing loop (after debug logging).

**Note**: `ValidationError` is already imported in this file.

---

## Testing Requirements

### Unit Tests

Create `tests/unit/anatomy/bodyBlueprintFactory/validateBlueprintSocketUniqueness.test.js`:

1. **Test: Should detect socket collision on same parent**
2. **Test: Should allow same socket on different parents**
3. **Test: Should skip slots without parent or socket**
4. **Test: Error message includes helpful context (slot keys, socket, parent)**

### Integration Tests

Add integration test in `tests/integration/anatomy/socketCollisionPreValidation.integration.test.js`:

1. **Test: Pre-validation catches collision before entity creation**
2. **Test: Error message identifies conflicting slot keys**

---

## Acceptance Criteria

- [x] `validateBlueprintSocketUniqueness()` function implemented
- [x] Validation runs before slot processing loop
- [x] Error thrown when same socket used twice on same parent slot key
- [x] Error message includes: socket ID, parent slot key, both conflicting slot keys
- [x] Same socket on different parent slot keys allowed (correct behavior)
- [x] Unit tests cover collision detection and valid scenarios
- [x] Integration test verifies pre-validation behavior
- [x] All existing tests pass

---

## Dependencies

- ANAGRAGENARCANA-001 (completed - duplicate slot key detection in `mapSlotToEntity`)

---

## Notes

- This is an **enhancement**, not a critical fix - runtime validation already prevents corruption
- Value is **better error messages** and **earlier detection** (before entity creation)
- Runtime validation in `SocketManager.validateSocketAvailability()` remains as backup
- Consider adding this check to recipe validation pipeline as well (future ticket)

---

## Outcome (2025-12-02)

### What Was Actually Changed vs Originally Planned

#### Original Plan (INCORRECT ASSUMPTIONS)

The ticket assumed:

- No socket collision validation existed
- Silent data corruption occurred
- This was a CRITICAL fix

#### Actual Findings

- Runtime socket collision validation **already exists** in `SocketManager.validateSocketAvailability()`
- Collisions throw `ValidationError` at runtime (not silent)
- The original "chicken bug" was caused by non-unique socket IDs in entity definitions, not missing validation

#### What Was Actually Implemented

**Enhancement** (not critical fix): Added **pre-validation** at blueprint level that:

1. Runs before any entity creation
2. Provides better error messages with slot key names
3. Catches collisions earlier in the pipeline

### Files Modified

- `src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js`: Added `validateBlueprintSocketUniqueness()` function

### Tests Added

| File                                                                                | Tests    | Rationale                                                                          |
| ----------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `tests/unit/anatomy/bodyBlueprintFactory/validateBlueprintSocketUniqueness.test.js` | 12 tests | Unit tests for collision detection, valid cases, edge cases, error message quality |
| `tests/integration/anatomy/socketCollisionPreValidation.integration.test.js`        | 6 tests  | Integration tests for realistic blueprints including chicken bug scenario          |

### Priority Adjustments

- **Priority**: CRITICAL → HIGH (downgraded - existing runtime validation prevents corruption)
- **Severity**: P2 → P3 (downgraded - enhancement not critical fix)
- **Effort**: Medium → Low (reduced - minimal code change)

### All Tests Pass

- Unit tests: 12/12 pass
- Integration tests: 6/6 pass
- Existing anatomy tests: unaffected
