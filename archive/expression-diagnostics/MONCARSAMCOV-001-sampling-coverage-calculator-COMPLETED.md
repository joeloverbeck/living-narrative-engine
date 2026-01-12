# MONCARSAMCOV-001 - Sampling Coverage Calculator Utilities

## Goal
Create a pure, reusable sampling coverage calculator that can track per-variable metrics incrementally and finalize a normalized payload (range/bin/tail coverage + rating).

## Assumptions (reassessed)
- No sampling coverage utility exists yet; this ticket adds a new standalone module.
- Domain bounds are supplied to the utility (it does not resolve ranges itself).
- No wiring to `MonteCarloSimulator`, report generation, or UI rendering is included in this ticket.

## Scope
- Add a small utility module that accepts domain bounds and streams observations.
- Implement rating thresholds, histogram/tail coverage, and summary aggregation helpers.
- Keep the module independent from MonteCarloSimulator/report/UI wiring.

## File list
- `src/expressionDiagnostics/services/monteCarloSamplingCoverage.js`
- `tests/unit/expressionDiagnostics/services/monteCarloSamplingCoverage.test.js`

## Out of scope
- Modifying `src/expressionDiagnostics/services/MonteCarloSimulator.js`.
- UI or report changes.
- Any changes to sampling distributions or state generators.
- New config entries or integration hooks beyond the standalone utility.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --testPathPatterns=tests/unit/expressionDiagnostics/services/monteCarloSamplingCoverage.test.js --coverage=false`

### Invariants that must remain true
- Coverage ratings follow the thresholds from `specs/monte-carlo-sampling-coverage.md` (good >= 0.75/0.60, partial >= 0.40/0.30).
- The calculator does not allocate per-sample storage (only incremental counts/min/max).
- Unknown domain bounds are represented explicitly (e.g., `rating: 'unknown'`) and excluded from aggregate summaries.

## Status
Completed

## Outcome
- Added a standalone sampling coverage calculator utility with range/bin/tail metrics and domain summaries.
- Added unit tests for rating thresholds and unknown-domain handling.
- Deferred simulator/report/UI wiring as originally scoped out for this ticket.
