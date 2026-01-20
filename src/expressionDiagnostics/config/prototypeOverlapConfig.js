/**
 * @file Configuration for Prototype Overlap Analysis
 * @see specs/prototype-overlap-analyzer.md
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
});

export default PROTOTYPE_OVERLAP_CONFIG;
