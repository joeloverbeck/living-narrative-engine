# PROANAOVEV3-004: AgreementMetricsCalculator Service

Status: Completed

## Summary

Create a service that computes agreement metrics (MAE, RMSE, Jaccard, conditional probabilities with CI) between prototype output vectors, replacing Pearson correlation as the primary classification signal.

## Motivation

The current system relies on Pearson correlation as a gatekeeper for merge/subsume classifications, which never fire (0 merge, 0 subsumed in 193 candidates). Agreement metrics like MAE/RMSE directly measure output similarity and are more appropriate for classification decisions.

## Files to Create

### Service
- `src/expressionDiagnostics/services/prototypeOverlap/AgreementMetricsCalculator.js`

### Unit Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/agreementMetricsCalculator.test.js`

## Implementation Details

## Updated Assumptions

- `wilsonInterval` accepts a z-score; this service maps `confidenceLevel` to a z-score (0.9, 0.95, 0.99) and falls back to 1.96.
- `PrototypeOutputVector.intensities` already include gated zeros, so global MAE/RMSE operate directly on intensity differences.
- Co-pass metrics (`maeCoPass`, `rmseCoPass`, `pearsonCoPass`) return `NaN` when there are no co-pass samples; correlation reliability is based on `coPassCount`.

### Interface

```javascript
class AgreementMetricsCalculator {
  /**
   * @param {object} options
   * @param {function} options.wilsonInterval - Wilson CI calculator (z-score input)
   * @param {number} options.confidenceLevel - For Wilson CI (default: 0.95)
   * @param {number} options.minSamplesForReliableCorrelation - (default: 500)
   * @param {object} options.logger - Logger instance
   */
  constructor(options)

  /**
   * Calculate agreement metrics between two prototype output vectors.
   * @param {PrototypeOutputVector} vectorA
   * @param {PrototypeOutputVector} vectorB
   * @returns {AgreementMetrics}
   */
  calculate(vectorA, vectorB)
}

/**
 * @typedef {object} AgreementMetrics
 * @property {number} maeCoPass - MAE on samples where both gates pass
 * @property {number} rmseCoPass - RMSE on samples where both gates pass
 * @property {number} maeGlobal - MAE on all samples (zero when gate fails)
 * @property {number} rmseGlobal - RMSE on all samples
 * @property {number} activationJaccard - P(both) / P(either)
 * @property {number} pA_given_B - P(A passes | B passes)
 * @property {number} pB_given_A - P(B passes | A passes)
 * @property {number} pA_given_B_lower - Wilson CI lower bound
 * @property {number} pA_given_B_upper - Wilson CI upper bound
 * @property {number} pB_given_A_lower - Wilson CI lower bound
 * @property {number} pB_given_A_upper - Wilson CI upper bound
 * @property {number} pearsonCoPass - Correlation on co-pass (diagnostic only)
 * @property {number} pearsonGlobal - Global correlation (diagnostic only)
 * @property {number} coPassCount - Number of co-pass samples
 * @property {boolean} correlationReliable - Whether correlation should be trusted
 */
```

### Metric Calculations

1. **MAE Co-Pass**: `mean(|intensityA - intensityB|)` for samples where both gates pass
2. **RMSE Co-Pass**: `sqrt(mean((intensityA - intensityB)^2))` for co-pass samples
3. **MAE Global**: Include zeros for failed gates
4. **Activation Jaccard**: `coPassCount / (passACount + passBCount - coPassCount)`
5. **Conditional Probs**: `pA_given_B = coPassCount / passBCount`
6. **Wilson CI**: Use `wilsonInterval()` from ticket 003

### Dependencies
- `WilsonInterval` utility (ticket 003, z-score signature)
- `PrototypeOutputVector` from `PrototypeVectorEvaluator` (ticket 002)

## Out of Scope

- Creating output vectors (ticket 002)
- Classification logic using these metrics (ticket 010)
- DI registration (ticket 009)

## Acceptance Criteria

- [x] MAE calculated correctly for co-pass and global cases
- [x] RMSE calculated correctly for co-pass and global cases
- [x] Activation Jaccard matches existing `gateOverlapRatio` calculation
- [x] Conditional probabilities calculated correctly
- [x] Wilson CI bounds computed using utility from ticket 003
- [x] Pearson correlation computed as diagnostic only
- [x] Correlation reliability flag based on sample count
- [x] Unit tests cover:
  - MAE calculation (co-pass and global)
  - RMSE calculation (co-pass and global)
  - Activation Jaccard
  - Conditional probabilities
  - Wilson CI calculation
  - Edge cases (no co-pass samples, all samples co-pass)
  - Correlation reliability detection
- [x] 80%+ branch coverage on new code
- [ ] `npm run typecheck` passes (fails in repo; see Outcome)
- [x] `npx eslint src/expressionDiagnostics/services/prototypeOverlap/AgreementMetricsCalculator.js` passes

## Dependencies

- PROANAOVEV3-002 (PrototypeVectorEvaluator) - provides output vectors
- PROANAOVEV3-003 (WilsonInterval) - provides CI calculation

## Estimated Complexity

Medium - multiple metrics with edge case handling.

## Outcome

Implemented AgreementMetricsCalculator with z-score mapping for Wilson CIs, co-pass NaN handling, and correlation reliability tied to co-pass counts; added focused unit tests instead of any classifier wiring. Typecheck still fails due to pre-existing CLI/character-builder type errors unrelated to this ticket.
