# WEAHANREQFIL-001: Implement CanActorGrabItemOperator

## Status: COMPLETED

## Summary

Create a new JSON Logic operator `canActorGrabItem` that compares an actor's free grabbing appendages against an item's `handsRequired` property.

## Context

The `wield_threateningly` action currently allows targeting any weapon in inventory regardless of hand requirements. A longsword requiring 2 hands should not appear when the actor only has 1 free hand. This operator enables filtering weapons by hand availability.

## Files to Touch

| File                                                          | Action | Purpose                     |
| ------------------------------------------------------------- | ------ | --------------------------- |
| `src/logic/operators/canActorGrabItemOperator.js`             | CREATE | New operator implementation |
| `tests/unit/logic/operators/canActorGrabItemOperator.test.js` | CREATE | Unit test suite             |

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
- Use `resolveEntityPath()` from `src/logic/utils/entityPathResolver.js` (**NOTE**: file is in `logic/utils/`, not `logic/operators/utils/`)
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

---

## Outcome

### Completion Date

2025-01-25

### What Was Actually Changed vs Originally Planned

**Matched Plan:**

- Created `src/logic/operators/canActorGrabItemOperator.js` (~230 lines)
- Created `tests/unit/logic/operators/canActorGrabItemOperator.test.js` (~340 lines)

**Corrections Made to Ticket:**

- Fixed path reference: `src/logic/operators/utils/entityPathResolver.js` → `src/logic/utils/entityPathResolver.js`
  - The ticket had incorrect path; actual file is in `logic/utils/` not `logic/operators/utils/`

**Test Results:**

- All 34 unit tests pass
- Test coverage: 93.84% statements, 92% branches, 100% functions
- Exceeds 80% coverage requirement

**Lint Status:**

- 1 warning (expected): "Hardcoded reference to non-core mod 'anatomy'"
- This matches existing patterns in `grabbingUtils.js` and is acceptable for core-like anatomy mod

**Files Created:**
| File | Lines | Status |
|------|-------|--------|
| `src/logic/operators/canActorGrabItemOperator.js` | 232 | Created |
| `tests/unit/logic/operators/canActorGrabItemOperator.test.js` | 344 | Created |

### New/Modified Tests

| Test                                                                             | Rationale                              |
| -------------------------------------------------------------------------------- | -------------------------------------- |
| `should return true when actor has enough free appendages for item`              | Basic happy path - actor can grab item |
| `should return false when actor lacks sufficient free appendages`                | Basic unhappy path - actor cannot grab |
| `should default to requiring 1 hand when item lacks requires_grabbing component` | Default behavior when component absent |
| `should return true when handsRequired is 0 (rings, etc.)`                       | Edge case for zero-hand items          |
| `should resolve actor from string path (e.g., "actor")`                          | Context path resolution                |
| `should resolve actor from JSON Logic expression`                                | JSON Logic evaluation support          |
| `should resolve actor from entity object with id property`                       | Direct entity object support           |
| `should resolve item from "entity" path in filter context`                       | Filter context compatibility           |
| `should return false when actor has no anatomy:body component`                   | Edge case - no body                    |
| `should return false when params are missing`                                    | Parameter validation                   |
| `should return false when params is not an array`                                | Type validation                        |
| `should return false when params is null`                                        | Null handling                          |
| `should return false when params is undefined`                                   | Undefined handling                     |
| `should return false when actor cannot be resolved`                              | Resolution failure                     |
| `should return false when item cannot be resolved`                               | Resolution failure                     |
| `should return false when only one parameter is provided`                        | Insufficient params                    |
| `should log warning when parameters are invalid`                                 | Logging verification                   |
| `should log debug message with evaluation result`                                | Debug logging                          |
| `should log debug message when handsRequired is 0`                               | Zero-hands logging                     |
| `should catch and log errors during evaluation`                                  | Error handling                         |
| `should handle nested entity paths like entity.target`                           | Complex path support                   |
| `should handle direct entity ID strings`                                         | Direct ID support                      |
| `should work with typical action condition context`                              | Integration pattern                    |
| `should work with filter context (entity as current item)`                       | Filter integration                     |
| `should default to 1 when requires_grabbing component returns undefined`         | Undefined component                    |
| `should default to 1 when requires_grabbing has no handsRequired property`       | Missing property                       |
| `should return false when actor entity has empty string id`                      | Empty ID validation                    |
| `should return false when item entity has empty string id`                       | Empty ID validation                    |
| `should return false when actor path type is invalid (boolean)`                  | Type validation                        |
| `should return false when item path type is invalid (number)`                    | Type validation                        |
| Constructor tests (4 tests)                                                      | Dependency injection validation        |

### Next Steps

- WEAHANREQFIL-002: Create `IsItemBeingGrabbedOperator` (parallel implementation)
- WEAHANREQFIL-003: Register both operators in `jsonLogicCustomOperators.js`
