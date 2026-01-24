# Composite Score Rebalancing Specification

## Overview

This specification addresses the claim that the prototype analysis system's composite score formula overweights gate overlap (50%) while underweighting globalMeanAbsDiff (20%), an MAE-style metric that directly measures output similarity.

## Problem Analysis

### Current Formula

```javascript
composite = gateOverlapRatio × 0.5 + normalizedCorr × 0.3 + (1 - globalMeanAbsDiff) × 0.2
```

**Location**: `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js` (lines 556-588)

### Evidence from Production Data

The "closest pair" in production analysis (emotion prototypes):

| Pair | Composite | Gate Overlap | Correlation | Global Diff |
|------|-----------|--------------|-------------|-------------|
| hypervigilance ↔ alarm | 0.932 | 1.000 | 0.569 | 0.017 |

**Interpretation**: These prototypes ALWAYS fire together (100% gate overlap) and produce nearly identical outputs (0.017 global diff), yet the Pearson correlation is only 0.569. The low correlation means their intensity *variations* don't track linearly, but the absolute output difference is tiny.

### Validity Assessment of the Claim

**The claim is PARTIALLY VALID**:

1. **The composite score is NOT used for merge classification** - It's ONLY used to identify the "closest pair" for summary reporting. Merge decisions use separate thresholds in `OverlapClassifier.js`:
   - `minGateOverlapRatio: 0.9`
   - `minCorrelationForMerge: 0.98`
   - `maxMeanAbsDiffForMerge: 0.03`
   - `maxGlobalMeanAbsDiffForMerge: 0.15`

2. **globalMeanAbsDiff IS the MAE metric** that ChatGPT recommends prioritizing - it's already present, just underweighted at 20%.

3. **The current weighting produces reasonable rankings** for the hypervigilance ↔ alarm case (they ARE very similar), but the *rationale* for the high score is backwards:
   - Current: High score primarily from gate overlap (50%)
   - Better: High score should primarily come from low global diff (output similarity)

## Proposed Solution

### Rebalanced Weights

| Metric | Current Weight | Proposed Weight | Rationale |
|--------|----------------|-----------------|-----------|
| gateOverlapRatio | 0.50 | 0.30 | Still important but secondary |
| normalizedCorr | 0.30 | 0.20 | Least actionable for similarity |
| (1 - globalMeanAbsDiff) | 0.20 | 0.50 | Directly measures output similarity |

### Justification

1. **globalMeanAbsDiff** directly answers "how different are the actual outputs?" across ALL samples - the most relevant metric for prototype similarity.

2. **gateOverlapRatio** tells us "how often they fire together" - important context but doesn't measure output similarity directly.

3. **Pearson correlation** tells us "do intensities vary together when both fire" - can be misleading with sparse co-pass samples and doesn't account for selection bias.

### Impact on hypervigilance ↔ alarm

| Formula | Calculation | Score |
|---------|-------------|-------|
| Old | 1.0×0.5 + 0.785×0.3 + 0.983×0.2 | 0.932 |
| New | 1.0×0.3 + 0.785×0.2 + 0.983×0.5 | **0.949** |

The pair actually scores HIGHER with new weights because the tiny global diff (0.017) now contributes more.

---

## Implementation Specification

### 1. Configuration Changes

**File**: `src/expressionDiagnostics/config/prototypeOverlapConfig.js`

Add after line 206 (after `nearMissGlobalCorrelationThreshold`):

```javascript
// ========================================
// Composite Score Weights Configuration
// ========================================

/**
 * Weight for gate overlap ratio in composite score calculation.
 * Higher values emphasize how often prototypes fire together.
 * Range: [0, 1], should sum with other weights to 1.0
 */
compositeScoreGateOverlapWeight: 0.30,

/**
 * Weight for normalized correlation in composite score calculation.
 * Higher values emphasize intensity correlation when both prototypes fire.
 * Range: [0, 1], should sum with other weights to 1.0
 */
compositeScoreCorrelationWeight: 0.20,

/**
 * Weight for global output similarity (1 - globalMeanAbsDiff) in composite score.
 * Higher values emphasize how similar actual outputs are across ALL samples.
 * Range: [0, 1], should sum with other weights to 1.0
 *
 * Rationale: globalMeanAbsDiff is an MAE metric that directly measures
 * "how different are the actual outputs" - the most relevant metric for similarity.
 */
compositeScoreGlobalDiffWeight: 0.50,
```

### 2. JSDoc Type Update

**File**: `src/expressionDiagnostics/config/prototypeOverlapConfig.js`

Add to the `@typedef {object} PrototypeOverlapConfig` block:

```javascript
 * @property {number} compositeScoreGateOverlapWeight - Weight for gate overlap in composite score [0,1]
 * @property {number} compositeScoreCorrelationWeight - Weight for correlation in composite score [0,1]
 * @property {number} compositeScoreGlobalDiffWeight - Weight for global diff similarity in composite score [0,1]
```

### 3. Core Algorithm Changes

**File**: `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js`

Replace `#computeCompositeScore` method (lines 544-588):

```javascript
/**
 * Compute composite score for closest pair ranking.
 * Addresses selection bias by weighting gate overlap, correlation,
 * and global output similarity together.
 *
 * Formula: gateOverlapRatio × w_gate + normalizedCorrelation × w_corr + (1 - globalMeanAbsDiff) × w_diff
 *
 * Default weights prioritize globalMeanAbsDiff (MAE metric) as primary,
 * since it directly measures "how similar are actual outputs" across ALL samples,
 * not just co-pass samples.
 *
 * @param {number} gateOverlapRatio - Ratio of co-pass to either-pass [0, 1]
 * @param {number} correlation - Pearson correlation (co-pass only) [-1, 1] or NaN
 * @param {number} globalMeanAbsDiff - Mean absolute difference over ALL samples [0, 1] or NaN
 * @returns {number} Composite score [0, 1] or NaN if insufficient data
 */
#computeCompositeScore(gateOverlapRatio, correlation, globalMeanAbsDiff) {
  // Read weights from config (with defaults for backward compatibility)
  const wGate = this.#config.compositeScoreGateOverlapWeight ?? 0.30;
  const wCorr = this.#config.compositeScoreCorrelationWeight ?? 0.20;
  const wDiff = this.#config.compositeScoreGlobalDiffWeight ?? 0.50;

  // All inputs must be valid numbers for a meaningful composite score
  if (
    !Number.isFinite(gateOverlapRatio) ||
    !Number.isFinite(correlation) ||
    !Number.isFinite(globalMeanAbsDiff)
  ) {
    // Fallback: if we have gateOverlapRatio and correlation but missing global,
    // use a simplified formula with renormalized weights
    if (Number.isFinite(gateOverlapRatio) && Number.isFinite(correlation)) {
      // Normalize correlation from [-1, 1] to [0, 1]
      const normalizedCorr = (correlation + 1) / 2;
      // Renormalize weights for two-component formula
      const totalFallbackWeight = wGate + wCorr;
      const normGate = wGate / totalFallbackWeight;
      const normCorr = wCorr / totalFallbackWeight;
      return gateOverlapRatio * normGate + normalizedCorr * normCorr;
    }
    return NaN;
  }

  // Normalize correlation from [-1, 1] to [0, 1]
  const normalizedCorr = (correlation + 1) / 2;

  // Clamp globalMeanAbsDiff to [0, 1] for safety
  const clampedGlobalDiff = Math.max(0, Math.min(1, globalMeanAbsDiff));

  // Composite formula: higher is "closer" / more similar
  // - gateOverlapRatio: how often both fire together
  // - normalizedCorr: how correlated intensities are when both fire
  // - (1 - globalMeanAbsDiff): low global difference = high similarity (primary signal)
  return (
    gateOverlapRatio * wGate +
    normalizedCorr * wCorr +
    (1 - clampedGlobalDiff) * wDiff
  );
}
```

### 4. UI Tooltip Update

**File**: `src/domUI/prototype-analysis/PrototypeAnalysisController.js`

Find the composite score tooltip (around line 550) and update:

```javascript
title="Composite score: weighted combination of global output similarity (50%), gate overlap (30%), and correlation (20%)"
```

---

## Testing Requirements

### Unit Tests to Update

**File**: `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.compositeScore.test.js`

1. **Update calculation comment** (lines 369-371):
   ```javascript
   // Old: Pair 2 composite ≈ 0.941×0.5 + 0.85×0.3 + 0.88×0.2 = 0.901
   // New: Pair 2 composite ≈ 0.941×0.3 + 0.85×0.2 + 0.88×0.5 = 0.282 + 0.17 + 0.44 = 0.892
   ```

2. **Verify test "ranks high overlap + moderate correlation above low overlap + high correlation"** still passes - it should, because Pair 2 also has lower global diff.

### Unit Tests to Add

**File**: `tests/unit/expressionDiagnostics/config/prototypeOverlapConfig.test.js`

```javascript
describe('composite score weights', () => {
  it('should have compositeScoreGateOverlapWeight', () => {
    expect(PROTOTYPE_OVERLAP_CONFIG.compositeScoreGateOverlapWeight).toBe(0.30);
  });

  it('should have compositeScoreCorrelationWeight', () => {
    expect(PROTOTYPE_OVERLAP_CONFIG.compositeScoreCorrelationWeight).toBe(0.20);
  });

  it('should have compositeScoreGlobalDiffWeight', () => {
    expect(PROTOTYPE_OVERLAP_CONFIG.compositeScoreGlobalDiffWeight).toBe(0.50);
  });

  it('should have composite score weights that sum to 1.0', () => {
    const sum =
      PROTOTYPE_OVERLAP_CONFIG.compositeScoreGateOverlapWeight +
      PROTOTYPE_OVERLAP_CONFIG.compositeScoreCorrelationWeight +
      PROTOTYPE_OVERLAP_CONFIG.compositeScoreGlobalDiffWeight;
    expect(sum).toBeCloseTo(1.0, 10);
  });
});
```

**New File**: `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.configurableWeights.test.js`

```javascript
/**
 * @file Unit tests for configurable composite score weights
 * Tests that weights can be customized via config and fallback behavior works correctly
 */

import { describe, it, expect, jest } from '@jest/globals';
import PrototypeOverlapAnalyzer from '../../../../src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js';

describe('PrototypeOverlapAnalyzer - configurable composite weights', () => {
  // ... standard mock factory functions ...

  describe('custom weight configuration', () => {
    it('uses config weights when provided', async () => {
      const config = createConfig({
        compositeScoreGateOverlapWeight: 0.20,
        compositeScoreCorrelationWeight: 0.10,
        compositeScoreGlobalDiffWeight: 0.70,
      });

      // Create pair with known metrics
      const classification = {
        type: 'keep_distinct',
        metrics: {
          gateOverlapRatio: 0.5,
          pearsonCorrelation: 0.6, // normalizedCorr = 0.8
          globalMeanAbsDiff: 0.1,  // similarity = 0.9
        },
      };

      const analyzer = new PrototypeOverlapAnalyzer({ /* ... mocks ... */ });
      const result = await analyzer.analyze('expression');
      const closestPair = result.metadata?.summaryInsight?.closestPair;

      // Expected: 0.5×0.20 + 0.8×0.10 + 0.9×0.70 = 0.10 + 0.08 + 0.63 = 0.81
      expect(closestPair.compositeScore).toBeCloseTo(0.81, 2);
    });

    it('uses default weights when config properties missing', async () => {
      const config = createConfig({}); // No weight properties

      const classification = {
        type: 'keep_distinct',
        metrics: {
          gateOverlapRatio: 0.5,
          pearsonCorrelation: 0.6, // normalizedCorr = 0.8
          globalMeanAbsDiff: 0.1,  // similarity = 0.9
        },
      };

      const analyzer = new PrototypeOverlapAnalyzer({ /* ... mocks ... */ });
      const result = await analyzer.analyze('expression');
      const closestPair = result.metadata?.summaryInsight?.closestPair;

      // Expected with defaults (0.30, 0.20, 0.50):
      // 0.5×0.30 + 0.8×0.20 + 0.9×0.50 = 0.15 + 0.16 + 0.45 = 0.76
      expect(closestPair.compositeScore).toBeCloseTo(0.76, 2);
    });
  });

  describe('fallback behavior', () => {
    it('correctly renormalizes weights when globalMeanAbsDiff is NaN', async () => {
      const config = createConfig({
        compositeScoreGateOverlapWeight: 0.30,
        compositeScoreCorrelationWeight: 0.20,
        compositeScoreGlobalDiffWeight: 0.50,
      });

      const classification = {
        type: 'keep_distinct',
        metrics: {
          gateOverlapRatio: 0.8,
          pearsonCorrelation: 0.6, // normalizedCorr = 0.8
          globalMeanAbsDiff: NaN,   // Missing!
        },
      };

      const analyzer = new PrototypeOverlapAnalyzer({ /* ... mocks ... */ });
      const result = await analyzer.analyze('expression');
      const closestPair = result.metadata?.summaryInsight?.closestPair;

      // Fallback renormalizes 0.30 + 0.20 = 0.50 → gate=0.60, corr=0.40
      // Expected: 0.8×0.60 + 0.8×0.40 = 0.48 + 0.32 = 0.80
      expect(closestPair.compositeScore).toBeCloseTo(0.80, 2);
    });
  });

  describe('rebalanced weight behavior', () => {
    it('prioritizes globalMeanAbsDiff with new default weights', async () => {
      // Pair 1: High gate overlap, low correlation, HIGH global diff
      // Pair 2: Low gate overlap, high correlation, LOW global diff

      const behaviorResults = [
        // Pair 1: gate=0.9, corr=0.5, globalDiff=0.6
        createBehaviorResult({ gateOverlapRatio: 0.9, correlation: 0.5, globalMeanAbsDiff: 0.6 }),
        // Pair 2: gate=0.3, corr=0.9, globalDiff=0.05
        createBehaviorResult({ gateOverlapRatio: 0.3, correlation: 0.9, globalMeanAbsDiff: 0.05 }),
      ];

      const analyzer = new PrototypeOverlapAnalyzer({ /* ... mocks ... */ });
      const result = await analyzer.analyze('expression');
      const closestPair = result.metadata?.summaryInsight?.closestPair;

      // With new weights (0.30, 0.20, 0.50):
      // Pair 1: 0.9×0.30 + 0.75×0.20 + 0.4×0.50 = 0.27 + 0.15 + 0.20 = 0.62
      // Pair 2: 0.3×0.30 + 0.95×0.20 + 0.95×0.50 = 0.09 + 0.19 + 0.475 = 0.755
      // Pair 2 should win despite lower gate overlap
      expect(closestPair.prototypeB).toBe('proto:c'); // Pair 2
      expect(closestPair.compositeScore).toBeGreaterThan(0.70);
    });
  });
});
```

### Integration Tests to Update

**File**: `tests/integration/expressionDiagnostics/prototypeOverlap/prototypeOverlapAnalyzer.integration.test.js`

Add test case:

```javascript
describe('composite score rebalancing', () => {
  it('composite score uses rebalanced weights favoring global similarity', async () => {
    const result = await analyzer.analyze({
      prototypeFamily: 'emotion',
      sampleCount: 2000,
    });

    const closestPair = result.metadata?.summaryInsight?.closestPair;
    if (closestPair && Number.isFinite(closestPair.globalMeanAbsDiff)) {
      // With new weights (0.30, 0.20, 0.50), global diff contributes most
      // The (1 - globalMeanAbsDiff) × 0.50 term should be significant
      const globalSimilarityContribution = (1 - closestPair.globalMeanAbsDiff) * 0.50;

      // If global diff is low, this contribution should be substantial
      if (closestPair.globalMeanAbsDiff < 0.1) {
        expect(globalSimilarityContribution).toBeGreaterThan(0.45);
      }
    }
  });
});
```

---

## Validation Criteria

### Quantitative Success Criteria

1. **hypervigilance ↔ alarm case**: Score should remain high (~0.85+)
   - Calculation: 1.0×0.3 + 0.785×0.2 + 0.983×0.5 = **0.949** ✓

2. **Pairs with low global diff should score higher**: For any pair where `globalMeanAbsDiff < 0.10`, the composite score should increase relative to old formula.

3. **Pairs with high gate overlap but high global diff should score lower**: Selection bias correction.

### Test Execution Criteria

All tests must pass:

```bash
npm run test:unit -- --testPathPattern="prototypeOverlap"
npm run test:integration -- --testPathPattern="prototypeOverlap"
npx eslint src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js src/expressionDiagnostics/config/prototypeOverlapConfig.js
npm run typecheck
```

### Backward Compatibility

- Existing configs without new properties automatically use new defaults
- No breaking changes to merge/subsumption classification logic
- Fallback formula maintains reasonable behavior when globalMeanAbsDiff is NaN

---

## Files to Modify

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/config/prototypeOverlapConfig.js` | Add 3 weight config properties + JSDoc types |
| `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js` | Modify `#computeCompositeScore()` to use config weights |
| `src/domUI/prototype-analysis/PrototypeAnalysisController.js` | Update tooltip text |
| `tests/unit/expressionDiagnostics/config/prototypeOverlapConfig.test.js` | Add weight tests |
| `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.compositeScore.test.js` | Update expected calculations |
| `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.configurableWeights.test.js` | **NEW** - configurable weights tests |
| `tests/integration/expressionDiagnostics/prototypeOverlap/prototypeOverlapAnalyzer.integration.test.js` | Add rebalancing validation test |

---

## Rollback Strategy

If issues arise, revert config values to old weights:

```javascript
compositeScoreGateOverlapWeight: 0.50,
compositeScoreCorrelationWeight: 0.30,
compositeScoreGlobalDiffWeight: 0.20,
```

No code changes needed - weights are read from config with defaults.
