# GOAMULACTROB-004 Telemetry + watchdog tooling

## Status

✅ Completed – planning compliance telemetry exposed to diagnostics without touching event payload contracts.

## Summary

- `createGoapEventDispatcher` currently exposes `getComplianceSnapshot()` but it only tracks total dispatches and payload violations, so dashboards still cannot see `PLANNING_COMPLETED` vs `PLANNING_FAILED` rates per actor.
- We need additive telemetry that counts planning outcomes per actor/global, surfaces them through a new `getPlanningComplianceSnapshot()` helper, and threads that snapshot through the `GoapController` diagnostics API that `docs/goap/debugging-tools.md` references.
- The dispatcher must continue to enforce the `(eventType, payload)` contract; the new planning counters and snapshots must not alter dispatch payloads.

## Tasks

- Extend `src/goap/debug/goapEventDispatcher.js` so it records cumulative `PLANNING_COMPLETED`/`PLANNING_FAILED` counts per actor and globally, keeping the counters isolated per actor and exposing a defensive `getPlanningComplianceSnapshot()` result.
- Thread the planning snapshot through `GoapController.getEventComplianceDiagnostics()` so existing tooling can see `{ actor, global, planningOutcomes }` without a breaking API change.
- Update `tests/unit/goap/debug/goapEventDispatcher.test.js` to prove per-actor counters, ensure interleaved success/failure tracking, and confirm snapshots stay immutable when read.
- Reference the new telemetry surface in `docs/goap/debugging-tools.md`, specifically in the instrumentation section so observability dashboards know how to pull the planning compliance snapshot.

## File list

- `src/goap/debug/goapEventDispatcher.js`
- `src/goap/controllers/goapController.js`
- `tests/unit/goap/debug/goapEventDispatcher.test.js`
- `docs/goap/debugging-tools.md`

## Out of scope

- Rewriting the broader event bus plumbing or changing existing GOAP event payload shapes.
- Adding remote telemetry exporters/dashboards (this ticket only surfaces local data).

## Acceptance criteria

### Specific tests that must pass

- `npm run test:unit -- goapEventDispatcher`

### Invariants that must remain true

- `createGoapEventDispatcher` continues to return a dispatcher compatible with all existing consumers; the new compliance snapshot must be purely additive and optional.
- Actor compliance counters reflect the payload's `actorId` field exactly; missing or malformed actor IDs should be ignored with a logged warning rather than crashing the dispatcher.

## Outcome

- Extended `createGoapEventDispatcher` with per-actor/global planning outcome counters, a cloning `getPlanningComplianceSnapshot()`, and warnings for missing actor IDs without altering dispatch payloads.
- Threaded the planning snapshot through `GoapController.getEventComplianceDiagnostics()` and documented the new `{ actor, global, planning }` diagnostics contract so observability hooks know where to read the counters.
- Added dispatcher unit tests for multi-actor counters, immutability, and missing-actor warnings to permanently cover the edge cases that exposed the gap.
