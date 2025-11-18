# HASCOMOPERES-002: Refactor HasComponentOperator for Resilient Resolution

**Spec Reference:** `archive/HASCOMOPERES/HASCOMOPERES-001-has-component-operator-resilience.md` (§3.2, §4.2)
**Priority:** P0 – Planner stability
**Status:** Completed
**Effort:** 5-7 hours

## Problem Statement
`PlanningStateView` already emits discriminated lookup tuples (`status`, `reason`, `source`) and `HasComponentOperator` forwards those details to the logger. The lingering issue is narrower: when hydration misses occur the operator re-runs the same “planning → EntityManager” fallback for every identical `entityId:componentId` query inside the same evaluation context. Nothing keeps track of the previous miss so we pay the cost (and emit the warning) on every invocation.

## Goals
- Keep the existing `PlanningStateView` contract intact while preventing duplicate fallback work for the same lookup inputs.
- Add a lightweight per-context cache that captures the post-fallback answer (and metadata) so subsequent calls can reuse it without touching the `EntityManager` again.
- Exercise the cache via targeted unit tests so we do not regress back to repeated lookups.

## Scope & Deliverables
1. **Evaluation Cache**
   - Introduce a cache keyed by the evaluation context object and `entityId:componentId` pair. Only the fallback path should consult/populate it so planning-state hits remain zero-copy.
   - Cache entries need to store both the boolean answer and the reason/source payload so logging stays accurate even when serving cached values.
2. **Logging Improvements**
   - Keep the current debug payload shape but add a clear `cacheHit` flag (or similar) when a fallback answer comes from the cache instead of `EntityManager`.
3. **Operator Tests**
   - Extend `tests/unit/logic/operators/hasComponentOperator.test.js` with scenarios where planning state returns `unknown` twice for the same pair to confirm we only call `entityManager.hasComponent` once and that the cached response is honored on the second invocation.

## Acceptance Criteria
- Duplicate `unknown` statuses in a single evaluation context do not re-hit the `EntityManager` or emit duplicate fallback debug events.
- Operator logs continue to identify the phase/source (planning vs runtime fallback) even when the result is served from cache.
- The operator keeps returning `false` rather than throwing when planning-state entries are missing unless `GOAP_STATE_ASSERT` is opt-in enabled elsewhere.

## Dependencies / Notes
- `PlanningStateView` already satisfies the discriminated union / helper requirements from HASCOMOPERES-001; no further work is needed there.
- Coordination with HASCOMOPERES-003 is limited to ensuring the cache-hit metadata aligns with whatever telemetry HASCOMOPERES-003 aggregates.

## Outcome
- Implemented a context-scoped fallback cache so repeated `unknown` planning-state lookups for the same entity/component pair reuse the previously computed EntityManager answer instead of re-querying.
- Added instrumentation for cache hits/misses in the operator to keep diagnostics meaningful without the noisy repetitive fallback log spam.
- Extended `tests/unit/logic/operators/hasComponentOperator.test.js` with cache coverage, establishing regression protection for the new behavior while leaving the previously planned multi-phase pipeline and diagnostics work for future tickets.
