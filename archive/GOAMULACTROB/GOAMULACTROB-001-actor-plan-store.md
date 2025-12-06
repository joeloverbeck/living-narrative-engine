# GOAMULACTROB-001 Actor-scoped plan store

**Status:** Completed

## Summary

- `GoapController` already tracks plans in `#activePlans`, but most controller helpers still mutate/read a shared `#activePlan` pointer. When two actors call `decideTurn` concurrently (e.g., overlapping promises in the turn scheduler), the pointer gets reassigned mid-await and the first actor resumes with the second actor's plan state.
- Formalize actor-scoped plan helpers (`#getActorPlan`, `#setActorPlan`, `#deleteActorPlan`, etc.) and update `decideTurn`, validation, advancement, diagnostics, and clearing helpers to operate exclusively on actor IDs so plan mutations cannot bleed across actors.
- Add regression coverage that simulates overlapping turns for two actors plus explicit `#clearPlan` assertions so the contract is guarded by tests.

## Tasks

- Implement private actor-scoped helpers on `GoapController` (`#getActorPlan`, `#setActorPlan`, `#deleteActorPlan`) that validate IDs and hide the `Map` access.
- Refactor `decideTurn`, `#validateActivePlan`, `#getCurrentTask`, `#advancePlan`, `#clearPlan`, `#handleRefinementFailure`, `#extractActionHint`, and any event/diagnostic logging so they take an `actorId` (and/or plan reference) instead of touching a singleton `#activePlan` field. The shared pointer should be removed entirely.
- Ensure debug APIs (`getActivePlan`, `getCurrentTask`, diagnostics getters) continue to return read-only copies sourced from `#activePlans` without mutating controller state.
- Extend `GoapController.EventDispatching` and `GoapController.PlanStateManagement` unit suites with two-actor scenarios, including an overlapping `decideTurn` promise test that fails under the old shared-pointer behavior and confirms `GOAP_EVENTS.PLANNING_COMPLETED`/plan progress stays per actor.
- Add regression coverage in `GoapController.FailureHandling` that calls `#clearPlan` for one actor and asserts another actor's plan/diagnostics remain intact.

## File list

- `src/goap/controllers/goapController.js`
- `tests/unit/goap/controllers/goapController.EventDispatching.test.js`
- `tests/unit/goap/controllers/goapController.PlanStateManagement.test.js`
- `tests/unit/goap/controllers/goapController.FailureHandling.test.js`

## Out of scope

- Changing how goals are prioritized/selected or altering planner heuristics.
- Modifying the event bus contract or payload schema consumed by downstream debugging tools.
- Multi-actor integration harness updates (covered by a separate ticket).

## Acceptance criteria

### Specific tests that must pass

- `npm run test:unit -- goapController.EventDispatching`
- `npm run test:unit -- goapController.PlanStateManagement`
- `npm run test:unit -- goapController.FailureHandling`

### Invariants that must remain true

- `GoapController.getActivePlan(actorId)` remains read-only and never mutates controller state while servicing debug requests.
- `GOAP_EVENTS.PLANNING_COMPLETED` and `GOAP_EVENTS.PLANNING_FAILED` payloads keep their current shape and continue to include the correct `actorId`.
- Clearing or updating one actor's plan must not modify or delete another actor's diagnostics or cached plan entries.

## Outcome

- Removed the shared `#activePlan` pointer in favor of validated `#getActorPlan`/`#setActorPlan` helpers so every controller operation (validation, advancement, diagnostics, clearing, and refinement failure handling) works off the actor-scoped map even while turns overlap.
- Updated the action-hint pipeline and debug events to receive the correct `goalId` per actor, ensuring logging/telemetry remain stable with the new helpers.
- Added overlapping-turn regression tests in the EventDispatching and PlanStateManagement suites plus a FailureHandling test that proves `#clearPlan` only affects the failing actor, covering the scenarios the original ticket targeted.
