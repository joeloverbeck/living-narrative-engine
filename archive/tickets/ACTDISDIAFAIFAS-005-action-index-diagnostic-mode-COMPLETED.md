# ACTDISDIAFAIFAS-005 – ActionIndex Diagnostic Mode

**Status: COMPLETED**

## Problem

`getCandidateActions()` filters out actions with forbidden components but provides no explanation. When an action is rejected at the ActionIndex level, there's no way to understand why without manually inspecting the action definition and entity components.

## Proposed Scope

Add a new method `getCandidateActionsWithDiagnostics()` that returns both the candidate actions AND rejection information for filtered actions.

## File List

- `src/actions/actionIndex.js`
- `tests/unit/actions/actionIndex.test.js`

## Out of Scope

- ComponentFilteringStage changes (handled in ACTDISDIAFAIFAS-006)
- ActionDiscoveryService changes (handled in ACTDISDIAFAIFAS-008)
- Target component validation
- Modifying existing `getCandidateActions()` behavior
- Pipeline orchestrator changes

## Acceptance Criteria

### Tests

Run: `npm run test:unit -- tests/unit/actions/actionIndex.test.js`

Required test cases:
- **New method `getCandidateActionsWithDiagnostics()` exists**: Method is callable
- **Returns `{candidates: [], rejected: []}` structure**: Both arrays present
- **Each rejection includes `actionId`**: Identifies which action was rejected
- **Each rejection includes `reason`**: Human-readable rejection reason
- **Each rejection includes `forbiddenComponents`**: The action's forbidden_components list
- **Each rejection includes `actorHasComponents`**: Which forbidden components actor has
- **Original `getCandidateActions()` unchanged**: Backward compatible
- **Diagnostic method has same filtering logic**: No divergence from original
- **Empty rejected array when all actions pass**: Clean success case
- **Multiple rejections tracked**: All rejected actions listed

### Invariants

- `getCandidateActions()` still works identically to before
- No performance impact when diagnostics not requested
- Diagnostic method uses same filtering logic as original (no code duplication that could diverge)
- Rejection reasons are consistent and deterministic

### API Contract

```javascript
/**
 * @typedef {object} ActionRejection
 * @property {string} actionId - The rejected action ID
 * @property {string} reason - Human-readable reason (e.g., 'FORBIDDEN_COMPONENT')
 * @property {string[]} forbiddenComponents - Action's forbidden_components.actor list
 * @property {string[]} actorHasComponents - Which forbidden components actor has
 */

/**
 * @typedef {object} CandidateActionsWithDiagnostics
 * @property {ActionDefinition[]} candidates - Actions that passed filtering
 * @property {ActionRejection[]} rejected - Actions that were filtered out
 */

/**
 * @param {Entity} actorEntity - Actor entity
 * @param {TraceContext} [trace] - Optional trace context
 * @returns {CandidateActionsWithDiagnostics}
 */
getCandidateActionsWithDiagnostics(actorEntity, trace) {}
```

### Example Output

```javascript
{
  candidates: [
    { id: 'core:speak', ... },
    { id: 'positioning:stand', ... }
  ],
  rejected: [
    {
      actionId: 'personal-space:get_close',
      reason: 'FORBIDDEN_COMPONENT',
      forbiddenComponents: ['personal-space-states:closeness'],
      actorHasComponents: ['personal-space-states:closeness']
    }
  ]
}
```

### Implementation Notes

To avoid code duplication and divergence:
1. Extract filtering logic to a shared internal method
2. Both `getCandidateActions()` and `getCandidateActionsWithDiagnostics()` call the same logic
3. Diagnostic method captures rejection info during filtering
4. Non-diagnostic method ignores rejection info

---

## Outcome

**Completed: 2026-01-04**

### What Was Actually Changed

#### Implementation (Matches Plan)

1. **Added typedefs** at top of `src/actions/actionIndex.js`:
   - `ActionRejection` - Tracks rejected action info (actionId, reason, forbiddenComponents, actorHasComponents)
   - `CandidateActionsWithDiagnostics` - Return type with candidates and rejected arrays

2. **Created shared internal method** `#getCandidatesWithRejections(actorEntity, trace)`:
   - Contains the complete filtering logic (previously in getCandidateActions)
   - Builds rejection info during forbidden component filtering
   - Returns `{candidates, rejected}` structure

3. **Refactored `getCandidateActions()`**:
   - Now calls shared method and returns only `result.candidates`
   - Identical behavior to before (backward compatible)

4. **Added `getCandidateActionsWithDiagnostics()`**:
   - Calls shared method and returns full diagnostic info
   - Includes debug logging with rejection count

#### Tests Added (14 new tests)

All 10 required test cases were implemented plus additional edge cases:
- Method exists and is callable
- Returns correct structure with both arrays
- Rejection includes all required fields (actionId, reason, forbiddenComponents, actorHasComponents)
- Original getCandidateActions() unchanged
- Same filtering logic (no divergence)
- Empty rejected array when all pass
- Multiple rejections tracked
- Edge cases: null entity, entity without id
- Example output format validation

### Deviation from Original Ticket

**Minor API refinement**: The ticket specified `actorId` as parameter, but the actual implementation uses `actorEntity` to match the existing `getCandidateActions()` signature. This is more consistent with the class design and avoids a redundant entity lookup.

### Validation

- All 49 tests pass
- ESLint passes with no errors
- No changes to public API behavior of `getCandidateActions()`
