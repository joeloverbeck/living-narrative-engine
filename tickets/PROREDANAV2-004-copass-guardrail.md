# PROREDANAV2-004: Add coPassCount Guardrail for Metric Validity (A2)

## Description

Add coPassCount field and implement guardrails that invalidate correlation/intensity metrics when the co-pass sample count is insufficient. This prevents false correlation conclusions from sparse data.

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js`

### Create
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/behavioralOverlapEvaluator.guardrails.test.js`

## Out of Scope

- Changes to classifier to respect guardrails (PROREDANAV2-010)
- RMSE/pctWithinEps metrics (PROREDANAV2-005)
- High threshold metrics (PROREDANAV2-006)
- Gate structure analysis
- Pass rates computation (done in PROREDANAV2-003)

## Changes Required

### 1. Add coPassCount to passRates Output

```javascript
passRates: {
  // ... existing from PROREDANAV2-003
  coPassCount: onBothCount  // New field
}
```

### 2. Implement Guardrail Check

Before computing intensity metrics, check:
```javascript
const meetsMinCoPass = onBothCount >= config.minCoPassSamples;
```

### 3. Apply Guardrail to Intensity Metrics

When `coPassCount < minCoPassSamples`:
```javascript
intensity: {
  pearsonCorrelation: NaN,
  meanAbsDiff: NaN,
  // Future metrics (rmse, pctWithinEps) will also be NaN
}
```

When `coPassCount >= minCoPassSamples`:
- Existing computation unchanged

### 4. Update JSDoc

Document the guardrail behavior:
```javascript
/**
 * @property {number} coPassCount - Number of contexts where both prototypes passed gates.
 *   When coPassCount < config.minCoPassSamples, intensity metrics are set to NaN
 *   to prevent false conclusions from sparse data.
 */
```

## Acceptance Criteria

### Tests That Must Pass

1. **coPassCount presence**: passRates.coPassCount field exists in output
2. **coPassCount value**: coPassCount equals onBothCount
3. **Guardrail activation at boundary**:
   - With coPassCount=199, minCoPassSamples=200: pearsonCorrelation=NaN, meanAbsDiff=NaN
   - With coPassCount=200, minCoPassSamples=200: pearsonCorrelation computed normally
4. **NaN propagation**: When guardrail active, all intensity metrics are NaN
5. **Normal operation**: When guardrail not active, existing intensity computation unchanged
6. **Config respected**: Guardrail uses config.minCoPassSamples value

### Invariants That Must Remain True

- gateOverlap metrics always computed (not affected by guardrail)
- passRates always computed (not affected by guardrail)
- divergenceExamples still collected even when guardrail active
- dominanceP and dominanceQ behavior follows same guardrail pattern
- Existing tests with sufficient samples still pass

## Estimated Size

~60 lines of code changes + ~120 lines of tests

## Dependencies

- PROREDANAV2-001 (config with minCoPassSamples)
- PROREDANAV2-003 (passRates structure to add coPassCount to)

## Verification Commands

```bash
# Run guardrail tests
npm run test:unit -- --testPathPattern=behavioralOverlapEvaluator.guardrails

# Run all BehavioralOverlapEvaluator tests
npm run test:unit -- --testPathPattern=behavioralOverlapEvaluator

# Lint
npx eslint src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js
```
