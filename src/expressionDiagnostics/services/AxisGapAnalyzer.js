/**
 * @file Orchestrator for axis gap detection analysis.
 * @description Coordinates sub-services for comprehensive axis gap analysis.
 * @see specs/axis-gap-detection-spec.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('./axisGap/AxisGapReportSynthesizer.js').AxisGapReport} AxisGapReport
 */

/**
 * Orchestrator for axis gap detection that coordinates sub-services.
 *
 * This class has been refactored from a monolithic ~2300-line implementation
 * to a slim orchestrator (~150 lines) that delegates to specialized services:
 * - PCAAnalysisService: Principal Component Analysis
 * - HubPrototypeDetector: Hub detection via overlap graph
 * - CoverageGapDetector: Coverage gap identification
 * - MultiAxisConflictDetector: High axis loadings and sign tensions
 * - AxisGapReportSynthesizer: Report synthesis and recommendations
 */
class AxisGapAnalyzer {
  #prototypeProfileCalculator;
  #pcaAnalysisService;
  #hubPrototypeDetector;
  #coverageGapDetector;
  #multiAxisConflictDetector;
  #reportSynthesizer;
  #config;
  #logger;

  /**
   * Create an AxisGapAnalyzer orchestrator.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {object} deps.prototypeProfileCalculator - For clustering access.
   * @param {object} deps.pcaAnalysisService - PCA analysis service.
   * @param {object} deps.hubPrototypeDetector - Hub detection service.
   * @param {object} deps.coverageGapDetector - Coverage gap detection service.
   * @param {object} deps.multiAxisConflictDetector - Multi-axis conflict detection service.
   * @param {object} deps.reportSynthesizer - Report synthesis service.
   * @param {object} deps.config - PROTOTYPE_OVERLAP_CONFIG with axis gap thresholds.
   * @param {object} deps.logger - ILogger instance.
   */
  constructor({
    prototypeProfileCalculator,
    pcaAnalysisService,
    hubPrototypeDetector,
    coverageGapDetector,
    multiAxisConflictDetector,
    reportSynthesizer,
    config,
    logger,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(
      prototypeProfileCalculator,
      'IPrototypeProfileCalculator',
      logger,
      { requiredMethods: ['calculateAll'] }
    );
    validateDependency(pcaAnalysisService, 'IPCAAnalysisService', logger, {
      requiredMethods: ['analyze'],
    });
    validateDependency(hubPrototypeDetector, 'IHubPrototypeDetector', logger, {
      requiredMethods: ['detect'],
    });
    validateDependency(
      coverageGapDetector,
      'ICoverageGapDetector',
      logger,
      { requiredMethods: ['detect'] }
    );
    validateDependency(
      multiAxisConflictDetector,
      'IMultiAxisConflictDetector',
      logger,
      { requiredMethods: ['detect'] }
    );
    validateDependency(reportSynthesizer, 'IAxisGapReportSynthesizer', logger, {
      requiredMethods: ['synthesize', 'buildEmptyReport'],
    });

    if (!config || typeof config !== 'object') {
      throw new Error('AxisGapAnalyzer requires config object');
    }

    this.#prototypeProfileCalculator = prototypeProfileCalculator;
    this.#pcaAnalysisService = pcaAnalysisService;
    this.#hubPrototypeDetector = hubPrototypeDetector;
    this.#coverageGapDetector = coverageGapDetector;
    this.#multiAxisConflictDetector = multiAxisConflictDetector;
    this.#reportSynthesizer = reportSynthesizer;
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
   * @returns {AxisGapReport} Report with summary, pcaAnalysis, hubPrototypes, coverageGaps, multiAxisConflicts, and recommendations.
   */
  analyze(_prototypes, _outputVectors, _profiles, _pairResults, _onProgress) {
    // Reserved for future enhanced clustering; validates dependency is available
    void this.#prototypeProfileCalculator;

    // Check feature flag
    if (!this.#config.enableAxisGapDetection) {
      this.#logger.debug('AxisGapAnalyzer: Axis gap detection disabled');
      return this.#reportSynthesizer.buildEmptyReport(0);
    }

    // Coerce inputs to safe defaults
    const prototypes = Array.isArray(_prototypes) ? _prototypes : [];
    const profiles =
      _profiles instanceof Map
        ? _profiles
        : _profiles && typeof _profiles === 'object'
          ? new Map(Object.entries(_profiles))
          : new Map();
    const pairResults = Array.isArray(_pairResults) ? _pairResults : [];
    const onProgress =
      typeof _onProgress === 'function' ? _onProgress : () => {};

    // Handle empty prototypes
    if (prototypes.length === 0) {
      this.#logger.debug('AxisGapAnalyzer: No prototypes provided');
      return this.#reportSynthesizer.buildEmptyReport(0);
    }

    // Phase 1: PCA Analysis
    onProgress('pca_analysis', { phase: 1, total: 4 });
    const pcaResult = this.#pcaAnalysisService.analyze(prototypes);
    this.#logger.debug('AxisGapAnalyzer: PCA analysis complete', {
      residualVarianceRatio: pcaResult.residualVarianceRatio,
      additionalComponents: pcaResult.additionalSignificantComponents,
    });

    // Phase 2: Hub Detection
    onProgress('hub_detection', { phase: 2, total: 4 });
    const hubs = this.#hubPrototypeDetector.detect(
      pairResults,
      profiles,
      prototypes
    );
    this.#logger.debug('AxisGapAnalyzer: Hub detection complete', {
      hubCount: hubs.length,
    });

    // Phase 3: Coverage Gap Detection
    onProgress('coverage_gap_detection', { phase: 3, total: 4 });
    const gaps = this.#coverageGapDetector.detect(profiles, prototypes);
    this.#logger.debug('AxisGapAnalyzer: Coverage gap detection complete', {
      gapCount: gaps.length,
    });

    // Phase 4: Multi-Axis Conflict Detection
    onProgress('multi_axis_conflict_detection', { phase: 4, total: 4 });
    const { conflicts, highAxisLoadings, signTensions } =
      this.#multiAxisConflictDetector.detect(prototypes);
    this.#logger.debug(
      'AxisGapAnalyzer: Multi-axis conflict detection complete',
      {
        conflictCount: conflicts.length,
        highAxisLoadingCount: highAxisLoadings.length,
        signTensionCount: signTensions.length,
      }
    );

    // Synthesize final report
    onProgress('synthesizing_report', { phase: 'complete' });
    return this.#reportSynthesizer.synthesize(
      pcaResult,
      hubs,
      gaps,
      conflicts,
      prototypes.length,
      prototypes,
      { highAxisLoadings, signTensions }
    );
  }
}

export default AxisGapAnalyzer;
