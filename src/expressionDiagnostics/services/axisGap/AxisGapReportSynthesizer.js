/**
 * @file Report synthesizer for axis gap analysis.
 * @description Synthesizes comprehensive reports from analysis results.
 */

/**
 * Maps flag reasons to their detection method family.
 * Multiple reasons from the same family represent correlated signals,
 * not independent detection methods.
 *
 * IMPORTANT: sign_tension is marked as 'metadata' family because:
 * - Mixed positive/negative weights are NORMAL for emotional prototypes
 * - 64% of prototypes were incorrectly flagged as conflicts
 * - Sign tension should NOT contribute to confidence scoring or recommendations
 * - It remains visible as informational metadata for structural understanding
 *
 * @type {Record<string, string>}
 */
const REASON_TO_FAMILY_MAP = {
  high_reconstruction_error: 'pca',
  extreme_projection: 'pca',
  hub: 'hubs',
  coverage_gap: 'gaps',
  multi_axis_conflict: 'conflicts',
  high_axis_loading: 'conflicts',
  sign_tension: 'metadata', // METADATA ONLY - does not contribute to confidence/recommendations
};

/**
 * Family names that are metadata-only and should not contribute to
 * confidence scoring or recommendation generation.
 *
 * @type {Set<string>}
 */
const METADATA_ONLY_FAMILIES = new Set(['metadata']);

/**
 * @typedef {import('./AxisGapRecommendationBuilder.js').Recommendation} Recommendation
 * @typedef {import('./AxisGapRecommendationBuilder.js').PCAResult} PCAResult
 * @typedef {import('./AxisGapRecommendationBuilder.js').HubResult} HubResult
 * @typedef {import('./AxisGapRecommendationBuilder.js').CoverageGapResult} CoverageGapResult
 * @typedef {import('./AxisGapRecommendationBuilder.js').ConflictResult} ConflictResult
 */

/**
 * @typedef {object} PrototypeWeightSummary
 * @property {string} prototypeId - Prototype identifier.
 * @property {Array<{axis: string, weight: number}>} topAxes - Top axes by weight.
 * @property {string[]} reasons - All flag reasons.
 * @property {Record<string, object>} metricsByReason - Metrics keyed by reason.
 * @property {string|null} reason - Primary flag reason (backward compat).
 * @property {object} metrics - Primary metrics (backward compat).
 * @property {boolean} multiSignalAgreement - Whether 3+ reasons agree (backward compat).
 * @property {number} distinctFamilyCount - Number of distinct method families.
 */

/**
 * @typedef {object} CandidateAxisResult
 * @property {string} candidateId - Unique identifier for this candidate.
 * @property {'pca_residual'|'coverage_gap'|'hub_derived'} source - Origin of candidate.
 * @property {Record<string, number>} direction - Normalized direction vector.
 * @property {object} improvement - Improvement metrics.
 * @property {number} improvement.rmseReduction - RMSE reduction ratio.
 * @property {number} improvement.strongAxisReduction - Strong axis count reduction.
 * @property {number} improvement.coUsageReduction - Co-usage reduction ratio.
 * @property {boolean} isRecommended - Whether the candidate is recommended.
 * @property {'add_axis'|'refine_prototypes'|'insufficient_data'} recommendation - Recommendation type.
 * @property {string[]} affectedPrototypes - IDs of affected prototypes.
 */

/**
 * @typedef {object} AxisGapReport
 * @property {object} summary - Report summary.
 * @property {object} pcaAnalysis - PCA analysis results.
 * @property {HubResult[]} hubPrototypes - Hub prototype findings.
 * @property {CoverageGapResult[]} coverageGaps - Coverage gap findings.
 * @property {ConflictResult[]} multiAxisConflicts - Multi-axis conflicts.
 * @property {ConflictResult[]} highAxisLoadings - High axis loading conflicts.
 * @property {ConflictResult[]} signTensions - Sign tension conflicts.
 * @property {CandidateAxisResult[]|null} candidateAxes - Candidate axis validation results.
 * @property {Recommendation[]} recommendations - Generated recommendations.
 * @property {PrototypeWeightSummary[]} prototypeWeightSummaries - Weight summaries.
 */

/**
 * @typedef {object} SplitConflicts
 * @property {ConflictResult[]} [highAxisLoadings] - High axis loading conflicts.
 * @property {ConflictResult[]} [signTensions] - Sign tension conflicts.
 */

/**
 * Service for synthesizing axis gap analysis reports.
 */
export class AxisGapReportSynthesizer {
  #config;
  #recommendationBuilder;

  /**
   * Create an AxisGapReportSynthesizer.
   *
   * @param {object} [config] - Configuration options.
   * @param {number} [config.pcaResidualVarianceThreshold] - PCA threshold (default: 0.15).
   * @param {number} [config.residualVarianceThreshold] - Residual variance threshold (default: 0.15).
   * @param {number} [config.reconstructionErrorThreshold] - Reconstruction error threshold (default: 0.5).
   * @param {object} [recommendationBuilder] - Recommendation builder service.
   */
  constructor(config = {}, recommendationBuilder = null) {
    this.#config = {
      pcaResidualVarianceThreshold: config.pcaResidualVarianceThreshold ?? 0.15,
      residualVarianceThreshold: config.residualVarianceThreshold ?? 0.15,
      reconstructionErrorThreshold: config.reconstructionErrorThreshold ?? 0.5,
      pcaRequireCorroboration: config.pcaRequireCorroboration ?? true,
    };
    this.#recommendationBuilder = recommendationBuilder;
  }

  /**
   * Synthesize a comprehensive report from analysis results.
   *
   * @param {PCAResult} pcaResult - PCA analysis result.
   * @param {HubResult[]} hubs - Hub prototype results.
   * @param {CoverageGapResult[]} gaps - Coverage gap results.
   * @param {ConflictResult[]} conflicts - Multi-axis conflict results.
   * @param {number} [totalPrototypes] - Total prototypes analyzed.
   * @param {Array<{id?: string, prototypeId?: string, weights?: Record<string, number>}>} [prototypes] - Prototype objects.
   * @param {SplitConflicts} [splitConflicts] - Split conflict types.
   * @param {CandidateAxisResult[]|null} [candidateAxisValidation] - Optional candidate axis validation results.
   * @returns {AxisGapReport} Synthesized report.
   */
  synthesize(
    pcaResult,
    hubs,
    gaps,
    conflicts,
    totalPrototypes = 0,
    prototypes = [],
    splitConflicts = {},
    candidateAxisValidation = null
  ) {
    const {
      highAxisLoadings = [],
      signTensions = [],
      hubDiagnostics = null,
    } = splitConflicts;

    const methodsTriggered = this.#countTriggeredMethods(pcaResult, hubs, gaps, conflicts);
    const prototypeWeightSummaries = this.computePrototypeWeightSummaries(
      prototypes,
      pcaResult,
      hubs,
      gaps,
      conflicts
    );
    const confidence = this.#computeConfidenceLevel(methodsTriggered, prototypeWeightSummaries);

    let recommendations = [];
    if (this.#recommendationBuilder) {
      recommendations = this.#recommendationBuilder.generate(
        pcaResult,
        hubs,
        gaps,
        conflicts,
        candidateAxisValidation
      );
      this.#recommendationBuilder.sortByPriority(recommendations);
    }

    // Build signal breakdown with optional candidate axis counts
    const signalBreakdown = {
      pcaSignals:
        pcaResult.residualVarianceRatio > this.#config.residualVarianceThreshold ? 1 : 0,
      hubSignals: hubs.length,
      coverageGapSignals: gaps.length,
      multiAxisConflictSignals: conflicts.length,
      highAxisLoadingSignals: highAxisLoadings.length,
      signTensionSignals: signTensions.length,
    };

    // Add candidate axis validation counts if available
    if (Array.isArray(candidateAxisValidation)) {
      signalBreakdown.candidateAxisCount = candidateAxisValidation.length;
      signalBreakdown.recommendedCandidateCount = candidateAxisValidation.filter(
        (c) => c.isRecommended
      ).length;
    }

    return {
      summary: {
        totalPrototypesAnalyzed: totalPrototypes,
        recommendationCount: recommendations.length,
        signalBreakdown,
        confidence,
        potentialGapsDetected: recommendations.length,
      },
      pcaAnalysis: {
        residualVarianceRatio: pcaResult.residualVarianceRatio,
        additionalSignificantComponents: pcaResult.additionalSignificantComponents,
        significantComponentCount: pcaResult.significantComponentCount ?? 0,
        expectedComponentCount: pcaResult.expectedComponentCount ?? 0,
        significantBeyondExpected: pcaResult.significantBeyondExpected ?? 0,
        axisCount: pcaResult.axisCount ?? 0,
        topLoadingPrototypes: pcaResult.topLoadingPrototypes,
        cumulativeVariance: pcaResult.cumulativeVariance ?? [],
        explainedVariance: pcaResult.explainedVariance ?? [],
        componentsFor80Pct: pcaResult.componentsFor80Pct ?? 0,
        componentsFor90Pct: pcaResult.componentsFor90Pct ?? 0,
        reconstructionErrors: pcaResult.reconstructionErrors ?? [],
      },
      hubPrototypes: hubs,
      hubDiagnostics,
      coverageGaps: gaps,
      multiAxisConflicts: conflicts,
      highAxisLoadings,
      signTensions,
      candidateAxes: candidateAxisValidation,
      recommendations,
      prototypeWeightSummaries,
    };
  }

  /**
   * Build an empty report structure.
   *
   * @param {number} [totalPrototypes] - Total prototypes analyzed.
   * @returns {AxisGapReport} Empty report structure.
   */
  buildEmptyReport(totalPrototypes = 0) {
    return {
      summary: {
        totalPrototypesAnalyzed: totalPrototypes,
        recommendationCount: 0,
        signalBreakdown: {
          pcaSignals: 0,
          hubSignals: 0,
          coverageGapSignals: 0,
          multiAxisConflictSignals: 0,
          highAxisLoadingSignals: 0,
          signTensionSignals: 0,
        },
        confidence: 'low',
        potentialGapsDetected: 0,
      },
      pcaAnalysis: this.#createEmptyPCAResult(),
      hubPrototypes: [],
      coverageGaps: [],
      multiAxisConflicts: [],
      highAxisLoadings: [],
      signTensions: [],
      candidateAxes: null,
      recommendations: [],
      prototypeWeightSummaries: [],
    };
  }

  /**
   * Compute prototype weight summaries with flag reasons.
   *
   * @param {Array<{id?: string, prototypeId?: string, weights?: Record<string, number>}>} prototypes - Prototype objects.
   * @param {PCAResult} pcaResult - PCA analysis result.
   * @param {HubResult[]} hubs - Hub prototype results.
   * @param {CoverageGapResult[]} gaps - Coverage gap results.
   * @param {ConflictResult[]} conflicts - Multi-axis conflict results.
   * @returns {PrototypeWeightSummary[]} Weight summaries for flagged prototypes.
   */
  computePrototypeWeightSummaries(prototypes, pcaResult, hubs, gaps, conflicts) {
    if (!Array.isArray(prototypes) || prototypes.length === 0) {
      return [];
    }

    const prototypeLookup = new Map(
      prototypes.map((p) => [p?.id ?? p?.prototypeId ?? '', p])
    );

    const flaggedPrototypes = new Map();

    /**
     * Helper to accumulate flag reasons.
     *
     * @param {string} prototypeId - The prototype ID to flag.
     * @param {string} reason - The reason for flagging.
     * @param {object} metrics - The metrics associated with this reason.
     */
    const addFlag = (prototypeId, reason, metrics) => {
      if (!prototypeId) return;

      if (!flaggedPrototypes.has(prototypeId)) {
        flaggedPrototypes.set(prototypeId, {
          reasons: [],
          metricsByReason: {},
        });
      }

      const entry = flaggedPrototypes.get(prototypeId);
      if (!entry.reasons.includes(reason)) {
        entry.reasons.push(reason);
        entry.metricsByReason[reason] = metrics;
      }
    };

    const reconstructionThreshold = Number.isFinite(this.#config.reconstructionErrorThreshold)
      ? this.#config.reconstructionErrorThreshold
      : 0.5;

    // PCA - high reconstruction error
    if (pcaResult?.reconstructionErrors && Array.isArray(pcaResult.reconstructionErrors)) {
      for (const { prototypeId, error } of pcaResult.reconstructionErrors) {
        if (error >= reconstructionThreshold) {
          addFlag(prototypeId, 'high_reconstruction_error', { reconstructionError: error });
        }
      }
    }

    // PCA - extreme projection
    if (pcaResult?.topLoadingPrototypes && Array.isArray(pcaResult.topLoadingPrototypes)) {
      for (const { prototypeId, loading } of pcaResult.topLoadingPrototypes) {
        addFlag(prototypeId, 'extreme_projection', { projectionScore: loading });
      }
    }

    // Hub prototypes
    if (Array.isArray(hubs)) {
      for (const hub of hubs) {
        const prototypeId = hub?.prototypeId;
        addFlag(prototypeId, 'hub', {
          hubScore: hub.hubScore,
          neighborhoodDiversity: hub.neighborhoodDiversity,
        });
      }
    }

    // Multi-axis conflicts
    if (Array.isArray(conflicts)) {
      for (const conflict of conflicts) {
        const prototypeId = conflict?.prototypeId;
        const reason = conflict?.flagReason ?? 'multi_axis_conflict';
        addFlag(prototypeId, reason, {
          activeAxisCount: conflict.activeAxisCount,
          signBalance: conflict.signBalance,
        });
      }
    }

    // Coverage gaps
    if (Array.isArray(gaps)) {
      for (const gap of gaps) {
        const centroidPrototypes = gap?.centroidPrototypes;
        if (Array.isArray(centroidPrototypes)) {
          for (const prototypeId of centroidPrototypes) {
            addFlag(prototypeId, 'coverage_gap', {
              distanceToNearestAxis: gap.distanceToNearestAxis,
              clusterId: gap.clusterId,
              ...(gap.clusterMagnitude !== undefined && { clusterMagnitude: gap.clusterMagnitude }),
              ...(gap.clusterSize !== undefined && { clusterSize: gap.clusterSize }),
              ...(gap.gapScore !== undefined && { gapScore: gap.gapScore }),
            });
          }
        }
      }
    }

    // Build weight summaries
    const summaries = [];

    for (const [prototypeId, { reasons, metricsByReason }] of flaggedPrototypes.entries()) {
      const prototype = prototypeLookup.get(prototypeId);
      const weights = prototype?.weights ?? {};

      const axisWeights = Object.entries(weights)
        .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
        .map(([axis, weight]) => ({ axis, weight }))
        .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
        .slice(0, 5);

      summaries.push({
        prototypeId,
        topAxes: axisWeights,
        reasons,
        metricsByReason,
        reason: reasons[0] ?? null,
        metrics: metricsByReason[reasons[0]] ?? {},
        multiSignalAgreement: reasons.length >= 3, // Keep for backward compat
        distinctFamilyCount: this.#countDistinctFamilies(reasons),
      });
    }

    return summaries;
  }

  /**
   * Count how many detection methods triggered.
   *
   * @param {PCAResult} pcaResult - PCA analysis result.
   * @param {HubResult[]} hubs - Hub prototype results.
   * @param {CoverageGapResult[]} gaps - Coverage gap results.
   * @param {ConflictResult[]} conflicts - Multi-axis conflict results.
   * @returns {number} Number of triggered methods.
   */
  /**
   * Count how many detection methods triggered a signal.
   *
   * When pcaRequireCorroboration is true (default), PCA triggers ONLY if:
   * 1. additionalSignificantComponents > 0, OR
   * 2. residualVariance is high AND at least one other signal is present
   *
   * This prevents false positives from residual variance alone in well-structured data.
   *
   * @param {object} pcaResult - PCA analysis result.
   * @param {Array} hubs - Detected hub prototypes.
   * @param {Array} gaps - Detected axis gaps.
   * @param {Array} conflicts - Detected multi-axis conflicts.
   * @returns {number} Number of triggered detection methods.
   */
  #countTriggeredMethods(pcaResult, hubs, gaps, conflicts) {
    let count = 0;
    const pcaThreshold = Number.isFinite(this.#config.pcaResidualVarianceThreshold)
      ? this.#config.pcaResidualVarianceThreshold
      : 0.15;

    const hasSignificantComponents = pcaResult.additionalSignificantComponents > 0;
    const hasHighResidual = pcaResult.residualVarianceRatio >= pcaThreshold;
    const hasHubs = Array.isArray(hubs) && hubs.length > 0;
    const hasGaps = Array.isArray(gaps) && gaps.length > 0;
    const hasConflicts = Array.isArray(conflicts) && conflicts.length > 0;
    const hasOtherSignals = hasHubs || hasGaps || hasConflicts;

    // Apply corroboration logic when enabled
    if (this.#config.pcaRequireCorroboration) {
      // PCA triggers only with significant components OR high residual + other signals
      if (hasSignificantComponents || (hasHighResidual && hasOtherSignals)) {
        count += 1;
      }
    } else {
      // Original behavior: high residual OR significant components triggers PCA
      if (hasHighResidual || hasSignificantComponents) {
        count += 1;
      }
    }

    if (hasHubs) {
      count += 1;
    }
    if (hasGaps) {
      count += 1;
    }
    if (hasConflicts) {
      count += 1;
    }

    return count;
  }

  /**
   * Compute confidence level from triggered methods.
   *
   * @param {number} methodsTriggered - Number of detection methods triggered.
   * @param {PrototypeWeightSummary[]} prototypeWeightSummaries - Weight summaries.
   * @returns {'low'|'medium'|'high'} Confidence level.
   */
  #computeConfidenceLevel(methodsTriggered, prototypeWeightSummaries = []) {
    let baseConfidence = 'low';
    if (methodsTriggered >= 3) {
      baseConfidence = 'high';
    } else if (methodsTriggered >= 2) {
      baseConfidence = 'medium';
    }

    // Use distinct method families instead of raw reason count to avoid
    // inflated confidence from correlated signals (e.g., multiple PCA reasons)
    const hasMultiFamilyPrototype =
      Array.isArray(prototypeWeightSummaries) &&
      prototypeWeightSummaries.some(
        (summary) => this.#countDistinctFamilies(summary?.reasons) >= 3
      );

    if (hasMultiFamilyPrototype && baseConfidence !== 'high') {
      return baseConfidence === 'low' ? 'medium' : 'high';
    }

    return baseConfidence;
  }

  /**
   * Count distinct method families represented by reasons.
   * Reasons from the same family (e.g., PCA) are correlated and should
   * not be counted as independent signals for confidence boosting.
   *
   * Metadata-only families (like sign_tension) are excluded from the count
   * as they should not contribute to confidence scoring.
   *
   * @param {string[]|undefined} reasons - Array of flag reason strings.
   * @returns {number} Number of distinct actionable method families.
   */
  #countDistinctFamilies(reasons) {
    if (!Array.isArray(reasons) || reasons.length === 0) {
      return 0;
    }

    const families = new Set();
    for (const reason of reasons) {
      const family = REASON_TO_FAMILY_MAP[reason];
      if (family) {
        // Skip metadata-only families - they don't contribute to confidence
        if (!METADATA_ONLY_FAMILIES.has(family)) {
          families.add(family);
        }
      } else {
        // Unknown reasons are counted as their own family (safe fallback)
        families.add(reason);
      }
    }
    return families.size;
  }

  /**
   * Create an empty PCA result structure.
   *
   * @returns {PCAResult & {dimensionsUsed: string[], cumulativeVariance: number[], componentsFor80Pct: number, componentsFor90Pct: number, reconstructionErrors: Array}} Empty PCA result.
   */
  #createEmptyPCAResult() {
    return {
      residualVarianceRatio: 0,
      additionalSignificantComponents: 0,
      significantComponentCount: 0,
      expectedComponentCount: 0,
      significantBeyondExpected: 0,
      axisCount: 0,
      topLoadingPrototypes: [],
      dimensionsUsed: [],
      cumulativeVariance: [],
      explainedVariance: [],
      componentsFor80Pct: 0,
      componentsFor90Pct: 0,
      reconstructionErrors: [],
    };
  }
}
