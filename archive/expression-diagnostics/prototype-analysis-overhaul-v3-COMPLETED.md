# Prototype Analysis System Overhaul v3

## Executive Summary

This specification defines a comprehensive overhaul of the prototype overlap analysis system to address the issues identified in external review. The core changes transform the Monte Carlo sampling strategy from per-pair to per-prototype, replace Pearson correlation as the primary gatekeeper with agreement metrics, and add data-driven decision logic for actionable insights.

## Motivation

The current prototype analysis system (v2.x) exhibits several problematic behaviors:

1. **Unstable per-pair Monte Carlo**: 20,000 samples per pair leads to O(pairs × samples) complexity and inconsistent comparisons between pairs
2. **Over-reliance on Pearson correlation**: Correlation-dependent thresholds cause merge/subsume classifications to never fire (0 merge, 0 subsumed in 193 candidates)
3. **Unreliable actionable insights**: Suggested gate thresholds have unit/direction issues making them unsafe to apply
4. **Missing prototype-level signals**: No metrics for prototype generality, sparsity, or delta-from-cluster-center
5. **Incomplete gate parsing**: Falls back to Monte Carlo inference when deterministic nesting is unreliable

### Current Output Issues (Reference)

From `reports/prototype-analysis-results.md`:
- 4095 pairs → 193 candidates → 0 merge, 0 subsumed, 123 nested
- System is willing to say "one implies the other" but merge/subsume thresholds never fire
- Composite score over-rewards gate overlap, so "closest pair" ≠ "mergeable pair"

## Goals

1. **Stable comparisons**: All prototypes evaluated on same context pool
2. **Agreement-based classification**: MAE/RMSE primary, correlation diagnostic only
3. **Safe actionable insights**: Data-driven threshold suggestions with validation
4. **Prototype proliferation guardrails**: Generality/sparsity/novelty signals
5. **Canonical gate representation**: AST-based parsing for reliable implication checks
6. **Comprehensive test coverage**: Unit, integration, and validation tests for all changes

## Architecture Overview

### Current Architecture (v2.x)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PrototypeOverlapAnalyzer                     │
├─────────────────────────────────────────────────────────────────┤
│  1. CandidatePairFilter (Route A/B/C)                          │
│     └── Filter O(n²) pairs to candidates via weight vectors     │
│                                                                 │
│  2. BehavioralOverlapEvaluator                                  │
│     └── Monte Carlo per-pair (8000-20000 samples/pair)         │
│     └── Pearson correlation on co-pass samples                  │
│                                                                 │
│  3. OverlapClassifier                                           │
│     └── Priority-ordered classification (merge > subsume > ...) │
│     └── Correlation-gated merge/subsume thresholds              │
│                                                                 │
│  4. OverlapRecommendationBuilder                                │
│     └── Rule-based threshold suggestions                        │
└─────────────────────────────────────────────────────────────────┘
```

### Proposed Architecture (v3)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PrototypeOverlapAnalyzer (v3)                │
├─────────────────────────────────────────────────────────────────┤
│  0. SharedContextPoolGenerator (NEW)                            │
│     └── Generate shared context pool C once                     │
│     └── Optionally stratified by mood regime                    │
│                                                                 │
│  1. PrototypeVectorEvaluator (NEW)                              │
│     └── Evaluate ALL prototypes on shared pool C                │
│     └── Produce output vector per prototype                     │
│     └── O(prototypes × samples)                                 │
│                                                                 │
│  2. PairwiseSimilarityCalculator (NEW)                          │
│     └── Cheap vector math on prototype output vectors           │
│     └── O(pairs × cheap-math)                                   │
│                                                                 │
│  3. CandidatePairFilter (enhanced)                              │
│     └── Filter using similarity scores from step 2              │
│     └── Retain Route A/B/C as fallback/enhancement              │
│                                                                 │
│  4. AgreementMetricsCalculator (NEW)                            │
│     └── MAE/RMSE on co-pass (primary)                           │
│     └── MAE/RMSE global with gated zeros (secondary)            │
│     └── Activation Jaccard (existing gateOverlapRatio)          │
│     └── Wilson/Beta CI for conditional probabilities            │
│     └── Correlation as diagnostic only                          │
│                                                                 │
│  5. PrototypeProfileCalculator (NEW)                            │
│     └── Gate volume estimate (generality)                       │
│     └── Weight entropy/concentration (sparsity)                 │
│     └── Delta-from-nearest-cluster (novelty)                    │
│                                                                 │
│  6. OverlapClassifier (v3)                                      │
│     └── Agreement-based classification rules                    │
│     └── Multi-signal decision logic                             │
│                                                                 │
│  7. ActionableSuggestionEngine (NEW)                            │
│     └── Data-driven decision stump fitting                      │
│     └── Threshold validation before suggestion                  │
│     └── Legal axis range clamping                               │
│                                                                 │
│  8. GateASTNormalizer (NEW)                                     │
│     └── Canonical AST representation for gates                  │
│     └── Consistent parsing and implication checking             │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Specifications

### Part A: Shared Context Pool (Highest Leverage)

#### A1. SharedContextPoolGenerator

**Purpose**: Generate a single shared context pool to evaluate all prototypes consistently.

**Location**: `src/expressionDiagnostics/services/prototypeOverlap/SharedContextPoolGenerator.js`

**Interface**:
```javascript
class SharedContextPoolGenerator {
  /**
   * @param {object} options
   * @param {number} options.poolSize - Total contexts in pool (default: 50000)
   * @param {boolean} options.stratified - Whether to stratify by mood regime
   * @param {number} options.stratumCount - Number of strata if stratified
   */
  constructor(options)

  /**
   * Generate the shared context pool.
   * @returns {Array<object>} Array of context objects
   */
  generate()

  /**
   * Get contexts for a specific stratum (if stratified).
   * @param {string} stratumId
   * @returns {Array<object>}
   */
  getStratum(stratumId)
}
```

**Implementation Notes**:
- Use existing `RandomStateGenerator` for individual contexts
- Stratification options: uniform, mood-regime-weighted, axis-extremes-enhanced
- Pool should be deterministically reproducible given same seed
- Store pool metadata (generation params, seed, timestamp) for reproducibility

**Configuration** (add to `prototypeOverlapConfig.js`):
```javascript
{
  // Shared context pool configuration
  sharedPoolSize: 50000,
  enableStratifiedSampling: true,
  stratumCount: 5,
  stratificationStrategy: 'mood-regime', // 'uniform' | 'mood-regime' | 'extremes-enhanced'
  poolRandomSeed: null, // null for random, number for reproducible
}
```

#### A2. PrototypeVectorEvaluator

**Purpose**: Evaluate every prototype on the shared context pool, producing output vectors.

**Location**: `src/expressionDiagnostics/services/prototypeOverlap/PrototypeVectorEvaluator.js`

**Interface**:
```javascript
class PrototypeVectorEvaluator {
  /**
   * Evaluate all prototypes on the shared context pool.
   * @param {Array<object>} prototypes - All prototypes to evaluate
   * @param {Array<object>} contextPool - Shared context pool
   * @returns {Map<string, PrototypeOutputVector>} Map of prototypeId -> output vector
   */
  async evaluateAll(prototypes, contextPool)
}

/**
 * @typedef {object} PrototypeOutputVector
 * @property {string} prototypeId
 * @property {Float32Array} gateResults - Binary pass/fail per context (0 or 1)
 * @property {Float32Array} intensities - Output intensity per context (0 if gate fails)
 * @property {number} activationRate - Fraction of contexts where gate passes
 * @property {number} meanIntensity - Mean intensity when activated
 * @property {number} stdIntensity - Std dev of intensity when activated
 */
```

**Implementation Notes**:
- Use existing `PrototypeGateChecker` and `PrototypeIntensityCalculator`
- Batch processing with `await yield` for event loop
- Memory optimization: use Float32Array for vectors
- Cache results for reuse within analysis session

**Complexity Change**:
- Old: O(pairs × samplesPerPair) = O(4095 × 20000) = ~82M evaluations
- New: O(prototypes × poolSize) = O(91 × 50000) = ~4.5M evaluations
- Plus O(pairs) cheap vector math = O(4095) trivial operations

### Part B: Agreement Metrics (Replace Pearson Gatekeeper)

#### B1. AgreementMetricsCalculator

**Purpose**: Compute agreement metrics that replace Pearson correlation as the primary classification signal.

**Location**: `src/expressionDiagnostics/services/prototypeOverlap/AgreementMetricsCalculator.js`

**Interface**:
```javascript
class AgreementMetricsCalculator {
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
 * @property {number} activationJaccard - P(both) / P(either) [existing gateOverlapRatio]
 * @property {number} pA_given_B - P(A passes | B passes)
 * @property {number} pB_given_A - P(B passes | A passes)
 * @property {number} pA_given_B_lower - Wilson/Beta CI lower bound
 * @property {number} pA_given_B_upper - Wilson/Beta CI upper bound
 * @property {number} pB_given_A_lower - Wilson/Beta CI lower bound
 * @property {number} pB_given_A_upper - Wilson/Beta CI upper bound
 * @property {number} pearsonCoPass - Correlation on co-pass (diagnostic only)
 * @property {number} pearsonGlobal - Global correlation (diagnostic only)
 * @property {number} coPassCount - Number of co-pass samples
 * @property {boolean} correlationReliable - Whether correlation should be trusted
 */
```

**Wilson/Beta Confidence Interval**:
```javascript
/**
 * Wilson score interval for binomial proportion.
 * @param {number} successes - Number of successes
 * @param {number} trials - Number of trials
 * @param {number} z - Z-score (1.96 for 95% CI)
 * @returns {{lower: number, upper: number}}
 */
function wilsonInterval(successes, trials, z = 1.96) {
  if (trials === 0) return { lower: 0, upper: 1 };
  const p = successes / trials;
  const denom = 1 + z * z / trials;
  const center = (p + z * z / (2 * trials)) / denom;
  const margin = (z / denom) * Math.sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials));
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}
```

**Configuration** (add to `prototypeOverlapConfig.js`):
```javascript
{
  // Agreement metrics configuration
  confidenceLevel: 0.95, // For Wilson CI
  minSamplesForReliableCorrelation: 500,

  // Classification thresholds (replace correlation-based)
  maxMaeCoPassForMerge: 0.03,
  maxRmseCoPassForMerge: 0.05,
  maxMaeGlobalForMerge: 0.08,
  minActivationJaccardForMerge: 0.85,

  // Nesting thresholds with CI
  minConditionalProbForNesting: 0.95,
  minConditionalProbCILowerForNesting: 0.90, // Lower bound must exceed this
}
```

### Part C: Prototype Profile Signals (Proliferation Guardrails)

#### C1. PrototypeProfileCalculator

**Purpose**: Compute per-prototype signals for generality, sparsity, and novelty.

**Location**: `src/expressionDiagnostics/services/prototypeOverlap/PrototypeProfileCalculator.js`

**Interface**:
```javascript
class PrototypeProfileCalculator {
  /**
   * Calculate profile metrics for all prototypes.
   * @param {Array<object>} prototypes
   * @param {Map<string, PrototypeOutputVector>} outputVectors
   * @returns {Map<string, PrototypeProfile>}
   */
  calculateAll(prototypes, outputVectors)
}

/**
 * @typedef {object} PrototypeProfile
 * @property {string} prototypeId
 * @property {number} gateVolume - Activation rate under broad sampling [0,1]
 * @property {number} weightEntropy - Shannon entropy of normalized |weights|
 * @property {number} weightConcentration - Max |weight| / sum |weights| (single-axis focus)
 * @property {number} deltaFromNearestCenter - L2 distance to nearest cluster centroid
 * @property {string} nearestClusterId - ID of nearest cluster centroid
 * @property {boolean} isExpressionCandidate - Low-volume + low-novelty + single-axis
 */
```

**Weight Entropy Calculation**:
```javascript
function weightEntropy(weights) {
  const values = Object.values(weights).map(Math.abs).filter(v => v > 0);
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  const probs = values.map(v => v / sum);
  return -probs.reduce((h, p) => h + (p > 0 ? p * Math.log2(p) : 0), 0);
}
```

**Expression Candidate Criteria**:
```javascript
const isExpressionCandidate =
  profile.gateVolume < config.lowVolumeThreshold &&           // Rare activation
  profile.deltaFromNearestCenter < config.lowNoveltyThreshold && // Small delta
  profile.weightConcentration > config.singleAxisFocusThreshold; // Single-axis tweak
```

**Configuration** (add to `prototypeOverlapConfig.js`):
```javascript
{
  // Prototype profile thresholds
  lowVolumeThreshold: 0.05,        // < 5% activation = rare
  lowNoveltyThreshold: 0.15,       // Small delta from cluster
  singleAxisFocusThreshold: 0.6,   // > 60% weight on one axis
  clusteringMethod: 'k-means',     // 'k-means' | 'hierarchical'
  clusterCount: 10,                // Number of prototype clusters
}
```

### Part D: Revised Classification Logic

#### D1. OverlapClassifier v3

**Purpose**: Replace correlation-gated classification with agreement-based rules.

**Classification Rules** (priority order, first match wins):

**1. MERGE_RECOMMENDED**
```javascript
const isMerge =
  metrics.maeGlobal <= config.maxMaeGlobalForMerge &&
  metrics.activationJaccard >= config.minActivationJaccardForMerge &&
  !isDead(vectorA) && !isDead(vectorB) &&
  Math.abs(metrics.pA_given_B - metrics.pB_given_A) < config.symmetryTolerance;
```

**2. SUBSUMED_RECOMMENDED** (A subsumed by B)
```javascript
const aIsSubsumed =
  metrics.pB_given_A_lower >= config.minConditionalProbCILowerForNesting && // A → B with CI
  metrics.pA_given_B < 1 - config.asymmetryRequired &&                      // B ↛ A
  profileA.gateVolume < profileB.gateVolume &&                              // A narrower
  exclusiveRateA <= config.maxExclusiveForSubsumption;                      // A rarely alone
```

**3. CONVERT_TO_EXPRESSION**
```javascript
const isExpressionConversion =
  hasNesting(metrics) &&
  narrowerProfile.isExpressionCandidate &&
  metrics.maeCoPass <= config.maxMaeDeltaForExpression; // Small intensity difference
```

**4. NESTED_SIBLINGS**
```javascript
const isNested =
  (metrics.pB_given_A_lower >= config.minConditionalProbCILowerForNesting ||
   metrics.pA_given_B_lower >= config.minConditionalProbCILowerForNesting) &&
  metrics.pA_given_B !== metrics.pB_given_A; // Asymmetric
```

**5. NEEDS_SEPARATION**
```javascript
const needsSeparation =
  metrics.activationJaccard >= 0.7 &&
  !hasNesting(metrics) &&
  metrics.maeCoPass > config.maxMaeDeltaForExpression; // High overlap but different outputs
```

**6. KEEP_DISTINCT** (fallback)

### Part E: Data-Driven Actionable Insights

#### E1. ActionableSuggestionEngine

**Purpose**: Generate threshold suggestions using decision stump fitting with validation.

**Location**: `src/expressionDiagnostics/services/prototypeOverlap/ActionableSuggestionEngine.js`

**Interface**:
```javascript
class ActionableSuggestionEngine {
  /**
   * Generate actionable suggestions for a classified pair.
   * @param {PrototypeOutputVector} vectorA
   * @param {PrototypeOutputVector} vectorB
   * @param {Array<object>} contextPool
   * @param {string} classification
   * @returns {Array<ActionableSuggestion>}
   */
  generateSuggestions(vectorA, vectorB, contextPool, classification)
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

**Decision Stump Algorithm**:
```javascript
/**
 * Fit a single-split decision stump to separate overlapping samples.
 * @param {Array<{context, passA, passB, intensityA, intensityB}>} samples
 * @returns {{axis, threshold, direction, infoGain}}
 */
function fitDecisionStump(samples) {
  const divergentSamples = samples.filter(s =>
    (s.passA !== s.passB) || Math.abs(s.intensityA - s.intensityB) > config.divergenceThreshold
  );

  if (divergentSamples.length < config.minSamplesForStump) {
    return null;
  }

  let bestSplit = { infoGain: 0 };

  for (const axis of getAllAxes()) {
    const axisRange = getAxisRange(axis);
    const values = divergentSamples.map(s => s.context[axis]).sort((a, b) => a - b);

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

**Validation Requirements**:
1. Threshold must be within legal axis range
2. Threshold must be formatted in correct units (0-1 for emotions, -100 to 100 for mood)
3. Applying suggestion should not reduce activation rate below minimum viable
4. Suggestion should meaningfully reduce overlap (>10% reduction)

**Configuration** (add to `prototypeOverlapConfig.js`):
```javascript
{
  // Actionable suggestion configuration
  minSamplesForStump: 100,
  minInfoGainForSuggestion: 0.05,
  divergenceThreshold: 0.1,
  maxSuggestionsPerPair: 3,
  minOverlapReductionForSuggestion: 0.1,
  minActivationRateAfterSuggestion: 0.01,

  // Axis ranges for validation
  axisRanges: {
    valence: { min: -1, max: 1 },
    arousal: { min: -1, max: 1 },
    threat: { min: -1, max: 1 },
    // ... other axes
  },
}
```

### Part F: Canonical Gate Representation

#### F1. GateASTNormalizer

**Purpose**: Parse gates into canonical AST for reliable implication checking.

**Location**: `src/expressionDiagnostics/services/prototypeOverlap/GateASTNormalizer.js`

**AST Schema**:
```javascript
/**
 * @typedef {object} GateAST
 * @property {'and' | 'or' | 'comparison' | 'not'} type
 * @property {Array<GateAST>} [children] - For 'and' | 'or'
 * @property {GateAST} [operand] - For 'not'
 * @property {string} [axis] - For 'comparison'
 * @property {'<' | '<=' | '>' | '>=' | '==' | '!='} [operator] - For 'comparison'
 * @property {number} [threshold] - For 'comparison'
 */

// Example: "valence > 0.5 AND (arousal >= 0.3 OR threat < 0.2)"
const exampleAST = {
  type: 'and',
  children: [
    { type: 'comparison', axis: 'valence', operator: '>', threshold: 0.5 },
    {
      type: 'or',
      children: [
        { type: 'comparison', axis: 'arousal', operator: '>=', threshold: 0.3 },
        { type: 'comparison', axis: 'threat', operator: '<', threshold: 0.2 },
      ],
    },
  ],
};
```

**Interface**:
```javascript
class GateASTNormalizer {
  /**
   * Parse gate definition to canonical AST.
   * @param {object|string|Array} gate - Gate in any supported format
   * @returns {{ast: GateAST, parseComplete: boolean, errors: Array<string>}}
   */
  parse(gate)

  /**
   * Check if AST A implies AST B (A → B).
   * @param {GateAST} astA
   * @param {GateAST} astB
   * @returns {{implies: boolean, isVacuous: boolean}}
   */
  checkImplication(astA, astB)

  /**
   * Generate human-readable string from AST.
   * @param {GateAST} ast
   * @returns {string}
   */
  toString(ast)

  /**
   * Evaluate AST against context.
   * @param {GateAST} ast
   * @param {object} context
   * @returns {boolean}
   */
  evaluate(ast, context)
}
```

**Implementation Notes**:
- Support all existing gate formats (JSON-Logic, string predicates, arrays)
- Parse to single canonical form for consistency
- Generate human-readable strings FROM the AST (not the other way around)
- Implication checking uses constraint propagation (existing `GateImplicationEvaluator` logic)

## Implementation Strategy

### Overview

This is a **full replacement** of the v2 analysis system. V3 becomes the only analysis path with all v2 code being removed.

### Phase 1: Core Services

1. Create `SharedContextPoolGenerator` - shared context pool generation
2. Create `PrototypeVectorEvaluator` - prototype evaluation on shared pool
3. Create `AgreementMetricsCalculator` - MAE/RMSE/CI metrics (replaces Pearson-based)
4. Create `PrototypeProfileCalculator` - generality/sparsity/novelty signals
5. Create `WilsonInterval` - confidence interval utility
6. Add V3 configuration properties

### Phase 2: Classification and Suggestions

1. Create `ActionableSuggestionEngine` - data-driven decision stumps (replaces rule-based)
2. Update `OverlapClassifier` - agreement-based classification rules
3. Update `OverlapRecommendationBuilder` - use suggestion engine exclusively
4. Remove rule-based suggestion code paths

### Phase 3: Gate AST and Integration

1. Create `GateASTNormalizer` - canonical AST representation
2. Update `GateImplicationEvaluator` - use AST normalizer
3. Remove legacy gate parsing code

### Phase 4: Orchestrator and Cleanup

1. Update `PrototypeOverlapAnalyzer` - v3 pipeline orchestration
2. Update `BehavioralOverlapEvaluator` - vector-based evaluation exclusively
3. Remove Monte Carlo per-pair evaluation code
4. Remove all v2 fallback paths

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/expressionDiagnostics/services/prototypeOverlap/SharedContextPoolGenerator.js` | Generate shared context pool |
| `src/expressionDiagnostics/services/prototypeOverlap/PrototypeVectorEvaluator.js` | Evaluate prototypes on pool |
| `src/expressionDiagnostics/services/prototypeOverlap/AgreementMetricsCalculator.js` | MAE/RMSE/CI metrics |
| `src/expressionDiagnostics/services/prototypeOverlap/PrototypeProfileCalculator.js` | Generality/sparsity/novelty |
| `src/expressionDiagnostics/services/prototypeOverlap/ActionableSuggestionEngine.js` | Data-driven suggestions |
| `src/expressionDiagnostics/services/prototypeOverlap/GateASTNormalizer.js` | Canonical gate AST |
| `src/expressionDiagnostics/services/prototypeOverlap/WilsonInterval.js` | CI calculation utility |

### Modified Files

| File | Changes |
|------|---------|
| `src/expressionDiagnostics/config/prototypeOverlapConfig.js` | Add v3 configuration properties |
| `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js` | Integrate v3 services |
| `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js` | Add v3 classification rules |
| `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js` | Use shared pool when enabled |
| `src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js` | Use suggestion engine |
| `src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js` | Use AST normalizer |

## Testing Requirements

### Unit Tests (Required)

Each new service requires comprehensive unit tests:

#### SharedContextPoolGenerator Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/sharedContextPoolGenerator.test.js`
  - Test pool generation with default options
  - Test stratified sampling
  - Test deterministic seeding
  - Test pool metadata
  - Test edge cases (pool size 0, invalid options)

#### PrototypeVectorEvaluator Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/prototypeVectorEvaluator.test.js`
  - Test evaluation of single prototype
  - Test batch evaluation of multiple prototypes
  - Test output vector structure
  - Test memory efficiency (Float32Array)
  - Test yield to event loop
  - Test error handling (invalid prototype)

#### AgreementMetricsCalculator Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/agreementMetricsCalculator.test.js`
  - Test MAE calculation (co-pass and global)
  - Test RMSE calculation (co-pass and global)
  - Test activation Jaccard
  - Test conditional probabilities
  - Test Wilson CI calculation
  - Test edge cases (no co-pass samples, all samples co-pass)
  - Test correlation reliability detection

#### WilsonInterval Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/wilsonInterval.test.js`
  - Test standard cases
  - Test edge cases (0 trials, 0 successes, all successes)
  - Test confidence levels (90%, 95%, 99%)

#### PrototypeProfileCalculator Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/prototypeProfileCalculator.test.js`
  - Test gate volume calculation
  - Test weight entropy calculation
  - Test weight concentration calculation
  - Test delta-from-nearest-center
  - Test expression candidate detection
  - Test clustering

#### ActionableSuggestionEngine Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/actionableSuggestionEngine.test.js`
  - Test decision stump fitting
  - Test info gain calculation
  - Test threshold validation
  - Test axis range clamping
  - Test overlap reduction estimation
  - Test activation impact estimation
  - Test insufficient samples handling

#### GateASTNormalizer Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/gateASTNormalizer.test.js`
  - Test parsing JSON-Logic gates
  - Test parsing string predicates
  - Test parsing array gates
  - Test implication checking (A → B)
  - Test vacuous implication detection
  - Test toString generation
  - Test AST evaluation
  - Test parse error handling

#### OverlapClassifier v3 Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.v3.test.js`
  - Test MERGE_RECOMMENDED with agreement metrics
  - Test SUBSUMED_RECOMMENDED with CI
  - Test CONVERT_TO_EXPRESSION with profile
  - Test NESTED_SIBLINGS with asymmetric CI
  - Test NEEDS_SEPARATION
  - Test classification priority order

### Integration Tests (Required)

#### Full Pipeline Integration
- `tests/integration/expressionDiagnostics/prototypeOverlap/v3Pipeline.integration.test.js`
  - Test end-to-end v3 analysis
  - Test real prototype data from `emotion_prototypes.lookup.json`
  - Test classification targets met (>5 merge, >10 subsume)

#### Context Pool Consistency
- `tests/integration/expressionDiagnostics/prototypeOverlap/sharedPoolConsistency.integration.test.js`
  - Test that same seed produces same pool
  - Test that stratification produces expected distribution
  - Test that pool covers expected mood regimes

#### Agreement Metrics Validation
- `tests/integration/expressionDiagnostics/prototypeOverlap/agreementMetricsValidation.integration.test.js`
  - Test MAE/RMSE against known prototype pairs
  - Test CI coverage (95% CI should contain true value ~95% of time in simulation)
  - Test correlation diagnostic vs MAE primary signals

#### Suggestion Engine Validation
- `tests/integration/expressionDiagnostics/prototypeOverlap/suggestionValidation.integration.test.js`
  - Test that suggestions are within legal axis ranges
  - Test that suggestions use correct units
  - Test that applying suggestion reduces overlap
  - Test that activation impact estimates are accurate

### Performance Tests (Required)

- `tests/performance/expressionDiagnostics/v3AnalysisPerformance.performance.test.js`
  - Test v3 analysis completes within acceptable time (< 30 seconds for 91 prototypes)
  - Test memory usage stays within bounds
  - Test linear scaling with prototype count

### Quality Tests (Required)

- `tests/integration/expressionDiagnostics/prototypeOverlap/v3ClassificationQuality.integration.test.js`
  - Test classification targets met (>5 merge, >10 subsume)
  - Test merge recommendations have low MAE (< 0.1), high Jaccard (> 0.8)
  - Test subsume recommendations have asymmetric conditional probs
  - Test all suggestions valid and within legal ranges

## Success Criteria

1. **Complexity Reduction**: O(prototypes × samples) + O(pairs × cheap) vs O(pairs × samples)
2. **Classification Improvement**: Merge/subsume classifications now fire for appropriate pairs (target: >5 merges, >10 subsumes for 193 candidates)
3. **Actionable Insights**: All threshold suggestions validated and within legal ranges
4. **Test Coverage**: 80%+ branch coverage on new code
5. **Performance**: Full analysis completes in < 30 seconds

## Configuration Reference

Complete configuration additions for `prototypeOverlapConfig.js`:

```javascript
{
  // === V3 Configuration (all features enabled by default) ===
  // Note: V3 is the only analysis path; v2 code has been removed

  // === Shared Context Pool ===
  sharedPoolSize: 50000,
  enableStratifiedSampling: true,
  stratumCount: 5,
  stratificationStrategy: 'mood-regime',
  poolRandomSeed: null,

  // === Agreement Metrics ===
  confidenceLevel: 0.95,
  minSamplesForReliableCorrelation: 500,
  maxMaeCoPassForMerge: 0.03,
  maxRmseCoPassForMerge: 0.05,
  maxMaeGlobalForMerge: 0.08,
  minActivationJaccardForMerge: 0.85,
  minConditionalProbForNesting: 0.95,
  minConditionalProbCILowerForNesting: 0.90,
  symmetryTolerance: 0.05,
  asymmetryRequired: 0.1,
  maxMaeDeltaForExpression: 0.05,

  // === Prototype Profile ===
  lowVolumeThreshold: 0.05,
  lowNoveltyThreshold: 0.15,
  singleAxisFocusThreshold: 0.6,
  clusteringMethod: 'k-means',
  clusterCount: 10,

  // === Actionable Suggestions ===
  minSamplesForStump: 100,
  minInfoGainForSuggestion: 0.05,
  divergenceThreshold: 0.1,
  maxSuggestionsPerPair: 3,
  minOverlapReductionForSuggestion: 0.1,
  minActivationRateAfterSuggestion: 0.01,

  // === Axis Ranges ===
  axisRanges: {
    valence: { min: -1, max: 1 },
    arousal: { min: -1, max: 1 },
    threat: { min: -1, max: 1 },
    engagement: { min: -1, max: 1 },
    agency_control: { min: -1, max: 1 },
    self_evaluation: { min: -1, max: 1 },
    future_expectancy: { min: -1, max: 1 },
    affiliation: { min: -1, max: 1 },
    inhibitory_control: { min: -1, max: 1 },
    self_control: { min: -1, max: 1 },
    uncertainty: { min: -1, max: 1 },
    affective_empathy: { min: -1, max: 1 },
  },
}
```

## Appendix: External Review Points Addressed

| Review Point | Spec Section | Solution |
|--------------|--------------|----------|
| A) Stop doing Monte Carlo per pair | Part A | SharedContextPoolGenerator + PrototypeVectorEvaluator |
| B) Replace Pearson-as-gatekeeper | Part B | AgreementMetricsCalculator with MAE/RMSE/CI |
| C) Prototype generality/sparsity signals | Part C | PrototypeProfileCalculator |
| D) Fix gate parsing/implication | Part F | GateASTNormalizer with canonical AST |
| E) Data-driven suggestions | Part E | ActionableSuggestionEngine with decision stumps |

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| v3.0 | TBD | Initial specification based on external review |
