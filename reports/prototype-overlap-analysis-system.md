# Prototype Overlap Analysis System — Technical Reference

> **Purpose**: Comprehensive documentation of all calculations, methodologies, and algorithms
> used in the "Analysis Results" section of `prototype-analysis.html`.
> Intended audience: an LLM reviewer tasked with finding bugs and suggesting improvements.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Data Model](#2-data-model)
3. [Stage A: Candidate Pair Filtering](#3-stage-a-candidate-pair-filtering)
4. [Stage B: Behavioral Overlap Evaluation](#4-stage-b-behavioral-overlap-evaluation)
5. [Stage C: Classification](#5-stage-c-classification)
6. [Recommendation Building](#6-recommendation-building)
7. [Composite Score & Metadata](#7-composite-score--metadata)
8. [Configuration Reference](#8-configuration-reference)
9. [Known Design Decisions & Rationale](#9-known-design-decisions--rationale)

---

## 1. Executive Summary

### System Purpose

The Prototype Overlap Analysis system detects **redundancy** and **gaps** among emotion and sexual-state prototypes. Each prototype defines a weight vector over mood/sexual/affect-trait axes plus gate constraints that govern activation. The system answers two questions:

1. **Redundancy**: Are any two prototypes so similar in behavior that they should be merged, one subsumed into the other, or their gate boundaries tightened?
2. **Gap**: Are there regions of the mood–affect–sexual axis space that no prototype covers?

### Pipeline Overview

```
 ┌──────────────────────────────────────────────────────────────────┐
 │                   Prototype Overlap Analyzer                     │
 │            (PrototypeOverlapAnalyzer.js — orchestrator)          │
 └──────────┬───────────────────────────────────────────────────────┘
            │
   ┌────────▼────────┐
   │  V3 Detection   │  Checks if V3 mode is available:
   │  (auto/forced)  │  sharedContextPool != null && agreementCalculator != null
   └────────┬────────┘
            │
 ┌──────────▼──────────────────────────────────────────────────────┐
 │  STAGE A — Candidate Pair Filtering                             │
 │  (CandidatePairFilter.js)                                       │
 │                                                                  │
 │  Route A: Weight-vector similarity (Jaccard → Sign → Cosine)    │
 │  Route B: Gate-interval overlap  (V2.1 multi-route)             │
 │  Route C: Behavioral prescan     (V2.1 multi-route)             │
 │  ──────────────────────────────────────────                      │
 │  Deduplicate → merged candidate set (capped at maxCandidatePairs)│
 └──────────┬──────────────────────────────────────────────────────┘
            │
 ┌──────────▼──────────────────────────────────────────────────────┐
 │  STAGE B — Behavioral Overlap Evaluation                        │
 │  (BehavioralOverlapEvaluator.js + AgreementMetricsCalculator.js)│
 │                                                                  │
 │  V2 mode: Per-pair Monte Carlo (sampleCountPerPair contexts)    │
 │  V3 mode: Shared context pool → vector dot product              │
 │           → AgreementMetricsCalculator single-pass               │
 └──────────┬──────────────────────────────────────────────────────┘
            │
 ┌──────────▼──────────────────────────────────────────────────────┐
 │  STAGE C — Classification                                       │
 │  (OverlapClassifier.js)                                         │
 │                                                                  │
 │  Priority-ordered labels (first match wins):                    │
 │    merge_recommended → subsumed_recommended →                   │
 │    convert_to_expression → nested_siblings →                    │
 │    needs_separation → keep_distinct                             │
 └──────────┬──────────────────────────────────────────────────────┘
            │
 ┌──────────▼──────────────────────────────────────────────────────┐
 │  RECOMMENDATION BUILDING                                        │
 │  (OverlapRecommendationBuilder.js)                              │
 │  + GateBandingSuggestionBuilder.js                              │
 │  + ActionableSuggestionEngine.js (V3 only)                      │
 │                                                                  │
 │  Severity, confidence, evidence, suggestions                    │
 └──────────┬──────────────────────────────────────────────────────┘
            │
 ┌──────────▼──────────────────────────────────────────────────────┐
 │  COMPOSITE SCORE & METADATA                                     │
 │  (PrototypeOverlapAnalyzer.js — assembly)                       │
 │                                                                  │
 │  compositeScore, sorting, metadata, summary insight             │
 └─────────────────────────────────────────────────────────────────┘
```

### Key Outputs

| Output | Description |
|--------|-------------|
| `recommendations` | Sorted array of pair-wise overlap assessments |
| `nearMisses` | Pairs that almost qualified for overlap classification |
| `metadata` | Filtering stats, classification breakdown, summary insight |
| `compositeScore` (per pair) | Weighted aggregate of gate overlap, correlation, and global diff |

---

## 2. Data Model

### 2.1 Prototype Structure

Each prototype (emotion or sexual state) is a JSON entry in a lookup file:

```json
{
  "prototypeName": {
    "weights": {
      "valence": 0.6,
      "arousal": -0.3,
      "affective_empathy": 0.2
    },
    "gates": [
      "valence >= 0.35",
      "arousal <= -0.10"
    ],
    "intensity_formula": "...",
    "description": "..."
  }
}
```

- **`weights`**: A sparse vector of axis-name → real-number pairs. An axis is "active" if `|weight| >= activeAxisEpsilon` (default `0.08`).
- **`gates`**: An array of constraint strings. ALL gates must pass for the prototype to activate.
- **`intensity_formula`**: Expression evaluated to produce activation intensity (0–1) when gates pass.

> Source: `data/mods/core/lookups/emotion_prototypes.lookup.json`, `sexual_prototypes.lookup.json`

### 2.2 Axis Definitions

Three categories of axes exist, defined in `src/constants/prototypeAxisConstants.js` and `src/constants/moodAffectConstants.js`:

| Category | Axes | Raw Range | Normalized Range |
|----------|------|-----------|------------------|
| **Mood** | `valence`, `arousal`, `dominance`, `novelty`, `safety`, `sociality`, `identity`, `fairness`, `freedom` | [-100, 100] | [-1, 1] |
| **Affect Trait** | `affective_empathy`, `cognitive_empathy`, `harm_aversion`, `self_control` | [0, 100] | [0, 1] |
| **Sexual** | `sexual_arousal`, `sex_excitation`, `sex_inhibition`, `baseline_libido` | varies | [0, 1] |

**Normalization** (from `axisNormalizationUtils.js`):

- Mood: `normalized = raw / 100` → range [-1, 1]
- Affect trait: `normalized = raw / 100` → range [0, 1]
- Sexual: `sex_excitation`, `sex_inhibition` → `raw / 100` [0, 1]; `baseline_libido` → `(raw + 50) / 100` [0, 1]; `sexual_arousal` → already [0, 1]

> Source: `src/constants/prototypeAxisConstants.js`, `src/expressionDiagnostics/utils/axisNormalizationUtils.js`

### 2.3 Gate Constraint Model

`GateConstraint` (in `src/expressionDiagnostics/models/GateConstraint.js`) parses a gate string:

```
Pattern: /^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d*\.?\d+)$/
```

Valid operators: `>=`, `<=`, `>`, `<`, `==`

**`isSatisfiedBy(axisValue)`**: Evaluates the comparison. For `==`, uses epsilon `0.0001`.

**`violationAmount(axisValue)`**: Returns `0` if satisfied; otherwise:
- For `>=` or `>`: `threshold - axisValue`
- For `<=` or `<`: `axisValue - threshold`
- For `==`: `|axisValue - threshold|`

**`getAxisType()`**: Returns `'mood'`, `'affect_trait'`, `'sexual'`, or `'intensity'` (default).

**`getValidRange()`**: Returns `{min, max}` for the normalized range:
- mood: `{-1, 1}`
- affect_trait / sexual / intensity: `{0, 1}`

> Source: `src/expressionDiagnostics/models/GateConstraint.js`

### 2.4 Context Building

`ContextBuilder` (`src/expressionDiagnostics/services/simulatorCore/ContextBuilder.js`) constructs evaluation contexts from mood and sexual state pairs.

**`buildContext(currentState, previousState, affectTraits, emotionFilter, includeGateTrace)`** returns:

```javascript
{
  mood,                    // currentState.mood (raw mood axes)
  moodAxes,                // alias for mood
  sexualAxes,              // currentState.sexual
  emotions,                // calculated emotion intensities
  sexualStates,            // calculated sexual state intensities
  sexualArousal,           // scalar arousal value
  previousEmotions,        // from previousState
  previousSexualStates,    // from previousState
  previousMoodAxes,        // previousState.mood
  previousSexualAxes,      // previousState.sexual
  previousSexualArousal,   // scalar
  affectTraits,            // provided or default {affective_empathy:50, cognitive_empathy:50, harm_aversion:50, self_control:50}
  gateTrace                // optional trace object for debugging
}
```

**`normalizeGateContext(context, usePrevious)`** extracts and normalizes axes for gate evaluation:

- Selects `moodAxes` or `previousMoodAxes` depending on `usePrevious`
- Applies normalization functions from `axisNormalizationUtils.js`
- Returns `{ moodAxes, sexualAxes, traitAxes }` all in normalized ranges

> Source: `src/expressionDiagnostics/services/simulatorCore/ContextBuilder.js`

### 2.5 Gate Evaluation

`GateEvaluator` (`src/expressionDiagnostics/services/simulatorCore/GateEvaluator.js`) checks whether a context satisfies a prototype's gates. It:

1. Calls `contextBuilder.normalizeGateContext(context, usePrevious)` to get normalized axes
2. For each gate constraint: resolves the axis value from `moodAxes`, `sexualAxes`, or `traitAxes`
3. Calls `GateConstraint.isSatisfiedBy(normalizedValue)` on each gate
4. Returns pass/fail (all gates must pass for the prototype to activate)

---

## 3. Stage A: Candidate Pair Filtering

**File**: `src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js` (689 lines)

Stage A reduces the O(n²) prototype pairs to a manageable candidate set using fast weight-vector heuristics and optional gate/behavioral prescans.

### 3.1 Route A: Weight-Vector Similarity

Three sequential metrics, applied in order with early rejection:

#### 3.1.1 Active Axis Overlap (Jaccard)

```
activeAxes(P) = { axis : |P.weights[axis]| >= activeAxisEpsilon }

jaccard(P, Q) = |activeAxes(P) ∩ activeAxes(Q)| / |activeAxes(P) ∪ activeAxes(Q)|
```

- If both active sets are empty: returns `jaccardEmptySetValue` (default `1.0`)
- **Threshold**: `jaccard >= candidateMinActiveAxisOverlap` (default `0.6`)
- Pairs failing this are rejected immediately.

#### 3.1.2 Sign Agreement

For each axis in `activeAxes(P) ∪ activeAxes(Q)`:

```
softSign(weight) =
  weight > +softSignThreshold  →  +1
  weight < -softSignThreshold  →  -1
  otherwise                    →   0   (neutral — treated as agreeing with anything)
```

- `softSignThreshold` default: `0.15`
- A pair of signs (sA, sB) **agrees** if either is 0 or both have the same sign.

```
signAgreement = countAgreeing / totalAxesInUnion
```

- **Threshold**: `signAgreement >= candidateMinSignAgreement` (default `0.8`)

#### 3.1.3 Cosine Similarity

Computed over the union of active axes:

```
cosine(P, Q) = Σ(P.weights[axis] * Q.weights[axis]) /
               (√Σ(P.weights[axis]²) * √Σ(Q.weights[axis]²))
```

- If either norm is 0, cosine is `0`.
- Only axes in the active union are summed.
- **Threshold**: `cosine >= candidateMinCosineSimilarity` (default `0.85`)

All three checks must pass for Route A to accept a pair.

#### 3.1.4 Strong Axis Definition

An axis is considered "strong" if `|weight| >= strongAxisThreshold` (default `0.25`). This is used in Route B for gate analysis but not directly in Route A.

### 3.2 Route B: Gate-Based Interval Overlap (V2.1)

**Enabled when**: `enableMultiRouteFiltering === true` (default `true`)

For each prototype, the gate constraints define intervals on each gated axis. Route B computes the overlap of these gate intervals.

1. Parse all gates into `AxisInterval` objects
2. For each shared gated axis between P and Q, compute interval overlap ratio
3. Aggregate:

```
gateIntervalOverlap = Σ(overlapLength / maxLength) / numberOfSharedAxes
```

- **Threshold**: `gateIntervalOverlap >= gateBasedMinIntervalOverlap` (default `0.6`)

### 3.3 Route C: Behavioral Prescan (V2.1)

**Enabled when**: `enableMultiRouteFiltering === true`

A quick Monte Carlo prescan with fewer samples:

1. Generate `prescanSampleCount` (default `500`) random contexts
2. Check if both prototypes pass their gates in any of the same contexts
3. Compute a rough gate overlap:

```
prescanGateOverlap = coPassCount / onEitherCount
```

- **Threshold**: `prescanGateOverlap >= prescanMinGateOverlap` (default `0.5`)
- Capped at `maxPrescanPairs` (default `1000`) pairs to limit prescan compute.

### 3.4 Deduplication and Capping

All pairs discovered by Routes A, B, and C are merged with deduplication (pair key = sorted IDs). The final candidate set is capped at `maxCandidatePairs` (default `5000`). If more pairs exist, they are sorted by Route A cosine similarity and the top N are kept.

---

## 4. Stage B: Behavioral Overlap Evaluation

**Files**:
- `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js` (1063 lines)
- `src/expressionDiagnostics/services/prototypeOverlap/AgreementMetricsCalculator.js` (287 lines)

### 4.1 V2 Mode: Per-Pair Monte Carlo

For each candidate pair (P, Q):

1. **Generate** `sampleCountPerPair` (default `8000`) random mood+sexual state pairs
2. **Build context** for each sample using `ContextBuilder.buildContext()`
3. **Evaluate** both prototypes' gates and intensities

#### 4.1.1 Gate Overlap Statistics

```
onEitherCount  = # samples where P passes OR Q passes
onBothCount    = # samples where P passes AND Q passes
pOnlyCount     = # samples where P passes AND Q fails
qOnlyCount     = # samples where Q passes AND P fails

onEitherRate   = onEitherCount / sampleCount
onBothRate     = onBothCount / sampleCount
pOnlyRate      = pOnlyCount / sampleCount
qOnlyRate      = qOnlyCount / sampleCount

gateOverlapRatio = onBothCount / onEitherCount   (0 if onEitherCount == 0)
```

#### 4.1.2 Intensity Metrics (on co-activation samples)

When both gates pass (`onBothCount > 0`):

```
intensityP[]   = P's intensity on each co-pass sample
intensityQ[]   = Q's intensity on each co-pass sample

correlation    = pearson(intensityP, intensityQ)
meanAbsDiff    = mean(|intensityP[i] - intensityQ[i]|)
rmsDiff        = sqrt(mean((intensityP[i] - intensityQ[i])²))

pctWithinEps   = count(|intensityP[i] - intensityQ[i]| <= intensityEps) / onBothCount
                 where intensityEps = 0.05
```

#### 4.1.3 Dominance

```
dominanceP = count(intensityP[i] > intensityQ[i]) / onBothCount
dominanceQ = count(intensityQ[i] > intensityP[i]) / onBothCount
dominanceRatio = max(dominanceP, dominanceQ)
```

A prototype "dominates" if `dominanceP >= minDominanceForSubsumption` (default `0.95`) or `dominanceQ >= minDominanceForSubsumption`.

#### 4.1.4 Global Output Metrics

Computed over ALL samples (not just co-pass):

```
For each sample i:
  outputP[i] = gatePassP[i] ? intensityP[i] : 0
  outputQ[i] = gatePassQ[i] ? intensityQ[i] : 0

globalCorrelation  = pearson(outputP, outputQ)
globalMeanAbsDiff  = mean(|outputP[i] - outputQ[i]|)
```

#### 4.1.5 Conditional Probabilities

```
P(P passes | Q passes) = onBothCount / qPassCount
P(Q passes | P passes) = onBothCount / pPassCount
```

Where `pPassCount = onBothCount + pOnlyCount` and `qPassCount = onBothCount + qOnlyCount`.

#### 4.1.6 Gate Implication Analysis

For each gate of P, check how many Q-pass samples also satisfy it (and vice versa). Reports which gates are "implied" (nearly always satisfied when the other prototype activates).

#### 4.1.7 Divergence Examples

Collect up to `divergenceExamplesK` (default `5`) samples with the highest `|intensityP - intensityQ|` difference. Each example records the mood state and both intensities for human review.

### 4.2 V3 Mode: Shared Context Pool with Vector Evaluation

#### 4.2.1 Pre-computation (Setup Stage)

Before Stage B, the orchestrator pre-computes:

1. **Shared context pool**: `sharedPoolSize` (default `50000`) random contexts
2. **Per-prototype output vectors**: For each prototype, evaluate all pool contexts to produce:

```typescript
PrototypeOutputVector {
  prototypeId: string;
  gateResults: Float32Array;    // 1 if gate passes, 0 if fails
  intensities: Float32Array;    // intensity value (0 if gate fails)
  activationRate: number;       // fraction of contexts where gate passes
  meanIntensity: number;        // mean intensity when activated
  stdIntensity: number;         // std dev of intensity when activated
}
```

Pool size variants:
- Quick analysis: `quickAnalysisPoolSize` (default `15000`)
- Standard: `sharedPoolSize` (default `50000`)
- Deep analysis: `deepAnalysisPoolSize` (default `100000`)

Optional stratified sampling: `enableStratifiedSampling` (default `false`), `stratumCount` (default `5`), `stratificationStrategy` (default `'uniform'`).

#### 4.2.2 Agreement Metrics Calculation

**File**: `src/expressionDiagnostics/services/prototypeOverlap/AgreementMetricsCalculator.js`

For each candidate pair (vectorA, vectorB), a single-pass loop computes:

**Gate pass counts**:
```
passA = gateResultsA[i] > 0
passB = gateResultsB[i] > 0

passACount   = Σ passA
passBCount   = Σ passB
coPassCount  = Σ (passA AND passB)
onEitherCount = Σ (passA OR passB)
```

**Intensity differences (global)**:
```
diff = intensitiesA[i] - intensitiesB[i]

globalSumAbsDiff += |diff|
globalSumSqDiff  += diff²
```

**Intensity differences (co-pass only)**:
```
If passA AND passB:
  coSumAbsDiff += |diff|
  coSumSqDiff  += diff²
```

**Pearson correlation accumulators** (global and co-pass):
```
sumX, sumY, sumXX, sumYY, sumXY         (global)
coSumX, coSumY, coSumXX, coSumYY, coSumXY  (co-pass)
```

**Derived metrics**:

```
maeCoPass        = coSumAbsDiff / coPassCount       (NaN if coPassCount == 0)
rmseCoPass       = sqrt(coSumSqDiff / coPassCount)  (NaN if coPassCount == 0)
maeGlobal        = globalSumAbsDiff / sampleCount    (0 if sampleCount == 0)
rmseGlobal       = sqrt(globalSumSqDiff / sampleCount)

activationJaccard = coPassCount / onEitherCount      (0 if onEitherCount == 0)

pA_given_B       = coPassCount / passBCount           (0 if passBCount == 0)
pB_given_A       = coPassCount / passACount           (0 if passACount == 0)
```

**Wilson confidence intervals**:

```
pA_given_B_interval = wilsonCI(successes=coPassCount, trials=passBCount, z=zScore)
pB_given_A_interval = wilsonCI(successes=coPassCount, trials=passACount, z=zScore)
```

Where `zScore` is looked up from:
```
Z_SCORES = { 0.90: 1.645, 0.95: 1.96, 0.99: 2.576 }
confidenceLevel = 0.95 → zScore = 1.96
```

**Pearson correlation** (computed from accumulated sums):

```
cov  = sumXY - (sumX * sumY) / count
varX = sumXX - (sumX * sumX) / count
varY = sumYY - (sumY * sumY) / count

If count < 2 OR varX <= 0 OR varY <= 0: NaN
Else: correlation = clamp(cov / sqrt(varX * varY), -1, 1)
```

**Correlation reliability**:
```
correlationReliable = coPassCount >= minSamplesForReliableCorrelation  (default 500)
```

#### 4.2.3 V3 → V2 Backward Compatibility Mapping

`BehavioralOverlapEvaluator` maps V3 `AgreementMetrics` to V2-compatible fields:

```javascript
{
  onEitherRate:       onEitherCount / sampleCount,
  onBothRate:         coPassCount / sampleCount,
  pOnlyRate:          (passACount - coPassCount) / sampleCount,
  qOnlyRate:          (passBCount - coPassCount) / sampleCount,
  gateOverlapRatio:   activationJaccard,
  correlation:        pearsonCoPass,
  meanAbsDiff:        maeCoPass,
  globalCorrelation:  pearsonGlobal,
  globalMeanAbsDiff:  maeGlobal,
  // ... additional V3-specific fields
  v3Metrics: { maeCoPass, rmseCoPass, maeGlobal, rmseGlobal, activationJaccard, ... }
}
```

---

## 5. Stage C: Classification

**File**: `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js` (~1500 lines)

### 5.1 Classification Priority

Classifications are evaluated in strict priority order. **First match wins**:

```
CLASSIFICATION_PRIORITY = [
  'merge_recommended',
  'subsumed_recommended',
  'convert_to_expression',
  'nested_siblings',
  'needs_separation',
  'keep_distinct'
]
```

The classifier also records `allMatchingClassifications` (all types whose conditions are met) for diagnostic purposes.

### 5.2 Effective Correlation (V2)

Before V2 classification, the system computes an "effective correlation" using a **5-tier hybrid strategy**:

```
Inputs:
  coPassCorrelation    — Pearson r on co-activation samples
  globalCorrelation    — Pearson r on all samples (output = 0 when gate fails)
  coPassCount          — number of co-pass samples
  coPassRatio          — coPassCount / sampleCount
  minReliableSamples   = coPassSampleConfidenceThreshold (default 500)
  minReliableRatio     = minCoPassRatioForReliable (default 0.1)

hasReliableCoPass = (coPassCount >= minReliableSamples) AND (coPassRatio >= minReliableRatio)
coPassValid       = isFinite(coPassCorrelation)
globalValid       = isFinite(globalCorrelation)
```

| Tier | Condition | Effective Correlation | Source | Confidence |
|------|-----------|----------------------|--------|------------|
| 1 | `hasReliableCoPass` | `coPassCorrelation` | `'co-pass'` | `'high'` |
| 2 | `globalValid && !coPassValid` | `globalCorrelation` | `'global'` | `'medium'` |
| 3 | `globalValid && coPassValid` (not reliable) | `coPass × 0.6 + global × 0.4` | `'combined'` | `'medium'` |
| 4 | `coPassValid` only | `coPassCorrelation` | `'co-pass-sparse'` | `'low'` |
| 5 | neither valid | `NaN` | `'none'` | `'none'` |

Weight constants: `coPassCorrelationWeight = 0.6`, `globalCorrelationWeight = 0.4`.

### 5.3 isDead Check

A prototype is considered "dead" (effectively never activates):

```
isDead(profile) = profile.gateVolume < lowVolumeThreshold

lowVolumeThreshold = 0.05   (i.e., activates in < 5% of sampled contexts)
```

Where `gateVolume` is the activation rate from the output vector.

### 5.4 V3 Classification Conditions

#### 5.4.1 `merge_recommended` (V3)

```
ALL of:
  !isDead(profileA)                                               // A activates >= 5% of contexts
  !isDead(profileB)                                               // B activates >= 5% of contexts
  metrics.maeGlobal <= maxMaeGlobalForMerge                       // 0.08
  metrics.activationJaccard >= minActivationJaccardForMerge       // 0.85
  |metrics.pA_given_B - metrics.pB_given_A| < symmetryTolerance  // 0.05
```

#### 5.4.2 `subsumed_recommended` (V3)

Two directions are checked. **A subsumed by B**:

```
metrics.pB_given_A_lower >= minConditionalProbCILowerForNesting   // 0.9
metrics.pA_given_B < (1 - asymmetryRequired)                     // < 0.9
profileA.gateVolume < profileB.gateVolume                        // A is narrower
exclusiveA <= maxExclusiveForSubsumption                          // 0.05

where exclusiveA = 1 - metrics.pB_given_A
```

**B subsumed by A** (symmetric):

```
metrics.pA_given_B_lower >= minConditionalProbCILowerForNesting   // 0.9
metrics.pB_given_A < (1 - asymmetryRequired)                     // < 0.9
profileB.gateVolume < profileA.gateVolume                        // B is narrower
exclusiveB <= maxExclusiveForSubsumption                          // 0.05

where exclusiveB = 1 - metrics.pA_given_B
```

Returns the subsumed direction (`'p_subsumed_by_q'` or `'q_subsumed_by_p'`).

#### 5.4.3 `convert_to_expression` (V3, feature-flagged)

```
ALL of:
  config.enableConvertToExpression === true    // feature flag
  hasNesting                                   // see below
  narrowerProfile.isExpressionCandidate === true
  metrics.maeCoPass <= maxMaeDeltaForExpression  // 0.05

hasNesting = (pB_given_A_lower >= minCILower) OR (pA_given_B_lower >= minCILower)
narrowerProfile = the profile with smaller gateVolume
minCILower = minConditionalProbCILowerForNesting  // 0.9
```

#### 5.4.4 `nested_siblings` (V3)

```
hasNesting = (pB_given_A_lower >= 0.9) OR (pA_given_B_lower >= 0.9)
AND
pA_given_B !== pB_given_A   // asymmetric conditional probabilities
```

#### 5.4.5 `needs_separation` (V3)

```
ALL of:
  metrics.activationJaccard >= 0.7
  !hasNesting                                    // neither CI lower >= 0.9
  metrics.maeCoPass > maxMaeDeltaForExpression   // > 0.05
```

#### 5.4.6 `keep_distinct` (V3)

Fallback — if no other classification matches.

### 5.5 V2 Classification Conditions

#### 5.5.1 `merge_recommended` (V2)

```
ALL of:
  stats.onEitherRate >= minOnEitherRateForMerge            // 0.05
  stats.gateOverlapRatio >= minGateOverlapRatio            // 0.9
  effectiveCorrelation >= correlationThreshold             // varies by source:
                                                           //   co-pass: 0.98
                                                           //   global:  0.9
                                                           //   combined: interpolated
  globalMeanAbsDiff <= maxGlobalMeanAbsDiffForMerge        // 0.15 (if available)
  stats.meanAbsDiff <= maxMeanAbsDiffForMerge              // 0.03
  stats.dominanceP < minDominanceForSubsumption            // < 0.95
  stats.dominanceQ < minDominanceForSubsumption            // < 0.95
```

Correlation thresholds depend on effective correlation source:
- `'co-pass'` or `'co-pass-sparse'`: uses `minCorrelationForMerge` (0.98)
- `'global'`: uses `minGlobalCorrelationForMerge` (0.9)
- `'combined'`: uses weighted interpolation of the two

#### 5.5.2 `subsumed_recommended` (V2)

```
effectiveCorrelation >= subsumptionCorrelationThreshold    // 0.95 (co-pass) or 0.85 (global)

Direction A subsumed:
  stats.pOnlyRate <= maxExclusiveRateForSubsumption        // 0.01
  stats.dominanceQ >= minDominanceForSubsumption           // 0.95

Direction B subsumed:
  stats.qOnlyRate <= maxExclusiveRateForSubsumption        // 0.01
  stats.dominanceP >= minDominanceForSubsumption           // 0.95
```

#### 5.5.3 `nested_siblings` (V2)

```
stats.gateOverlapRatio >= strongGateOverlapRatio           // 0.8
P(Q|P) >= nestedConditionalThreshold                       // 0.97
OR
P(P|Q) >= nestedConditionalThreshold                       // 0.97

Minimum pass samples: minPassSamplesForConditional = 200
```

#### 5.5.4 `needs_separation` (V2)

```
stats.gateOverlapRatio >= 0.7
correlation (effective) < minCorrelationForMerge           // < 0.98
```

#### 5.5.5 `keep_distinct` (V2)

Fallback.

### 5.6 Near-Miss Detection

A pair is a "near miss" if it did NOT receive `merge_recommended` or `subsumed_recommended` but comes close:

```
isNearMiss = !isDead(A) AND !isDead(B) AND (
  effectiveCorrelation >= nearMissCorrelationThreshold          // 0.9
  OR
  globalCorrelation >= nearMissGlobalCorrelationThreshold       // 0.8
  OR
  gateOverlapRatio >= nearMissGateOverlapRatio                  // 0.75
)
```

Near-miss results are capped at `maxNearMissPairsToReport` (default `10`), sorted by effective correlation descending.

---

## 6. Recommendation Building

**Files**:
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js` (875 lines)
- `src/expressionDiagnostics/services/prototypeOverlap/GateBandingSuggestionBuilder.js` (254 lines)
- `src/expressionDiagnostics/services/prototypeOverlap/ActionableSuggestionEngine.js` (697 lines)

### 6.1 Severity Computation

Severity (0–1 scale) is computed differently per classification:

#### `merge_recommended`

```
severity = (correlation + gateOverlapRatio) / 2 - meanAbsDiff
severity = clamp(severity, 0, 1)
```

#### `subsumed_recommended`

```
severity = max(dominanceP, dominanceQ)
severity = clamp(severity, 0, 1)
```

#### `nested_siblings`

```
conditionalP = P(Q passes | P passes)
conditionalQ = P(P passes | Q passes)
severity = max(conditionalP, conditionalQ) * gateOverlapRatio
severity = clamp(severity, 0, 1)
```

#### `needs_separation`

```
severity = gateOverlapRatio * (1 - meanAbsDiff)
severity = clamp(severity, 0, 1)
```

#### `convert_to_expression`

```
severity = max(conditionalP, conditionalQ) * (1 - maeCoPass)
severity = clamp(severity, 0, 1)
```

#### Default (`keep_distinct`)

```
severity = cosineSimilarity * 0.3
severity = clamp(severity, 0, 1)
```

### 6.2 Confidence Computation

Confidence is derived from `onEitherRate` using banded ranges:

| `onEitherRate` range | Confidence band | Formula |
|---------------------|-----------------|---------|
| `>= 0.20` | 0.9 – 1.0 | `0.9 + (onEitherRate - 0.2) / 0.8 * 0.1` |
| `>= 0.10` | 0.7 – 0.9 | `0.7 + (onEitherRate - 0.1) / 0.1 * 0.2` |
| `>= 0.05` | 0.5 – 0.7 | `0.5 + (onEitherRate - 0.05) / 0.05 * 0.2` |
| `< 0.05` | 0.3 – 0.5 | `0.3 + onEitherRate / 0.05 * 0.2` |

All confidence values are clamped to [0, 1].

### 6.3 Evidence Assembly

Each recommendation includes structured evidence:

- **Shared drivers**: Axes with same-sign strong weights in both prototypes
- **Key differentiators**: Axes where weights differ significantly
- **Behavioral metrics**: Gate overlap, correlation, mean abs diff, dominance
- **Divergence examples** (V2): Up to 5 contexts showing largest intensity differences
- **Data-driven suggestions**: Specific actions to take (merge, separate gates, etc.)

### 6.4 Gate Banding Suggestions

**File**: `src/expressionDiagnostics/services/prototypeOverlap/GateBandingSuggestionBuilder.js`

For `nested_siblings` and `needs_separation` classifications, the builder compares gate intervals of the two prototypes on each shared axis and suggests boundary adjustments:

**Axis relation categories**:
- `equal`: Same bounds
- `narrower`: P's interval is inside Q's (or vice versa)
- `wider`: P's interval contains Q's (or vice versa)
- `overlapping`: Partial overlap

**Suggestion format**:

```
"Add gate: axis >= upperBound + bandMargin"
"Add gate: axis <= lowerBound - bandMargin"
```

Where `bandMargin = 0.05` (from `prototypeOverlapConfig`).

Gate banding thresholds (V2-specific):
- `highThresholds`: `[0.4, 0.6, 0.75]` — Used for classifying high-value gate ranges
- `minPctWithinEpsForMerge`: `0.85`
- `minCoPassSamples`: `200`

### 6.5 Actionable Suggestions (V3 Only)

**File**: `src/expressionDiagnostics/services/prototypeOverlap/ActionableSuggestionEngine.js`

Uses a **decision stump algorithm** (single-axis binary split) to find axes that best separate the activation regions of two prototypes:

#### 6.5.1 Decision Stump Algorithm

1. **Label assignment**: For each co-pass sample, label it `'a'` (prototype A has higher intensity) or `'b'` (prototype B has higher intensity). Skip samples where `|intensityA - intensityB| < divergenceThreshold` (default `0.1`).

2. **Candidate axis enumeration**: For each axis in the evaluation context:

3. **Information gain computation**: For each candidate split point on each axis:

```
baseEntropy = -pA * log2(pA) - pB * log2(pB)

For each split value v on axis:
  leftLabels  = labels where axis[i] <= v
  rightLabels = labels where axis[i] > v

  entropyLeft  = entropy(leftLabels)
  entropyRight = entropy(rightLabels)

  weightedEntropy = (|left| * entropyLeft + |right| * entropyRight) / totalSamples
  infoGain = baseEntropy - weightedEntropy
```

4. **Best stump selection**: Select the axis + split value with highest `infoGain`.

5. **Confidence computation**:

```
purity = max(countA, countB) / (countA + countB)   // on the majority side
confidence = (infoGain / baseEntropy) * purity
```

#### 6.5.2 Suggestion Generation

Top-ranked stumps (up to `maxSuggestionsPerPair`, default `3`) that meet:
- `infoGain >= minInfoGainForSuggestion` (default `0.05`)
- `minSamplesForStump` (default `100`) samples in the analysis

#### 6.5.3 Suggestion Validation

Each suggestion is validated for practical impact:
- `overlapReduction >= minOverlapReductionForSuggestion` (default `0.1`) — applying the suggested gate must meaningfully reduce co-activation
- `activationRate >= minActivationRateAfterSuggestion` (default `0.01`) — neither prototype should become dead after applying the suggestion

---

## 7. Composite Score & Metadata

**File**: `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js` (933 lines)

### 7.1 Composite Score Formula

Each recommendation receives a composite score for sorting:

```
compositeScore =
    gateOverlapRatio            × compositeScoreGateOverlapWeight     // × 0.3
  + normalizedCorrelation       × compositeScoreCorrelationWeight     // × 0.2
  + (1 - globalMeanAbsDiff)     × compositeScoreGlobalDiffWeight      // × 0.5
```

Where:
- `gateOverlapRatio` ∈ [0, 1]
- `normalizedCorrelation = (effectiveCorrelation + 1) / 2` — maps [-1, 1] to [0, 1]. If `NaN`, uses `0`.
- `globalMeanAbsDiff` ∈ [0, 1] — mean absolute difference of global outputs

Recommendations are sorted by `compositeScore` descending (highest overlap first).

### 7.2 Metadata Assembly

The orchestrator assembles metadata about the analysis run:

```javascript
metadata = {
  totalPrototypes: number,       // total prototypes analyzed
  totalPairsConsidered: number,  // N*(N-1)/2
  candidatePairsFound: number,   // after Stage A filtering
  pairsEvaluated: number,        // after Stage B evaluation
  classificationBreakdown: {     // count per classification type
    merge_recommended: number,
    subsumed_recommended: number,
    convert_to_expression: number,
    nested_siblings: number,
    needs_separation: number,
    keep_distinct: number
  },
  summaryInsight: string,        // human-readable one-liner
  v3Mode: boolean,               // whether V3 was used
  poolSize: number,              // shared pool size (V3)
  sampleCount: number,           // per-pair sample count (V2)
  elapsedMs: number              // total analysis time
}
```

### 7.3 Summary Insight Generation

A single sentence summarizing the most important finding, e.g.:
- "Found 3 pairs recommended for merge and 2 subsumption cases"
- "No significant overlaps detected among 45 prototypes"

---

## 8. Configuration Reference

All thresholds from `src/expressionDiagnostics/config/prototypeOverlapConfig.js`:

### Stage A — Candidate Pair Filtering

| Parameter | Default | Description |
|-----------|---------|-------------|
| `activeAxisEpsilon` | `0.08` | Minimum `|weight|` to count axis as active |
| `strongAxisThreshold` | `0.25` | Minimum `|weight|` for "strong" axis |
| `candidateMinActiveAxisOverlap` | `0.6` | Jaccard threshold for active axis overlap |
| `candidateMinSignAgreement` | `0.8` | Minimum sign agreement ratio |
| `candidateMinCosineSimilarity` | `0.85` | Cosine similarity threshold |
| `softSignThreshold` | `0.15` | Below this, sign is neutral (0) |
| `jaccardEmptySetValue` | `1.0` | Jaccard value when both sets empty |

### Stage A — Multi-Route (V2.1)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `enableMultiRouteFiltering` | `true` | Enable Routes B and C |
| `gateBasedMinIntervalOverlap` | `0.6` | Route B gate interval overlap threshold |
| `prescanSampleCount` | `500` | Route C Monte Carlo sample count |
| `prescanMinGateOverlap` | `0.5` | Route C gate overlap threshold |
| `maxPrescanPairs` | `1000` | Max pairs for prescan evaluation |

### Stage B — Monte Carlo (V2)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `sampleCountPerPair` | `8000` | Samples per candidate pair |
| `divergenceExamplesK` | `5` | Max divergence examples to collect |
| `dominanceDelta` | `0.05` | Minimum intensity difference for dominance counting |
| `intensityEps` | `0.05` | Epsilon for "within tolerance" intensity comparison |
| `minCoPassSamples` | `200` | Minimum co-pass samples for reliable metrics |
| `minPassSamplesForConditional` | `200` | Minimum pass samples for conditional probability |
| `minPctWithinEpsForMerge` | `0.85` | Fraction of co-pass within epsilon for merge |
| `strictEpsilon` | `1e-6` | Strict floating-point comparison epsilon |

### Stage B — Shared Pool (V3)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `sharedPoolSize` | `50000` | Default shared context pool size |
| `quickAnalysisPoolSize` | `15000` | Quick-mode pool size |
| `deepAnalysisPoolSize` | `100000` | Deep-mode pool size |
| `enableStratifiedSampling` | `false` | Enable stratified sampling |
| `stratumCount` | `5` | Number of strata |
| `stratificationStrategy` | `'uniform'` | Stratification method |
| `poolRandomSeed` | `null` | Random seed (null = random) |
| `confidenceLevel` | `0.95` | Wilson CI confidence level |
| `minSamplesForReliableCorrelation` | `500` | Min co-pass for reliable Pearson |

### Stage C — Classification (V2)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `minOnEitherRateForMerge` | `0.05` | Minimum onEitherRate for merge |
| `minGateOverlapRatio` | `0.9` | Gate overlap ratio for merge |
| `minCorrelationForMerge` | `0.98` | Co-pass correlation threshold for merge |
| `maxMeanAbsDiffForMerge` | `0.03` | Max co-pass MAE for merge |
| `maxExclusiveRateForSubsumption` | `0.01` | Max exclusive rate for subsumption |
| `minCorrelationForSubsumption` | `0.95` | Co-pass correlation for subsumption |
| `minDominanceForSubsumption` | `0.95` | Dominance ratio threshold |
| `minGlobalCorrelationForMerge` | `0.9` | Global correlation for merge |
| `minGlobalCorrelationForSubsumption` | `0.85` | Global correlation for subsumption |
| `maxGlobalMeanAbsDiffForMerge` | `0.15` | Max global MAE for merge |
| `nestedConditionalThreshold` | `0.97` | Conditional probability for nesting |
| `strongGateOverlapRatio` | `0.8` | Gate overlap for nested_siblings |

### Stage C — Classification (V3)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxMaeCoPassForMerge` | `0.03` | Max co-pass MAE for V3 merge |
| `maxRmseCoPassForMerge` | `0.05` | Max co-pass RMSE for V3 merge |
| `maxMaeGlobalForMerge` | `0.08` | Max global MAE for V3 merge |
| `minActivationJaccardForMerge` | `0.85` | Activation Jaccard for V3 merge |
| `minConditionalProbForNesting` | `0.95` | Conditional prob for nesting check |
| `minConditionalProbCILowerForNesting` | `0.9` | Wilson CI lower bound for nesting |
| `symmetryTolerance` | `0.05` | Max asymmetry for merge |
| `asymmetryRequired` | `0.1` | Min asymmetry for subsumption |
| `maxMaeDeltaForExpression` | `0.05` | Max co-pass MAE for convert_to_expression |
| `maxExclusiveForSubsumption` | `0.05` | Max exclusive rate for V3 subsumption |
| `lowVolumeThreshold` | `0.05` | Below this activation rate = "dead" |
| `enableConvertToExpression` | `false` | Feature flag for convert_to_expression |

### Stage C — Effective Correlation

| Parameter | Default | Description |
|-----------|---------|-------------|
| `coPassSampleConfidenceThreshold` | `500` | Min co-pass samples for "reliable" |
| `minCoPassRatioForReliable` | `0.1` | Min co-pass ratio for "reliable" |
| `coPassCorrelationWeight` | `0.6` | Weight in combined tier |
| `globalCorrelationWeight` | `0.4` | Weight in combined tier |

### Near-Miss Detection

| Parameter | Default | Description |
|-----------|---------|-------------|
| `nearMissCorrelationThreshold` | `0.9` | Effective correlation threshold |
| `nearMissGlobalCorrelationThreshold` | `0.8` | Global correlation threshold |
| `nearMissGateOverlapRatio` | `0.75` | Gate overlap ratio threshold |
| `maxNearMissPairsToReport` | `10` | Max near-miss pairs in output |

### Composite Score

| Parameter | Default | Description |
|-----------|---------|-------------|
| `compositeScoreGateOverlapWeight` | `0.3` | Gate overlap weight |
| `compositeScoreCorrelationWeight` | `0.2` | Correlation weight |
| `compositeScoreGlobalDiffWeight` | `0.5` | Global diff (inverted) weight |

### Safety Limits

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxCandidatePairs` | `5000` | Max pairs after Stage A |
| `maxSamplesTotal` | `1000000` | Max total Monte Carlo samples |

### V3 Suggestions (ActionableSuggestionEngine)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `minSamplesForStump` | `100` | Min divergent samples for stump |
| `minInfoGainForSuggestion` | `0.05` | Min info gain threshold |
| `divergenceThreshold` | `0.1` | Min intensity diff for labeling |
| `maxSuggestionsPerPair` | `3` | Max suggestions per pair |
| `minOverlapReductionForSuggestion` | `0.1` | Min overlap reduction validation |
| `minActivationRateAfterSuggestion` | `0.01` | Min activation rate validation |

### V3 Profiling

| Parameter | Default | Description |
|-----------|---------|-------------|
| `lowNoveltyThreshold` | `0.15` | Low novelty detection |
| `singleAxisFocusThreshold` | `0.6` | Single-axis focus detection |
| `clusteringMethod` | `'k-means'` | Clustering algorithm |
| `clusterCount` | `10` | Number of clusters |

### Gate Banding (V2)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `bandMargin` | `0.05` | Gate boundary adjustment margin |
| `highThresholds` | `[0.4, 0.6, 0.75]` | High-value gate range classifiers |
| `minExclusiveForBroader` | `0.01` | Min exclusive rate for broader detection |

---

## 9. Known Design Decisions & Rationale

### 9.1 Priority-Based Classification (First Match Wins)

The classification system uses a strict priority order where the first matching label is assigned. This prevents ambiguity — a pair that qualifies for both `merge_recommended` and `nested_siblings` will always be classified as `merge_recommended`.

**Rationale**: In practice, if two prototypes should be merged, that recommendation subsumes all weaker recommendations. The priority order reflects severity: merge > subsume > convert > nest > separate > keep.

**Diagnostic escape hatch**: `allMatchingClassifications` records every label whose conditions are met, enabling the UI or a reviewer to see what else applies.

### 9.2 Effective Correlation Uses a Tiered Strategy

Instead of always using co-pass Pearson correlation, the system falls through five tiers depending on data quality.

**Rationale**: Co-pass correlation is the best measure of behavioral similarity when activated, but requires sufficient samples. With sparse co-activation (rare gate overlap), co-pass samples can be noisy. The tiered approach degrades gracefully:
- High co-pass count → trust co-pass (best signal)
- No co-pass but global available → use global (broad but less targeted)
- Some co-pass + global → combine with weights favoring co-pass
- Sparse co-pass only → use it but mark low confidence
- Nothing valid → mark as unclassifiable

### 9.3 V3 Uses Wilson CI Bounds Instead of Point Estimates

V3 subsumption and nesting checks use the **lower bound** of a Wilson confidence interval rather than the raw conditional probability.

**Rationale**: A point estimate of P(B|A) = 0.95 from 20 co-pass samples is much less trustworthy than the same estimate from 5000 samples. The Wilson CI lower bound naturally penalizes small samples — with 20 samples, the lower bound might be 0.75, correctly preventing a premature subsumption call. This eliminates the need for ad-hoc minimum sample count checks (though `correlationReliable` still exists as a secondary safeguard).

The Wilson score interval formula (implemented via the injected `wilsonInterval` function):

```
p̂ = successes / trials
z = z-score for confidence level (1.96 for 95%)

lower = (p̂ + z²/(2n) - z × √(p̂(1-p̂)/n + z²/(4n²))) / (1 + z²/n)
upper = (p̂ + z²/(2n) + z × √(p̂(1-p̂)/n + z²/(4n²))) / (1 + z²/n)
```

### 9.4 Both Co-Pass and Global Metrics Exist

The system computes metrics on two populations:
1. **Co-pass** (both prototypes activate): Measures how similarly they behave when both are "on"
2. **Global** (all samples, output = 0 when gate fails): Measures overall output similarity

**Rationale**: Two prototypes might be perfectly correlated when co-activated but have very different activation rates. Global metrics capture this — if P activates 80% of the time and Q activates 10% of the time, their global outputs will differ significantly even if they agree perfectly on the 10% overlap. Both perspectives are needed for accurate classification:
- **Merge** requires both high co-pass agreement AND high global agreement
- **Subsumption** allows different activation rates but requires the narrower prototype to be entirely contained
- **Nesting** only cares about co-pass behavior since the broader prototype may activate independently

### 9.5 V2/V3 Dual Mode Architecture

The system supports two evaluation modes:

**V2 (Monte Carlo per pair)**: Generates fresh random contexts for each candidate pair. Advantages: simple, independent evaluation. Disadvantages: expensive for many pairs, no cross-pair consistency.

**V3 (Shared context pool)**: Pre-generates one large context pool, evaluates all prototypes once, then compares output vectors. Advantages: much faster for many pairs, consistent evaluation across all prototypes. Disadvantages: fixed pool may not cover rare gate regions well.

**Rationale for dual support**: V3 is preferred but requires the shared pool and agreement calculator to be provided. The system auto-detects V3 capability and falls back to V2 if unavailable, ensuring backward compatibility.

### 9.6 Composite Score Weights

```
gateOverlapRatio × 0.3 + normalizedCorrelation × 0.2 + (1 - globalMeanAbsDiff) × 0.5
```

**Rationale**: Global mean absolute difference (inverted, so lower diff = higher score) gets the highest weight (0.5) because it captures the most holistic view of behavioral similarity. Gate overlap (0.3) is the next most important since prototypes that rarely co-activate are less likely to cause confusion. Correlation (0.2) is a refinement — two prototypes with similar activation patterns and similar global outputs but anti-correlated intensities would still be caught by global MAE.

### 9.7 Decision Stump for Actionable Suggestions

The V3 suggestion engine uses single-feature decision stumps rather than more complex models (random forests, neural networks).

**Rationale**: The goal is to produce human-interpretable suggestions like "Add gate: `valence >= 0.3`". A single axis split directly translates to a gate constraint. More complex models would produce better separations but would not map to actionable gate modifications. The information gain criterion ensures only genuinely discriminative axes are suggested.

### 9.8 ActiveAxisEpsilon vs SoftSignThreshold

Two distinct small-weight thresholds exist:
- `activeAxisEpsilon = 0.08`: Determines if an axis is "active" for Jaccard overlap
- `softSignThreshold = 0.15`: Determines if a weight has a definite sign direction

**Rationale**: An axis with weight 0.10 is "active" (contributes to the prototype's behavior) but has an ambiguous sign direction. This avoids false sign-disagreement penalties for weakly-weighted axes. The gap between 0.08 and 0.15 creates a "present but direction-neutral" zone that prevents spurious pair rejection.

---

*Document generated from source code analysis of the Living Narrative Engine prototype overlap analysis system.*

**Source files referenced**:
- `src/expressionDiagnostics/config/prototypeOverlapConfig.js`
- `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js`
- `src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js`
- `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js`
- `src/expressionDiagnostics/services/prototypeOverlap/AgreementMetricsCalculator.js`
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js`
- `src/expressionDiagnostics/services/prototypeOverlap/GateBandingSuggestionBuilder.js`
- `src/expressionDiagnostics/services/prototypeOverlap/ActionableSuggestionEngine.js`
- `src/expressionDiagnostics/models/GateConstraint.js`
- `src/expressionDiagnostics/services/simulatorCore/ContextBuilder.js`
- `src/constants/prototypeAxisConstants.js`
- `src/expressionDiagnostics/utils/axisNormalizationUtils.js`
