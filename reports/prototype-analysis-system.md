# Prototype Analysis System V3 - Technical Analysis Report

**Date**: 2026-01-23
**Purpose**: Deep research target for bug detection and system improvement analysis
**Code Path**: `prototype-analysis.html` → `src/prototype-analysis.js` → `PrototypeAnalysisController` → `PrototypeOverlapAnalyzer`

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Pipeline Architecture](#pipeline-architecture)
3. [Stage A: Candidate Filtering](#stage-a-candidate-filtering)
4. [Stage B: Behavioral Evaluation](#stage-b-behavioral-evaluation)
5. [Stage C: Classification Logic](#stage-c-classification-logic)
6. [Metric Calculations](#metric-calculations)
7. [V3 vs V2 Mode Differences](#v3-vs-v2-mode-differences)
8. [Potential Issues and Concerns](#potential-issues-and-concerns)
9. [Configuration Reference](#configuration-reference)

---

## System Overview

The Prototype Analysis System evaluates prototype pairs (emotion/sexual prototypes) for redundancy, overlap, and classification. The system produces recommendations like "merge", "subsumed", "nested siblings", "needs separation", or "convert to expression".

### Entry Point Flow

```
prototype-analysis.html
    └─ #run-analysis-btn click
        └─ PrototypeAnalysisController.#runAnalysis()
            └─ PrototypeOverlapAnalyzer.analyze({prototypeFamily, onProgress})
```

### Key Files

| File | Purpose |
|------|---------|
| `src/domUI/prototype-analysis/PrototypeAnalysisController.js` | UI controller, button handling |
| `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js` | Main orchestrator |
| `src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js` | Stage A filtering |
| `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js` | Stage B behavioral sampling |
| `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js` | Stage C classification |
| `src/expressionDiagnostics/services/prototypeOverlap/AgreementMetricsCalculator.js` | V3 vector metrics |
| `src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js` | Gate overlap logic |
| `src/expressionDiagnostics/services/prototypeOverlap/PrototypeProfileCalculator.js` | V3 prototype profiles |
| `src/expressionDiagnostics/config/prototypeOverlapConfig.js` | All thresholds |

---

## Pipeline Architecture

### V3 Mode (When all V3 services available)

```
1. SETUP STAGE (V3 only)
   └─ SharedContextPoolGenerator.generate() → contextPool (50,000 contexts)
   └─ PrototypeVectorEvaluator.evaluateAll() → outputVectors (per prototype)
   └─ PrototypeProfileCalculator.calculateSingle() → profiles (per prototype)

2. FILTERING STAGE
   └─ CandidatePairFilter.filterCandidates() → candidatePairs

3. EVALUATING STAGE (per pair)
   └─ BehavioralOverlapEvaluator.evaluate() → behaviorResult
       ├─ V3: #evaluateViaVectors() using pre-computed vectors
       └─ V2: Monte Carlo sampling (8000 samples per pair)

4. CLASSIFYING STAGE (per pair)
   └─ OverlapClassifier.classifyV3() or classify() → classification

5. RECOMMENDING STAGE (per actionable pair)
   └─ OverlapRecommendationBuilder.build() → recommendation
```

### V2 Mode (Fallback)

```
1. FILTERING STAGE
2. EVALUATING STAGE (Monte Carlo per pair)
3. CLASSIFYING STAGE
4. RECOMMENDING STAGE
```

---

## Stage A: Candidate Filtering

### What Determines a Candidate?

A pair of prototypes becomes a **candidate** if it passes three sequential filters in **Route A** (weight-vector similarity):

#### Filter 1: Active Axis Overlap (Jaccard)

**Calculation** (`CandidatePairFilter.#computePairMetrics`):

```javascript
const activeA = this.#getActiveAxes(weightsA);  // axes where |weight| >= epsilon
const activeB = this.#getActiveAxes(weightsB);
const activeAxisOverlap = Jaccard(activeA, activeB);
```

**Active Axis Definition** (`#getActiveAxes`):
```javascript
// An axis is "active" if |weight| >= activeAxisEpsilon (default: 0.08)
for (const [axis, weight] of Object.entries(weights)) {
    if (typeof weight === 'number' && Math.abs(weight) >= epsilon) {
        activeAxes.add(axis);
    }
}
```

**Jaccard Calculation** (`#computeJaccard`):
```javascript
const intersection = new Set([...setA].filter(x => setB.has(x)));
const union = new Set([...setA, ...setB]);
return intersection.size / union.size;
// Special case: Jaccard(∅, ∅) = 1.0 (configurable)
```

**Threshold**: `candidateMinActiveAxisOverlap = 0.6`

**Rejection Reason in UI**: "Axis overlap"

#### Filter 2: Sign Agreement

**Calculation** (`#computeSignAgreement`):

```javascript
// Only computed on shared (overlapping) axes
const sharedAxes = [...activeA].filter(axis => activeB.has(axis));

for (const axis of sharedAxes) {
    const signA = this.#softSign(weightsA[axis]);
    const signB = this.#softSign(weightsB[axis]);
    if (signA === signB) matchingCount++;
}
return matchingCount / sharedAxes.size;
```

**Soft Sign** (`#softSign`):
```javascript
// Weights with |w| < softSignThreshold (0.15) are treated as neutral (sign 0)
if (Math.abs(weight) < threshold) return 0;
return Math.sign(weight);
```

**Threshold**: `candidateMinSignAgreement = 0.8`

**Rejection Reason in UI**: "Sign agreement"

#### Filter 3: Cosine Similarity

**Calculation** (`#computeCosineSimilarity`):

```javascript
// Standard cosine similarity over ALL axes (union)
const allAxes = new Set([...Object.keys(weightsA), ...Object.keys(weightsB)]);

let dotProduct = 0, normASq = 0, normBSq = 0;
for (const axis of allAxes) {
    const a = weightsA[axis] ?? 0;
    const b = weightsB[axis] ?? 0;
    dotProduct += a * b;
    normASq += a * a;
    normBSq += b * b;
}

return dotProduct / (Math.sqrt(normASq) * Math.sqrt(normBSq));
```

**Threshold**: `candidateMinCosineSimilarity = 0.85`

**Rejection Reason in UI**: "Cosine sim"

### Multi-Route Filtering (V2.1+)

When `enableMultiRouteFiltering = true`, pairs rejected by Route A can still qualify via:

- **Route B**: Gate-based similarity (interval overlap analysis)
- **Route C**: Behavioral prescan (quick Monte Carlo with 500 samples)

---

## Stage B: Behavioral Evaluation

### V3 Mode: Vector-Based (`#evaluateViaVectors`)

When pre-computed vectors exist:

```javascript
const agreementMetrics = this.#agreementMetricsCalculator.calculate(vectorA, vectorB);
```

### V2 Mode: Monte Carlo Sampling

Samples 8000 random contexts per pair.

### Gate Overlap Calculation

**Raw Counts**:
```javascript
if (passA || passB) onEitherCount++;
if (passA && passB) onBothCount++;
if (passA && !passB) pOnlyCount++;
if (passB && !passA) qOnlyCount++;
```

**Derived Metrics**:
```javascript
gateOverlap = {
    onEitherRate: onEitherCount / sampleCount,
    onBothRate: onBothCount / sampleCount,
    pOnlyRate: pOnlyCount / sampleCount,
    qOnlyRate: qOnlyCount / sampleCount,
}

// KEY METRIC: gateOverlapRatio (used in classification)
gateOverlapRatio = onBothRate / onEitherRate;  // Range [0, 1]
```

### Correlation Calculation (Pearson)

**Co-pass Correlation** (`#computePearsonCorrelation`):
```javascript
// Only computed when BOTH prototypes pass their gates
// Correlation of intensity values

const meanX = sumX / n;
const meanY = sumY / n;

// Covariance and standard deviations
let cov = 0, varX = 0, varY = 0;
for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
}

return cov / (Math.sqrt(varX) * Math.sqrt(varY));  // Clamped to [-1, 1]
```

**Global Correlation**: Same formula but over ALL samples (including 0 outputs when gates fail).

### Gate Implication Evaluation

Evaluates logical implication between gate constraints.

**Process** (`GateImplicationEvaluator.evaluate`):

```javascript
for (const axis of allAxes) {
    const A_subset_B = this.#isSubset(intervalA, intervalB);
    const B_subset_A = this.#isSubset(intervalB, intervalA);

    if (!A_subset_B) A_implies_B = false;
    if (!B_subset_A) B_implies_A = false;
}
```

**Relation Determination**:
```javascript
if (A_implies_B && B_implies_A) return 'equal';
if (A_implies_B && !B_implies_A) return 'narrower';  // A ⊂ B
if (!A_implies_B && B_implies_A) return 'wider';     // A ⊃ B
if (checkDisjoint(evidence)) return 'disjoint';
return 'overlapping';
```

**Subset Check** (`#isSubset`):
```javascript
// A ⊆ B if A's interval fits entirely within B's interval
const lowerOk = intervalA.lower >= intervalB.lower;
const upperOk = intervalA.upper <= intervalB.upper;
return lowerOk && upperOk;
```

---

## Stage C: Classification Logic

### Classification Priority Order

```javascript
const CLASSIFICATION_PRIORITY = [
    'merge_recommended',
    'subsumed_recommended',
    'convert_to_expression',
    'nested_siblings',
    'needs_separation',
    'keep_distinct',  // Fallback
];
```

**Important**: First match wins. Later classifications are checked via `#evaluateAllClassifications` for multi-label reporting.

### V3 Classification Logic (`classifyV3`)

Uses agreement metrics and profiles computed from shared context pool.

#### MERGE_RECOMMENDED (V3)

**Location**: `#checkMergeRecommendedV3`

```javascript
// Criteria (ALL must be true):
// 1. Neither prototype is dead (has some activation)
// 2. maeGlobal <= maxMaeGlobalForMerge (0.08)
// 3. activationJaccard >= minActivationJaccardForMerge (0.85)
// 4. Symmetric conditional probs: |pA_given_B - pB_given_A| < symmetryTolerance (0.05)

if (this.#isDead(profileA) || this.#isDead(profileB)) return false;
if (maeGlobal > thresholds.maxMaeGlobalForMerge) return false;
if (activationJaccard < thresholds.minActivationJaccardForMerge) return false;
if (Math.abs(pA_given_B - pB_given_A) >= thresholds.symmetryTolerance) return false;
```

#### SUBSUMED_RECOMMENDED (V3)

**Location**: `#checkSubsumedRecommendedV3`

```javascript
// A is subsumed by B if:
// 1. pB_given_A_lower >= minConditionalProbCILowerForNesting (0.9)  [CI lower bound]
// 2. pA_given_B < 1 - asymmetryRequired (0.9)  [not reciprocal]
// 3. gateVolumeA < gateVolumeB  [A is narrower]
// 4. exclusiveA <= maxExclusiveForSubsumption (0.05)  [A rarely fires alone]

const aSubsumedByB =
    pBgivenALower >= minCILower &&
    pAgivenB < 1 - asymmetryRequired &&
    gateVolumeA < gateVolumeB &&
    exclusiveA <= maxExclusive;
```

**Note**: `exclusiveA = 1 - pB_given_A` (approximation)

#### CONVERT_TO_EXPRESSION (V3)

**Location**: `#checkConvertToExpressionV3`

```javascript
// Feature flag required
if (!this.#config.enableConvertToExpression) return false;

// Criteria:
// 1. Has nesting (at least one direction)
// 2. Narrower prototype is an "expression candidate" (low volume, low novelty, single-axis focused)
// 3. maeCoPass <= maxMaeDeltaForExpression (0.05)

if (!aImpliesB && !bImpliesA) return false;
if (!narrowerProfile?.isExpressionCandidate) return false;
if (maeCoPass > maxMaeDelta) return false;
```

**Expression Candidate** (`PrototypeProfileCalculator.calculateSingle`):
```javascript
const isExpressionCandidate =
    gateVolume < lowVolumeThreshold (0.05) &&
    deltaFromNearestCenter < lowNoveltyThreshold (0.15) &&
    weightConcentration > singleAxisFocusThreshold (0.6);
```

#### NESTED_SIBLINGS (V3)

**Location**: `#checkNestedSiblingsV3`

```javascript
// Check for nesting via CI lower bounds
const aImpliesB = pBgivenALower >= minCILower;  // 0.9
const bImpliesA = pAgivenBLower >= minCILower;

// Must have at least one direction of nesting
if (!aImpliesB && !bImpliesA) return false;

// Must have asymmetry (not both directions equally)
if (pA_given_B === pB_given_A) return false;

// Determine narrower prototype
if (aImpliesB && !bImpliesA) narrowerPrototype = 'a';
else if (bImpliesA && !aImpliesB) narrowerPrototype = 'b';
else narrowerPrototype = pB_given_A > pA_given_B ? 'a' : 'b';  // Higher cond prob = narrower
```

#### NEEDS_SEPARATION (V3)

**Location**: `#checkNeedsSeparationV3`

```javascript
// Criteria:
// 1. activationJaccard >= 0.7 (significant overlap)
// 2. NOT nested (neither CI lower bound >= threshold)
// 3. maeCoPass > maxMaeDeltaForExpression (different outputs when both fire)

if (activationJaccard < 0.7) return false;

const hasNesting = pBgivenALower >= minCILower || pAgivenBLower >= minCILower;
if (hasNesting) return false;

if (maeCoPass <= maxMaeDeltaForExpression) return false;
```

### V2 Classification Logic (`classify`)

#### MERGE_RECOMMENDED (V2)

**Location**: `#checkMergeCriteria`

```javascript
// 1. Filter dead prototypes
if (onEitherRate < minOnEitherRateForMerge) return false;  // 0.05

// 2. High gate overlap ratio
if (gateOverlapRatio < minGateOverlapRatio) return false;  // 0.9

// 3. High correlation (effective, handles source selection)
if (effectiveCorrelation < correlationThreshold) return false;  // 0.98 co-pass, 0.9 global

// 4. Low global mean absolute difference
if (globalMeanAbsDiff > maxGlobalMeanAbsDiffForMerge) return false;  // 0.15

// 5. Low co-pass mean absolute difference
if (meanAbsDiff > maxMeanAbsDiffForMerge) return false;  // 0.03

// 6. Neither prototype dominates
if (dominanceP >= minDominanceForSubsumption || dominanceQ >= minDominanceForSubsumption) return false;
```

#### SUBSUMED_RECOMMENDED (V2)

**Location**: `#checkSubsumedCriteria`

```javascript
// A is subsumed if:
// 1. High correlation
// 2. pOnlyRate <= maxExclusiveRateForSubsumption (0.01)  [A rarely fires alone]
// 3. dominanceQ >= minDominanceForSubsumption (0.95)  [B always has higher intensity]

const aIsSubsumed =
    pOnlyRate <= maxExclusiveRateForSubsumption &&
    dominanceQ >= minDominanceForSubsumption;
```

#### NESTED_SIBLINGS (V2)

**Location**: `#checkNestedSiblings`

```javascript
// Priority 1: Deterministic nesting via gate implication (parseStatus = 'complete')
if (gateImplication && !gateImplication.isVacuous && A_implies_B !== B_implies_A) {
    return { matches: true, narrower: A_implies_B ? 'a' : 'b' };
}

// Priority 2: Behavioral nesting via conditional probabilities
const threshold = nestedConditionalThreshold;  // 0.97
const aImpliesB = pB_given_A >= threshold && pA_given_B < threshold;
const bImpliesA = pA_given_B >= threshold && pB_given_A < threshold;
```

#### NEEDS_SEPARATION (V2)

**Location**: `#checkNeedsSeparation`

```javascript
// 1. gateOverlapRatio >= 0.70
// 2. NOT nested (pB_given_A < 0.97 && pA_given_B < 0.97)
// 3. pearsonCorrelation >= 0.80
// 4. meanAbsDiff > maxMeanAbsDiffForMerge (0.03) [similar but not identical]
```

---

## Metric Calculations

### Activation Jaccard (V3)

```javascript
activationJaccard = coPassCount / onEitherCount;
// J(A,B) = |A ∩ B| / |A ∪ B| where A and B are activation sets
```

### Conditional Probabilities

```javascript
pA_given_B = coPassCount / passBCount;  // P(A fires | B fires)
pB_given_A = coPassCount / passACount;  // P(B fires | A fires)

// Wilson Confidence Interval (V3)
const pAInterval = wilsonInterval(coPassCount, passBCount, zScore);
// Lower bound used for high-confidence nesting detection
```

### Wilson Interval

```javascript
function wilsonInterval(successes, trials, z = 1.96) {
    const p = successes / trials;
    const denom = 1 + (z * z) / trials;
    const center = (p + (z * z) / (2 * trials)) / denom;
    const margin = (z / denom) * Math.sqrt(
        (p * (1 - p)) / trials + (z * z) / (4 * trials * trials)
    );
    return {
        lower: Math.max(0, center - margin),
        upper: Math.min(1, center + margin),
    };
}
```

### Mean Absolute Error (MAE)

```javascript
// Co-pass MAE (only when both gates pass)
maeCoPass = sum(|intensityA[i] - intensityB[i]|) / coPassCount;

// Global MAE (all samples, 0 when gate fails)
maeGlobal = sum(|outA[i] - outB[i]|) / sampleCount;
```

### Composite Score

Used to identify the "closest pair" for summary insights:

```javascript
compositeScore =
    gateOverlapRatio * wGate (0.3) +
    ((correlation + 1) / 2) * wCorr (0.2) +
    (1 - globalMeanAbsDiff) * wDiff (0.5);
```

---

## V3 vs V2 Mode Differences

| Aspect | V2 Mode | V3 Mode |
|--------|---------|---------|
| **Sampling** | Monte Carlo per pair (8000 samples) | Shared context pool (50,000 samples) |
| **Complexity** | O(pairs × samples) | O(prototypes × pool) setup + O(pairs) vector ops |
| **Correlation** | Computed per pair during sampling | Pre-computed in AgreementMetricsCalculator |
| **Confidence Intervals** | Not used | Wilson CI for conditional probabilities |
| **Prototype Profiles** | Not available | gateVolume, weightEntropy, isExpressionCandidate |
| **Classification** | `classify()` method | `classifyV3()` method |
| **Thresholds** | Based on raw probabilities | Based on CI lower bounds |

### V3 Mode Detection

```javascript
const isV3Mode =
    this.#sharedContextPoolGenerator &&
    this.#prototypeVectorEvaluator &&
    this.#prototypeProfileCalculator;
```

---

## Potential Issues and Concerns

### 1. **Candidate Filtering Potential False Negatives**

**Issue**: Route A filtering uses strict thresholds:
- `candidateMinCosineSimilarity = 0.85`
- `candidateMinSignAgreement = 0.8`

**Concern**: Prototypes with different weight magnitudes but same directional behavior could be rejected. Example: `{valence: 0.9, arousal: 0.1}` vs `{valence: 0.3, arousal: 0.03}` have same direction but different cosine due to magnitude.

**Mitigation**: Multi-route filtering (Routes B, C) exists but may not catch all cases.

### 2. **Soft Sign Threshold Arbitrary Choice**

**Issue**: `softSignThreshold = 0.15` treats weights in [-0.15, 0.15] as "neutral" (sign 0).

**Concern**: This is an arbitrary cutoff. A weight of 0.14 is treated as "no opinion" while 0.16 is treated as "positive". This discontinuity could cause edge-case misclassifications.

### 3. **V3 Subsumption `exclusiveA` Approximation**

**Code**:
```javascript
const exclusiveA = Number.isFinite(pB_given_A) ? 1 - pB_given_A : 1;
```

**Concern**: This approximates "exclusive rate" but doesn't account for samples where neither fires. True exclusive rate should be `pOnlyRate / passARate`, not `1 - conditionalProb`.

### 4. **Classification Priority Order Effects**

**Issue**: First-match-wins means CONVERT_TO_EXPRESSION (priority 3) cannot fire if SUBSUMED_RECOMMENDED (priority 2) fires first.

**Concern**: A truly "expression-like" prototype might get classified as SUBSUMED if it also meets subsumption criteria. The `#evaluateAllClassifications` method mitigates this for reporting but not for primary classification.

### 5. **Wilson CI Bootstrap Assumption**

**Issue**: Wilson interval assumes binomial distribution.

**Concern**: Conditional probabilities derived from Monte Carlo sampling may have autocorrelation or non-independence that violates this assumption.

### 6. **Gate Implication `isVacuous` Handling**

**Code**: Vacuous results (empty sets) return special handling.

**Concern**: A prototype with unsatisfiable gates (e.g., `valence > 0.5 AND valence < 0.3`) will "vacuously imply" everything. This could lead to false nesting classifications.

### 7. **minPassSamplesForConditional Guard**

**Code**:
```javascript
const minPassForConditional = this.#config.minPassSamplesForConditional ?? 200;
pA_given_B = passBCount >= minPassForConditional ? ... : NaN;
```

**Concern**: If a prototype has 199 pass samples (just under threshold), conditional probability becomes NaN and nesting detection fails. This cliff edge could cause inconsistent classifications for similar prototypes.

### 8. **Composite Score Weight Normalization**

**Code**:
```javascript
// Fallback when globalMeanAbsDiff is NaN
const totalFallbackWeight = wGate + wCorr;
return gateOverlapRatio * (wGate / total) + normalizedCorr * (wCorr / total);
```

**Concern**: Missing the primary signal (globalMeanAbsDiff @ 50% weight) dramatically changes the composite score interpretation. Fallback may not be comparable to full composite.

### 9. **Deterministic Nesting vs Behavioral Nesting Conflict**

In V2 `#checkNestedSiblings`:
```javascript
// Priority 1: Deterministic nesting
if (hasDeterministicNesting) return { matches: true, narrower: ... };

// Priority 2: Behavioral nesting
// Only checked if deterministic nesting not found
```

**Concern**: Deterministic nesting from gate implication might disagree with behavioral conditional probabilities. The code trusts deterministic over behavioral without reconciliation.

### 10. **V3 NEEDS_SEPARATION Hardcoded Threshold**

```javascript
if (activationJaccard < 0.7) return { matches: false };  // Hardcoded!
```

**Concern**: Unlike other V3 thresholds sourced from config, this 0.7 is hardcoded. Inconsistent with the config-driven design pattern.

---

## Configuration Reference

### Stage A Thresholds

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `activeAxisEpsilon` | 0.08 | Min |weight| to consider axis "active" |
| `candidateMinActiveAxisOverlap` | 0.6 | Jaccard threshold for active axis sets |
| `candidateMinSignAgreement` | 0.8 | Sign agreement threshold for shared axes |
| `candidateMinCosineSimilarity` | 0.85 | Cosine similarity threshold for weight vectors |
| `softSignThreshold` | 0.15 | Weights < this treated as neutral (sign 0) |

### Stage B Configuration

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `sampleCountPerPair` | 8000 | V2: Random contexts per candidate pair |
| `sharedPoolSize` | 50000 | V3: Total contexts in shared pool |
| `minCoPassSamples` | 200 | Min co-pass for valid correlation |
| `minPassSamplesForConditional` | 200 | Min pass for valid conditional probability |

### V3 Classification Thresholds

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `maxMaeGlobalForMerge` | 0.08 | Max global MAE for MERGE |
| `minActivationJaccardForMerge` | 0.85 | Min activation Jaccard for MERGE |
| `symmetryTolerance` | 0.05 | Max |pA_given_B - pB_given_A| for MERGE |
| `minConditionalProbCILowerForNesting` | 0.9 | Min CI lower bound for SUBSUMED/NESTED |
| `asymmetryRequired` | 0.1 | Required asymmetry for SUBSUMED |
| `maxExclusiveForSubsumption` | 0.05 | Max exclusive rate for SUBSUMED |
| `maxMaeDeltaForExpression` | 0.05 | Max MAE delta for CONVERT_TO_EXPRESSION |
| `lowVolumeThreshold` | 0.05 | Max activation rate for expression candidate |
| `lowNoveltyThreshold` | 0.15 | Max delta from cluster for expression candidate |
| `singleAxisFocusThreshold` | 0.6 | Min weight concentration for expression candidate |

### V2 Classification Thresholds

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `minOnEitherRateForMerge` | 0.05 | Filter dead prototypes |
| `minGateOverlapRatio` | 0.9 | Min gate overlap ratio for MERGE |
| `minCorrelationForMerge` | 0.98 | Min Pearson correlation for MERGE |
| `maxMeanAbsDiffForMerge` | 0.03 | Max mean abs diff for MERGE |
| `maxExclusiveRateForSubsumption` | 0.01 | Max pOnly/qOnly rate for SUBSUMED |
| `minDominanceForSubsumption` | 0.95 | Min dominance for SUBSUMED |
| `nestedConditionalThreshold` | 0.97 | pA_given_B threshold for NESTED |

### Composite Score Weights

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `compositeScoreGateOverlapWeight` | 0.3 | Weight for gate overlap in composite |
| `compositeScoreCorrelationWeight` | 0.2 | Weight for normalized correlation |
| `compositeScoreGlobalDiffWeight` | 0.5 | Weight for (1 - globalMeanAbsDiff) |

---

## Summary for Deep Research

This document provides the complete technical specification of the V3 Prototype Analysis System. Key areas for bug investigation:

1. **Edge cases in threshold logic** (cliff edges, NaN handling)
2. **Consistency between V2 and V3 classifications** for same data
3. **Correctness of mathematical approximations** (exclusive rate, Wilson CI)
4. **Completeness of multi-route filtering** (false negatives)
5. **Priority order effects** on multi-label scenarios
6. **Hardcoded vs configurable thresholds** inconsistencies
7. **Vacuous truth handling** in gate implication

Feed this to a deep research system to identify bugs, inconsistencies, or opportunities for algorithm improvements.
