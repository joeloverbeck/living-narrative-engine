/**
 * @file Report synthesizer for axis gap analysis.
 * @description Synthesizes comprehensive reports from analysis results.
 */

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
 * @property {boolean} multiSignalAgreement - Whether 3+ reasons agree.
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
   * @returns {AxisGapReport} Synthesized report.
   */
  synthesize(
    pcaResult,
    hubs,
    gaps,
    conflicts,
    totalPrototypes = 0,
    prototypes = [],
    splitConflicts = {}
  ) {
    const { highAxisLoadings = [], signTensions = [] } = splitConflicts;

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
      recommendations = this.#recommendationBuilder.generate(pcaResult, hubs, gaps, conflicts);
      this.#recommendationBuilder.sortByPriority(recommendations);
    }

    return {
      summary: {
        totalPrototypesAnalyzed: totalPrototypes,
        recommendationCount: recommendations.length,
        signalBreakdown: {
          pcaSignals:
            pcaResult.residualVarianceRatio > this.#config.residualVarianceThreshold ? 1 : 0,
          hubSignals: hubs.length,
          coverageGapSignals: gaps.length,
          multiAxisConflictSignals: conflicts.length,
          highAxisLoadingSignals: highAxisLoadings.length,
          signTensionSignals: signTensions.length,
        },
        confidence,
        potentialGapsDetected: recommendations.length,
      },
      pcaAnalysis: {
        residualVarianceRatio: pcaResult.residualVarianceRatio,
        additionalSignificantComponents: pcaResult.additionalSignificantComponents,
        topLoadingPrototypes: pcaResult.topLoadingPrototypes,
        cumulativeVariance: pcaResult.cumulativeVariance ?? [],
        componentsFor80Pct: pcaResult.componentsFor80Pct ?? 0,
        componentsFor90Pct: pcaResult.componentsFor90Pct ?? 0,
        reconstructionErrors: pcaResult.reconstructionErrors ?? [],
      },
      hubPrototypes: hubs,
      coverageGaps: gaps,
      multiAxisConflicts: conflicts,
      highAxisLoadings,
      signTensions,
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
        multiSignalAgreement: reasons.length >= 3,
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
  #countTriggeredMethods(pcaResult, hubs, gaps, conflicts) {
    let count = 0;
    const pcaThreshold = Number.isFinite(this.#config.pcaResidualVarianceThreshold)
      ? this.#config.pcaResidualVarianceThreshold
      : 0.15;

    if (
      pcaResult.residualVarianceRatio >= pcaThreshold ||
      pcaResult.additionalSignificantComponents > 0
    ) {
      count += 1;
    }
    if (Array.isArray(hubs) && hubs.length > 0) {
      count += 1;
    }
    if (Array.isArray(gaps) && gaps.length > 0) {
      count += 1;
    }
    if (Array.isArray(conflicts) && conflicts.length > 0) {
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

    const hasMultiSignalPrototype =
      Array.isArray(prototypeWeightSummaries) &&
      prototypeWeightSummaries.some(
        (summary) => Array.isArray(summary?.reasons) && summary.reasons.length >= 3
      );

    if (hasMultiSignalPrototype && baseConfidence !== 'high') {
      return baseConfidence === 'low' ? 'medium' : 'high';
    }

    return baseConfidence;
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
      topLoadingPrototypes: [],
      dimensionsUsed: [],
      cumulativeVariance: [],
      componentsFor80Pct: 0,
      componentsFor90Pct: 0,
      reconstructionErrors: [],
    };
  }
}
