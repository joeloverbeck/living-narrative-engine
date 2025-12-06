# GOAINIHEUROB-003: Emit deterministic telemetry for initial heuristic failures

## Status

- Completed

## Summary

Align telemetry and diagnostics with the spec so a fatal initial heuristic emits one structured error and one failure record. Today `plan()` already records `GOAP_PLANNER_FAILURES.INITIAL_HEURISTIC_FAILED`, but the payload stores the heuristic label under `details.heuristic` and the `logger.error` call only receives the thrown `Error`. Update this path so `#recordFailure` receives `{ actorId, goalId, heuristicId, nodesExpanded: 0, closedSetSize: 0, failureStats }` and `logger.error` is invoked with the same diagnostic block plus the underlying `Error`. Consumers querying `getLastFailure()` or downstream telemetry hooks should observe the `GOAP_PLANNER_FAILURES.INITIAL_HEURISTIC_FAILED` code exactly once per abort.

## Files

- `src/goap/planner/goapPlanner.js` (ensure `#recordFailure` stores the `heuristicId` field and that `logger.error` receives the full diagnostic payload alongside the thrown error; fatal paths should remain non-coalescing)
- `tests/unit/goap/planner/goapPlanner.plan.test.js` (assert `getLastFailure()` reflects the enriched payload after a fatal heuristic and that the error log now includes the structured metadata)
- `tests/integration/goap/goapPlannerFailureTelemetry.integration.test.js` (new integration that runs the planner via the GOAP controller, forces a throwing heuristic, verifies the dispatcher/telemetry wiring sees exactly one `INITIAL_HEURISTIC_FAILED` record, and that the heuristic warning cache only emits a single warn-level entry for that actor/goal cycle)

## Out of Scope

- Changing the semantics of other failure codes or telemetry events
- Adding new logging endpoints or modifying the logger interface
- Broader documentation refreshes (handled separately if needed)

## Acceptance Criteria

### Tests

- `npm run test:unit -- tests/unit/goap/planner/goapPlanner.plan.test.js` validates `planner.getLastFailure()` (or equivalent helper) returns the enriched payload with `failureStats` snapshot intact after a fatal initial heuristic and resets on subsequent successful plans.
- `npm run test:integration -- tests/integration/goap/goapPlannerFailureTelemetry.integration.test.js` drives the full GOAP stack, asserts the telemetry/dispatcher spy receives `GOAP_PLANNER_FAILURES.INITIAL_HEURISTIC_FAILED` once (via planning failure events), and confirms the heuristic warning cache only emits the single warn-level record already produced by `#safeHeuristicEstimate` when the heuristic throws (no duplicate warns for the same actor/goal in that cycle).

### Invariants

- Fatal telemetry includes `actorId`, `goalId`, `heuristicId`, `nodesExpanded`, `closedSetSize`, and `failureStats` fields; missing keys are considered a regression.
- Only one fatal telemetry/log entry is produced per planner invocation; retries create separate events rather than deduplicating.
- Non-fatal heuristic sanitizations still emit warn-level telemetry with their existing schema and are unaffected by this work.

## Outcome

- `#recordFailure` now copies the `heuristicId` field into the fatal payload and the corresponding `logger.error` invocation logs the same diagnostics (plus the failure code) alongside the thrown `Error`, keeping telemetry consumers in sync.
- `tests/unit/goap/planner/goapPlanner.plan.test.js` and the new integration suite confirm the new diagnostics shape while asserting the GOAP controller dispatches exactly one `INITIAL_HEURISTIC_FAILED` event and that the heuristic warning cache still emits a single warn-level entry for this fatal path.
