# Testing Matrix

This document maps critical coverage areas to their suites and npm scripts. Use it to confirm which failures block CI and what regressions they guard against.

## Planning-State Resilience

| Coverage | Location | Primary Scripts | What It Guards |
| --- | --- | --- | --- |
| PlanningStateView discriminated union contract | `tests/unit/goap/planner/planningStateView.contract.test.js` | `npm run test:unit`, `npm run test:ci` | Locks down status/source/value semantics for `hasComponent`, including tricky payloads, invalid lookups, and ABSENT metadata prioritization. |
| HasComponentOperator fallback/telemetry | `tests/unit/logic/operators/hasComponentOperator.test.js` | `npm run test:unit`, `npm run test:ci` | Verifies JSON Logic operand resolution, duplicate `unknown` handling, fallback caching, GOAP diagnostics counters, and assertion-mode behavior without touching live EntityManager instances. |

Both suites run automatically in CI because they live under `tests/unit/**`. No additional wiring is necessary—`npm run test:unit` (and therefore `npm run test:ci`) will fail fast if either contract or operator expectations regress.
