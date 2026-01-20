# PROREDANAV2-006: Add High-Threshold Co-Activation Metrics (A4)

## Description

Add expression-threshold co-activation metrics for configurable threshold levels. These metrics measure how often both prototypes reach high intensity simultaneously, providing signal for whether they express similarly in practice.

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js`

### Create
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/behavioralOverlapEvaluator.highThresholds.test.js`

## Out of Scope

- Using highJaccard in classifier (PROREDANAV2-010)
- Gate structure analysis services
- OverlapRecommendationBuilder changes
- Using these metrics for classification decisions

## Changes Required

### 1. Compute Intensity for All Pass Cases

**IMPORTANT**: Current implementation only computes intensity when both gates pass. This ticket requires computing intensity whenever `passA || passB` (at least one passes), not just when both pass.

```javascript
// For each sample where passA || passB:
if (passA) {
  intensityA = computeIntensity(weightsA, context);
} else {
  intensityA = 0; // Gated intensity is 0 when gates fail
}

if (passB) {
  intensityB = computeIntensity(weightsB, context);
} else {
  intensityB = 0; // Gated intensity is 0 when gates fail
}
```

### 2. Track High-Intensity Counts Per Threshold

For each threshold t in `config.highThresholds`:
```javascript
// Initialize counters per threshold
const thresholdCounters = config.highThresholds.map(t => ({
  t,
  highACount: 0,
  highBCount: 0,
  highBothCount: 0,
  eitherHighCount: 0,
  agreementCount: 0
}));

// In sampling loop, for each threshold:
for (const counter of thresholdCounters) {
  const highA = intensityA >= counter.t;
  const highB = intensityB >= counter.t;

  if (highA) counter.highACount++;
  if (highB) counter.highBCount++;
  if (highA && highB) counter.highBothCount++;
  if (highA || highB) counter.eitherHighCount++;
  if (highA === highB) counter.agreementCount++;
}
```

### 3. Compute Rates and Add to Output

```javascript
highCoactivation: {
  thresholds: config.highThresholds.map((t, i) => {
    const c = thresholdCounters[i];
    const pHighA = c.highACount / onEitherCount;
    const pHighB = c.highBCount / onEitherCount;
    const pHighBoth = c.highBothCount / onEitherCount;
    const highJaccard = c.eitherHighCount > 0
      ? c.highBothCount / c.eitherHighCount
      : 0;
    const highAgreement = c.agreementCount / onEitherCount;

    return { t, pHighA, pHighB, pHighBoth, highJaccard, highAgreement };
  })
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Field presence**: Output contains highCoactivation.thresholds array
2. **Threshold count**: Array has entries for each config.highThresholds value (default 3)
3. **Each entry structure**: Contains t, pHighA, pHighB, pHighBoth, highJaccard, highAgreement
4. **Rate bounds**: All rates in [0, 1]
5. **Jaccard bounds**: highJaccard in [0, 1]
6. **Jaccard division by zero**: When neither reaches threshold, highJaccard = 0
7. **Calculation verification with deterministic contexts**:
   - 10 samples, threshold t=0.5
   - intensityA: [0.6, 0.4, 0.7, 0.3, 0.5, 0.6, 0.2, 0.8, 0.4, 0.5]
   - intensityB: [0.5, 0.6, 0.3, 0.7, 0.5, 0.4, 0.8, 0.2, 0.5, 0.6]
   - Verify counts and rates match expected values
8. **Default thresholds tested**: Verify calculations at t=0.4, t=0.6, t=0.75

### Invariants That Must Remain True

- Existing gateOverlap metrics unchanged
- Existing intensity metrics unchanged (but may be computed more often internally)
- passRates metrics unchanged
- divergenceExamples unchanged
- When onEitherCount = 0, highCoactivation thresholds have sensible defaults (0s)

## Estimated Size

~120 lines of code changes + ~200 lines of tests

## Dependencies

- PROREDANAV2-001 (config with highThresholds)

## Verification Commands

```bash
# Run high threshold tests
npm run test:unit -- --testPathPattern=behavioralOverlapEvaluator.highThresholds

# Run all BehavioralOverlapEvaluator tests
npm run test:unit -- --testPathPattern=behavioralOverlapEvaluator

# Lint
npx eslint src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js
```
