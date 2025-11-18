# HasComponentOperator Resilience Specification

## 1. Executive Summary
The recent fix around `HasComponentOperator` exposed two brittle assumptions:
1. Planning state lookups treat any stored value (even `null`) as truthy because `typeof null === 'object'`.
2. The operator assumes that the symbolic planning snapshot is the sole source of truth whenever `context.state` exists, even when that snapshot does not carry data for the entity/component pair being queried.

This document specifies the follow-up work required to make the operator and its `PlanningStateView` dependency robust, extensible, and easier to monitor. The goal is to guarantee that future regressions in planning-state hydration or entity resolution either auto-heal through clear fallbacks or are detected immediately through diagnostics and coverage.

## 2. Current-State Analysis
- `PlanningStateView.hasComponent` returns `{ status, value }` but callers treat the `value` as authoritative even when `status === 'unknown'`.
- There is no typed contract for the tuple of statuses (`present`, `absent`, `unknown`) nor for what constitutes a “truthy” component payload. Any falsy primitive currently collapses to `false`, while any object/array becomes `true` regardless of its contents.
- The planning data model has multiple normalization entry points (`state`, `state.state`, actor snapshots). Missing hydration is common during GOAP experiments, yet `HasComponentOperator` never signals that it fell back to the EntityManager.
- Unit coverage ensures some guard rails but there is no integration/contract test verifying the exact interplay between `HasComponentOperator` and `PlanningStateView`.

## 3. Proposed Enhancements
### 3.1 Typed Planning-State Contract
- Introduce `src/goap/planner/planningStateTypes.d.ts` (or `.js` with JSDoc typedefs) defining an explicit discriminated union for lookup results: `{ status: 'present', value: boolean, source: 'flat' | 'state' | 'actor' }`, `{ status: 'absent', reason: 'component-missing', ... }`, `{ status: 'unknown', reason: 'entity-missing' | 'invalid-id' }`.
- Update `PlanningStateView.hasComponent` to always hydrate `reason` + `source`, and to treat only non-null objects/arrays as structural evidence. Primitive wrappers (`0`, `''`) remain false.
- Provide helper predicates (`isKnownComponent`, `isUnknownComponent`) co-located with the typedefs to centralize the logic. This prevents consumers from forgetting about the `unknown` branch.

### 3.2 Resilient Resolution Pipeline
- Refactor `HasComponentOperator.#evaluateInternal` into three explicit phases: `readPlanningState`, `fallbackToEntityManager`, `recordResult`. Each phase receives the lookup metadata so fallback decisions are traceable.
- Support multi-stage fallbacks: if planning state misses, optionally consult a cached “pending updates” map or pre-fetched entity snapshots before hitting the live entity manager. This hook keeps the operator flexible for future offline planners.
- Add circuit breakers: if the planner repeatedly returns `unknown` for the same `entityId:componentId` pair inside a single evaluation context, cache that absence and avoid repeated logger spam.

### 3.3 Diagnostics & Alerting
- Emit structured debug events through the existing logger (e.g., `logger.debug('has_component:fallback', { entityId, componentId, reason })`). Wire these events to `recordPlanningStateMiss` so analytics can detect sudden spikes in fallback usage.
- When `process.env.GOAP_STATE_ASSERT === '1'`, throw a descriptive error that includes the lookup reason (`entity-missing`, `invalid-component`) and the JSON Logic expression used to resolve the entity ID.
- Provide a lightweight telemetry counter in `planningStateDiagnostics.js` summarizing: total lookups, number of unknown statuses, number of fallbacks executed.

### 3.4 Test Coverage Gates
- Add a new contract test suite under `tests/unit/goap/planningStateView.contract.test.js` that verifies all combinations of `status`, `value`, and `source`, including tricky payloads like `null`, empty arrays, and proxied component objects.
- Extend `tests/unit/logic/operators/hasComponentOperator.test.js` with cases where planning state returns `unknown` twice in a row to ensure the fallback cache short-circuits duplicate EntityManager calls.
- Wire these suites into `npm run test:unit` and into the CI aggregate (`npm run test:ci`). Document the coverage expectations in `docs/testing-matrix.md` so failures are caught immediately during pre-push gating.

## 4. Implementation Plan
1. **Contract & Typings (4-6 hours)**
   - Add typedefs + helpers, update `PlanningStateView` implementation, migrate existing callers.
   - Write focused unit tests covering the new helpers.
2. **Operator Refactor (5-7 hours)**
   - Split `#evaluateInternal` into discrete phases, insert fallback cache + instrumentation, and ensure the logger payloads follow a consistent schema.
   - Update all operator-focused tests plus any integration tests exercising GOAP planning.
3. **Diagnostics & CI Wiring (3-4 hours)**
   - Enhance `recordPlanningStateMiss`/telemetry, expose counters for dashboards, and guard them with environment flags so production noise stays manageable.
   - Introduce the new contract tests and ensure `npm run test:ci` fails fast if statuses regress.

## 5. Success Criteria
- Planning-state truthiness is no longer tied to JS quirks (`null` vs objects); instead the discriminated union dictates the behavior.
- `HasComponentOperator` always logs and exposes the path taken (planning success, fallback, hard failure) with enough metadata for telemetry aggregation.
- CI contains regression tests that specifically assert the fallback cache, telemetry events, and typed contract, ensuring any future mismatch is caught immediately.

## 6. Open Questions
1. Should fallback caching live in the operator or in a shared `planningLookupCache` utility so other operators can reuse it?
2. Can we make `createPlanningStateView` lazily compute its entity index to reduce CPU costs now that we may call it more frequently for diagnostics?
3. Is it worth emitting structured metrics to an external observer (e.g., the debug UI) so designers can visualize planning-state misses in real time?
