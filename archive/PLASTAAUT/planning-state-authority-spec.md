# Context
- Modules: `src/logic/operators/hasComponentOperator.js` (JSON Logic `has_component` operator) and `src/goap/planner/planningStateView.js` (symbolic state view + diagnostics).
- Purpose: During GOAP planning all component lookups must use the cached planning snapshot so heuristics, planners, and debugging tooling reason about the exact same data. The operator is used in every JSON Logic rule that checks component presence, while `PlanningStateView` normalizes state hashes and emits telemetry.

# Problem
- Failure surfaced in `tests/integration/goap/numericGoalPlanning.integration.test.js:919` where the “stale planning state” scenario expected the planner to surface `GOAP_EVENTS.STATE_MISS` and build a non-empty plan. Instead the plan length was `0` because `HasComponentOperator` fell back to the live `EntityManager` (which still had the armed component), masking the stale snapshot.
- Because component-level misses in `PlanningStateView.hasComponent` never called `recordPlanningStateMiss`, the event bus never emitted `goap:state_miss`, so the integration test assertion `stateMissEvents.length > 0` failed.
- Root cause: runtime fallback violated `specs/goap-system-specs.md#Planning-State View Contract` which states the planning state is the canonical source of truth and should emit miss diagnostics whenever a lookup cannot be resolved.

# Truth sources
- `specs/goap-system-specs.md` — defines the planning-state view contract and diagnostics expectations.
- `docs/goap/debugging-tools.md#Empty plan completions` — documents that `planLength: 0` is only valid when the goal is already satisfied according to the planning snapshot.
- `tests/integration/goap/numericGoalPlanning.integration.test.js` — regression test guaranteeing stale planning state produces `STATE_MISS` events.
- `docs/testing/testing-matrix.md` — maps HasComponentOperator resilience and PlanningStateView contract suites to CI commands.

# Desired behavior
## Normal cases
- `HasComponentOperator` must always query `PlanningStateView` when `context.state` is present and return the resolved boolean without consulting the runtime entity manager.
- `PlanningStateView.hasComponent` must emit a `recordPlanningStateMiss` (and therefore `GOAP_EVENTS.STATE_MISS`) whenever:
  - the entity does not exist in the snapshot,
  - the component lookup is invalid (`null`/empty id),
  - the component entry is missing for the entity.
- JSON Logic evaluations that reference `has_component` receive consistent answers across heuristics, controller logic, and integration harnesses because they all share the same planning snapshot.

## Edge cases
- If a component record exists but is `null`/`false`, `has_component` returns `false` without logging a miss (because the component is explicitly present).
- When context paths evaluate to invalid entity identifiers, the operator logs warnings and returns `false` without dispatching state miss telemetry (no valid lookup occurred).
- When planning state is absent (execution/refinement mode) the operator should fall back to `entityManager.hasComponent` as before.
- Snapshot aliases (`core_needs` vs `core:needs`) must remain supported because JSON Logic rules reference both forms.

## Failure modes
- Missing components/entities in planning data trigger `recordPlanningStateMiss`, which emits `GOAP_EVENTS.STATE_MISS` and optionally throws if `GOAP_STATE_ASSERT=1`.
- No runtime fallback should occur for planning-mode misses; the operator simply returns `false`. Tools relying on `planLength` can trust that empty plans indicate true goal satisfaction rather than leaked runtime data.
- Errors during entity path resolution or entity manager access log via the injected logger and return `false`.

## Invariants
- Planning diagnostics counters (`totalLookups`, `unknownStatuses`) must mirror the number of `has_component` checks performed during planning.
- A `STATE_MISS` event is emitted exactly once per unresolved component lookup (entity missing or component missing).
- `planLength: 0` completions only occur when the symbolic state already satisfies the goal definition.
- The `jsonLogicExpression` metadata passed into `PlanningStateView` must propagate to telemetry to aid debugging.

## API contracts
- `HasComponentOperator.evaluate(params, context)` signature and return type remain unchanged.
- `PlanningStateView.hasComponent(entityId, componentId, options)` still returns `{ status, value, source, reason }`.
- Event bus payloads for `GOAP_EVENTS.STATE_MISS` remain `{ actorId, entityId, componentId, origin, goalId, taskId, reason }`.
- External callers can continue setting `GOAP_STATE_ASSERT=1` to turn misses into hard failures.

## What is allowed to change
- Internal logging strings and telemetry counters related to fallback/cache hits can be removed or repurposed since runtime fallback is no longer permitted in planning mode.
- Additional metadata fields may be attached to `recordPlanningStateMiss` payloads to improve observability as long as the base structure remains backward compatible.
- Implementation details inside `HasComponentOperator` (e.g., caching) can evolve provided the observable behavior above holds.

# Testing plan
## Which tests must be updated/added
- Update `tests/unit/logic/operators/hasComponentOperator.test.js` to assert that planning-state misses return `false`, do **not** call the entity manager, and still produce diagnostics (`unknownStatuses` increments, no fallback/cache hits).
- Extend `tests/unit/goap/planner/planningStateView.test.js` (or add a new spec) to confirm component-missing lookups emit `STATE_MISS` payloads.
- Ensure `tests/integration/goap/numericGoalPlanning.integration.test.js` retains the “stale planning state” coverage that checks `planLength > 0` and captured `STATE_MISS` events.

## What regression tests / property tests should exist
- A contract suite covering `PlanningStateView.hasComponent` should assert:
  - entity miss ⇒ `unknown` + telemetry event,
  - component miss ⇒ `absent` + telemetry event,
  - explicit falsy component data ⇒ `present` with value `false`.
- Property-style test for `HasComponentOperator` verifying that, given any planning snapshot missing `entityId:componentId`, repeated evaluations always return `false` and never hit the entity manager regardless of context mutations.
- Integration test harness should simulate stale snapshots for multiple goals/components to ensure `STATE_MISS` telemetry scales beyond `core:armed` (e.g., `core:needs`, `core:inventory`).
