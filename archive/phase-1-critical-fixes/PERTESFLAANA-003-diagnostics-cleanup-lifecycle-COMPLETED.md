# PERTESFLAANA-003: Diagnostics cleanup lifecycle (COMPLETED)

**Reference**: [PERTESFLAANA-000 Summary](./PERTESFLAANA-000-SUMMARY.md)

## Reassessment
- The codebase does **not** expose `clearActorDiagnostics()` on either `GoapController` or `GoapPlanner`. The controller only has a private `#cleanupActorDiagnostics()` that runs when a plan is cleared. The planner already drains its goal-path and effect telemetry maps when their getters are called, and its normalization cache is bounded (100 entries).
- There is no hook for callers/tests to proactively drop diagnostics for an actor that has left the simulation, and controller cleanup does not delegate to the planner. The flakiness analysis assumptions about existing cleanup calls were inaccurate.
- Tests did not assert any diagnostics cleanup lifecycle; there was no coverage for actor-specific teardown paths.

## Adjusted Scope
- Add an explicit `clearActorDiagnostics(actorId)` on `GoapController` that reuses the existing internal cleanup and, when available, delegates to the planner.
- Add `clearActorDiagnostics(actorId)` on `GoapPlanner` to drop any pending diagnostics/telemetry for that actor and reset the normalization cache.
- Cover the new cleanup behavior with unit tests; no per-turn automatic cleanup is introduced to preserve debugging visibility.

## Acceptance criteria
- Controller exposes `clearActorDiagnostics(actorId)` that validates input, clears controller diagnostics, and calls the planner hook when present.
- Planner exposes `clearActorDiagnostics(actorId)` that drains goal-path diagnostics, effect telemetry, and normalization cache; it is a no-op for missing actor IDs.
- Unit tests cover the cleanup paths and delegation behavior.
- Relevant unit suites pass: `npm run test:unit -- --runInBand tests/unit/goap/controllers/goapController.test.js tests/unit/goap/planner/goapPlanner.diagnosticsCleanup.test.js`.

## Status
Completed.

## Outcome
- Added `clearActorDiagnostics` entry points on the controller and planner to allow explicit cleanup and delegation.
- Added unit coverage for the cleanup lifecycle and planner cache reset.
- Deferred per-turn automatic cleanup; diagnostics remain available within a turn and are manually cleared when requested.
