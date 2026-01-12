# PRODISCHASUGASS-004: Add Z-Score Calibration For Gap Distances

## Summary

Add prototype-to-prototype distance calibration so gap detection includes z-score and percentile context in both report and UI outputs.

## Priority: Low | Effort: Medium

## Status: Completed

## Rationale

Raw nearest-distance values lack context. A percentile/z-score framing helps users understand whether a gap is typical or unusually large.

## File List (Expected to Touch)

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/PrototypeFitRankingService.js` | **Update** |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Update** |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Update** |
| `tests/unit/expressionDiagnostics/services/prototypeFitRankingService.test.js` | **Update** |
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.prototypeFit.test.js` | **Update (if report output changes)** |

## Out of Scope

- Do not change the gap detection thresholds (`nearestDistance` and `bestIntensity` gates).
- Do not alter existing prototype ranking or conflict analysis logic.
- Do not add new UI sections; only enrich existing gap detection output.

## Assumptions (Reassessed)

- Gap detection currently uses a combined distance (0.7 weight distance + 0.3 gate distance); calibration should align with that same combined distance.
- Prototype-to-prototype calibration must derive comparable gate ranges from prototype gate strings (when available) rather than relying on expression constraints.
- Calibration is only meaningful when at least two prototypes exist; otherwise calibration fields should remain null.

## Acceptance Criteria

### Tests

- `npm run test:unit -- --testPathPatterns PrototypeFitRankingService --coverage=false`

### Invariants

- The boolean `gapDetected` result remains based on the existing thresholds.
- Existing gap detection fields are preserved; new fields are additive.
- Report and UI outputs show the same calibration context for a given result.

## Implementation Notes

- Precompute prototype nearest-neighbor combined-distance distribution and cache it per prototype-type set.
- Extend the gap detection result with z-score, percentile, and context string.
- Update report and UI renderers to display the calibrated context string when available.

## Outcome

- Calibrated gap distances against prototype nearest-neighbor combined distances (weights + gate ranges derived from prototype gates), not raw weight-only distances.
- Added distance context fields to gap detection results and surfaced them in report + UI status messages.
- Updated unit tests to cover calibration fields and report output.
