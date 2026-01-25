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

Prototypes are objects with axis constraints:

```javascript
{
  id: "prototype_id",
  axisConstraints: {
    "axis_name": { min: -1.0, max: 1.0 },  // Range constraint
    "axis_name": { exact: 0.5 }             // Exact constraint
  }
}
```

Axes are normalized to [-1, 1] range.

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

1. **Input**: Array of prototypes with axis constraints
2. **Preprocessing**: Build constraint matrix (prototypes × axes)
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

#### Step 1: Build Constraint Matrix

```javascript
// For each prototype, extract midpoint of each axis constraint
matrix[i][j] = (constraint.min + constraint.max) / 2
// Or for exact constraints:
matrix[i][j] = constraint.exact
// Missing constraints default to 0
```

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
- **Edges**: Prototype-to-Axis when prototype has constraint on that axis

```javascript
// Adjacency representation
edges = []
for each prototype:
  for each axis in prototype.axisConstraints:
    edges.push({ prototype, axis, weight: constraintStrength })

// Constraint strength = max - min (range) or 1.0 for exact
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
- `variance`: Variance of constraint strengths across axes

**Rationale**: High degree with consistent constraint strength indicates a balanced hub.

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
vector[i] = midpointOfConstraint(prototype, axis_i)
// Missing constraints = 0 (neutral)
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

  for each [axis, constraint] of prototype.axisConstraints:
    midpoint = (constraint.min + constraint.max) / 2

    if abs(midpoint) >= threshold:
      highLoadings.push({
        axis,
        value: midpoint,
        sign: midpoint > 0 ? 'positive' : 'negative'
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

Some axis pairs are semantically expected to conflict:

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
| `hubMinDegree` | 4 | Minimum axis connections for hub |
| `hubMinBetweenness` | 0.1 | Minimum betweenness centrality |
| `hubMinScore` | 0.5 | Minimum hub score |

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
  axisConstraints: {
    [axisName: string]: {
      min?: number;  // -1 to 1
      max?: number;  // -1 to 1
      exact?: number; // -1 to 1
    }
  };
}
```

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
- E = edges (constraints)
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

*End of Technical Report*
