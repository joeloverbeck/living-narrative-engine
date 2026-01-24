# Detecting the Need for New Mood Axes: Research Document

**Date**: 2026-01-23
**Context**: Prototype Analysis System V3 (`prototype-analysis.html`)
**Related**: `brainstorming/detecting-need-for-new-axes.md`, `reports/prototype-analysis-system.md`

---

## Executive Summary

The prototype analysis system currently focuses on identifying redundant, overlapping, or subsumable prototypes within the existing mood axis space. However, it lacks the capability to detect when the axis space itself is inadequate—when prototypes are "overfitting" combinations of existing axes to express concepts that deserve their own dimension.

This research document analyzes three main approaches for detecting axis gaps:

1. **Principal Component Analysis (PCA)** - Detecting latent dimensions through eigenvalue analysis of the prototype weight matrix
2. **Coverage Gap Detection** - Identifying underserved regions in the mood space
3. **Multi-Prototype Overlap Pattern Analysis** - Flagging prototypes with unusual overlap patterns

The recommended implementation leverages the existing V3 pipeline infrastructure, adding axis gap detection as a post-classification analysis stage that produces actionable suggestions for axis augmentation.

---

## 1. Problem Statement

### The Confusion Example

Before introducing the "uncertainty" axis, the prototype "confusion" was defined using six different axes with non-trivial weights:

| Axis | Weight | Direction |
|------|--------|-----------|
| engagement | + | Positive |
| arousal | + | Positive |
| inhibitory_control | + | Positive |
| valence | - | Negative |
| agency_control | - | Negative |
| self_control | - | Negative |

This scatter of influences indicated that confusion was "borrowing" from multiple axes to achieve a nuanced feeling that the mood space lacked a single axis to represent. The prototype:

- Overlapped with frustration (shared agency_control↓, valence↓)
- Overlapped with anxiety (shared arousal+, valence↓)
- Overlapped with helplessness (shared agency_control↓)
- Yet was qualitatively different from all of them

After adding the "uncertainty" axis, confusion's definition became cleaner: `uncertainty: 1.0` with reduced reliance on agency_control.

### Current System Limitations

The overlap analyzer produces classifications like:
- `merge_recommended` - Near-duplicate functionality
- `subsumed_recommended` - One subsumes the other
- `nested_siblings` - Hierarchical relationship
- `needs_separation` - Similar but should be differentiated
- `keep_distinct` - Properly differentiated

None of these classifications address the meta-question: **"Is the axis space itself adequate?"**

---

## 2. Indicators of Missing Axes

### 2.1 Prototype Overlaps Spread Across Multiple Others

**Pattern**: A prototype shows moderate overlap with several different prototypes but isn't a near-duplicate of any single one.

**Detection Criteria**:
```
overlap_count = count(pairs where prototype P has overlap_info classification)
avg_composite_score = mean(composite_scores for P's pairs)

FLAG if:
  overlap_count >= 3 AND
  avg_composite_score in [0.5, 0.8] AND  # Moderate, not high
  no pair has merge_recommended classification
```

**Interpretation**: The prototype is sitting in a "crowded" portion of mood space, borrowing characteristics from multiple neighbors without cleanly mapping to any.

### 2.2 Consistent One-Way Overlaps (Nested Siblings Pattern)

**Pattern**: Prototype A implies Prototype B, but B doesn't imply A. This suggests B represents a more fundamental dimension that A also contains.

**Detection Criteria**:
```
For prototype P, collect all nested_siblings classifications:
  implied_by_P = [Q for (P,Q) where P_implies_Q and not Q_implies_P]
  implies_P = [Q for (P,Q) where Q_implies_P and not P_implies_Q]

FLAG if:
  len(implied_by_P) >= 2  # P is "fundamental" to multiple others
  OR len(implies_P) >= 2   # Multiple prototypes are "fundamental" to P
```

**Interpretation**: The prototype captures a dimension (like "epistemic uncertainty") that multiple other prototypes also tap into when they activate.

### 2.3 Many Active Axes with Conflicting Influences

**Pattern**: A single prototype uses an unusually large number of axes, especially with some pushing positive and others negative in a balancing act.

**Detection Criteria**:
```
active_axis_count = count(axes where |weight| >= activeAxisEpsilon)
sign_balance = |count(positive) - count(negative)| / active_axis_count

FLAG if:
  active_axis_count > median(all_prototypes) + 1.5 * IQR AND
  sign_balance < 0.4  # Roughly equal positive and negative
```

**Interpretation**: The prototype is "jury-rigging" a combination of existing axes to express a concept that doesn't naturally fit the current space.

---

## 3. Technical Approaches

### 3.1 Principal Component Analysis (PCA) on Weight Matrix

#### Theory

PCA finds orthogonal directions (principal components) that capture maximum variance in the data. If prototypes cluster along directions that don't align with the current axes, this suggests a latent dimension.

#### Method

1. **Construct Weight Matrix**: Create matrix W where each row is a prototype and each column is an axis weight
   ```
   W[i,j] = weight of prototype i on axis j
   ```

2. **Standardize**: Center and scale each column (axis) to zero mean, unit variance

3. **Compute Eigenvalues**: Calculate eigenvalues λ₁, λ₂, ... λₙ of the covariance matrix

4. **Analyze Residual Variance**: After projecting onto the current n axes, compute residual variance
   ```
   residual_variance = Σ(λᵢ for i > n) / Σ(all λᵢ)
   ```

5. **Flag Condition**:
   ```
   FLAG "potential missing axis" if:
     residual_variance > 0.15  # >15% unexplained variance
     AND eigenvalue[n+1] > 1.0  # Kaiser criterion
   ```

#### Implementation Considerations

```javascript
// Pseudo-code for PCA analysis
class AxisGapDetector {
  analyzeWithPCA(prototypes, currentAxes) {
    const weightMatrix = this.#buildWeightMatrix(prototypes, currentAxes);
    const standardized = this.#standardize(weightMatrix);
    const covariance = this.#computeCovariance(standardized);
    const { eigenvalues, eigenvectors } = this.#eigenDecompose(covariance);

    // Check for unexplained variance
    const totalVariance = eigenvalues.reduce((a, b) => a + b, 0);
    const explainedByAxes = eigenvalues.slice(0, currentAxes.length)
      .reduce((a, b) => a + b, 0);
    const residualRatio = 1 - (explainedByAxes / totalVariance);

    // Check Kaiser criterion for additional components
    const additionalSignificant = eigenvalues
      .slice(currentAxes.length)
      .filter(λ => λ > 1.0);

    return {
      residualVarianceRatio: residualRatio,
      additionalComponentCount: additionalSignificant.length,
      suggestedAxis: additionalSignificant.length > 0
        ? this.#interpretComponent(eigenvectors[currentAxes.length])
        : null
    };
  }
}
```

#### Interpreting the Extra Component

The eigenvector of the (n+1)th component reveals which prototypes load heavily on the missing dimension:

```
highLoadingPrototypes = prototypes.filter(p =>
  |loading[p] on component[n+1]| > 0.5
)
```

For the confusion example, this would have identified: confusion, perplexity, doubt, curiosity—all sharing the "epistemic" quality.

### 3.2 Coverage Gap Detection

#### Theory

Treat each prototype as a point in a feature space (weights + gate constraints). If multiple prototypes cluster in a region not well-spanned by individual axes, that region may need explicit representation.

#### Method

1. **Define Feature Space**: Each prototype → vector of [weights..., gate_min..., gate_max...]

2. **Cluster Prototypes**: Use k-means or hierarchical clustering
   ```
   clusters = kmeans(prototype_vectors, k=sqrt(n/2))
   ```

3. **Analyze Cluster Centroids**: For each cluster centroid, compute distance to nearest axis
   ```
   axis_distance[c] = min(cosine_distance(centroid[c], axis_vector[a]) for all a)
   ```

4. **Flag Condition**:
   ```
   FLAG "coverage gap in cluster c" if:
     axis_distance[c] > 0.6  # Centroid far from any axis
     AND cluster_size[c] >= 3  # Multiple prototypes in cluster
   ```

#### Implementation Considerations

The existing `PrototypeProfileCalculator` already performs clustering:

```javascript
// From PrototypeProfileCalculator.calculateSingle
const noveltyMetric = this.#computeNoveltyMetric(prototype, allPrototypes);
// noveltyMetric = distance to nearest cluster centroid

// Extension: Analyze cluster properties
const clusterAnalysis = this.#analyzeClusterAxisAlignment(clusters, axisVectors);
```

### 3.3 Multi-Prototype Overlap Pattern Analysis

#### Theory

If one prototype overlaps moderately (above threshold) with several others across different clusters, it may be covering a multi-dimensional concept that should be its own axis.

#### Method

1. **Build Overlap Graph**: Nodes = prototypes, edges = overlap relationships weighted by composite score

2. **Identify Hub Prototypes**: Prototypes with high degree and moderate edge weights
   ```
   hub_score[p] = degree[p] * (1 - variance(edge_weights[p]))
   ```

3. **Analyze Hub Neighborhoods**: For hub prototype P, examine the prototypes it overlaps with
   ```
   neighborhood_diversity = count(distinct clusters in neighbors)
   ```

4. **Flag Condition**:
   ```
   FLAG "prototype spans multiple concepts" if:
     degree[p] >= 4 AND
     neighborhood_diversity >= 2 AND
     no edge has weight > 0.9  # Not a duplicate
   ```

#### Implementation Considerations

```javascript
// Extension to OverlapClassifier
#analyzeOverlapGraph(allPairResults) {
  const graph = this.#buildOverlapGraph(allPairResults);
  const hubPrototypes = this.#identifyHubs(graph, {
    minDegree: 4,
    maxEdgeWeight: 0.9,
    minNeighborhoodDiversity: 2
  });

  return hubPrototypes.map(p => ({
    prototype: p,
    overlappingPrototypes: graph.neighbors(p),
    suggestedAction: 'CONSIDER_NEW_AXIS',
    evidence: this.#gatherHubEvidence(p, graph)
  }));
}
```

### 3.4 Cluster-Based Anomaly Detection

#### Theory

Prototypes that don't fit cleanly into any cluster (outliers) or that bridge multiple clusters may represent concepts requiring new dimensions.

#### Method

1. **Perform Clustering**: Use DBSCAN or HDBSCAN (handles noise/outliers)

2. **Identify Anomalies**:
   - **Noise points**: Prototypes not assigned to any cluster
   - **Bridge points**: Prototypes with significant membership in multiple clusters (fuzzy clustering)

3. **Analyze Anomaly Properties**:
   ```
   For each anomaly prototype A:
     nearest_clusters = top_k_nearest_clusters(A, k=3)
     cluster_distance_variance = variance(distances to nearest_clusters)
   ```

4. **Flag Condition**:
   ```
   FLAG "anomaly suggests new axis" if:
     is_noise_point(A) OR
     (is_bridge_point(A) AND cluster_distance_variance < 0.2)  # Equidistant to multiple clusters
   ```

---

## 4. Integration Points in Current Codebase

### 4.1 CandidatePairFilter Extension

**File**: `src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js`

**Integration**: Add axis gap metrics during candidate filtering

```javascript
// In #computePairMetrics
const axisGapMetrics = this.#computeAxisGapIndicators(prototypeA, prototypeB, {
  activeA,
  activeB,
  weightsA,
  weightsB
});

return {
  activeAxisOverlap,
  signAgreement,
  weightCosineSimilarity,
  // NEW
  activeAxisSymmetricDifference: axisGapMetrics.symmetricDiff,
  weightVectorAngle: axisGapMetrics.angle,
  combinedAxisCount: axisGapMetrics.totalActiveAxes
};
```

### 4.2 BehavioralOverlapEvaluator Extension

**File**: `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js`

**Integration**: Track axis utilization patterns during sampling

```javascript
// During Monte Carlo iteration
const axisUtilization = {
  exclusiveToA: new Map(),  // axis → count where A uses but B doesn't
  exclusiveToB: new Map(),  // axis → count where B uses but A doesn't
  sharedUsage: new Map()    // axis → count where both use
};

// After sampling
const utilizationStability = this.#computeUtilizationStability(axisUtilization);
```

### 4.3 New Service: AxisGapAnalyzer

**Proposed File**: `src/expressionDiagnostics/services/AxisGapAnalyzer.js`

**Purpose**: Centralize axis gap detection logic

```javascript
class AxisGapAnalyzer {
  constructor({
    candidatePairFilter,
    prototypeProfileCalculator,
    config,
    logger
  }) { ... }

  /**
   * Analyze all prototypes for axis gap indicators
   * @param {Array} prototypes - All prototypes to analyze
   * @param {Array} pairResults - Results from overlap analysis
   * @returns {AxisGapReport}
   */
  analyze(prototypes, pairResults) {
    const pcaAnalysis = this.#runPCAAnalysis(prototypes);
    const coverageGaps = this.#detectCoverageGaps(prototypes);
    const hubPrototypes = this.#identifyHubPrototypes(pairResults);
    const anomalies = this.#detectAnomalies(prototypes);

    return this.#synthesizeReport({
      pcaAnalysis,
      coverageGaps,
      hubPrototypes,
      anomalies
    });
  }
}
```

### 4.4 PrototypeOverlapAnalyzer Integration

**File**: `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js`

**Integration**: Add axis gap analysis as final pipeline stage

```javascript
// In analyze() method, after classification
if (this.#config.enableAxisGapDetection) {
  onProgress?.('ANALYZING_AXIS_GAPS', { phase: 'axis-gaps' });

  const axisGapReport = this.#axisGapAnalyzer.analyze(
    prototypes,
    classifiedResults
  );

  result.axisGapAnalysis = axisGapReport;
}
```

### 4.5 Configuration Extension

**File**: `src/expressionDiagnostics/config/prototypeOverlapConfig.js`

```javascript
// === Axis Gap Detection Configuration ===

/**
 * Enable axis gap detection in the analysis pipeline
 */
enableAxisGapDetection: true,

/**
 * PCA Analysis Thresholds
 */
pcaResidualVarianceThreshold: 0.15,  // Flag if >15% unexplained variance
pcaKaiserThreshold: 1.0,              // Eigenvalue threshold for significance

/**
 * Hub Prototype Detection
 */
hubMinDegree: 4,                      // Minimum overlap connections
hubMaxEdgeWeight: 0.9,                // Maximum edge weight (exclude near-duplicates)
hubMinNeighborhoodDiversity: 2,       // Minimum distinct clusters in neighborhood

/**
 * Coverage Gap Detection
 */
coverageGapAxisDistanceThreshold: 0.6,  // Min distance from any axis
coverageGapMinClusterSize: 3,           // Min prototypes in cluster

/**
 * Multi-Axis Usage Detection
 */
multiAxisUsageThreshold: 1.5,         // IQR multiplier for "many axes"
multiAxisSignBalanceThreshold: 0.4,   // Max sign balance for "conflicting"

/**
 * Anomaly Detection
 */
anomalyClusterDistanceVarianceThreshold: 0.2  // Max variance for "bridge points"
```

---

## 5. Output Format

### 5.1 Axis Gap Report Structure

```typescript
interface AxisGapReport {
  summary: {
    totalPrototypesAnalyzed: number;
    potentialGapsDetected: number;
    confidence: 'low' | 'medium' | 'high';
  };

  pcaAnalysis: {
    residualVarianceRatio: number;
    additionalSignificantComponents: number;
    topLoadingPrototypes: Array<{
      prototypeId: string;
      loading: number;
    }>;
  };

  hubPrototypes: Array<{
    prototypeId: string;
    hubScore: number;
    overlappingPrototypes: string[];
    neighborhoodDiversity: number;
    suggestedAxisConcept: string;  // AI-generated or pattern-based
  }>;

  coverageGaps: Array<{
    clusterId: number;
    centroidPrototypes: string[];
    distanceToNearestAxis: number;
    suggestedAxisDirection: Record<string, number>;  // Weight vector
  }>;

  anomalies: Array<{
    prototypeId: string;
    anomalyType: 'noise' | 'bridge';
    nearestClusters: string[];
    confidence: number;
  }>;

  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    type: 'NEW_AXIS' | 'INVESTIGATE' | 'REFINE_EXISTING';
    description: string;
    affectedPrototypes: string[];
    evidence: string[];
  }>;
}
```

### 5.2 UI Integration

The axis gap report should appear as a new section in `prototype-analysis.html`:

```html
<section id="axis-gap-analysis" class="analysis-section">
  <h2>Axis Space Analysis</h2>

  <div class="pca-summary">
    <h3>Dimensionality Analysis (PCA)</h3>
    <p>Residual variance: <span id="residual-variance">15.3%</span></p>
    <p>Additional components suggested: <span id="additional-components">1</span></p>
  </div>

  <div class="hub-prototypes">
    <h3>Hub Prototypes (Spanning Multiple Concepts)</h3>
    <ul id="hub-list">
      <!-- Dynamically populated -->
    </ul>
  </div>

  <div class="recommendations">
    <h3>Axis Recommendations</h3>
    <ul id="axis-recommendations">
      <!-- Priority-sorted recommendations -->
    </ul>
  </div>
</section>
```

---

## 6. Recommended Implementation Strategy

### Phase 1: Data Collection (Low Risk)

1. Add axis gap metrics to `CandidatePairFilter` output
2. Track axis utilization patterns in `BehavioralOverlapEvaluator`
3. No changes to classification logic—just collect data

### Phase 2: Analysis Service (Medium Risk)

1. Create `AxisGapAnalyzer` service
2. Implement PCA analysis using existing weight data
3. Implement hub detection using overlap graph
4. Add coverage gap detection

### Phase 3: Integration (Medium Risk)

1. Wire `AxisGapAnalyzer` into `PrototypeOverlapAnalyzer` pipeline
2. Add axis gap section to UI
3. Generate recommendations

### Phase 4: Validation (Low Risk)

1. Test against known case (confusion → uncertainty)
2. Validate recommendations match human judgment
3. Tune thresholds based on false positive/negative rates

---

## 7. Testing Strategy

### Unit Tests

```javascript
// tests/unit/expressionDiagnostics/services/axisGapAnalyzer.test.js

describe('AxisGapAnalyzer', () => {
  describe('PCA Analysis', () => {
    it('should detect high residual variance when axis is missing', () => {
      // Setup: Create prototypes that cluster on a dimension not in current axes
      const prototypes = createPrototypesWithLatentDimension();
      const result = analyzer.#runPCAAnalysis(prototypes);

      expect(result.residualVarianceRatio).toBeGreaterThan(0.15);
      expect(result.additionalSignificantComponents).toBeGreaterThanOrEqual(1);
    });

    it('should identify prototypes loading on missing dimension', () => {
      const prototypes = createConfusionLikePrototypes();
      const result = analyzer.#runPCAAnalysis(prototypes);

      expect(result.topLoadingPrototypes).toContainEqual(
        expect.objectContaining({ prototypeId: 'confusion' })
      );
    });
  });

  describe('Hub Detection', () => {
    it('should flag prototypes with many moderate overlaps', () => {
      const pairResults = createManyModerateOverlaps('confusion');
      const hubs = analyzer.#identifyHubPrototypes(pairResults);

      expect(hubs).toContainEqual(
        expect.objectContaining({
          prototypeId: 'confusion',
          hubScore: expect.any(Number)
        })
      );
    });
  });
});
```

### Integration Tests

```javascript
// tests/integration/expressionDiagnostics/axisGapDetection.integration.test.js

describe('Axis Gap Detection Integration', () => {
  it('should detect missing uncertainty axis in pre-uncertainty prototypes', async () => {
    // Load historical prototype definitions (before uncertainty axis)
    const historicalPrototypes = loadHistoricalPrototypes('v2.0');

    const analyzer = container.resolve(tokens.PrototypeOverlapAnalyzer);
    const result = await analyzer.analyze({
      prototypeFamily: 'emotion',
      prototypes: historicalPrototypes
    });

    expect(result.axisGapAnalysis.recommendations).toContainEqual(
      expect.objectContaining({
        type: 'NEW_AXIS',
        affectedPrototypes: expect.arrayContaining(['confusion', 'perplexity', 'doubt'])
      })
    );
  });
});
```

---

## 8. Limitations and Future Work

### Current Limitations

1. **Human Interpretation Required**: The system flags potential gaps but cannot name the new axis—human insight needed
2. **False Positives**: Some "hubs" may be legitimate central emotions (e.g., "neutral") not needing new axes
3. **Computational Cost**: PCA on large prototype sets may be slow; consider sampling or incremental approaches

### Future Enhancements

1. **LLM-Assisted Axis Naming**: Use LLM to suggest axis names based on common properties of flagged prototypes
2. **Historical Validation**: Compare against known axis additions to validate detection accuracy
3. **Threshold Auto-Tuning**: Use historical data to optimize detection thresholds

---

## 9. References

### Academic Literature

1. **Kaiser Rule and Eigenvalue Thresholds**: Humphreys & Montanelli (1975) propose simulation-based threshold estimation for non-random components
2. **Residual Variance Analysis**: Smith & Miao (1994) observe eigenvalues >1.40 as threshold for randomness in residual PCA
3. **Clustering for Outlier Detection**: ODAR method (2024) constructs feature space where outliers cluster distinctly from normal objects
4. **Concept Drift Detection**: Jothimurugesan et al. (2023) present hierarchical clustering for detecting new concepts in federated learning
5. **Prototype-Based Classification**: Borgelt thesis covers prototype learning and cluster-based classification methods

### Codebase References

| File | Relevance |
|------|-----------|
| `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js` | Main pipeline orchestrator |
| `src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js` | Structural similarity metrics |
| `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js` | Monte Carlo sampling |
| `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js` | Classification logic |
| `src/expressionDiagnostics/services/prototypeOverlap/PrototypeProfileCalculator.js` | V3 profile computation |
| `src/expressionDiagnostics/config/prototypeOverlapConfig.js` | Configuration thresholds |
| `src/expressionDiagnostics/services/PrototypeGapAnalyzer.js` | Existing coverage gap detection (reusable) |

---

## 10. Conclusion

Detecting the need for new mood axes is feasible through a combination of:

1. **PCA residual variance analysis** - Quantifies how much variance current axes fail to explain
2. **Hub prototype detection** - Identifies prototypes spanning multiple concepts
3. **Coverage gap analysis** - Finds clusters distant from any existing axis
4. **Anomaly detection** - Flags prototypes that don't fit the current space

The existing V3 pipeline provides excellent infrastructure for these analyses:
- Pre-computed prototype vectors enable efficient PCA
- Overlap classifications provide the graph structure for hub detection
- Profile calculations already perform clustering

The recommended approach is to add axis gap detection as a post-classification analysis stage, producing recommendations that require human judgment for final action. This preserves the current classification accuracy while adding a valuable meta-analysis capability.

The confusion → uncertainty case study provides validation criteria: a well-tuned system should flag confusion, perplexity, doubt, and curiosity as related prototypes requiring a shared dimension, matching the historical human decision to add the uncertainty axis.
