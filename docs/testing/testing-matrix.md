# Testing Matrix

This document maps critical coverage areas to their suites and npm scripts. Use it to confirm which failures block CI and what regressions they guard against.

## Planning-State Resilience

| Coverage | Location | Primary Scripts | What It Guards |
| --- | --- | --- | --- |
| PlanningStateView discriminated union contract | `tests/unit/goap/planner/planningStateView.contract.test.js` | `npm run test:unit`, `npm run test:ci` | Locks down status/source/value semantics for `hasComponent`, including tricky payloads, invalid lookups, and ABSENT metadata prioritization. |
| HasComponentOperator fallback/telemetry | `tests/unit/logic/operators/hasComponentOperator.test.js` | `npm run test:unit`, `npm run test:ci` | Verifies JSON Logic operand resolution, duplicate `unknown` handling, fallback caching, GOAP diagnostics counters, and assertion-mode behavior without touching live EntityManager instances. |
| Stale planning snapshot + GOAP telemetry | `tests/integration/goap/numericGoalPlanning.integration.test.js` ("should surface state misses when planning state is stale") | `npm run test:integration -- --runInBand tests/integration/goap/numericGoalPlanning.integration.test.js`, `npm run test:ci` | Executes the GOAP controller end-to-end, asserting `planLength > 0` plus multiple `GOAP_EVENTS.STATE_MISS` payloads (`core:armed`, `core:needs`) so CI can immediately flag stale planning state regressions. |

The unit suites run automatically in CI because they live under `tests/unit/**`. No additional wiring is necessary—`npm run test:unit` (and therefore `npm run test:ci`) will fail fast if either contract or operator expectations regress. The integration harness is heavier, so run it ad hoc with the command listed above or rely on `npm run test:ci` to execute it in the gate.
