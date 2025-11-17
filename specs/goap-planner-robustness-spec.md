# GOAP Planner Robustness & Flexibility Spec

## Background

Recent fixes to `tests/unit/goap/planner/goapPlanner.plan.test.js` highlighted two failure modes:

1. JSON Logic goal expressions referenced `actor.*` paths that are not provided by `createPlanningStateView(state)` (see `specs/goap-system-specs.md`). This silently prevented goal satisfaction checks from firing.
2. Several suites used planning effect simulation failures (`success: false`) as a proxy for task preconditions. Production code now treats unsuccessful simulations as fatal per the guardrails documented in `docs/goap/debugging-tools.md#Planner Contract Checklist`, so those assumptions broke immediately.

This document proposes hardening the production planner so that these misconfigurations are rejected up front and surfaced through diagnostics before they make it into tests or gameplay builds.

## Goals

- Enforce the `PlanningStateView` contract by validating goal JSON Logic paths during planner setup and data validation.
- Encourage precondition-first task gating so that the effect simulator is only responsible for state transitions, not feasibility checks.
- Emit actionable diagnostics (via GOAPDebugger) whenever planners or tests bypass those guardrails.
- Provide reusable helpers so future tests and mods cannot drift from the canonical state shape.

## Non-Goals

- Redesigning the GOAP heuristic stack or replacing JSON Logic.
- Changing the `GOAP_PLANNER_FAILURES` taxonomy beyond the additions below.

## Specifications

### 1. JSON Logic Path Validation

1. Add a `validateGoalPaths(goalState, metadata)` helper inside `GoapPlanner.#goalSatisfied`. The validator should walk the JSON Logic AST and record any `var` usage that targets `actor.*` instead of `actor.components.*` or `state.actor.components.*`.
2. When invalid paths are detected:
   - Record a planning failure (`GOAP_PLANNER_FAILURES.INVALID_GOAL_PATH`) and emit a `GOAP_DEBUGGER_DIAGNOSTICS_MISSING` warning referencing `docs/goap/debugging-tools.md`.
   - Include the offending path(s) in `planner.getLastFailure().details.goalPathViolations`.
3. Expose the helper through a new data validation script (e.g., `npm run validate:goals`) so content authors catch violations before runtime.
4. Update `tests/common/testBed.js` to export `buildPlanningGoal(goalState)` that automatically rewrites bare `actor.*` segments to `actor.components.*`. Unit tests should adopt this helper to stay aligned with the production contract.

### 2. Precondition-First Task Gating

1. Teach `planningEffectsSimulator` (or a thin wrapper) to emit structured telemetry whenever a task returns `{ success: false }`. The telemetry should include `{ taskId, phase, goalId }` so GOAPDebugger snapshots can point content authors to missing preconditions.
2. Extend `GOAP_PLANNER_FAILURES` with `INVALID_EFFECT_DEFINITION` (already surfaced) and document in `docs/goap/debugging-tools.md` that unsuccessful simulations are fatal errors.
3. Author a `normalizeTaskPreconditions(task, logger)` helper to make it trivial for task authors (and tests) to declare gating logic without reaching for simulator failures. The helper should:
   - Accept shorthand booleans (e.g., `task.requires = 'actor.components.inventory_has_food'`).
   - Emit warnings into `taskLibraryDiagnostics.preconditionNormalizations`.
4. Update `GoapPlanner.#getApplicableTasks` to call this helper and include any normalization warnings in the diagnostics contract surfaced by GOAPDebugger. That way, if a task reaches the effect simulator without valid preconditions, we know immediately.

### 3. Test & Diagnostics Tooling

1. Add a reusable `buildPlanningState(stateFragments)` helper under `tests/common/goap` that mirrors the dual-format snapshot described in `specs/goap-system-specs.md`. Tests should consume this instead of hand-rolling `{ 'actor:hunger': true }` objects, guaranteeing consistent hashing and actor snapshots.
2. Export a `expectInvalidEffectFailure(planner, taskId)` assertion helper (wrapping `planner.getLastFailure()`) so suites can assert on diagnostics rather than logging strings.
3. Enhance `docs/goap/debugging-tools.md` with a short recipe explaining how to interpret the new `INVALID_GOAL_PATH` and `INVALID_EFFECT_DEFINITION` signals in Plan Inspector and the CLI diagnostics dump.

## Telemetry & Alerting

- Update `GOAPDebugger.generateReportJSON()` to surface two new sections:
  - `goalPathViolations`: lists actors/goals with invalid JSON Logic paths.
  - `effectFailureTelemetry`: aggregates tasks that triggered simulator aborts, grouped by reason.
- Wire both sections into the existing diagnostics contract versioning so downstream dashboards and CI alerts (see `docs/goap/debugging-tools.md#Diagnostics Contract`) can highlight regressions immediately.

## Rollout

1. Land the helpers and diagnostics changes behind feature flags (e.g., `GOAP_GOAL_PATH_LINT=1`) so CI smoke-tests the validation without blocking modders instantly.
2. After one full CI cycle, enable the validation by default and update `npm run test:ci` documentation to mention the new guardrails.
3. Extend `tests/unit/goap/planner` suites with coverage for:
   - Successful planning when goals use the canonical `actor.components.*` format.
   - Planner abort when a goal tries to access `actor.hp` directly.
   - Diagnostics emitted when a task returns `success: false`.

These steps ensure the production planner remains flexible (task authors can still encode complex logic) while guarding against the silent failures that tripped the existing tests. More importantly, the diagnostics integrations outlined above mean that if something drifts again, the issue surfaces in GOAPDebugger and CI immediately instead of hiding behind green tests.
