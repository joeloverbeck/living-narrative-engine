# MONCARRECINT-005: Sampling Coverage Zero-Inflation + Tail Starvation

Status: Completed

## Summary

Add zero-rate metrics to sampling coverage and update conclusions to flag zero-inflated or tail-starved domains as “skewed/zero-inflated.”

## Background

Current coverage conclusions can report “good” coverage even when distributions are zero-inflated or tails are unrepresented. The spec adds zero-rate tracking and stricter conclusions for [0, 1] domains.

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/services/monteCarloSamplingCoverage.js`
- `src/expressionDiagnostics/services/samplingCoverageConclusions.js`
- `tests/unit/expressionDiagnostics/services/monteCarloSamplingCoverage.test.js`
- `tests/unit/expressionDiagnostics/services/samplingCoverageConclusions.test.js`

## Out of Scope (MUST NOT Change)

- Monte Carlo sampling distributions or RNG.
- Report UI layout beyond coverage text/labels.
- Any logic unrelated to sampling coverage metrics/conclusions.

## Reassessed Assumptions

- Sampling coverage data currently does not include gate clamp metrics; only clause-level gate clamp analysis exists elsewhere. This ticket will not plumb gate clamp rates into sampling coverage unless new data is already present in the coverage payload.
- Sampling coverage tables in the DOM/UI do not need new columns; coverage conclusions will carry any new zero-inflation warnings.
- Normalized [0, 1] domains are the `emotions` / `sexualStates` families (including `previous*` variants) per `SAMPLING_COVERAGE_DOMAIN_RANGES`.

## Implementation Details

- Track `zeroCount`/`zeroRate` per variable and `zeroRateAvg` per domain.
- For normalized [0, 1] domains, label as “skewed/zero-inflated” when `tailHigh < 0.001` or `zeroRateAvg >= 0.8` and suppress “coverage looks healthy.”
- If gate clamp rate is available in the sampling coverage payload, include it as a supplemental metric only (do not substitute it for zero-rate logic).

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="samplingCoverageConclusions" --coverage=false`

### Invariants That Must Remain True

1. Tail and bin coverage calculations are unchanged apart from new zero-rate metrics.
2. “Coverage looks healthy” is suppressed when skewed/zero-inflated conditions are met.
3. Zero-inflation logic only applies to [0, 1] domains.

## Outcome

- Added zero-rate tracking to sampling coverage payloads and domain summaries, plus conclusions that flag skewed/zero-inflated normalized domains and suppress the "coverage looks healthy" label.
- Did not add UI/report table columns for zero-rate or gate clamp metrics; coverage conclusions carry the new warning text as planned.
