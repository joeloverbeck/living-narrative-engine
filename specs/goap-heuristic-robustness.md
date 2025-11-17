# GOAP Heuristic Robustness & Flexibility Spec

## Context
Recent regressions in `tests/integration/goap/heuristicCalculation.integration.test.js` exposed two brittle assumptions in the GOAP heuristics:

1. **Planning state visibility** – `HasComponentOperator` silently fell back to the runtime `EntityManager` when the symbolic planning state lacked a key, hiding divergence between the planner's view and the world snapshot.
2. **Context shape drift** – `GoalDistanceHeuristic` (and `NumericConstraintEvaluator`) expected JSON Logic paths like `state.actor...`, while new goals referenced the root (`actor...`). Missing data coerced to falsy defaults, so numeric goals looked satisfied even when they were not.

The fixes patched the immediate failures by (a) making planning state authoritative for `has_component` checks and (b) wrapping heuristic contexts so JSON Logic can resolve both legacy and modern paths. This spec captures the follow-up work needed to harden the subsystem so that similar drift is detected immediately and the heuristics remain flexible as GOAP content evolves.

## Goals
- Canonicalize planning-state access patterns for every heuristic, simulator, and operator.
- Detect and surface any fallback from symbolic state to runtime services during planning.
- Provide shared utilities so future modules don't re-implement context bridging.
- Add tests & telemetry that fail fast when a goal references data that the planner cannot see.

## Proposed Enhancements

### 1. PlanningStateView Utility
Create `src/goap/planner/planningStateView.js` exporting helpers:
- `createEvaluationContext(state)` – returns a memoized object exposing both `{ state }` and root-level keys (what `GoalDistanceHeuristic` now hand-rolls).
- `hasComponent(state, entityId, componentId)` – shared lookup (flat hash + nested + flattened aliases) with explicit tri-state return: `true`, `false`, or `unknown`.
- `assertContains(state, path, { logger, goalId })` – dev-time assertion used in heuristics/tests to fail fast when numeric paths cannot be resolved.

Integrate this helper into:
- `GoalDistanceHeuristic`
- `RelaxedPlanningGraphHeuristic`
- `NumericConstraintEvaluator`
- `HasComponentOperator`
- Any planner entry point that currently builds `{ state }` manually

### 2. Observability Guardrails
- Emit `GOAP_STATE_MISS` Structured logs (and GOAP debugger events) whenever a planning lookup returns `unknown`. Include `goalId`, `path`, `taskId`, and whether runtime fallback was attempted.
- Add a counter to GOAP debugger reports summarizing `planningStateFallbacks`. CI can fail when this is non-zero in integration suites run with `GOAP_DEBUG=1`.
- Update `docs/goap/debugging-tools.md` with a section describing how to toggle verbose planning-state assertions via `GOAP_STATE_ASSERT=1`.

### 3. Validation Hooks
- Extend `tests/common/testBed.js` with `registerPlanningStateSnapshot(state, options)` that automatically syncs `SimpleEntityManager`, builds the dual-format state, and pre-warms `PlanningStateView`. Use it in every GOAP integration test to remove bespoke helpers.
- Add regression tests:
  - Numeric goals using both `actor.health` and `state.actor.health` resolve identically.
  - Relaxed planning graph removes components purely via symbolic state (confirmed via `HasComponentOperator`).
  - `heuristicRegistry` logs a warning if a heuristic tries to evaluate a goal path that `PlanningStateView` reports as `unknown`.
- Wire `npm run test:integration` to fail if any test logs `GOAP_STATE_MISS` (use Jest `console.warn` interception or a custom reporter).

### 4. Content Authoring Guidance
Update `specs/goap-system-specs.md` and authoring docs to specify:
- Recommended variable paths (`actor.components.core:needs.hunger`) and how they map to the planner's dual-format state.
- Requirement to run `npm run validate:ecosystem` after touching task/goal JSON so tooling can check for unknown planning paths via the new helper.

## Rollout Plan
1. Implement `PlanningStateView`, refactor heuristics and operators to consume it, and bake-in assertions (behind env flag) that throw in dev/test when data is missing.
2. Land telemetry + debugger wiring to capture state misses.
3. Update tests + docs; require new GOAP specs to cite `PlanningStateView` usage.
4. After two releases with the guardrails enabled, flip `GOAP_STATE_ASSERT` on by default for CI.

## Definition of Done
- All heuristics/operators consume `PlanningStateView` helpers instead of bespoke `{ state }` wrappers.
- Integration suite fails immediately when a goal references an unseen state path.
- GOAP debugger exposes state-miss counters and links to docs/goap/debugging-tools.md.
- Specs and docs spell out the canonical planning-state contract so future contributors don't reintroduce the ambiguity that caused this incident.
