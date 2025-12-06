# GOAPLASTOCRIHAR-001 - Normalize GOAP goal paths before validation

**Status:** Completed

## Summary

- Pre-normalize every `goal.goalState` JSON Logic path that references the actor so the planner never feeds `actor.*` lookups without the required `state.actor.components.*` prefix into validation or execution.
- Introduce a reusable helper in `goalPathValidator` that walks a goal AST, rewrites each `var` operand through `rewriteActorPath`, and returns a sanitized copy used both for linting and for `jsonLogic` evaluation.
- Update `GoapPlanner` to cache the sanitized tree per `(actorId, goalId)` so duplicate invalid inputs only log a single `GOAP_INVALID_GOAL_PATH` warning instead of spamming every heuristic/guard invocation, and so valid normalized goals keep planning moving forward.
- Test utilities already normalize goals via `buildPlanningGoal` (see `rewriteGoalStateVars`), so the scope here is simply to codify that expectation in the ticket and keep future suites routed through those helpers—no additional helper work is required in the test bed.

## File list

- `src/goap/planner/goapPlanner.js`
- `src/goap/planner/goalPathValidator.js`
- `tests/common/testBed.js`
- `tests/unit/goap/planner/goapPlanner.stoppingCriteria.test.js`

## Out of scope

- Changing the public goal schema or adding new JSON Logic operators.
- Altering runtime entity/component data structures or how actor state is stored in the entity manager.

## Acceptance criteria

### Tests

- `npm run test:unit -- goapPlanner.stoppingCriteria`
- `npm run test:unit -- goapPlanner.goalPathValidator`
- `npm run lint`

### Invariants

- `GoapPlanner.plan(actorId, goal, initialState)` keeps the same signature and return contract.
- `validateGoalPaths` still reports violations in the existing `{ path, reason, metadata }` structure.
- The `GOAP_GOAL_PATH_LINT` flag semantics stay the same (still opt-in failure throwing).

## Outcome

- Added `normalizeGoalState` plus validator changes so every goal goes through actor path rewriting while still reporting original violations.
- Introduced per-actor/goal caching inside `GoapPlanner` so normalized trees are reused, warnings fire once (unless lint enforcement is enabled), and planning/evaluation run against sanitized state.
- Expanded the goal-path and planner helper tests to cover normalization rewrites and the single-warning behavior; no extra work was required for the shared test utilities because they already normalize via `buildPlanningGoal`.
