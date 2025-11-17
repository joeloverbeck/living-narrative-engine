# Goal Distance Heuristic Flexibility & Guardrails Spec

## Background
- `GoalDistanceHeuristic` now depends entirely on `PlanningStateView` to expose the dual-format planning state described in `specs/goap-system-specs.md`.
- Recent test drift showed that callers and tests were reaching directly for raw state hashes, which bypasses the diagnostics described in `docs/goap/debugging-tools.md` and silently regresses actor/goal invariants.
- We need first-class hooks so heuristics, numeric evaluators, and debugging telemetry stay aligned whenever we add new state fields or constraint types.

## Goals
1. Make numeric goal handling resilient to state-shape changes by centralizing the evaluation context hand-off.
2. Emit diagnostics (GOAP debugger + log) whenever a heuristic falls back from numeric distance to boolean counting so regressions surface immediately.
3. Provide contract tests that fail fast when heuristics or evaluators stop using `PlanningStateView` metadata.

## Requirements & Design

### A. Centralized Evaluation Context Adapter
- Introduce `GoalEvaluationContextAdapter` in `src/goap/planner/goalEvaluationContextAdapter.js`.
  - Accepts `{ state, goal, logger, origin }` and returns `{ evaluationContext, stateView, metadata }`.
  - Encapsulates the current `createPlanningStateView` call, actor inference, metadata population, and ensures `context.state` always references the *wrapped* state, not the raw hash.
  - Expose helpers `adapter.getActorSnapshot()` and `adapter.getDiagnosticsPayload()` so tests/diagnostics do not dig into internal WeakMaps.
- Refactor `GoalDistanceHeuristic`, `NumericConstraintEvaluator`, and `GoapPlanner.#goalSatisfied` to use the adapter instead of rolling their own `createPlanningStateView` calls.
  - This enforces a single code path and makes it easier to add additional state sanitizers (e.g., path rewrites) later.

### B. Numeric Constraint Evaluator Resilience
- Extend `NumericConstraintEvaluator.calculateDistance` signature to accept `{ stateView, metadata }` (optional today) and default to the adapter when not provided.
- When numeric extraction fails (`null`/`undefined`), log a structured warning via `GOAPDebugger.eventBus` using the diagnostics contract from `docs/goap/debugging-tools.md` (section **Planner Contract Checklist**):
  - Event type `goap:numeric_constraint_fallback` with `{ goalId, origin, operator, actorId, missingPath }`.
  - This warning is surfaced in debugger reports and recorded by CI (via `GOAP_DEPENDENCY_WARN`).
- Add a feature flag `GOAP_NUMERIC_STRICT=1` that throws instead of falling back, so CI can opt-in to hard failures while local runs remain forgiving.

### C. Test & Contract Coverage
- Add regression tests under `tests/unit/goap/planner/goalDistanceHeuristic.contract.test.js` verifying:
  - Heuristic always calls `NumericConstraintEvaluator.calculateDistance` with the adapter-provided context/options object.
  - Boolean fallback emits a `goap:numeric_constraint_fallback` warning with metadata.
- Update `tests/unit/goap/planner/goapPlanner.stateHelpers.test.js` to import the adapter helper for context assertions instead of duplicating expectations.
- Create integration harness in `tests/integration/goap/goalDistanceHeuristic.contract.test.js` that:
  - Boots DI container, resolves `IGoalDistanceHeuristic`, and asserts GOAPDebugger reports numeric fallback events when we mark `GOAP_NUMERIC_STRICT=0`.
  - Ensures `GOAPDebugger.getDiagnosticsContractVersion()` increments when adapter payload changes.

### D. Tooling & Developer Experience
- Add a lint rule (custom ESLint rule under `eslint/rules/goap-no-raw-state.js`) that flags `context.state = state` assignments outside the adapter.
- Update `docs/goap/debugging-tools.md` with a new subsection **Numeric Constraint Diagnostics** describing the fallback event, env flag, and how to inspect the payload via GOAPDebugger/Plan Inspector.
- Provide a `npm run validate:goap-contexts` script that scans goals/tasks for deprecated paths (`actor.core.*`) and ensures newly added helpers catch them early.

## Telemetry & Monitoring
- `GOAPDebugger` must record `numericConstraintFallbacks` array per actor with `{ goalId, origin, varPath, timestamp }`. Plan Inspector shows this under the Goal diagnostics section.
- Add a lightweight counter to `MonitoringCoordinator` so `npm run test:ci` can assert zero fallbacks when `GOAP_NUMERIC_STRICT=1`.

## Testing Strategy
1. **Unit**: Adapter tests covering actor inference, metadata propagation, and memoization.
2. **Unit**: Numeric evaluator tests verifying flat + nested extraction via adapter and strict/fallback modes.
3. **Integration**: GOAP planner tests verifying fallback telemetry surfaces through GOAPDebugger JSON output.
4. **End-to-end smoke**: `npm run test:integration -- goap` run with `GOAP_NUMERIC_STRICT=1` to ensure builds fail fast if adapter regressions sneak in.

## Rollout Plan
- Land adapter + telemetry behind `GOAP_NUMERIC_ADAPTER=1` feature flag.
- Enable flag in CI after unit + integration suites pass and GOAPDebugger contract updated.
- Remove legacy code paths and flip flag to default after one release cycle.
