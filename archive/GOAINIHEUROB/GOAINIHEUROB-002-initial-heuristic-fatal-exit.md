# GOAINIHEUROB-002: Abort planning when the initial heuristic fails

## Status

- Completed

## Summary

Update `plan()` in `src/goap/planner/goapPlanner.js` so the very first heuristic evaluation is treated as fatal only when it throws. Sanitized values (non-finite/negative outputs) must continue to warn and return `SAFE_HEURISTIC_MAX_COST`, but the fatal path needs to log `logger.error('Initial heuristic calculation failed', error)`, record `GOAP_PLANNER_FAILURES.INITIAL_HEURISTIC_FAILED`, and return `null` before mutating the open list. The recorded failure payload must include actor/goal/heuristic ids, zeroed node metrics, and the current `failureStats` snapshot so `getLastFailure()` exposes deterministic diagnostics.

## Files

- `src/goap/planner/goapPlanner.js` (consume the `#safeHeuristicEstimate` result, build failure details, short-circuit before start node creation, continue warning-only behavior for sanitized heuristic outputs)
- `src/goap/planner/goapPlannerFailureReasons.js` (ensure `INITIAL_HEURISTIC_FAILED` exists and is exported for telemetry consumers)
- `tests/unit/goap/planner/goapPlanner.plan.test.js` (expand section 13 to assert the planner records the failure, logs `error`, and never pushes to the open list)

## Out of Scope

- Additional telemetry fan-out or analytics sinks—only the planner’s own logger and `recordFailure` need to change
- Any modifications to downstream heuristic calls or sanitized warning behavior (see GOAINIHEUROB-001)
- Controller-facing API changes; `plan()` must still resolve to a plan object or `null`

## Acceptance Criteria

### Tests

- `npm run test:unit -- tests/unit/goap/planner/goapPlanner.plan.test.js` includes expectations that `plan()` returns `null`, `logger.error` receives the fatal message, and the failure record exposes `GOAP_PLANNER_FAILURES.INITIAL_HEURISTIC_FAILED` (e.g., via `getLastFailure()`) when the heuristic throws synchronously.
- The same suite asserts that subsequent heuristic calls (distance checks) still treat sanitized outputs as warnings rather than errors, proving the fatal path is scoped to the initial node only.

### Invariants

- When the fatal path triggers, `openList` remains empty and `nodesExpanded`/`closedSetSize` are still `0`, matching the diagnostics snapshot in `getLastFailure()`.
- `failureStats` is snapshot-copied into the recorded failure so callers inspecting `getLastFailure()` can rely on deterministic data.
- The planner never throws outward; callers always receive `null` for the fatal case.

## Outcome

- Planner implementation already aborted when the initial heuristic threw, so no source changes were required beyond documenting the correct scope.
- Section 13 of `goapPlanner.plan.test.js` gained coverage that asserts the failure payload exposed by `getLastFailure()` plus a new test proving sanitized distance-check heuristics only emit warnings.
