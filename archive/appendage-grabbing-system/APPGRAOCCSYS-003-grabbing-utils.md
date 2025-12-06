# APPGRAOCCSYS-003: Create grabbingUtils Utility Functions

**Status**: ✅ COMPLETED
**Completed Date**: 2025-11-25

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Create utility functions for managing grabbing appendage locks. These functions provide a clean API for counting free appendages, locking/unlocking appendages, and querying held items. The utilities will be used by operation handlers and operators.

## Dependencies

- APPGRAOCCSYS-001 (anatomy:can_grab component schema must exist) ✅ Completed

## Files Created

| File                                     | Purpose                                             |
| ---------------------------------------- | --------------------------------------------------- |
| `src/utils/grabbingUtils.js`             | Utility functions for grabbing appendage management |
| `tests/unit/utils/grabbingUtils.test.js` | Unit tests for utility functions (43 tests)         |

## Files Modified

None - this is a new standalone utility module.

## Out of Scope

- DO NOT create operation handlers (handled in APPGRAOCCSYS-004/005)
- DO NOT create operators (handled in APPGRAOCCSYS-006)
- DO NOT modify any entity files
- DO NOT modify any action files
- DO NOT register anything in DI (utilities are imported directly)

## Implementation Details

### Utility Functions (`src/utils/grabbingUtils.js`)

Implemented all planned functions with the specified API:

- `findGrabbingAppendages(entityManager, entityId)` - Find all body parts with can_grab
- `countFreeGrabbingAppendages(entityManager, entityId)` - Count unlocked appendages
- `countTotalGrabbingAppendages(entityManager, entityId)` - Count all appendages
- `calculateFreeGripStrength(entityManager, entityId)` - Sum grip strength of free appendages
- `lockGrabbingAppendages(entityManager, entityId, count, itemId)` - Lock N appendages
- `unlockGrabbingAppendages(entityManager, entityId, count, itemId)` - Unlock N appendages
- `unlockAppendagesHoldingItem(entityManager, entityId, itemId)` - Release specific item
- `getHeldItems(entityManager, entityId)` - List held items with holding parts
- `hasEnoughFreeAppendages(entityManager, entityId, count, gripStrength)` - Check requirements

### Pattern Followed

Implementation followed `mouthEngagementUtils.js` pattern:

- Synchronous reads via `entityManager.getComponentData()`
- Async mutations via `await entityManager.addComponent()`
- Safe cloning with `structuredClone` fallback
- Graceful null/empty handling throughout
- Private `cloneComponent` helper exported via `__testing__`

## Acceptance Criteria

### Tests That Must Pass

All 43 unit tests pass:

#### findGrabbingAppendages ✅

- [x] Returns empty array when entity has no body component
- [x] Returns empty array when entityManager is null
- [x] Returns empty array when entityId is null
- [x] Returns empty array when body has no parts with can_grab
- [x] Returns array of part IDs when parts have can_grab
- [x] Handles entity with multiple grabbing appendages

#### countFreeGrabbingAppendages ✅

- [x] Returns 0 when entity has no grabbing appendages
- [x] Returns correct count when all appendages are free
- [x] Returns correct count when some appendages are locked
- [x] Returns 0 when all appendages are locked

#### countTotalGrabbingAppendages ✅

- [x] Returns total count regardless of locked state
- [x] Returns 0 when entity has no appendages

#### calculateFreeGripStrength ✅

- [x] Returns 0 when no free appendages
- [x] Returns sum of gripStrength from free appendages only
- [x] Uses default gripStrength (1.0) when not specified

#### lockGrabbingAppendages ✅

- [x] Successfully locks requested count of appendages
- [x] Sets heldItemId when itemId provided
- [x] Returns lockedParts array with affected part IDs
- [x] Fails with error when not enough free appendages
- [x] Locks first available (unlocked) appendages
- [x] Handles count of 0 gracefully
- [x] Returns error for invalid arguments

#### unlockGrabbingAppendages ✅

- [x] Successfully unlocks requested count of appendages
- [x] Clears heldItemId on unlocked appendages
- [x] Filters by itemId when provided
- [x] Returns unlockedParts array with affected part IDs
- [x] Fails gracefully when not enough locked appendages
- [x] Handles count of 0 gracefully

#### unlockAppendagesHoldingItem ✅

- [x] Unlocks all appendages holding the specified item
- [x] Returns empty array when item not held
- [x] Clears heldItemId on unlocked appendages
- [x] Returns failure for invalid arguments

#### getHeldItems ✅

- [x] Returns empty array when nothing held
- [x] Returns array of { partId, itemId } for held items
- [x] Excludes appendages with null heldItemId
- [x] Returns empty array for null entityManager

#### hasEnoughFreeAppendages ✅

- [x] Returns true when requirements met
- [x] Returns false when not enough free appendages
- [x] Checks grip strength when requiredGripStrength > 0
- [x] Returns false when grip strength insufficient
- [x] Returns false for null entityManager
- [x] Returns false for null entityId

#### **testing**.cloneComponent ✅

- [x] Creates deep copy of component

### Invariants Maintained ✅

1. Functions are pure - no side effects except explicit lock/unlock mutations
2. All functions handle missing body component gracefully (return empty/0/false)
3. Lock functions are atomic - all or nothing
4. Unlock functions don't throw when nothing to unlock
5. No DI dependencies - utilities use EntityManager directly
6. No event dispatching from utilities (caller's responsibility)

## Verification Commands

```bash
# Run utility tests - PASSED
npm run test:unit -- tests/unit/utils/grabbingUtils.test.js
# Result: 43 tests passed

# Lint the new files - PASSED (warnings only, consistent with similar utilities)
npx eslint src/utils/grabbingUtils.js tests/unit/utils/grabbingUtils.test.js
# Result: 0 errors, warnings match mouthEngagementUtils.js pattern
```

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned**: Create `grabbingUtils.js` with 9 utility functions and comprehensive unit tests.

**Actual**: Implementation matched plan exactly with these minor adjustments:

1. **Additional Null Guards**: Added null checks for `entityManager` and `entityId` on all functions (not just async ones) to match defensive patterns in `mouthEngagementUtils.js`

2. **Graceful Unlock Behavior**: `unlockGrabbingAppendages` returns success with partial results when fewer locked appendages exist than requested (matches ticket requirement "Fails gracefully when not enough locked appendages")

3. **Test Coverage Enhanced**: 43 tests total vs template suggestion of ~30. Added edge cases for:
   - Null entityManager/entityId handling
   - Count of 0 edge cases
   - Multi-appendage scenarios (4 appendages)
   - Invalid argument handling

4. **Pattern Alignment**: Followed `mouthEngagementUtils.js` precisely including:
   - `__testing__` export for internal helper
   - Same cloning pattern with structuredClone fallback
   - Same iteration pattern over `bodyComponent.body.parts`

**No deviations from public API or scope requirements.**
