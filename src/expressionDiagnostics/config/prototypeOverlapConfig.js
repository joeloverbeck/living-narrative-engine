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
});

export default PROTOTYPE_OVERLAP_CONFIG;
