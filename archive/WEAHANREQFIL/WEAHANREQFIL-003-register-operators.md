# WEAHANREQFIL-003: Register New Operators in JSON Logic System

**Status**: ✅ COMPLETED

## Summary

Register the `canActorGrabItem` and `isItemBeingGrabbed` operators with the JSON Logic system so they can be used in scopes and conditions.

## Context

The operators created in WEAHANREQFIL-001 and WEAHANREQFIL-002 need to be:
1. Imported and registered in the central operator registry
2. Added to the allowed operations whitelist for security validation

## Files to Touch

| File | Action | Purpose |
|------|--------|---------|
| `src/logic/jsonLogicCustomOperators.js` | MODIFY | Register operators with JSON Logic |
| `src/logic/jsonLogicEvaluationService.js` | MODIFY | Add to `#allowedOperations` whitelist |

## Out of Scope

- **DO NOT** modify the operator implementations (WEAHANREQFIL-001, WEAHANREQFIL-002)
- **DO NOT** modify any scope files (WEAHANREQFIL-004)
- **DO NOT** modify any action files (WEAHANREQFIL-005)
- **DO NOT** modify any other existing operators
- **DO NOT** add new functionality to the operators

## Implementation Details

### jsonLogicCustomOperators.js Changes

1. Add imports at the top of the file (after line 20, with other operator imports):
```javascript
import { CanActorGrabItemOperator } from './operators/canActorGrabItemOperator.js';
import { IsItemBeingGrabbedOperator } from './operators/isItemBeingGrabbedOperator.js';
```

2. In `registerOperators()` method (lines 91-396), add operator instantiation after `hasFreeGrabbingAppendagesOp` (around line 185):
```javascript
const canActorGrabItemOp = new CanActorGrabItemOperator({
  entityManager: this.#entityManager,
  logger: this.#logger,
});

const isItemBeingGrabbedOp = new IsItemBeingGrabbedOperator({
  entityManager: this.#entityManager,
  logger: this.#logger,
});
```

3. Register operators using `this.#registerOperator()` pattern (after line 385, following the `hasFreeGrabbingAppendages` registration):
```javascript
// Register canActorGrabItem operator
this.#registerOperator(
  'canActorGrabItem',
  function (actorPath, itemPath) {
    // 'this' is the evaluation context
    return canActorGrabItemOp.evaluate([actorPath, itemPath], this);
  },
  jsonLogicEvaluationService
);

// Register isItemBeingGrabbed operator
this.#registerOperator(
  'isItemBeingGrabbed',
  function (actorPath, itemPath) {
    // 'this' is the evaluation context
    return isItemBeingGrabbedOp.evaluate([actorPath, itemPath], this);
  },
  jsonLogicEvaluationService
);
```

### jsonLogicEvaluationService.js Changes

Add to the `#allowedOperations` Set in the constructor (around line 117, after `hasFreeGrabbingAppendages`):
```javascript
// Grabbing appendage operators
'hasFreeGrabbingAppendages',
'canActorGrabItem',
'isItemBeingGrabbed',
```

## Acceptance Criteria

### Tests That Must Pass

1. **Existing Tests**
   - All existing tests in `tests/unit/logic/` must continue to pass
   - All existing tests in `tests/integration/` must continue to pass

2. **Registration Verification**
   - `jsonLogicEvaluationService.isOperatorAllowed('canActorGrabItem')` returns `true`
   - `jsonLogicEvaluationService.isOperatorAllowed('isItemBeingGrabbed')` returns `true`

3. **Integration Test** (create if needed)
   - JSON Logic evaluation with `{ "canActorGrabItem": ["actor", "entity"] }` works
   - JSON Logic evaluation with `{ "isItemBeingGrabbed": ["actor", "entity"] }` works

### Invariants That Must Remain True

1. All existing operators remain functional
2. Operator whitelist validation continues to work
3. No changes to operator behavior (only registration)
4. Import order follows existing patterns
5. Registration follows existing patterns exactly
6. `npm run typecheck` passes
7. `npm run lint` passes for modified files

## Dependencies

- **Requires**: WEAHANREQFIL-001 (CanActorGrabItemOperator)
- **Requires**: WEAHANREQFIL-002 (IsItemBeingGrabbedOperator)
- **Blocks**: WEAHANREQFIL-004 (scope creation)

## Estimated Scope

- ~24 lines added to `jsonLogicCustomOperators.js` (2 imports + 10 instantiation + 12 registration)
- ~2 lines added to `jsonLogicEvaluationService.js`
- Small, focused change

## Outcome

### What Changed vs Originally Planned

**Originally Planned** (with discrepancies):
- The ticket incorrectly showed `jsonLogic.add_operation()` pattern
- Line number references were outdated

**Actual Changes**:
1. **`src/logic/jsonLogicCustomOperators.js`**:
   - Added 2 imports (lines 21-22): `CanActorGrabItemOperator` and `IsItemBeingGrabbedOperator`
   - Added 10 lines for operator instantiation (lines 194-202): instantiating both operators
   - Added 18 lines for operator registration (lines 401-418): using correct `this.#registerOperator()` pattern

2. **`src/logic/jsonLogicEvaluationService.js`**:
   - Added 2 lines (lines 125-126): `'canActorGrabItem'` and `'isItemBeingGrabbed'` to `#allowedOperations` whitelist

3. **Tests Updated**:
   - `tests/unit/logic/jsonLogicCustomOperators.whitelistValidation.test.js`: Added new operators to `expectedOperators` array
   - `tests/unit/logic/jsonLogicOperatorRegistration.test.js`: Updated operator count (17→19), added new operators to expected list, added new test for `isOperatorAllowed`

### Verification Results
- All 176 test suites pass (2820 tests)
- ESLint passes (0 errors, only pre-existing warnings)
- `isOperatorAllowed('canActorGrabItem')` and `isOperatorAllowed('isItemBeingGrabbed')` both return `true`

### Ticket Corrections Applied
Before implementation, the ticket was corrected to:
1. Use proper `this.#registerOperator()` pattern instead of `jsonLogic.add_operation()`
2. Update line number references to match actual code locations
3. Adjust estimated scope to reflect accurate line counts
