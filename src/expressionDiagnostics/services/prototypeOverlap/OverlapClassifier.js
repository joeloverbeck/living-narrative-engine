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
 * @property {Array<object>} [allMatchingClassifications] - Multi-label classification evidence
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
    let primaryType = 'keep_distinct';
    let primarySubsumed = null;
    for (const classificationType of CLASSIFICATION_PRIORITY) {
      const checkResult = this.#checkClassification(
        classificationType,
        metrics,
        thresholds
      );
      if (checkResult.matches) {
        primaryType = classificationType;
        primarySubsumed = checkResult.subsumedPrototype ?? null;
        break;
      }
    }

    const allMatchingClassifications = this.#evaluateAllClassifications(
      metrics,
      thresholds,
      primaryType
    );

    // Fallback (should never reach here since keep_distinct always returns true)
    return this.#buildClassificationResult(
      primaryType,
      metrics,
      thresholds,
      primarySubsumed,
      allMatchingClassifications
    );
  }

  /**
   * Classify a prototype pair using V3 agreement-based metrics.
   * Uses Wilson confidence intervals and profile signals for classification.
   *
   * @param {object} evaluationResult - V3 evaluation result object
   * @param {object} evaluationResult.agreementMetrics - Output from AgreementMetricsCalculator
   * @param {number} evaluationResult.agreementMetrics.maeCoPass - Mean absolute error on co-pass samples
   * @param {number} evaluationResult.agreementMetrics.maeGlobal - Mean absolute error on all samples
   * @param {number} evaluationResult.agreementMetrics.activationJaccard - Jaccard similarity of activations
   * @param {number} evaluationResult.agreementMetrics.pA_given_B - P(A passes | B passes)
   * @param {number} evaluationResult.agreementMetrics.pB_given_A - P(B passes | A passes)
   * @param {number} evaluationResult.agreementMetrics.pA_given_B_lower - Wilson CI lower bound for P(A|B)
   * @param {number} evaluationResult.agreementMetrics.pB_given_A_lower - Wilson CI lower bound for P(B|A)
   * @param {object} evaluationResult.profileA - Profile for prototype A from PrototypeProfileCalculator
   * @param {number} evaluationResult.profileA.gateVolume - Activation rate for prototype A
   * @param {boolean} evaluationResult.profileA.isExpressionCandidate - Whether A is an expression candidate
   * @param {object} evaluationResult.profileB - Profile for prototype B from PrototypeProfileCalculator
   * @param {number} evaluationResult.profileB.gateVolume - Activation rate for prototype B
   * @param {boolean} evaluationResult.profileB.isExpressionCandidate - Whether B is an expression candidate
   * @returns {Classification} Classification result with type, thresholds, and metrics
   */
  classifyV3(evaluationResult) {
    const thresholds = this.#extractV3Thresholds();
    const agreementMetrics = evaluationResult?.agreementMetrics ?? {};
    const profileA = evaluationResult?.profileA ?? {};
    const profileB = evaluationResult?.profileB ?? {};

    // Build metrics object for result
    const metrics = {
      maeCoPass: agreementMetrics.maeCoPass ?? NaN,
      maeGlobal: agreementMetrics.maeGlobal ?? NaN,
      activationJaccard: agreementMetrics.activationJaccard ?? 0,
      pA_given_B: agreementMetrics.pA_given_B ?? 0,
      pB_given_A: agreementMetrics.pB_given_A ?? 0,
      pA_given_B_lower: agreementMetrics.pA_given_B_lower ?? 0,
      pB_given_A_lower: agreementMetrics.pB_given_A_lower ?? 0,
      gateVolumeA: profileA.gateVolume ?? 0,
      gateVolumeB: profileB.gateVolume ?? 0,
      isExpressionCandidateA: profileA.isExpressionCandidate ?? false,
      isExpressionCandidateB: profileB.isExpressionCandidate ?? false,
      coPassCount: agreementMetrics.coPassCount ?? 0,
    };

    // Check classification in priority order - first match wins
    // Priority: MERGE > SUBSUMED > CONVERT_TO_EXPRESSION > NESTED_SIBLINGS > NEEDS_SEPARATION > KEEP_DISTINCT

    // 1. MERGE_RECOMMENDED
    const mergeResult = this.#checkMergeRecommendedV3(
      agreementMetrics,
      profileA,
      profileB,
      thresholds
    );
    if (mergeResult.matches) {
      this.#logger.debug(
        `OverlapClassifier V3: Classified as MERGE_RECOMMENDED - ` +
          `maeGlobal=${metrics.maeGlobal.toFixed(4)}, ` +
          `activationJaccard=${metrics.activationJaccard.toFixed(4)}`
      );
      return this.#buildV3ClassificationResult(
        'merge_recommended',
        metrics,
        thresholds,
        null
      );
    }

    // 2. SUBSUMED_RECOMMENDED
    const subsumedResult = this.#checkSubsumedRecommendedV3(
      agreementMetrics,
      profileA,
      profileB,
      thresholds
    );
    if (subsumedResult.matches) {
      this.#logger.debug(
        `OverlapClassifier V3: Classified as SUBSUMED_RECOMMENDED (${subsumedResult.subsumedPrototype}) - ` +
          `pB_given_A_lower=${metrics.pB_given_A_lower.toFixed(4)}, ` +
          `pA_given_B_lower=${metrics.pA_given_B_lower.toFixed(4)}`
      );
      return this.#buildV3ClassificationResult(
        'subsumed_recommended',
        metrics,
        thresholds,
        subsumedResult.subsumedPrototype
      );
    }

    // 3. CONVERT_TO_EXPRESSION
    const convertResult = this.#checkConvertToExpressionV3(
      agreementMetrics,
      profileA,
      profileB,
      thresholds
    );
    if (convertResult.matches) {
      this.#logger.debug(
        `OverlapClassifier V3: Classified as CONVERT_TO_EXPRESSION (narrower=${convertResult.narrowerPrototype}) - ` +
          `isExpressionCandidateA=${metrics.isExpressionCandidateA}, ` +
          `isExpressionCandidateB=${metrics.isExpressionCandidateB}`
      );
      const result = this.#buildV3ClassificationResult(
        'convert_to_expression',
        metrics,
        thresholds,
        null
      );
      result.narrowerPrototype = convertResult.narrowerPrototype;
      return result;
    }

    // 4. NESTED_SIBLINGS
    const nestedResult = this.#checkNestedSiblingsV3(agreementMetrics, thresholds);
    if (nestedResult.matches) {
      this.#logger.debug(
        `OverlapClassifier V3: Classified as NESTED_SIBLINGS (narrower=${nestedResult.narrowerPrototype}) - ` +
          `pB_given_A_lower=${metrics.pB_given_A_lower.toFixed(4)}, ` +
          `pA_given_B_lower=${metrics.pA_given_B_lower.toFixed(4)}`
      );
      const result = this.#buildV3ClassificationResult(
        'nested_siblings',
        metrics,
        thresholds,
        null
      );
      result.narrowerPrototype = nestedResult.narrowerPrototype;
      return result;
    }

    // 5. NEEDS_SEPARATION
    const separationResult = this.#checkNeedsSeparationV3(
      agreementMetrics,
      thresholds
    );
    if (separationResult.matches) {
      this.#logger.debug(
        `OverlapClassifier V3: Classified as NEEDS_SEPARATION - ` +
          `activationJaccard=${metrics.activationJaccard.toFixed(4)}, ` +
          `maeCoPass=${Number.isNaN(metrics.maeCoPass) ? 'NaN' : metrics.maeCoPass.toFixed(4)}`
      );
      return this.#buildV3ClassificationResult(
        'needs_separation',
        metrics,
        thresholds,
        null
      );
    }

    // 6. KEEP_DISTINCT (fallback)
    this.#logger.debug(
      `OverlapClassifier V3: Classified as KEEP_DISTINCT - no criteria met`
    );
    return this.#buildV3ClassificationResult(
      'keep_distinct',
      metrics,
      thresholds,
      null
    );
  }

  /**
   * Evaluate all matching classifications for multi-label evidence.
   *
   * @param {object} metrics - Extracted metrics
   * @param {object} thresholds - Classification thresholds
   * @param {ClassificationTypeV2} primaryType - Primary classification type
   * @returns {Array<object>} Multi-label evidence entries
   */
  #evaluateAllClassifications(metrics, thresholds, primaryType) {
    const matches = [];

    for (const classificationType of CLASSIFICATION_PRIORITY) {
      if (classificationType === 'keep_distinct') continue;

      const checkResult = this.#checkClassification(
        classificationType,
        metrics,
        thresholds
      );
      if (checkResult.matches) {
        matches.push(
          this.#buildMatchEntry(
            classificationType,
            metrics,
            thresholds,
            checkResult
          )
        );
      }
    }

    if (matches.length === 0) {
      matches.push(
        this.#buildMatchEntry('keep_distinct', metrics, thresholds, {
          matches: true,
        })
      );
    }

    matches.forEach((entry) => {
      entry.isPrimary = entry.type === primaryType;
    });

    return matches;
  }

  /**
   * Build a multi-label classification entry.
   *
   * @param {ClassificationTypeV2} type - Classification type
   * @param {object} metrics - Extracted metrics
   * @param {object} thresholds - Classification thresholds
   * @param {object} checkResult - Result from classification check
   * @returns {object} Multi-label entry
   */
  #buildMatchEntry(type, metrics, thresholds, checkResult) {
    const entry = {
      type,
      confidence: this.#computeConfidence(type, metrics, thresholds, checkResult),
      evidence: this.#extractEvidence(type, metrics, thresholds, checkResult),
      isPrimary: false,
    };

    if (checkResult?.subsumedPrototype) {
      if (type === 'subsumed_recommended') {
        entry.subsumedPrototype = checkResult.subsumedPrototype;
      } else if (type === 'nested_siblings' || type === 'convert_to_expression') {
        entry.narrowerPrototype = checkResult.subsumedPrototype;
      }
    }

    return entry;
  }

  /**
   * Compute confidence score for a classification type.
   *
   * @param {ClassificationTypeV2} type - Classification type
   * @param {object} metrics - Extracted metrics
   * @param {object} thresholds - Classification thresholds
   * @param {object} checkResult - Result from classification check
   * @returns {number} Confidence score in [0, 1]
   */
  #computeConfidence(type, metrics, thresholds, checkResult) {
    switch (type) {
      case 'merge_recommended': {
        const correlationThreshold =
          metrics.correlationSource === 'global' ||
          metrics.correlationSource === 'combined'
            ? (this.#config.minGlobalCorrelationForMerge ?? 0.9)
            : thresholds.minCorrelationForMerge;
        const correlationStrength = this.#normalizeAboveThreshold(
          metrics.effectiveCorrelation,
          correlationThreshold,
          1
        );
        const gateOverlapStrength = this.#normalizeAboveThreshold(
          metrics.gateOverlapRatio,
          thresholds.minGateOverlapRatio,
          1
        );
        const madStrength = this.#normalizeBelowThreshold(
          metrics.meanAbsDiff,
          thresholds.maxMeanAbsDiffForMerge
        );
        return this.#clamp01(
          correlationStrength * 0.4 +
            gateOverlapStrength * 0.3 +
            madStrength * 0.3
        );
      }
      case 'subsumed_recommended': {
        const subsumedPrototype = checkResult?.subsumedPrototype ?? null;
        const dominance =
          subsumedPrototype === 'a' ? metrics.dominanceQ : metrics.dominanceP;
        const exclusiveRate =
          subsumedPrototype === 'a' ? metrics.pOnlyRate : metrics.qOnlyRate;
        const dominanceStrength = this.#normalizeAboveThreshold(
          dominance,
          thresholds.minDominanceForSubsumption,
          1
        );
        const exclusiveStrength = this.#clamp01(
          1 - exclusiveRate / thresholds.maxExclusiveRateForSubsumption
        );
        return this.#clamp01(dominanceStrength * exclusiveStrength);
      }
      case 'nested_siblings': {
        const deterministicNesting = this.#hasDeterministicNesting(metrics);
        if (deterministicNesting.hasDeterministic) {
          return 0.95;
        }
        const { pA_given_B, pB_given_A } = metrics.passRates ?? {};
        if (!Number.isFinite(pA_given_B) || !Number.isFinite(pB_given_A)) {
          return 0;
        }
        const asymmetry = Math.abs(pB_given_A - pA_given_B);
        const maxConditional = Math.max(pB_given_A, pA_given_B);
        return this.#clamp01(asymmetry * 0.3 + maxConditional * 0.7);
      }
      case 'needs_separation': {
        const overlapFactor = this.#normalizeAboveThreshold(
          metrics.gateOverlapRatio,
          0.7,
          1
        );
        const correlationFactor = this.#normalizeAboveThreshold(
          metrics.pearsonCorrelation,
          0.8,
          1
        );
        const separationFactor = this.#normalizeAboveThreshold(
          metrics.meanAbsDiff,
          thresholds.maxMeanAbsDiffForMerge,
          thresholds.maxMeanAbsDiffForMerge * 2
        );
        return this.#clamp01(
          overlapFactor * 0.3 +
            correlationFactor * 0.3 +
            separationFactor * 0.4
        );
      }
      case 'convert_to_expression': {
        const nestingConfidence = this.#computeNestingConfidence(metrics);
        const structuralMatch = this.#matchesConversionStructure(metrics);
        const structuralQuality = structuralMatch.matches ? 1 : 0;
        return this.#clamp01(nestingConfidence * structuralQuality);
      }
      case 'keep_distinct':
        return 0.5;
      default:
        return 0;
    }
  }

  /**
   * Extract evidence supporting a classification match.
   *
   * @param {ClassificationTypeV2} type - Classification type
   * @param {object} metrics - Extracted metrics
   * @param {object} thresholds - Classification thresholds
   * @param {object} checkResult - Result from classification check
   * @returns {object} Evidence object
   */
  #extractEvidence(type, metrics, thresholds, checkResult) {
    switch (type) {
      case 'merge_recommended':
        return {
          gateOverlapRatio: this.#normalizeNumber(metrics.gateOverlapRatio),
          effectiveCorrelation: this.#normalizeNumber(metrics.effectiveCorrelation),
          correlationSource: metrics.correlationSource ?? 'none',
          meanAbsDiff: this.#normalizeNumber(metrics.meanAbsDiff),
          globalMeanAbsDiff: this.#normalizeNumber(metrics.globalMeanAbsDiff),
        };
      case 'subsumed_recommended': {
        const subsumedPrototype = checkResult?.subsumedPrototype ?? null;
        const dominance =
          subsumedPrototype === 'a' ? metrics.dominanceQ : metrics.dominanceP;
        const exclusiveRate =
          subsumedPrototype === 'a' ? metrics.pOnlyRate : metrics.qOnlyRate;
        return {
          exclusiveRate: this.#normalizeNumber(exclusiveRate),
          dominance: this.#normalizeNumber(dominance),
          effectiveCorrelation: this.#normalizeNumber(metrics.effectiveCorrelation),
          correlationSource: metrics.correlationSource ?? 'none',
        };
      }
      case 'nested_siblings': {
        const deterministic = this.#hasDeterministicNesting(metrics);
        const { pA_given_B, pB_given_A } = metrics.passRates ?? {};
        return {
          source: deterministic.hasDeterministic ? 'deterministic' : 'behavioral',
          pA_given_B: this.#normalizeNumber(pA_given_B),
          pB_given_A: this.#normalizeNumber(pB_given_A),
          threshold: this.#config.nestedConditionalThreshold ?? 0.97,
        };
      }
      case 'needs_separation':
        return {
          gateOverlapRatio: this.#normalizeNumber(metrics.gateOverlapRatio),
          pearsonCorrelation: this.#normalizeNumber(metrics.pearsonCorrelation),
          meanAbsDiff: this.#normalizeNumber(metrics.meanAbsDiff),
          maxMeanAbsDiffForMerge: thresholds.maxMeanAbsDiffForMerge,
        };
      case 'convert_to_expression': {
        const structuralMatch = this.#matchesConversionStructure(metrics);
        return {
          hasNesting: this.#hasNesting(metrics).hasNesting,
          structuralMatch: structuralMatch.matches,
          pattern: structuralMatch.matches ? 'low-threat-steady-state' : 'unknown',
        };
      }
      case 'keep_distinct':
        return { reason: 'No higher-priority criteria met' };
      default:
        return {};
    }
  }

  /**
   * Compute nesting confidence for convert-to-expression scoring.
   *
   * @param {object} metrics - Extracted metrics
   * @returns {number} Nesting confidence in [0, 1]
   */
  #computeNestingConfidence(metrics) {
    const deterministicNesting = this.#hasDeterministicNesting(metrics);
    if (deterministicNesting.hasDeterministic) {
      return 0.95;
    }
    const { pA_given_B, pB_given_A } = metrics.passRates ?? {};
    if (!Number.isFinite(pA_given_B) || !Number.isFinite(pB_given_A)) {
      return 0;
    }
    const asymmetry = Math.abs(pB_given_A - pA_given_B);
    const maxConditional = Math.max(pB_given_A, pA_given_B);
    return this.#clamp01(asymmetry * 0.3 + maxConditional * 0.7);
  }

  /**
   * Determine deterministic nesting status (gate implication).
   *
   * @param {object} metrics - Extracted metrics
   * @returns {{hasDeterministic: boolean, narrowerPrototype: 'a' | 'b' | null}}
   */
  #hasDeterministicNesting(metrics) {
    const { gateImplication, gateParseInfo } = metrics;
    const parseComplete =
      gateParseInfo &&
      gateParseInfo.prototypeA?.parseStatus === 'complete' &&
      gateParseInfo.prototypeB?.parseStatus === 'complete';
    const hasDeterministic =
      parseComplete &&
      gateImplication &&
      !gateImplication.isVacuous &&
      gateImplication.A_implies_B !== gateImplication.B_implies_A;

    if (!hasDeterministic) {
      return { hasDeterministic: false, narrowerPrototype: null };
    }

    return {
      hasDeterministic: true,
      narrowerPrototype: gateImplication.A_implies_B ? 'a' : 'b',
    };
  }

  /**
   * Clamp numeric value to [0, 1].
   *
   * @param {number} value - Value to clamp
   * @returns {number} Clamped value
   */
  #clamp01(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }

  /**
   * Normalize values that should exceed a threshold to [0, 1].
   *
   * @param {number} value - Value to normalize
   * @param {number} threshold - Minimum threshold
   * @param {number} max - Maximum expected value
   * @returns {number} Normalized value
   */
  #normalizeAboveThreshold(value, threshold, max) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    if (!Number.isFinite(threshold) || !Number.isFinite(max) || max <= threshold) {
      return value >= threshold ? 1 : 0;
    }
    return this.#clamp01((value - threshold) / (max - threshold));
  }

  /**
   * Normalize values that should be below a threshold to [0, 1].
   *
   * @param {number} value - Value to normalize
   * @param {number} threshold - Maximum allowed value
   * @returns {number} Normalized value
   */
  #normalizeBelowThreshold(value, threshold) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    if (!Number.isFinite(threshold) || threshold <= 0) {
      return value <= threshold ? 1 : 0;
    }
    return this.#clamp01((threshold - value) / threshold);
  }

  /**
   * Normalize numbers for evidence payloads.
   *
   * @param {number} value - Value to normalize
   * @returns {number|null} Normalized number or null for invalid values
   */
  #normalizeNumber(value) {
    return Number.isFinite(value) ? value : null;
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
    const { effectiveCorrelation, correlationSource } = metrics;

    // Get near-miss thresholds from config (use defaults if not present)
    const usesGlobalCorrelation =
      correlationSource === 'global' || correlationSource === 'combined';
    const nearMissCorrelationThreshold = usesGlobalCorrelation
      ? (this.#config.nearMissGlobalCorrelationThreshold ?? 0.8)
      : (this.#config.nearMissCorrelationThreshold ?? 0.9);
    const nearMissGateOverlapRatio =
      this.#config.nearMissGateOverlapRatio ?? 0.75;

    // Get the actual merge thresholds for comparison
    const minCorrelationForMerge = usesGlobalCorrelation
      ? (this.#config.minGlobalCorrelationForMerge ?? 0.9)
      : this.#config.minCorrelationForMerge;
    const minGateOverlapRatio = this.#config.minGateOverlapRatio;

    // Check if pair has high correlation (near-miss range)
    const hasHighCorrelation =
      !Number.isNaN(effectiveCorrelation) &&
      effectiveCorrelation >= nearMissCorrelationThreshold &&
      effectiveCorrelation < minCorrelationForMerge;

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
        `correlation ${effectiveCorrelation.toFixed(3)} (threshold: ${minCorrelationForMerge})`
      );
    }
    if (hasHighGateOverlap) {
      reasons.push(
        `gate overlap ${metrics.gateOverlapRatio.toFixed(3)} (threshold: ${minGateOverlapRatio})`
      );
    }

    // Also check for pairs that passed both near-miss thresholds but failed merge on another criterion
    const bothCorrelationAndGateOk =
      !Number.isNaN(effectiveCorrelation) &&
      effectiveCorrelation >= nearMissCorrelationThreshold &&
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
        value: effectiveCorrelation,
        source: correlationSource,
        nearMissThreshold: nearMissCorrelationThreshold,
        mergeThreshold: minCorrelationForMerge,
        met: hasHighCorrelation || effectiveCorrelation >= minCorrelationForMerge,
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
      minGlobalCorrelationForMerge:
        this.#config.minGlobalCorrelationForMerge ?? 0.9,
      maxMeanAbsDiffForMerge: this.#config.maxMeanAbsDiffForMerge,
      maxGlobalMeanAbsDiffForMerge:
        this.#config.maxGlobalMeanAbsDiffForMerge ?? 0.15,
      maxExclusiveRateForSubsumption: this.#config.maxExclusiveRateForSubsumption,
      minCorrelationForSubsumption: this.#config.minCorrelationForSubsumption,
      minGlobalCorrelationForSubsumption:
        this.#config.minGlobalCorrelationForSubsumption ?? 0.85,
      minDominanceForSubsumption: this.#config.minDominanceForSubsumption,
      coPassSampleConfidenceThreshold:
        this.#config.coPassSampleConfidenceThreshold ?? 500,
      minCoPassRatioForReliable: this.#config.minCoPassRatioForReliable ?? 0.1,
      coPassCorrelationWeight: this.#config.coPassCorrelationWeight ?? 0.6,
      globalCorrelationWeight: this.#config.globalCorrelationWeight ?? 0.4,
      nearMissGlobalCorrelationThreshold:
        this.#config.nearMissGlobalCorrelationThreshold ?? 0.8,
    };
  }

  /**
   * Extract V3 thresholds from config for transparency in results.
   *
   * @returns {object} V3 threshold values used for classification
   */
  #extractV3Thresholds() {
    return {
      maxMaeGlobalForMerge: this.#config.maxMaeGlobalForMerge ?? 0.08,
      minActivationJaccardForMerge: this.#config.minActivationJaccardForMerge ?? 0.85,
      symmetryTolerance: this.#config.symmetryTolerance ?? 0.05,
      minConditionalProbCILowerForNesting:
        this.#config.minConditionalProbCILowerForNesting ?? 0.9,
      asymmetryRequired: this.#config.asymmetryRequired ?? 0.1,
      maxExclusiveForSubsumption: this.#config.maxExclusiveForSubsumption ?? 0.05,
      maxMaeDeltaForExpression: this.#config.maxMaeDeltaForExpression ?? 0.05,
      lowVolumeThreshold: this.#config.lowVolumeThreshold ?? 0.05,
    };
  }

  /**
   * Check if a prototype is "dead" (very low activation rate).
   *
   * @param {object} profile - Prototype profile from PrototypeProfileCalculator
   * @returns {boolean} True if prototype is dead
   */
  #isDead(profile) {
    const gateVolume = profile?.gateVolume ?? 0;
    const threshold = this.#config.lowVolumeThreshold ?? 0.01;
    return gateVolume < threshold;
  }

  /**
   * Check if metrics meet V3 MERGE criteria using agreement-based thresholds.
   *
   * MERGE requires ALL of:
   * - maeGlobal <= maxMaeGlobalForMerge (similar outputs globally)
   * - activationJaccard >= minActivationJaccardForMerge (high co-activation)
   * - Neither prototype is "dead" (gateVolume >= lowVolumeThreshold)
   * - |pA_given_B - pB_given_A| < symmetryTolerance (symmetric conditional probabilities)
   *
   * @param {object} agreementMetrics - Metrics from AgreementMetricsCalculator
   * @param {object} profileA - Profile for prototype A
   * @param {object} profileB - Profile for prototype B
   * @param {object} thresholds - V3 classification thresholds
   * @returns {{matches: boolean}} Check result
   */
  #checkMergeRecommendedV3(agreementMetrics, profileA, profileB, thresholds) {
    const {
      maeGlobal,
      activationJaccard,
      pA_given_B,
      pB_given_A,
    } = agreementMetrics;

    // Filter out dead prototypes
    if (this.#isDead(profileA) || this.#isDead(profileB)) {
      return { matches: false };
    }

    // Require low global MAE (similar outputs) - use !isFinite to catch undefined/NaN
    if (
      !Number.isFinite(maeGlobal) ||
      maeGlobal > thresholds.maxMaeGlobalForMerge
    ) {
      return { matches: false };
    }

    // Require high activation Jaccard (high co-activation) - use !isFinite to catch undefined
    if (
      !Number.isFinite(activationJaccard) ||
      activationJaccard < thresholds.minActivationJaccardForMerge
    ) {
      return { matches: false };
    }

    // Require symmetric conditional probabilities
    const pA = Number.isFinite(pA_given_B) ? pA_given_B : 0;
    const pB = Number.isFinite(pB_given_A) ? pB_given_A : 0;
    const asymmetry = Math.abs(pA - pB);
    if (asymmetry >= thresholds.symmetryTolerance) {
      return { matches: false };
    }

    return { matches: true };
  }

  /**
   * Check if metrics meet V3 SUBSUMED criteria using CI bounds.
   *
   * SUBSUMED requires:
   * - pB_given_A_lower >= minConditionalProbCILowerForNesting (A→B with CI confidence)
   * - pA_given_B < 1 - asymmetryRequired (B↛A, directional)
   * - profileA.gateVolume < profileB.gateVolume (A is narrower)
   * - Exclusive rate for A ≤ maxExclusiveForSubsumption
   *
   * OR the symmetric case (B subsumed by A)
   *
   * @param {object} agreementMetrics - Metrics from AgreementMetricsCalculator
   * @param {object} profileA - Profile for prototype A
   * @param {object} profileB - Profile for prototype B
   * @param {object} thresholds - V3 classification thresholds
   * @returns {{matches: boolean, subsumedPrototype?: 'a' | 'b'}} Check result
   */
  #checkSubsumedRecommendedV3(agreementMetrics, profileA, profileB, thresholds) {
    const { pA_given_B, pB_given_A, pA_given_B_lower, pB_given_A_lower } =
      agreementMetrics;

    const gateVolumeA = profileA?.gateVolume ?? 0;
    const gateVolumeB = profileB?.gateVolume ?? 0;

    const minCILower = thresholds.minConditionalProbCILowerForNesting;
    const asymmetryRequired = thresholds.asymmetryRequired;
    const maxExclusive = thresholds.maxExclusiveForSubsumption;

    // Calculate exclusive rates from conditional probabilities
    // Approximate: exclusiveA ≈ (1 - pB_given_A) when A fires
    const exclusiveA = Number.isFinite(pB_given_A) ? 1 - pB_given_A : 1;
    const exclusiveB = Number.isFinite(pA_given_B) ? 1 - pA_given_B : 1;

    // Check if A is subsumed by B:
    // - pB_given_A_lower >= threshold (when A fires, B almost always fires, with CI confidence)
    // - pA_given_B < 1 - asymmetryRequired (when B fires, A doesn't always fire)
    // - A is narrower (smaller gate volume)
    // - A's exclusive rate is low
    const pBgivenALower = Number.isFinite(pB_given_A_lower) ? pB_given_A_lower : 0;
    const pAgivenB = Number.isFinite(pA_given_B) ? pA_given_B : 1;
    const aSubsumedByB =
      pBgivenALower >= minCILower &&
      pAgivenB < 1 - asymmetryRequired &&
      gateVolumeA < gateVolumeB &&
      exclusiveA <= maxExclusive;

    if (aSubsumedByB) {
      return { matches: true, subsumedPrototype: 'a' };
    }

    // Check if B is subsumed by A (symmetric case):
    const pAgivenBLower = Number.isFinite(pA_given_B_lower) ? pA_given_B_lower : 0;
    const pBgivenA = Number.isFinite(pB_given_A) ? pB_given_A : 1;
    const bSubsumedByA =
      pAgivenBLower >= minCILower &&
      pBgivenA < 1 - asymmetryRequired &&
      gateVolumeB < gateVolumeA &&
      exclusiveB <= maxExclusive;

    if (bSubsumedByA) {
      return { matches: true, subsumedPrototype: 'b' };
    }

    return { matches: false };
  }

  /**
   * Check if prototype should be converted to expression using V3 rules.
   *
   * CONVERT_TO_EXPRESSION requires:
   * - Has nesting (one CI lower bound meets threshold)
   * - Narrower profile isExpressionCandidate === true
   * - maeCoPass <= maxMaeDeltaForExpression
   *
   * @param {object} agreementMetrics - Metrics from AgreementMetricsCalculator
   * @param {object} profileA - Profile for prototype A
   * @param {object} profileB - Profile for prototype B
   * @param {object} thresholds - V3 classification thresholds
   * @returns {{matches: boolean, narrowerPrototype?: 'a' | 'b'}} Check result
   */
  #checkConvertToExpressionV3(agreementMetrics, profileA, profileB, thresholds) {
    // Feature flag gate
    if (!this.#config.enableConvertToExpression) {
      return { matches: false };
    }

    const {
      pA_given_B_lower,
      pB_given_A_lower,
      maeCoPass,
    } = agreementMetrics;

    const minCILower = thresholds.minConditionalProbCILowerForNesting;
    const maxMaeDelta = thresholds.maxMaeDeltaForExpression;

    // Check for nesting via CI lower bounds
    const pBgivenALower = Number.isFinite(pB_given_A_lower) ? pB_given_A_lower : 0;
    const pAgivenBLower = Number.isFinite(pA_given_B_lower) ? pA_given_B_lower : 0;

    const aImpliesB = pBgivenALower >= minCILower;
    const bImpliesA = pAgivenBLower >= minCILower;

    // Must have nesting (at least one direction)
    if (!aImpliesB && !bImpliesA) {
      return { matches: false };
    }

    // Determine narrower prototype (the one that implies the other)
    // If A implies B, then A is narrower
    let narrowerPrototype = null;
    let narrowerProfile = null;
    if (aImpliesB && !bImpliesA) {
      narrowerPrototype = 'a';
      narrowerProfile = profileA;
    } else if (bImpliesA && !aImpliesB) {
      narrowerPrototype = 'b';
      narrowerProfile = profileB;
    } else {
      // Both directions - use gate volume to determine narrower
      const gateVolumeA = profileA?.gateVolume ?? 0;
      const gateVolumeB = profileB?.gateVolume ?? 0;
      if (gateVolumeA < gateVolumeB) {
        narrowerPrototype = 'a';
        narrowerProfile = profileA;
      } else {
        narrowerPrototype = 'b';
        narrowerProfile = profileB;
      }
    }

    // Narrower profile must be an expression candidate
    if (!narrowerProfile?.isExpressionCandidate) {
      return { matches: false };
    }

    // MAE on co-pass must be small
    const mae = Number.isFinite(maeCoPass) ? maeCoPass : Infinity;
    if (mae > maxMaeDelta) {
      return { matches: false };
    }

    return { matches: true, narrowerPrototype };
  }

  /**
   * Check for nested siblings using V3 asymmetric CI.
   *
   * NESTED_SIBLINGS requires:
   * - At least one CI lower bound meets threshold
   * - pA_given_B !== pB_given_A (asymmetric)
   *
   * @param {object} agreementMetrics - Metrics from AgreementMetricsCalculator
   * @param {object} thresholds - V3 classification thresholds
   * @returns {{matches: boolean, narrowerPrototype?: 'a' | 'b'}} Check result
   */
  #checkNestedSiblingsV3(agreementMetrics, thresholds) {
    const {
      pA_given_B,
      pB_given_A,
      pA_given_B_lower,
      pB_given_A_lower,
    } = agreementMetrics;

    const minCILower = thresholds.minConditionalProbCILowerForNesting;

    // Check for nesting via CI lower bounds
    const pBgivenALower = Number.isFinite(pB_given_A_lower) ? pB_given_A_lower : 0;
    const pAgivenBLower = Number.isFinite(pA_given_B_lower) ? pA_given_B_lower : 0;

    const aImpliesB = pBgivenALower >= minCILower;
    const bImpliesA = pAgivenBLower >= minCILower;

    // Must have at least one direction of nesting
    if (!aImpliesB && !bImpliesA) {
      return { matches: false };
    }

    // Check for asymmetry (if both imply each other at same level, it's not nesting)
    const pA = Number.isFinite(pA_given_B) ? pA_given_B : 0;
    const pB = Number.isFinite(pB_given_A) ? pB_given_A : 0;
    if (pA === pB) {
      return { matches: false };
    }

    // Determine narrower prototype
    let narrowerPrototype = null;
    if (aImpliesB && !bImpliesA) {
      narrowerPrototype = 'a';
    } else if (bImpliesA && !aImpliesB) {
      narrowerPrototype = 'b';
    } else {
      // Both directions - pick based on which has higher conditional prob
      narrowerPrototype = pB > pA ? 'a' : 'b';
    }

    return { matches: true, narrowerPrototype };
  }

  /**
   * Check if prototypes need separation using V3 rules.
   *
   * NEEDS_SEPARATION requires:
   * - activationJaccard >= 0.7 (significant overlap)
   * - No nesting detected (neither CI lower bound meets threshold)
   * - maeCoPass > maxMaeDeltaForExpression (not similar enough outputs)
   *
   * @param {object} agreementMetrics - Metrics from AgreementMetricsCalculator
   * @param {object} thresholds - V3 classification thresholds
   * @returns {{matches: boolean}} Check result
   */
  #checkNeedsSeparationV3(agreementMetrics, thresholds) {
    const {
      activationJaccard,
      pA_given_B_lower,
      pB_given_A_lower,
      maeCoPass,
    } = agreementMetrics;

    // Must have significant overlap
    if (activationJaccard < 0.7) {
      return { matches: false };
    }

    // Must NOT be nested (would have been caught by nested_siblings)
    const minCILower = thresholds.minConditionalProbCILowerForNesting;
    const pBgivenALower = Number.isFinite(pB_given_A_lower) ? pB_given_A_lower : 0;
    const pAgivenBLower = Number.isFinite(pA_given_B_lower) ? pA_given_B_lower : 0;

    const hasNesting = pBgivenALower >= minCILower || pAgivenBLower >= minCILower;
    if (hasNesting) {
      return { matches: false };
    }

    // MAE on co-pass must be higher than expression threshold (different outputs)
    const mae = Number.isFinite(maeCoPass) ? maeCoPass : 0;
    if (mae <= thresholds.maxMaeDeltaForExpression) {
      return { matches: false };
    }

    return { matches: true };
  }

  /**
   * Build V3 classification result object.
   *
   * @param {ClassificationTypeV2} type - Classification type
   * @param {object} metrics - Extracted V3 metrics
   * @param {object} thresholds - V3 classification thresholds
   * @param {'a' | 'b' | null} subsumedPrototype - Which prototype is subsumed (if applicable)
   * @returns {Classification} Classification result
   */
  #buildV3ClassificationResult(type, metrics, thresholds, subsumedPrototype) {
    const result = { type, thresholds, metrics };

    if (type === 'subsumed_recommended' && subsumedPrototype) {
      result.subsumedPrototype = subsumedPrototype;
    }

    return result;
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

    const metrics = {
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
      coPassCount: passRates?.coPassCount ?? 0,

      // Gate implication metrics (Stage B) - for convert_to_expression
      gateImplication,

      // Gate parse info (Stage B) - for transparency about parse coverage
      gateParseInfo,
    };

    const { effectiveCorrelation, source, confidence } =
      this.#computeEffectiveCorrelation(metrics);

    return {
      ...metrics,
      effectiveCorrelation,
      correlationSource: source,
      correlationConfidence: confidence,
    };
  }

  /**
   * Compute effective correlation using a hybrid strategy that balances
   * co-pass reliability with global coverage.
   *
   * @param {object} metrics - Extracted metrics
   * @returns {{
   *   effectiveCorrelation: number,
   *   source: 'co-pass'|'global'|'combined'|'co-pass-sparse'|'none',
   *   confidence: 'high'|'medium'|'low'|'none'
   * }}
   */
  #computeEffectiveCorrelation(metrics) {
    const coPassCorrelation = metrics.pearsonCorrelation;
    const globalCorrelation = metrics.globalOutputCorrelation;
    const coPassCount = metrics.coPassCount ?? 0;
    const coPassRatio = metrics.onBothRate ?? 0;

    const coPassValid =
      typeof coPassCorrelation === 'number' && Number.isFinite(coPassCorrelation);
    const globalValid =
      typeof globalCorrelation === 'number' && Number.isFinite(globalCorrelation);

    const minCoPassSamples =
      this.#config.coPassSampleConfidenceThreshold ?? 500;
    const minCoPassRatio = this.#config.minCoPassRatioForReliable ?? 0.1;

    const hasReliableCoPass =
      coPassValid &&
      coPassCount >= minCoPassSamples &&
      coPassRatio >= minCoPassRatio;

    if (hasReliableCoPass) {
      return {
        effectiveCorrelation: coPassCorrelation,
        source: 'co-pass',
        confidence: 'high',
      };
    }

    if (globalValid && !coPassValid) {
      return {
        effectiveCorrelation: globalCorrelation,
        source: 'global',
        confidence: 'medium',
      };
    }

    if (globalValid && coPassValid) {
      const coPassWeight = this.#config.coPassCorrelationWeight ?? 0.6;
      const globalWeight = this.#config.globalCorrelationWeight ?? 0.4;
      const totalWeight = coPassWeight + globalWeight;
      const normalizedCoPassWeight =
        totalWeight > 0 ? coPassWeight / totalWeight : 0.5;
      const normalizedGlobalWeight =
        totalWeight > 0 ? globalWeight / totalWeight : 0.5;
      const combined =
        coPassCorrelation * normalizedCoPassWeight +
        globalCorrelation * normalizedGlobalWeight;

      return {
        effectiveCorrelation: combined,
        source: 'combined',
        confidence: 'medium',
      };
    }

    if (coPassValid) {
      return {
        effectiveCorrelation: coPassCorrelation,
        source: 'co-pass-sparse',
        confidence: 'low',
      };
    }

    return {
      effectiveCorrelation: NaN,
      source: 'none',
      confidence: 'none',
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

    // Require high correlation using effective correlation
    const effectiveCorrelation = metrics.effectiveCorrelation;
    const correlationThreshold =
      metrics.correlationSource === 'global' ||
      metrics.correlationSource === 'combined'
        ? (this.#config.minGlobalCorrelationForMerge ?? 0.9)
        : thresholds.minCorrelationForMerge;

    if (
      Number.isNaN(effectiveCorrelation) ||
      effectiveCorrelation < correlationThreshold
    ) {
      return false;
    }

    // Require global mean absolute difference to be within limits (when available)
    if (
      !Number.isNaN(metrics.globalMeanAbsDiff) &&
      metrics.globalMeanAbsDiff >
        (this.#config.maxGlobalMeanAbsDiffForMerge ?? 0.15)
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
    const effectiveCorrelation = metrics.effectiveCorrelation;
    const correlationThreshold =
      metrics.correlationSource === 'global' ||
      metrics.correlationSource === 'combined'
        ? (this.#config.minGlobalCorrelationForSubsumption ?? 0.85)
        : thresholds.minCorrelationForSubsumption;

    if (
      Number.isNaN(effectiveCorrelation) ||
      effectiveCorrelation < correlationThreshold
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
   * @param {Array<object>} [allMatchingClassifications] - Multi-label evidence entries
   * @returns {Classification} Classification result
   */
  #buildClassificationResult(
    type,
    metrics,
    thresholds,
    subsumedPrototype,
    allMatchingClassifications
  ) {
    // Log debug message based on classification type
    switch (type) {
      case 'merge_recommended':
        this.#logger.debug(
          `OverlapClassifier: Classified as MERGE_RECOMMENDED - ` +
            `onEitherRate=${metrics.onEitherRate.toFixed(4)}, ` +
            `gateOverlapRatio=${metrics.gateOverlapRatio.toFixed(4)}, ` +
            `correlation=${Number.isNaN(metrics.effectiveCorrelation) ? 'NaN' : metrics.effectiveCorrelation.toFixed(4)} ` +
            `(source=${metrics.correlationSource})`
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
    if (Array.isArray(allMatchingClassifications)) {
      result.allMatchingClassifications = allMatchingClassifications;
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

    const optionalNumericKeys = [
      'minGlobalCorrelationForMerge',
      'minGlobalCorrelationForSubsumption',
      'coPassSampleConfidenceThreshold',
      'minCoPassRatioForReliable',
      'coPassCorrelationWeight',
      'globalCorrelationWeight',
      'maxGlobalMeanAbsDiffForMerge',
      'nearMissGlobalCorrelationThreshold',
    ];

    for (const key of optionalNumericKeys) {
      if (key in config && typeof config[key] !== 'number') {
        logger.error(
          `OverlapClassifier: Invalid optional config.${key} (expected number)`
        );
        throw new Error(`OverlapClassifier config expects numeric ${key}`);
      }
    }
  }
}

export default OverlapClassifier;
export { CLASSIFICATION_PRIORITY };
