# WEAHANREQFIL-003: Register New Operators in JSON Logic System

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

1. Add imports at the top of the file (around line 20, with other operator imports):
```javascript
import { CanActorGrabItemOperator } from './operators/canActorGrabItemOperator.js';
import { IsItemBeingGrabbedOperator } from './operators/isItemBeingGrabbedOperator.js';
```

2. Register operators in the `registerOperators()` method (around line 350-390, following the `hasFreeGrabbingAppendages` pattern):
```javascript
// Register canActorGrabItem operator
const canActorGrabItemOp = new CanActorGrabItemOperator({
  entityManager,
  logger,
});
jsonLogic.add_operation('canActorGrabItem', (params, context) =>
  canActorGrabItemOp.evaluate(params, context)
);

// Register isItemBeingGrabbed operator
const isItemBeingGrabbedOp = new IsItemBeingGrabbedOperator({
  entityManager,
  logger,
});
jsonLogic.add_operation('isItemBeingGrabbed', (params, context) =>
  isItemBeingGrabbedOp.evaluate(params, context)
);
```

### jsonLogicEvaluationService.js Changes

Add to the `#allowedOperations` Set in the constructor (around line 124, after `hasFreeGrabbingAppendages`):
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

- ~10 lines added to `jsonLogicCustomOperators.js`
- ~2 lines added to `jsonLogicEvaluationService.js`
- Very small, focused change
