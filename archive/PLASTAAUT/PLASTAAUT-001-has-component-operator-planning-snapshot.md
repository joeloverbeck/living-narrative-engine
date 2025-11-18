# PLASTAAUT-001: Preserve GOAP_STATE_ASSERT failures inside has_component

## Findings recap
- Current `HasComponentOperator` calls `PlanningStateView.hasComponent` whenever `context.state` is an object, so the earlier assumption about runtime fallbacks is already satisfied.
- The unresolved gap is that `PlanningStateView` raises `GOAP_STATE_MISS` errors when `GOAP_STATE_ASSERT=1`, but `HasComponentOperator.evaluate` catches *all* errors and returns `false`, so those hard failures never propagate to JSON Logic evaluations.
- As a result, stale planning snapshots silently return `false` even when assertions should abort tests, leaving diagnostics counters inconsistent with CI expectations.

## File list
- src/logic/operators/hasComponentOperator.js
- tests/unit/logic/operators/hasComponentOperator.test.js

## Out of scope
- Changing PlanningStateView internals beyond consuming its public API responses.
- Altering the JSON Logic operator registry, rule schemas, or adding new operators.
- Modifying integration tests, docs, or telemetry subscribers (covered by other tickets).

## Acceptance criteria
### Required tests
- `npm run lint`
- `npm run test:unit -- --runInBand tests/unit/logic/operators/hasComponentOperator.test.js`

### Invariants to preserve
- `HasComponentOperator.evaluate(params, context)` signature and return type remain unchanged.
- When `context.state` is absent (execution/refinement mode), the operator still falls back to `entityManager.hasComponent` as it does today.
- When `context.state` is present, the operator continues querying only `PlanningStateView.hasComponent` for data (no entityManager fallback).
- `GOAP_STATE_ASSERT=1` must promote planning-state misses to hard failures by bubbling up the underlying `GOAP_STATE_MISS` error instead of swallowing it.

## Implementation notes
- Continue validating entity/component identifiers before invoking `PlanningStateView`; invalid ids should still warn and return `false` without emitting telemetry.
- Detect `GOAP_STATE_MISS` errors (raised when assertions are enabled) inside `evaluate` and rethrow them so tests fail immediately while keeping the existing error logging for other failure types.
- Extend the operator unit tests with a `GOAP_STATE_ASSERT` scenario to prove we neither hit the entity manager nor suppress the thrown error.

## Status
- Completed — validation captured stale planning-state assertions during `has_component` evaluations.

## Outcome
- Confirmed the historical assumption about runtime fallbacks was outdated and documented the real gap (GOAP assertions being swallowed).
- Updated `HasComponentOperator` to rethrow `GOAP_STATE_MISS` errors while leaving other error handling intact.
- Added a regression test proving `GOAP_STATE_ASSERT=1` now fails fast instead of silently returning `false`.
