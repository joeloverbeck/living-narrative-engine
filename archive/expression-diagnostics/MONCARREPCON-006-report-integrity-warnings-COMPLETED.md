# MONCARREPCON-006: Report integrity warnings and invariants

## Summary
Add invariant checks during report generation, emit warnings in the report output, and include a structured warnings array in non-report output.

## Assumptions & scope adjustments
- MonteCarloReportGenerator returns markdown only. To expose `reportIntegrityWarnings` without a breaking API change, attach warnings to the provided `simulationResult` during report generation.
- I2 applies only to lower-bound thresholds (`>=`/`>`) with `t > 0` to avoid false positives on `<=` conditions.
- I4 compares theoretical max (derived from mood constraints) against the mood-regime population only, since global samples can include out-of-regime contexts.
- I5 is validated by ensuring the mood-regime population hash used in the report matches `simulationResult.populationMeta` (when available).

## File list (expected to touch)
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- src/expressionDiagnostics/utils/reportIntegrityUtils.js (new)
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.warnings.test.js (new)

## Out of scope
- Any changes to population metadata or hashing.
- Any changes to gate pass or intensity computations beyond checks.
- Any changes to Monte Carlo sampling.

## Acceptance criteria
- Report output includes a "Report Integrity Warnings" section when any invariant is violated.
- Non-report output includes `result.reportIntegrityWarnings` with entries containing code, message, populationHash, signal, prototypeId, and details.
- Invariants enforced:
  - I1 gate_ok false implies final 0.
  - I2 passRate(final >= t) <= gatePassRate for `t > 0` and lower-bound thresholds only.
  - I3 gatePassRate 0 implies final P90/P95/max == 0 within epsilon.
  - I4 observed_max_final (mood-regime) <= theoretical_max_final + eps.
  - I5 mood-regime sections share the same population hash.

## Tests
- `npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.warnings.test.js --coverage=false`

## Invariants
- Warning generation must not mutate report data or computed statistics.
- Warning checks use the same population hashes used in report headers.

## Status
Completed

## Outcome
- Added report integrity warnings in report generation and exposed them via `simulationResult.reportIntegrityWarnings`.
- Implemented shared warning helpers and a targeted unit test for warning emission.
- Scoped I2 to lower-bound thresholds and I4 to mood-regime populations to avoid false positives.
