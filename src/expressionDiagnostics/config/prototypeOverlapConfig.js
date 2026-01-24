/**
 * @file Configuration for Prototype Overlap Analysis
 * @see specs/prototype-overlap-analyzer.md
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

/**
 * @typedef {object} PrototypeOverlapConfig
 * @property {number} activeAxisEpsilon - Minimum |weight| to consider axis "active"
 * @property {number} candidateMinActiveAxisOverlap - Jaccard threshold for active axis sets
 * @property {number} candidateMinSignAgreement - Sign agreement threshold for shared axes
 * @property {number} candidateMinCosineSimilarity - Cosine similarity threshold for weight vectors
 * @property {number} softSignThreshold - Threshold for neutralizing near-zero weights in sign agreement
 * @property {number} jaccardEmptySetValue - Value to return for Jaccard(∅, ∅)
 * @property {number} sampleCountPerPair - Number of random contexts per candidate pair
 * @property {number} divergenceExamplesK - Top-K divergence examples to store
 * @property {number} dominanceDelta - Intensity difference threshold for dominance
 * @property {number} minOnEitherRateForMerge - Minimum trigger rate to consider for merge (filters dead prototypes)
 * @property {number} minGateOverlapRatio - onBothRate/onEitherRate threshold for merge
 * @property {number} minCorrelationForMerge - Pearson correlation threshold for merge
 * @property {number} maxMeanAbsDiffForMerge - Maximum mean |intensityA - intensityB| for merge
 * @property {number} maxExclusiveRateForSubsumption - Maximum pOnlyRate or qOnlyRate for subsumption
 * @property {number} minCorrelationForSubsumption - Pearson correlation threshold for subsumption
 * @property {number} minDominanceForSubsumption - Dominance threshold for subsumption
 * @property {number} minGlobalCorrelationForMerge - Global output correlation threshold for merge
 * @property {number} minGlobalCorrelationForSubsumption - Global output correlation threshold for subsumption
 * @property {number} coPassSampleConfidenceThreshold - Minimum co-pass samples for reliable co-pass correlation
 * @property {number} minCoPassRatioForReliable - Minimum co-pass ratio for reliable co-pass correlation
 * @property {number} coPassCorrelationWeight - Weight for co-pass correlation when combining
 * @property {number} globalCorrelationWeight - Weight for global correlation when combining
 * @property {number} maxGlobalMeanAbsDiffForMerge - Maximum global mean abs diff for merge
 * @property {number} nearMissGlobalCorrelationThreshold - Global correlation threshold for near-miss detection
 * @property {number} compositeScoreGateOverlapWeight - Weight for gate overlap in composite score [0,1]
 * @property {number} compositeScoreCorrelationWeight - Weight for correlation in composite score [0,1]
 * @property {number} compositeScoreGlobalDiffWeight - Weight for global diff similarity in composite score [0,1]
 * @property {number} maxCandidatePairs - Safety limit on candidate pairs
 * @property {number} maxSamplesTotal - Safety limit on total samples
 * @property {number} minCoPassSamples - Minimum co-pass samples for valid correlation (v2)
 * @property {number} intensityEps - Epsilon for "near-equal" intensity comparison (v2)
 * @property {number} minPctWithinEpsForMerge - Required % of co-pass samples within epsilon for merge (v2)
 * @property {number} strictEpsilon - Epsilon for normalizing strict inequalities in gate analysis (v2)
 * @property {number} nestedConditionalThreshold - pA_given_B threshold for behavioral nesting (v2)
 * @property {number} strongGateOverlapRatio - Gate overlap ratio for merge recommendation (v2)
 * @property {number} strongCorrelationForMerge - Correlation threshold for merge recommendation (v2)
 * @property {number} minExclusiveForBroader - Min exclusive rate for broader prototype in subsumption (v2)
 * @property {number[]} highThresholds - Thresholds for high-intensity co-activation analysis (v2)
 * @property {{[key: string]: number}} minHighJaccardForMergeAtT - Optional high Jaccard signal per threshold (v2)
 * @property {string[]} changeEmotionNameHints - Name patterns for CONVERT_TO_EXPRESSION classification (v2)
 * @property {boolean} enableConvertToExpression - Feature flag for v2 classification (v2)
 * @property {number} bandMargin - Gate banding suggestion margin (v2)
 * @property {number} minPassSamplesForConditional - Minimum pass count for valid conditional probabilities (v2)
 * @property {boolean} enableMultiRouteFiltering - Feature flag for multi-route candidate filtering (v2.1)
 * @property {number} gateBasedMinIntervalOverlap - Min interval overlap ratio for Route B gate similarity (v2.1)
 * @property {number} prescanSampleCount - Sample count for Route C behavioral prescan (v2.1)
 * @property {number} prescanMinGateOverlap - Min gate overlap ratio for Route C to promote candidate (v2.1)
 * @property {number} maxPrescanPairs - Safety limit on pairs to prescan in Route C (v2.1)
 * @property {number} sharedPoolSize - Total contexts in shared context pool (v3)
 * @property {boolean} enableStratifiedSampling - Whether to stratify by mood regime (v3)
 * @property {number} stratumCount - Number of strata for stratified sampling (v3)
 * @property {string} stratificationStrategy - Stratification strategy (v3)
 * @property {number|null} poolRandomSeed - Random seed for reproducible pool generation (v3)
 * @property {number} confidenceLevel - Confidence level for Wilson CI (v3)
 * @property {number} minSamplesForReliableCorrelation - Min co-pass samples for reliable correlation (v3)
 * @property {number} maxMaeCoPassForMerge - Max MAE on co-pass for merge (v3)
 * @property {number} maxRmseCoPassForMerge - Max RMSE on co-pass for merge (v3)
 * @property {number} maxMaeGlobalForMerge - Max global MAE for merge (v3)
 * @property {number} minActivationJaccardForMerge - Min activation Jaccard for merge (v3)
 * @property {number} minConditionalProbForNesting - Min P(A|B) for nesting (v3)
 * @property {number} minConditionalProbCILowerForNesting - Min CI lower bound for nesting (v3)
 * @property {number} symmetryTolerance - Tolerance for symmetric conditional probabilities (v3)
 * @property {number} asymmetryRequired - Required asymmetry for subsumption (v3)
 * @property {number} maxMaeDeltaForExpression - Max MAE delta for expression conversion (v3)
 * @property {number} maxExclusiveForSubsumption - Max exclusive activation for subsumption (v3)
 * @property {number} lowVolumeThreshold - Activation rate threshold for low-volume (v3)
 * @property {number} lowNoveltyThreshold - Delta threshold for low-novelty (v3)
 * @property {number} singleAxisFocusThreshold - Weight concentration threshold for single-axis focus (v3)
 * @property {string} clusteringMethod - Clustering method for profiling (v3)
 * @property {number} clusterCount - Number of prototype clusters (v3)
 * @property {number} minSamplesForStump - Min samples for decision stump (v3)
 * @property {number} minInfoGainForSuggestion - Min info gain for suggestion (v3)
 * @property {number} divergenceThreshold - Min divergence for sample inclusion (v3)
 * @property {number} maxSuggestionsPerPair - Max suggestions per pair (v3)
 * @property {number} minOverlapReductionForSuggestion - Min overlap reduction for suggestion (v3)
 * @property {number} minActivationRateAfterSuggestion - Min activation rate after suggestion (v3)
 * @property {boolean} enableAxisGapDetection - Enable axis gap detection in pipeline
 * @property {number} pcaResidualVarianceThreshold - PCA residual variance threshold
 * @property {number} pcaKaiserThreshold - Kaiser criterion eigenvalue threshold
 * @property {number} hubMinDegree - Minimum overlap connections for hub detection
 * @property {number} hubMaxEdgeWeight - Maximum edge weight (exclude near-duplicates)
 * @property {number} hubMinNeighborhoodDiversity - Minimum clusters in neighborhood
 * @property {number} coverageGapAxisDistanceThreshold - Min distance from any axis
 * @property {number} coverageGapMinClusterSize - Min prototypes in cluster
 * @property {number} multiAxisUsageThreshold - IQR multiplier for many axes
 * @property {number} multiAxisSignBalanceThreshold - Max sign balance for conflicting
 */

/**
 * Configuration for prototype overlap analysis.
 *
 * @type {Readonly<PrototypeOverlapConfig>}
 */
export const PROTOTYPE_OVERLAP_CONFIG = Object.freeze({
  // Stage A: Candidate filtering thresholds
  /**
   * Minimum absolute weight to consider an axis "active" in a prototype.
   */
  activeAxisEpsilon: 0.08,

  /**
   * Minimum Jaccard overlap of active axis sets to consider as candidate pair.
   */
  candidateMinActiveAxisOverlap: 0.6,

  /**
   * Minimum sign agreement ratio for shared active axes.
   */
  candidateMinSignAgreement: 0.8,

  /**
   * Minimum cosine similarity of weight vectors.
   */
  candidateMinCosineSimilarity: 0.85,

  /**
   * Threshold for "soft sign" comparison in sign agreement calculation.
   * Weights with |w| < this value are treated as neutral (sign 0).
   * Set to 0 to disable soft sign (uses Math.sign behavior).
   */
  softSignThreshold: 0.15,

  /**
   * Value to return when computing Jaccard similarity of two empty sets.
   * Use 1.0 to treat empty sets as perfectly overlapping, 0.0 for legacy behavior.
   */
  jaccardEmptySetValue: 1.0,

  // Stage B: Behavioral sampling configuration
  /**
   * Number of random contexts to sample per candidate pair.
   */
  sampleCountPerPair: 8000,

  /**
   * Number of top divergence examples to retain.
   */
  divergenceExamplesK: 5,

  /**
   * Intensity difference threshold for dominance calculation.
   */
  dominanceDelta: 0.05,

  // Classification thresholds for MERGE
  /**
   * Minimum onEitherRate to consider for merge (filters dead prototypes).
   */
  minOnEitherRateForMerge: 0.05,

  /**
   * Minimum gate overlap ratio (onBothRate / onEitherRate) for merge.
   */
  minGateOverlapRatio: 0.9,

  /**
   * Minimum Pearson correlation of intensities for merge.
   */
  minCorrelationForMerge: 0.98,

  /**
   * Maximum mean absolute intensity difference for merge.
   */
  maxMeanAbsDiffForMerge: 0.03,

  // Classification thresholds for SUBSUMED
  /**
   * Maximum exclusive rate (pOnlyRate or qOnlyRate) for subsumption.
   */
  maxExclusiveRateForSubsumption: 0.01,

  /**
   * Minimum Pearson correlation for subsumption.
   */
  minCorrelationForSubsumption: 0.95,

  /**
   * Minimum dominance threshold for subsumption.
   */
  minDominanceForSubsumption: 0.95,

  /**
   * Minimum global output correlation for merge (global includes zero-output samples).
   */
  minGlobalCorrelationForMerge: 0.9,

  /**
   * Minimum global output correlation for subsumption (global includes zero-output samples).
   */
  minGlobalCorrelationForSubsumption: 0.85,

  /**
   * Minimum co-pass samples required to trust co-pass correlation.
   */
  coPassSampleConfidenceThreshold: 500,

  /**
   * Minimum co-pass ratio required to trust co-pass correlation.
   */
  minCoPassRatioForReliable: 0.1,

  /**
   * Weight for co-pass correlation when combining correlations.
   */
  coPassCorrelationWeight: 0.6,

  /**
   * Weight for global correlation when combining correlations.
   */
  globalCorrelationWeight: 0.4,

  /**
   * Maximum global mean absolute difference for merge.
   */
  maxGlobalMeanAbsDiffForMerge: 0.15,

  // Safety limits
  /**
   * Maximum number of candidate pairs to evaluate (prevents O(n²) explosion).
   */
  maxCandidatePairs: 5000,

  /**
   * Maximum total samples across all pairs.
   */
  maxSamplesTotal: 1000000,

  // Near-miss detection thresholds
  /**
   * Correlation threshold for near-miss detection (lower than merge threshold).
   * Pairs with correlation >= this but < minCorrelationForMerge are near-misses.
   */
  nearMissCorrelationThreshold: 0.9,

  /**
   * Global correlation threshold for near-miss detection.
   * Used when effective correlation is based on global metrics.
   */
  nearMissGlobalCorrelationThreshold: 0.8,

  // ========================================
  // Composite Score Weights Configuration
  // ========================================

  /**
   * Weight for gate overlap ratio in composite score calculation.
   * Higher values emphasize how often prototypes fire together.
   * Range: [0, 1], should sum with other weights to 1.0
   */
  compositeScoreGateOverlapWeight: 0.3,

  /**
   * Weight for normalized correlation in composite score calculation.
   * Higher values emphasize intensity correlation when both prototypes fire.
   * Range: [0, 1], should sum with other weights to 1.0
   */
  compositeScoreCorrelationWeight: 0.2,

  /**
   * Weight for global output similarity (1 - globalMeanAbsDiff) in composite score.
   * Higher values emphasize how similar actual outputs are across ALL samples.
   * Range: [0, 1], should sum with other weights to 1.0
   *
   * Rationale: globalMeanAbsDiff is an MAE metric that directly measures
   * "how different are the actual outputs" - the most relevant metric for similarity.
   */
  compositeScoreGlobalDiffWeight: 0.5,

  /**
   * Gate overlap ratio threshold for near-miss detection.
   * Pairs with gate overlap >= this but < minGateOverlapRatio are near-misses.
   */
  nearMissGateOverlapRatio: 0.75,

  /**
   * Maximum number of near-miss pairs to include in results.
   */
  maxNearMissPairsToReport: 10,

  // ========================================
  // V2 Configuration Properties
  // See: specs/prototype-redundancy-analyzer-v2.md
  // ========================================

  // Part A: New metrics configuration
  /**
   * Minimum co-pass samples for valid correlation computation.
   * Below this threshold, correlation-based metrics are NaN.
   */
  minCoPassSamples: 200,

  /**
   * Epsilon for "near-equal" intensity comparison.
   * Used to compute pctWithinEps metric.
   */
  intensityEps: 0.05,

  /**
   * Required percentage of co-pass samples within epsilon for merge.
   * Value must be in (0, 1].
   */
  minPctWithinEpsForMerge: 0.85,

  // Part B: Gate analysis configuration
  /**
   * Epsilon for normalizing strict inequalities (> or <) to closed bounds.
   * Example: "valence > 0.10" becomes lower = 0.10 + strictEpsilon.
   */
  strictEpsilon: 1e-6,

  // Part C: Classification thresholds
  /**
   * pA_given_B threshold for behavioral nesting detection.
   * If pB_given_A >= this threshold, A behaviorally implies B.
   */
  nestedConditionalThreshold: 0.97,

  /**
   * Gate overlap ratio threshold for merge recommendation.
   * Lowered from minGateOverlapRatio for v2 MERGE_RECOMMENDED classification.
   */
  strongGateOverlapRatio: 0.8,

  /**
   * Correlation threshold for merge recommendation.
   * Lowered from minCorrelationForMerge (0.98) for v2 classification.
   */
  strongCorrelationForMerge: 0.97,

  /**
   * Minimum exclusive rate for broader prototype in subsumption detection.
   * The broader prototype must have at least this much exclusive activation.
   */
  minExclusiveForBroader: 0.01,

  /**
   * Intensity thresholds for high-activation co-occurrence analysis.
   * Used to compute pHighA, pHighB, pHighBoth, highJaccard, highAgreement.
   */
  highThresholds: [0.4, 0.6, 0.75],

  /**
   * Optional per-threshold minimum high Jaccard for merge consideration.
   * Keys are threshold values as strings (e.g., '0.6').
   */
  minHighJaccardForMergeAtT: { '0.6': 0.75 },

  // Part D: Feature configuration
  /**
   * Name patterns that hint a prototype should be CONVERT_TO_EXPRESSION.
   * These are checked against prototype IDs when enableConvertToExpression is true.
   */
  changeEmotionNameHints: ['relief', 'surprise_startle', 'release'],

  /**
   * Feature flag enabling CONVERT_TO_EXPRESSION classification.
   * When false, this classification type is skipped entirely.
   */
  enableConvertToExpression: true,

  /**
   * Margin for gate banding suggestions.
   * Used to suggest new gate bounds to separate nested siblings.
   */
  bandMargin: 0.05,

  /**
   * Minimum pass samples for conditional probability metrics to be considered valid.
   * Below this threshold, pA_given_B and pB_given_A are set to NaN to prevent
   * statistically unreliable nesting/subsumption classifications.
   */
  minPassSamplesForConditional: 200,

  // ========================================
  // V2.1 Multi-Route Filtering Configuration
  // ========================================

  /**
   * Feature flag enabling multi-route candidate filtering.
   * When true, uses Route A (weight-vector), Route B (gate-based), and Route C (behavioral prescan).
   * When false, uses only Route A (original weight-vector filtering).
   */
  enableMultiRouteFiltering: true,

  /**
   * Minimum gate interval overlap ratio for Route B selection.
   * Pairs with gate interval overlap >= this value are selected via Route B.
   */
  gateBasedMinIntervalOverlap: 0.6,

  /**
   * Number of random samples for Route C behavioral prescan.
   * Lower than full sampleCountPerPair for efficiency.
   */
  prescanSampleCount: 500,

  /**
   * Minimum gate overlap ratio (onBothCount/onEitherCount) for Route C to promote.
   * Pairs with behavioral gate overlap >= this value are promoted to full analysis.
   */
  prescanMinGateOverlap: 0.5,

  /**
   * Maximum number of pairs to prescan in Route C.
   * Safety limit to prevent runaway computation on large rejected sets.
   */
  maxPrescanPairs: 1000,

  // ========================================
  // V3 Configuration Properties
  // See: specs/prototype-analysis-overhaul-v3.md
  // ========================================

  // === V3 Shared Context Pool (ticket 001) ===
  /**
   * Total number of contexts in the shared context pool.
   */
  sharedPoolSize: 50000,

  /**
   * Whether to stratify sampling by mood regime (valence bands).
   */
  enableStratifiedSampling: false,

  /**
   * Number of strata when stratified sampling is enabled.
   */
  stratumCount: 5,

  /**
   * Stratification strategy: 'uniform' | 'mood-regime' | 'extremes-enhanced'.
   */
  stratificationStrategy: 'uniform',

  /**
   * Random seed for reproducible pool generation. Null for non-deterministic.
   */
  poolRandomSeed: null,

  // === V3 Agreement Metrics (ticket 004) ===
  /**
   * Confidence level for Wilson confidence intervals (0.9, 0.95, or 0.99).
   */
  confidenceLevel: 0.95,

  /**
   * Minimum co-pass samples for reliable correlation computation.
   */
  minSamplesForReliableCorrelation: 500,

  // === V3 Classification Thresholds (ticket 010) ===
  /**
   * Maximum MAE on co-pass samples for merge classification.
   */
  maxMaeCoPassForMerge: 0.03,

  /**
   * Maximum RMSE on co-pass samples for merge classification.
   */
  maxRmseCoPassForMerge: 0.05,

  /**
   * Maximum global MAE for merge classification.
   */
  maxMaeGlobalForMerge: 0.08,

  /**
   * Minimum activation Jaccard for merge classification.
   */
  minActivationJaccardForMerge: 0.85,

  /**
   * Minimum P(A|B) for nesting classification.
   */
  minConditionalProbForNesting: 0.95,

  /**
   * Minimum lower bound of Wilson CI for conditional probability in nesting.
   */
  minConditionalProbCILowerForNesting: 0.9,

  /**
   * Tolerance for symmetric conditional probabilities P(A|B) ≈ P(B|A).
   */
  symmetryTolerance: 0.05,

  /**
   * Required asymmetry for subsumption classification.
   */
  asymmetryRequired: 0.1,

  /**
   * Maximum MAE delta for expression conversion classification.
   */
  maxMaeDeltaForExpression: 0.05,

  /**
   * Maximum exclusive activation rate for subsumption classification.
   */
  maxExclusiveForSubsumption: 0.05,

  // === V3 Prototype Profile (ticket 005) ===
  /**
   * Activation rate below which a prototype is considered low-volume (rare).
   */
  lowVolumeThreshold: 0.05,

  /**
   * Delta from nearest cluster centroid below which novelty is low.
   */
  lowNoveltyThreshold: 0.15,

  /**
   * Weight concentration above which a prototype is single-axis focused.
   */
  singleAxisFocusThreshold: 0.6,

  /**
   * Clustering method for prototype profiling: 'k-means' | 'hierarchical'.
   */
  clusteringMethod: 'k-means',

  /**
   * Number of clusters for prototype profiling.
   */
  clusterCount: 10,

  // === V3 Actionable Suggestions (ticket 007) ===
  /**
   * Minimum samples for decision stump training.
   */
  minSamplesForStump: 100,

  /**
   * Minimum information gain for a suggestion to be included.
   */
  minInfoGainForSuggestion: 0.05,

  /**
   * Minimum divergence threshold for sample inclusion in stump training.
   */
  divergenceThreshold: 0.1,

  /**
   * Maximum suggestions to generate per prototype pair.
   */
  maxSuggestionsPerPair: 3,

  /**
   * Minimum overlap reduction for a suggestion to be actionable.
   */
  minOverlapReductionForSuggestion: 0.1,

  /**
   * Minimum activation rate after applying suggestion.
   */
  minActivationRateAfterSuggestion: 0.01,

  // === Axis Gap Detection Configuration (ticket AXIGAPDETSPE-001) ===
  /**
   * Enable axis gap detection in the analysis pipeline.
   */
  enableAxisGapDetection: true,

  /**
   * PCA residual variance ratio threshold for flagging missing dimensions.
   */
  pcaResidualVarianceThreshold: 0.15,

  /**
   * Eigenvalue threshold for Kaiser significance check.
   */
  pcaKaiserThreshold: 1.0,

  /**
   * Minimum overlap connections for hub prototype detection.
   */
  hubMinDegree: 4,

  /**
   * Maximum edge weight for hub detection (exclude near-duplicates).
   */
  hubMaxEdgeWeight: 0.9,

  /**
   * Minimum distinct clusters in hub neighborhood.
   */
  hubMinNeighborhoodDiversity: 2,

  /**
   * Minimum cosine distance from any axis for coverage gap detection.
   */
  coverageGapAxisDistanceThreshold: 0.6,

  /**
   * Minimum prototypes in a coverage gap cluster.
   */
  coverageGapMinClusterSize: 3,

  /**
   * IQR multiplier threshold for multi-axis usage detection.
   */
  multiAxisUsageThreshold: 1.5,

  /**
   * Maximum sign balance ratio for multi-axis conflict detection.
   */
  multiAxisSignBalanceThreshold: 0.4,
});

export default PROTOTYPE_OVERLAP_CONFIG;
