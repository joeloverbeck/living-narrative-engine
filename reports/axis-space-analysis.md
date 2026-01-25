# Axis Space Analysis: Technical Report

**Purpose**: Comprehensive documentation of calculations, algorithms, and methodologies used in the 'Axis Space Analysis' section of the prototype-analysis.html diagnostic tool.

**Intended Audience**: External reviewers seeking to identify potential bugs or improvements.

**Version**: 1.0.0
**Date**: 2026-01-25

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Phase 1: PCA Analysis](#3-phase-1-pca-analysis)
4. [Phase 2: Hub Prototype Detection](#4-phase-2-hub-prototype-detection)
5. [Phase 3: Coverage Gap Detection](#5-phase-3-coverage-gap-detection)
6. [Phase 4: Multi-Axis Conflict Detection](#6-phase-4-multi-axis-conflict-detection)
7. [Phase 5: Report Synthesis](#7-phase-5-report-synthesis)
8. [Utility Functions](#8-utility-functions)
9. [Configuration Parameters](#9-configuration-parameters)
10. [Potential Issues and Improvement Areas](#10-potential-issues-and-improvement-areas)

---

## 1. System Overview

The Axis Space Analysis system analyzes prototype expressions across multiple emotional/behavioral axes to identify:

- **Dimensional structure**: How many axes are truly independent
- **Hub prototypes**: Expressions that connect many axes (potential redundancy or richness)
- **Coverage gaps**: Underrepresented regions of the axis space
- **Multi-axis conflicts**: Expressions with contradictory axis loadings

### Input Data Structure

Prototypes are objects with weight coefficients (used for scoring) and optional activation gates:

```javascript
{
  id: "prototype_id",
  weights: {
    "axis_name": 0.6,    // Scalar coefficient in [-1, 1]
    "axis_name": -0.3    // Negative = anti-correlation with axis
  },
  gates: [               // Optional activation prerequisites
    "axis_name >= 0.10"
  ]
}
```

**Important distinction**:
- **Weights**: Scalar coefficients in [-1, 1] that determine how strongly an axis influences the prototype's score
- **Gates**: Optional prerequisite conditions that must be satisfied for the prototype to activate
- **Axis values**: The actual state values (e.g., `sexual_arousal`), typically in [0, 1]

The PCA analysis operates on **weights**, not gates, to answer: "Are the axes sufficient to describe emotional variation?"

---

## 2. Architecture

### Component Hierarchy

```
AxisGapAnalyzer (Orchestrator)
├── PCAAnalysisService
│   └── Uses: vectorMathUtils, statisticalUtils
├── HubPrototypeDetector
│   └── Uses: Brandes' betweenness centrality algorithm
├── CoverageGapDetector
│   └── Uses: vectorMathUtils, DBSCAN clustering
├── MultiAxisConflictDetector
│   └── Uses: Tukey's fence (IQR-based outlier detection)
├── AxisGapReportSynthesizer
└── AxisGapRecommendationBuilder
```

### Data Flow

1. **Input**: Array of prototypes with axis weights
2. **Preprocessing**: Build weight matrix (prototypes × axes)
3. **Analysis**: Run 4 detection phases in parallel
4. **Synthesis**: Combine findings into structured report
5. **Output**: JSON report with findings and recommendations

---

## 3. Phase 1: PCA Analysis

**File**: `src/expressionDiagnostics/services/axisGap/PCAAnalysisService.js`

### 3.1 Purpose

Principal Component Analysis determines:
- The effective dimensionality of the axis space
- Which axes are redundant (highly correlated)
- Reconstruction error for each prototype

### 3.2 Algorithm Steps

#### Step 1: Build Weight Matrix

```javascript
// For each prototype, extract weight coefficient for each axis
matrix[i][j] = prototype.weights[axis_j] ?? 0
// Missing weights default to 0 (neutral influence)
```

**Note**: The analysis uses weight coefficients, not activation gates. This answers "can axes represent prototype patterns?" through the influence each axis has on prototype scoring.

**Dimensions**: `n × m` where n = prototypes, m = axes

#### Step 2: Center the Data

```javascript
// Compute column means
means[j] = sum(matrix[i][j] for all i) / n

// Subtract means from each element
centered[i][j] = matrix[i][j] - means[j]
```

#### Step 3: Compute Covariance Matrix

```javascript
// Covariance matrix C is m × m
C[j][k] = sum(centered[i][j] * centered[i][k] for all i) / (n - 1)
```

**Note**: Uses `n - 1` (Bessel's correction) for unbiased estimation.

#### Step 4: Jacobi Eigendecomposition

The Jacobi algorithm iteratively diagonalizes the covariance matrix through rotation matrices.

```javascript
// Initialize
eigenvalues = diagonal(C)
eigenvectors = identity matrix

// Iterate until convergence
while (offDiagonalNorm > tolerance && iterations < maxIterations) {
  // Find largest off-diagonal element
  [p, q] = findMaxOffDiagonal(C)

  // Compute rotation angle (Jacobi rotation)
  theta = 0.5 * atan2(2 * C[p][q], C[q][q] - C[p][p])

  // Build rotation matrix
  cos_t = cos(theta)
  sin_t = sin(theta)

  // Apply rotation: C' = J^T * C * J
  // Update columns/rows p and q only

  // Accumulate eigenvectors
  eigenvectors = eigenvectors * J
}
```

**Configuration**:
- `maxIterations`: 100
- `tolerance`: 1e-10

**Potential Issue**: The tolerance is hardcoded. For very small eigenvalues, numerical precision issues may occur.

#### Step 5: Sort by Variance Explained

```javascript
// Sort eigenvalues descending
// Reorder eigenvectors to match
// Compute variance explained
totalVariance = sum(eigenvalues)
varianceExplained[i] = eigenvalues[i] / totalVariance
cumulativeVariance[i] = sum(varianceExplained[0..i])
```

#### Step 6: Determine Significant Components (Broken-Stick Distribution)

The broken-stick distribution provides a null hypothesis for random eigenvalue magnitudes.

```javascript
// Broken-stick expected proportion for component k of p total:
brokenStick[k] = (1/p) * sum(1/j for j = k+1 to p)

// A component is significant if:
varianceExplained[k] > brokenStick[k]
```

**Mathematical Formula**:
$$E[L_k] = \frac{1}{p} \sum_{j=k}^{p} \frac{1}{j}$$

Where:
- $E[L_k]$ = expected proportion of variance for component k
- $p$ = total number of components

**Potential Issue**: Broken-stick is conservative for highly correlated data. Consider Kaiser criterion (eigenvalue > 1) as alternative.

#### Step 7: Compute Reconstruction Errors

For each prototype, compute how well it's represented by the significant components:

```javascript
// Project prototype onto principal components
projection = centered_vector * eigenvectors[:, 0:k]

// Reconstruct
reconstructed = projection * eigenvectors[:, 0:k].T + means

// Compute error
error = magnitude(original - reconstructed) / magnitude(original)
```

**Configuration**:
- `pcaResidualVarianceThreshold`: 0.15 (15% unexplained variance is acceptable)

#### Step 8: Identify Extreme Prototypes

Prototypes at the extremes of each principal component:

```javascript
// Project all prototypes
scores = centered_matrix * eigenvectors

// For each component, find min and max scores
// Mark prototypes within threshold of min/max as extreme
extremeThreshold = (max - min) * 0.1  // 10% of range
```

### 3.3 Output Structure

```javascript
{
  effectiveDimensions: number,        // Count of significant components
  totalAxes: number,
  varianceExplained: number[],        // Per-component
  cumulativeVariance: number[],
  significantComponents: [{
    index: number,
    varianceExplained: number,
    topLoadings: [{ axis, loading }]  // Top 3 loadings
  }],
  reconstructionErrors: [{
    prototypeId: string,
    error: number,
    isOutlier: boolean
  }],
  extremePrototypes: [{
    prototypeId: string,
    componentIndex: number,
    extremeType: 'min' | 'max',
    score: number
  }]
}
```

---

## 4. Phase 2: Hub Prototype Detection

**File**: `src/expressionDiagnostics/services/axisGap/HubPrototypeDetector.js`

### 4.1 Purpose

Identify prototypes that:
- Connect many axes (high degree)
- Serve as bridges between axis clusters (high betweenness centrality)
- May indicate over-constrained or pivotal expressions

### 4.2 Graph Construction

Build a bipartite-like graph:
- **Nodes**: Prototypes and Axes
- **Edges**: Prototype-to-Axis when prototype has a non-zero weight on that axis

```javascript
// Adjacency representation
edges = []
for each prototype:
  for each axis in prototype.weights:
    const weight = prototype.weights[axis]
    if (weight !== 0) {
      edges.push({ prototype, axis, weight: Math.abs(weight) })
    }

// Edge weight = absolute value of weight coefficient (magnitude of influence)
```

### 4.3 Brandes' Algorithm for Betweenness Centrality

Betweenness centrality measures how often a node lies on shortest paths between other nodes.

**Algorithm**:

```javascript
function computeBetweennessCentrality(nodes, edges) {
  const centrality = new Map()  // node -> centrality score
  nodes.forEach(n => centrality.set(n, 0))

  for each source node s:
    // BFS from s
    const stack = []
    const predecessors = new Map()  // node -> list of predecessors
    const sigma = new Map()         // node -> number of shortest paths
    const distance = new Map()      // node -> distance from s

    sigma.set(s, 1)
    distance.set(s, 0)

    queue = [s]
    while queue not empty:
      v = queue.shift()
      stack.push(v)

      for each neighbor w of v:
        if distance[w] not set:
          distance.set(w, distance[v] + 1)
          queue.push(w)

        if distance[w] === distance[v] + 1:
          sigma[w] += sigma[v]
          predecessors[w].push(v)

    // Backpropagation
    const delta = new Map()  // node -> dependency
    nodes.forEach(n => delta.set(n, 0))

    while stack not empty:
      w = stack.pop()
      for each v in predecessors[w]:
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])

      if w !== s:
        centrality[w] += delta[w]

  // Normalize by (n-1)(n-2)/2 for undirected graphs
  return centrality
}
```

**Time Complexity**: O(V × E) where V = nodes, E = edges

### 4.4 Hub Scoring Formula

```javascript
hubScore = degree * (1 - variance)
```

Where:
- `degree`: Number of axes the prototype constrains
- `variance`: Variance of weight magnitudes across axes

**Rationale**: High degree with consistent weight magnitudes indicates a balanced hub.

### 4.5 Hub Classification

```javascript
isHub = degree >= minDegree &&
        betweennessCentrality >= minBetweenness &&
        hubScore >= minHubScore
```

**Configuration**:
- `hubMinDegree`: 4
- `hubMinBetweenness`: 0.1
- `hubMinScore`: 0.5

### 4.6 Output Structure

```javascript
{
  hubs: [{
    prototypeId: string,
    degree: number,
    betweennessCentrality: number,
    hubScore: number,
    connectedAxes: string[]
  }],
  axisClusters: [{
    axes: string[],
    bridgingPrototypes: string[]
  }]
}
```

---

## 5. Phase 3: Coverage Gap Detection

**File**: `src/expressionDiagnostics/services/axisGap/CoverageGapDetector.js`

### 5.1 Purpose

Identify regions of the axis space that lack prototype coverage:
- Sparse regions where no prototypes exist
- Axis value ranges that are underrepresented
- Potential blind spots in the expression system

### 5.2 Algorithm Overview

1. Build prototype vectors in axis space
2. Compute pairwise distances
3. Identify clusters of prototypes
4. Find gaps between clusters
5. Score gaps by magnitude and isolation

### 5.3 Vector Representation

```javascript
// For each prototype, create a vector
vector[i] = prototype.weights[axis_i] ?? 0
// Missing weights = 0 (neutral)
```

### 5.4 Distance Metrics

#### Cosine Distance

```javascript
cosineDistance(a, b) = 1 - cosineSimilarity(a, b)

cosineSimilarity(a, b) = dotProduct(a, b) / (magnitude(a) * magnitude(b))
```

**Note**: Cosine distance measures angular difference, not magnitude difference.

#### Subspace Distance (Multi-dimensional)

For k-dimensional subspace analysis:

```javascript
// Project point onto k-dimensional subspace defined by axes
function subspaceDistance(point, subspaceAxes, referencePoints) {
  // Extract only the subspace dimensions
  projectedPoint = point.filter(axes in subspaceAxes)

  // Find nearest reference point in subspace
  minDist = Infinity
  for each ref in referencePoints:
    projectedRef = ref.filter(axes in subspaceAxes)
    dist = euclideanDistance(projectedPoint, projectedRef)
    minDist = min(minDist, dist)

  return minDist
}
```

### 5.5 Clustering Methods

#### Profile-Based Clustering (Default)

Groups prototypes by similar constraint profiles:

```javascript
function clusterByProfile(prototypes, threshold) {
  clusters = []

  for each prototype:
    bestCluster = null
    bestSimilarity = 0

    for each cluster:
      similarity = computeProfileSimilarity(prototype, cluster.centroid)
      if similarity > threshold && similarity > bestSimilarity:
        bestCluster = cluster
        bestSimilarity = similarity

    if bestCluster:
      bestCluster.add(prototype)
      updateCentroid(bestCluster)
    else:
      clusters.push(new Cluster([prototype]))

  return clusters
}
```

#### DBSCAN Clustering (Alternative)

Density-based clustering for arbitrary-shaped clusters:

```javascript
function dbscan(points, epsilon, minPoints) {
  labels = array of UNDEFINED
  clusterId = 0

  for each point P:
    if labels[P] !== UNDEFINED:
      continue

    neighbors = rangeQuery(P, epsilon)

    if neighbors.length < minPoints:
      labels[P] = NOISE
      continue

    clusterId++
    labels[P] = clusterId
    seedSet = neighbors.filter(n => n !== P)

    while seedSet not empty:
      Q = seedSet.pop()
      if labels[Q] === NOISE:
        labels[Q] = clusterId
      if labels[Q] !== UNDEFINED:
        continue

      labels[Q] = clusterId
      neighborsQ = rangeQuery(Q, epsilon)
      if neighborsQ.length >= minPoints:
        seedSet.addAll(neighborsQ)

  return labels
}
```

**Configuration**:
- `clusteringMethod`: 'profile' | 'dbscan'
- `dbscanEpsilon`: 0.3
- `dbscanMinPoints`: 3

### 5.6 Gap Detection

#### Step 1: Compute Cluster Centroids

```javascript
centroid = average of all vectors in cluster
```

#### Step 2: Find Inter-Cluster Gaps

```javascript
for each pair of clusters (A, B):
  distance = cosineDistance(centroid_A, centroid_B)
  midpoint = (centroid_A + centroid_B) / 2

  // Check if midpoint is far from all prototypes
  nearestPrototypeDist = min distance from midpoint to any prototype

  if nearestPrototypeDist > gapThreshold:
    gaps.push({ midpoint, distance, clusters: [A, B] })
```

#### Step 3: Subspace Gap Analysis

Check for gaps in k-dimensional subspaces (k = 1, 2, 3):

```javascript
for k = 1 to 3:
  for each combination of k axes:
    // Project all prototypes onto this subspace
    projected = project(prototypes, axes)

    // Find coverage gaps in subspace
    gaps = findGapsInSubspace(projected, axes)
```

### 5.7 Gap Scoring Formula

```javascript
gapScore = distanceToNearestAxis * log1p(magnitude * clusterSize)
```

Where:
- `distanceToNearestAxis`: How far the gap is from existing coverage
- `magnitude`: Size of the gap region
- `clusterSize`: Number of prototypes defining the boundary

**Rationale**: Larger gaps between larger clusters are more significant.

### 5.8 Output Structure

```javascript
{
  gaps: [{
    location: number[],         // Vector in axis space
    nearestPrototypes: string[],
    distance: number,
    score: number,
    affectedAxes: string[]
  }],
  underrepresentedAxes: [{
    axis: string,
    coverage: number,           // 0-1 coverage ratio
    missingRanges: [{ min, max }]
  }],
  subspaceGaps: [{
    dimensions: string[],
    gapRegion: { min: number[], max: number[] },
    severity: number
  }]
}
```

---

## 6. Phase 4: Multi-Axis Conflict Detection

**File**: `src/expressionDiagnostics/services/axisGap/MultiAxisConflictDetector.js`

### 6.1 Purpose

Identify prototypes with potentially contradictory axis loadings:
- High positive on one axis, high negative on another (when semantically conflicting)
- Unusual combinations that may indicate errors
- Statistical outliers in axis loading patterns

### 6.2 Conflict Detection Methods

#### Method 1: Tukey's Fence (IQR-Based Outlier Detection)

```javascript
function detectOutliers(values, k = 1.5) {
  sorted = sort(values)
  Q1 = percentile(sorted, 25)
  Q3 = percentile(sorted, 75)
  IQR = Q3 - Q1

  lowerFence = Q1 - k * IQR
  upperFence = Q3 + k * IQR

  outliers = values.filter(v => v < lowerFence || v > upperFence)
  return outliers
}
```

**Configuration**:
- `outlierIQRMultiplier`: 1.5 (standard Tukey)
- For strict detection: 3.0 (extreme outliers only)

#### Method 2: High Axis Loading Detection

```javascript
function findHighLoadings(prototype, threshold) {
  highLoadings = []

  for each [axis, weight] of prototype.weights:
    if abs(weight) >= threshold:
      highLoadings.push({
        axis,
        value: weight,
        sign: weight > 0 ? 'positive' : 'negative'
      })

  return highLoadings
}
```

**Configuration**:
- `highLoadingThreshold`: 0.7 (70% of axis range)

### 6.3 Sign Tension Detection

Detect mixed positive/negative loadings:

```javascript
function detectSignTension(highLoadings) {
  positives = highLoadings.filter(l => l.sign === 'positive')
  negatives = highLoadings.filter(l => l.sign === 'negative')

  if positives.length > 0 && negatives.length > 0:
    // Compute tension score
    tensionScore = min(positives.length, negatives.length) /
                   max(positives.length, negatives.length)

    return {
      hasTension: true,
      positiveAxes: positives.map(l => l.axis),
      negativeAxes: negatives.map(l => l.axis),
      tensionScore
    }

  return { hasTension: false }
}
```

### 6.4 Semantic Conflict Rules

**Note**: This analysis operates on weight coefficients. Mixed positive/negative weights represent opposing influences on the emotion score, which is semantically meaningful (not a bug). For example, a prototype with `{engagement: 0.6, withdrawal: -0.4}` indicates the emotion is positively correlated with engagement and negatively correlated with withdrawal.

Some axis pairs are semantically expected to conflict:

> **Note**: The following is illustrative pseudo-code showing one possible approach to semantic conflict detection. The actual implementation in `MultiAxisConflictDetector.js` uses statistical methods (Tukey's fence with IQR-based outlier detection) rather than hardcoded conflict pairs. This pseudo-code is provided for conceptual understanding only.

```javascript
const CONFLICTING_PAIRS = [
  ['valence', 'arousal'],      // Calm-positive vs agitated-negative
  ['dominance', 'submission'],  // Power dynamics
  // ... defined in configuration
]

function checkSemanticConflicts(prototype) {
  conflicts = []

  for each [axis1, axis2] of CONFLICTING_PAIRS:
    if hasConstraint(prototype, axis1) && hasConstraint(prototype, axis2):
      value1 = getMidpoint(prototype, axis1)
      value2 = getMidpoint(prototype, axis2)

      // Both high magnitude with opposite signs = expected
      // Both high magnitude with same sign = potential conflict
      if sameSign(value1, value2) && abs(value1) > 0.5 && abs(value2) > 0.5:
        conflicts.push({ axis1, axis2, values: [value1, value2] })

  return conflicts
}
```

### 6.5 Output Structure

```javascript
{
  conflicts: [{
    prototypeId: string,
    conflictType: 'statistical_outlier' | 'sign_tension' | 'semantic_conflict',
    severity: 'low' | 'medium' | 'high',
    details: {
      affectedAxes: string[],
      values: number[],
      reason: string
    }
  }],
  statisticalSummary: {
    outlierCount: number,
    tensionCount: number,
    semanticConflictCount: number
  }
}
```

---

## 7. Phase 5: Report Synthesis

**Files**:
- `src/expressionDiagnostics/services/axisGap/AxisGapReportSynthesizer.js`
- `src/expressionDiagnostics/services/axisGap/AxisGapRecommendationBuilder.js`

### 7.1 Synthesis Process

Combine findings from all phases into coherent report:

```javascript
function synthesize(pcaResults, hubResults, gapResults, conflictResults) {
  return {
    summary: generateExecutiveSummary(),
    dimensionalAnalysis: {
      effectiveDimensions: pcaResults.effectiveDimensions,
      redundantAxes: identifyRedundantAxes(pcaResults),
      keyComponents: pcaResults.significantComponents
    },
    hubAnalysis: {
      hubCount: hubResults.hubs.length,
      topHubs: hubResults.hubs.slice(0, 5),
      clusterStructure: hubResults.axisClusters
    },
    coverageAnalysis: {
      gapCount: gapResults.gaps.length,
      criticalGaps: gapResults.gaps.filter(g => g.score > threshold),
      underrepresentedAxes: gapResults.underrepresentedAxes
    },
    conflictAnalysis: {
      conflictCount: conflictResults.conflicts.length,
      highSeverityConflicts: conflictResults.conflicts.filter(c => c.severity === 'high')
    },
    recommendations: generateRecommendations()
  }
}
```

### 7.2 Recommendation Generation

```javascript
function generateRecommendations(findings) {
  recommendations = []

  // PCA-based recommendations
  if (findings.redundantAxes.length > 0) {
    recommendations.push({
      type: 'axis_consolidation',
      priority: 'medium',
      message: `Consider consolidating axes: ${redundantAxes.join(', ')}`,
      affectedItems: redundantAxes
    })
  }

  // Gap-based recommendations
  for each gap in findings.criticalGaps:
    recommendations.push({
      type: 'coverage_gap',
      priority: gap.score > 0.8 ? 'high' : 'medium',
      message: `Add prototypes covering ${gap.affectedAxes.join(', ')}`,
      suggestedLocation: gap.location
    })

  // Conflict-based recommendations
  for each conflict in findings.highSeverityConflicts:
    recommendations.push({
      type: 'conflict_resolution',
      priority: 'high',
      message: `Review ${conflict.prototypeId} for axis conflicts`,
      details: conflict.details
    })

  return recommendations.sort(byPriority)
}
```

### 7.3 Priority Scoring

```javascript
priorityScore = {
  'high': 3,
  'medium': 2,
  'low': 1
}

// Aggregate priority for prototype
prototypeRiskScore = sum(
  findings.filter(f => f.prototypeId === id)
         .map(f => priorityScore[f.priority])
)
```

---

## 8. Utility Functions

**Files**:
- `src/expressionDiagnostics/utils/vectorMathUtils.js`
- `src/expressionDiagnostics/utils/statisticalUtils.js`

### 8.1 Vector Math Utilities

#### Magnitude (Euclidean Norm)

```javascript
function magnitude(vector) {
  return Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
}
```

#### Normalization

```javascript
function normalize(vector) {
  const mag = magnitude(vector)
  if (mag === 0) return vector.map(() => 0)
  return vector.map(v => v / mag)
}
```

#### Dot Product

```javascript
function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0)
}
```

#### Cosine Similarity

```javascript
function cosineSimilarity(a, b) {
  const dot = dotProduct(a, b)
  const magA = magnitude(a)
  const magB = magnitude(b)

  if (magA === 0 || magB === 0) return 0
  return dot / (magA * magB)
}
```

#### Cosine Distance

```javascript
function cosineDistance(a, b) {
  return 1 - cosineSimilarity(a, b)
}
```

**Potential Issue**: `cosineDistance` returns values in [0, 2], not [0, 1]. This may cause unexpected behavior if callers assume [0, 1] range.

#### Subspace Projection

```javascript
function projectToSubspace(point, axisIndices) {
  return axisIndices.map(i => point[i])
}

function subspaceDistance(point, subspaceAxes, referencePoints) {
  const projected = projectToSubspace(point, subspaceAxes)

  let minDist = Infinity
  for (const ref of referencePoints) {
    const projRef = projectToSubspace(ref, subspaceAxes)
    const dist = euclideanDistance(projected, projRef)
    minDist = Math.min(minDist, dist)
  }

  return minDist
}
```

### 8.2 Statistical Utilities

#### Median and IQR

```javascript
function computeMedianAndIQR(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length

  const median = n % 2 === 0
    ? (sorted[n/2 - 1] + sorted[n/2]) / 2
    : sorted[Math.floor(n/2)]

  const q1Index = Math.floor(n * 0.25)
  const q3Index = Math.floor(n * 0.75)

  const Q1 = sorted[q1Index]
  const Q3 = sorted[q3Index]
  const IQR = Q3 - Q1

  return { median, Q1, Q3, IQR }
}
```

**Potential Issue**: Percentile calculation uses floor, which may be slightly inaccurate for small sample sizes. Consider linear interpolation.

#### Broken-Stick Distribution

```javascript
function computeBrokenStickDistribution(p) {
  const distribution = []

  for (let k = 0; k < p; k++) {
    let sum = 0
    for (let j = k + 1; j <= p; j++) {
      sum += 1 / j
    }
    distribution[k] = sum / p
  }

  return distribution
}

function countSignificantComponentsBrokenStick(eigenvalues) {
  const totalVariance = eigenvalues.reduce((a, b) => a + b, 0)
  const proportions = eigenvalues.map(e => e / totalVariance)
  const brokenStick = computeBrokenStickDistribution(eigenvalues.length)

  let count = 0
  for (let i = 0; i < proportions.length; i++) {
    if (proportions[i] > brokenStick[i]) {
      count++
    } else {
      break  // Stop at first non-significant component
    }
  }

  return count
}
```

**Potential Issue**: The early break assumes components are sorted by variance. If eigenvalues aren't sorted, this will fail silently.

#### Wilson Confidence Interval

```javascript
function wilsonConfidenceInterval(successes, trials, confidence = 0.95) {
  if (trials === 0) return { lower: 0, upper: 0 }

  const z = 1.96  // For 95% confidence
  const p = successes / trials
  const n = trials

  const denominator = 1 + z * z / n
  const center = p + z * z / (2 * n)
  const spread = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)

  return {
    lower: Math.max(0, (center - spread) / denominator),
    upper: Math.min(1, (center + spread) / denominator)
  }
}
```

---

## 9. Configuration Parameters

**File**: `src/expressionDiagnostics/config/prototypeOverlapConfig.js`

### 9.1 PCA Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `pcaEnabled` | true | Enable PCA analysis |
| `pcaResidualVarianceThreshold` | 0.15 | Max acceptable reconstruction error |
| `pcaMinVarianceExplained` | 0.05 | Min variance for component significance |
| `pcaComponentSignificanceMethod` | 'broken-stick' | Method for component significance ('broken-stick' or 'kaiser') |
| `pcaNormalizationMethod` | 'center-only' | Normalization method ('center-only' or 'z-score') |
| `pcaExpectedDimensionMethod` | 'variance-80' | Method for computing expected K |
| `pcaMinAxisUsageRatio` | 0.1 | Min fraction of prototypes using axis for PCA inclusion |
| `jacobiConvergenceTolerance` | 1e-10 | Jacobi algorithm convergence tolerance |
| `jacobiMaxIterationsOverride` | null | Override for max iterations (null = 50*n²) |

### 9.2 Hub Detection Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `hubMinDegree` | 4 | Floor for minimum axis connections (see adaptive behavior below) |
| `hubMinDegreeRatio` | 0.1 | Minimum degree as fraction of total nodes (adaptive scaling) |
| `hubMaxEdgeWeight` | 0.9 | Maximum edge weight threshold (filters near-duplicates) |
| `hubMinNeighborhoodDiversity` | 2 | Minimum distinct clusters among neighbors |
| `hubBetweennessWeight` | 0.3 | Weight for betweenness in hub scoring |
| `hubMinBetweenness` | 0.1 | Minimum betweenness centrality |
| `hubMinScore` | 0.5 | Minimum hub score |

#### Adaptive Degree Threshold

The effective minimum degree is computed adaptively at runtime:

```javascript
const hubMinDegree = Math.max(
  degreeFloor,                        // Fixed floor (default: 4)
  Math.floor(numNodes * degreeRatio)  // Scales with graph size
);
```

For a graph with 100 prototypes and `hubMinDegreeRatio: 0.1`, the effective threshold is `max(4, 10) = 10`.

### 9.3 Coverage Gap Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `clusteringMethod` | 'profile' | 'profile' or 'dbscan' |
| `dbscanEpsilon` | 0.3 | DBSCAN neighborhood radius |
| `dbscanMinPoints` | 3 | DBSCAN minimum cluster size |
| `gapDistanceThreshold` | 0.5 | Minimum distance to classify as gap |
| `subspaceMaxDimensions` | 3 | Maximum subspace dimensions to check |

### 9.4 Conflict Detection Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `outlierIQRMultiplier` | 1.5 | Tukey's fence multiplier |
| `highLoadingThreshold` | 0.7 | Threshold for high axis loading |
| `signTensionEnabled` | true | Enable sign tension detection |
| `semanticConflictsEnabled` | true | Enable semantic conflict rules |

### 9.5 Report Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxRecommendations` | 20 | Maximum recommendations to generate |
| `minSeverityForReport` | 'low' | Minimum severity to include |
| `includeStatisticalDetails` | true | Include raw statistics |

---

## 10. Potential Issues and Improvement Areas

### 10.1 Mathematical/Statistical Issues

#### Issue 1: Cosine Distance Range (NOT AN ISSUE)
**Location**: `vectorMathUtils.js:cosineDistance()`
**Original Concern**: Returns values in [0, 2] range
**Status**: ✅ Already correct — function uses `clamp01()` to guarantee [0, 1] output.
**Evidence**: Tests verify clamping behavior for opposite vectors.

#### Issue 2: Percentile Calculation (DESIGN CHOICE)
**Location**: `statisticalUtils.js:computeMedianAndIQR()`
**Original Concern**: Uses simple floor indexing for quartiles
**Status**: ✅ Valid method — uses "lower" percentile method (Type 1), which is a standard
statistical approach. Different from interpolated methods but equally correct.
For the axis-space-analysis use case with 100+ prototypes, this is adequate.

#### Issue 3: Broken-Stick Early Termination (CORRECT BY DESIGN)
**Location**: `statisticalUtils.js:countSignificantComponentsBrokenStick()`
**Original Concern**: May miss significant components after a non-significant one
**Status**: ✅ Mathematically correct — eigenvalues are sorted descending and broken-stick
thresholds decrease monotonically. If component k fails its threshold, component k+1
(smaller eigenvalue, smaller threshold) will also fail. Early termination is correct.

#### Issue 4: Jacobi Convergence (RESOLVED)
**Location**: `PCAAnalysisService.js:#computeEigenDecomposition()`
**Original Concern**: Hardcoded tolerance (1e-10) not configurable
**Status**: ✅ Fixed — tolerance is now configurable via `jacobiConvergenceTolerance`
in `prototypeOverlapConfig.js`. Default remains 1e-10 for backward compatibility.

**Configuration Options**:
- `jacobiConvergenceTolerance`: Controls convergence threshold (default: 1e-10)
- `jacobiMaxIterationsOverride`: Override max iterations formula (default: null, uses 50*n²)

### 10.2 Algorithmic Issues

#### Issue 5: Profile Clustering Determinism (NOT AN ISSUE)
**Location**: `CoverageGapDetector.js` (report incorrectly cited `clusterByProfile()`)
**Original Concern**: Cluster assignment depends on iteration order.
**Status**: ✅ NOT AN ISSUE - Already resolved
**Analysis**:
- The function name in the original report was incorrect; the actual function is `extractClusters()` (lines 205-228)
- The implementation already produces deterministic output via sorting at line 174:
  ```javascript
  centroidPrototypes: memberIds.slice().sort(),
  ```
- The function performs simple grouping by existing cluster IDs, not hashing-based assignment
- No non-determinism is present in the implementation

#### Issue 6: Hub Score Formula - Variance Normalization (FIXED)
**Location**: `HubPrototypeDetector.js:computeHubScore()` (lines 321-340)
**Original Problem**: Formula `degree * (1 - clampedVariance)` used `clamp01(variance)` which was ineffective.
**Root Cause**:
- Edge weights are clamped to [0, 1]
- Maximum variance for [0,1] bounded values is 0.25 (achieved when half are 0 and half are 1)
- `clamp01(variance)` was ineffective since variance never exceeds 0.25
- The penalty range was compressed to 0-25% instead of the intended 0-100%

**Status**: ✅ FIXED
**Solution Applied**:
```javascript
// Maximum variance for [0,1] bounded values is 0.25 (half 0s, half 1s)
// Normalize to [0, 1] range for full penalty spectrum
const MAX_VARIANCE_FOR_UNIT_INTERVAL = 0.25;
const normalizedVariance = clamp01(variance / MAX_VARIANCE_FOR_UNIT_INTERVAL);

const score = degree * (1 - normalizedVariance);
```

**Behavior After Fix**:
- Uniform weights (variance = 0): Full degree score (e.g., 4 edges → score = 4)
- Maximum variance (half 0s, half 1s): Score = 0 (full penalty)
- Intermediate variance: Proportional penalty
- Test coverage added in `HubPrototypeDetector.test.js`

#### Issue 7: Subspace Gap Combinatorial Explosion (INTENTIONAL DESIGN)
**Location**: `CoverageGapDetector.js`
**Original Concern**: Checks all k-combinations of axes for k=1,2,3.
**Complexity**: O(n³) for 3D subspaces; slow for many axes.
**Status**: ✅ INTENTIONAL DESIGN - No change required
**Rationale**:
- The report explicitly states: "don't kneecap thoroughness for speed"
- O(n³) complexity is acceptable for typical axis counts (6-15 axes)
- Thorough gap detection is more valuable than speed optimization
- The behavior is configurable via `coverageGapMaxSubspaceDimension` parameter (default: 3)
- If performance becomes an issue for very large axis counts, the configuration can be adjusted

### 10.3 Edge Cases

#### Issue 8: Empty or Single Prototype (NOT AN ISSUE)
**Original Concern**: Many algorithms assume multiple prototypes, causing division by zero, empty arrays, undefined behavior.
**Status**: ✅ NOT AN ISSUE - Comprehensive guards already exist
**Evidence**:
- **PCAAnalysisService.js**: Guards at lines 81, 88, 426 prevent processing with n < 2; returns empty result
- **HubPrototypeDetector.js**: Guards at lines 62, 66-69, 217, 289 handle isolated nodes; empty array on 0/1 prototypes
- **CoverageGapDetector.js**: Guards at lines 82-85, 95-97, 101-103 return empty results for insufficient data
**Test Coverage**: All three services have explicit unit tests for 0, 1, and 2 prototype scenarios.

#### Issue 9: All Identical Prototypes (NOT AN ISSUE)
**Original Concern**: Zero variance in constraint values causes PCA eigenvalues = 0, single cluster, betweenness = 0.
**Status**: ✅ NOT AN ISSUE - Behavior handled correctly
**Evidence**:
- **PCAAnalysisService.js**: Zero variance detection at lines 100-102 returns empty result (no significant components)
- **CoverageGapDetector.js**: Subspace distance check correctly identifies identical prototypes as "not a gap" (distance = 0)
- **HubPrototypeDetector.js**: Degree + diversity filters naturally exclude identical prototypes from hub classification
**Test Coverage**: Unit tests exist; integration test added at `tests/integration/expression-diagnostics/allIdenticalPrototypes.integration.test.js` to document expected behavior and prevent regression.

#### Issue 10: Missing Axis Constraints (DESIGN CHOICE)
**Original Concern**: Prototypes may have sparse constraint coverage; missing values treated as 0 may not be semantically correct.
**Status**: ✅ DESIGN CHOICE - Behavior is intentional and semantically correct
**Rationale**:
- Axes are normalized to [-1, 1] where 0 represents the neutral midpoint
- "No constraint on axis" semantically equals "neutral stance" = 0
- This is consistent across all services: PCA (line 274), CoverageGapDetector (line 297)
- Alternative approaches (NaN, random, extremes) would break mathematical operations or introduce incorrect semantics
- For sparse axis filtering, the `pcaMinAxisUsageRatio` configuration parameter is available (default: 0.1)
**Recommendation**: No change required. Current behavior is correct. Users with domain-specific needs can adjust the sparse axis filtering threshold.

### 10.4 Performance Issues

#### Issue 11: Brandes' Algorithm Memory (INTENTIONAL DESIGN)
**Location**: `HubPrototypeDetector.js:computeBetweennessCentrality()`
**Original Concern**: O(V²) memory from storing all shortest paths
**Status**: ✅ INTENTIONAL DESIGN - No change required

**Analysis**:
- Memory is O(V) per BFS iteration, not O(V²) overall
- Maps are recreated each iteration (lines 223-231), allowing garbage collection
- Predecessor arrays grow proportionally to edge count, not V²
- For expected data sizes (100-500 prototypes), memory usage is acceptable (~1-5MB)
- Brandes' algorithm inherently requires tracking predecessors for correct betweenness calculation

**Recommendation**: No optimization needed. The algorithm is correct and performant for expected use cases.

#### Issue 12: DBSCAN Range Query (PARTIAL FIX)
**Location**: `densityClustering.js`
**Original Concern**: Naive O(n²) distance computation
**Status**: ✅ PARTIALLY FIXED

**Sub-issue A - Range Query Complexity**: INTENTIONAL DESIGN
- O(n²) range queries are inherent to DBSCAN without spatial indexing
- Spatial indexing (KD-tree, R-tree) would add significant complexity
- For expected data sizes (100-500 points), current approach is acceptable

**Sub-issue B - seedSet.includes() inefficiency**: FIXED
- Line 121 used `seedSet.includes(nn)` - O(n) linear search
- Inside O(n) cluster expansion loop, this created O(n²) behavior for cluster expansion
- **Fix applied**: Added `seedSetLookup` Set for O(1) membership testing
- Cluster expansion is now O(n) instead of O(n²)

**Recommendation**: No further optimization needed unless data sizes exceed 1000+ prototypes.

### 10.5 Configuration Issues

#### Issue 13: Threshold Sensitivity ✅ RESOLVED
**Problem**: Many thresholds interact non-linearly.
**Impact**: Small changes can dramatically affect results.
**Examples**:
- `hubMinDegree` + `hubMinBetweenness` together filter hubs
- `gapDistanceThreshold` + cluster size affect gap detection

**Resolution**: Implemented `PrototypeOverlapConfigValidator` class that validates:
- Ordering constraints (e.g., `activeAxisEpsilon < strongAxisThreshold`)
- Weight sums (composite weights, correlation weights must sum to 1.0)
- Pool size ordering (`quickAnalysisPoolSize <= sharedPoolSize <= deepAnalysisPoolSize`)
- Threshold dependency chains for near-miss detection
- Semantic warnings for potentially problematic configurations

**Location**: `src/expressionDiagnostics/config/prototypeOverlapConfigValidator.js`
**Test Coverage**: 94 tests, 92.9% statement coverage

#### Issue 14: Missing Validation ✅ RESOLVED
**Problem**: Configuration values not validated at load time.
**Impact**: Runtime errors from invalid configurations.

**Resolution**: Implemented comprehensive multi-layer validation in `PrototypeOverlapConfigValidator`:
1. **Basic validation**: Type checks, range validation for ~120 properties
   - Probability values [0, 1]
   - Correlation values [-1, 1]
   - Positive integers and numbers
   - Boolean and enum values
   - Array and object structure validation
2. **Threshold dependencies**: Ordering constraints and weight sums
3. **Axis gap specific**: PCA, DBSCAN, and candidate axis configuration consistency

**Validation Methods**:
- `validateConfig(config)`: Basic type/range validation
- `validateThresholdDependencies(config)`: Ordering and weight sum validation
- `validateAxisGapConfig(config)`: Axis gap-specific semantic validation
- `validateOrThrow(config)`: Fail-fast validation
- `performComprehensiveValidation(config)`: All layers combined

**Location**: `src/expressionDiagnostics/config/prototypeOverlapConfigValidator.js`
**Tests**: `tests/unit/expressionDiagnostics/config/prototypeOverlapConfigValidator.test.js`

### 10.6 Reporting Issues

#### Issue 15: Recommendation Conflicts ✅ RESOLVED
**Original Problem**: Different phases may generate contradictory recommendations.
**Example**: "Add prototype for gap X" vs "Remove hub near X"

**Status**: ✅ FIXED

**Solution Applied**: Implemented relationship detection using Jaccard similarity.
- Recommendations now include a deterministic `id` field for cross-referencing
- Optional `relationships` field tags overlapping, complementary, and potentially redundant recommendations
- Thresholds:
  - **≥70% overlap + same type** → `potentiallyRedundant`
  - **≥30% overlap + different types** → `complementary`
  - **30-70% overlap + same type** → `overlapping`
  - **<30% overlap** → no relationship (independent)

**Extended Recommendation Structure**:
```javascript
{
  id: "rec_new_axis_abc123",           // NEW: Deterministic ID
  priority: 'high' | 'medium' | 'low',
  type: 'NEW_AXIS' | 'INVESTIGATE' | 'REFINE_EXISTING',
  description: string,
  affectedPrototypes: string[],
  evidence: string[],
  relationships?: {                     // NEW: Optional, only when relationships exist
    overlapping?: [{ id, similarity, sharedPrototypes }],
    complementary?: [{ id, similarity, sharedPrototypes }],
    potentiallyRedundant?: [{ id, similarity, sharedPrototypes }]
  }
}
```

**Files Modified**: `src/expressionDiagnostics/services/axisGap/AxisGapRecommendationBuilder.js`
**Tests Added**: `tests/unit/expressionDiagnostics/services/axisGap/AxisGapRecommendationBuilder.test.js` (14 new tests)

#### Issue 16: Priority Score Aggregation ✅ NOT AN ISSUE
**Original Problem**: Simple sum doesn't account for recommendation type.
**Original Claim**: Many low-priority items can outweigh single high-priority item.

**Status**: ✅ NOT AN ISSUE - Original report was inaccurate

**Analysis**: No priority score aggregation exists in the codebase. The system uses:
1. **Sorting for ordering** (high → medium → low) via `sortByPriority()`
2. **Method-count-based thresholds for confidence**:
   - ≥3 methods triggered = high confidence
   - ≥2 methods triggered = medium confidence
   - <2 methods triggered = low confidence
3. **No summation of priority scores** occurs anywhere

The confidence calculation is based on how many independent detection methods (PCA, hubs, gaps, conflicts) produced signals, not on aggregating recommendation priorities. This is the correct approach.

---

## Appendix A: Data Structures

### A.1 Prototype Format

```typescript
interface Prototype {
  id: string;
  weights: {
    [axisName: string]: number;  // Scalar coefficient in [-1, 1]
  };
  gates?: string[];  // Optional activation prerequisites (e.g., "engagement >= 0.10")
}
```

**Clarification**: The PCA and hub detection analyses operate on `weights` (influence coefficients), not `gates` (activation prerequisites). This design choice means the analysis answers "Are the axes sufficient to describe emotional variation?" rather than "Do we have a prototype for every plausible emotional state?"

### A.2 Analysis Result Format

```typescript
interface AxisSpaceAnalysisResult {
  pca: PCAResult;
  hubs: HubResult;
  gaps: GapResult;
  conflicts: ConflictResult;
  synthesis: SynthesisResult;
  recommendations: Recommendation[];
  metadata: {
    analysisTime: number;
    prototypeCount: number;
    axisCount: number;
    version: string;
  };
}
```

---

## Appendix B: Algorithm Complexity Summary

| Component | Time Complexity | Space Complexity |
|-----------|----------------|------------------|
| PCA (Jacobi) | O(m³ × iterations) | O(m²) |
| Brandes' Betweenness | O(V × E) | O(V²) |
| Profile Clustering | O(n² × m) | O(n × m) |
| DBSCAN | O(n² × m) | O(n) |
| Gap Detection | O(n² + C²) | O(n × m) |
| Conflict Detection | O(n × m) | O(n) |

Where:
- n = number of prototypes
- m = number of axes
- V = nodes in graph (n + m)
- E = edges (prototype-axis weighted connections)
- C = number of clusters

---

## Appendix C: References

1. **Jacobi Eigenvalue Algorithm**: Golub, G.H. and Van Loan, C.F. (2013). Matrix Computations, 4th ed.
2. **Brandes' Algorithm**: Brandes, U. (2001). "A Faster Algorithm for Betweenness Centrality". Journal of Mathematical Sociology.
3. **Broken-Stick Distribution**: Jackson, D.A. (1993). "Stopping Rules in Principal Components Analysis". Ecology.
4. **DBSCAN**: Ester, M. et al. (1996). "A Density-Based Algorithm for Discovering Clusters". KDD.
5. **Tukey's Fence**: Tukey, J.W. (1977). Exploratory Data Analysis.
6. **Wilson Confidence Interval**: Wilson, E.B. (1927). "Probable Inference, the Law of Succession, and Statistical Inference". JASA.

---

## 11. ChatGPT Claims Assessment (2026-01-25)

This section documents an external review where ChatGPT incorrectly claimed bugs existed in the axis-space analysis system around "sexual axis" representations. After thorough investigation, **all claims were incorrect or based on misunderstanding the design**.

### 11.1 Claims Summary

| Claim | Assessment | Verdict |
|-------|------------|---------|
| Schema mismatch: `sexual_arousal` [-1,1] vs [0,1] | **Confusion**: Schema is for *weights* (which can be [-1,1]), not axis values. Description correctly notes axis values are [0,1]. | **Not a Bug** |
| `baseline_libido / 100` gives wrong values | Intentional design: baseline has 50% influence of excitation/inhibition | **Not a Bug** |
| Validation can't catch nonsense | Validation works correctly for the intended design | **Incorrect** |

### 11.2 Key Insight: Weights vs Axis Values

ChatGPT confused two distinct concepts:

1. **Axis values** (e.g., `sexual_arousal`): The actual state value, which is [0, 1] via `clamp01()`
2. **Weights**: Coefficients that multiply axis values to compute prototype scores, which are [-1, 1]

The schema at lines 47-50 of `sexual_prototypes.lookup.schema.json` defines **weight ranges** for `sexual_arousal`, not axis value ranges. Weights can be negative (anti-correlation). The description at line 10 correctly notes: "sexual_arousal is in [0, 1]" (referring to axis values).

### 11.3 Why the Formula is Correct

The formula in `EmotionCalculatorService.js`:

```javascript
sexual_arousal = clamp01((excitation - inhibition + baseline) / 100)
```

With:
- `sex_excitation` in [0, 100]
- `sex_inhibition` in [0, 100]
- `baseline_libido` in [-50, 50]

This is **intentional design**:
- `excitation - inhibition` contributes up to ±100 (normalized to ±1.0)
- `baseline_libido` contributes up to ±50 (normalized to ±0.5)
- Baseline has **50% influence** compared to excitation/inhibition by design
- `clamp01()` ensures final value is always [0, 1]

### 11.4 Real Issue Found

One minor JSDoc documentation error was discovered:

**File**: `src/emotions/emotionCalculatorService.js:30`
**Problem**: Said `baseline_libido: [0..100]` but actual range is `[-50..50]`
**Status**: ✅ Fixed

### 11.5 Existing Test Coverage

The system's correctness is already validated by existing tests:
- `tests/unit/emotions/emotionCalculatorService.test.js:194-203` - confirms clamping works
- `tests/unit/mods/core/components/sexualState.component.test.js` - validates [-50, 50] range
- `tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js` - validates baseline range

### 11.6 Lessons Learned

1. **Schema documentation is dual-purpose**: Weight ranges in prototype schemas are for scoring coefficients, not for axis value bounds
2. **Intentional asymmetric influence**: The 50% baseline influence is a design choice, not a bug
3. **Clamping guarantees bounds**: The `clamp01()` function ensures axis values are always valid regardless of intermediate calculations

---

## 12. ChatGPT Claims Assessment: Model Integrity and Analysis Methodology (2026-01-25)

This section documents a second external review where ChatGPT made claims about alleged deficiencies in the axis-space analysis system's model integrity and detection methodology. After thorough investigation, **all three claims were incorrect or based on misunderstanding the existing infrastructure**.

### 12.1 Claims Summary

| # | Claim | What ChatGPT Said | Reality | Verdict |
|---|-------|-------------------|---------|---------|
| 1 | Add Model Integrity Phase | "Fail fast if prototype references axis not in registry" | Already exists: `axisRegistryAudit.test.js`, `prototypeAxisConstants.js`, schema `additionalProperties: false` | **Already Exists** |
| 2 | Separate Weight-space and Gate-space | "Run both analyses then fuse" | Different feature request. Current design intentionally analyzes weights only (documented in Section 1) | **Out of Scope** |
| 3 | Replace Tukey Fence with Hack Detector | "Current method is wrong tool" | System uses 4 independent methods with corroboration. Tukey fence has `minIQRFloor=0.5` safeguard. Sign tensions are metadata-only | **Not Needed** |

### 12.2 Claim 1: Model Integrity Phase Already Exists

ChatGPT suggested adding a "fail fast" validation phase to detect when prototypes reference axes not in the registry. This infrastructure already exists at multiple levels:

#### 12.2.1 Centralized Axis Constants (`src/constants/prototypeAxisConstants.js`)

The system maintains a single source of truth for valid axes:

```javascript
export const SEXUAL_AXES = Object.freeze([
  'sexual_arousal', 'sex_excitation', 'sex_inhibition',
  'sexual_inhibition', 'baseline_libido',
]);

export const ALL_PROTOTYPE_WEIGHT_AXES = Object.freeze([
  ...EMOTION_AXES,
  ...MOOD_AXES,
  ...SEXUAL_AXES,
]);

export const ALL_PROTOTYPE_WEIGHT_AXES_SET = new Set(ALL_PROTOTYPE_WEIGHT_AXES);

export function isValidPrototypeWeightAxis(name) {
  return ALL_PROTOTYPE_WEIGHT_AXES_SET.has(name);
}
```

#### 12.2.2 Audit Test Suite (`tests/unit/expressionDiagnostics/axisRegistryAudit.test.js`)

Automated tests validate that all prototypes use only known axes:

```javascript
it('should only have weight keys that exist in the known axis registries', () => {
  const weightKeys = Object.keys(prototype.weights || {});
  weightKeys.forEach(key => {
    expect(ALL_PROTOTYPE_WEIGHT_AXES_SET.has(key)).toBe(true);
  });
});
```

#### 12.2.3 Schema Validation

Expression schemas use `additionalProperties: false` to reject unknown axis names at load time, providing fail-fast behavior before analysis even begins.

### 12.3 Claim 2: Weight-space vs Gate-space Analysis

ChatGPT suggested the system should analyze both "weight-space" (influence coefficients) and "gate-space" (activation conditions) separately, then fuse the results.

#### 12.3.1 Design Decision: Weight-Only Analysis

This suggestion represents a **different feature request**, not a bug in the current system. The axis-space analysis intentionally focuses on weight-space for the following reasons:

1. **Weights are the primary determinant** of which prototype activates given a mood state
2. **Gates are binary filters** that enable/disable prototypes entirely, not gradient influences
3. **Weight overlap** is the meaningful metric for expression similarity

#### 12.3.2 Section 1 Documentation

The current scope is documented in Section 1 of this report:
> "The analysis examines prototype weight vectors to identify dimensional inadequacy..."

Gate-space analysis would be a separate feature with different goals (e.g., "what mood states can never trigger any expression?").

### 12.4 Claim 3: Multi-Axis Conflict Detection Methodology

ChatGPT claimed that using Tukey's fence for multi-axis conflict detection is the "wrong tool" and should be replaced with a "hack detector."

#### 12.4.1 Four-Signal Corroboration Design

The system does not rely on any single detection method. It uses **four independent signals** that must corroborate:

| Signal | Method | Threshold | What It Detects |
|--------|--------|-----------|-----------------|
| PCA Analysis | Residual variance | >15% | Missing dimensions not captured by current axes |
| Hub Prototypes | Betweenness centrality | Statistical outliers | Prototypes connecting multiple clusters |
| Coverage Gaps | K-means + silhouette | Poor alignment | Behavioral clusters without matching axes |
| Multi-Axis Conflicts | Tukey's fence | 1.5×IQR above Q3 | Prototypes with unusually high axis counts |

#### 12.4.2 Tukey's Fence Safeguards

The multi-axis conflict detector includes protection against the concern ChatGPT raised:

```javascript
// Minimum IQR floor prevents false positives when variance is low
const minIQRFloor = 0.5;
const effectiveIQR = Math.max(iqr, minIQRFloor);
const upperFence = q3 + (1.5 * effectiveIQR);
```

The `minIQRFloor = 0.5` ensures that when all prototypes have similar axis counts (low variance), the fence doesn't collapse to an unreasonably tight range.

#### 12.4.3 Sign Tensions Are Metadata-Only

ChatGPT may have confused sign tensions with a detection method. As documented in the UI:
> **Note:** Mixed positive/negative weights are *normal* for emotional prototypes. This section shows structural patterns for understanding, not defects requiring action. Sign tensions **do not contribute to confidence scoring or recommendations**.

Sign tensions are purely informational metadata, not a signal used for verdict determination.

### 12.5 Why "MAYBE" Verdict with 0 Recommendations is Correct

ChatGPT questioned how the system could report a "MAYBE" verdict while showing 0 recommendations. This is **correct behavior**:

1. **MAYBE means uncertainty**, not "something is wrong"
2. The verdict reflects that **some signals were triggered** but not enough for confident action
3. **0 recommendations** means the system found no specific prototypes or axes to flag
4. This state indicates: "Worth monitoring, but no clear action items identified"

The decision logic (documented in the UI):
- **YES**: (High residual AND coverage gaps) OR (Hub prototypes AND multi-axis conflicts)
- **MAYBE**: High residual alone, OR any other single signal
- **NO**: Residual ≤15% AND no detection signals

### 12.6 Lessons Learned

1. **Validation exists at multiple layers**: Schema, constants, tests - not all visible in UI
2. **Weight-space vs gate-space** are different concerns with different analysis goals
3. **Multi-signal corroboration** is more robust than any single "hack detector"
4. **Uncertainty verdicts are valid** - "MAYBE" with no recommendations is a legitimate state

### 12.7 Action Taken

To prevent future confusion, the UI will be enhanced to display model integrity check status, making existing validation visible rather than hidden in tests and schemas.

---

## 13. ChatGPT Claims Assessment: Candidate Axis Validation (2026-01-25)

This section documents a third external review where ChatGPT made two claims about the axis-space analysis system. After thorough investigation, **one claim was a UI bug, the other was a misunderstanding of the intentional design**.

### 13.1 Claims Summary

| # | Claim | ChatGPT's Evidence | Actual Root Cause | Verdict |
|---|-------|-------------------|-------------------|---------|
| 1 | "Enable candidate-axis validation (and make it automatic)" | Report shows "No candidate axes analyzed (validation may be disabled)." | **UI message was misleading**. Validation IS enabled; the extractor found 0 candidates (PCA: 0 significant beyond expected, gaps: 0, hubs: 0), so validator had nothing to validate. | **UI Bug Fixed** |
| 2 | "Fix distance metric for coverage gaps" - cosine hides magnitude, suggests hybrid `d = α * cosine + (1-α) * euclidean(z-scored)` | Concern that cosine distance ignores intensity differences | **Intentional design**. Cosine detects direction coverage; magnitude weights priority ranking via `gapScore = distance * log1p(mag * size)`. For emotion space, this is semantically correct. | **No Change Needed** |

### 13.2 Claim 1: Candidate Axis Validation

#### 13.2.1 The Confusion

The system has two stages for candidate axes:
1. **`CandidateAxisExtractor.extract()`** - finds candidates from PCA residuals, coverage gaps, and hub prototypes
2. **`CandidateAxisValidator.validate()`** - validates extracted candidates against criteria

ChatGPT saw the UI message "No candidate axes analyzed (validation may be disabled)" and concluded the validation system was broken or disabled.

#### 13.2.2 The Reality

In the analyzed data:
- **PCA Analysis**: `significantBeyondExpected = 0` (broken-stick found no additional components needed)
- **Coverage Gaps**: 0 detected
- **Hub Candidates**: 0 detected

The extractor correctly found **0 candidates**, so the validator had nothing to validate. Validation was always enabled - the UI message simply conflated "no extraction results" with "disabled validation."

#### 13.2.3 Fix Applied

**File**: `src/domUI/prototype-analysis/PrototypeAnalysisController.js`

**Before**:
```javascript
emptyMsg.textContent =
  'No candidate axes analyzed (validation may be disabled).';
```

**After**:
```javascript
emptyMsg.textContent =
  'No candidate axes to validate (extraction found 0 significant components, 0 coverage gaps, 0 hub candidates).';
```

### 13.3 Claim 2: Distance Metric for Coverage Gaps

#### 13.3.1 ChatGPT's Concern

ChatGPT suggested the coverage gap detection should use a hybrid distance metric:
```
d = α * cosine + (1-α) * euclidean(z-scored)
```

The concern was that pure cosine distance "hides magnitude differences" - e.g., mild vs intense versions of the same emotion would appear identical.

#### 13.3.2 Why Current Design is Correct

The current implementation in `CoverageGapDetector.detect()`:

```javascript
// Flow:
1. Compute cluster centroid (includes magnitude)
2. Store clusterMagnitude BEFORE normalization
3. Normalize to get suggestedAxisDirection
4. checkSubspaceGap() with cosine on NORMALIZED direction
5. gapScore = distanceToNearestAxis * log1p(clusterMagnitude * clusterSize)
```

**Key insight**: For emotion space analysis, cosine distance is semantically correct because:
- "Mild sadness" and "intense sadness" share the same **direction** in emotion space
- Intensity is captured by **axis values** (0.3 vs 0.9), not by separate axes
- The magnitude is preserved for **priority ranking** via the `gapScore` formula

A hybrid metric would create **false positives** by flagging intensity variants as needing separate axes, which would bloat the axis system unnecessarily.

#### 13.3.3 Decision

**No change required**. The current cosine + magnitude-weighting design is intentional and appropriate for emotion space analysis. The magnitude information is not "hidden" - it's correctly used for priority ranking rather than direction detection.

### 13.4 Lessons Learned

1. **UI messages must be precise**: "Validation may be disabled" was misleading when the actual cause was "no candidates to validate"
2. **Distance metric choice depends on domain**: Cosine distance is correct for direction-based queries in emotion space
3. **Magnitude is not lost**: The system preserves magnitude for ranking purposes, just separates it from direction detection

---

## Section 14: ChatGPT Claims Assessment (January 2026)

### 14.1 Overview

ChatGPT suggested four "vital analytics" improvements to the prototype analysis system. This section documents the investigation findings and decisions.

| Claim | Verdict | Action |
|-------|---------|--------|
| A) Axis correlation | **Design Choice** | Document explanation |
| B) Unused/rare axes | **TRUE** | Implement detection |
| C) Gate-space analysis | **Out of Scope** | Document exclusion |
| D) Expression-driven gaps | **Already Exists** | No action needed |

### 14.2 Claim A: Axis Disentanglement/Correlation

#### 14.2.1 ChatGPT's Concern

ChatGPT flagged these axis pairs as "extremely correlated":
- `contamination_salience ↔ disgust_sensitivity`
- `evaluation_pressure ↔ evaluation_sensitivity`
- `inhibitory_control ↔ self_control`
- `rumination ↔ ruminative_tendency`

#### 14.2.2 Investigation Result

These pairs do co-occur in prototypes, but this is **intentional semantic design**:
- `inhibitory_control` = mood axis (current state, transient)
- `self_control` = affect trait (stable personality characteristic)

The system correctly distinguishes between:
- **MOOD_AXES** (14): Transient emotional states
- **AFFECT_TRAITS** (7): Stable personality traits
- **SEXUAL_AXES** (5): Sexual-specific dimensions

#### 14.2.3 Decision

**No code change needed.** Axis co-occurrence is by design (state vs trait distinction).

### 14.3 Claim B: Unused and Rare Axes

#### 14.3.1 ChatGPT's Concern

ChatGPT claimed:
- `baseline_libido` is defined but never used
- `sex_excitation` is rare (appears in very few prototypes)

#### 14.3.2 Investigation Result

**STATUS (January 2026 update):**

The original claims below were accurate when investigated but became stale:

- **`baseline_libido`**: Originally unused (0 occurrences). **NOW used in 18 prototypes** with weight values 0.1-0.25.
- **`sex_excitation`**: Used only in GATES (e.g., `sex_excitation <= 0.25`), NOT in prototype weights. Correctly flagged as "Unused but Defined" in weight-space analysis.

**Original claims (historical reference):**
- ~~`baseline_libido` is defined but NEVER used~~ - Now used in weights
- `sex_excitation` appears only in gates, not weights - Still accurate

#### 14.3.3 Implementation

The system already tracks "Excluded Sparse Axes" (used by <10% prototypes) via:
- `PCAAnalysisService.#filterSparseAxes()`
- UI rendering with `#renderExcludedSparseAxes()`

**Gap identified**: No detection for "Unused but Defined" axes (0% usage).

**Implementation added** (January 2026):
1. `PCAAnalysisService.js` now computes `unusedDefinedAxes` against `ALL_PROTOTYPE_WEIGHT_AXES`
2. `AxisGapReportSynthesizer.js` includes `unusedDefinedAxes` in reports
3. `PrototypeAnalysisController.js` adds `#renderUnusedDefinedAxes()` method
4. UI displays unused axes with distinct styling (red alert) vs sparse axes (yellow warning)

### 14.4 Claim C: Gate-Space Analysis

#### 14.4.1 ChatGPT's Concern

ChatGPT suggested analyzing "gate activation volume" and "dead zones" where no expression gates fire.

#### 14.4.2 Investigation Result

**Out of Scope** because:
1. Gates are binary prerequisites (e.g., `sexual_arousal >= 0.35`), not continuous
2. The current system analyzes weight-space via PCA, not gate-space
3. Gate analysis would be a fundamentally different feature

#### 14.4.3 Decision

**No change.** Gate-space analysis is a separate feature request, not an improvement to axis analysis.

### 14.5 Claim D: Expression-Driven Gaps

#### 14.5.1 ChatGPT's Concern

ChatGPT suggested tracking axis appearance in expression prerequisites.

#### 14.5.2 Investigation Result

**Already exists:**
- `PrototypeConstraintAnalyzer` handles this
- `CandidateAxisExtractor` uses constraint analysis
- Monte Carlo reports include this analysis

#### 14.5.3 Decision

**No action needed.** The feature already exists.

### 14.6 Summary of Changes

| Change | Type | Files Modified |
|--------|------|----------------|
| Add `unusedDefinedAxes` detection | Feature | `PCAAnalysisService.js` |
| Include in report | Feature | `AxisGapReportSynthesizer.js` |
| Add UI rendering | Feature | `PrototypeAnalysisController.js`, `prototype-analysis.html` |
| Add CSS styling | Style | `prototype-analysis.css` |
| Add unit tests | Tests | `PCAAnalysisService.test.js` |
| Document assessment | Docs | This section |

---

## Section 15: External Claim Assessment - January 2026

This section addresses external claims about the gap detection system and documents the Excluded-Axis Reliance Flag enhancement.

### 15.1 Claim A: Bootstrap/Uncertainty for Stability

**Claim:** Point estimates for residual variance are unstable; bootstrap CI would prevent threshold jitter.

**Assessment:** NOT A BUG - Design philosophy difference.

The system intentionally uses **multi-signal corroboration** rather than statistical uncertainty:
- PCA triggers only when `hasSignificantComponents || (hasHighResidual && hasOtherSignals)` (AxisGapRecommendationBuilder.js:164)
- A prototype needs confirmation from multiple detection families to receive high confidence
- This is more robust than bootstrap because it requires agreement across fundamentally different detection methods

Bootstrap would add significant computational overhead for marginal benefit given the corroboration approach already handles threshold sensitivity.

### 15.2 Claim B: Always Compute Residual Direction

**Claim:** Even when broken-stick finds no significant components, extract residual directions as hypotheses.

**Assessment:** ALREADY IMPLEMENTED.

The `residualEigenvector` is always computed in `PCAAnalysisService.js`:
```javascript
let residualEigenvector = null;
if (axisCount < eigen.vectors.length) {
  residualEigenvectorIndex = axisCount;
  residualEigenvector = this.#buildResidualEigenvector(
    eigen.vectors[axisCount],
    axes
  );
}
```

This extracts the first component beyond `expectedDimension` regardless of broken-stick significance.

### 15.3 Claim C: Separate Three Diagnoses

**Claim:** "High residual" loosely maps to "missing axis" but could mean axis gap, redundancy, or outliers.

**Assessment:** ALREADY IMPLEMENTED via family system.

The `REASON_TO_FAMILY_MAP` in `AxisGapReportSynthesizer.js` provides clear separation:
- **Axis Gap:** `pca` family (high_reconstruction_error, extreme_projection)
- **Axis Redundancy:** `conflicts` family (multi_axis_conflict, high_axis_loading)
- **Outliers:** Handled by corroboration - high reconstruction without other signals → LOW priority INVESTIGATE
- **Metadata:** `sign_tension` → metadata-only family, excluded from confidence

The recommendation builder handles each differently:
- HIGH priority: PCA + coverage gap (strong evidence)
- MEDIUM priority: Single strong signal
- LOW priority: Uncorroborated findings

### 15.4 Claim D: Excluded-Axis Reliance Flag

**Claim:** Prototypes with poor fit that rely heavily on excluded (sparse) axes should be flagged as artifacts.

**Assessment:** IMPLEMENTED as enhancement.

The system now computes `excludedAxisReliance` for each prototype in reconstruction errors:
- `excludedAxisReliance`: Ratio of squared weights on excluded sparse axes to total squared weights (0-1)
- `reliesOnExcludedAxes`: Boolean flag when reliance > 25%

This helps distinguish:
- **True high residual:** Prototype needs new axis → `reliesOnExcludedAxes: false`
- **Artifact high residual:** Poor fit due to sparse axis reliance → `reliesOnExcludedAxes: true`

When `reliesOnExcludedAxes` is true, the evidence includes a warning that the prototype relies heavily on excluded sparse axes, suggesting the user may need to adjust `pcaMinAxisUsageRatio` rather than add a new axis.

#### Implementation Details

**PCAAnalysisService.js - `#computeReconstructionErrors`:**
```javascript
// Compute excluded axis reliance for this prototype
const prototypeWeights = prototype?.weights ?? {};

let excludedAxisWeightSquared = 0;
let totalWeightSquared = 0;

for (const [axis, weight] of Object.entries(prototypeWeights)) {
  const weightSq = weight * weight;
  totalWeightSquared += weightSq;
  if (excludedSparseAxes.includes(axis)) {
    excludedAxisWeightSquared += weightSq;
  }
}

const excludedAxisReliance = totalWeightSquared > 0
  ? excludedAxisWeightSquared / totalWeightSquared
  : 0;
const reliesOnExcludedAxes = excludedAxisReliance > 0.25; // 25% threshold
```

**AxisGapRecommendationBuilder.js - Evidence building:**
```javascript
// Add excluded-axis reliance warnings
const prototypesRelyingOnExcluded = reconstructionErrors.filter(
  (e) => e && typeof e === 'object' && e.reliesOnExcludedAxes === true
);
for (const entry of prototypesRelyingOnExcluded) {
  const reliancePct = ((entry.excludedAxisReliance ?? 0) * 100).toFixed(0);
  evidence.push(
    `⚠️ ${entry.prototypeId} relies ${reliancePct}% on excluded sparse axes (consider adjusting pcaMinAxisUsageRatio)`
  );
}
```

### 15.5 Files Modified for Claim D Implementation

| File | Change Type | Description |
|------|-------------|-------------|
| `PCAAnalysisService.js` | Feature | Added `excludedAxisReliance` and `reliesOnExcludedAxes` computation to `#computeReconstructionErrors` |
| `AxisGapRecommendationBuilder.js` | Feature | Added excluded-axis reliance warnings to INVESTIGATE evidence |
| `PCAAnalysisService.test.js` | Tests | Added unit tests for excluded axis reliance computation |
| `axis-space-analysis.md` | Docs | This section documenting claim assessments |

### 15.6 External Review Assessment (January 2026)

A ChatGPT review of the analysis system suggested three improvements:

| Claim | Assessment | Conclusion |
|-------|------------|------------|
| 1. Treat excluded sparse axes as first-class signal | **Already Implemented** | `excludedAxisReliance` tracking exists (see 15.4) |
| 2. Add residual clustering to detect missing axes | **Design Decision** | Broken-stick analysis serves this purpose |
| 3. Replace hard cutoffs with scale-free thresholds | **Partially Implemented** | Remaining hard thresholds are intentional |

**Claim 1 - Excluded Axis Tracking:**
The system already computes `excludedAxisReliance` for each prototype and surfaces warnings in recommendations when prototypes rely heavily on excluded sparse axes. Evidence appears in analysis output:
```
⚠️ sexual_performance_anxiety relies 28% on excluded sparse axes (consider adjusting pcaMinAxisUsageRatio)
```

**Claim 2 - Residual Clustering:**
The existing broken-stick analysis provides a stronger statistical foundation for detecting coherent dimensions vs noise. When broken-stick finds 0 additional significant components, it means the eigenvalue distribution matches random expectation—variance is diffuse across many small components rather than concentrated in discoverable hidden dimensions. K-means clustering on noise would produce arbitrary clusters, not real dimensions.

**Claim 3 - Scale-Free Thresholds:**
The system appropriately mixes adaptive and fixed thresholds:
- **Adaptive:** `enableAdaptiveThresholds`, `adaptiveThresholdPercentile`, `hubMinDegreeRatio`
- **Fixed (intentionally):** `pcaResidualVarianceThreshold` (15% is universally meaningful), `pcaMinAxisUsageRatio` (definitional boundary), `hubBetweennessThreshold` (already normalized to [0,1])

**Conclusion:** No implementation changes required. The review highlighted existing features that could benefit from better UI explanation to prevent similar misunderstandings.

---

*End of Technical Report*
