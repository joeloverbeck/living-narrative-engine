# MONCARGATCLADIA-006: Add Gate Clamp Diagnostics Tests And Invariants

## Summary

Validate existing gate clamp diagnostics coverage and ensure invariant checks are exercised by current tests. No UI/report changes.

## Priority: High | Effort: Medium

## Rationale

Gate clamp diagnostics are easy to miscompute or mislabel. This ticket now focuses on confirming coverage already in the codebase, avoiding redundant new files.

## Reassessment (Assumptions & Scope Updates)

- Gate clamp metrics and pass|gate reporting already have unit coverage in `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js` and `tests/unit/expressionDiagnostics/services/monteCarloSimulator.gateEnforcement.test.js`.
- Integration coverage for report columns already exists in `tests/integration/expression-diagnostics/monteCarloReport.integration.test.js`.
- Invariant-style checks (gate-fail nonzero, pass-rate vs gate-pass, etc.) already exist as report integrity warnings in `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` with tests in `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.warnings.test.js`.
- "Failed gate reasons" are already covered at analyzer level via `tests/unit/expressionDiagnostics/services/prototypeConstraintAnalyzer.test.js` (gate parsing and reason reporting).
- The gate mismatch vs threshold-too-high badge is not implemented in code; adding it is out of scope for this ticket (and would violate the "no report/UI changes" constraint). This ticket therefore does not introduce new tests for that UI classification.

## Files to Touch

| File | Change Type |
|------|-------------|
| `tickets/MONCARGATCLADIA-006-tests-and-invariants.md` | **Modify** |

## Out of Scope

- **DO NOT** add end-to-end UI tests unless a pattern already exists and is minimal
- **DO NOT** change report or UI rendering in this ticket
- **DO NOT** modify fixture packs under `data/mods/`

## Acceptance Criteria

### Tests

- `npm run test:unit -- --testPathPatterns=tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js --coverage=false`
- `npm run test:unit -- --testPathPatterns=tests/unit/expressionDiagnostics/services/monteCarloSimulator.gateEnforcement.test.js --coverage=false`
- `npm run test:unit -- --testPathPatterns=tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.warnings.test.js --coverage=false`
- `npm run test:integration -- --testPathPatterns=tests/integration/expression-diagnostics/monteCarloReport.integration.test.js --coverage=false`

### Invariants

- Gate clamp correctness and pass-vs-gate consistency are validated via report integrity warnings.
- Gate clamp metrics are computed with mood-regime denominators (see simulator tests).
- Emotion intensities are clamped in `EmotionCalculatorService` ([0..1]) and therefore satisfy range expectations.

## Status: Completed

## Outcome

Updated the ticket to reflect existing gate clamp coverage, existing invariant warnings, and existing analyzer tests. No code changes were required beyond documentation alignment; validation runs confirmed the relevant unit and integration tests.
