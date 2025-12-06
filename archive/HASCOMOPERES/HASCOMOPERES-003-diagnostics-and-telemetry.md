# HASCOMOPERES-003: Diagnostics, Logging, and Telemetry for Planning-State Misses

**Spec Reference:** `archive/HASCOMOPERES/HASCOMOPERES-001-has-component-operator-resilience.md` (§3.3, §4.3)
**Priority:** P1 – Required for observability
**Status:** Completed
**Effort:** 3-4 hours

## Problem Statement

`PlanningStateView` already exposes discriminated lookup tuples, records misses through `recordPlanningStateMiss`, and will throw whenever `GOAP_STATE_ASSERT === '1'`. However, the surrounding diagnostics remain shallow: `planningStateDiagnostics.js` only counts misses, the `HasComponentOperator` fallback path emits free-form debug strings instead of structured events, and GOAP assertions never surface the JSON Logic expression nor the lookup reason. As a result, we cannot graph fallback spikes or attribute them to a specific expression even though the plumbing exists.

## Goals

- Emit structured logger events for every fallback/cache-hit decision so analytics tooling can bucket them without scraping log text.
- Extend the existing diagnostics module to keep simple counters (total lookups, unknown statuses, fallbacks, cache hits) that tests can reset between runs.
- Reuse the current `GOAP_STATE_ASSERT` toggle but include `{ reason, entityId, componentId, jsonLogicExpression }` in the thrown error so failures point back to the offending rule.

## Scope & Deliverables

1. **Structured Logging**
   - Update `HasComponentOperator` to emit `logger.debug('has_component:fallback', { entityId, componentId, reason, phase, cacheHit })` whenever planning-state data is missing.
   - When cached fallback data is reused, emit `has_component:fallback_cache_hit` with the cached metadata and skip duplicate spam.
2. **Telemetry Counters**
   - Enhance `planningStateDiagnostics.js` (already wired into `PlanningStateView`) to track totals for lookups, unknown statuses/misses, fallbacks, and cache hits.
   - Add helper functions so both `PlanningStateView` and `HasComponentOperator` can update the counters and reset them between tests.
3. **Assertion Mode**
   - Keep using `GOAP_STATE_ASSERT === '1'` but enrich the thrown error with `{ reason, entityId, componentId, jsonLogicExpression }` collected from the lookup metadata.
   - Log remediation tips alongside the error payload so CI logs are actionable.
4. **Analytics Hooks**
   - Pipe the structured fallback logs and telemetry updates through the existing `recordPlanningStateMiss` plumbing so `GOAP_EVENTS.STATE_MISS` continues to feed dashboards without a bespoke adapter.

## Acceptance Criteria

- Debug logs clearly indicate the fallback path/cache reuse and include metadata needed for dashboards.
- Diagnostics snapshots expose the new counters so CI and designers can snapshot planning-state churn without additional hooks.
- Assertion mode halts execution on unknown statuses and reports the JSON Logic expression responsible.

## Dependencies / Notes

- Builds on the phased pipeline from HASCOMOPERES-002 and the discriminated union from HASCOMOPERES-001.
- Coordinate with the observability/analytics tooling owner to ensure new events match existing schemas.

## Outcome

- Added structured `has_component:*` debug events plus telemetry updates for every fallback/cache-hit, feeding into `recordPlanningStateMiss` so GOAP event dashboards stay accurate.
- Extended `planningStateDiagnostics.js` with centralized counters (lookups, unknown statuses, fallbacks, cache hits) and reset helpers consumed by both `PlanningStateView` and `HasComponentOperator`.
- Reused the existing `GOAP_STATE_ASSERT` env flag but now throw errors that bundle `{ reason, entityId, componentId, jsonLogicExpression }` alongside remediation guidance so CI logs point back to the failing JSON Logic expression.
