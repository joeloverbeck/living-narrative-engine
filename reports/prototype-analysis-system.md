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
10. [PCA Analysis Methodology](#pca-analysis-methodology)
11. [ChatGPT Suggestion Assessment (A1-A5)](#chatgpt-suggestion-assessment-a1-a5)
12. [ChatGPT Suggestion Assessment (B1-B3)](#chatgpt-suggestion-assessment-b1-b3)
13. [ChatGPT Confidence Scoring Assessment (D1-D2)](#chatgpt-confidence-scoring-assessment-d1-d2)

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

## PCA Analysis Methodology

### Overview

The axis gap detection system runs Principal Component Analysis (PCA) on prototype weight matrices to identify whether the current set of mood/emotion axes adequately spans the behavioral space. PCA runs **per prototype family** (selected via the UI dropdown), not across all prototypes simultaneously.

### Sparse Axis Filtering

Before PCA, axes with very low usage across prototypes are filtered out based on `pcaMinAxisUsageRatio` (default: 0.1). This prevents near-zero-variance columns from inflating the dimensionality without contributing meaningful signal.

### Broken-Stick Null Hypothesis

The system uses the **broken-stick model** to determine which PCA components are statistically significant:

- **Formula**: `Expected(k) = (1/p) * SUM(j=k..p) 1/j` where `p` = number of axes
- A component is "significant" if its explained variance exceeds the broken-stick threshold for that rank
- `significantBeyondExpected = max(0, significantCount - K)` where K = number of existing axes
- When `significantBeyondExpected = 0`, this means the PCA found **fewer** significant dimensions than expected — it does **not** mean PCA found nothing

### Two-Pass PCA Comparison

When sparse axes are excluded, the system runs a **two-pass comparison**:

1. **Dense pass**: PCA on the filtered (dense) matrix — this is the primary analysis
2. **Full pass**: PCA on the unfiltered matrix including sparse axes
3. **Delta metrics**: `deltaSignificant`, `deltaResidualVariance`, `deltaRMSE`

The comparison section ("Sparse Filtering Impact") in the UI shows whether sparse filtering materially changed PCA conclusions. A "material change" threshold is `deltaSignificant >= 1` or `|deltaResidualVariance| >= 0.02`.

### Corroboration Mode

When `pcaRequireCorroboration = true` (default), PCA signals **alone** cannot trigger HIGH-priority recommendations. PCA findings must be corroborated by at least one other signal type (hub detection, coverage gaps, or multi-axis conflicts) before escalating to HIGH priority.

The corroboration status is displayed in the axis gap results section of the UI.

### UI Scope Display

Each PCA results section shows an "Analysis scope" note indicating the number of prototypes and axes included in the analysis. This clarifies that PCA runs per-family, not globally.

---

## ChatGPT Suggestion Assessment (A1-A5)

External review by ChatGPT (January 2026) produced five suggestions for PCA improvements. Assessment and actions taken:

| ID | Suggestion | Verdict | Action Taken |
|----|-----------|---------|-------------|
| A1 | Split PCA by family | Already implemented — `analyze()` runs per-family via UI selector | Added UI scope note showing prototype/axis counts |
| A2 | Two-pass PCA (dense + full) | Partially valid — comparison shows sparse filtering impact | Implemented `analyzeWithComparison()` and UI rendering |
| A3 | Leave-one-axis-in counterfactual | Over-engineered — `excludedAxisReliance` + `residualEigenvector` already surface this | Skipped |
| A4 | Broken-stick formula display | Valid — UI showed counts without explaining the math | Added methodology note with formula explanation |
| A5 | Residual alone shouldn't trigger INVESTIGATE | Already implemented via `pcaRequireCorroboration = true` | Added corroboration status display in UI |

### Files Modified

- `src/expressionDiagnostics/services/axisGap/PCAAnalysisService.js` — Added `analyzeWithComparison()` method
- `src/expressionDiagnostics/services/axisGap/AxisGapReportSynthesizer.js` — Pass through comparison data, corroboration flag, prototype count
- `src/expressionDiagnostics/services/AxisGapAnalyzer.js` — Orchestrate two-pass comparison when sparse axes excluded
- `src/domUI/prototype-analysis/renderers/PCAResultsRenderer.js` — Render methodology note, scope note, sparse filtering comparison
- `src/domUI/prototype-analysis/renderers/AxisGapRenderer.js` — Render corroboration status note
- `src/domUI/prototype-analysis/PrototypeAnalysisController.js` — Wire new DOM elements for scope and corroboration display

---

## ChatGPT Suggestion Assessment (B1-B3)

External review by ChatGPT (January 2026) produced three suggestions for axis polarity analysis improvements. Assessment and actions taken:

| ID | Suggestion | Verdict | Action Taken |
|----|-----------|---------|-------------|
| B1 | Add axis metadata (polarity, symmetry, weight_sign_expectation) | Partially valid — full metadata system is over-engineered; leveraged existing `getAxisCategory()` to distinguish unipolar vs bipolar axes | Added `expectedImbalance` field to imbalanced axis entries |
| B2 | Fix wording: says "values" when it means "weights" | Confirmed bug — both analyzer and renderer said "values" when analyzing prototype weight sign distribution | Changed "values" → "weights" in warning messages and UI hint text |
| B3 | Reclassify polarity imbalance: not always "Actionable" | Valid improvement — positive-weight bias on unipolar axes (affect traits, sexual axes) is expected behavior | Badge now shows "Informational" when all imbalances are expected; per-axis hint explains expected bias |

### B3 Follow-Up: Contradictory Warning Text Fix

**Date**: 2026-01-26

The B3 implementation correctly added `expectedImbalance` logic and per-axis hint branching in `AxisGapRenderer`, but the `warnings[]` array in `AxisPolarityAnalyzer` still unconditionally appended both "Consider adding prototypes with [opposite] weights" and "(expected for unipolar axis)" to the same warning string. This produced contradictory text: a recommendation to act alongside an acknowledgment that no action is needed.

**Fix**: Replaced unconditional warning construction with a conditional branch:
- **When `expectedImbalance === true`**: Informational text only — `"Positive weight bias is expected for this unipolar axis."` — no "Consider adding" recommendation.
- **When `expectedImbalance === false`**: Actionable recommendation only — `"Consider adding prototypes with [opposite] weights."` — no "expected" suffix.

**Files modified**:
- `src/expressionDiagnostics/services/axisGap/AxisPolarityAnalyzer.js` — branched warning text on `expectedImbalance`
- `tests/unit/expressionDiagnostics/services/axisGap/AxisPolarityAnalyzer.test.js` — updated 1 test, added 2 new tests (bipolar recommendation, no-contradiction invariant)

### Key Insight

ChatGPT conflated axis **value ranges** (runtime state: 0-100 for unipolar axes) with prototype **weight signs** (design-time coefficients: -1.0 to +1.0). Negative weights on unipolar axes ARE valid — they mean "this emotion anti-correlates with this axis." However, a **positive-bias** in weight signs IS expected for unipolar axes because most emotions correlate positively with traits like empathy, arousal, etc.

### Files Modified

- `src/expressionDiagnostics/services/axisGap/AxisPolarityAnalyzer.js` — Added `getAxisCategory` import, `expectedImbalance` field, fixed "values" → "weights"
- `src/domUI/prototype-analysis/renderers/AxisGapRenderer.js` — Fixed "values" → "weights", conditional badge/hint logic
- `tests/unit/expressionDiagnostics/services/axisGap/AxisPolarityAnalyzer.test.js` — Added 5 axis category awareness tests, updated field expectation
- `tests/unit/domUI/prototype-analysis/renderers/AxisGapRenderer.test.js` — Added 3 badge/hint tests

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

---

## ChatGPT Suggestion Assessment (C1/C2)

**Date**: 2026-01-26

### C1: Split "unused axis" into 3 categories — IMPLEMENTED (partial)

ChatGPT suggested splitting the flat `unusedDefinedAxes` list into three categories. The confusion arose because ChatGPT did not understand that PCA analysis is per-family (e.g., `sex_excitation` appearing unused in the emotion family is correct behavior, not a bug).

However, the UI improvement was valid: users could not distinguish gate-only axes from truly unused ones.

**Implemented**: Partitioned `unusedDefinedAxes` into two sub-arrays:
- `unusedDefinedUsedInGates` — axes not in weights but referenced in gate conditions (informational)
- `unusedDefinedNotInGates` — axes not in weights AND not in gates (actionable warning)

The original `unusedDefinedAxes` array is preserved for backward compatibility.

**Files modified**:
- `PCAAnalysisService.js` — partition logic after gate extraction
- `AxisGapReportSynthesizer.js` — forwards new arrays through report pipeline
- `PCAResultsRenderer.js` — renders two sub-groups with distinct styling; falls back to flat list when sub-arrays are absent

### C2: Add `expected_usage` metadata — REJECTED

Over-engineered. The metadata does not exist anywhere in the codebase, would require schema changes, validation logic, and ongoing maintenance. The C1 partition achieves the same noise reduction without new metadata.

---

## ChatGPT Confidence Scoring Assessment (D1-D2)

**Date**: 2026-01-26

External review suggested changes to the confidence scoring system. Each claim was assessed against the actual implementation.

### D1: Replace count-based confidence with weighted scoring — REJECTED

**Claim**: Replace `confidence = count(methods)` with `score = w_pca * pca_signal_strength + w_gaps * gap_strength + ...`

**Finding**: The confidence metric intentionally measures **epistemic confidence** (how many independent detection methods agree), not signal strength. The system already has:
- **PCA corroboration logic** (`pcaRequireCorroboration`): PCA only triggers with `additionalSignificantComponents > 0` OR high residual + other signals present
- **Family deduplication** (`REASON_TO_FAMILY_MAP`): Prevents correlated signals (e.g., `high_reconstruction_error` and `extreme_projection` both map to `pca` family) from inflating confidence
- **Boost mechanism**: If any prototype has 3+ distinct method families flagging it, confidence can be boosted

Weighted scoring would conflate signal magnitude with epistemic reliability. No changes made.

### D2: Expose component scores — IMPLEMENTED

**Claim**: Users should see which methods contributed to the confidence level.

**Finding**: Valid improvement. Users previously saw "Confidence: medium" with a static explanation but no connection to which specific methods triggered.

**Implemented**:
- `AxisGapReportSynthesizer.synthesize()` now returns `methodsTriggered` (array of family names) and `confidenceBoosted` (boolean) in the summary
- `AxisGapRenderer.renderConfidenceExplanation()` renders dynamic text: which methods triggered, whether boost was applied, and the resulting confidence level
- Signal-to-confidence linking note added below the signal grid
- Enhanced corroboration status note explains the mechanism when ON
- Updated confidence tooltip with boost information

**Files modified**:
- `AxisGapReportSynthesizer.js` — `#countTriggeredMethods()` returns `{ count, families }`, `#computeConfidenceLevel()` returns `{ level, baseLevel, boosted }`, `synthesize()` and `buildEmptyReport()` expose new fields
- `prototype-analysis.html` — dynamic confidence explanation element, signal-confidence link, updated tooltip
- `AxisGapRenderer.js` — new `renderConfidenceExplanation()` method, enhanced corroboration note
- `PrototypeAnalysisController.js` — wires new DOM elements and calls new renderer method

### D-Inv1: Count-to-confidence monotonicity — Regression test added

**Claim**: Confidence must be monotonic with signal strength.

**Reframed**: More triggered methods should yield same or higher confidence. Added regression test that synthesizes reports with 0, 1, 2, 3, 4 triggered methods and asserts non-decreasing confidence levels.

### D-Inv2: Residual-only cap — Already implemented

**Claim**: If only residual variance triggers but broken-stick says no extra components, confidence cannot exceed "low".

**Finding**: Already implemented via `pcaRequireCorroboration` (default ON). Explicit invariant test added confirming that high residual alone with corroboration ON yields confidence "low" and empty `methodsTriggered`.

---

## ChatGPT Bug Report Assessment (E1-E2)

**Date**: 2026-01-26

External review by ChatGPT identified two bugs in the prototype analysis system. Both were confirmed.

### E1: Dense-Axis List Concatenation (Rendering Bug) — FIXED

**Claim**: `PCAResultsRenderer.#renderDimensionsList()` joins dimension `<span>` tags with `.join('')`, causing dimension names to merge when text is extracted (copy-paste, markdown export): `affiliationagency_controlarousal...`

**Finding**: Confirmed. The HTML rendering looked correct (CSS padding separated the inline-block spans visually), but `textContent` extraction produced concatenated names with no separator.

**Fix**: Changed `.join('')` to `.join(' ')` on `PCAResultsRenderer.js` line 282. A single space ensures readable text extraction without affecting visual HTML rendering.

**Files modified**:
- `src/domUI/prototype-analysis/renderers/PCAResultsRenderer.js` — `.join('')` → `.join(' ')`
- `tests/unit/domUI/prototype-analysis/renderers/PCAResultsRenderer.test.js` — added text separation test

### E2: Contradictory Unipolar Axis Warnings (Logic Bug) — FIXED

See [B3 Follow-Up](#b3-follow-up-contradictory-warning-text-fix) above.
