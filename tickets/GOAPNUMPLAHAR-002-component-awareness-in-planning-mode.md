# GOAPNUMPLAHAR-002: Component Awareness in Planning Mode

**Status**: Ready  
**Priority**: High  
**Spec Reference**: `specs/goap-numeric-planning-hardening.md`

## Summary

Solidify the contract that component lookups during planning always prefer the simulated planning state before falling back to runtime services. `HasComponentOperator.evaluate` must consult the `entityId:componentId` hash that `#buildEvaluationContext` injects, and that context builder needs to keep mirroring the nested `state.actor` tree (components, sub-objects, etc.) so JSON Logic expressions resolve consistently.

## Requirements

1. Inspect `src/logic/operators/hasComponentOperator.js` to ensure it queries `context.state` (or equivalent) before calling `entityManager.hasComponent`. Add guards/tests preventing regressions.
2. Validate `GoapPlanner.#buildEvaluationContext` populates the planning state's component graph—including nested component objects—and mirrors this data onto `context.actor`. Any planned preprocessing should extend this function rather than introducing new helpers.
3. Expand or refresh the targeted unit coverage for `HasComponentOperator` to explicitly test both the planning-state branch and the runtime fallback branch.
4. Confirm `tests/integration/goap/numericGoalPlanning.integration.test.js` (or a new integration) covers component-only goal evaluation paths so the numeric planner cannot regress silently.
5. Update developer docs (likely `docs/goap/debugging-tools.md` or a dedicated operator doc) explaining how component data flows through planning contexts.

## Tasks

- [ ] Add assertions in `hasComponentOperator.test.js` (or create a new spec) verifying the planner state hash is the primary data source.
- [ ] Extend evaluation context tests to prove nested component objects and `actor.components.*` references work without helper glue.
- [ ] Review integration fixtures to ensure at least one goal depends solely on planning-state components; refresh fixtures if missing.
- [ ] Document the expected extension point for additional preprocessing so contributors understand `#buildEvaluationContext` is the canonical hook.

## Dependencies / Related Work

- `src/logic/operators/hasComponentOperator.js`
- `src/goap/planner/goapPlanner.js` (`#buildEvaluationContext`)
- `tests/integration/goap/numericGoalPlanning.integration.test.js`
- Docs under `docs/goap/` and `docs/goap/debugging-tools.md`

## Acceptance Criteria

- Unit tests fail if `HasComponentOperator` consults runtime state before the planning state hash.
- Evaluation context coverage demonstrates nested component availability via both `context.state` and `context.actor` mirrors.
- Integration suite exercises component-only numeric goals without flaky dependencies on runtime entity managers.
- Documentation clearly references `#buildEvaluationContext` as the extension point per the spec.

