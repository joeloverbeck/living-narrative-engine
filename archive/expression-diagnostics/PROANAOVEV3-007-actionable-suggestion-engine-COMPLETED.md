# PROANAOVEV3-007: ActionableSuggestionEngine Service

## Summary

Create a service that generates data-driven threshold suggestions using decision stump fitting, with validation to ensure suggestions are safe to apply.

## Assumptions Update (Reconciled With Current Codebase)

- Prototype overlap analysis already normalizes axis values via `ContextAxisNormalizer` / `axisNormalizationUtils` (mood axes normalized to [-1, 1], sexual axes and affect traits normalized to [0, 1]). Suggestions must use these normalized units.
- `prototypeOverlapConfig.js` does **not** yet include v3 suggestion settings (ticket 008). This service must supply sensible defaults and allow overrides via injected config without assuming new config keys exist.
- Overlap reduction estimates require **both** output vectors; the impact estimator needs access to both vectors plus the shared context pool.

## Motivation

Current rule-based suggestions have unit/direction issues making them unsafe to apply. A data-driven approach using decision stumps:
- Finds optimal split points from actual data
- Validates thresholds against legal axis ranges
- Estimates impact before suggesting

## Files to Create

### Service
- `src/expressionDiagnostics/services/prototypeOverlap/ActionableSuggestionEngine.js`

### Unit Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/actionableSuggestionEngine.test.js`

## Implementation Details

### Interface

```javascript
class ActionableSuggestionEngine {
  /**
   * @param {object} options
   * @param {object} options.config - Optional configuration overrides
   * @param {object} options.logger - Logger instance
   * @param {object} options.contextAxisNormalizer - ContextAxisNormalizer instance
   */
  constructor(options)

  /**
   * Generate actionable suggestions for a classified pair.
   * @param {PrototypeOutputVector} vectorA
   * @param {PrototypeOutputVector} vectorB
   * @param {Array<object>} contextPool
   * @param {string} classification
   * @returns {Array<ActionableSuggestion>}
   */
  generateSuggestions(vectorA, vectorB, contextPool, classification)

  /**
   * Validate a suggestion against constraints.
   * @param {ActionableSuggestion} suggestion
   * @returns {{valid: boolean, message: string}}
   */
  validateSuggestion(suggestion)

  /**
   * Estimate impact of applying a suggestion.
   * @param {ActionableSuggestion} suggestion
   * @param {PrototypeOutputVector} vectorA
   * @param {PrototypeOutputVector} vectorB
   * @param {Array<object>} contextPool
   * @returns {{overlapReduction: number, activationImpact: number}}
   */
  estimateImpact(suggestion, vectorA, vectorB, contextPool)
}

/**
 * @typedef {object} ActionableSuggestion
 * @property {string} targetPrototype - 'a' | 'b'
 * @property {string} axis - The axis to constrain
 * @property {string} operator - '>=' | '<=' | '>' | '<'
 * @property {number} threshold - The suggested threshold value
 * @property {number} confidenceScore - Confidence in suggestion [0,1]
 * @property {number} overlapReductionEstimate - Estimated % reduction in overlap
 * @property {number} activationImpactEstimate - Estimated % change in activation
 * @property {boolean} isValid - Whether suggestion is within legal axis range
 * @property {string} validationMessage - Human-readable validation status
 */
```

### Decision Stump Algorithm

```javascript
function fitDecisionStump(samples) {
  // Filter to divergent samples (different gate/intensity outcomes)
  const divergentSamples = samples.filter(s =>
    (s.passA !== s.passB) || Math.abs(s.intensityA - s.intensityB) > config.divergenceThreshold
  );

  if (divergentSamples.length < config.minSamplesForStump) {
    return null;
  }

  let bestSplit = { infoGain: 0 };

  for (const axis of ALL_PROTOTYPE_WEIGHT_AXES) {
    const axisRange = getAxisRange(axis); // normalized ranges
    const values = divergentSamples
      .map(s => resolveAxisValue(axis, s.normalized.moodAxes, s.normalized.sexualAxes, s.normalized.traitAxes))
      .sort((a, b) => a - b);

    for (let i = 0; i < values.length - 1; i++) {
      const threshold = (values[i] + values[i + 1]) / 2;

      // Skip if outside legal range
      if (threshold < axisRange.min || threshold > axisRange.max) continue;

      const infoGain = computeInfoGain(divergentSamples, axis, threshold);

      if (infoGain > bestSplit.infoGain) {
        bestSplit = {
          axis,
          threshold,
          direction: determineDirection(divergentSamples, axis, threshold),
          infoGain,
        };
      }
    }
  }

  return bestSplit.infoGain > config.minInfoGainForSuggestion ? bestSplit : null;
}
```

### Validation Requirements

1. Threshold within legal axis range
2. Threshold in correct units (normalized): mood axes [-1, 1], sexual axes + affect traits [0, 1]
3. Activation rate stays above minimum viable
4. Overlap reduction > 10%

## Out of Scope

- Integrating with `OverlapRecommendationBuilder` (ticket 014)
- Configuration additions (ticket 008)
- DI registration (ticket 009)

## Acceptance Criteria

- [x] Decision stump fitting finds optimal split points
- [x] Info gain calculation identifies discriminative thresholds
- [x] Threshold validation checks normalized axis ranges (mood [-1,1], sexual/traits [0,1])
- [x] Axis range clamping keeps suggestions legal when config overrides are tighter
- [x] Overlap reduction estimation is accurate
- [x] Activation impact estimation is accurate
- [x] Insufficient samples handled gracefully
- [x] Unit tests cover:
  - Decision stump fitting
  - Info gain calculation
  - Threshold validation
  - Axis range clamping
  - Overlap reduction estimation
  - Activation impact estimation
  - Insufficient samples handling
  - Multiple suggestions per pair
- [x] Coverage enforcement deferred to full-suite runs; unit tests in place
- [x] Targeted unit test run documented with `--testPathPatterns` and `--coverage=false`

## Dependencies

- PROANAOVEV3-001 (SharedContextPoolGenerator) - provides context pool
- ContextAxisNormalizer (existing) - provides normalized axis values

## Estimated Complexity

High - decision stump algorithm, info gain calculation, validation logic.

## Status

Completed.

## Outcome

- Implemented ActionableSuggestionEngine using normalized axes with decision stump ranking, validation, and impact estimation; defaults applied without adding new config keys.
- Added unit tests covering stump fitting, clamping, impact estimation, insufficient samples, and multiple suggestions.
- Ran targeted unit tests with `--testPathPatterns` and `--coverage=false`; no DI or config integration changes.
