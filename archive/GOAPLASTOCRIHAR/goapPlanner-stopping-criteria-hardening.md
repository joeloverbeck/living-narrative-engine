# Context

- Module: `src/goap/planner/goapPlanner.js` plus helpers `planningNode`, `goalPathValidator`, `goalConstraintUtils`.
- Responsibility: run GOAP A\* planning with cost/action limits, heuristic distance checks, and diagnostic reporting.
- Test coverage entry point: `tests/unit/goap/planner/goapPlanner.stoppingCriteria.test.js` exercises cost limits, action limits, search exhaustion, and logging.

# Problem

- Reproduced failure via `tests/unit/goap/planner/goapPlanner.stoppingCriteria.test.js`.
- Failures came from providing ad-hoc planning states and goals that bypassed `buildPlanningState`/`buildPlanningGoal`, so `validateGoalPaths` continuously logged `GOAP_INVALID_GOAL_PATH` and the search never converged.
- Because mocks only defined a handful of heuristic returns, extra calls from numeric guards produced `undefined` h-scores, tripping `PlanningNode`'s non-negative guard and preventing diagnostic logging.

# Truth sources

- `specs/goap-system-specs.md`: documents planner contracts (goal path validation, numeric guards, stop conditions).
- `docs/goap/debugging-tools.md#Planner Contract Checklist`: explains why `actor.components.*` must prefix JSON Logic paths.
- Production code in `src/goap/planner/goapPlanner.js`, `src/goap/planner/planningNode.js`, and `src/goap/planner/goalPathValidator.js` is the canonical behavior that tests must shadow.

# Desired behavior

## Normal cases

- `goal.goalState` references actor state via `state.actor.components.*` or flattened aliases so `validateGoalPaths` passes without warnings.
- Planning states used in tests mirror runtime structure (flat hashes + nested `state.actor.components`) so heuristic calculations and JSON Logic checks read consistent data.
- `heuristicRegistry.calculate` always returns finite, non-negative numbers for every invocation, including numeric guard checks and reuse validation.

## Edge cases

- Cost limit `Infinity` should skip feasibility gate but still accept numeric goals; zero cost limit should fail fast with `ESTIMATED_COST_EXCEEDS_LIMIT` or `NODE_LIMIT_REACHED` logs.
- Numeric guard rejection should flip `failureCode` to `DISTANCE_GUARD_BLOCKED` and emit message `Distance guard rejected all numeric goal tasks` while still including nodesExpanded/closedSetSize diagnostics.
- Planner should tolerate repeated heuristic invocations even if goal paths were malformed historically (defensive logging without `PlanningNode` crashes).

## Failure modes

- When feasibility check estimate exceeds `goal.maxCost`, planner logs `'Goal estimated cost exceeds limit'` and records failure `ESTIMATED_COST_EXCEEDS_LIMIT`.
- When numeric guard rejects every candidate, planner logs `'Goal unsolvable - open list exhausted'` plus `failureCode: DISTANCE_GUARD_BLOCKED` and sets `failureStats.numericGuardBlocked = true`.
- If heuristic or effect simulation throws, planner should warn once per failure and continue evaluating alternative tasks when possible; unit tests must mock these paths deterministically.

## Invariants

- Every `PlanningNode` is built with finite `gScore`/`hScore`; tests never allow mocks to return `undefined`, `NaN`, or negative numbers.
- Goal path validation must either throw (when lint enforcement enabled) or log a single warning per actor/goal pair, but it must not change search semantics for already-valid inputs.
- Failure diagnostics emitted via `logger.warn` always include `actorId`, `goalId`, `nodesExpanded`, `closedSetSize`, `maxCost`, and `maxActions` to support debugging.

## API contracts

- `GoapPlanner.plan(actorId, goal, initialState)` signature and return shape `{ tasks, cost, nodesExplored } | null` stay unchanged.
- `goal.goalState` JSON Logic schema stays the same, only path normalization/validation is enforced.
- `heuristicRegistry.calculate(heuristicId, state, goal, taskLibrary)` continues to return numeric estimates; no extra parameters introduced.

## What is allowed to change

- Internally, planner may coerce initial goal states via `rewriteActorPath` before validation to avoid duplicate warnings.
- Tests can share helpers like `buildPlanningState`/`buildPlanningGoal` to construct canonical states/goals.
- Additional telemetry fields (e.g., `failureCode`, `failureStats.numericGuardBlocked`) may be asserted in tests for stronger guarantees.

# Testing plan

## Tests to update or add

- Keep `tests/unit/goap/planner/goapPlanner.stoppingCriteria.test.js` using `buildPlanningState` and `buildPlanningGoal` so every scenario exercises valid goal paths.
- Extend unit tests to cover numeric guard diagnostics explicitly (assert `failureCode: DISTANCE_GUARD_BLOCKED`).
- Add regression test ensuring planner tolerates `maxCost: Infinity` without triggering finite-limit code paths.

## Regression / property tests

- Property-style test that fakes heuristic registry with deterministic function of `state` to guarantee every call returns finite numbers, preventing `PlanningNode` construction failures.
- Snapshot-esque test that records `logger.warn` payloads for cost/action limit breaches to ensure required diagnostic keys remain present.
- Optionally add integration test that builds a dual-format state via `buildDualFormatState` and ensures a valid plan resolves when goal paths follow the canonical schema.
