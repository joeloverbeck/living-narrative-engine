/**
 * @file Detects axis space inadequacy through multiple analysis methods.
 * @see specs/axis-gap-detection-spec.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {object} AxisGapReport
 * @property {object} summary - Summary metrics for the analysis.
 * @property {object} pcaAnalysis - PCA analysis details.
 * @property {Array} hubPrototypes - Hub prototype findings.
 * @property {Array} coverageGaps - Coverage gap findings.
 * @property {Array} multiAxisConflicts - Multi-axis conflict findings.
 * @property {Array} recommendations - Suggested actions and priorities.
 */

class AxisGapAnalyzer {
  #prototypeProfileCalculator;
  #config;
  #logger;

  /**
   * Create an AxisGapAnalyzer.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {object} deps.prototypeProfileCalculator - For clustering access.
   * @param {object} deps.config - PROTOTYPE_OVERLAP_CONFIG with axis gap thresholds.
   * @param {object} deps.logger - ILogger instance.
   */
  constructor({ prototypeProfileCalculator, config, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(
      prototypeProfileCalculator,
      'IPrototypeProfileCalculator',
      logger,
      { requiredMethods: ['calculateAll'] }
    );

    if (!config || typeof config !== 'object') {
      throw new Error('AxisGapAnalyzer requires config object');
    }

    this.#prototypeProfileCalculator = prototypeProfileCalculator;
    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Analyze all prototypes for axis gap indicators.
   *
   * @param {Array<object>} _prototypes - All prototypes with weights.
   * @param {Map<string, object>} _outputVectors - Pre-computed vectors from V3 setup.
   * @param {Map<string, object>} _profiles - Pre-computed profiles from V3 setup.
   * @param {Array<object>} _pairResults - Classification results from Stage C.
   * @param {(phase: string, details: object) => void} [_onProgress] - Progress callback.
   * @returns {object} AxisGapReport with summary, pcaAnalysis, hubPrototypes, coverageGaps, multiAxisConflicts, and recommendations.
   */
  analyze(_prototypes, _outputVectors, _profiles, _pairResults, _onProgress) {
    // Reserved for future enhanced clustering; validates dependency is available
    void this.#prototypeProfileCalculator;

    // Check feature flag
    if (!this.#config.enableAxisGapDetection) {
      this.#logger.debug('AxisGapAnalyzer: Axis gap detection disabled');
      return this.#buildEmptyReport(0);
    }

    // Coerce inputs to safe defaults
    const prototypes = Array.isArray(_prototypes) ? _prototypes : [];
    const profiles = _profiles instanceof Map ? _profiles : (_profiles && typeof _profiles === 'object' ? new Map(Object.entries(_profiles)) : new Map());
    const pairResults = Array.isArray(_pairResults) ? _pairResults : [];
    const onProgress = typeof _onProgress === 'function' ? _onProgress : () => {};

    // Handle empty prototypes
    if (prototypes.length === 0) {
      this.#logger.debug('AxisGapAnalyzer: No prototypes provided');
      return this.#buildEmptyReport(0);
    }

    // Phase 1: PCA Analysis
    onProgress('pca_analysis', { phase: 1, total: 4 });
    const pcaResult = this.#runPCAAnalysis(prototypes);
    this.#logger.debug('AxisGapAnalyzer: PCA analysis complete', {
      residualVarianceRatio: pcaResult.residualVarianceRatio,
      additionalComponents: pcaResult.additionalSignificantComponents,
    });

    // Phase 2: Hub Detection
    onProgress('hub_detection', { phase: 2, total: 4 });
    const hubs = this.#identifyHubPrototypes(pairResults, profiles, prototypes);
    this.#logger.debug('AxisGapAnalyzer: Hub detection complete', {
      hubCount: hubs.length,
    });

    // Phase 3: Coverage Gap Detection
    onProgress('coverage_gap_detection', { phase: 3, total: 4 });
    const gaps = this.#detectCoverageGaps(profiles, prototypes);
    this.#logger.debug('AxisGapAnalyzer: Coverage gap detection complete', {
      gapCount: gaps.length,
    });

    // Phase 4: Multi-Axis Conflict Detection
    onProgress('multi_axis_conflict_detection', { phase: 4, total: 4 });
    const conflicts = this.#detectMultiAxisConflicts(prototypes);
    this.#logger.debug('AxisGapAnalyzer: Multi-axis conflict detection complete', {
      conflictCount: conflicts.length,
    });

    // Synthesize final report
    onProgress('synthesizing_report', { phase: 'complete' });
    return this.#synthesizeReport(pcaResult, hubs, gaps, conflicts, prototypes.length, prototypes);
  }

  /**
   * Test-only helper for PCA analysis.
   *
   * @param {Array<object>} prototypes - Prototypes with weights.
   * @returns {{residualVarianceRatio: number, additionalSignificantComponents: number, topLoadingPrototypes: Array<{prototypeId: string, loading: number}>}} PCA summary.
   */
  __TEST_ONLY__runPCAAnalysis(prototypes) {
    return this.#runPCAAnalysis(prototypes);
  }

  /**
   * Test-only helper for hub detection.
   *
   * @param {Array<object>} pairResults - Pair results.
   * @param {Map<string, object>|object} [profiles] - Profile lookup by prototype id.
   * @param {Array<object>} [prototypes] - Prototype definitions for axis concept suggestion.
   * @returns {Array<object>} Hub prototype findings.
   */
  __TEST_ONLY__identifyHubPrototypes(pairResults, profiles, prototypes) {
    return this.#identifyHubPrototypes(pairResults, profiles, prototypes);
  }

  /**
   * Test-only helper for coverage gap detection.
   *
   * @param {Map<string, object>|object} profiles - Profile lookup by prototype id.
   * @param {Array<object>} prototypes - Prototype definitions.
   * @returns {Array<object>} Coverage gap findings.
   */
  __TEST_ONLY__detectCoverageGaps(profiles, prototypes) {
    return this.#detectCoverageGaps(profiles, prototypes);
  }

  /**
   * Test-only helper for multi-axis conflict detection.
   *
   * @param {Array<object>} prototypes - Prototype definitions.
   * @returns {Array<object>} Multi-axis conflict findings.
   */
  __TEST_ONLY__detectMultiAxisConflicts(prototypes) {
    return this.#detectMultiAxisConflicts(prototypes);
  }

  /**
   * Test-only helper for median and IQR calculations.
   *
   * @param {Array<number>} counts - Active axis counts.
   * @returns {{median: number, iqr: number}} Median and IQR.
   */
  __TEST_ONLY__computeMedianAndIQR(counts) {
    return this.#computeMedianAndIQR(counts);
  }

  /**
   * Test-only helper for cosine distance.
   *
   * @param {Record<string, number>} vecA - Vector A.
   * @param {Record<string, number>} vecB - Vector B.
   * @param {{useAbsolute?: boolean}} [options] - Calculation options.
   * @returns {number} Cosine distance.
   */
  __TEST_ONLY__computeCosineDistance(vecA, vecB, options) {
    return this.#computeCosineDistance(vecA, vecB, options);
  }

  /**
   * Test-only helper for cluster centroid.
   *
   * @param {Array<string>} members - Prototype ids in the cluster.
   * @param {Array<object>} prototypes - Prototype definitions.
   * @returns {Record<string, number> | null} Cluster centroid.
   */
  __TEST_ONLY__computeClusterCentroid(members, prototypes) {
    const lookup = this.#buildPrototypeLookup(prototypes);
    const axes = this.#collectAxes(prototypes);
    return this.#computeClusterCentroid(members, lookup, axes);
  }


  /**
   * Test-only helper for synthesize report.
   *
   * @param {object} pcaResult - PCA analysis result.
   * @param {Array<object>} hubs - Hub prototypes.
   * @param {Array<object>} gaps - Coverage gaps.
   * @param {Array<object>} conflicts - Multi-axis conflicts.
   * @param {number} totalPrototypes - Total prototype count.
   * @param {Array<object>} [prototypes] - Prototype definitions.
   * @returns {object} AxisGapReport.
   */
  __TEST_ONLY__synthesizeReport(pcaResult, hubs, gaps, conflicts, totalPrototypes, prototypes = []) {
    return this.#synthesizeReport(pcaResult, hubs, gaps, conflicts, totalPrototypes, prototypes);
  }

  /**
   * Test-only helper for building empty report.
   *
   * @param {number} totalPrototypes - Total prototype count.
   * @returns {object} Empty AxisGapReport.
   */
  __TEST_ONLY__buildEmptyReport(totalPrototypes) {
    return this.#buildEmptyReport(totalPrototypes);
  }

  /**
   * Test-only helper for counting triggered methods.
   *
   * @param {object} pcaResult - PCA analysis result.
   * @param {Array<object>} hubs - Hub prototypes.
   * @param {Array<object>} gaps - Coverage gaps.
   * @param {Array<object>} conflicts - Multi-axis conflicts.
   * @returns {number} Number of triggered methods.
   */
  __TEST_ONLY__countTriggeredMethods(pcaResult, hubs, gaps, conflicts) {
    return this.#countTriggeredMethods(pcaResult, hubs, gaps, conflicts);
  }

  /**
   * Test-only helper for computing confidence level.
   *
   * @param {number} methodsTriggered - Number of methods that found signals.
   * @returns {'low'|'medium'|'high'} Confidence level.
   */
  __TEST_ONLY__computeConfidenceLevel(methodsTriggered) {
    return this.#computeConfidenceLevel(methodsTriggered);
  }

  /**
   * Test-only helper for generating recommendations.
   *
   * @param {object} pcaResult - PCA analysis result.
   * @param {Array<object>} hubs - Hub prototypes.
   * @param {Array<object>} gaps - Coverage gaps.
   * @param {Array<object>} conflicts - Multi-axis conflicts.
   * @returns {Array<object>} Recommendations.
   */
  __TEST_ONLY__generateRecommendations(pcaResult, hubs, gaps, conflicts) {
    return this.#generateRecommendations(pcaResult, hubs, gaps, conflicts);
  }

  /**
   * Test hook for computing reconstruction errors.
   *
   * @param {object} params - Parameters for reconstruction error computation.
   * @returns {Array<{prototypeId: string, error: number}>} Reconstruction errors.
   */
  __TEST_ONLY__computeReconstructionErrors(params) {
    return this.#computeReconstructionErrors(params);
  }

  /**
   * Test hook for computing prototype weight summaries.
   *
   * @param {Array<object>} prototypes - Prototypes with weights.
   * @param {object} pcaResult - PCA analysis result.
   * @param {Array<object>} hubs - Hub prototypes.
   * @param {Array<object>} gaps - Coverage gaps.
   * @param {Array<object>} conflicts - Multi-axis conflicts.
   * @returns {Array<object>} Prototype weight summaries.
   */
  __TEST_ONLY__computePrototypeWeightSummaries(prototypes, pcaResult, hubs, gaps, conflicts) {
    return this.#computePrototypeWeightSummaries(prototypes, pcaResult, hubs, gaps, conflicts);
  }

  // Private method stubs for subsequent tickets
  #runPCAAnalysis(prototypes) {
    if (!Array.isArray(prototypes) || prototypes.length < 2) {
      return this.#createEmptyPCAResult();
    }

    const { matrix, axes, prototypeIds } = this.#buildWeightMatrix(prototypes);

    if (axes.length === 0 || matrix.length < 2) {
      return this.#createEmptyPCAResult();
    }

    const hasNonZero = matrix.some((row) =>
      row.some((value) => Math.abs(value) > 0)
    );
    if (!hasNonZero) {
      return this.#createEmptyPCAResult();
    }

    const standardized = this.#standardizeMatrix(matrix);
    if (!standardized.hasVariance) {
      return this.#createEmptyPCAResult();
    }

    const covariance = this.#computeCovariance(standardized.matrix);
    if (!covariance || covariance.length === 0) {
      return this.#createEmptyPCAResult();
    }

    const eigen = this.#computeEigenDecomposition(covariance);
    if (!eigen || eigen.values.length === 0) {
      return this.#createEmptyPCAResult();
    }

    const totalVariance = eigen.values.reduce((sum, value) => sum + value, 0);
    if (totalVariance <= 0) {
      return this.#createEmptyPCAResult();
    }

    const axisCount = this.#computeExpectedAxisCount(prototypes, axes);
    const residualValues = eigen.values.slice(axisCount);
    const residualVariance = residualValues.reduce((sum, value) => sum + value, 0);
    const residualVarianceRatio = Math.min(
      1,
      Math.max(0, residualVariance / totalVariance)
    );
    const additionalSignificantComponents = residualValues.filter(
      (value) => value >= this.#config.pcaKaiserThreshold
    ).length;
    const topLoadingPrototypes = this.#computeExtremePrototypes({
      axisCount,
      eigenvectors: eigen.vectors,
      matrix: standardized.matrix,
      prototypeIds,
    });

    // Compute cumulative variance from eigenvalues
    const cumulativeVariance = [];
    let cumulative = 0;
    for (const eigenvalue of eigen.values) {
      cumulative += eigenvalue;
      cumulativeVariance.push(cumulative / totalVariance);
    }

    // Find component counts for 80% and 90% thresholds
    const componentsFor80Pct =
      cumulativeVariance.findIndex((v) => v >= 0.8) + 1 || axes.length;
    const componentsFor90Pct =
      cumulativeVariance.findIndex((v) => v >= 0.9) + 1 || axes.length;

    // Compute reconstruction errors for prototypes
    const reconstructionErrors = this.#computeReconstructionErrors({
      matrix: standardized.matrix,
      eigenvectors: eigen.vectors,
      axisCount,
      prototypeIds,
    });

    return {
      residualVarianceRatio,
      additionalSignificantComponents,
      topLoadingPrototypes,
      dimensionsUsed: axes,
      cumulativeVariance,
      componentsFor80Pct,
      componentsFor90Pct,
      reconstructionErrors,
    };
  }

  #identifyHubPrototypes(pairResults, profiles = new Map(), prototypes = []) {
    if (!Array.isArray(pairResults) || pairResults.length === 0) {
      return [];
    }

    const graph = this.#buildOverlapGraph(pairResults);
    if (graph.size === 0) {
      return [];
    }

    const hubMinDegree = Number.isFinite(this.#config.hubMinDegree)
      ? this.#config.hubMinDegree
      : 4;
    const hubMaxEdgeWeight = Number.isFinite(this.#config.hubMaxEdgeWeight)
      ? this.#config.hubMaxEdgeWeight
      : 0.9;
    const hubMinNeighborhoodDiversity = Number.isFinite(
      this.#config.hubMinNeighborhoodDiversity
    )
      ? this.#config.hubMinNeighborhoodDiversity
      : 2;

    const hubs = [];

    for (const [nodeId, neighbors] of graph.entries()) {
      const neighborIds = Array.from(neighbors.keys());
      const degree = neighborIds.length;
      if (degree < hubMinDegree) {
        continue;
      }

      const edgeWeights = Array.from(neighbors.values());
      if (edgeWeights.some((weight) => weight > hubMaxEdgeWeight)) {
        continue;
      }

      const neighborhoodDiversity = this.#getNeighborhoodDiversity(
        neighborIds,
        profiles
      );
      if (neighborhoodDiversity < hubMinNeighborhoodDiversity) {
        continue;
      }

      const hubScore = this.#computeHubScore(edgeWeights);

      hubs.push({
        prototypeId: nodeId,
        hubScore,
        overlappingPrototypes: neighborIds.sort(),
        neighborhoodDiversity,
        suggestedAxisConcept: this.#suggestAxisConcept(
          nodeId,
          neighborIds,
          prototypes
        ),
      });
    }

    return hubs;
  }

  #detectCoverageGaps(profiles, prototypes = []) {
    if (!profiles || (profiles instanceof Map && profiles.size === 0)) {
      return [];
    }

    const clusters = this.#extractClusters(profiles);
    if (clusters.size === 0) {
      return [];
    }

    const axes = this.#collectAxes(prototypes);
    if (axes.length === 0) {
      return [];
    }

    const axisUnitVectors = this.#getAxisUnitVectors(axes);
    const prototypeLookup = this.#buildPrototypeLookup(prototypes);
    const distanceThreshold = Number.isFinite(
      this.#config.coverageGapAxisDistanceThreshold
    )
      ? this.#config.coverageGapAxisDistanceThreshold
      : 0.6;
    const minClusterSize = Number.isFinite(
      this.#config.coverageGapMinClusterSize
    )
      ? this.#config.coverageGapMinClusterSize
      : 3;

    const gaps = [];

    for (const [clusterId, members] of clusters.entries()) {
      const memberIds = members.filter((memberId) =>
        prototypeLookup.has(memberId)
      );
      if (memberIds.length < minClusterSize) {
        continue;
      }

      const centroid = this.#computeClusterCentroid(
        memberIds,
        prototypeLookup,
        axes
      );
      if (!centroid) {
        continue;
      }

      const suggestedAxisDirection = this.#normalizeVector(centroid);
      if (!suggestedAxisDirection) {
        continue;
      }

      const distanceToNearestAxis = this.#computeNearestAxisDistance(
        suggestedAxisDirection,
        axisUnitVectors
      );
      if (distanceToNearestAxis < distanceThreshold) {
        continue;
      }

      gaps.push({
        clusterId,
        centroidPrototypes: memberIds.slice().sort(),
        distanceToNearestAxis,
        suggestedAxisDirection,
      });
    }

    return gaps;
  }

  #detectMultiAxisConflicts(_prototypes) {
    const prototypes = Array.isArray(_prototypes) ? _prototypes : [];
    if (prototypes.length < 2) {
      return [];
    }

    const epsilon = Number.isFinite(this.#config.activeAxisEpsilon)
      ? Math.max(0, this.#config.activeAxisEpsilon)
      : 0;
    const usageThreshold = Number.isFinite(this.#config.multiAxisUsageThreshold)
      ? this.#config.multiAxisUsageThreshold
      : 1.5;
    const signBalanceThreshold = Number.isFinite(
      this.#config.multiAxisSignBalanceThreshold
    )
      ? this.#config.multiAxisSignBalanceThreshold
      : 0.4;

    const summaries = prototypes.map((prototype, index) => {
      const prototypeId =
        prototype?.id ?? prototype?.prototypeId ?? `prototype-${index}`;
      const weights = prototype?.weights ?? {};
      const { positiveAxes, negativeAxes } = this.#categorizeAxes(
        weights,
        epsilon
      );
      const activeAxisCount = this.#countActiveAxes(
        positiveAxes,
        negativeAxes
      );
      const signBalance = this.#computeSignBalance(
        positiveAxes.length,
        negativeAxes.length,
        activeAxisCount
      );

      return {
        prototypeId,
        activeAxisCount,
        signBalance,
        positiveAxes: positiveAxes.slice().sort(),
        negativeAxes: negativeAxes.slice().sort(),
      };
    });

    const counts = summaries.map((entry) => entry.activeAxisCount);
    const { median, iqr } = this.#computeMedianAndIQR(counts);
    const axisThreshold = median + iqr * usageThreshold;

    return summaries.filter(
      (entry) =>
        entry.activeAxisCount > axisThreshold &&
        entry.signBalance < signBalanceThreshold
    );
  }

  /**
   * Compute weight summaries for prototypes flagged by any detection method.
   *
   * @param {Array<object>} prototypes - All prototypes with weights.
   * @param {object} pcaResult - PCA analysis result.
   * @param {Array<object>} hubs - Hub prototypes.
   * @param {Array<object>} gaps - Coverage gaps.
   * @param {Array<object>} conflicts - Multi-axis conflicts.
   * @returns {Array<{prototypeId: string, topAxes: Array<{axis: string, weight: number}>, reason: string, metrics: object}>} Prototype weight summaries with top axes and flagging reason.
   */
  #computePrototypeWeightSummaries(prototypes, pcaResult, hubs, gaps, conflicts) {
    if (!Array.isArray(prototypes) || prototypes.length === 0) {
      return [];
    }

    // Build a lookup for prototype weights
    const prototypeLookup = new Map(
      prototypes.map((p) => [p?.id ?? p?.prototypeId ?? '', p])
    );

    // Collect flagged prototype IDs with their sources and metrics
    const flaggedPrototypes = new Map();

    // PCA - high reconstruction error
    const reconstructionThreshold = Number.isFinite(this.#config.reconstructionErrorThreshold)
      ? this.#config.reconstructionErrorThreshold
      : 0.5;

    if (pcaResult?.reconstructionErrors && Array.isArray(pcaResult.reconstructionErrors)) {
      for (const { prototypeId, error } of pcaResult.reconstructionErrors) {
        if (error >= reconstructionThreshold && !flaggedPrototypes.has(prototypeId)) {
          flaggedPrototypes.set(prototypeId, {
            reason: 'high_reconstruction_error',
            metrics: { reconstructionError: error },
          });
        }
      }
    }

    // PCA - extreme projection
    if (pcaResult?.topLoadingPrototypes && Array.isArray(pcaResult.topLoadingPrototypes)) {
      for (const { prototypeId, loading } of pcaResult.topLoadingPrototypes) {
        if (!flaggedPrototypes.has(prototypeId)) {
          flaggedPrototypes.set(prototypeId, {
            reason: 'extreme_projection',
            metrics: { projectionScore: loading },
          });
        }
      }
    }

    // Hub prototypes
    if (Array.isArray(hubs)) {
      for (const hub of hubs) {
        const prototypeId = hub?.prototypeId;
        if (prototypeId && !flaggedPrototypes.has(prototypeId)) {
          flaggedPrototypes.set(prototypeId, {
            reason: 'hub',
            metrics: { hubScore: hub.hubScore, neighborhoodDiversity: hub.neighborhoodDiversity },
          });
        }
      }
    }

    // Multi-axis conflicts
    if (Array.isArray(conflicts)) {
      for (const conflict of conflicts) {
        const prototypeId = conflict?.prototypeId;
        if (prototypeId && !flaggedPrototypes.has(prototypeId)) {
          flaggedPrototypes.set(prototypeId, {
            reason: 'multi_axis_conflict',
            metrics: { activeAxisCount: conflict.activeAxisCount, signBalance: conflict.signBalance },
          });
        }
      }
    }

    // Coverage gaps contribute centroid prototypes
    if (Array.isArray(gaps)) {
      for (const gap of gaps) {
        const centroidPrototypes = gap?.centroidPrototypes;
        if (Array.isArray(centroidPrototypes)) {
          for (const prototypeId of centroidPrototypes) {
            if (!flaggedPrototypes.has(prototypeId)) {
              flaggedPrototypes.set(prototypeId, {
                reason: 'coverage_gap',
                metrics: { distanceToNearestAxis: gap.distanceToNearestAxis, clusterId: gap.clusterId },
              });
            }
          }
        }
      }
    }

    // Build weight summaries for each flagged prototype
    const summaries = [];

    for (const [prototypeId, { reason, metrics }] of flaggedPrototypes.entries()) {
      const prototype = prototypeLookup.get(prototypeId);
      const weights = prototype?.weights ?? {};

      // Get top 5 axes by absolute weight
      const axisWeights = Object.entries(weights)
        .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
        .map(([axis, weight]) => ({ axis, weight }))
        .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
        .slice(0, 5);

      summaries.push({
        prototypeId,
        topAxes: axisWeights,
        reason,
        metrics,
      });
    }

    return summaries;
  }

  #synthesizeReport(pcaResult, hubs, gaps, conflicts, totalPrototypes = 0, prototypes = []) {
    const methodsTriggered = this.#countTriggeredMethods(pcaResult, hubs, gaps, conflicts);
    const confidence = this.#computeConfidenceLevel(methodsTriggered);
    const recommendations = this.#generateRecommendations(pcaResult, hubs, gaps, conflicts);
    const prototypeWeightSummaries = this.#computePrototypeWeightSummaries(
      prototypes, pcaResult, hubs, gaps, conflicts
    );

    this.#sortRecommendationsByPriority(recommendations);

    return {
      summary: {
        totalPrototypesAnalyzed: totalPrototypes,
        recommendationCount: recommendations.length,
        signalBreakdown: {
          pcaSignals: pcaResult.residualVarianceRatio > this.#config.residualVarianceThreshold ? 1 : 0,
          hubSignals: hubs.length,
          coverageGapSignals: gaps.length,
          multiAxisConflictSignals: conflicts.length,
        },
        confidence,
        potentialGapsDetected: recommendations.length, // backward compat
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
      recommendations,
      prototypeWeightSummaries,
    };
  }


  /**
   * Build an empty report structure.
   *
   * @param {number} totalPrototypes - Total prototypes analyzed.
   * @returns {object} Empty AxisGapReport.
   */
  #buildEmptyReport(totalPrototypes) {
    return {
      summary: {
        totalPrototypesAnalyzed: totalPrototypes,
        recommendationCount: 0,
        signalBreakdown: {
          pcaSignals: 0,
          hubSignals: 0,
          coverageGapSignals: 0,
          multiAxisConflictSignals: 0,
        },
        confidence: 'low',
        potentialGapsDetected: 0, // backward compat
      },
      pcaAnalysis: this.#createEmptyPCAResult(),
      hubPrototypes: [],
      coverageGaps: [],
      multiAxisConflicts: [],
      recommendations: [],
      prototypeWeightSummaries: [],
    };
  }

  /**
   * Count how many detection methods triggered findings.
   *
   * @param {object} pcaResult - PCA analysis result.
   * @param {Array<object>} hubs - Hub prototypes.
   * @param {Array<object>} gaps - Coverage gaps.
   * @param {Array<object>} conflicts - Multi-axis conflicts.
   * @returns {number} Number of methods that found signals.
   */
  #countTriggeredMethods(pcaResult, hubs, gaps, conflicts) {
    let count = 0;
    const pcaThreshold = Number.isFinite(this.#config.pcaResidualVarianceThreshold)
      ? this.#config.pcaResidualVarianceThreshold
      : 0.15;

    if (pcaResult.residualVarianceRatio >= pcaThreshold ||
        pcaResult.additionalSignificantComponents > 0) {
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
   * Compute confidence level based on how many detection methods triggered.
   *
   * @param {number} methodsTriggered - Number of methods that found signals.
   * @returns {'low'|'medium'|'high'} Confidence level.
   */
  #computeConfidenceLevel(methodsTriggered) {
    if (methodsTriggered >= 3) {
      return 'high';
    }
    if (methodsTriggered >= 2) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate recommendations based on detection results.
   *
   * @param {object} pcaResult - PCA analysis result.
   * @param {Array<object>} hubs - Hub prototypes.
   * @param {Array<object>} gaps - Coverage gaps.
   * @param {Array<object>} conflicts - Multi-axis conflicts.
   * @returns {Array<object>} Recommendations sorted by priority.
   */
  #generateRecommendations(pcaResult, hubs, gaps, conflicts) {
    const recommendations = [];
    const pcaThreshold = Number.isFinite(this.#config.pcaResidualVarianceThreshold)
      ? this.#config.pcaResidualVarianceThreshold
      : 0.15;

    const pcaTriggered = pcaResult.residualVarianceRatio >= pcaThreshold ||
                         pcaResult.additionalSignificantComponents > 0;
    const hasHubs = Array.isArray(hubs) && hubs.length > 0;
    const hasGaps = Array.isArray(gaps) && gaps.length > 0;
    const hasConflicts = Array.isArray(conflicts) && conflicts.length > 0;

    // HIGH priority: PCA + coverage gap indicates strong evidence for new axis
    if (pcaTriggered && hasGaps) {
      const affectedPrototypes = this.#mergeUniquePrototypes(
        pcaResult.topLoadingPrototypes.map((entry) => entry.prototypeId),
        ...gaps.map((gap) => gap.centroidPrototypes)
      );

      recommendations.push(this.#buildRecommendation({
        priority: 'high',
        type: 'NEW_AXIS',
        description: 'PCA analysis and coverage gap detection both indicate a potential missing axis. Consider adding a new emotional dimension.',
        affectedPrototypes,
        evidence: [
          `PCA residual variance ratio: ${(pcaResult.residualVarianceRatio * 100).toFixed(1)}%`,
          `Additional significant components: ${pcaResult.additionalSignificantComponents}`,
          `Coverage gaps found: ${gaps.length}`,
        ],
      }));
    }

    // HIGH priority: Hub + coverage gap indicates strong evidence for new axis
    if (hasHubs && hasGaps) {
      for (const hub of hubs) {
        const relatedGap = this.#findRelatedGap(hub, gaps);
        if (relatedGap) {
          const affectedPrototypes = this.#mergeUniquePrototypes(
            [hub.prototypeId],
            hub.overlappingPrototypes,
            relatedGap.centroidPrototypes
          );

          recommendations.push(this.#buildRecommendation({
            priority: 'high',
            type: 'NEW_AXIS',
            description: `Hub prototype "${hub.prototypeId}" connects multiple clusters that form a coverage gap. Consider adding axis: "${hub.suggestedAxisConcept}".`,
            affectedPrototypes,
            evidence: [
              `Hub score: ${hub.hubScore.toFixed(2)}`,
              `Overlapping prototypes: ${hub.overlappingPrototypes.length}`,
              `Neighborhood diversity: ${hub.neighborhoodDiversity}`,
              `Distance to nearest axis: ${relatedGap.distanceToNearestAxis.toFixed(2)}`,
            ],
          }));
        }
      }
    }

    // MEDIUM priority: Single signal - PCA alone
    if (pcaTriggered && !hasGaps && !hasHubs) {
      const affectedPrototypes = pcaResult.topLoadingPrototypes.map((entry) => entry.prototypeId);

      recommendations.push(this.#buildRecommendation({
        priority: 'medium',
        type: 'INVESTIGATE',
        description: 'PCA analysis suggests unexplained variance. Investigate the top-loading prototypes for potential axis candidates.',
        affectedPrototypes,
        evidence: [
          `PCA residual variance ratio: ${(pcaResult.residualVarianceRatio * 100).toFixed(1)}%`,
          `Additional significant components: ${pcaResult.additionalSignificantComponents}`,
          `Top loading prototypes: ${affectedPrototypes.slice(0, 5).join(', ')}`,
        ],
      }));
    }

    // MEDIUM priority: Single signal - Hub alone
    if (hasHubs && !hasGaps && !pcaTriggered) {
      for (const hub of hubs) {
        const affectedPrototypes = this.#mergeUniquePrototypes(
          [hub.prototypeId],
          hub.overlappingPrototypes
        );

        recommendations.push(this.#buildRecommendation({
          priority: 'medium',
          type: 'INVESTIGATE',
          description: `Hub prototype "${hub.prototypeId}" has moderate overlaps with prototypes from ${hub.neighborhoodDiversity} different clusters. Suggested axis concept: "${hub.suggestedAxisConcept}".`,
          affectedPrototypes,
          evidence: [
            `Hub score: ${hub.hubScore.toFixed(2)}`,
            `Overlapping prototypes: ${hub.overlappingPrototypes.length}`,
            `Neighborhood diversity: ${hub.neighborhoodDiversity}`,
          ],
        }));
      }
    }

    // MEDIUM priority: Single signal - Coverage gap alone
    if (hasGaps && !hasHubs && !pcaTriggered) {
      for (const gap of gaps) {
        recommendations.push(this.#buildRecommendation({
          priority: 'medium',
          type: 'INVESTIGATE',
          description: `Cluster "${gap.clusterId}" is distant from all existing axes. Consider if these prototypes share a common theme.`,
          affectedPrototypes: gap.centroidPrototypes,
          evidence: [
            `Distance to nearest axis: ${gap.distanceToNearestAxis.toFixed(2)}`,
            `Cluster members: ${gap.centroidPrototypes.length}`,
          ],
        }));
      }
    }

    // LOW priority: Multi-axis conflicts only
    if (hasConflicts && !pcaTriggered && !hasHubs && !hasGaps) {
      for (const conflict of conflicts) {
        recommendations.push(this.#buildRecommendation({
          priority: 'low',
          type: 'REFINE_EXISTING',
          description: `Prototype "${conflict.prototypeId}" uses many axes with balanced positive/negative weights. Consider whether it needs refinement or represents a valid complex state.`,
          affectedPrototypes: [conflict.prototypeId],
          evidence: [
            `Active axes: ${conflict.activeAxisCount}`,
            `Sign balance: ${conflict.signBalance.toFixed(2)}`,
            `Positive axes: ${conflict.positiveAxes.join(', ')}`,
            `Negative axes: ${conflict.negativeAxes.join(', ')}`,
          ],
        }));
      }
    }

    // If we have conflicts alongside other signals, add them with lower priority
    if (hasConflicts && (pcaTriggered || hasHubs || hasGaps)) {
      for (const conflict of conflicts) {
        recommendations.push(this.#buildRecommendation({
          priority: 'low',
          type: 'REFINE_EXISTING',
          description: `Prototype "${conflict.prototypeId}" shows multi-axis conflict patterns that may be related to the axis gap.`,
          affectedPrototypes: [conflict.prototypeId],
          evidence: [
            `Active axes: ${conflict.activeAxisCount}`,
            `Sign balance: ${conflict.signBalance.toFixed(2)}`,
          ],
        }));
      }
    }

    return recommendations;
  }

  /**
   * Build a recommendation object.
   *
   * @param {object} params - Recommendation parameters.
   * @param {'high'|'medium'|'low'} params.priority - Priority level.
   * @param {'NEW_AXIS'|'INVESTIGATE'|'REFINE_EXISTING'} params.type - Recommendation type.
   * @param {string} params.description - Human-readable description.
   * @param {Array<string>} params.affectedPrototypes - Prototype IDs involved.
   * @param {Array<string>} params.evidence - Evidence strings.
   * @returns {object} Recommendation object.
   */
  #buildRecommendation({ priority, type, description, affectedPrototypes, evidence }) {
    return {
      priority,
      type,
      description,
      affectedPrototypes: [...new Set(affectedPrototypes)].sort(),
      evidence: evidence.length > 0 ? evidence : ['Signal detected'],
    };
  }

  /**
   * Sort recommendations by priority (high > medium > low) in place.
   *
   * @param {Array<object>} recommendations - Recommendations to sort.
   */
  #sortRecommendationsByPriority(recommendations) {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => {
      const orderA = priorityOrder[a.priority] ?? 3;
      const orderB = priorityOrder[b.priority] ?? 3;
      return orderA - orderB;
    });
  }

  /**
   * Find a coverage gap related to a hub prototype.
   *
   * @param {object} hub - Hub prototype finding.
   * @param {Array<object>} gaps - Coverage gaps.
   * @returns {object|null} Related gap or null.
   */
  #findRelatedGap(hub, gaps) {
    const hubNeighbors = new Set(hub.overlappingPrototypes);

    for (const gap of gaps) {
      const overlap = gap.centroidPrototypes.filter((prototypeId) =>
        hubNeighbors.has(prototypeId)
      );
      if (overlap.length > 0) {
        return gap;
      }
    }

    return null;
  }

  /**
   * Merge multiple prototype ID arrays into a deduplicated list.
   *
   * @param {...Array<string>} arrays - Arrays of prototype IDs.
   * @returns {Array<string>} Deduplicated and sorted prototype IDs.
   */
  #mergeUniquePrototypes(...arrays) {
    const merged = new Set();
    for (const arr of arrays) {
      if (Array.isArray(arr)) {
        for (const id of arr) {
          if (typeof id === 'string' && id.length > 0) {
            merged.add(id);
          }
        }
      }
    }
    return Array.from(merged).sort();
  }

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

  #buildWeightMatrix(prototypes) {
    const axisSet = new Set();

    prototypes.forEach((prototype) => {
      const weights = prototype?.weights;
      if (!weights || typeof weights !== 'object') {
        return;
      }
      for (const [axis, value] of Object.entries(weights)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          axisSet.add(axis);
        }
      }
    });

    let axes = Array.from(axisSet).sort();
    const axisLimit = Math.min(axes.length, prototypes.length);

    if (axes.length > axisLimit) {
      axes = this.#selectTopVarianceAxes(prototypes, axes, axisLimit);
    }

    const matrix = prototypes.map((prototype) => {
      const weights = prototype?.weights ?? {};
      return axes.map((axis) => {
        const value = weights[axis];
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
      });
    });
    const prototypeIds = prototypes.map(
      (prototype, index) =>
        prototype?.id ?? prototype?.prototypeId ?? `prototype-${index}`
    );

    return { matrix, axes, prototypeIds };
  }

  #selectTopVarianceAxes(prototypes, axes, limit) {
    const varianceByAxis = axes.map((axis) => {
      const values = prototypes.map((prototype) => {
        const value = prototype?.weights?.[axis];
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
      });
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance =
        values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        Math.max(1, values.length);
      return { axis, variance };
    });

    return varianceByAxis
      .sort((a, b) => b.variance - a.variance)
      .slice(0, limit)
      .map((entry) => entry.axis);
  }

  #standardizeMatrix(matrix) {
    const rowCount = matrix.length;
    const columnCount = matrix[0]?.length ?? 0;
    const means = new Array(columnCount).fill(0);
    const stdDevs = new Array(columnCount).fill(0);

    for (let col = 0; col < columnCount; col += 1) {
      let sum = 0;
      for (let row = 0; row < rowCount; row += 1) {
        sum += matrix[row][col];
      }
      means[col] = sum / rowCount;
    }

    for (let col = 0; col < columnCount; col += 1) {
      let sumSquares = 0;
      for (let row = 0; row < rowCount; row += 1) {
        const diff = matrix[row][col] - means[col];
        sumSquares += diff ** 2;
      }
      const variance = sumSquares / Math.max(1, rowCount - 1);
      stdDevs[col] = Math.sqrt(variance);
    }

    const standardized = new Array(rowCount);
    let hasVariance = false;

    for (let row = 0; row < rowCount; row += 1) {
      standardized[row] = new Array(columnCount);
      for (let col = 0; col < columnCount; col += 1) {
        const stdDev = stdDevs[col];
        const value =
          stdDev > 0 ? (matrix[row][col] - means[col]) / stdDev : 0;
        standardized[row][col] = value;
        if (value !== 0) {
          hasVariance = true;
        }
      }
    }

    return { matrix: standardized, hasVariance };
  }

  #computeCovariance(matrix) {
    const rowCount = matrix.length;
    if (rowCount < 2) {
      return null;
    }
    const columnCount = matrix[0]?.length ?? 0;
    const covariance = Array.from({ length: columnCount }, () =>
      new Array(columnCount).fill(0)
    );
    const denom = rowCount - 1;

    for (let i = 0; i < columnCount; i += 1) {
      for (let j = i; j < columnCount; j += 1) {
        let sum = 0;
        for (let row = 0; row < rowCount; row += 1) {
          sum += matrix[row][i] * matrix[row][j];
        }
        const value = sum / denom;
        covariance[i][j] = value;
        covariance[j][i] = value;
      }
    }

    return covariance;
  }

  #computeEigenDecomposition(matrix) {
    const size = matrix.length;
    const a = matrix.map((row) => row.slice());
    const vectors = Array.from({ length: size }, (_, i) => {
      const row = new Array(size).fill(0);
      row[i] = 1;
      return row;
    });
    const maxIterations = 50 * size * size;
    const tolerance = 1e-10;

    for (let iter = 0; iter < maxIterations; iter += 1) {
      let max = 0;
      let p = 0;
      let q = 1;
      for (let i = 0; i < size; i += 1) {
        for (let j = i + 1; j < size; j += 1) {
          const value = Math.abs(a[i][j]);
          if (value > max) {
            max = value;
            p = i;
            q = j;
          }
        }
      }

      if (max < tolerance) {
        break;
      }

      const diff = a[q][q] - a[p][p];
      const phi = 0.5 * Math.atan2(2 * a[p][q], diff);
      const c = Math.cos(phi);
      const s = Math.sin(phi);

      for (let k = 0; k < size; k += 1) {
        if (k !== p && k !== q) {
          const aik = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * aik - s * aqk;
          a[k][p] = a[p][k];
          a[q][k] = s * aik + c * aqk;
          a[k][q] = a[q][k];
        }
      }

      const app = a[p][p];
      const aqq = a[q][q];
      const apq = a[p][q];
      a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
      a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
      a[p][q] = 0;
      a[q][p] = 0;

      for (let k = 0; k < size; k += 1) {
        const vkp = vectors[k][p];
        const vkq = vectors[k][q];
        vectors[k][p] = c * vkp - s * vkq;
        vectors[k][q] = s * vkp + c * vkq;
      }
    }

    const eigenpairs = a.map((row, index) => ({
      value: row[index],
      vector: vectors.map((vrow) => vrow[index]),
    }));

    eigenpairs.sort((aPair, bPair) => bPair.value - aPair.value);

    return {
      values: eigenpairs.map((pair) => pair.value),
      vectors: eigenpairs.map((pair) => pair.vector),
    };
  }

  #computeExpectedAxisCount(prototypes, axes) {
    const epsilon =
      typeof this.#config.activeAxisEpsilon === 'number'
        ? this.#config.activeAxisEpsilon
        : 0;
    const counts = prototypes.map((prototype) => {
      const weights = prototype?.weights ?? {};
      let active = 0;
      for (const axis of axes) {
        const value = weights[axis];
        if (typeof value === 'number' && Math.abs(value) >= epsilon) {
          active += 1;
        }
      }
      return active;
    });

    const sorted = counts.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    const axisCount = Math.max(1, Math.floor(median));

    return Math.min(axisCount, axes.length);
  }

  #categorizeAxes(weights, epsilon) {
    if (!weights || typeof weights !== 'object') {
      return { positiveAxes: [], negativeAxes: [] };
    }

    const positiveAxes = [];
    const negativeAxes = [];

    for (const [axis, value] of Object.entries(weights)) {
      if (!Number.isFinite(value)) {
        continue;
      }
      if (value >= epsilon) {
        positiveAxes.push(axis);
      } else if (value <= -epsilon) {
        negativeAxes.push(axis);
      }
    }

    return { positiveAxes, negativeAxes };
  }

  #countActiveAxes(positiveAxes, negativeAxes) {
    return positiveAxes.length + negativeAxes.length;
  }

  #computeSignBalance(positiveCount, negativeCount, totalActive) {
    if (!totalActive) {
      return 1;
    }
    return Math.abs(positiveCount - negativeCount) / totalActive;
  }

  #computeMedianAndIQR(counts) {
    if (!Array.isArray(counts) || counts.length === 0) {
      return { median: 0, iqr: 0 };
    }

    const sorted = counts
      .filter((value) => Number.isFinite(value))
      .slice()
      .sort((a, b) => a - b);
    if (sorted.length === 0) {
      return { median: 0, iqr: 0 };
    }

    const median = this.#computeMedian(sorted);
    const mid = Math.floor(sorted.length / 2);
    const lower = sorted.slice(0, mid);
    const upper =
      sorted.length % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1);
    const q1 = this.#computeMedian(lower);
    const q3 = this.#computeMedian(upper);
    const iqr = Math.max(0, q3 - q1);

    return { median, iqr };
  }

  #computeMedian(sortedValues) {
    if (!sortedValues.length) {
      return 0;
    }

    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
  }

  /**
   * Computes prototype projections (scores) onto unexplained variance components.
   * NOTE: These are PCA scores (prototype positions on the component), NOT loadings
   * (axis contributions to the component). Values outside [-1, 1] are expected.
   *
   * @param {object} params - Parameters
   * @param {number} params.axisCount - Number of expected axis dimensions
   * @param {number[][]} params.eigenvectors - PCA eigenvectors
   * @param {number[][]} params.matrix - Standardized weight matrix
   * @param {string[]} params.prototypeIds - Prototype identifiers
   * @returns {Array<{prototypeId: string, score: number}>} Top 10 extreme prototypes by |score|
   * @private
   */
  #computeExtremePrototypes({ axisCount, eigenvectors, matrix, prototypeIds }) {
    if (axisCount >= eigenvectors.length) {
      return [];
    }

    const component = eigenvectors[axisCount];
    const scores = matrix.map((row, index) => {
      let projection = 0;
      for (let i = 0; i < row.length; i += 1) {
        projection += row[i] * component[i];
      }
      return { prototypeId: prototypeIds[index], score: projection };
    });

    return scores
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
      .slice(0, 10);
  }

  /**
   * Computes reconstruction error (RMSE) for each prototype.
   * Projects prototypes onto reduced PC space and back, measuring fit quality.
   *
   * @param {object} params - Reconstruction parameters.
   * @param {number[][]} params.matrix - Standardized data matrix.
   * @param {number[][]} params.eigenvectors - Principal component eigenvectors.
   * @param {number} params.axisCount - Number of components to use for reconstruction.
   * @param {string[]} params.prototypeIds - Prototype identifiers.
   * @returns {Array<{prototypeId: string, error: number}>} Sorted by error descending.
   */
  #computeReconstructionErrors({ matrix, eigenvectors, axisCount, prototypeIds }) {
    if (
      !matrix ||
      matrix.length === 0 ||
      !eigenvectors ||
      eigenvectors.length === 0 ||
      axisCount <= 0
    ) {
      return [];
    }

    const componentCount = Math.min(axisCount, eigenvectors.length);
    const featureCount = matrix[0].length;
    const errors = [];

    for (let rowIdx = 0; rowIdx < matrix.length; rowIdx += 1) {
      const original = matrix[rowIdx];

      // Project onto principal components (reduce dimensionality)
      const projected = [];
      for (let pc = 0; pc < componentCount; pc += 1) {
        let projection = 0;
        for (let feat = 0; feat < featureCount; feat += 1) {
          projection += original[feat] * eigenvectors[pc][feat];
        }
        projected.push(projection);
      }

      // Reconstruct from reduced space
      const reconstructed = new Array(featureCount).fill(0);
      for (let pc = 0; pc < componentCount; pc += 1) {
        for (let feat = 0; feat < featureCount; feat += 1) {
          reconstructed[feat] += projected[pc] * eigenvectors[pc][feat];
        }
      }

      // Compute RMSE (root mean square error)
      let sumSquaredError = 0;
      for (let feat = 0; feat < featureCount; feat += 1) {
        const diff = original[feat] - reconstructed[feat];
        sumSquaredError += diff * diff;
      }
      const rmse = Math.sqrt(sumSquaredError / featureCount);

      errors.push({
        prototypeId: prototypeIds[rowIdx],
        error: rmse,
      });
    }

    // Sort by error descending (worst fitting first)
    return errors
      .sort((a, b) => b.error - a.error)
      .slice(0, 5); // Return top 5 worst fitting
  }

  #buildOverlapGraph(pairResults) {
    const graph = new Map();

    for (const pairResult of pairResults) {
      const { idA, idB } = this.#extractPairIds(pairResult);
      if (!idA || !idB || idA === idB) {
        continue;
      }

      const weight = this.#getEdgeWeight(pairResult);
      if (!Number.isFinite(weight) || weight <= 0) {
        continue;
      }

      this.#addEdge(graph, idA, idB, weight);
      this.#addEdge(graph, idB, idA, weight);
    }

    return graph;
  }

  #addEdge(graph, fromId, toId, weight) {
    if (!graph.has(fromId)) {
      graph.set(fromId, new Map());
    }
    const neighbors = graph.get(fromId);
    const existing = neighbors.get(toId);
    if (!Number.isFinite(existing) || weight > existing) {
      neighbors.set(toId, weight);
    }
  }

  #extractPairIds(pairResult) {
    const idA =
      pairResult?.prototypeAId ??
      pairResult?.prototypeA?.id ??
      pairResult?.prototypeA ??
      pairResult?.aId ??
      pairResult?.prototypes?.a ??
      null;
    const idB =
      pairResult?.prototypeBId ??
      pairResult?.prototypeB?.id ??
      pairResult?.prototypeB ??
      pairResult?.bId ??
      pairResult?.prototypes?.b ??
      null;

    return { idA: this.#coercePrototypeId(idA), idB: this.#coercePrototypeId(idB) };
  }

  #coercePrototypeId(rawId) {
    if (typeof rawId === 'string' && rawId.length > 0) {
      return rawId;
    }
    if (typeof rawId === 'number' && Number.isFinite(rawId)) {
      return String(rawId);
    }
    return null;
  }

  #getEdgeWeight(pairResult) {
    const explicitWeight =
      pairResult?.overlapScore ??
      pairResult?.edgeWeight ??
      pairResult?.overlapWeight;
    if (Number.isFinite(explicitWeight)) {
      return this.#clamp01(explicitWeight);
    }

    const metrics = pairResult?.classification?.metrics ?? pairResult?.metrics ?? {};
    const compositeWeight = this.#computeCompositeEdgeWeight(metrics);
    if (Number.isFinite(compositeWeight)) {
      return this.#clamp01(compositeWeight);
    }

    if (Number.isFinite(metrics.activationJaccard)) {
      return this.#clamp01(metrics.activationJaccard);
    }

    if (Number.isFinite(metrics.maeGlobal)) {
      return this.#clamp01(1 - metrics.maeGlobal);
    }

    if (Number.isFinite(metrics.maeCoPass)) {
      return this.#clamp01(1 - metrics.maeCoPass);
    }

    return NaN;
  }

  #computeCompositeEdgeWeight(metrics) {
    const gateOverlapRatio = metrics.gateOverlapRatio;
    const pearsonCorrelation = metrics.pearsonCorrelation;
    const globalMeanAbsDiff = metrics.globalMeanAbsDiff;
    const wGate = Number.isFinite(this.#config.compositeScoreGateOverlapWeight)
      ? this.#config.compositeScoreGateOverlapWeight
      : 0.3;
    const wCorr = Number.isFinite(this.#config.compositeScoreCorrelationWeight)
      ? this.#config.compositeScoreCorrelationWeight
      : 0.2;
    const wDiff = Number.isFinite(this.#config.compositeScoreGlobalDiffWeight)
      ? this.#config.compositeScoreGlobalDiffWeight
      : 0.5;

    if (
      Number.isFinite(gateOverlapRatio) &&
      Number.isFinite(pearsonCorrelation) &&
      Number.isFinite(globalMeanAbsDiff)
    ) {
      const normalizedCorr = (pearsonCorrelation + 1) / 2;
      const clampedGlobalDiff = this.#clamp01(globalMeanAbsDiff);
      return (
        gateOverlapRatio * wGate +
        normalizedCorr * wCorr +
        (1 - clampedGlobalDiff) * wDiff
      );
    }

    if (Number.isFinite(gateOverlapRatio) && Number.isFinite(pearsonCorrelation)) {
      const normalizedCorr = (pearsonCorrelation + 1) / 2;
      const total = wGate + wCorr;
      if (total > 0) {
        return (
          gateOverlapRatio * (wGate / total) +
          normalizedCorr * (wCorr / total)
        );
      }
    }

    if (Number.isFinite(gateOverlapRatio)) {
      return gateOverlapRatio;
    }

    if (Number.isFinite(pearsonCorrelation)) {
      return (pearsonCorrelation + 1) / 2;
    }

    return NaN;
  }

  #computeHubScore(edgeWeights) {
    if (!Array.isArray(edgeWeights) || edgeWeights.length === 0) {
      return 0;
    }
    const degree = edgeWeights.length;
    const mean =
      edgeWeights.reduce((sum, value) => sum + value, 0) / edgeWeights.length;
    const variance =
      edgeWeights.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      edgeWeights.length;
    const clampedVariance = this.#clamp01(variance);
    const score = degree * (1 - clampedVariance);
    return Math.max(0, score);
  }

  #getNeighborhoodDiversity(neighborIds, profiles) {
    const clusterIds = new Set();
    for (const neighborId of neighborIds) {
      const profile = this.#getProfile(profiles, neighborId);
      const clusterId = profile?.nearestClusterId ?? profile?.clusterId ?? null;
      if (clusterId !== null && clusterId !== undefined) {
        clusterIds.add(clusterId);
      }
    }
    return clusterIds.size;
  }

  #getProfile(profiles, prototypeId) {
    if (profiles instanceof Map) {
      return profiles.get(prototypeId);
    }
    if (profiles && typeof profiles === 'object') {
      return profiles[prototypeId];
    }
    return null;
  }

  #suggestAxisConcept(_prototypeId, neighbors, prototypes) {
    if (!Array.isArray(prototypes) || prototypes.length === 0) {
      return 'shared overlap';
    }
    const prototypeLookup = new Map();
    for (const prototype of prototypes) {
      const id = prototype?.id ?? prototype?.prototypeId ?? null;
      if (id) {
        prototypeLookup.set(id, prototype);
      }
    }

    const axisTotals = new Map();
    const axisCounts = new Map();

    for (const neighborId of neighbors) {
      const prototype = prototypeLookup.get(neighborId);
      const weights = prototype?.weights;
      if (!weights || typeof weights !== 'object') {
        continue;
      }
      for (const [axis, value] of Object.entries(weights)) {
        if (!Number.isFinite(value)) {
          continue;
        }
        axisTotals.set(axis, (axisTotals.get(axis) ?? 0) + Math.abs(value));
        axisCounts.set(axis, (axisCounts.get(axis) ?? 0) + 1);
      }
    }

    let bestAxis = null;
    let bestScore = -Infinity;
    for (const [axis, total] of axisTotals.entries()) {
      const count = axisCounts.get(axis) ?? 0;
      if (count === 0) {
        continue;
      }
      const avg = total / count;
      if (avg > bestScore) {
        bestScore = avg;
        bestAxis = axis;
      }
    }

    return bestAxis ?? 'shared overlap';
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  #extractClusters(profiles) {
    const clusters = new Map();
    const entries =
      profiles instanceof Map ? profiles.entries() : Object.entries(profiles);

    for (const [prototypeId, profile] of entries) {
      const clusterId = profile?.nearestClusterId ?? profile?.clusterId ?? null;
      if (!clusterId) {
        continue;
      }
      if (!clusters.has(clusterId)) {
        clusters.set(clusterId, []);
      }
      clusters.get(clusterId).push(prototypeId);
    }

    return clusters;
  }

  #collectAxes(prototypes) {
    const axes = new Set();
    if (!Array.isArray(prototypes)) {
      return [];
    }

    for (const prototype of prototypes) {
      const weights = prototype?.weights;
      if (!weights || typeof weights !== 'object') {
        continue;
      }
      for (const [axis, value] of Object.entries(weights)) {
        if (Number.isFinite(value)) {
          axes.add(axis);
        }
      }
    }

    return Array.from(axes).sort();
  }

  #buildPrototypeLookup(prototypes) {
    const lookup = new Map();
    if (!Array.isArray(prototypes)) {
      return lookup;
    }

    for (const prototype of prototypes) {
      const id = prototype?.id ?? prototype?.prototypeId ?? null;
      if (id) {
        lookup.set(id, prototype);
      }
    }

    return lookup;
  }

  #computeClusterCentroid(memberIds, prototypeLookup, axes) {
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return null;
    }
    if (!Array.isArray(axes) || axes.length === 0) {
      return null;
    }

    const totals = {};
    for (const axis of axes) {
      totals[axis] = 0;
    }

    let counted = 0;
    for (const memberId of memberIds) {
      const prototype = prototypeLookup.get(memberId);
      const weights = prototype?.weights ?? {};
      counted += 1;
      for (const axis of axes) {
        const value = weights[axis];
        if (Number.isFinite(value)) {
          totals[axis] += value;
        }
      }
    }

    if (counted === 0) {
      return null;
    }

    const centroid = {};
    for (const axis of axes) {
      centroid[axis] = totals[axis] / counted;
    }

    return centroid;
  }

  #getAxisUnitVectors(axes) {
    const vectors = new Map();
    for (const axis of axes) {
      const vec = {};
      for (const axisName of axes) {
        vec[axisName] = axisName === axis ? 1 : 0;
      }
      vectors.set(axis, vec);
    }
    return vectors;
  }

  #computeCosineDistance(vecA, vecB, options = {}) {
    if (!vecA || !vecB) {
      return 1;
    }
    const keys = new Set([
      ...Object.keys(vecA || {}),
      ...Object.keys(vecB || {}),
    ]);
    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (const key of keys) {
      const a = Number.isFinite(vecA[key]) ? vecA[key] : 0;
      const b = Number.isFinite(vecB[key]) ? vecB[key] : 0;
      dot += a * b;
      magA += a * a;
      magB += b * b;
    }

    if (magA === 0 || magB === 0) {
      return 1;
    }

    const similarity = dot / (Math.sqrt(magA) * Math.sqrt(magB));
    const adjusted = options.useAbsolute ? Math.abs(similarity) : similarity;
    const distance = 1 - adjusted;
    return this.#clamp01(distance);
  }

  #normalizeVector(vector) {
    if (!vector || typeof vector !== 'object') {
      return null;
    }
    const keys = Object.keys(vector);
    let magnitude = 0;
    for (const key of keys) {
      const value = Number.isFinite(vector[key]) ? vector[key] : 0;
      magnitude += value * value;
    }
    magnitude = Math.sqrt(magnitude);
    if (magnitude === 0) {
      return null;
    }
    const normalized = {};
    for (const key of keys) {
      const value = Number.isFinite(vector[key]) ? vector[key] : 0;
      normalized[key] = value / magnitude;
    }
    return normalized;
  }

  #computeNearestAxisDistance(vector, axisUnitVectors) {
    let minDistance = Number.POSITIVE_INFINITY;
    for (const axisVector of axisUnitVectors.values()) {
      const distance = this.#computeCosineDistance(vector, axisVector, {
        useAbsolute: true,
      });
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    return Number.isFinite(minDistance) ? minDistance : 1;
  }
}

export default AxisGapAnalyzer;
