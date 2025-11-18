# HASCOMOPERES-004: Planning-State Resilience Coverage & CI Gates

**Spec Reference:** `archive/HASCOMOPERES/HASCOMOPERES-001-has-component-operator-resilience.md` (§3.4, §4.3)
**Priority:** P1 – Test gate
**Status:** Completed (2025-11-18)
**Effort:** 1 hour

## Reassessment (2025-11-18)
- `tests/unit/goap/planner/planningStateView.contract.test.js` already exercises the discriminated-union variants, truthiness semantics, and tricky payloads (`null`, empty arrays, proxied objects).
- `tests/unit/logic/operators/hasComponentOperator.test.js` contains the telemetry/caching assertions described in HASCOMOPERES-002/003, including duplicate `unknown` hits, fallback cache reuse, and counter increments.
- Both suites already run under `npm run test:unit`/`npm run test:ci` because they live inside `tests/unit/**`.
- The only missing artifact from the original ticket is documentation tying these suites to the resilience requirement; there is no `docs/testing-matrix.md` describing the coverage or CI gates.

## Updated Scope & Deliverables
1. **Contract Assertions Refresh**
   - Strengthen the PlanningStateView contract suite with a focused test that locks down `ABSENT` metadata (priority order of `source` resolution) so regressions surface immediately.
2. **Documentation / CI Signaling**
   - Create `docs/testing/testing-matrix.md` capturing where the resilience suites live, how they are executed (unit + CI), and what regressions they guard against.
   - Explicitly note that no additional wiring is necessary because the suites already run under the existing npm scripts.

## Acceptance Criteria
- Updated contract test fails if the `ABSENT` branch ever reports an unexpected `source` or reason.
- Testing matrix documents which commands cover PlanningStateView/HasComponentOperator resilience and how engineers should interpret failures.
- Ticket can be marked complete once documentation lands and the refreshed contract test passes under `npm run test:unit`.

## Dependencies / Notes
- Requires the refactors from HASCOMOPERES-001 to HASCOMOPERES-003 so tests can target the new behavior.
- Coordinate with DevEx to keep test runtime reasonable; mark suites with `@contract` or similar tag if needed.

## Outcome
- Added the `prioritizes actor > state > flat sources when emitting ABSENT metadata` case to `tests/unit/goap/planner/planningStateView.contract.test.js`, formally locking down the metadata priority rules that `HasComponentOperator` depends on.
- Authored `docs/testing/testing-matrix.md`, mapping the PlanningStateView contract suite and HasComponentOperator unit coverage to `npm run test:unit` / `npm run test:ci` so CI failures clearly announce the resilience gates.
- Verified the refreshed contract suite with `npm run test:unit -- --runInBand planningStateView.contract`; no new wiring was required because both suites already execute with the standard unit/CI scripts.
