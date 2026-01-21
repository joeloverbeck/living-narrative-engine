# PROREDANAV2-005: Add RMSE and pctWithinEps Intensity Metrics (A3)

## Description

Add new intensity similarity metrics: RMSE (root mean squared error) and pctWithinEps (percentage of samples where intensity difference is within epsilon). These provide additional signal for merge decisions.

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js`

### Create
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/behavioralOverlapEvaluator.intensityMetrics.test.js`

## Out of Scope

- High threshold co-activation metrics (PROREDANAV2-006)
- Classifier changes to use new metrics
- GateBandingSuggestionBuilder
- Using these metrics in classification decisions

## Changes Required

### 1. Track Squared Differences

In the sampling loop, when both gates pass and computing intensity:
```javascript
// Existing
const absDiff = Math.abs(intensityA - intensityB);
sumAbsDiff += absDiff;

// New
const sqDiff = (intensityA - intensityB) ** 2;
sumSqDiff += sqDiff;

if (absDiff <= config.intensityEps) {
  withinEpsCount++;
}
```

### 2. Compute New Metrics

After sampling:
```javascript
const rmse = meetsMinCoPass
  ? Math.sqrt(sumSqDiff / onBothCount)
  : NaN;

const pctWithinEps = meetsMinCoPass
  ? withinEpsCount / onBothCount
  : NaN;
```

### 3. Add to Intensity Output

```javascript
intensity: {
  pearsonCorrelation: ...,  // existing
  meanAbsDiff: ...,         // existing
  rmse: rmse,               // NEW
  pctWithinEps: pctWithinEps, // NEW
  dominanceP: ...,          // existing
  dominanceQ: ...,          // existing
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Field presence**: intensity object contains rmse and pctWithinEps fields
2. **RMSE calculation correct**:
   - With co-pass intensities [(0.5, 0.5), (0.6, 0.4), (0.7, 0.5)]:
   - Diffs: [0, 0.2, 0.2], sqDiffs: [0, 0.04, 0.04]
   - RMSE = sqrt(0.08/3) ≈ 0.163
3. **pctWithinEps calculation correct**:
   - With eps=0.05 and diffs [0, 0.2, 0.2]: withinEps=1, pct=1/3≈0.333
   - With eps=0.25 and diffs [0, 0.2, 0.2]: withinEps=3, pct=1.0
4. **Guardrail respected**: When coPassCount < minCoPassSamples:
   - rmse = NaN
   - pctWithinEps = NaN
5. **Bounds**: pctWithinEps in [0, 1] or NaN
6. **RMSE non-negative**: rmse >= 0 or NaN
7. **Perfect similarity**: When all intensities identical, rmse=0, pctWithinEps=1

### Invariants That Must Remain True

- Existing intensity fields (pearsonCorrelation, meanAbsDiff, dominanceP, dominanceQ) unchanged
- gateOverlap metrics unchanged
- passRates metrics unchanged
- Guardrail from PROREDANAV2-004 still applies to all intensity metrics
- divergenceExamples unchanged

## Estimated Size

~70 lines of code changes + ~130 lines of tests

## Dependencies

- PROREDANAV2-001 (config with intensityEps)
- PROREDANAV2-004 (guardrail logic to reuse)

## Verification Commands

```bash
# Run intensity metrics tests
npm run test:unit -- --testPathPattern=behavioralOverlapEvaluator.intensityMetrics

# Run all BehavioralOverlapEvaluator tests
npm run test:unit -- --testPathPattern=behavioralOverlapEvaluator

# Lint
npx eslint src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js
```
