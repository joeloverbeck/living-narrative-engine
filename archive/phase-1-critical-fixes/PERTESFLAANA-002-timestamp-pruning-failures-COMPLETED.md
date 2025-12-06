# PERTESFLAANA-002: Tighten Failure History Cleanup

**Reference**: [Performance Test Flakiness Analysis](../performance-test-flakiness/performance-test-flakiness-analysis.md)

## Status

- Completed

## Summary

`GoapController` already performed timestamp-based pruning inside `#trackFailedGoal` and `#trackFailedTask`—each failure array was truncated to entries newer than 5 minutes and capped at three recent failures. The remaining risk was the **maps** holding these arrays: goal/task IDs remained in `#failedGoals` and `#failedTasks` even after all of their failures expired because pruning only happened when a new failure was recorded. This left stale, empty arrays in the maps and allowed the number of tracked IDs to grow without bounds during long-running sessions.

## Outcome

- Added a shared helper that prunes failure maps using the existing five-minute window and deletes keys whose histories have fully expired; this helper now runs during failure tracking and diagnostic reads.
- Exposed a lightweight debug snapshot (`getFailureTrackingSnapshot`) so diagnostics and tests can confirm map cleanup without touching private fields.
- Retention behavior (5 minutes, three failures) and the public `GoapController` API remain unchanged.

## Problem Statement

The failure tracking maps retain expired entries even though individual arrays are timestamp-pruned to a five-minute window and capped at three failures:

- `#failedGoals` (Map<string, Array<{reason, code, timestamp}>>) – keyed by **goalId** (not actor)
- `#failedTasks` (Map<string, Array<{reason, code, timestamp}>>) – keyed by **taskId** (not actor)

Because pruning previously ran only when new failures were appended, any goal/task that failed once was stored indefinitely. Diagnostic getters filtered out expired entries but did not delete the empty arrays, so the maps could still grow over time. A lightweight cleanup pass removes expired entries and clears map keys with no surviving failures.

## Files Expected to Touch

### Modified Files

- `src/goap/controllers/goapController.js`
  - Add a small helper to prune failure maps and delete empty entries using the existing 5-minute expiry window
  - Invoke cleanup where failure histories are read or updated

### Test Files

- `tests/unit/goap/controllers/goapController.test.js`
  - Add/adjust unit coverage for expiry cleanup that removes empty map entries

## Out of Scope

**DO NOT CHANGE**:

- `GoapPlanner` cache management (separate ticket: PERTESFLAANA-001)
- Goal/task selection logic
- Planning algorithm or heuristics
- Error reporting or logging mechanisms
- Any diagnostic maps (`#goalPathDiagnostics`, etc.) - covered by PERTESFLAANA-003
- Test thresholds or timing assertions
- Any files outside `src/goap/controllers/` and corresponding tests

## Implementation Details

### Cleanup Helper

Keep the existing 5-minute retention window (used by both tracking functions) and add a shared helper that:

- Filters each entry to the retention window
- Deletes map keys whose arrays become empty after pruning
- Returns the pruned arrays so callers can continue to enforce failure caps

### Integration Points

- Reuse the helper inside the existing failure tracking logic so it no longer leaves behind empty arrays
- Invoke the helper inside the diagnostic getters to ensure stale entries are removed even when no new failures arrive

## Acceptance Criteria

### Specific Tests That Must Pass

1. **Unit Tests** (`tests/unit/goap/controllers/goapController.test.js`):
   - ✅ Should delete failure map entries once all failures expire
   - ✅ Should keep non-expired failures intact
   - ✅ Should preserve existing failure tracking behavior (max 3 recent failures within 5 minutes)

2. **Integration/Performance Tests**:
   - ✅ Existing GOAP integration and performance tests continue to pass (no new assertions required)

### Invariants That Must Remain True

1. **Functional Correctness**:
   - Recent failures still accessible for decision making
   - Failure recording behavior unchanged (still capped at 3 failures in 5 minutes)
   - Goal/task selection logic unaffected

2. **API Compatibility**:
   - No changes to public GoapController API
   - Failure tracking method signatures unchanged

3. **Performance Characteristics**:
   - Cleanup remains O(n) over tracked IDs
   - No measurable degradation in planning performance
   - Pruning overhead remains negligible (single Map traversal)

4. **Data Integrity**:
   - Pruning doesn't remove non-expired failures
   - Timestamp-based filtering remains accurate

## Testing Strategy

### Unit Testing

```javascript
describe('GoapController - Failure Cleanup', () => {
  it('removes expired failure entries when fetching diagnostics', () => {
    // Existing expiry window is 5 minutes inside trackFailedGoal/Task
    // Advance fake timers beyond expiry and call diagnostic getter to trigger cleanup
  });
});
```

Cleanup is exercised via the updated unit tests; no additional performance-specific assertions are necessary.

## Implementation Notes

1. **Pruning Frequency**: Pruning already happens on every failure append; the new helper also deletes empty map entries and can be called from diagnostics to clean up stale IDs.

2. **Retention Period**: Retain existing five-minute window to avoid API churn.
