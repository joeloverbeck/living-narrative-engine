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
 * - CandidateAxisExtractor: Extract candidate axis directions (optional)
 * - CandidateAxisValidator: Validate candidate axes with metrics (optional)
 * - AxisGapReportSynthesizer: Report synthesis and recommendations
 */
class AxisGapAnalyzer {
  #prototypeProfileCalculator;
  #pcaAnalysisService;
  #hubPrototypeDetector;
  #coverageGapDetector;
  #multiAxisConflictDetector;
  #candidateAxisExtractor;
  #candidateAxisValidator;
  #axisPolarityAnalyzer;
  #prototypeComplexityAnalyzer;
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
   * @param {object} [deps.candidateAxisExtractor] - Optional candidate axis extractor.
   * @param {object} [deps.candidateAxisValidator] - Optional candidate axis validator.
   * @param {object} [deps.axisPolarityAnalyzer] - Optional axis polarity analyzer.
   * @param {object} [deps.prototypeComplexityAnalyzer] - Optional prototype complexity analyzer.
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
    candidateAxisExtractor = null,
    candidateAxisValidator = null,
    axisPolarityAnalyzer = null,
    prototypeComplexityAnalyzer = null,
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

    // Optional dependencies - validate only if provided
    if (candidateAxisExtractor) {
      validateDependency(
        candidateAxisExtractor,
        'ICandidateAxisExtractor',
        logger,
        { requiredMethods: ['extract'] }
      );
    }
    if (candidateAxisValidator) {
      validateDependency(
        candidateAxisValidator,
        'ICandidateAxisValidator',
        logger,
        { requiredMethods: ['validate'] }
      );
    }
    if (axisPolarityAnalyzer) {
      validateDependency(
        axisPolarityAnalyzer,
        'IAxisPolarityAnalyzer',
        logger,
        { requiredMethods: ['analyze'] }
      );
    }
    if (prototypeComplexityAnalyzer) {
      validateDependency(
        prototypeComplexityAnalyzer,
        'IPrototypeComplexityAnalyzer',
        logger,
        { requiredMethods: ['analyze'] }
      );
    }

    if (!config || typeof config !== 'object') {
      throw new Error('AxisGapAnalyzer requires config object');
    }

    this.#prototypeProfileCalculator = prototypeProfileCalculator;
    this.#pcaAnalysisService = pcaAnalysisService;
    this.#hubPrototypeDetector = hubPrototypeDetector;
    this.#coverageGapDetector = coverageGapDetector;
    this.#multiAxisConflictDetector = multiAxisConflictDetector;
    this.#candidateAxisExtractor = candidateAxisExtractor;
    this.#candidateAxisValidator = candidateAxisValidator;
    this.#axisPolarityAnalyzer = axisPolarityAnalyzer;
    this.#prototypeComplexityAnalyzer = prototypeComplexityAnalyzer;
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
   * @returns {AxisGapReport} Report with summary, pcaAnalysis, hubPrototypes, coverageGaps, multiAxisConflicts, candidateAxes, and recommendations.
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

    // Determine total phases based on available services
    const hasValidation =
      this.#config.enableCandidateAxisValidation &&
      this.#candidateAxisExtractor &&
      this.#candidateAxisValidator;
    const hasPolarity = !!this.#axisPolarityAnalyzer;
    const hasComplexity = !!this.#prototypeComplexityAnalyzer;
    const totalPhases =
      4 + (hasPolarity ? 1 : 0) + (hasComplexity ? 1 : 0) + (hasValidation ? 1 : 0);

    // Phase 1: PCA Analysis
    onProgress('pca_analysis', { phase: 1, total: totalPhases });
    const pcaResult = this.#pcaAnalysisService.analyze(prototypes);
    this.#logger.debug('AxisGapAnalyzer: PCA analysis complete', {
      residualVarianceRatio: pcaResult.residualVarianceRatio,
      additionalComponents: pcaResult.additionalSignificantComponents,
    });

    // Run two-pass comparison when sparse axes were excluded
    let pcaComparison = null;
    if (pcaResult.excludedSparseAxes && pcaResult.excludedSparseAxes.length > 0) {
      const comparisonResult = this.#pcaAnalysisService.analyzeWithComparison(prototypes);
      pcaComparison = comparisonResult.comparison;
      this.#logger.debug('AxisGapAnalyzer: Two-pass PCA comparison complete', {
        deltaSignificant: pcaComparison.deltaSignificant,
        deltaResidualVariance: pcaComparison.deltaResidualVariance,
      });
    }

    // Phase 2: Hub Detection
    onProgress('hub_detection', { phase: 2, total: totalPhases });
    const hubResult = this.#hubPrototypeDetector.detect(
      pairResults,
      profiles,
      prototypes
    );
    // Support both old (array) and new ({hubs, diagnostics}) return formats
    const hubs = Array.isArray(hubResult) ? hubResult : hubResult.hubs ?? [];
    const hubDiagnostics = Array.isArray(hubResult)
      ? null
      : hubResult.diagnostics ?? null;
    this.#logger.debug('AxisGapAnalyzer: Hub detection complete', {
      hubCount: hubs.length,
      ...(hubDiagnostics && { hubDiagnostics }),
    });

    // Phase 3: Coverage Gap Detection
    onProgress('coverage_gap_detection', { phase: 3, total: totalPhases });
    const gaps = this.#coverageGapDetector.detect(profiles, prototypes);
    this.#logger.debug('AxisGapAnalyzer: Coverage gap detection complete', {
      gapCount: gaps.length,
    });

    // Phase 4: Multi-Axis Conflict Detection
    onProgress('multi_axis_conflict_detection', { phase: 4, total: totalPhases });
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

    // Phase 5: Axis Polarity Analysis (optional)
    let phaseCounter = 5;
    let polarityAnalysis = null;
    if (hasPolarity) {
      onProgress('polarity_analysis', { phase: phaseCounter, total: totalPhases });
      polarityAnalysis = this.#axisPolarityAnalyzer.analyze(prototypes);
      this.#logger.debug('AxisGapAnalyzer: Polarity analysis complete', {
        totalAxesAnalyzed: polarityAnalysis.totalAxesAnalyzed,
        imbalancedCount: polarityAnalysis.imbalancedCount,
      });
      phaseCounter++;
    }

    // Phase 5/6: Complexity Analysis (optional)
    let complexityAnalysis = null;
    if (hasComplexity) {
      onProgress('complexity_analysis', { phase: phaseCounter, total: totalPhases });
      complexityAnalysis = this.#prototypeComplexityAnalyzer.analyze(prototypes);
      this.#logger.debug('AxisGapAnalyzer: Complexity analysis complete', {
        totalPrototypes: complexityAnalysis.totalPrototypes,
        averageComplexity: complexityAnalysis.averageComplexity,
        bundleCount: complexityAnalysis.coOccurrence?.bundles?.length ?? 0,
      });
      phaseCounter++;
    }

    // Phase 5/6/7: Candidate Axis Validation (optional)
    let candidateAxisValidation = null;
    if (hasValidation) {
      onProgress('candidate_axis_validation', {
        phase: phaseCounter,
        total: totalPhases,
      });
      candidateAxisValidation = this.#runCandidateAxisValidation(
        pcaResult,
        gaps,
        hubs,
        prototypes
      );
      this.#logger.debug('AxisGapAnalyzer: Candidate axis validation complete', {
        candidateCount: candidateAxisValidation?.length ?? 0,
        recommendedCount:
          candidateAxisValidation?.filter((c) => c.isRecommended).length ?? 0,
      });
    }

    // Synthesize final report
    onProgress('synthesizing_report', { phase: 'complete' });
    return this.#reportSynthesizer.synthesize(
      pcaResult,
      hubs,
      gaps,
      conflicts,
      prototypes.length,
      prototypes,
      { highAxisLoadings, signTensions, hubDiagnostics, polarityAnalysis, complexityAnalysis },
      candidateAxisValidation,
      pcaComparison
    );
  }

  /**
   * Run candidate axis extraction and validation.
   *
   * @param {object} pcaResult - PCA analysis result.
   * @param {Array<object>} gaps - Coverage gap results.
   * @param {Array<object>} hubs - Hub prototype results.
   * @param {Array<object>} prototypes - Prototype objects.
   * @returns {Array<object>|null} Validation results or null if disabled.
   */
  #runCandidateAxisValidation(pcaResult, gaps, hubs, prototypes) {
    if (!this.#candidateAxisExtractor || !this.#candidateAxisValidator) {
      return null;
    }

    try {
      // Extract candidate axis directions from analysis signals
      const candidates = this.#candidateAxisExtractor.extract(
        pcaResult,
        gaps,
        hubs,
        prototypes
      );

      if (candidates.length === 0) {
        this.#logger.debug(
          'AxisGapAnalyzer: No candidate axes extracted from signals'
        );
        return [];
      }

      // Collect existing axes from prototypes
      const existingAxes = this.#collectExistingAxes(prototypes);

      // Validate each candidate
      const validationResults = this.#candidateAxisValidator.validate(
        prototypes,
        existingAxes,
        candidates
      );

      return validationResults;
    } catch (err) {
      this.#logger.warn('AxisGapAnalyzer: Candidate axis validation failed', {
        error: err.message,
      });
      return null;
    }
  }

  /**
   * Collect existing axis names from prototypes.
   *
   * @param {Array<object>} prototypes - Prototype objects.
   * @returns {string[]} Array of axis names.
   */
  #collectExistingAxes(prototypes) {
    const axes = new Set();
    for (const prototype of prototypes) {
      const weights = prototype?.weights ?? {};
      for (const axis of Object.keys(weights)) {
        axes.add(axis);
      }
    }
    return Array.from(axes);
  }
}

export default AxisGapAnalyzer;
