# ACTDISDIAFAIFAS-006 – ComponentFilteringStage Diagnostics

**Status: COMPLETED**

## Problem

ComponentFilteringStage doesn't capture or report why actions were filtered at the component level. The stage uses ActionIndex but doesn't preserve the rejection information for tracing or diagnostics.

## Proposed Scope

Update ComponentFilteringStage to:
1. Use `getCandidateActionsWithDiagnostics()` when action-aware trace is present
2. Capture rejection info in trace output via `captureActionData()`
3. Maintain zero overhead when diagnostics disabled (use original `getCandidateActions()`)

## File List

- `src/actions/pipeline/stages/ComponentFilteringStage.js`
- `tests/unit/actions/pipeline/stages/ComponentFilteringStage.test.js`

## Out of Scope

- ActionIndex changes (completed in ACTDISDIAFAIFAS-005)
- ActionDiscoveryService changes (handled in ACTDISDIAFAIFAS-008)
- Target validation stages
- Other pipeline stages
- Modifying trace data structure beyond adding diagnostic info

## Acceptance Criteria

### Tests

Run: `npm run test:unit -- tests/unit/actions/pipeline/stages/ComponentFilteringStage.test.js`

Required test cases:
- **Stage uses `getCandidateActionsWithDiagnostics()` when trace enabled**: Diagnostic method called
- **Stage uses original `getCandidateActions()` when trace disabled**: No overhead
- **Rejection info captured in trace output**: Trace includes rejected actions with reasons
- **Normal path uses original method**: Performance protection
- **Trace data structure follows existing patterns**: Consistent with other stages
- **Multiple rejections tracked in trace**: All rejected actions in trace
- **Backward compatible with existing trace consumers**: Existing trace tests pass

### Invariants

- Non-diagnostic path performance unchanged
- Stage output format backward compatible
- Trace data structure follows existing patterns in other stages
- Stage continues to use dependency injection for ActionIndex
- Existing tests continue to pass

### Trace Output Extension

```javascript
// Existing trace data preserved, plus:
{
  stageName: 'ComponentFilteringStage',
  // ... existing fields ...
  diagnostics: {
    rejectedActions: [
      {
        actionId: 'personal-space:get_close',
        reason: 'FORBIDDEN_COMPONENT',
        forbiddenComponents: ['personal-space-states:closeness'],
        actorHasComponents: ['personal-space-states:closeness']
      }
    ]
  }
}
```

### Integration Points

```javascript
// In ComponentFilteringStage.executeInternal():
// Use existing isActionAwareTrace pattern (not options.diagnostics or #traceEnabled which don't exist)
if (isActionAwareTrace) {
  const result = this.#actionIndex.getCandidateActionsWithDiagnostics(actor, trace);
  candidateActions = result.candidates;
  rejectedActions = result.rejected;
  // Capture rejections via trace.captureActionData()
} else {
  candidateActions = this.#actionIndex.getCandidateActions(actor, trace);
}
```

**Note**: The original ticket assumed `options.diagnostics` and `#traceEnabled` fields existed. These don't exist in the current implementation. The stage uses `#isActionAwareTrace(trace)` to detect when diagnostic capture is needed.

## Dependencies

- ACTDISDIAFAIFAS-005 (ActionIndex Diagnostic Mode) - must be completed first

---

## Outcome

**Completed: 2026-01-04**

### What Was Actually Changed

#### Ticket Assumption Corrections

The original ticket assumed `options.diagnostics` and `#traceEnabled` fields existed. These assumptions were corrected:
- **`options.diagnostics`** → Use existing `#isActionAwareTrace(trace)` pattern
- **`#traceEnabled` field** → Not needed; rely on `isActionAwareTrace(trace)` return value
- **`#captureRejections` method** → Created as specified

#### Implementation (src/actions/pipeline/stages/ComponentFilteringStage.js)

1. **Conditional diagnostic method call** (~15 lines):
   - When `isActionAwareTrace` is true, calls `getCandidateActionsWithDiagnostics()`
   - Otherwise uses original `getCandidateActions()` for zero overhead
   - Extracts both `candidates` and `rejected` arrays from diagnostic result

2. **New `#captureRejections` method** (~25 lines):
   - Captures rejection info via `trace.captureActionData('component_filtering_rejections', ...)`
   - Maps rejected actions to structured diagnostic format
   - Graceful error handling with logger.warn

3. **Rejection capture integration**:
   - Called after getting diagnostic results when rejections exist
   - Follows existing trace data patterns from other stages

#### Tests Added (tests/unit/actions/pipeline/stages/ComponentFilteringStage.test.js)

**9 new tests in "Diagnostic Mode (ACTDISDIAFAIFAS-006)" describe block**:
1. Uses `getCandidateActionsWithDiagnostics` when action-aware trace present
2. Uses `getCandidateActions` when no action-aware trace (performance protection)
3. Captures rejected actions in trace when diagnostics enabled
4. Tracks multiple rejections in trace
5. Does not capture rejection data when rejection array is empty
6. Handles captureActionData error for rejections gracefully
7. Maintains backward compatibility
8. Uses getCandidateActions when trace is null (no overhead)
9. Uses getCandidateActions when trace lacks captureActionData method

**Updated 7 existing tests** in "Action-Aware Tracing" section:
- Changed mocks from `getCandidateActions` to `getCandidateActionsWithDiagnostics` since action-aware trace triggers diagnostic path

### Validation

- All 38 tests pass
- ESLint passes with 0 errors (2 pre-existing warnings unrelated to changes)
- Zero-overhead principle preserved: non-diagnostic path unchanged
- Backward compatible: existing trace consumers continue to work
