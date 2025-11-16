# GOAP Numeric Planning Hardening Notes

## Context

The numeric goal integration suite (`tests/integration/goap/numericGoalPlanning.integration.test.js`) originally failed because the planner conflated search depth with cost, evaluated component predicates against runtime state, and treated every mixed goal with a numeric sub-expression as "numeric" for the `taskReducesDistance` guard. The production implementation has since absorbed those fixes:

- `src/goap/planner/goapPlanner.js` now measures depth via `PlanningNode.getPath().length`, applies `goal.maxActions` separately, and only compares `gScore` to `goal.maxCost`.
- `src/logic/operators/hasComponentOperator.js` and `#buildEvaluationContext` in the planner both operate on the simulated planning state before falling back to runtime services.
- `GoapPlanner.#hasNumericConstraints` only activates numeric distance guards when the goal's root operator is `<=`, `>=`, `<`, `>`, etc., so composite expressions are evaluated as straight booleans.
- `GoapController.decideTurn` (see `src/goap/controllers/goapController.js`) already treats zero-length plans as "goal satisfied" and dispatches `PLANNING_COMPLETED` with `planLength: 0`.

This document captures those guardrails so future changes do not drift away from the architecture spelled out in `specs/goap-system-specs.md` and the workflows described in `docs/goap/debugging-tools.md`.

## Guardrails and Expectations

1. **Depth Limit Semantics**
   - Depth is the number of planned tasks, not the accumulated `gScore`. `current.getPath().length` feeds both the depth cap (`options.maxDepth`, default 20) and `goal.maxActions`. `gScore` is only compared to `goal.maxCost` when that property exists.
   - `tests/unit/goap/planner/goapPlanner.plan.test.js` already exercises the depth limiter—keep those tests up-to-date whenever `PlanningNode` or `plan()` changes so short high-cost plans (three 10-cost heals) continue to pass with `maxDepth ≥ 3`.
   - Telemetry already logs `planLength`, `gScore`, and `maxDepth` whenever the planner expands a node or finishes a search. Preserve that logging; it is how GOAPDebugger's report surfaces plan lengths.

2. **Component Awareness in Planning Mode**
   - `HasComponentOperator.evaluate` first inspects `context.state` using the `entityId:componentId` hash that `#buildEvaluationContext` produces. Only if the component flag is absent does it fall back to `entityManager.hasComponent`.
   - `#buildEvaluationContext` already injects nested component objects and mirrors the `state.actor` tree to `context.actor`, so JSON Logic expressions such as `actor.components.core_stats` resolve without a separate helper. Any future preprocessing should extend that function instead of creating a new `buildPlanningActorContext` wrapper.
   - Integration coverage in `tests/integration/goap/numericGoalPlanning.integration.test.js` exercises component-only goals; keep a targeted unit test for `HasComponentOperator` to guard the planning-state branch.

3. **Mixed Numeric + Structural Goals**
   - The numeric distance heuristic is intentionally limited to *pure* numeric goals. `#hasNumericConstraints` returns `false` whenever the goal state has multiple root operators (e.g., `and`, `or`) or non-numeric operators, so composite expressions fall back to boolean goal evaluation and bypass `#taskReducesDistance`.
   - Document this modeling constraint in goal authoring guides (see `docs/goap/multi-action-planning.md` sections on multi-field goals) so content authors keep numeric thresholds at the root of their goal expressions when they expect heuristic-driven pruning.
   - Add or maintain regression tests ensuring `#hasNumericConstraints` only recognizes single-root numeric JSON Logic trees.

4. **Empty Plan Handling**
   - When `GoapPlanner.plan` returns `tasks.length === 0`, `GoapController.decideTurn` dispatches `PLANNING_COMPLETED`, logs `goal already satisfied`, and returns `null` without throwing. No extra work is required—just keep the controller tests covering this behavior.

5. **Observability + Tooling**
   - `docs/goap/debugging-tools.md` describes the available tooling: Plan Inspector surfaces active plan lengths and failure counts, GOAPDebugger aggregates `getFailedGoals()` / `getFailedTasks()`, and the refinery tracer exposes how tasks expanded. Use these tools before adding ad-hoc `console.log`s.
   - For planners that still stall, extend the existing failure tracking reasons (e.g., include `Depth limit reached` or `Distance check rejected all tasks` when that happens) so GOAPDebugger reports immediately reveal the culprit. This keeps observability consistent with the debugging workflows already documented.
