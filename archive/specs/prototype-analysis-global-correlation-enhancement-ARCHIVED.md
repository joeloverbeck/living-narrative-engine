# Specification: Prototype Analysis Global Correlation Enhancement

## Overview

**Status**: Draft
**Priority**: Medium
**Affects**: Prototype overlap analysis classification logic
**Files to Modify**:
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`
- `src/expressionDiagnostics/config/prototypeOverlapConfig.js`
- Related unit and integration tests

## Problem Statement

### Issue Identified

External review identified that the prototype analysis system's classification logic over-trusts a fragile metric:

1. **Pearson correlation is computed only on co-pass samples**: The current implementation computes `pearsonCorrelation` exclusively from samples where *both* prototypes' gates pass (co-pass). When co-pass rate is low (e.g., 5%), this correlation becomes statistically noisy and misleading.

2. **Merge/subsumption decisions require very high correlation**:
   - Merge: `minCorrelationForMerge: 0.98`
   - Subsumption: `minCorrelationForSubsumption: 0.95`

   Combined with sparse co-pass samples, these high thresholds effectively prevent merges from ever triggering.

3. **Global metrics computed but unused**: The system explicitly computes `globalOutputCorrelation` over ALL samples "to address selection bias" (BehavioralOverlapEvaluator.js lines 438-449), but this metric is NOT used in the classification decision logic.

### Evidence from Results

Analysis report (`reports/prototype-analysis-results.md`) shows:
- Classification breakdown: `0 merge | 0 subsumed | 123 nested | 2 separation | 10 expression | 58 distinct`
- Despite many pairs flagged as "redundant/nested," zero pairs trigger merge or subsumption classifications

### Root Cause

In `OverlapClassifier.js`:

```javascript
// #checkMergeCriteria (lines 306-342) - Uses co-pass correlation only
if (Number.isNaN(metrics.pearsonCorrelation) ||
    metrics.pearsonCorrelation < thresholds.minCorrelationForMerge) {
  return false;  // Rejects when co-pass correlation is NaN or below 0.98
}

// #checkSubsumedCriteria (lines 356-388) - Uses co-pass correlation only
if (Number.isNaN(metrics.pearsonCorrelation) ||
    metrics.pearsonCorrelation < thresholds.minCorrelationForSubsumption) {
  return { isSubsumed: false };  // Rejects when below 0.95
}
```

The `globalOutputCorrelation` metric exists in the extracted metrics but is never consulted for classification decisions.

## Solution Design

### Design Principle: Hybrid Correlation Strategy

Implement a statistically-aware hybrid approach that:
1. Uses co-pass correlation when sample count is sufficient (statistically reliable)
2. Falls back to global correlation when co-pass is sparse (addresses selection bias)
3. Uses weighted combination when both are available but co-pass is borderline

### Implementation Steps

#### Step 1: Add Configuration Thresholds

**File**: `src/expressionDiagnostics/config/prototypeOverlapConfig.js`

Add new configuration properties:

```javascript
// Global correlation thresholds (more lenient because global includes zero-output samples)
minGlobalCorrelationForMerge: 0.90,           // Lower than co-pass (0.98)
minGlobalCorrelationForSubsumption: 0.85,     // Lower than co-pass (0.95)

// Sample count threshold for trusting co-pass metrics
coPassSampleConfidenceThreshold: 500,          // Min co-pass samples for reliable correlation

// Minimum co-pass ratio to rely on co-pass metrics
minCoPassRatioForReliable: 0.10,               // At least 10% co-pass for reliability

// Weights for combined correlation calculation
coPassCorrelationWeight: 0.6,                  // When combining correlations
globalCorrelationWeight: 0.4,                  // When combining correlations

// Additional global metric threshold
maxGlobalMeanAbsDiffForMerge: 0.15,            // Secondary check for merge

// Near-miss threshold for global correlation
nearMissGlobalCorrelationThreshold: 0.80,      // For near-miss detection
```

**Rationale for lower global thresholds**: Global correlation includes samples where one or both outputs are 0 (gate failed). This naturally dilutes correlation even for similar prototypes. A 0.90 global correlation with 8000 samples provides stronger statistical evidence than a 0.98 co-pass correlation on 50 samples.

#### Step 2: Add Effective Correlation Helper Method

**File**: `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`

Add new private method:

```javascript
/**
 * Compute effective correlation using hybrid strategy.
 *
 * Strategy prioritization:
 * 1. Co-pass correlation if samples >= threshold AND ratio >= min ratio (statistically reliable)
 * 2. Global correlation if co-pass unreliable (addresses selection bias)
 * 3. Weighted combination if both valid but co-pass is borderline
 * 4. Co-pass with low confidence if only option
 * 5. NaN if no valid data
 *
 * @param {object} metrics - Extracted classification metrics
 * @returns {{
 *   effectiveCorrelation: number,
 *   source: 'co-pass'|'global'|'combined'|'co-pass-sparse'|'none',
 *   confidence: 'high'|'medium'|'low'|'none'
 * }}
 * @private
 */
#computeEffectiveCorrelation(metrics) {
  // Implementation as specified in design
}
```

#### Step 3: Modify `#checkMergeCriteria`

**File**: `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`

Update merge criteria to:
1. Use `#computeEffectiveCorrelation()` instead of direct `metrics.pearsonCorrelation`
2. Select correlation threshold based on source (global uses lower threshold)
3. Add secondary check using `globalMeanAbsDiff` when available

```javascript
#checkMergeCriteria(metrics, thresholds) {
  // Existing checks: onEitherRate, gateOverlapRatio...

  // NEW: Use effective correlation with source-appropriate thresholds
  const { effectiveCorrelation, source } = this.#computeEffectiveCorrelation(metrics);

  if (Number.isNaN(effectiveCorrelation)) {
    return false;
  }

  // Select threshold based on correlation source
  const correlationThreshold = (source === 'global' || source === 'combined')
    ? (this.#config.minGlobalCorrelationForMerge ?? 0.90)
    : thresholds.minCorrelationForMerge;

  if (effectiveCorrelation < correlationThreshold) {
    return false;
  }

  // ENHANCED: Secondary check using global mean absolute difference
  const globalMeanAbsDiff = metrics.globalMeanAbsDiff;
  if (!Number.isNaN(globalMeanAbsDiff) &&
      globalMeanAbsDiff > (this.#config.maxGlobalMeanAbsDiffForMerge ?? 0.15)) {
    return false;
  }

  // ... rest of existing checks (meanAbsDiff, dominance)
}
```

#### Step 4: Modify `#checkSubsumedCriteria`

**File**: `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`

Update subsumption criteria similarly:

```javascript
#checkSubsumedCriteria(metrics, thresholds) {
  // NEW: Use effective correlation with source-appropriate thresholds
  const { effectiveCorrelation, source } = this.#computeEffectiveCorrelation(metrics);

  if (Number.isNaN(effectiveCorrelation)) {
    return { isSubsumed: false };
  }

  // Select threshold based on correlation source
  const correlationThreshold = (source === 'global' || source === 'combined')
    ? (this.#config.minGlobalCorrelationForSubsumption ?? 0.85)
    : thresholds.minCorrelationForSubsumption;

  if (effectiveCorrelation < correlationThreshold) {
    return { isSubsumed: false };
  }

  // ... rest of existing logic (pOnlyRate, qOnlyRate, dominance checks)
}
```

#### Step 5: Update `checkNearMiss` Method

Update near-miss detection to use effective correlation:

```javascript
checkNearMiss(candidateMetrics, behaviorMetrics) {
  const metrics = this.#extractMetrics(candidateMetrics, behaviorMetrics);
  const { effectiveCorrelation, source } = this.#computeEffectiveCorrelation(metrics);

  // Use source-appropriate near-miss threshold
  const nearMissCorrelationThreshold = (source === 'global' || source === 'combined')
    ? (this.#config.nearMissGlobalCorrelationThreshold ?? 0.80)
    : (this.#config.nearMissCorrelationThreshold ?? 0.90);

  // ... rest of near-miss logic using effectiveCorrelation
}
```

#### Step 6: Add Correlation Metadata to Results

Update `#extractMetrics()` and result building to include correlation source for transparency:

```javascript
// In result object, add:
{
  correlationSource: string,     // 'co-pass' | 'global' | 'combined' | 'co-pass-sparse' | 'none'
  correlationConfidence: string, // 'high' | 'medium' | 'low' | 'none'
}
```

## Backward Compatibility

1. **Config defaults**: All new config properties have sensible defaults - existing configs work unchanged
2. **High co-pass behavior**: When co-pass samples are sufficient, behavior is identical to current implementation
3. **API stability**: No changes to public method signatures
4. **Result format**: New fields (`correlationSource`, `correlationConfidence`) are additive

## Testing Requirements

### Unit Tests to Create/Modify

**File**: `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.test.js`

#### New Test Suite: `#computeEffectiveCorrelation`

| Test Case | Input Conditions | Expected Output |
|-----------|------------------|-----------------|
| High co-pass count, high ratio | coPassCount=1000, ratio=0.20, coPassCorr=0.95 | `{source: 'co-pass', confidence: 'high'}` |
| Low co-pass count, valid global | coPassCount=50, ratio=0.02, globalCorr=0.88 | `{source: 'global', confidence: 'medium'}` |
| Borderline co-pass, both valid | coPassCount=300, ratio=0.08, coPassCorr=0.92, globalCorr=0.85 | `{source: 'combined', confidence: 'medium'}` |
| Only co-pass valid (sparse) | coPassCount=100, coPassCorr=0.90, globalCorr=NaN | `{source: 'co-pass-sparse', confidence: 'low'}` |
| Neither valid | coPassCorr=NaN, globalCorr=NaN | `{source: 'none', confidence: 'none'}` |

#### Modified Test Suite: Merge Classification with Global Correlation

| Test Case | Scenario | Expected Result |
|-----------|----------|-----------------|
| Merge via global correlation | Co-pass corr NaN, global corr 0.92 | Should classify as merge (global passes 0.90 threshold) |
| Merge rejected by global threshold | Co-pass sparse, global corr 0.85 | Should NOT classify as merge (below 0.90) |
| Merge with high global mean diff | Global corr 0.95, globalMeanAbsDiff 0.25 | Should NOT classify as merge (fails secondary check) |
| Merge via combined correlation | Co-pass 0.94 (sparse), global 0.88 | Combined ~0.92, should classify as merge |
| Backward compat: high co-pass | Co-pass count 2000, corr 0.985 | Should use co-pass correlation (existing behavior) |

#### Modified Test Suite: Subsumption Classification with Global Correlation

| Test Case | Scenario | Expected Result |
|-----------|----------|-----------------|
| Subsumption via global correlation | Co-pass sparse, global corr 0.87, dominance OK | Should classify as subsumed |
| Subsumption rejected by global threshold | Global corr 0.80 | Should NOT classify as subsumed (below 0.85) |
| Backward compat: high co-pass subsumption | Co-pass count 1500, corr 0.96 | Should use co-pass correlation |

#### Edge Case Tests

| Test Case | Conditions | Validation |
|-----------|------------|------------|
| All samples co-pass | gateOverlapRatio = 1.0 | Global and co-pass correlations should be nearly identical |
| No co-pass samples | coPassCount = 0 | Should use global correlation only |
| Very low co-pass ratio (1%) | ratio = 0.01 | Should prefer global correlation |
| Config missing new thresholds | Old config format | Should use defaults gracefully |

### Integration Tests to Create/Modify

**New File**: `tests/integration/expressionDiagnostics/prototypeOverlap/lowCoPassClassification.integration.test.js`

| Test Scenario | Setup | Assertion |
|---------------|-------|-----------|
| Low co-pass merge detection | Create two prototypes with ~5% gate overlap but similar output patterns | Should classify as merge using global correlation |
| Selection bias scenario | Prototypes with high co-pass correlation (0.99) but divergent behavior in non-co-pass regions | Should NOT classify as merge due to global metrics |
| Real-world example | Use emotion prototypes that currently fail merge despite similar behavior | Verify improved classification |

**Modify File**: `tests/integration/expressionDiagnostics/prototypeOverlap/prototypeOverlapAnalyzer.integration.test.js`

- Add test cases for global correlation fallback scenarios
- Add test cases for correlation source metadata in results

### Existing Tests to Fix

After implementation, the following test files may need updates to accommodate new behavior:

1. `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.test.js`
2. `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.compositeScore.test.js`
3. `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.fullV2.test.js`

These tests may have mocked metrics or expectations that assume co-pass correlation only.

## Configuration Reference

### New Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `minGlobalCorrelationForMerge` | number | 0.90 | Global correlation threshold for merge classification |
| `minGlobalCorrelationForSubsumption` | number | 0.85 | Global correlation threshold for subsumption |
| `coPassSampleConfidenceThreshold` | number | 500 | Minimum co-pass samples to trust co-pass correlation |
| `minCoPassRatioForReliable` | number | 0.10 | Minimum co-pass ratio (coPassCount/totalSamples) for reliability |
| `coPassCorrelationWeight` | number | 0.6 | Weight for co-pass when combining correlations |
| `globalCorrelationWeight` | number | 0.4 | Weight for global when combining correlations |
| `maxGlobalMeanAbsDiffForMerge` | number | 0.15 | Maximum global mean absolute difference for merge |
| `nearMissGlobalCorrelationThreshold` | number | 0.80 | Global correlation threshold for near-miss detection |

### Threshold Rationale

**Why global thresholds are lower than co-pass thresholds:**

Global correlation (`globalOutputCorrelation`) is computed over ALL samples including:
- Samples where only one prototype's gate passes (output: `intensity` vs `0`)
- Samples where neither gate passes (output: `0` vs `0`)

This dilutes correlation compared to co-pass correlation. Therefore:
- Co-pass merge threshold: 0.98 → Global merge threshold: 0.90
- Co-pass subsumption threshold: 0.95 → Global subsumption threshold: 0.85

## Implementation Checklist

- [ ] Add new configuration properties to `prototypeOverlapConfig.js`
- [ ] Add JSDoc typedefs for new config properties
- [ ] Implement `#computeEffectiveCorrelation()` method
- [ ] Update `#checkMergeCriteria()` to use effective correlation
- [ ] Update `#checkSubsumedCriteria()` to use effective correlation
- [ ] Update `checkNearMiss()` to use effective correlation
- [ ] Add correlation metadata to extracted metrics and results
- [ ] Update config validation for new optional properties
- [ ] Create unit tests for `#computeEffectiveCorrelation()`
- [ ] Create unit tests for merge with global correlation
- [ ] Create unit tests for subsumption with global correlation
- [ ] Create unit tests for edge cases
- [ ] Create integration test file for low co-pass scenarios
- [ ] Update existing integration tests
- [ ] Fix any broken existing tests
- [ ] Run full test suite and verify coverage
- [ ] Update `reports/prototype-analysis-system.md` documentation

## Verification Steps

After implementation:

1. **Run unit tests**: `npm run test:unit -- --testPathPattern="overlapClassifier"`
2. **Run integration tests**: `npm run test:integration -- --testPathPattern="prototypeOverlap"`
3. **Verify classification improvement**: Re-run prototype analysis on emotion family and verify:
   - Merge/subsumption classifications now appear where appropriate
   - Near-misses are detected using global correlation when co-pass is sparse
4. **Verify backward compatibility**: Existing high-co-pass scenarios produce identical results
5. **Check coverage**: Ensure new code paths have adequate test coverage (>80% branches)

## References

- External review findings: ChatGPT analysis identifying co-pass correlation fragility
- Current implementation: `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`
- Global metric computation: `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js` (lines 438-460)
- Analysis results: `reports/prototype-analysis-results.md`
- System documentation: `reports/prototype-analysis-system.md`
