# Context
- Module: `src/goap/planner/goapPlanner.js` (A* search planner) with dependencies `heuristicRegistry`, diagnostics logging, and failure recording helpers.
- Responsibility: compute heuristic estimates, seed initial node, and manage planner lifecycle including logging/telemetry when heuristics misbehave.
- Pain point area: `#safeHeuristicEstimate` wrapper plus the initial call inside `plan()` before the open list is constructed.

# Problem
- Test `tests/unit/goap/planner/goapPlanner.plan.test.js` "should abort search when initial heuristic calculation throws" failed because thrown heuristics only triggered warn-level sanitization and the planner proceeded with a fallback cost.
- Effects: planner state machine ignored catastrophic heuristic failures, causing null diagnostics, no early exit, and eventual mismatch with telemetry expectations.
- Causes: `#safeHeuristicEstimate` suppressed the error and callers had no signal to abort; initial heuristic path never logged `logger.error` or recorded a failure code.

# Truth sources
- Repository GOAP specifications (`docs/` + specs/goap-system-specs.md) that demand deterministic planning and full telemetry when heuristics fail.
- Jest suite `tests/unit/goap/planner/goapPlanner.plan.test.js` sections 10 & 13, defining expected logging/abort semantics.
- Domain rule: heuristics are advisory except for the very first call that seeds the frontier; if that fails we cannot continue reliably.

# Desired behavior
## Normal cases
- Initial heuristic calculation succeeds → planner records estimate, continues search, related telemetry unaffected.
- Subsequent heuristic calls that warn (sanitized) should still return `SAFE_HEURISTIC_MAX_COST` and allow downstream logic to make reuse/guard decisions.

## Edge cases
- Initial heuristic throws synchronously: planner must log via `logger.error('Initial heuristic calculation failed', error)`, record `GOAP_PLANNER_FAILURES.INITIAL_HEURISTIC_FAILED`, and return `null` before mutating `openList`.
- Initial heuristic returns non-finite/negative numbers: treat as sanitized but non-fatal; warn once per actor/goal/heuristic combo.
- Later heuristic calls throwing: treat as sanitized warnings; optionally expose counters so distance-guard checks can fall back gracefully.

## Failure modes
- Provide deterministic `recordFailure` payload with actorId, goalId, heuristic, nodesExpanded=0, closedSetSize=0, and failureStats snapshot when aborting before search begins.
- Raising behavior: abort returns `null`, no exception leaking to controller; repeated errors for same actor/goal should still emit errors (no warn-once suppression for fatal cases).

## Invariants
- `#safeHeuristicEstimate` always returns `{ estimate, sanitized, error? }` and never throws.
- Planner never pushes a node whose `hScore` derives from an errored heuristic.
- Failure codes remain part of `GOAP_PLANNER_FAILURES` enum and are consumed by telemetry/reporting.

## API contracts
- Public planner API (`plan(actorId, goal, initialState)`) and return shape remain unchanged (either plan object or `null`).
- Logger + recordFailure side-effects are observational diagnostics only; callers do not see new exceptions.
- Heuristic registry interface remains `(heuristicId, state, goal, taskLibrary)`.

## What is allowed to change
- Internal failure codes list/extensions.
- Structure of logged metadata (adding context keys) as long as logging method signatures stay the same.
- Additional guardrails in `#safeHeuristicEstimate` (e.g., retry counters, heuristics opt-outs).

# Testing plan
## Tests to update/add
- Ensure `tests/unit/goap/planner/goapPlanner.plan.test.js` continues asserting error logging + null result when the initial heuristic throws.
- Add a complementary test verifying that non-initial heuristic throws still permit planning but emit warnings (protects sanitized behavior).

## Regression/property tests
- Property-style test for `#safeHeuristicEstimate` verifying it never throws and always returns finite estimates.
- Integration test for planner failure telemetry ensuring `GOAP_PLANNER_FAILURES.INITIAL_HEURISTIC_FAILED` is emitted exactly once per fatal scenario.
- Optional contract test for `HeuristicRegistry` mocks to ensure they can signal unrecoverable errors without hanging the planner.
