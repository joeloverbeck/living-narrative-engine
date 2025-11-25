# WEAHANREQFIL-001: Implement CanActorGrabItemOperator

## Summary

Create a new JSON Logic operator `canActorGrabItem` that compares an actor's free grabbing appendages against an item's `handsRequired` property.

## Context

The `wield_threateningly` action currently allows targeting any weapon in inventory regardless of hand requirements. A longsword requiring 2 hands should not appear when the actor only has 1 free hand. This operator enables filtering weapons by hand availability.

## Files to Touch

| File | Action | Purpose |
|------|--------|---------|
| `src/logic/operators/canActorGrabItemOperator.js` | CREATE | New operator implementation |
| `tests/unit/logic/operators/canActorGrabItemOperator.test.js` | CREATE | Unit test suite |

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
// Usage in JSON Logic: { "canActorGrabItem": ["actor", "entity"] }
// Returns: boolean - true if actor has >= item's handsRequired free appendages
```

### Key Logic
1. Resolve actor entity ID from first parameter (supports JSON Logic expressions, paths, entity objects)
2. Resolve item entity ID from second parameter
3. Get item's `anatomy:requires_grabbing.handsRequired` (default: 1 if component absent)
4. Get actor's free appendage count via `countFreeGrabbingAppendages(entityManager, actorId)`
5. Return `freeAppendages >= handsRequired`

### Pattern Reference
Follow the pattern established in `src/logic/operators/hasFreeGrabbingAppendagesOperator.js`:
- Use `#entityManager` and `#logger` private fields
- Use `resolveEntityPath()` from `src/logic/operators/utils/entityPathResolver.js`
- Use `hasValidEntityId()` from same file
- Import `countFreeGrabbingAppendages` from `src/utils/grabbingUtils.js`
- Use `#operatorName` for consistent logging
- Handle all edge cases with appropriate logging

### Edge Cases to Handle
1. Actor without `anatomy:body` component → `countFreeGrabbingAppendages` returns 0 → return false
2. Item without `anatomy:requires_grabbing` component → default to 1 hand required
3. Item with `handsRequired: 0` → always return true (rings, etc.)
4. Invalid parameters → log warning, return false
5. Entity resolution failure → log warning, return false

## Acceptance Criteria

### Tests That Must Pass
Create `tests/unit/logic/operators/canActorGrabItemOperator.test.js` with:

1. **Basic Functionality**
   - `should return true when actor has enough free appendages for item`
   - `should return false when actor lacks sufficient free appendages`
   - `should default to requiring 1 hand when item lacks requires_grabbing component`
   - `should return true when handsRequired is 0 (rings, etc.)`

2. **Parameter Resolution**
   - `should resolve actor from string path (e.g., "actor")`
   - `should resolve actor from JSON Logic expression`
   - `should resolve actor from entity object with id property`
   - `should resolve item from "entity" path in filter context`

3. **Edge Cases**
   - `should return false when actor has no anatomy:body component`
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

- ~200 lines of operator code (following existing pattern)
- ~150 lines of tests
- Single focused PR, easy to review
