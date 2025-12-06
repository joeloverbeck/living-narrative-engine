# GOAP Multi-Actor Robustness & Flexibility

## Background

Multi-actor integration suites exposed two brittle assumptions:

1. `GoapController` only tracked a single `#activePlan`, so the second actor in a turn sequence reused the first actor's plan instead of planning independently.
2. Goals used as templates in tests (and occasionally in mods) sometimes hardcoded a literal actor ID inside `has_component` checks, which makes the goal unusable for any other actor.

Both issues made sequential actor execution silently fail: only the first actor dispatched `GOAP_EVENTS.PLANNING_COMPLETED`, while the rest emitted `PLANNING_FAILED` after a series of `goap:state_miss` diagnostics. We need to harden both the controller state machine and the content/goal authoring workflow so regressions are caught immediately.

## Goals

- Maintain distinct plan state per actor without leaking cross-actor progress or diagnostics.
- Add validation to goals/tasks so shared templates always reference the acting actor symbol (`'actor'`) rather than hardcoded IDs.
- Introduce diagnostics/tests that assert every actor in a multi-actor turn produces either a `PLANNING_COMPLETED` or a meaningful failure code, never a silent miss.
- Keep instrumentation compatible with `docs/goap/debugging-tools.md` so event probes stay accurate.

## Non-Goals

- Changing how goals are prioritized or selected.
- Redesigning the event bus contract.
- Replacing the planner—this spec only addresses controller state and goal authoring ergonomics.

## Proposed Changes

### 1. Actor-Scoped Plan Store

- Replace `#activePlan` with a `Map<actorId, plan>`, exposing helper accessors (`#getActorPlan`, `#setActorPlan`).
- Each `decideTurn(actor)` call must load the actor's plan before validation/refinement and write it back before returning.
- `#clearPlan` must evict from the map and scrub diagnostics via `#cleanupActorDiagnostics`.
- Expose `getActivePlan(actorId)` by reading from the map so tooling can inspect any actor without mutating controller state.
- Extend `GoapController.EventDispatching` unit tests to assert `PLANNING_COMPLETED` fires independently for at least two actors in sequence.

### 2. Goal Template Guardrails

- Add a validator in `ContextAssemblyService` (or a preflight linter under `scripts/`) that walks goal definitions looking for `has_component: [<literal actor id>, ...]` when the goal also declares `scope: actor`. Flag these as violations of `specs/goap-system-specs.md#Planning-State View Contract` and fail CI.
- Update `createTestGoal` helpers to default to `has_component: ['actor', ...]`, emitting a warning if an override slips in a literal entity ID when running under `NODE_ENV=test`.
- Document this constraint explicitly inside `docs/goap/debugging-tools.md` under "Empty plan completions" so content authors know to rely on the `'actor'` alias.

### 3. Diagnostics & Test Coverage

- Extend `tests/integration/goap/multiActor.integration.test.js` with a helper that records `GOAP_EVENTS.PLANNING_COMPLETED` vs `PLANNING_FAILED` counts per actor and asserts coverage for at least three actors.
- Add a regression test that alternates actors A/B over multiple turns to ensure plan maps persist between turns and don't leak tasks from other actors.
- Capture a `planning_state_snapshot` per actor inside the integration setup (leveraging `registerPlanningStateSnapshot`) and assert that the diagnostic event bus records misses against the correct actor ID; this will catch any future aliasing issues immediately.

### 4. Telemetry Hooks

- Teach `createGoapEventDispatcher` to surface actor-specific compliance snapshots for `PLANNING_COMPLETED` vs `PLANNING_FAILED` counts so dashboards can alert when a shard suddenly shows asymmetric planning success.
- Add a lightweight watchdog script (`scripts/check-goap-multi-actor.js`) that spins up the integration harness, runs a three-actor turn, and fails fast if fewer than three planning completions are recorded.

## Testing Strategy

- Unit: new tests for `GoapController` verifying the plan map behavior (create/advance/clear across actors).
- Integration: existing multi-actor suite plus the alternating-turn regression described above.
- Tooling: run the new goal template validator inside `npm run validate:goals` so CI blocks bad mods.

## Open Questions

1. Should plan maps be persisted across save/load boundaries? If so, ensure serialization hooks are added to the controller.
2. Do we need per-actor recursion depth counters once we support concurrent actors, or is the global counter acceptable?
3. Would it help to surface a dedicated `GOAP_EVENTS.PLANNING_SKIPPED` when a goal is irrelevant, so multi-actor tooling can distinguish "no plan" from "no goal" cases?
