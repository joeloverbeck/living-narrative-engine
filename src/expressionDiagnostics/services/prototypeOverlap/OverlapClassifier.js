/**
 * @file OverlapClassifier - Stage C classification for prototype overlap analysis
 * @see specs/prototype-overlap-analyzer.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {'merge' | 'subsumed' | 'not_redundant'} ClassificationType
 */

/**
 * @typedef {object} Classification
 * @property {ClassificationType} type - Classification result
 * @property {string} [subsumedPrototype] - 'a' or 'b' indicating which is subsumed (only present when type === 'subsumed')
 * @property {object} thresholds - Thresholds used for classification decision
 * @property {object} metrics - Actual metric values used in decision
 */

/**
 * Stage C service for prototype overlap analysis.
 * Classifies prototype pairs into merge, subsumed, or not_redundant
 * based on candidate metrics and behavioral metrics.
 */
class OverlapClassifier {
  #config;
  #logger;

  /**
   * Constructs a new OverlapClassifier instance.
   *
   * @param {object} deps - Dependencies object
   * @param {object} deps.config - Configuration with classification thresholds
   * @param {import('../../../interfaces/coreServices.js').ILogger} deps.logger - ILogger
   */
  constructor({ config, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    this.#validateConfig(config, logger);

    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Classify a prototype pair based on candidate and behavioral metrics.
   *
   * @param {object} candidateMetrics - Metrics from Stage A (CandidatePairFilter)
   * @param {object} candidateMetrics.activeAxisOverlap - Jaccard overlap of active axes
   * @param {object} candidateMetrics.signAgreement - Sign agreement ratio
   * @param {object} candidateMetrics.weightCosineSimilarity - Cosine similarity of weight vectors
   * @param {object} behaviorMetrics - Metrics from Stage B (BehavioralOverlapEvaluator)
   * @param {object} behaviorMetrics.gateOverlap - Gate overlap statistics
   * @param {object} behaviorMetrics.intensity - Intensity similarity statistics
   * @returns {Classification} Classification result with type, thresholds, and metrics
   */
  classify(candidateMetrics, behaviorMetrics) {
    const thresholds = this.#extractThresholds();
    const metrics = this.#extractMetrics(candidateMetrics, behaviorMetrics);

    // Check classification in priority order: MERGE → SUBSUMED → NOT_REDUNDANT
    if (this.#checkMergeCriteria(metrics, thresholds)) {
      this.#logger.debug(
        `OverlapClassifier: Classified as MERGE - ` +
          `onEitherRate=${metrics.onEitherRate.toFixed(4)}, ` +
          `gateOverlapRatio=${metrics.gateOverlapRatio.toFixed(4)}, ` +
          `correlation=${metrics.pearsonCorrelation.toFixed(4)}`
      );
      return { type: 'merge', thresholds, metrics };
    }

    const subsumptionResult = this.#checkSubsumedCriteria(metrics, thresholds);
    if (subsumptionResult.isSubsumed) {
      this.#logger.debug(
        `OverlapClassifier: Classified as SUBSUMED (${subsumptionResult.subsumedPrototype}) - ` +
          `pOnlyRate=${metrics.pOnlyRate.toFixed(4)}, ` +
          `qOnlyRate=${metrics.qOnlyRate.toFixed(4)}, ` +
          `dominanceP=${metrics.dominanceP.toFixed(4)}, ` +
          `dominanceQ=${metrics.dominanceQ.toFixed(4)}`
      );
      return {
        type: 'subsumed',
        subsumedPrototype: subsumptionResult.subsumedPrototype,
        thresholds,
        metrics,
      };
    }

    this.#logger.debug(
      `OverlapClassifier: Classified as NOT_REDUNDANT - ` +
        `no criteria met for merge or subsumption`
    );
    return { type: 'not_redundant', thresholds, metrics };
  }


  /**
   * Check if a pair is a "near-miss" - close to redundancy thresholds but not quite meeting them.
   * This helps identify pairs that users might want to review even though they're not technically redundant.
   *
   * @param {object} candidateMetrics - Metrics from Stage A (CandidatePairFilter)
   * @param {object} behaviorMetrics - Metrics from Stage B (BehavioralOverlapEvaluator)
   * @returns {{isNearMiss: boolean, reason?: string, metrics: object, thresholdProximity?: object}} Near-miss result
   */
  checkNearMiss(candidateMetrics, behaviorMetrics) {
    const metrics = this.#extractMetrics(candidateMetrics, behaviorMetrics);

    // Get near-miss thresholds from config (use defaults if not present)
    const nearMissCorrelationThreshold =
      this.#config.nearMissCorrelationThreshold ?? 0.9;
    const nearMissGateOverlapRatio =
      this.#config.nearMissGateOverlapRatio ?? 0.75;

    // Get the actual merge thresholds for comparison
    const minCorrelationForMerge = this.#config.minCorrelationForMerge;
    const minGateOverlapRatio = this.#config.minGateOverlapRatio;

    // Check if pair has high correlation (near-miss range)
    const hasHighCorrelation =
      !Number.isNaN(metrics.pearsonCorrelation) &&
      metrics.pearsonCorrelation >= nearMissCorrelationThreshold &&
      metrics.pearsonCorrelation < minCorrelationForMerge;

    // Check if pair has moderate-to-high gate overlap (near-miss range)
    const hasHighGateOverlap =
      metrics.gateOverlapRatio >= nearMissGateOverlapRatio &&
      metrics.gateOverlapRatio < minGateOverlapRatio;

    // A near-miss is either high correlation OR high gate overlap (or both)
    // while not being dead prototypes
    const isNotDeadPrototype =
      metrics.onEitherRate >= this.#config.minOnEitherRateForMerge;

    if (!isNotDeadPrototype) {
      return { isNearMiss: false, metrics };
    }

    // Determine if it's a near-miss and why
    const reasons = [];
    if (hasHighCorrelation) {
      reasons.push(
        `correlation ${metrics.pearsonCorrelation.toFixed(3)} (threshold: ${minCorrelationForMerge})`
      );
    }
    if (hasHighGateOverlap) {
      reasons.push(
        `gate overlap ${metrics.gateOverlapRatio.toFixed(3)} (threshold: ${minGateOverlapRatio})`
      );
    }

    // Also check for pairs that passed both near-miss thresholds but failed merge on another criterion
    const bothCorrelationAndGateOk =
      !Number.isNaN(metrics.pearsonCorrelation) &&
      metrics.pearsonCorrelation >= nearMissCorrelationThreshold &&
      metrics.gateOverlapRatio >= nearMissGateOverlapRatio;

    if (bothCorrelationAndGateOk && reasons.length === 0) {
      // This pair has good correlation AND gate overlap but failed on something else
      // (likely mean absolute diff or dominance)
      if (
        Number.isNaN(metrics.meanAbsDiff) ||
        metrics.meanAbsDiff > this.#config.maxMeanAbsDiffForMerge
      ) {
        reasons.push(
          `mean abs diff ${metrics.meanAbsDiff?.toFixed(3) ?? 'NaN'} (threshold: ${this.#config.maxMeanAbsDiffForMerge})`
        );
      }
    }

    if (reasons.length === 0) {
      return { isNearMiss: false, metrics };
    }

    // Build threshold proximity analysis
    const thresholdProximity = {
      correlation: {
        value: metrics.pearsonCorrelation,
        nearMissThreshold: nearMissCorrelationThreshold,
        mergeThreshold: minCorrelationForMerge,
        met: hasHighCorrelation || metrics.pearsonCorrelation >= minCorrelationForMerge,
      },
      gateOverlapRatio: {
        value: metrics.gateOverlapRatio,
        nearMissThreshold: nearMissGateOverlapRatio,
        mergeThreshold: minGateOverlapRatio,
        met: hasHighGateOverlap || metrics.gateOverlapRatio >= minGateOverlapRatio,
      },
      onEitherRate: {
        value: metrics.onEitherRate,
        threshold: this.#config.minOnEitherRateForMerge,
        met: isNotDeadPrototype,
      },
    };

    this.#logger.debug(
      `OverlapClassifier: Near-miss detected - ${reasons.join(', ')}`
    );

    return {
      isNearMiss: true,
      reason: reasons.join('; '),
      metrics,
      thresholdProximity,
    };
  }

  /**
   * Extract thresholds from config for transparency in results.
   *
   * @returns {object} Threshold values used for classification
   */
  #extractThresholds() {
    return {
      minOnEitherRateForMerge: this.#config.minOnEitherRateForMerge,
      minGateOverlapRatio: this.#config.minGateOverlapRatio,
      minCorrelationForMerge: this.#config.minCorrelationForMerge,
      maxMeanAbsDiffForMerge: this.#config.maxMeanAbsDiffForMerge,
      maxExclusiveRateForSubsumption: this.#config.maxExclusiveRateForSubsumption,
      minCorrelationForSubsumption: this.#config.minCorrelationForSubsumption,
      minDominanceForSubsumption: this.#config.minDominanceForSubsumption,
    };
  }

  /**
   * Extract relevant metrics from candidate and behavioral metrics.
   *
   * @param {object} candidateMetrics - Stage A metrics
   * @param {object} behaviorMetrics - Stage B metrics
   * @returns {object} Flattened metrics for classification
   */
  #extractMetrics(candidateMetrics, behaviorMetrics) {
    const gateOverlap = behaviorMetrics?.gateOverlap ?? {};
    const intensity = behaviorMetrics?.intensity ?? {};

    const onEitherRate = gateOverlap.onEitherRate ?? 0;
    const onBothRate = gateOverlap.onBothRate ?? 0;

    // Compute gate overlap ratio safely (avoid division by zero)
    const gateOverlapRatio = onEitherRate > 0 ? onBothRate / onEitherRate : 0;

    return {
      // Candidate metrics (Stage A)
      activeAxisOverlap: candidateMetrics?.activeAxisOverlap ?? 0,
      signAgreement: candidateMetrics?.signAgreement ?? 0,
      weightCosineSimilarity: candidateMetrics?.weightCosineSimilarity ?? 0,

      // Gate overlap metrics (Stage B)
      onEitherRate,
      onBothRate,
      pOnlyRate: gateOverlap.pOnlyRate ?? 0,
      qOnlyRate: gateOverlap.qOnlyRate ?? 0,
      gateOverlapRatio,

      // Intensity metrics (Stage B)
      pearsonCorrelation: intensity.pearsonCorrelation ?? NaN,
      meanAbsDiff: intensity.meanAbsDiff ?? NaN,
      dominanceP: intensity.dominanceP ?? 0,
      dominanceQ: intensity.dominanceQ ?? 0,
    };
  }

  /**
   * Check if metrics meet MERGE criteria.
   *
   * MERGE requires ALL of:
   * - onEitherRate >= minOnEitherRateForMerge (not dead prototypes)
   * - gateOverlapRatio >= minGateOverlapRatio (high gate overlap)
   * - pearsonCorrelation >= minCorrelationForMerge (very correlated)
   * - meanAbsDiff <= maxMeanAbsDiffForMerge (similar intensities)
   * - dominanceP < minDominanceForSubsumption AND dominanceQ < minDominanceForSubsumption (neither dominates)
   *
   * @param {object} metrics - Extracted metrics
   * @param {object} thresholds - Classification thresholds
   * @returns {boolean} True if all merge criteria are met
   */
  #checkMergeCriteria(metrics, thresholds) {
    // Filter out dead prototypes (low trigger rate)
    if (metrics.onEitherRate < thresholds.minOnEitherRateForMerge) {
      return false;
    }

    // Require high gate overlap ratio
    if (metrics.gateOverlapRatio < thresholds.minGateOverlapRatio) {
      return false;
    }

    // Require very high correlation (handle NaN as failure)
    if (
      Number.isNaN(metrics.pearsonCorrelation) ||
      metrics.pearsonCorrelation < thresholds.minCorrelationForMerge
    ) {
      return false;
    }

    // Require similar intensities (handle NaN as failure)
    if (
      Number.isNaN(metrics.meanAbsDiff) ||
      metrics.meanAbsDiff > thresholds.maxMeanAbsDiffForMerge
    ) {
      return false;
    }

    // Neither prototype should dominate the other for merge
    if (
      metrics.dominanceP >= thresholds.minDominanceForSubsumption ||
      metrics.dominanceQ >= thresholds.minDominanceForSubsumption
    ) {
      return false;
    }

    return true;
  }

  /**
   * Check if metrics meet SUBSUMED criteria.
   *
   * SUBSUMED requires:
   * - pOnlyRate <= maxExclusiveRateForSubsumption OR qOnlyRate <= maxExclusiveRateForSubsumption (one-sided)
   * - pearsonCorrelation >= minCorrelationForSubsumption (correlated)
   * - dominanceP >= minDominanceForSubsumption OR dominanceQ >= minDominanceForSubsumption (one dominates)
   *
   * @param {object} metrics - Extracted metrics
   * @param {object} thresholds - Classification thresholds
   * @returns {{isSubsumed: boolean, subsumedPrototype?: 'a' | 'b'}} Subsumption result
   */
  #checkSubsumedCriteria(metrics, thresholds) {
    // Require sufficient correlation (handle NaN as failure)
    if (
      Number.isNaN(metrics.pearsonCorrelation) ||
      metrics.pearsonCorrelation < thresholds.minCorrelationForSubsumption
    ) {
      return { isSubsumed: false };
    }

    // Check if A is subsumed by B:
    // - A rarely fires alone (pOnlyRate low)
    // - B dominates A (intensityB > intensityA most of the time)
    const aIsSubsumed =
      metrics.pOnlyRate <= thresholds.maxExclusiveRateForSubsumption &&
      metrics.dominanceQ >= thresholds.minDominanceForSubsumption;

    if (aIsSubsumed) {
      return { isSubsumed: true, subsumedPrototype: 'a' };
    }

    // Check if B is subsumed by A:
    // - B rarely fires alone (qOnlyRate low)
    // - A dominates B (intensityA > intensityB most of the time)
    const bIsSubsumed =
      metrics.qOnlyRate <= thresholds.maxExclusiveRateForSubsumption &&
      metrics.dominanceP >= thresholds.minDominanceForSubsumption;

    if (bIsSubsumed) {
      return { isSubsumed: true, subsumedPrototype: 'b' };
    }

    return { isSubsumed: false };
  }

  /**
   * Validate that config has required numeric thresholds.
   *
   * @param {object} config - Configuration object
   * @param {object} logger - Logger for error messages
   */
  #validateConfig(config, logger) {
    if (!config || typeof config !== 'object') {
      logger.error('OverlapClassifier: Missing or invalid config');
      throw new Error('OverlapClassifier requires a valid config object');
    }

    const requiredKeys = [
      'minOnEitherRateForMerge',
      'minGateOverlapRatio',
      'minCorrelationForMerge',
      'maxMeanAbsDiffForMerge',
      'maxExclusiveRateForSubsumption',
      'minCorrelationForSubsumption',
      'minDominanceForSubsumption',
    ];

    for (const key of requiredKeys) {
      if (typeof config[key] !== 'number') {
        logger.error(
          `OverlapClassifier: Missing or invalid config.${key} (expected number)`
        );
        throw new Error(`OverlapClassifier config requires numeric ${key}`);
      }
    }
  }
}

export default OverlapClassifier;
