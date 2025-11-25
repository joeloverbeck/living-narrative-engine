# WEAHANREQFIL-002: Implement IsItemBeingGrabbedOperator

## Summary

Create a new JSON Logic operator `isItemBeingGrabbed` that checks whether an item is currently being held by an actor.

## Context

When filtering weapons for the `wield_threateningly` action, items already being grabbed should be excluded from the target list. This operator checks if a specific item exists in the actor's held items list.

## Files to Touch

| File | Action | Purpose |
|------|--------|---------|
| `src/logic/operators/isItemBeingGrabbedOperator.js` | CREATE | New operator implementation |
| `tests/unit/logic/operators/isItemBeingGrabbedOperator.test.js` | CREATE | Unit test suite |

## Out of Scope

- **DO NOT** modify `src/logic/jsonLogicCustomOperators.js` (registration is WEAHANREQFIL-003)
- **DO NOT** modify `src/logic/jsonLogicEvaluationService.js` (whitelist is WEAHANREQFIL-003)
- **DO NOT** modify any scope files
- **DO NOT** modify any action files
- **DO NOT** modify any existing operators
- **DO NOT** modify `src/utils/grabbingUtils.js` (use existing utilities)

## Implementation Details

### Operator Signature
```javascript
// Usage in JSON Logic: { "isItemBeingGrabbed": ["actor", "entity"] }
// Returns: boolean - true if item is currently held by actor
```

### Key Logic
1. Resolve actor entity ID from first parameter (supports JSON Logic expressions, paths, entity objects)
2. Resolve item entity ID from second parameter
3. Get held items via `getHeldItems(entityManager, actorId)` - returns `[{ partId, itemId }]`
4. Return `heldItems.some(held => held.itemId === itemId)`

### Pattern Reference
Follow the pattern established in `src/logic/operators/hasFreeGrabbingAppendagesOperator.js`:
- Use `#entityManager` and `#logger` private fields
- Use `resolveEntityPath()` from `src/logic/operators/utils/entityPathResolver.js`
- Use `hasValidEntityId()` from same file
- Import `getHeldItems` from `src/utils/grabbingUtils.js`
- Use `#operatorName` for consistent logging
- Handle all edge cases with appropriate logging

### Edge Cases to Handle
1. Actor without any grabbing appendages → `getHeldItems` returns `[]` → return false
2. Item not held → return false
3. Invalid parameters → log warning, return false
4. Entity resolution failure → log warning, return false
5. Actor has no body → `getHeldItems` returns `[]` → return false

## Acceptance Criteria

### Tests That Must Pass
Create `tests/unit/logic/operators/isItemBeingGrabbedOperator.test.js` with:

1. **Basic Functionality**
   - `should return true when item is being held by actor`
   - `should return false when item is not being held by actor`
   - `should return false when actor holds no items`

2. **Parameter Resolution**
   - `should resolve actor from string path (e.g., "actor")`
   - `should resolve actor from JSON Logic expression`
   - `should resolve actor from entity object with id property`
   - `should resolve item from "entity" path in filter context`

3. **Edge Cases**
   - `should return false when actor has no grabbing appendages`
   - `should return false when params are missing`
   - `should return false when params is not an array`
   - `should return false when actor cannot be resolved`
   - `should return false when item cannot be resolved`

4. **Logging**
   - `should log warning when parameters are invalid`
   - `should log debug message with evaluation result`

### Invariants That Must Remain True
1. Operator does not modify any entity state
2. Operator always returns a boolean (never throws to caller)
3. Existing operators remain unchanged
4. `grabbingUtils.js` exports remain unchanged
5. All existing tests continue to pass

## Dependencies

- Depends on: Nothing (can be implemented independently)
- Blocks: WEAHANREQFIL-003 (operator registration)

## Estimated Scope

- ~180 lines of operator code (following existing pattern)
- ~120 lines of tests
- Single focused PR, easy to review
