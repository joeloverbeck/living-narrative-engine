/**
 * @file OverlapClassifier - Stage C classification for prototype overlap analysis
 * @see specs/prototype-overlap-analyzer.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {'merge_recommended' | 'subsumed_recommended' | 'nested_siblings' |
 *           'needs_separation' | 'keep_distinct' | 'convert_to_expression'} ClassificationTypeV2
 */

/**
 * @typedef {object} Classification
 * @property {ClassificationTypeV2} type - Classification result
 * @property {string} [subsumedPrototype] - 'a' or 'b' indicating which is subsumed (only present when type === 'subsumed_recommended')
 * @property {object} thresholds - Thresholds used for classification decision
 * @property {object} metrics - Actual metric values used in decision
 */

/**
 * Classification priority order - first match wins.
 *
 * @type {ClassificationTypeV2[]}
 */
const CLASSIFICATION_PRIORITY = [
  'merge_recommended',
  'subsumed_recommended',
  'convert_to_expression',
  'nested_siblings',
  'needs_separation',
  'keep_distinct',
];

/**
 * Stage C service for prototype overlap analysis.
 * Classifies prototype pairs using v2 classification types:
 * - merge_recommended: Both prototypes functionally equivalent, can be merged
 * - subsumed_recommended: One prototype subsumes the other
 * - nested_siblings: Related hierarchy (e.g., interest→curiosity)
 * - needs_separation: Too similar, needs gate differentiation
 * - convert_to_expression: Should be expression, not prototype
 * - keep_distinct: Properly differentiated, no action needed
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
   * Uses priority-based classification with v2 types.
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

    // Check classification in priority order - first match wins
    for (const classificationType of CLASSIFICATION_PRIORITY) {
      const checkResult = this.#checkClassification(
        classificationType,
        metrics,
        thresholds
      );
      if (checkResult.matches) {
        return this.#buildClassificationResult(
          classificationType,
          metrics,
          thresholds,
          checkResult.subsumedPrototype
        );
      }
    }

    // Fallback (should never reach here since keep_distinct always returns true)
    return this.#buildClassificationResult(
      'keep_distinct',
      metrics,
      thresholds,
      null
    );
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
    const passRates = behaviorMetrics?.passRates ?? null;
    const gateImplication = behaviorMetrics?.gateImplication ?? null;
    const gateParseInfo = behaviorMetrics?.gateParseInfo ?? null;

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

      // Intensity metrics (Stage B) - co-pass only
      pearsonCorrelation: intensity.pearsonCorrelation ?? NaN,
      meanAbsDiff: intensity.meanAbsDiff ?? NaN,
      dominanceP: intensity.dominanceP ?? 0,
      dominanceQ: intensity.dominanceQ ?? 0,

      // Global output metrics (Stage B) - ALL samples, addresses selection bias
      globalMeanAbsDiff: intensity.globalMeanAbsDiff ?? NaN,
      globalL2Distance: intensity.globalL2Distance ?? NaN,
      globalOutputCorrelation: intensity.globalOutputCorrelation ?? NaN,

      // Pass rates metrics (Stage B) - for nested siblings / needs separation
      passRates,

      // Gate implication metrics (Stage B) - for convert_to_expression
      gateImplication,

      // Gate parse info (Stage B) - for transparency about parse coverage
      gateParseInfo,
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
   * Check if merge is recommended (delegates to #checkMergeCriteria).
   *
   * @param {object} metrics - Extracted metrics
   * @param {object} thresholds - Classification thresholds
   * @returns {{matches: boolean}} Check result
   */
  #checkMergeRecommended(metrics, thresholds) {
    return { matches: this.#checkMergeCriteria(metrics, thresholds) };
  }

  /**
   * Check if subsumption is recommended (delegates to #checkSubsumedCriteria).
   *
   * @param {object} metrics - Extracted metrics
   * @param {object} thresholds - Classification thresholds
   * @returns {{matches: boolean, subsumedPrototype?: 'a' | 'b'}} Check result
   */
  #checkSubsumedRecommended(metrics, thresholds) {
    const result = this.#checkSubsumedCriteria(metrics, thresholds);
    return {
      matches: result.isSubsumed,
      subsumedPrototype: result.subsumedPrototype,
    };
  }

  /**
   * Check if prototype should be converted to expression.
   * Detects prototypes that exhibit nesting behavior combined with
   * low-threat steady state patterns (threat <= 0.20).
   *
   * PROREDANAV2-012: Implemented with GateImplicationEvaluator integration.
   *
   * @param {object} metrics - Extracted metrics including gateImplication and passRates
   * @returns {{matches: boolean, subsumedPrototype?: 'a' | 'b'}} Check result
   */
  #checkConvertToExpression(metrics) {
    // Feature flag gate
    if (!this.#config.enableConvertToExpression) {
      return { matches: false };
    }

    // Must have nesting (deterministic or behavioral)
    const nestingResult = this.#hasNesting(metrics);
    if (!nestingResult.hasNesting) {
      return { matches: false };
    }

    // Check structural heuristic (low-threat steady state pattern)
    const structuralMatch = this.#matchesConversionStructure(metrics);
    if (structuralMatch.matches) {
      return structuralMatch;
    }

    // If nesting exists but no structural match, don't convert
    return { matches: false };
  }

  /**
   * Check if metrics indicate nesting (one prototype implies the other).
   * Combines deterministic gate implication analysis with behavioral
   * conditional probability analysis.
   *
   * @param {object} metrics - Extracted metrics
   * @returns {{hasNesting: boolean, narrowerPrototype?: 'a' | 'b'}} Nesting result
   */
  #hasNesting(metrics) {
    const { passRates, gateImplication, gateParseInfo } = metrics;
    const threshold = this.#config.nestedConditionalThreshold ?? 0.97;

    // Guard: Only trust deterministic nesting when parse is complete for BOTH prototypes
    // and the implication is not vacuous (based on unsatisfiable intervals)
    const parseComplete =
      gateParseInfo &&
      gateParseInfo.prototypeA?.parseStatus === 'complete' &&
      gateParseInfo.prototypeB?.parseStatus === 'complete';

    // Deterministic nesting via gate implication (asymmetric)
    // A implies B means A is narrower (any state satisfying A also satisfies B)
    // Only use deterministic nesting when:
    // 1. Parse is complete for both prototypes
    // 2. Implication is not vacuously true (empty sets)
    const hasDeterministicNesting =
      parseComplete &&
      gateImplication &&
      !gateImplication.isVacuous &&
      gateImplication.A_implies_B !== gateImplication.B_implies_A;

    let deterministicNarrower = null;
    if (hasDeterministicNesting) {
      // If A implies B but not vice versa, A is the narrower prototype
      deterministicNarrower = gateImplication.A_implies_B ? 'a' : 'b';
    }

    // Behavioral nesting via conditional probabilities
    if (!passRates) {
      return hasDeterministicNesting
        ? { hasNesting: true, narrowerPrototype: deterministicNarrower }
        : { hasNesting: false };
    }

    const { pA_given_B, pB_given_A } = passRates;
    if (Number.isNaN(pA_given_B) || Number.isNaN(pB_given_A)) {
      return hasDeterministicNesting
        ? { hasNesting: true, narrowerPrototype: deterministicNarrower }
        : { hasNesting: false };
    }

    // Behavioral nesting: one conditional probability near 1, the other lower
    // If pB_given_A >= threshold (when A fires, B almost always fires)
    // then A is narrower (A implies B behaviorally)
    const aImpliesBBehaviorally =
      pB_given_A >= threshold && pA_given_B < threshold;
    const bImpliesABehaviorally =
      pA_given_B >= threshold && pB_given_A < threshold;

    const hasBehavioralNesting = aImpliesBBehaviorally || bImpliesABehaviorally;
    let behavioralNarrower = null;
    if (aImpliesBBehaviorally) {
      behavioralNarrower = 'a';
    } else if (bImpliesABehaviorally) {
      behavioralNarrower = 'b';
    }

    // Combine deterministic and behavioral nesting
    if (hasDeterministicNesting || hasBehavioralNesting) {
      // Prefer deterministic narrower if available, else behavioral
      return {
        hasNesting: true,
        narrowerPrototype: deterministicNarrower ?? behavioralNarrower,
      };
    }

    return { hasNesting: false };
  }

  /**
   * Check if gate implication evidence matches the structural heuristic
   * for convert-to-expression (low-threat steady state pattern).
   *
   * Looks for: threat axis with upper bound <= 0.20 in the narrower prototype.
   *
   * @param {object} metrics - Extracted metrics including gateImplication
   * @returns {{matches: boolean, subsumedPrototype?: 'a' | 'b'}} Structural match result
   */
  #matchesConversionStructure(metrics) {
    const { gateImplication } = metrics;
    if (!gateImplication) return { matches: false };

    // Guard: Skip vacuous implications (based on unsatisfiable intervals)
    // Vacuous implications are mathematically correct but semantically misleading
    if (gateImplication.isVacuous) return { matches: false };

    const evidence = gateImplication.evidence ?? [];

    // Find threat axis evidence
    const threatEvidence = evidence.find((e) => e.axis === 'threat');
    if (!threatEvidence) return { matches: false };

    // Determine which is the narrower prototype from implication
    const aImpliesB =
      gateImplication.A_implies_B && !gateImplication.B_implies_A;
    const bImpliesA =
      gateImplication.B_implies_A && !gateImplication.A_implies_B;

    if (!aImpliesB && !bImpliesA) return { matches: false };

    // Get the narrower prototype's interval
    const narrowerInterval = aImpliesB
      ? threatEvidence.intervalA
      : threatEvidence.intervalB;
    const subsumedPrototype = aImpliesB ? 'a' : 'b';

    // Low-threat steady state: threat upper bound <= 0.20
    if (narrowerInterval.upper !== null && narrowerInterval.upper <= 0.2) {
      return { matches: true, subsumedPrototype };
    }

    return { matches: false };
  }

  /**
   * Check if prototypes are nested siblings (e.g., interest→curiosity).
   * Detects behavioral nesting where one prototype implies the other via
   * conditional probability asymmetry.
   *
   * Criteria:
   * - One conditional probability >= nestedConditionalThreshold (high, e.g., 0.97)
   * - The other conditional probability < nestedConditionalThreshold (lower)
   *
   * @param {object} metrics - Extracted metrics including passRates
   * @returns {{matches: boolean, subsumedPrototype?: 'a' | 'b'}} Check result (subsumedPrototype = narrower prototype)
   */
  #checkNestedSiblings(metrics) {
    const { passRates, gateImplication, gateParseInfo } = metrics;

    // Guard: Only trust deterministic nesting when parse is complete for BOTH prototypes
    // and the implication is not vacuous (based on unsatisfiable intervals)
    const parseComplete =
      gateParseInfo &&
      gateParseInfo.prototypeA?.parseStatus === 'complete' &&
      gateParseInfo.prototypeB?.parseStatus === 'complete';

    // Deterministic nesting via gate implication (asymmetric)
    // A implies B means A is narrower (any state satisfying A also satisfies B)
    // Only use deterministic nesting when:
    // 1. Parse is complete for both prototypes
    // 2. Implication is not vacuously true (empty sets)
    const hasDeterministicNesting =
      parseComplete &&
      gateImplication &&
      !gateImplication.isVacuous &&
      gateImplication.A_implies_B !== gateImplication.B_implies_A;

    let deterministicNarrower = null;
    if (hasDeterministicNesting) {
      // If A implies B but not vice versa, A is the narrower prototype
      deterministicNarrower = gateImplication.A_implies_B ? 'a' : 'b';
    }

    // If we have deterministic nesting, use it (highest priority)
    if (hasDeterministicNesting) {
      return { matches: true, subsumedPrototype: deterministicNarrower };
    }

    // Skip behavioral check if no passRates data available
    if (!passRates) return { matches: false };

    const threshold = this.#config.nestedConditionalThreshold ?? 0.97;
    const { pA_given_B, pB_given_A } = passRates;

    // Handle NaN values
    if (Number.isNaN(pA_given_B) || Number.isNaN(pB_given_A)) {
      return { matches: false };
    }

    // Check for behavioral nesting (conditional probability asymmetry)
    // One must be high (>=threshold), the other lower
    // If pB_given_A >= threshold: when A fires, B almost always fires too
    // This means A is the narrower prototype (A implies B)
    const aImpliesB = pB_given_A >= threshold && pA_given_B < threshold;
    const bImpliesA = pA_given_B >= threshold && pB_given_A < threshold;

    if (aImpliesB) {
      return { matches: true, subsumedPrototype: 'a' };
    }

    if (bImpliesA) {
      return { matches: true, subsumedPrototype: 'b' };
    }

    return { matches: false };
  }

  /**
   * Check if prototypes need separation (too similar, needs gate differentiation).
   * Identifies pairs that have significant overlap and high correlation but are
   * not quite similar enough to merge.
   *
   * Criteria:
   * - gateOverlapRatio >= 0.70 (significant overlap)
   * - NOT nested (would have been caught by nested_siblings)
   * - pearsonCorrelation >= 0.80 (highly correlated)
   * - meanAbsDiff > maxMeanAbsDiffForMerge (not similar enough to merge)
   *
   * @param {object} metrics - Extracted metrics including passRates
   * @returns {{matches: boolean}} Check result
   */
  #checkNeedsSeparation(metrics) {
    const { gateOverlapRatio, pearsonCorrelation, meanAbsDiff, passRates } = metrics;

    // Must have significant gate overlap
    if (gateOverlapRatio < 0.70) return { matches: false };

    // Must NOT be nested (would have been caught by nested_siblings check earlier)
    if (passRates) {
      const threshold = this.#config.nestedConditionalThreshold ?? 0.97;
      const { pA_given_B, pB_given_A } = passRates;
      if (!Number.isNaN(pA_given_B) && !Number.isNaN(pB_given_A)) {
        const isNested = pB_given_A >= threshold || pA_given_B >= threshold;
        if (isNested) return { matches: false };
      }
    }

    // Must have high correlation (handle NaN as failure)
    if (Number.isNaN(pearsonCorrelation)) return { matches: false };
    if (pearsonCorrelation < 0.80) return { matches: false };

    // meanAbsDiff must be higher than merge threshold (similar but not mergeable)
    // If meanAbsDiff is NaN or tiny, they would qualify for merge, not separation
    const maxMeanAbsDiffForMerge = this.#config.maxMeanAbsDiffForMerge ?? 0.03;
    if (Number.isNaN(meanAbsDiff) || meanAbsDiff <= maxMeanAbsDiffForMerge) {
      return { matches: false };
    }

    return { matches: true };
  }

  /**
   * Check if prototypes should be kept distinct.
   * This is the default fallback classification that catches pairs not matching
   * any more specific classification.
   *
   * Note: This method always returns true since it's the final fallback in the
   * priority chain. The meaningful filtering happens in the other classification
   * checks. A pair reaches this point when:
   * - Not similar enough to merge
   * - Not a subsumption relationship
   * - Not nested siblings
   * - Not needing separation
   * - Not a convert-to-expression candidate
   *
   * @param {object} _metrics - Extracted metrics (unused - reserved for future enhancements)
   * @returns {{matches: boolean}} Check result - always true (fallback)
   */
  #isKeepDistinct(_metrics) {
    // keep_distinct is the catch-all fallback - always matches
    // All meaningful filtering is done by the higher-priority classifications
    return { matches: true };
  }

  /**
   * Route classification check to appropriate method.
   *
   * @param {ClassificationTypeV2} type - Classification type to check
   * @param {object} metrics - Extracted metrics
   * @param {object} thresholds - Classification thresholds
   * @returns {{matches: boolean, subsumedPrototype?: 'a' | 'b'}} Check result
   */
  #checkClassification(type, metrics, thresholds) {
    switch (type) {
      case 'merge_recommended':
        return this.#checkMergeRecommended(metrics, thresholds);
      case 'subsumed_recommended':
        return this.#checkSubsumedRecommended(metrics, thresholds);
      case 'convert_to_expression':
        return this.#checkConvertToExpression(metrics);
      case 'nested_siblings':
        return this.#checkNestedSiblings(metrics);
      case 'needs_separation':
        return this.#checkNeedsSeparation(metrics);
      case 'keep_distinct':
        return this.#isKeepDistinct(metrics);
      default:
        return { matches: false };
    }
  }

  /**
   * Build classification result object with appropriate logging.
   *
   * @param {ClassificationTypeV2} type - Classification type
   * @param {object} metrics - Extracted metrics
   * @param {object} thresholds - Classification thresholds
   * @param {'a' | 'b' | null} subsumedPrototype - Which prototype is subsumed/narrower (if applicable)
   * @returns {Classification} Classification result
   */
  #buildClassificationResult(type, metrics, thresholds, subsumedPrototype) {
    // Log debug message based on classification type
    switch (type) {
      case 'merge_recommended':
        this.#logger.debug(
          `OverlapClassifier: Classified as MERGE_RECOMMENDED - ` +
            `onEitherRate=${metrics.onEitherRate.toFixed(4)}, ` +
            `gateOverlapRatio=${metrics.gateOverlapRatio.toFixed(4)}, ` +
            `correlation=${metrics.pearsonCorrelation.toFixed(4)}`
        );
        break;
      case 'subsumed_recommended':
        this.#logger.debug(
          `OverlapClassifier: Classified as SUBSUMED_RECOMMENDED (${subsumedPrototype}) - ` +
            `pOnlyRate=${metrics.pOnlyRate.toFixed(4)}, ` +
            `qOnlyRate=${metrics.qOnlyRate.toFixed(4)}, ` +
            `dominanceP=${metrics.dominanceP.toFixed(4)}, ` +
            `dominanceQ=${metrics.dominanceQ.toFixed(4)}`
        );
        break;
      case 'nested_siblings':
        this.#logger.debug(
          `OverlapClassifier: Classified as NESTED_SIBLINGS (narrower=${subsumedPrototype}) - ` +
            `pA_given_B=${metrics.passRates?.pA_given_B?.toFixed(4) ?? 'N/A'}, ` +
            `pB_given_A=${metrics.passRates?.pB_given_A?.toFixed(4) ?? 'N/A'}`
        );
        break;
      case 'convert_to_expression':
        this.#logger.debug(
          `OverlapClassifier: Classified as CONVERT_TO_EXPRESSION (narrower=${subsumedPrototype}) - ` +
            `hasGateImplication=${!!metrics.gateImplication}`
        );
        break;
      case 'needs_separation':
        this.#logger.debug(
          `OverlapClassifier: Classified as NEEDS_SEPARATION - ` +
            `gateOverlapRatio=${metrics.gateOverlapRatio.toFixed(4)}, ` +
            `correlation=${metrics.pearsonCorrelation.toFixed(4)}, ` +
            `meanAbsDiff=${metrics.meanAbsDiff.toFixed(4)}`
        );
        break;
      case 'keep_distinct':
        this.#logger.debug(
          `OverlapClassifier: Classified as KEEP_DISTINCT - ` +
            `no criteria met for other classifications`
        );
        break;
      default:
        this.#logger.debug(
          `OverlapClassifier: Classified as ${type.toUpperCase()}`
        );
    }

    // Build result object
    const result = { type, thresholds, metrics };
    if (type === 'subsumed_recommended' && subsumedPrototype) {
      result.subsumedPrototype = subsumedPrototype;
    }
    if (type === 'nested_siblings' && subsumedPrototype) {
      result.narrowerPrototype = subsumedPrototype;
    }
    if (type === 'convert_to_expression' && subsumedPrototype) {
      result.narrowerPrototype = subsumedPrototype;
    }
    return result;
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
export { CLASSIFICATION_PRIORITY };
