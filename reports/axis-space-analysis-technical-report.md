# Axis Space Analysis - Technical Report

## Overview

The Axis Space Analysis system determines whether additional expression axes should be added to the prototype configuration. It uses multiple detection methods to identify patterns that suggest the current axis set is insufficient to capture all meaningful variation in the prototype space.

**Source Files:**
- `src/expressionDiagnostics/services/AxisGapAnalyzer.js` - Core detection algorithms
- `src/domUI/prototype-analysis/PrototypeAnalysisController.js` - UI rendering and decision logic
- `src/expressionDiagnostics/config/prototypeOverlapConfig.js` - Configuration thresholds

---

## 1. "New Axis Recommended?" Decision Logic

### Verdict Determination

The system produces three possible verdicts: **YES**, **MAYBE**, or **NO**.

**Location:** `PrototypeAnalysisController.js`, `#renderAxisGapDecisionSummary` method

```javascript
// Decision logic (simplified)
const highResidual = residualVariance > highResidualThreshold;  // 0.15 (strict >)
const hasCoverageGaps = coverageGapSignals > 0;
const hasHubs = hubSignals > 0;
const hasMultiAxisConflicts = multiAxisConflictSignals > 0;
const hasAnySignals = hasCoverageGaps || hasHubs || hasMultiAxisConflicts;

if ((highResidual && hasCoverageGaps) || (hasHubs && hasMultiAxisConflicts)) {
  verdict = 'yes';      // Strong evidence from multiple independent signals
} else if (highResidual) {
  verdict = 'maybe';    // PCA alone suggests unexplained variance
} else if (hasAnySignals) {
  verdict = 'maybe';    // Some structural signals but no PCA confirmation
} else {
  verdict = 'no';       // No signals detected
}
```

> **Note:** The threshold uses strict `>` comparison, meaning exactly 15% residual variance is NOT flagged as high. A prototype family with exactly 0.15 residual variance will not trigger the "high residual" condition.

### Verdict Criteria Summary

| Verdict | Condition |
|---------|-----------|
| **YES** | (High residual variance AND coverage gaps) OR (hub prototypes AND multi-axis conflicts) |
| **MAYBE** | High residual variance alone OR any structural signals without high residual variance |
| **NO** | No signals detected |

### Confidence Level

Confidence is determined by two factors:
1. The number of independent detection methods that triggered
2. Whether any single prototype triggers 3+ **distinct signal families** (not just raw reason count)

```javascript
// AxisGapReportSynthesizer.js, #computeConfidenceLevel method
#computeConfidenceLevel(methodsTriggered, prototypeWeightSummaries = []) {
  // Base confidence from method count
  let baseConfidence = 'low';
  if (methodsTriggered >= 3) {
    baseConfidence = 'high';
  } else if (methodsTriggered >= 2) {
    baseConfidence = 'medium';
  }

  // Boost confidence if any prototype triggers 3+ distinct signal families
  // Signal families: pca, hub, gap, conflict (not raw reason count)
  const hasMultiFamilyPrototype = prototypeWeightSummaries.some(
    summary => this.#countDistinctFamilies(summary?.reasons) >= 3
  );

  if (hasMultiFamilyPrototype && baseConfidence !== 'high') {
    // Promote by one level
    return baseConfidence === 'low' ? 'medium' : 'high';
  }

  return baseConfidence;
}
```

> **Note:** Confidence boosting counts distinct **signal families** (e.g., pca, hub, gap, conflict), not raw reason count. This prevents double-counting when a prototype has multiple reasons from the same family.

### Signal Counting Threshold Inconsistency

The `#countTriggeredMethods` method uses `>=` for PCA threshold comparison:

```javascript
if (pcaResult.residualVarianceRatio >= pcaThreshold || ...) // Uses >=
```

While the Controller verdict logic uses `>`:

```javascript
const highResidual = residualVariance > highResidualThreshold;  // Uses >
```

**Impact:** A 15% residual variance triggers PCA signal counting but doesn't contribute to a "maybe" verdict through the high residual path. This creates an edge case at exactly the threshold value.

---

## 2. Signal Sources

### 2.1 PCA Analysis

**Purpose:** Detect unexplained variance in prototype positions that suggests missing dimensions.

**Location:** `AxisGapAnalyzer.js`, `#runPCAAnalysis` method; `PCAAnalysisService.js`

#### Algorithm

1. **Build Data Matrix:** Create matrix where each row is a prototype's axis weights (normalized to unit vectors)

2. **Compute Covariance Matrix:** Calculate covariance between all axis pairs

3. **Eigendecomposition:** Use Jacobi algorithm to find eigenvalues and eigenvectors
   - Eigenvalues represent variance explained by each principal component
   - Eigenvectors represent the direction of each component

4. **Identify Significant Components:** Count components using the configured significance method (broken-stick or Kaiser)

5. **Calculate Residual Variance:** Sum eigenvalues beyond expected axis count, divide by total variance

#### Component Significance Methods

The system supports two methods for determining significant PCA components:

##### Broken-Stick Rule (Default)

The **broken-stick model** provides a statistically grounded null hypothesis for eigenvalue significance. It models how variance would be randomly partitioned across components if there were no true underlying structure.

**Formula:** For the k-th component out of p total components:
```
Expected(k) = (1/p) × Σ(j=k to p)[1/j]
```

**Interpretation:** A component is significant if its actual variance proportion exceeds its broken-stick expected value. Components are evaluated in order; counting stops at the first non-significant component.

**Why broken-stick is preferred:**
- Works correctly with standardized/bounded data where eigenvalues rarely exceed 1.0
- Provides a principled statistical baseline rather than an arbitrary threshold
- Conservative and well-established in psychometrics and ecology
- Deterministic (no random sampling needed unlike parallel analysis)

##### Kaiser Criterion (Fallback)

The traditional Kaiser criterion considers a component significant if its eigenvalue ≥ 1.0.

**When to use Kaiser:**
- When comparing with legacy analyses that used Kaiser
- When eigenvalues are interpretable in original units (not recommended for standardized data)

**Known limitation:** Kaiser criterion often produces "0 additional components" with standardized data because eigenvalues for correlation matrices are bounded and rarely exceed 1.0. This is why broken-stick is now the default.

#### Key Metrics Produced

- `residualVarianceRatio`: Proportion of variance not explained by expected axes
- `additionalSignificantComponents`: Number of significant components beyond expected count (method-dependent)
- `topLoadingPrototypes`: Prototypes with highest absolute loading on the first unexplained component

#### Configuration Options

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `pcaComponentSignificanceMethod` | 'broken-stick' | Method for determining significant components |
| `pcaKaiserThreshold` | 1.0 | Eigenvalue threshold (only used with 'kaiser' method) |
| `pcaResidualVarianceThreshold` | 0.15 | Minimum residual variance to flag as "high" |

#### Configuration Example

```javascript
// Use broken-stick (recommended for standardized data)
const config = {
  pcaComponentSignificanceMethod: 'broken-stick',
};

// Use Kaiser (for backwards compatibility or specific use cases)
const config = {
  pcaComponentSignificanceMethod: 'kaiser',
  pcaKaiserThreshold: 1.0,
};
```

---

### 2.2 Coverage Gaps

**Purpose:** Identify regions of axis space that have clusters of prototypes but are distant from all axis unit vectors.

**Location:** `AxisGapAnalyzer.js`, `#detectCoverageGaps` method

#### Algorithm

1. **Compute Axis Centroids:** Each axis has a unit vector centroid (e.g., [1,0,0] for axis 0)

2. **Cluster Prototypes:** Group prototypes that are close to each other using cosine distance
   - Two prototypes cluster together if cosine distance < `coverageGapAxisDistanceThreshold`

3. **Identify Gap Clusters:** A cluster is a "coverage gap" if:
   - Cluster size ≥ `coverageGapMinClusterSize` (3)
   - Cluster centroid has cosine distance ≥ `coverageGapAxisDistanceThreshold` (0.6) from ALL axis unit vectors

4. **Return Gap Information:** For each gap, return member prototypes and average distance from nearest axis

#### Enhanced Gap Scoring (Phase 3)

When `enableMagnitudeAwareGapScoring` is true (default), gap output includes:
- `clusterMagnitude` - Vector magnitude of cluster centroid
- `clusterSize` - Number of prototypes in cluster
- `gapScore` - Combined score incorporating distance and magnitude

#### Thresholds

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `coverageGapAxisDistanceThreshold` | 0.6 | Maximum cosine distance to consider "covered" by an axis |
| `coverageGapMinClusterSize` | 3 | Minimum cluster size to consider a meaningful gap |
| `enableMagnitudeAwareGapScoring` | true | Enable magnitude-weighted gap scoring |

#### Interpretation

Coverage gaps indicate prototype clusters that don't align well with any existing axis. This suggests an additional axis might better capture this variation.

---

### 2.3 Hub Prototypes

**Purpose:** Identify prototypes that connect many other prototypes in the overlap graph, potentially indicating they represent a distinct dimension.

**Location:** `AxisGapAnalyzer.js`, `#identifyHubPrototypes` method

#### Algorithm

1. **Build Overlap Graph:** Create adjacency information where edges represent prototype overlap (from `overlapGraph` input)

2. **Calculate Degree:** Count edges for each prototype

3. **Check Hub Criteria:** A prototype is a hub if:
   - Degree ≥ `hubMinDegree` (4)
   - Maximum edge weight < `hubMaxEdgeWeight` (0.9) - prevents hubs that are just high-overlap pairs
   - Neighborhood diversity ≥ `hubMinNeighborhoodDiversity` (2) - neighbors span at least 2 different primary axes

4. **Compute Hub Score:** `hubScore = degree × (1 - variance_of_edge_weights)`
   - Lower variance in edge weights indicates more consistent overlap patterns
   - Higher score indicates a more significant hub
   - Note: `neighborhoodDiversity` is a filter criterion (step 3), not part of the score formula

#### Thresholds

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `hubMinDegree` | 4 | Minimum edges to qualify as hub |
| `hubMaxEdgeWeight` | 0.9 | Maximum single edge weight (filters trivial high-overlap pairs) |
| `hubMinNeighborhoodDiversity` | 2 | Minimum different axes among neighbors |

#### Interpretation

Hub prototypes connect many other prototypes across multiple axes, suggesting they might represent a cross-cutting concept that warrants its own axis.

---

### 2.4 Multi-Axis Conflicts

**Purpose:** Identify prototypes with unusually high weights on multiple axes simultaneously, suggesting axis definitions overlap.

**Location:** `AxisGapAnalyzer.js`, `#detectMultiAxisConflicts` method

#### Algorithm

1. **Calculate Axis Usage Statistics:** For each axis, compute Q1, Q3, and IQR of all prototype weights on that axis

2. **Define High Weight Threshold:** `threshold = Q3 + (IQR × multiAxisUsageThreshold)`
   - Default: `Q3 + (IQR × 1.5)`

3. **Identify Multi-Axis Prototypes:** A prototype has a conflict if:
   - It exceeds the high weight threshold on 2+ axes simultaneously
   - The sign balance (proportion of positive vs negative high weights) ≤ `multiAxisSignBalanceThreshold` (0.4)

4. **Calculate Conflict Severity:** Based on how many axes are affected and how far above thresholds

#### Thresholds

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `multiAxisUsageThreshold` | 1.5 | IQR multiplier for outlier detection |
| `multiAxisSignBalanceThreshold` | 0.4 | Maximum sign imbalance to qualify as conflict |

#### Interpretation

Multi-axis conflicts indicate prototypes that strongly load on multiple axes, suggesting those axes may share an underlying dimension that should be explicitly modeled.

---

### 2.5 High Axis Loadings

**Purpose:** Identify prototypes that load heavily on an unusually large number of axes, suggesting they may represent a cross-cutting concept.

**Location:** `AxisGapAnalyzer.js`, `#detectHighAxisLoadings` method

#### Algorithm

1. **Count Active Axes:** For each prototype, count axes with non-trivial weights

2. **Calculate Median and IQR:** Compute distribution statistics across all prototypes

3. **Identify Outliers:** A prototype has high axis loading if:
   - `activeAxisCount > median + IQR × highAxisLoadingThreshold`
   - Default: Prototypes loading on more axes than `median + 1.5 × IQR`

#### Thresholds

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `highAxisLoadingThreshold` | 1.5 | IQR multiplier for determining "high" axis count |

#### Interpretation

Prototypes with high axis loadings engage with many dimensions simultaneously, potentially indicating they represent a concept that spans multiple existing axes or requires a new dedicated axis.

---

### 2.6 Sign Tensions

**Purpose:** Identify prototypes with mixed high-magnitude positive and negative weights, suggesting internal tension that may indicate a missing dimension.

**Location:** `AxisGapAnalyzer.js`, `#detectSignTensions` method

#### Algorithm

1. **Identify High-Magnitude Axes:** Find axes where `|weight| >= signTensionMinMagnitude`

2. **Count Sign Distribution:** Count positive vs negative high-magnitude weights

3. **Detect Tension:** A prototype has sign tension if:
   - It has at least `signTensionMinHighAxes` high-magnitude axes (2 by default)
   - Both positive and negative high-magnitude weights exist

#### Thresholds

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `signTensionMinMagnitude` | 0.2 | Minimum |weight| for an axis to be considered high-magnitude |
| `signTensionMinHighAxes` | 2 | Minimum high-magnitude axes required |

#### Interpretation

Sign tensions indicate prototypes being "pulled" in opposite directions across the axis space, suggesting the current axes may not cleanly separate the underlying concepts.

#### Metadata-Only Classification

**Important:** Sign tensions are classified as **metadata-only** signals and do NOT contribute to:
- Confidence scoring
- Recommendation generation
- Verdict determination

This is by design because mixed positive/negative weights are **normal** for emotional prototypes representing complex states. Including them as actionable signals would generate excessive false positives (~64% of prototypes were incorrectly flagged as conflicts during development).

Sign tension data is still available in the analysis results for informational purposes but is excluded from all scoring and recommendation logic.

---

## 3. Dimensionality Analysis (PCA)

### Residual Variance Calculation

**Location:** `AxisGapAnalyzer.js`, `#runPCAAnalysis` method

#### Step-by-Step Process

```javascript
// 1. Get eigenvalues from decomposition (sorted descending)
const eigenvalues = eigen.values;  // e.g., [2.5, 1.8, 0.9, 0.3, 0.1]

// 2. Calculate total variance
const totalVariance = eigenvalues.reduce((sum, val) => sum + val, 0);  // e.g., 5.6

// 3. Expected axis count (number of configured axes)
const axisCount = this.#config.axes.length;  // e.g., 2

// 4. Residual eigenvalues (beyond expected axes)
const residualValues = eigenvalues.slice(axisCount);  // e.g., [0.9, 0.3, 0.1]

// 5. Sum residual variance
const residualVariance = residualValues.reduce((sum, val) => sum + val, 0);  // e.g., 1.3

// 6. Calculate ratio (clamped 0-1)
const residualVarianceRatio = Math.min(1, Math.max(0, residualVariance / totalVariance));
// e.g., 1.3 / 5.6 = 0.232 (23.2%)
```

#### Formula

```
Residual Variance Ratio = Σ(eigenvalues[axisCount:]) / Σ(all eigenvalues)
```

#### Interpretation

| Residual Variance | Interpretation |
|-------------------|----------------|
| < 0.10 | Excellent - axes capture nearly all variation |
| 0.10 - 0.15 | Good - minor unexplained variation |
| > 0.15 - 0.25 | Moderate - consider additional axis |
| > 0.25 | High - strong evidence for additional axis |

> **Note:** The boundary at 0.15 is exclusive (uses `>` not `>=`), so exactly 15% is considered "good" not "moderate".

### Additional Significant Components

The system counts significant components beyond the expected axis count using a configurable method:

#### Broken-Stick Method (Default)

The default method compares each eigenvalue to its broken-stick expected value:

```javascript
// PCAAnalysisService.js - broken-stick calculation
const brokenStickExpected = computeBrokenStickExpected(eigenvalueIndex, totalComponents);
// Component is significant if actual > expected
const isSignificant = eigenvalue > brokenStickExpected;
```

Components are evaluated in order; counting stops at the first non-significant component.

#### Kaiser Method (Fallback)

When configured with `pcaComponentSignificanceMethod: 'kaiser'`, uses the traditional eigenvalue ≥ 1.0 criterion:

```javascript
const additionalSignificantComponents = residualValues.filter(
  value => value >= this.#config.pcaKaiserThreshold  // 1.0
).length;
```

> **Note:** See Section 2.1 for detailed comparison of these methods and why broken-stick is preferred for standardized data.

---

## 4. Extreme Prototypes on Additional Component

**Purpose:** Identify prototypes that load heavily on the first principal component beyond the expected axes.

**Location:** `AxisGapAnalyzer.js`, `#runPCAAnalysis` method

#### Algorithm

1. **Identify First Unexplained Component:** The eigenvector corresponding to the largest eigenvalue beyond `axisCount`

2. **Project Prototypes:** Calculate each prototype's loading (dot product) on this component

3. **Rank by Absolute Loading:** Sort prototypes by |loading| descending

4. **Return Top Loaders:** Return prototypes with highest absolute projection scores

#### Output Format

```javascript
topLoadingPrototypes: [
  { prototypeId: 'proto_a', loading: 0.85 },
  { prototypeId: 'proto_b', loading: -0.72 },
  // ...
]
```

#### Interpretation

Prototypes with high absolute loadings on unexplained components are candidates for:
1. Being part of a new axis definition
2. Indicating what concept the missing axis might represent
3. Flagging as "EXTREME PROJECTION" in the flagged prototypes analysis

---

## 5. Poorly Fitting Prototypes

**Purpose:** Identify prototypes that cannot be well-represented by the current axis configuration.

**Location:** `AxisGapAnalyzer.js`, `#computeReconstructionErrors` method

#### Reconstruction Error Calculation

```javascript
// For each prototype:
// 1. Get original axis weights (normalized)
const original = prototypeWeights[prototypeId];  // e.g., [0.6, 0.8, 0.1]

// 2. Project onto PCA space (first axisCount components)
const projected = this.#projectOntoComponents(original, eigenvectors, axisCount);

// 3. Reconstruct from projection
const reconstructed = this.#reconstructFromComponents(projected, eigenvectors, axisCount);

// 4. Calculate RMSE
const squaredDiffs = original.map((val, i) => Math.pow(val - reconstructed[i], 2));
const mse = squaredDiffs.reduce((sum, val) => sum + val, 0) / original.length;
const rmse = Math.sqrt(mse);
```

#### Formula

```
Reconstruction Error (RMSE) = √(Σ(original[i] - reconstructed[i])² / n)
```

#### Threshold

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `reconstructionErrorThreshold` | 0.5 | Minimum error to flag as "poorly fitting" |

#### Interpretation

High reconstruction error means the prototype's position in axis space cannot be accurately recreated from the main principal components, indicating it occupies a dimension not captured by current axes.

---

## 6. Axis Recommendations

**Purpose:** Generate actionable suggestions for improving the axis configuration.

**Location:** `AxisGapAnalyzer.js`, `#generateRecommendations` method

### Recommendation Types and Triggers

| Recommendation | Trigger Condition | Priority |
|----------------|-------------------|----------|
| `NEW_AXIS` | (PCA triggered AND coverage gaps) OR (hubs AND coverage gaps) | high |
| `INVESTIGATE` | PCA triggered alone, OR hubs alone, OR coverage gaps alone | medium |
| `REFINE_EXISTING` | Multi-axis conflicts detected (excludes sign_tension which is metadata-only) | low |
| `NO_ACTION_NEEDED` | No actionable signals detected | info |

> **Note:** The actual recommendation type is `NEW_AXIS` (not `ADD_AXIS`). PCA is considered "triggered" when `residualVarianceRatio >= threshold OR additionalSignificantComponents > 0`.

### Recommendation Generation Logic

```javascript
const recommendations = [];

// High priority: PCA indicates missing dimension
if (residualVariance >= pcaResidualVarianceThreshold &&
    additionalSignificantComponents > 0) {
  recommendations.push({
    type: 'ADD_AXIS',
    priority: 'high',
    description: `PCA suggests ${additionalSignificantComponents} additional axis(es)`,
    evidence: {
      residualVariance,
      additionalSignificantComponents,
      topCandidates: topLoadingPrototypes
    }
  });
}

// Medium priority: Structural signals
if (coverageGaps.length > 0) {
  recommendations.push({
    type: 'INVESTIGATE_COVERAGE_GAP',
    priority: 'medium',
    description: `${coverageGaps.length} cluster(s) poorly covered by current axes`,
    evidence: { gaps: coverageGaps }
  });
}

// Similar for hubs and multi-axis conflicts...

// Low priority: General refinement
if (recommendations.length > 0) {
  recommendations.push({
    type: 'REFINE_AXIS_DEFINITIONS',
    priority: 'low',
    description: 'Consider refining axis definitions based on flagged prototypes'
  });
}

// No action if clean
if (recommendations.length === 0) {
  recommendations.push({
    type: 'NO_ACTION_NEEDED',
    priority: 'info',
    description: 'Current axis configuration appears adequate'
  });
}
```

---

## 7. Flagged Prototypes Analysis

**Purpose:** Compile a list of prototypes that warrant manual review due to unusual characteristics.

**Location:** `AxisGapAnalyzer.js`, `#computePrototypeWeightSummaries` method

### Multi-Reason Accumulation Model

Prototypes can now accumulate **multiple flagging reasons**. This provides richer diagnostic information and enables confidence boosting when a single prototype triggers multiple detection signals.

#### Output Structure

```javascript
{
  prototypeId: 'proto_a',
  reasons: ['hub', 'extreme_projection', 'coverage_gap'],  // All applicable reasons
  metricsByReason: {
    hub: { hubScore: 0.85, neighborhoodDiversity: 3 },
    extreme_projection: { projectionScore: 0.72 },
    coverage_gap: { distanceToNearestAxis: 0.68 }
  },
  reason: 'hub',  // Backward compat - first reason added
  metrics: { hubScore: 0.85, neighborhoodDiversity: 3 },  // Backward compat - first reason's metrics
  multiSignalAgreement: true  // True when reasons.length >= 3
}
```

### Flagging Reasons

| Flag | Label | Trigger Condition |
|------|-------|-------------------|
| `high_reconstruction_error` | High Recon. Error | reconstructionError ≥ 0.5 |
| `extreme_projection` | Extreme Projection | In topLoadingPrototypes from PCA |
| `hub` | Hub Prototype | Identified as hub prototype |
| `multi_axis_conflict` | Multi-Axis Conflict | Has multi-axis conflict |
| `coverage_gap` | Coverage Gap | Member of a coverage gap cluster |
| `high_axis_loading` | high axis loading* | Detected by high axis loading detector |
| `sign_tension` | sign tension* | Detected by sign tension detector |

> \* These new flag types use the fallback formatter (`reason.replace(/_/g, ' ')`) and don't have custom "why flagged" explanations yet.

### Flagging Algorithm

```javascript
#computePrototypeWeightSummaries(prototypes, pcaResult, hubs, gaps, conflicts) {
  const flaggedPrototypes = new Map();

  /**
   * Add a flag reason to a prototype (accumulates multiple reasons)
   */
  const addFlag = (prototypeId, reason, metrics) => {
    if (!prototypeId) return;

    if (!flaggedPrototypes.has(prototypeId)) {
      flaggedPrototypes.set(prototypeId, {
        prototypeId,
        reasons: [],
        metricsByReason: {},
      });
    }

    const entry = flaggedPrototypes.get(prototypeId);
    // Only add if this reason hasn't been added yet (deduplicate)
    if (!entry.reasons.includes(reason)) {
      entry.reasons.push(reason);
      entry.metricsByReason[reason] = metrics;
    }
  };

  // 1. Flag high reconstruction errors
  if (pcaResult?.reconstructionErrors) {
    for (const { prototypeId, error } of pcaResult.reconstructionErrors) {
      if (error >= reconstructionThreshold) {  // 0.5
        addFlag(prototypeId, 'high_reconstruction_error', { reconstructionError: error });
      }
    }
  }

  // 2. Flag extreme projections
  if (pcaResult?.topLoadingPrototypes) {
    for (const { prototypeId, loading } of pcaResult.topLoadingPrototypes) {
      addFlag(prototypeId, 'extreme_projection', { projectionScore: loading });
    }
  }

  // 3. Flag hubs
  for (const hub of hubs) {
    addFlag(hub.prototypeId, 'hub', { hubScore: hub.hubScore, neighborhoodDiversity: hub.neighborhoodDiversity });
  }

  // 4. Flag multi-axis conflicts (may use specific reason like 'high_axis_loading' or 'sign_tension')
  for (const conflict of conflicts) {
    const reason = conflict?.flagReason ?? 'multi_axis_conflict';
    addFlag(conflict.prototypeId, reason, {
      activeAxisCount: conflict.activeAxisCount,
      signBalance: conflict.signBalance
    });
  }

  // 5. Flag coverage gap members
  for (const gap of gaps) {
    for (const prototypeId of gap.centroidPrototypes) {
      addFlag(prototypeId, 'coverage_gap', {
        distanceToNearestAxis: gap.distanceToNearestAxis,
        clusterId: gap.clusterId
      });
    }
  }

  // Convert to array with backward compatibility fields
  const results = [];
  for (const [prototypeId, entry] of flaggedPrototypes) {
    const { reasons, metricsByReason } = entry;
    results.push({
      prototypeId,
      reasons,
      metricsByReason,
      // Backward compatibility
      reason: reasons[0] ?? null,
      metrics: metricsByReason[reasons[0]] ?? {},
      // Confidence boost for multi-signal agreement
      multiSignalAgreement: reasons.length >= 3,
    });
  }

  return results;
}
```

### UI Rendering

**Location:** `PrototypeAnalysisController.js`, `#formatReasonLabel` method

```javascript
#formatReasonLabel(reason) {
  const labels = {
    high_reconstruction_error: 'High Recon. Error',
    extreme_projection: 'Extreme Projection',
    hub: 'Hub Prototype',
    multi_axis_conflict: 'Multi-Axis Conflict',
    coverage_gap: 'Coverage Gap',
  };
  return labels[reason] || reason.replace(/_/g, ' ');  // Fallback for new reasons
}
```

> **Note:** The new flag types `high_axis_loading` and `sign_tension` use the fallback formatter, rendering as "high axis loading" and "sign tension" respectively.

---

## 8. Configuration Reference

### Complete Threshold Table

#### Core Detection Parameters

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `pcaComponentSignificanceMethod` | 'broken-stick' | Method for determining significant PCA components ('broken-stick' or 'kaiser') |
| `pcaKaiserThreshold` | 1.0 | Kaiser criterion for significant eigenvalues (only used with 'kaiser' method) |
| `pcaResidualVarianceThreshold` | 0.15 | Threshold for "high" residual variance (signal counting, uses `>=`) |
| `residualVarianceThreshold` | 0.15 | Threshold for residual variance (signal breakdown, uses `>`)* |
| `reconstructionErrorThreshold` | 0.5 | RMSE threshold for poorly fitting prototypes |
| `hubMinDegree` | 4 | Minimum edges for hub qualification |
| `hubMaxEdgeWeight` | 0.9 | Maximum single edge weight for hubs |
| `hubMinNeighborhoodDiversity` | 2 | Minimum different axes among hub neighbors |
| `coverageGapAxisDistanceThreshold` | 0.6 | Cosine distance threshold for coverage |
| `coverageGapMinClusterSize` | 3 | Minimum prototypes in gap cluster |
| `multiAxisUsageThreshold` | 1.5 | IQR multiplier for outlier detection |
| `multiAxisSignBalanceThreshold` | 0.4 | Sign balance threshold for conflicts |

> \* Two parameter names exist for the same 0.15 threshold value - see note in Section 1 about inconsistent comparison operators.

#### Phase 2 Parameters (High Axis Loading / Sign Tension)

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `highAxisLoadingThreshold` | 1.5 | IQR multiplier for high axis count detection |
| `signTensionMinMagnitude` | 0.2 | Minimum |weight| for high-magnitude axis |
| `signTensionMinHighAxes` | 2 | Minimum high-magnitude axes for tension detection |

#### Phase 3 Parameters (Magnitude-Aware Gap Scoring)

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `enableMagnitudeAwareGapScoring` | true | Enable magnitude-weighted gap scoring |

#### Phase 4 Parameters (Adaptive Thresholds)

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `enableAdaptiveThresholds` | false | Compute data-driven thresholds instead of static 0.6 |

#### Phase 5 Parameters (DBSCAN Clustering)

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `coverageGapClusteringMethod` | 'profile-based' | Clustering method: 'profile-based' or 'dbscan' |
| `dbscanEpsilon` | 0.4 | DBSCAN max distance for neighborhood membership |
| `dbscanMinPoints` | 3 | DBSCAN min neighbors for core point |

---

## 9. Data Flow Summary

```
Input: Prototypes with axis weights + Overlap graph
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                    AxisGapAnalyzer                          │
├─────────────────────────────────────────────────────────────┤
│  1. #runPCAAnalysis()                                       │
│     → residualVariance, additionalComponents, topLoaders    │
│                                                             │
│  2. #computeReconstructionErrors()                          │
│     → reconstructionErrors per prototype                    │
│                                                             │
│  3. #detectCoverageGaps()                                   │
│     → coverageGaps array                                    │
│                                                             │
│  4. #identifyHubPrototypes()                                │
│     → hubPrototypes array                                   │
│                                                             │
│  5. #detectMultiAxisConflicts()                             │
│     → multiAxisConflicts array (combined)                   │
│                                                             │
│  6. #detectHighAxisLoadings()                               │
│     → highAxisLoadings array                                │
│                                                             │
│  7. #detectSignTensions()                                   │
│     → signTensions array                                    │
│                                                             │
│  8. #computePrototypeWeightSummaries()                      │
│     → flaggedPrototypes (with multi-reason accumulation)    │
│                                                             │
│  9. #generateRecommendations()                              │
│     → recommendations array with priorities                 │
└─────────────────────────────────────────────────────────────┘
                    ↓
Output: AxisGapAnalysisResult {
  pcaResult, reconstructionErrors, coverageGaps,
  hubPrototypes, multiAxisConflicts, flaggedPrototypes,
  recommendations, confidence,
  summary: {
    signalBreakdown: {
      pcaSignals: 0 or 1,           // Binary
      hubSignals: count,            // Count
      coverageGapSignals: count,    // Count
      multiAxisConflictSignals: count,  // Count (combined)
      highAxisLoadingSignals: count,    // Count (Phase 2)
      signTensionSignals: count,        // Count (Phase 2)
    }
  }
}
                    ↓
┌─────────────────────────────────────────────────────────────┐
│              PrototypeAnalysisController                    │
├─────────────────────────────────────────────────────────────┤
│  Renders:                                                   │
│  - Decision summary (YES/MAYBE/NO)                          │
│  - Signal breakdown cards (4 rendered in UI):               │
│      • PCA signals                                          │
│      • Hub signals                                          │
│      • Coverage gap signals                                 │
│      • Multi-axis conflict signals                          │
│    Note: highAxisLoadingSignals and signTensionSignals      │
│    are available in data but not rendered as separate cards │
│  - PCA statistics                                           │
│  - Flagged prototype cards with multi-reason badges         │
│  - Recommendations list                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Potential Areas for Review

### Algorithmic Considerations

1. **Threshold Comparison Inconsistency:** Signal counting uses `>=` while verdict determination uses `>`. Consider whether this edge case behavior is intentional.

2. **Coverage Gap Clustering:** The system supports both profile-based (default) and DBSCAN clustering. DBSCAN may be more robust for irregularly shaped clusters but requires tuning `dbscanEpsilon` and `dbscanMinPoints`.

3. **Hub Detection:** Neighborhood diversity requires neighbors to have different primary axes. Edge case: what if all neighbors have equal weights across axes (no clear primary)?

4. **Multi-Axis Conflict Detection:** Uses IQR-based outlier detection which assumes roughly normal distribution. May not be appropriate for all axis weight distributions.

5. **Reconstruction Error:** Uses RMSE which weights all axes equally. Consider weighted error based on axis importance.

6. **Multi-Reason Accumulation:** Prototypes can now have many flags, which provides rich diagnostics but may create visual clutter in the UI.

### Threshold Sensitivity

1. **`reconstructionErrorThreshold = 0.5`:** This is quite high. A prototype with 0.5 RMSE has significant deviation. Consider if this threshold should be lower (e.g., 0.3).

2. **`coverageGapAxisDistanceThreshold = 0.6`:** Cosine distance of 0.6 means roughly 53° angle. This is a large deviation from axis alignment. The adaptive threshold feature (Phase 4) provides a data-driven alternative.

3. **`hubMinDegree = 4`:** Requires at least 4 overlapping prototypes. In small prototype sets, this may never trigger.

4. **`highAxisLoadingThreshold = 1.5` and `signTensionMinMagnitude = 0.2`:** These Phase 2 thresholds may need tuning based on specific prototype distributions.

### Edge Cases

1. **Empty overlap graph:** What happens when no prototypes overlap?
2. **Single-axis configuration:** PCA analysis may behave unexpectedly.
3. **All prototypes on single axis:** Coverage gap detection should flag this but may not.
4. **Prototype with zero weights:** Division by zero risk in normalization.
5. **Exactly 15% residual variance:** Not flagged as "high" due to strict `>` comparison.

### Phase 4-5 Features

1. **Adaptive Thresholds (disabled by default):** When enabled, computes data-driven thresholds instead of static 0.6. May improve detection accuracy but adds computation overhead.

2. **DBSCAN Clustering:** Alternative to profile-based clustering for coverage gap detection. Better for non-spherical clusters but sensitive to `epsilon` and `minPoints` parameters.

---

## Appendix: Phase Evolution Summary

The Axis Gap Detection system evolved through multiple development phases:

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 1 | Basic detection (PCA, hubs, gaps, conflicts) | ✅ Complete |
| Phase 2 | High axis loadings + Sign tensions | ✅ Complete |
| Phase 3 | Magnitude-aware gap scoring | ✅ Complete (enabled) |
| Phase 4 | Adaptive thresholds | ✅ Complete (disabled by default) |
| Phase 5 | DBSCAN clustering option | ✅ Complete (profile-based default) |

---

*Report generated for Axis Space Analysis system review. See source files for implementation details.*
