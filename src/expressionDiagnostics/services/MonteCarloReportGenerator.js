/**
 * @file MonteCarloReportGenerator - Generates markdown reports from Monte Carlo simulation results
 * @see specs/monte-carlo-report-generator.md
 */

import { getTunableVariableInfo } from '../config/advancedMetricsConfig.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { buildSamplingCoverageConclusions } from './samplingCoverageConclusions.js';
import {
  evaluateConstraint,
  extractMoodConstraints,
  filterContextsByConstraints,
  formatConstraints,
  hasOrMoodConstraints,
} from '../utils/moodRegimeUtils.js';
import GateConstraint from '../models/GateConstraint.js';
import {
  normalizeAffectTraits,
  normalizeMoodAxes,
  normalizeSexualAxes,
  resolveAxisValue,
} from '../utils/axisNormalizationUtils.js';
import { computeIntensitySignals } from '../utils/intensitySignalUtils.js';
import {
  buildPopulationHash,
  buildPopulationPredicate,
} from '../utils/populationHashUtils.js';
import {
  REPORT_INTEGRITY_EPSILON,
  REPORT_INTEGRITY_SAMPLE_LIMIT,
  buildReportIntegrityWarning,
  isNonZero,
} from '../utils/reportIntegrityUtils.js';
import {
  evaluateSweepMonotonicity,
  findBaselineGridPoint,
} from '../utils/sweepIntegrityUtils.js';
import RecommendationFactsBuilder from './RecommendationFactsBuilder.js';
import RecommendationEngine from './RecommendationEngine.js';

/**
 * Generates comprehensive markdown reports from Monte Carlo simulation results.
 * This is a pure data-transformation service with no UI dependencies.
 */
class MonteCarloReportGenerator {
  #logger;
  #prototypeConstraintAnalyzer;
  #prototypeFitRankingService;

  /**
   * @param {object} deps
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger
   * @param {import('./PrototypeConstraintAnalyzer.js').default} [deps.prototypeConstraintAnalyzer] - Optional analyzer for prototype math
   * @param {import('./PrototypeFitRankingService.js').default} [deps.prototypeFitRankingService] - Optional service for prototype fit analysis
   */
  constructor({
    logger,
    prototypeConstraintAnalyzer = null,
    prototypeFitRankingService = null,
  }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
    this.#prototypeFitRankingService = prototypeFitRankingService;
  }

  /**
   * Generate a complete markdown report from simulation results.
   * @param {object} params
   * @param {string} params.expressionName - Name of the expression analyzed
   * @param {object} params.simulationResult - Raw result from MonteCarloSimulator
   * @param {object[]} params.blockers - Analyzed blockers from FailureExplainer
   * @param {string} params.summary - Summary text from FailureExplainer
   * @param {Array} [params.prerequisites] - Optional expression prerequisites for prototype analysis
   * @param {import('./MonteCarloSimulator.js').SensitivityResult[]} [params.sensitivityData] - Optional sensitivity analysis results
   * @param {object} [params.staticAnalysis] - Optional static analysis results for cross-reference
   * @param {object[]} [params.staticAnalysis.gateConflicts] - Gate conflicts from static analysis
   * @param {object[]} [params.staticAnalysis.unreachableThresholds] - Unreachable thresholds from static analysis
   * @returns {string} Markdown report content
   */
  generate({
    expressionName,
    simulationResult,
    blockers,
    summary,
    prerequisites = null,
    sensitivityData = [],
    globalSensitivityData = [],
    staticAnalysis = null,
  }) {
    this.#logger.debug(`Generating report for expression: ${expressionName}`);

    const populationSummary = this.#resolvePopulationSummary(simulationResult);
    const existingWarnings = Array.isArray(simulationResult?.reportIntegrityWarnings)
      ? simulationResult.reportIntegrityWarnings
      : [];

    // Extract axis constraints from prerequisites if analyzer is available
    const axisConstraints = this.#extractAxisConstraints(prerequisites);
    const hasOrMoodConstraintsFlag = hasOrMoodConstraints(prerequisites, {
      includeMoodAlias: true,
    });
    const moodConstraints = extractMoodConstraints(prerequisites, {
      includeMoodAlias: true,
      andOnly: true,
    });
    const storedPopulations = this.#buildStoredContextPopulations(
      simulationResult.storedContexts,
      moodConstraints
    );
    const sweepWarningContext = this.#buildSweepWarningContext({
      blockers,
      globalSensitivityData,
    });
    const reportIntegrityWarnings = this.#collectReportIntegrityWarnings({
      blockers,
      axisConstraints,
      storedContexts: simulationResult.storedContexts,
      moodConstraints,
      storedPopulations,
      simulationResult,
    });
    const sweepIntegrityWarnings = this.#collectSweepIntegrityWarnings({
      sensitivityData,
      globalSensitivityData,
      sweepWarningContext,
    });
    reportIntegrityWarnings.push(...sweepIntegrityWarnings);
    const mergedWarnings = this.#mergeReportIntegrityWarnings(
      existingWarnings,
      reportIntegrityWarnings
    );

    if (simulationResult && typeof simulationResult === 'object') {
      simulationResult.reportIntegrityWarnings = mergedWarnings;
    }

    // Perform prototype fit analysis if service is available
    const prototypeFitAnalysis = this.#performPrototypeFitAnalysis(
      prerequisites,
      simulationResult.storedContexts
    );

    const sections = [
      this.#generateHeader(expressionName, simulationResult),
      this.#generatePopulationSummary(populationSummary),
      this.#generateIntegritySummarySection(mergedWarnings),
      this.#generateSignalLineageSection(),
      this.#generateExecutiveSummary(simulationResult, summary),
      this.#generateSamplingCoverageSection(
        simulationResult.samplingCoverage,
        simulationResult.samplingMode
      ),
      this.#generateWitnessSection(simulationResult),
      this.#generateBlockerAnalysis(
        blockers,
        simulationResult.sampleCount,
        axisConstraints,
        simulationResult.storedContexts,
        populationSummary,
        storedPopulations,
        hasOrMoodConstraintsFlag,
        moodConstraints,
        simulationResult.gateCompatibility,
        simulationResult
      ),
      this.#generateRecommendationsSection({
        expressionName,
        prerequisites,
        simulationResult,
      }),
      this.#generateConditionalPassRatesSection(
        prerequisites,
        blockers,
        simulationResult.storedContexts,
        populationSummary,
        storedPopulations,
        hasOrMoodConstraintsFlag
      ),
      this.#generateLastMileDecompositionSection(
        blockers,
        simulationResult.storedContexts,
        populationSummary,
        storedPopulations
      ),
      this.#generateGlobalSensitivitySection(
        globalSensitivityData,
        populationSummary,
        storedPopulations,
        sweepWarningContext,
        simulationResult?.triggerRate ?? null
      ),
      this.#generateSensitivityAnalysis(
        sensitivityData,
        populationSummary,
        storedPopulations,
        sweepWarningContext
      ),
      // Prototype Fit & Gap Analysis sections
      this.#generatePrototypeFitSection(
        prototypeFitAnalysis?.fitResults,
        populationSummary,
        storedPopulations,
        hasOrMoodConstraintsFlag
      ),
      this.#generateImpliedPrototypeSection(
        prototypeFitAnalysis?.impliedPrototype,
        populationSummary,
        storedPopulations,
        hasOrMoodConstraintsFlag
      ),
      this.#generateGapDetectionSection(
        prototypeFitAnalysis?.gapDetection,
        populationSummary,
        storedPopulations
      ),
      this.#generateStaticCrossReference(staticAnalysis, blockers),
      this.#generateReportIntegrityWarningsSection(mergedWarnings),
      this.#generateLegend(),
    ];

    return sections.join('\n');
  }

  /**
   * Collect report integrity warnings for non-report UI surfaces.
   * @param {object} params
   * @param {object} params.simulationResult
   * @param {object[]} params.blockers
   * @param {Array|null} [params.prerequisites]
   * @param {Array} [params.sensitivityData]
   * @param {Array} [params.globalSensitivityData]
   * @returns {Array<object>}
   */
  collectReportIntegrityWarnings({
    simulationResult,
    blockers,
    prerequisites = null,
    sensitivityData = [],
    globalSensitivityData = [],
  }) {
    if (!simulationResult || !Array.isArray(blockers)) {
      return [];
    }

    const existingWarnings = Array.isArray(simulationResult?.reportIntegrityWarnings)
      ? simulationResult.reportIntegrityWarnings
      : [];
    const axisConstraints = this.#extractAxisConstraints(prerequisites);
    const moodConstraints = extractMoodConstraints(prerequisites, {
      includeMoodAlias: true,
      andOnly: true,
    });
    const storedPopulations = this.#buildStoredContextPopulations(
      simulationResult.storedContexts,
      moodConstraints
    );
    const sweepWarningContext = this.#buildSweepWarningContext({
      blockers,
      globalSensitivityData,
    });

    const reportIntegrityWarnings = this.#collectReportIntegrityWarnings({
      blockers,
      axisConstraints,
      storedContexts: simulationResult.storedContexts,
      moodConstraints,
      storedPopulations,
      simulationResult,
    });
    const sweepIntegrityWarnings = this.#collectSweepIntegrityWarnings({
      sensitivityData,
      globalSensitivityData,
      sweepWarningContext,
    });
    reportIntegrityWarnings.push(...sweepIntegrityWarnings);

    const mergedWarnings = this.#mergeReportIntegrityWarnings(
      existingWarnings,
      reportIntegrityWarnings
    );
    simulationResult.reportIntegrityWarnings = mergedWarnings;
    return mergedWarnings;
  }

  /**
   * Extract axis constraints from expression prerequisites.
   * @private
   * @param {Array|null} prerequisites - Expression prerequisites
   * @returns {Map<string, {min: number, max: number}>|null}
   */
  #extractAxisConstraints(prerequisites) {
    if (!prerequisites || !this.#prototypeConstraintAnalyzer) {
      return null;
    }
    try {
      return this.#prototypeConstraintAnalyzer.extractAxisConstraints(prerequisites);
    } catch (err) {
      this.#logger.warn('Failed to extract axis constraints:', err.message);
      return null;
    }
  }

  /**
   * Normalize population summary fields from simulation results.
   * @private
   * @param {object} simulationResult
   * @returns {object}
   */
  #resolvePopulationSummary(simulationResult) {
    const summary = simulationResult?.populationSummary ?? {};
    const storedContexts = simulationResult?.storedContexts ?? null;
    const sampleCount = summary.sampleCount ?? simulationResult?.sampleCount ?? 0;
    const inRegimeSampleCount =
      summary.inRegimeSampleCount ?? simulationResult?.inRegimeSampleCount ?? 0;
    const storedContextCount =
      summary.storedContextCount ?? (storedContexts ? storedContexts.length : 0);
    const storedContextLimit =
      summary.storedContextLimit ??
      (storedContexts ? storedContexts.length : 0);
    const storedInRegimeCount =
      summary.storedInRegimeCount ??
      (storedContextCount > 0 ? storedContextCount : 0);

    return {
      sampleCount,
      inRegimeSampleCount,
      inRegimeSampleRate:
        summary.inRegimeSampleRate ??
        (sampleCount > 0 ? inRegimeSampleCount / sampleCount : 0),
      storedContextCount,
      storedContextLimit,
      storedInRegimeCount,
      storedInRegimeRate:
        summary.storedInRegimeRate ??
        (storedContextCount > 0 ? storedInRegimeCount / storedContextCount : 0),
    };
  }

  /**
   * Generate a population label for stored-context sections.
   * @private
   * @param {object|null} populationSummary
   * @param {object|null} population
   * @returns {string}
   */
  #formatStoredContextPopulationLabel(populationSummary, population = null) {
    if (population) {
      return this.#formatPopulationHeader(population);
    }

    if (!populationSummary) {
      return '';
    }

    const {
      sampleCount,
      storedContextCount,
      storedContextLimit,
      storedInRegimeCount,
    } = populationSummary;

    if (!Number.isFinite(storedContextCount) || storedContextCount <= 0) {
      return '';
    }

    const totalStr = this.#formatCount(sampleCount);
    const storedStr = this.#formatCount(storedContextCount);
    const limitStr = this.#formatCount(storedContextLimit);
    const inRegimeStr = this.#formatCount(storedInRegimeCount);

    return `**Population**: stored contexts (${storedStr} of ${totalStr}; limit ${limitStr}; in-regime ${inRegimeStr}).\n`;
  }

  /**
   * Build stored-context population objects for report metadata.
   * @private
   * @param {Array<object>|null} storedContexts
   * @param {Array} moodConstraints
   * @returns {{storedGlobal: object, storedMoodRegime: object}|null}
   */
  #buildStoredContextPopulations(storedContexts, moodConstraints) {
    if (!Array.isArray(storedContexts) || storedContexts.length === 0) {
      return null;
    }

    const storedGlobalSampleIds = storedContexts.map((_, index) => index);
    const storedGlobalPredicate = 'all';
    const storedGlobalHash = buildPopulationHash(
      storedGlobalSampleIds,
      storedGlobalPredicate
    );

    const moodPredicate = buildPopulationPredicate(moodConstraints);
    const storedMoodRegimeSampleIds =
      moodConstraints && moodConstraints.length > 0
        ? storedContexts.reduce((acc, context, index) => {
          if (this.#contextMatchesConstraints(context, moodConstraints)) {
            acc.push(index);
          }
          return acc;
        }, [])
        : storedGlobalSampleIds;
    const storedMoodRegimeHash = buildPopulationHash(
      storedMoodRegimeSampleIds,
      moodPredicate
    );

    return {
      storedGlobal: {
        name: 'stored-global',
        predicate: storedGlobalPredicate,
        sampleIds: storedGlobalSampleIds,
        count: storedGlobalSampleIds.length,
        hash: storedGlobalHash,
      },
      storedMoodRegime: {
        name: 'stored-mood-regime',
        predicate: moodPredicate,
        sampleIds: storedMoodRegimeSampleIds,
        count: storedMoodRegimeSampleIds.length,
        hash: storedMoodRegimeHash,
      },
    };
  }

  /**
   * Format a population header.
   * @private
   * @param {object} population
   * @returns {string}
   */
  #formatPopulationHeader(population) {
    if (!population || !Number.isFinite(population.count)) {
      return '';
    }

    const countStr = this.#formatCount(population.count);
    const predicate = population.predicate ?? 'all';
    const hash = population.hash ?? 'unknown';

    return `**Population**: ${population.name} (predicate: ${predicate}; count: ${countStr}; hash: ${hash}).\n`;
  }

  /**
   * Check if a stored context matches mood constraints.
   * @private
   * @param {object} context
   * @param {Array} moodConstraints
   * @returns {boolean}
   */
  #contextMatchesConstraints(context, moodConstraints) {
    if (!Array.isArray(moodConstraints) || moodConstraints.length === 0) {
      return true;
    }

    return moodConstraints.every((constraint) => {
      const value = this.#getNestedValue(context, constraint.varPath);
      return evaluateConstraint(value, constraint.operator, constraint.threshold);
    });
  }

  /**
   * Generate the population summary block near the report header.
   * @private
   * @param {object|null} populationSummary
   * @returns {string}
   */
  #generatePopulationSummary(populationSummary) {
    if (!populationSummary) {
      return '';
    }

    const {
      sampleCount,
      inRegimeSampleCount,
      inRegimeSampleRate,
      storedContextCount,
      storedContextLimit,
      storedInRegimeCount,
      storedInRegimeRate,
    } = populationSummary;

    const totalSampleStr = this.#formatCount(sampleCount);
    const inRegimeSampleStr = this.#formatCount(inRegimeSampleCount);
    const storedStr = this.#formatCount(storedContextCount);
    const storedInRegimeStr = this.#formatCount(storedInRegimeCount);
    const limitStr = this.#formatCount(storedContextLimit);
    const needsLimitNote =
      Number.isFinite(sampleCount) &&
      Number.isFinite(storedContextCount) &&
      Number.isFinite(storedContextLimit) &&
      storedContextLimit > 0 &&
      storedContextCount < sampleCount;

    const limitNote = needsLimitNote
      ? `\n> **Note**: Stored contexts are capped at ${limitStr}, so sections labeled "Population: stored-*" may not match full-sample counts.\n`
      : '';

    return `## Population Summary\n\n- **Total samples**: ${totalSampleStr} (in-regime ${inRegimeSampleStr}; ${this.#formatPercentage(inRegimeSampleRate)})\n- **Stored contexts**: ${storedStr} of ${totalSampleStr} (in-regime ${storedInRegimeStr}; ${this.#formatPercentage(storedInRegimeRate)}; limit ${limitStr})\n- **Mood regime**: AND-only mood constraints from prerequisites (moodAxes.* or mood.*).${limitNote}\n\n---\n`;
  }

  #buildSweepWarningContext({ blockers, globalSensitivityData }) {
    return {
      andOnly: this.#isAndOnlyBlockers(blockers),
      baselineTriggerRate: this.#extractBaselineTriggerRate(globalSensitivityData),
    };
  }

  #extractBaselineTriggerRate(globalSensitivityData) {
    if (!Array.isArray(globalSensitivityData)) {
      return null;
    }

    for (const result of globalSensitivityData) {
      const baselinePoint = findBaselineGridPoint(
        result?.grid,
        result?.originalThreshold
      );
      if (baselinePoint && typeof baselinePoint.triggerRate === 'number') {
        return baselinePoint.triggerRate;
      }
    }

    return null;
  }

  #isAndOnlyBlockers(blockers) {
    if (!Array.isArray(blockers) || blockers.length === 0) {
      return false;
    }

    let sawTree = false;
    for (const blocker of blockers) {
      const tree = blocker?.hierarchicalBreakdown;
      if (!tree) {
        return false;
      }
      sawTree = true;
      if (!this.#isAndOnlyBreakdown(tree)) {
        return false;
      }
    }

    return sawTree;
  }

  #isAndOnlyBreakdown(node) {
    if (!node || typeof node !== 'object') {
      return false;
    }

    if (node.nodeType === 'or') {
      return false;
    }

    if (node.nodeType === 'and') {
      const children = Array.isArray(node.children) ? node.children : [];
      return children.every((child) => this.#isAndOnlyBreakdown(child));
    }

    if (node.nodeType === 'leaf') {
      return true;
    }

    return false;
  }

  #collectSweepIntegrityWarnings({
    sensitivityData,
    globalSensitivityData,
    sweepWarningContext,
  }) {
    const warnings = [];
    const andOnly = sweepWarningContext?.andOnly === true;
    const baselineTriggerRate =
      typeof sweepWarningContext?.baselineTriggerRate === 'number'
        ? sweepWarningContext.baselineTriggerRate
        : null;

    for (const result of sensitivityData ?? []) {
      warnings.push(
        ...this.#buildSweepWarningsForResult(result, {
          rateKey: 'passRate',
          scope: 'marginal',
          andOnly,
          baselineTriggerRate,
        })
      );
    }

    for (const result of globalSensitivityData ?? []) {
      warnings.push(
        ...this.#buildSweepWarningsForResult(result, {
          rateKey: 'triggerRate',
          scope: 'expression',
          andOnly,
          baselineTriggerRate,
        })
      );
    }

    return warnings;
  }

  #buildSweepWarningsForResult(
    result,
    { rateKey, scope, andOnly, baselineTriggerRate }
  ) {
    const warnings = [];
    if (!result || !Array.isArray(result.grid)) {
      return warnings;
    }

    const operator = result?.operator;
    const conditionLabel = result?.conditionPath ?? result?.varPath ?? 'unknown';
    const populationHash = result?.populationHash ?? null;

    const monotonicity = evaluateSweepMonotonicity({
      grid: result.grid,
      rateKey,
      operator,
    });

    if (!monotonicity.isMonotonic && monotonicity.direction) {
      const directionLabel =
        monotonicity.direction === 'nonincreasing'
          ? 'non-increasing'
          : 'non-decreasing';
      warnings.push(
        buildReportIntegrityWarning({
          code: 'S4_SWEEP_NON_MONOTONIC',
          message: `Sweep for ${conditionLabel} is not ${directionLabel} as ${operator} thresholds change.`,
          populationHash,
          signal: conditionLabel,
          details: {
            operator,
            rateKey,
            direction: monotonicity.direction,
            violations: monotonicity.violations,
          },
        })
      );
    }

    if (scope === 'marginal' && andOnly && typeof baselineTriggerRate === 'number') {
      const baselinePoint = findBaselineGridPoint(
        result.grid,
        result.originalThreshold
      );
      const baselinePassRate = baselinePoint?.passRate;

      if (
        typeof baselinePassRate === 'number' &&
        baselineTriggerRate > baselinePassRate + REPORT_INTEGRITY_EPSILON
      ) {
        warnings.push(
          buildReportIntegrityWarning({
            code: 'S1_TRIGGER_EXCEEDS_CLAUSE_PASS',
            message: `Stored-context trigger rate (${this.#formatPercentage(
              baselineTriggerRate
            )}) exceeds clause pass rate (${this.#formatPercentage(
              baselinePassRate
            )}) for ${conditionLabel}.`,
            populationHash,
            signal: conditionLabel,
            details: {
              operator,
              baselineTriggerRate,
              baselinePassRate,
            },
          })
        );
      }
    }

    return warnings;
  }

  #formatSweepWarningsInline(warnings) {
    if (!Array.isArray(warnings) || warnings.length === 0) {
      return '';
    }

    const lines = warnings.map((warning) => `> ⚠️ ${warning.message}`);
    return `${lines.join('\n')}\n\n`;
  }

  #mergeReportIntegrityWarnings(existing, incoming) {
    const merged = [];
    const seen = new Set();
    const combined = [...(existing ?? []), ...(incoming ?? [])].filter(Boolean);

    for (const warning of combined) {
      const key = [
        warning.code ?? '',
        warning.prototypeId ?? '',
        warning.populationHash ?? '',
        warning.signal ?? '',
        warning.message ?? '',
      ].join('|');
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(warning);
    }

    return merged;
  }

  /**
   * Collect report integrity warnings based on stored context data.
   * @private
   * @param {object} params
   * @returns {Array<object>}
   */
  #collectReportIntegrityWarnings({
    blockers,
    axisConstraints,
    storedContexts,
    moodConstraints,
    storedPopulations,
    simulationResult,
  }) {
    const warnings = [];

    if (!Array.isArray(storedContexts) || storedContexts.length === 0) {
      return warnings;
    }

    const populationMeta = simulationResult?.populationMeta ?? null;
    const reportMoodHash = storedPopulations?.storedMoodRegime?.hash ?? null;
    const metaMoodHash = populationMeta?.storedMoodRegime?.hash ?? null;

    if (reportMoodHash && metaMoodHash && reportMoodHash !== metaMoodHash) {
      warnings.push(
        buildReportIntegrityWarning({
          code: 'I5_MOOD_REGIME_HASH_MISMATCH',
          message:
            'Mood-regime population hash differs between report and simulation metadata.',
          populationHash: reportMoodHash,
          details: {
            reportHash: reportMoodHash,
            simulationHash: metaMoodHash,
          },
        })
      );
    }

    if (
      !blockers ||
      blockers.length === 0 ||
      !axisConstraints ||
      !this.#prototypeConstraintAnalyzer
    ) {
      return warnings;
    }

    const emotionConditions = blockers.flatMap((blocker) =>
      this.#extractEmotionConditions(blocker)
    );

    if (emotionConditions.length === 0) {
      return warnings;
    }

    const analysisEntries = [];
    const seenKeys = new Set();

    for (const condition of emotionConditions) {
      const analysis = this.#analyzeEmotionCondition(condition, axisConstraints);
      if (!analysis) {
        continue;
      }
      const operator = condition.operator ?? analysis.operator ?? '>=';
      const key = `${analysis.type}:${analysis.prototypeId}:${operator}:${analysis.threshold}`;
      if (seenKeys.has(key)) {
        continue;
      }
      seenKeys.add(key);
      analysisEntries.push({ analysis, operator });
    }

    const storedGlobalSampleIds =
      storedPopulations?.storedGlobal?.sampleIds ??
      storedContexts.map((_, index) => index);
    const storedMoodSampleIds =
      storedPopulations?.storedMoodRegime?.sampleIds ??
      (Array.isArray(moodConstraints) && moodConstraints.length > 0
        ? storedContexts.reduce((acc, context, index) => {
          if (this.#contextMatchesConstraints(context, moodConstraints)) {
            acc.push(index);
          }
          return acc;
        }, [])
        : storedGlobalSampleIds);

    const populations = [
      {
        name: 'stored-global',
        hash:
          storedPopulations?.storedGlobal?.hash ??
          populationMeta?.storedGlobal?.hash ??
          null,
        sampleIds: storedGlobalSampleIds,
      },
      {
        name: 'stored-mood-regime',
        hash:
          storedPopulations?.storedMoodRegime?.hash ??
          populationMeta?.storedMoodRegime?.hash ??
          null,
        sampleIds: storedMoodSampleIds,
      },
    ];

    for (const entry of analysisEntries) {
      const { analysis, operator } = entry;
      const {
        prototypeId,
        type,
        gates,
        threshold,
        maxAchievable,
      } = analysis;
      const path = this.#getPrototypeContextPath(type, prototypeId);

      if (!path) {
        continue;
      }

      const parsedGates = (gates ?? [])
        .map((gateStr) => {
          try {
            return GateConstraint.parse(gateStr);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const checkThreshold =
        typeof threshold === 'number' &&
        threshold > 0 &&
        (operator === '>=' || operator === '>');

      for (const population of populations) {
        const sampleIds = population.sampleIds ?? [];
        const total = sampleIds.length;
        if (total === 0) {
          continue;
        }

        let gatePassCount = 0;
        let passThresholdCount = 0;
        let gateFailNonZeroCount = 0;
        const finalValues = [];
        const gateFailNonZeroSampleIndices = [];
        const passThresholdGateFailSampleIndices = [];
        const nonZeroFinalSampleIndices = [];
        const observedExceedsTheoreticalSampleIndices = [];
        const addSampleIndex = (list, sampleId) => {
          if (list.length < REPORT_INTEGRITY_SAMPLE_LIMIT) {
            list.push(sampleId);
          }
        };

        for (const sampleId of sampleIds) {
          const context = storedContexts[sampleId];
          if (!context) {
            continue;
          }
          const traceSignals = this.#getGateTraceSignals(
            context,
            type,
            prototypeId
          );
          let gatePass = traceSignals ? Boolean(traceSignals.gatePass) : true;

          if (!traceSignals && parsedGates.length > 0) {
            const normalized = this.#normalizeContextAxes(context);
            for (const constraint of parsedGates) {
              const axisValue = resolveAxisValue(
                constraint.axis,
                normalized.moodAxes,
                normalized.sexualAxes,
                normalized.traitAxes
              );

              if (!constraint.isSatisfiedBy(axisValue)) {
                gatePass = false;
                break;
              }
            }
          }

          if (gatePass) {
            gatePassCount++;
          }

          const finalValue = this.#getNestedValue(context, path);
          if (typeof finalValue === 'number') {
            finalValues.push(finalValue);

            if (!gatePass && isNonZero(finalValue)) {
              gateFailNonZeroCount++;
              addSampleIndex(gateFailNonZeroSampleIndices, sampleId);
            }

            if (isNonZero(finalValue)) {
              addSampleIndex(nonZeroFinalSampleIndices, sampleId);
            }

            if (checkThreshold && finalValue >= threshold) {
              passThresholdCount++;
              if (!gatePass) {
                addSampleIndex(passThresholdGateFailSampleIndices, sampleId);
              }
            }

            if (
              population.name === 'stored-mood-regime' &&
              typeof maxAchievable === 'number' &&
              finalValue > maxAchievable + REPORT_INTEGRITY_EPSILON
            ) {
              addSampleIndex(observedExceedsTheoreticalSampleIndices, sampleId);
            }
          }
        }

        const gatePassRate = total > 0 ? gatePassCount / total : null;
        const passRate =
          checkThreshold && total > 0 ? passThresholdCount / total : null;
        const distribution =
          finalValues.length > 0
            ? this.#computeDistributionStats(finalValues)
            : null;

        if (gateFailNonZeroCount > 0) {
          warnings.push(
            buildReportIntegrityWarning({
              code: 'I1_GATE_FAILED_NONZERO_FINAL',
              message:
                'Gate failed but final intensity is non-zero in stored contexts.',
              populationHash: population.hash,
              signal: 'final',
              prototypeId,
              details: {
                population: population.name,
                gateFailNonZeroCount,
                total,
                sampleIndices: gateFailNonZeroSampleIndices,
              },
            })
          );
        }

        if (
          checkThreshold &&
          typeof gatePassRate === 'number' &&
          typeof passRate === 'number' &&
          passRate > gatePassRate + REPORT_INTEGRITY_EPSILON
        ) {
          warnings.push(
            buildReportIntegrityWarning({
              code: 'I2_PASSRATE_EXCEEDS_GATEPASS',
              message:
                'Pass rate for final >= threshold exceeds gate pass rate.',
              populationHash: population.hash,
              signal: 'final',
              prototypeId,
              details: {
                population: population.name,
                threshold,
                passRate,
                gatePassRate,
                sampleIndices: passThresholdGateFailSampleIndices,
              },
            })
          );
        }

        if (
          typeof gatePassRate === 'number' &&
          gatePassRate <= REPORT_INTEGRITY_EPSILON &&
          distribution &&
          (isNonZero(distribution.p90) ||
            isNonZero(distribution.p95) ||
            isNonZero(distribution.max))
        ) {
          warnings.push(
            buildReportIntegrityWarning({
              code: 'I3_GATEPASS_ZERO_NONZERO_FINAL',
              message:
                'Gate pass rate is zero but final distribution has non-zero percentiles.',
              populationHash: population.hash,
              signal: 'final',
              prototypeId,
              details: {
                population: population.name,
                p90: distribution.p90,
                p95: distribution.p95,
                max: distribution.max,
                sampleIndices: nonZeroFinalSampleIndices,
              },
            })
          );
        }

        if (
          population.name === 'stored-mood-regime' &&
          typeof maxAchievable === 'number' &&
          distribution &&
          distribution.max > maxAchievable + REPORT_INTEGRITY_EPSILON
        ) {
          warnings.push(
            buildReportIntegrityWarning({
              code: 'I4_OBSERVED_EXCEEDS_THEORETICAL',
              message:
                'Observed max final exceeds theoretical max for mood-regime population.',
              populationHash: population.hash,
              signal: 'final',
              prototypeId,
              details: {
                population: population.name,
                observedMax: distribution.max,
                theoreticalMax: maxAchievable,
                sampleIndices: observedExceedsTheoreticalSampleIndices,
              },
            })
          );
        }
      }
    }

    return warnings;
  }

  /**
   * Render the report integrity warnings section.
   * @private
   * @param {Array<object>} warnings
   * @returns {string}
   */
  #generateReportIntegrityWarningsSection(warnings) {
    if (!Array.isArray(warnings) || warnings.length === 0) {
      return '';
    }

    const lines = warnings.map((warning) => {
      const meta = [];
      if (warning.populationHash) {
        meta.push(`population=${warning.populationHash}`);
      }
      if (warning.prototypeId) {
        meta.push(`prototype=${warning.prototypeId}`);
      }
      if (warning.signal) {
        meta.push(`signal=${warning.signal}`);
      }

      const metaStr = meta.length > 0 ? ` [${meta.join('; ')}]` : '';
      const sampleIndices = warning?.details?.sampleIndices;
      const examples =
        Array.isArray(sampleIndices) && sampleIndices.length > 0
          ? ` examples: index ${sampleIndices.join(', ')}`
          : '';
      return `- ${warning.code}: ${warning.message}${metaStr}${examples}`;
    });

    const hasGateMismatchWarning = warnings.some((warning) =>
      typeof warning?.code === 'string' && warning.code.startsWith('I')
    );
    const impactNote = hasGateMismatchWarning
      ? '\n\n> **Impact (full sample)**: Gate/final mismatches can invalidate pass-rate and blocker metrics; treat threshold feasibility as provisional until resolved.\n'
      : '\n';
    return `## Report Integrity Warnings\n${lines.join('\n')}${impactNote}`;
  }

  /**
   * Format integer counts for display.
   * @private
   * @param {number} value
   * @returns {string}
   */
  #formatCount(value) {
    if (!Number.isFinite(value)) {
      return 'N/A';
    }
    return value.toLocaleString();
  }

  // ============================================================================
  // CLAIM 5: Conditional Pass Rates Under Mood Regime
  // ============================================================================


  /**
   * Format a warning for OR mood constraints in AND-only analyses.
   * @private
   * @returns {string}
   */
  #formatOrMoodConstraintWarning() {
    return '> ⚠️ This analysis treats mood-axis constraints as AND-only. OR-based mood constraints are present, so results are conservative (may be overly strict).\n\n';
  }

  /**
   * Extract emotion/sexual conditions from prerequisites (not from blockers).
   * These are the conditions we'll compute conditional pass rates for.
   * @private
   * @param {Array} prerequisites - Expression prerequisites
   * @returns {Array<{varPath: string, operator: string, threshold: number, display: string}>}
   */
  #extractEmotionConditionsFromPrereqs(prerequisites) {
    const conditions = [];
    if (!prerequisites || !Array.isArray(prerequisites)) {
      return conditions;
    }

    for (const prereq of prerequisites) {
      this.#extractEmotionConditionsFromLogic(prereq.logic, conditions);
    }

    // Deduplicate by varPath + operator + threshold
    const seen = new Set();
    return conditions.filter((c) => {
      const key = `${c.varPath}:${c.operator}:${c.threshold}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Recursively extract emotion/sexual conditions from JSON Logic.
   * @private
   * @param {object} logic - JSON Logic expression
   * @param {Array} conditions - Array to accumulate conditions
   */
  #extractEmotionConditionsFromLogic(logic, conditions) {
    if (!logic || typeof logic !== 'object') return;

    // Check comparison operators
    const operators = ['>=', '<=', '>', '<'];
    for (const op of operators) {
      if (logic[op]) {
        const [left, right] = logic[op];
        if (typeof left === 'object' && left.var && typeof right === 'number') {
          const varPath = left.var;
          // Only emotion or sexual state conditions
          if (varPath.startsWith('emotions.') || varPath.startsWith('sexualStates.')) {
            conditions.push({
              varPath,
              operator: op,
              threshold: right,
              display: `${varPath} ${op} ${right}`,
            });
          }
        }
      }
    }

    // Recurse into AND and OR blocks
    if (logic.and && Array.isArray(logic.and)) {
      for (const clause of logic.and) {
        this.#extractEmotionConditionsFromLogic(clause, conditions);
      }
    }
    if (logic.or && Array.isArray(logic.or)) {
      for (const clause of logic.or) {
        this.#extractEmotionConditionsFromLogic(clause, conditions);
      }
    }
  }

  /**
   * Get a nested value from an object using a dot-separated path.
   * @private
   * @param {object} obj - Object to traverse
   * @param {string} path - Dot-separated path (e.g., 'moodAxes.valence')
   * @returns {*} The value at the path, or undefined
   */
  #getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Evaluate a comparison operation.
   * @private
   * @param {number} value - The actual value
   * @param {string} operator - Comparison operator
   * @param {number} threshold - Threshold value
   * @returns {boolean}
   */
  #evaluateComparison(value, operator, threshold) {
    return evaluateConstraint(value, operator, threshold);
  }

  /**
   * Filter contexts where all mood constraints pass.
   * @private
   * @param {Array} storedContexts - Stored simulation contexts
   * @param {Array} moodConstraints - Mood constraints to filter by
   * @returns {Array} Contexts where all mood constraints pass
   */
  #filterContextsByMoodConstraints(storedContexts, moodConstraints) {
    return filterContextsByConstraints(storedContexts, moodConstraints);
  }

  /**
   * Calculate Wilson score confidence interval.
   * @private
   * @param {number} successes - Number of successes
   * @param {number} total - Total trials
   * @param {number} z - Z-score (default 1.96 for 95% CI)
   * @returns {{low: number, high: number}}
   */
  #calculateWilsonInterval(successes, total, z = 1.96) {
    if (total === 0) return { low: 0, high: 1 };

    const p = successes / total;
    const denominator = 1 + (z * z) / total;
    const center = p + (z * z) / (2 * total);
    const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);

    return {
      low: Math.max(0, (center - spread) / denominator),
      high: Math.min(1, (center + spread) / denominator),
    };
  }

  /**
   * Compute conditional pass rates for emotion conditions given mood constraints pass.
   * @private
   * @param {Array} filteredContexts - Contexts where mood constraints pass
   * @param {Array} emotionConditions - Emotion conditions to evaluate
   * @returns {Array<{condition: string, conditionalPassRate: number, passes: number, total: number, ci: {low: number, high: number}}>}
   */
  #computeConditionalPassRates(filteredContexts, emotionConditions) {
    const results = [];
    const total = filteredContexts.length;

    for (const condition of emotionConditions) {
      const passes = filteredContexts.filter((ctx) => {
        const value = this.#getNestedValue(ctx, condition.varPath);
        return this.#evaluateComparison(value, condition.operator, condition.threshold);
      }).length;

      const rate = total > 0 ? passes / total : 0;
      const ci = this.#calculateWilsonInterval(passes, total);

      results.push({
        condition: condition.display,
        conditionalPassRate: rate,
        passes,
        total,
        ci,
      });
    }

    // Sort by conditional pass rate ascending (lowest first - hardest to pass)
    results.sort((a, b) => a.conditionalPassRate - b.conditionalPassRate);

    return results;
  }

  /**
   * Generate the Conditional Pass Rates section.
   * Shows P(emotion_condition | mood_constraints_pass).
   * @private
   * @param {Array} prerequisites - Expression prerequisites
   * @param {Array} blockers - Analyzed blockers
   * @param {Array} storedContexts - Stored simulation contexts
   * @returns {string} Markdown section
   */
  #generateConditionalPassRatesSection(
    prerequisites,
    blockers,
    storedContexts,
    populationSummary,
    storedPopulations,
    hasOrMoodConstraints = false
  ) {
    if (!prerequisites || !storedContexts || storedContexts.length === 0) {
      return '';
    }

    // Extract mood constraints and emotion conditions
    const moodConstraints = extractMoodConstraints(prerequisites, {
      includeMoodAlias: true,
      andOnly: true,
    });
    const emotionConditions = this.#extractEmotionConditionsFromPrereqs(prerequisites);

    // Need both mood constraints and emotion conditions for this analysis to be meaningful
    if (moodConstraints.length === 0 || emotionConditions.length === 0) {
      return '';
    }

    // Filter contexts by mood constraints
    const filteredContexts = this.#filterContextsByMoodConstraints(
      storedContexts,
      moodConstraints
    );

    // If very few contexts pass mood constraints, this analysis isn't reliable
    const orConstraintWarning = hasOrMoodConstraints
      ? this.#formatOrMoodConstraintWarning()
      : '';
    const populationLabel =
      this.#formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedMoodRegime ?? null
      );

    if (filteredContexts.length < 10) {
      return `## Conditional Pass Rates

${orConstraintWarning}${populationLabel}**Note**: Only ${filteredContexts.length} out of ${storedContexts.length} samples passed all mood constraints.
Conditional analysis requires more samples for reliable estimates.

---
`;
    }

    // Compute conditional pass rates
    const passRates = this.#computeConditionalPassRates(filteredContexts, emotionConditions);

    // Format mood constraints for display
    const moodConstraintsList = formatConstraints(moodConstraints);

    // Build the table
    const tableHeader = '| Condition | P(pass \\| mood) | Passes | CI (95%) |';
    const tableDivider = '|-----------|-----------------|--------|----------|';
    const tableRows = passRates.map((r) => {
      const rateStr = this.#formatPercentage(r.conditionalPassRate);
      const passesStr = `${r.passes}/${r.total}`;
      const ciStr = `[${this.#formatPercentage(r.ci.low)}, ${this.#formatPercentage(r.ci.high)}]`;
      return `| \`${r.condition}\` | ${rateStr} | ${passesStr} | ${ciStr} |`;
    });

    return `## Conditional Pass Rates (Given Mood Constraints Satisfied)

${orConstraintWarning}${populationLabel}**Mood regime filter**: ${filteredContexts.length} contexts where all mood constraints pass
- Constraints: ${moodConstraintsList}

${tableHeader}
${tableDivider}
${tableRows.join('\n')}

**Interpretation**: These rates show how often each emotion condition passes
when the mood state is already suitable. Low rates indicate emotion-specific
blockers that persist even in favorable mood regimes.

---
`;
  }

  // ============================================================================
  // CLAIM 6: Last-Mile Decomposition for Decisive Blockers
  // ============================================================================

  /**
   * Find last-mile contexts for a specific blocker.
   * Last-mile contexts are those where all OTHER clauses pass except the target.
   * @private
   * @param {object} blocker - The blocker to find last-mile contexts for
   * @param {Array} storedContexts - Stored simulation contexts
   * @param {Array} allBlockers - All blockers (to check sibling clause pass/fail)
   * @returns {Array} Contexts where only this blocker fails
   */
  #findLastMileContextsForBlocker(blocker, storedContexts, allBlockers) {
    if (!storedContexts || storedContexts.length === 0) return [];

    const hb = blocker.hierarchicalBreakdown ?? {};

    // Get the leaf conditions from this blocker
    const leaves = hb.isCompound ? this.#flattenLeaves(hb) : [hb];
    if (leaves.length === 0) return [];

    // For compound blockers, we look at contexts where THIS blocker fails
    // but all OTHER blockers pass. This uses the pre-computed lastMileFailRate.
    const lastMileData = blocker.advancedAnalysis?.lastMileAnalysis ?? {};
    if (!lastMileData.lastMileFailRate || lastMileData.lastMileFailRate === 0) {
      return [];
    }

    // Find contexts matching last-mile criteria
    // A last-mile context is one where this condition fails but siblings pass
    // We need to evaluate the specific condition against each context
    const targetVarPath = hb.variablePath;
    const targetOperator = hb.comparisonOperator;
    const targetThreshold = hb.thresholdValue;

    if (!targetVarPath || targetOperator === undefined) {
      // Can't evaluate compound nodes directly - would need full prerequisite evaluation
      return [];
    }

    // Filter to contexts where this specific condition fails
    return storedContexts.filter((ctx) => {
      const value = this.#getNestedValue(ctx, targetVarPath);
      // This condition must FAIL (return false means it fails the check)
      return !this.#evaluateComparison(value, targetOperator, targetThreshold);
    });
  }

  /**
   * Compute distribution statistics for a set of values.
   * @private
   * @param {Array<number>} values - Array of numeric values
   * @returns {{min: number, median: number, p90: number, max: number, mean: number, count: number}|null}
   */
  #computeDistributionStats(values) {
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const p90Index = Math.min(n - 1, Math.floor(n * 0.9));
    const p95Index = Math.min(n - 1, Math.floor(n * 0.95));

    return {
      min: sorted[0],
      median: sorted[Math.floor(n / 2)],
      p90: sorted[p90Index],
      p95: sorted[p95Index],
      max: sorted[n - 1],
      mean: values.reduce((a, b) => a + b, 0) / n,
      count: n,
    };
  }

  /**
   * Get prototype weights for an emotion or sexual state.
   * @private
   * @param {string} prototypeId - Prototype ID
   * @param {'emotion'|'sexual'} [type='emotion'] - Prototype type
   * @returns {object|null} Weights object or null
   */
  #getPrototypeWeights(prototypeId, type = 'emotion') {
    if (!this.#prototypeConstraintAnalyzer) return null;

    try {
      const analysis = this.#prototypeConstraintAnalyzer.analyzeEmotionThreshold(
        prototypeId,
        type,
        0.5, // Threshold doesn't matter for weight extraction
        null
      );
      return analysis?.weights ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Normalize an axis value to the appropriate range.
   * Mood axes: [-100, 100] → [-1, 1]
   * Sexual axes: Already in [0, 1]
   * @private
   * @param {string} axis - Axis name
   * @param {number} value - Raw axis value
   * @returns {number} Normalized value
   */
  #normalizeAxisValue(axis, value) {
    // Sexual axes are already normalized
    const sexualAxes = ['sex_excitation', 'sex_inhibition', 'baseline_libido', 'sexual_arousal'];
    if (sexualAxes.includes(axis)) {
      return value;
    }

    // Mood axes need normalization from [-100, 100] to [-1, 1]
    return value / 100;
  }

  /**
   * Compute per-axis contributions to an emotion or sexual state value.
   * @private
   * @param {Array} contexts - Last-mile contexts
   * @param {object} weights - Prototype weights
   * @returns {object} Axis contributions with mean contribution and mean value
   */
  #computeAxisContributions(contexts, weights) {
    const contributions = {};

    // Sexual axes that are stored in sexualStates rather than moodAxes
    const sexualAxes = ['sex_excitation', 'sex_inhibition', 'baseline_libido', 'sexual_arousal', 'sexual_inhibition'];

    for (const [axis, weight] of Object.entries(weights)) {
      const axisContribs = contexts.map((ctx) => {
        // Get axis value from appropriate source
        const isSexualAxis = sexualAxes.includes(axis);
        const sourcePath = isSexualAxis ? `sexualStates.${axis}` : `moodAxes.${axis}`;
        const axisValue = this.#getNestedValue(ctx, sourcePath) ?? 0;
        const normalizedValue = this.#normalizeAxisValue(axis, axisValue);
        return normalizedValue * weight;
      });

      const meanAxisValues = contexts.map((ctx) => {
        const isSexualAxis = sexualAxes.includes(axis);
        const sourcePath = isSexualAxis ? `sexualStates.${axis}` : `moodAxes.${axis}`;
        return this.#getNestedValue(ctx, sourcePath) ?? 0;
      });

      contributions[axis] = {
        weight,
        meanContribution: axisContribs.reduce((a, b) => a + b, 0) / axisContribs.length,
        meanAxisValue: meanAxisValues.reduce((a, b) => a + b, 0) / meanAxisValues.length,
      };
    }

    return contributions;
  }

  /**
   * Find the dominant suppressor axis (most negative contribution).
   * @private
   * @param {object} axisContributions - Per-axis contributions
   * @returns {{axis: string|null, contribution: number}}
   */
  #findDominantSuppressor(axisContributions) {
    let minContribution = 0;
    let dominantAxis = null;

    for (const [axis, data] of Object.entries(axisContributions)) {
      if (data.meanContribution < minContribution) {
        minContribution = data.meanContribution;
        dominantAxis = axis;
      }
    }

    return { axis: dominantAxis, contribution: minContribution };
  }

  /**
   * Generate the Last-Mile Decomposition section for decisive blockers.
   * @private
   * @param {Array} blockers - Analyzed blockers
   * @param {Array} storedContexts - Stored simulation contexts
   * @returns {string} Markdown section
   */
  #generateLastMileDecompositionSection(
    blockers,
    storedContexts,
    populationSummary,
    storedPopulations
  ) {
    if (!blockers || blockers.length === 0 || !storedContexts || storedContexts.length === 0) {
      return '';
    }

    const populationLabel =
      this.#formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedGlobal ?? null
      );
    const sections = [];

    for (const blocker of blockers) {
      const hb = blocker.hierarchicalBreakdown ?? {};
      const adv = blocker.advancedAnalysis ?? {};
      const lastMileData = adv.lastMileAnalysis ?? {};

      // Only analyze decisive blockers (high last-mile failure rate)
      const lastMileFailRate = lastMileData.lastMileFailRate ?? 0;
      if (lastMileFailRate < 0.1) continue; // Only blockers with >10% last-mile rate

      // Match both emotion and sexual state conditions where we can get prototype weights
      const varPath = hb.variablePath ?? '';
      const tunableInfo = getTunableVariableInfo(varPath);
      if (!tunableInfo) continue;
      if (tunableInfo.domain !== 'emotions' && tunableInfo.domain !== 'sexualStates') {
        continue;
      }

      const prototypeId = tunableInfo.name;
      const prototypeType = tunableInfo.domain === 'emotions' ? 'emotion' : 'sexual';
      const contextKey = tunableInfo.domain === 'emotions' ? 'emotions' : 'sexualStates';
      const threshold = hb.thresholdValue;

      // Get prototype weights
      const weights = this.#getPrototypeWeights(prototypeId, prototypeType);
      if (!weights || Object.keys(weights).length === 0) continue;

      // Find last-mile contexts for this blocker
      const lastMileContexts = this.#findLastMileContextsForBlocker(blocker, storedContexts, blockers);
      if (lastMileContexts.length < 5) continue; // Need enough samples

      // Compute prototype value distribution in last-mile contexts
      const prototypeValues = lastMileContexts.map((ctx) => {
        return this.#getNestedValue(ctx, `${contextKey}.${prototypeId}`) ?? 0;
      });
      const distribution = this.#computeDistributionStats(prototypeValues);
      if (!distribution) continue;

      // Compute per-axis contributions
      const contributions = this.#computeAxisContributions(lastMileContexts, weights);

      // Find dominant suppressor
      const suppressor = this.#findDominantSuppressor(contributions);

      // Format the section
      const sectionTitle = `### Last-Mile Decomposition: \`${varPath}\``;

      // Distribution table
      const distTable = `| Statistic | Value |
|-----------|-------|
| Min | ${this.#formatNumber(distribution.min)} |
| Median | ${this.#formatNumber(distribution.median)} |
| P90 | ${this.#formatNumber(distribution.p90)} |
| Max | ${this.#formatNumber(distribution.max)} |
| Mean | ${this.#formatNumber(distribution.mean)} |`;

      // Axis contributions table
      const contribHeader = '| Axis | Weight | Mean Value | Mean Contribution |';
      const contribDivider = '|------|--------|------------|-------------------|';
      const contribRows = Object.entries(contributions)
        .sort(([, a], [, b]) => b.meanContribution - a.meanContribution)
        .map(([axis, data]) => {
          const weightStr = data.weight >= 0 ? `+${this.#formatNumber(data.weight)}` : this.#formatNumber(data.weight);
          const contribStr = data.meanContribution >= 0
            ? `+${this.#formatNumber(data.meanContribution)}`
            : this.#formatNumber(data.meanContribution);
          return `| ${axis} | ${weightStr} | ${this.#formatNumber(data.meanAxisValue)} | ${contribStr} |`;
        });

      // Suppressor insight
      const prototypeLabel = prototypeType === 'emotion' ? 'emotion' : 'sexual state';
      let suppressorInsight = '';
      if (suppressor.axis) {
        const axisData = contributions[suppressor.axis];
        const direction = axisData.weight < 0 ? 'high positive' : 'low negative';
        suppressorInsight = `**🔻 Dominant Suppressor**: \`${suppressor.axis}\` (mean contribution: ${this.#formatNumber(suppressor.contribution)})
- ${direction.charAt(0).toUpperCase() + direction.slice(1)} ${suppressor.axis} values are suppressing ${prototypeId} intensity
- To trigger this expression, ${suppressor.axis} would need to ${axisData.weight < 0 ? 'decrease' : 'increase'}`;
      }

      // Interpretation
      const gapToThreshold = threshold - distribution.mean;
      const interpretation = `**Interpretation**: The ${prototypeLabel} averages ${this.#formatNumber(distribution.mean)} but needs ≥${threshold} to pass.
The gap of ${this.#formatNumber(gapToThreshold)} is ${gapToThreshold > 0.2 ? 'substantial' : 'small'}.
${suppressor.axis ? `The ${suppressor.axis} axis is the primary blocker.` : 'No single axis dominates the suppression.'}`;

      // Format section header based on prototype type
      const distributionTitle = prototypeType === 'emotion' ? 'Emotion Value Distribution' : 'Sexual State Value Distribution';

      sections.push(`${sectionTitle}

**${lastMileContexts.length} states** where all conditions pass except \`${varPath} >= ${threshold}\`

#### ${distributionTitle}
${distTable}

#### Per-Axis Contributions to ${varPath}
${contribHeader}
${contribDivider}
${contribRows.join('\n')}

${suppressorInsight}

${interpretation}

---`);
    }

    if (sections.length === 0) {
      return '';
    }

    return `## Last-Mile Decomposition

Analysis of decisive blockers: what's preventing these emotions from reaching their thresholds?

${populationLabel}${sections.join('\n')}`;
  }

  /**
   * Generate the report header section.
   * @param {string} expressionName
   * @param {object} simulationResult
   * @returns {string}
   */
  #generateHeader(expressionName, simulationResult) {
    const timestamp = new Date().toISOString();
    const distribution = simulationResult.distribution ?? 'uniform';
    const sampleCount = simulationResult.sampleCount ?? 0;
    const samplingMode = simulationResult.samplingMode ?? 'static';
    const samplingMetadata = simulationResult.samplingMetadata ?? {};

    // Build sampling mode description
    const samplingDescription =
      samplingMetadata.description ??
      (samplingMode === 'static'
        ? 'Prototype-gated sampling (emotions derived from mood axes; not independent)'
        : 'Coupled sampling (tests fixed transition model)');

    return `# Monte Carlo Analysis Report

**Expression**: ${expressionName}
**Generated**: ${timestamp}
**Distribution**: ${distribution}
**Sample Size**: ${sampleCount}
**Sampling Mode**: ${samplingMode} - ${samplingDescription}
**Gating model**: HARD (gate fail => final = 0)
**Regime Note**: Report includes global vs in-regime (mood-pass) statistics

${samplingMetadata.note ? `> **Note**: ${samplingMetadata.note}` : ''}

---
`;
  }

  /**
   * Generate a concise integrity summary block near the top of the report.
   * @private
   * @param {Array<object>} warnings
   * @returns {string}
   */
  #generateIntegritySummarySection(warnings) {
    if (!Array.isArray(warnings) || warnings.length === 0) {
      return '';
    }

    const integrityWarnings = warnings.filter((warning) =>
      typeof warning?.code === 'string' && warning.code.startsWith('I')
    );
    if (integrityWarnings.length === 0) {
      return '';
    }

    const mismatchWarnings = integrityWarnings.filter((warning) =>
      this.#isGateMismatchWarning(warning)
    );
    const mismatchCount = mismatchWarnings.length;
    const affectedPrototypes = [
      ...new Set(
        mismatchWarnings.map((warning) => warning.prototypeId).filter(Boolean)
      ),
    ];

    const exampleIndices = [];
    for (const warning of mismatchWarnings) {
      const sampleIndices = warning?.details?.sampleIndices;
      if (!Array.isArray(sampleIndices)) {
        continue;
      }
      for (const sampleIndex of sampleIndices) {
        if (exampleIndices.length >= REPORT_INTEGRITY_SAMPLE_LIMIT) {
          break;
        }
        if (!exampleIndices.includes(sampleIndex)) {
          exampleIndices.push(sampleIndex);
        }
      }
      if (exampleIndices.length >= REPORT_INTEGRITY_SAMPLE_LIMIT) {
        break;
      }
    }

    const warningCount = integrityWarnings.length;
    const reliabilityLabel = mismatchCount > 0 ? 'UNRELIABLE' : 'OK';
    const mismatchNote =
      mismatchCount > 0
        ? '\n> **Note**: Gate-dependent metrics (pass rates, blocker stats) are unreliable while mismatches exist.\n'
        : '\n';

    const prototypeLabel =
      affectedPrototypes.length > 0 ? affectedPrototypes.join(', ') : 'None';
    const exampleLabel =
      exampleIndices.length > 0 ? exampleIndices.join(', ') : 'None';

    return `## Integrity Summary

- **Integrity warnings**: ${warningCount}
- **Gate/final mismatches**: ${mismatchCount}
- **Gate-dependent metrics**: ${reliabilityLabel}
- **Affected prototypes**: ${prototypeLabel}
- **Example indices**: ${exampleLabel}${mismatchNote}
---
`;
  }

  /**
   * Generate a short signal lineage section (raw -> gated -> final).
   * @private
   * @returns {string}
   */
  #generateSignalLineageSection() {
    return `## Signal Lineage

- **Raw**: Weighted sum of normalized axes (clamped to 0..1).
- **Gated**: Raw value when gate constraints pass; otherwise 0.
- **Final**: Hard-gated output (final = gated).

**Gate input scales**
- Mood axes: raw [-100, 100] -> normalized [-1, 1]
- Sexual axes: raw [0, 100] -> normalized [0, 1] (sexual_arousal derived, clamped)
- Affect traits: raw [0, 100] -> normalized [0, 1]

---
`;
  }

  /**
   * Identify warnings that signal gate/final mismatches.
   * @private
   * @param {object} warning
   * @returns {boolean}
   */
  #isGateMismatchWarning(warning) {
    const code = warning?.code;
    if (typeof code !== 'string') {
      return false;
    }
    return (
      code.startsWith('I1_') ||
      code.startsWith('I2_') ||
      code.startsWith('I3_')
    );
  }

  /**
   * Generate the executive summary section.
   * @param {object} simulationResult
   * @param {string} summary
   * @returns {string}
   */
  #generateExecutiveSummary(simulationResult, summary) {
    const triggerRate = simulationResult.triggerRate ?? 0;
    const ci = simulationResult.confidenceInterval ?? { low: 0, high: 0 };
    const rarity = this.#getRarityCategory(triggerRate);

    // Clarify that 0 triggers ≠ logically impossible
    const rarityNote =
      triggerRate === 0
        ? ` (not triggered in ${simulationResult.sampleCount ?? 'N/A'} samples—trigger rate is below ${this.#formatPercentage(ci.high)} upper bound, not logically impossible)`
        : '';

    return `## Executive Summary

**Trigger Rate**: ${this.#formatPercentage(triggerRate)} (95% CI: ${this.#formatPercentage(ci.low)} - ${this.#formatPercentage(ci.high)})
**Rarity**: ${rarity}${rarityNote}

${summary || 'No summary available.'}

---
`;
  }

  /**
   * Generate the Sampling Coverage section.
   * @private
   * @param {object|null} samplingCoverage
   * @param {string|null} samplingMode
   * @returns {string}
   */
  #generateSamplingCoverageSection(samplingCoverage, samplingMode) {
    if (!samplingCoverage) {
      return '';
    }

    const summaryByDomain = samplingCoverage.summaryByDomain ?? [];
    const variables = samplingCoverage.variables ?? [];
    const config = samplingCoverage.config ?? {};

    if (summaryByDomain.length === 0 && variables.length === 0) {
      return '';
    }

    let section = '## Sampling Coverage\n\n';

    if (samplingMode) {
      section += `**Sampling Mode**: ${samplingMode}\n\n`;
    }

    if (summaryByDomain.length > 0) {
      section += '### Summary by Domain\n\n';
      section += '| Domain | Variables | Range Coverage | Bin Coverage | Tail Low | Tail High | Zero Rate Avg | Rating |\n';
      section += '|--------|-----------|----------------|--------------|----------|-----------|---------------|--------|\n';

      for (const summary of summaryByDomain) {
        section += `| ${summary.domain} | ${summary.variableCount} | ${this.#formatPercentage(summary.rangeCoverageAvg)} | ${this.#formatPercentage(summary.binCoverageAvg)} | ${this.#formatPercentage(summary.tailCoverageAvg?.low)} | ${this.#formatPercentage(summary.tailCoverageAvg?.high)} | ${this.#formatPercentage(summary.zeroRateAvg)} | ${summary.rating} |\n`;
      }
      section += '\n';
    }

    const lowestCoverageVariables = this.#getLowestCoverageVariables(variables, 5);
    if (lowestCoverageVariables.length > 0) {
      section += '### Lowest Coverage Variables\n\n';
      section += '| Variable | Range Coverage | Bin Coverage | Tail Low | Tail High | Rating |\n';
      section += '|----------|----------------|--------------|----------|-----------|--------|\n';

      for (const variable of lowestCoverageVariables) {
        section += `| ${variable.variablePath} | ${this.#formatPercentage(variable.rangeCoverage)} | ${this.#formatPercentage(variable.binCoverage)} | ${this.#formatPercentage(variable.tailCoverage?.low)} | ${this.#formatPercentage(variable.tailCoverage?.high)} | ${variable.rating} |\n`;
      }
      section += '\n';
    }

    const binCount = Number.isFinite(config.binCount) ? config.binCount : null;
    const tailPercent = Number.isFinite(config.tailPercent) ? config.tailPercent : null;
    section += 'Notes:\n';
    section += '- Range coverage is observed span divided by domain span.\n';
    section += binCount
      ? `- Bin coverage is occupancy across ${binCount} equal-width bins.\n`
      : '- Bin coverage is occupancy across equal-width bins.\n';
    section += tailPercent !== null
      ? `- Tail coverage is the share of samples in the bottom/top ${this.#formatPercentage(tailPercent)} of the domain.\n`
      : '- Tail coverage is the share of samples in the bottom/top of the domain.\n';
    section += '- Variables with unknown domain ranges are excluded from summaries.\n\n';

    const warningDomains = summaryByDomain.filter((summary) => summary.rating === 'poor');
    if (warningDomains.length > 0) {
      const domainList = warningDomains.map((summary) => summary.domain).join(', ');
      const modeNote = samplingMode ? ` (sampling mode: ${samplingMode})` : '';
      section += `> ⚠️ Sampling coverage is low for ${domainList}${modeNote}. Trigger rates may be understated.\n\n`;
    }

    const conclusions = buildSamplingCoverageConclusions(samplingCoverage, {
      includeWatchlist: true,
    });
    const conclusionItems = [
      ...conclusions.domainConclusions,
      ...conclusions.variableSummary,
      ...conclusions.globalImplications,
      ...conclusions.watchlist,
    ];

    if (conclusionItems.length > 0) {
      section += '### Coverage Conclusions\n\n';
      section += `${conclusionItems
        .map((item) => `- ${item.text}`)
        .join('\n')}\n\n`;
    }

    section += '---\n';
    return section;
  }

  /**
   * Select lowest coverage variables, ordered by rating then coverage.
   * @private
   * @param {object[]} variables
   * @param {number} limit
   * @returns {object[]}
   */
  #getLowestCoverageVariables(variables, limit) {
    if (!Array.isArray(variables) || variables.length === 0) {
      return [];
    }

    const ratingRank = {
      poor: 0,
      partial: 1,
      good: 2,
    };

    return variables
      .filter((variable) => variable && variable.rating && variable.rating !== 'unknown')
      .sort((a, b) => {
        const rankA = ratingRank[a.rating] ?? 99;
        const rankB = ratingRank[b.rating] ?? 99;
        if (rankA !== rankB) return rankA - rankB;

        const rangeA = typeof a.rangeCoverage === 'number' ? a.rangeCoverage : 1;
        const rangeB = typeof b.rangeCoverage === 'number' ? b.rangeCoverage : 1;
        if (rangeA !== rangeB) return rangeA - rangeB;

        const binA = typeof a.binCoverage === 'number' ? a.binCoverage : 1;
        const binB = typeof b.binCoverage === 'number' ? b.binCoverage : 1;
        if (binA !== binB) return binA - binB;

        return String(a.variablePath).localeCompare(String(b.variablePath));
      })
      .slice(0, limit);
  }

  /**
   * Generate the ground-truth witnesses section.
   * These are actual samples that triggered the expression during simulation,
   * validated by the same evaluator used for statistics.
   * @param {object} simulationResult
   * @returns {string}
   */
  #generateWitnessSection(simulationResult) {
    const witnessAnalysis = simulationResult.witnessAnalysis ?? {};
    const witnesses = witnessAnalysis.witnesses ?? [];

    if (witnesses.length === 0) {
      // No triggers - show nearest miss analysis if available
      const nearestMiss = simulationResult.nearestMiss;
      const nearestMissSection = this.#generateNearestMissSection(nearestMiss);

      return `## Ground-Truth Witnesses

No triggering states found during simulation.

${nearestMissSection}
---
`;
    }

    const witnessSections = witnesses.map((w, i) =>
      this.#formatWitness(w, i + 1)
    );

    return `## Ground-Truth Witnesses

These states were verified to trigger the expression during simulation.
Each witness represents a valid combination of mood, sexual state, and affect traits.

${witnessSections.join('\n\n')}

---
`;
  }

  /**
   * Generate the nearest miss analysis section for when no triggers occur.
   * Shows the sample that came closest to triggering (fewest failing conditions).
   * @private
   * @param {object|null} nearestMiss - Nearest miss data from simulator
   * @returns {string} Markdown section
   */
  #generateNearestMissSection(nearestMiss) {
    if (!nearestMiss || !nearestMiss.failedLeaves) {
      return '';
    }

    const { failedLeafCount, failedLeaves } = nearestMiss;
    const totalLeaves = failedLeafCount + (nearestMiss.passedLeafCount ?? 0);

    let section = `### Nearest Miss Analysis

**Best Sample**: Failed ${failedLeafCount} condition${failedLeafCount === 1 ? '' : 's'}${totalLeaves > 0 ? ` (out of ~${totalLeaves} evaluated)` : ''}

This sample came closest to triggering the expression. Focus on these failing conditions:

`;

    // Format each failing leaf with its violation details
    for (let i = 0; i < failedLeaves.length; i++) {
      const leaf = failedLeaves[i];
      const desc = leaf.description ?? 'Unknown condition';
      let detail = `${i + 1}. \`${desc}\``;

      if (leaf.actual !== null && leaf.threshold !== null) {
        const actualStr = this.#formatNumber(leaf.actual);
        const threshStr = this.#formatNumber(leaf.threshold);
        const violationStr =
          typeof leaf.violation === 'number'
            ? this.#formatNumber(Math.abs(leaf.violation))
            : 'N/A';
        detail += ` - Actual: ${actualStr}, Threshold: ${threshStr}, Gap: ${violationStr}`;
      }

      section += detail + '\n';
    }

    if (failedLeaves.length > 0) {
      section += `
**Insight**: These are the conditions preventing this expression from triggering.
Consider adjusting thresholds or upstream prototypes for the conditions with the smallest gaps.
`;
    }

    return section;
  }

  /**
   * Format a single witness for display in the report.
   * @param {object} witness - Witness containing current, previous, affectTraits
   * @param {number} index - 1-based witness number
   * @returns {string}
   */
  #formatWitness(witness, index) {
    const {
      current,
      previous,
      affectTraits,
      computedEmotions,
      previousComputedEmotions,
    } = witness;

    // Format mood axes
    const currentMood = this.#formatMoodState(current?.mood, 'Current');
    const previousMood = this.#formatMoodState(previous?.mood, 'Previous');

    // Format sexual state
    const currentSexual = this.#formatSexualState(current?.sexual, 'Current');
    const previousSexual = this.#formatSexualState(previous?.sexual, 'Previous');

    // Format affect traits
    const traits = this.#formatAffectTraits(affectTraits);

    // Format computed emotions (only referenced ones)
    const currentEmotions = this.#formatComputedEmotions(
      computedEmotions,
      'Current'
    );
    const prevEmotions = this.#formatComputedEmotions(
      previousComputedEmotions,
      'Previous'
    );

    return `### Witness #${index}

**Computed Emotions (Current)**:
${currentEmotions}

**Computed Emotions (Previous)**:
${prevEmotions}

**Mood State (Current)**:
${currentMood}

**Mood State (Previous)**:
${previousMood}

**Sexual State (Current)**:
${currentSexual}

**Sexual State (Previous)**:
${previousSexual}

**Affect Traits**:
${traits}`;
  }

  /**
   * Format mood state for witness display.
   * @param {object|null} mood
   * @param {string} label
   * @returns {string}
   */
  #formatMoodState(mood, label) {
    if (!mood) {
      return `- No ${label.toLowerCase()} mood data`;
    }

    const axes = [
      'valence',
      'arousal',
      'agency_control',
      'threat',
      'engagement',
      'future_expectancy',
      'self_evaluation',
      'affiliation',
    ];

    return axes
      .filter((axis) => mood[axis] !== undefined)
      .map((axis) => `- ${axis}: ${mood[axis]}`)
      .join('\n');
  }

  /**
   * Format sexual state for witness display.
   * @param {object|null} sexual
   * @param {string} label
   * @returns {string}
   */
  #formatSexualState(sexual, label) {
    if (!sexual) {
      return `- No ${label.toLowerCase()} sexual data`;
    }

    const fields = ['sex_excitation', 'sex_inhibition', 'baseline_libido'];

    return fields
      .filter((field) => sexual[field] !== undefined)
      .map((field) => `- ${field}: ${sexual[field]}`)
      .join('\n');
  }

  /**
   * Format affect traits for witness display.
   * @param {object|null} traits
   * @returns {string}
   */
  #formatAffectTraits(traits) {
    if (!traits) {
      return '- No affect trait data';
    }

    const traitFields = ['affective_empathy', 'cognitive_empathy', 'harm_aversion'];

    return traitFields
      .filter((field) => traits[field] !== undefined)
      .map((field) => `- ${field}: ${traits[field]}`)
      .join('\n');
  }

  /**
   * Format computed emotions for witness display.
   * @param {object|null} emotions - Computed emotions object (filtered to referenced only)
   * @param {string} label - 'Current' or 'Previous'
   * @returns {string}
   */
  #formatComputedEmotions(emotions, label) {
    if (!emotions || Object.keys(emotions).length === 0) {
      return `- No ${label.toLowerCase()} emotion data`;
    }

    return Object.entries(emotions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `- ${name}: ${value.toFixed(3)}`)
      .join('\n');
  }

  /**
   * Generate the blocker analysis section.
   * @param {object[]} blockers
   * @param {number} sampleCount
   * @param {Map|null} axisConstraints - Axis constraints from expression prerequisites
   * @param {object[]|null} storedContexts - Stored simulation contexts for gate failure rate computation
   * @returns {string}
   */
  #generateBlockerAnalysis(
    blockers,
    sampleCount,
    axisConstraints,
    storedContexts = null,
    populationSummary = null,
    storedPopulations = null,
    hasOrMoodConstraints = false,
    moodConstraints = [],
    gateCompatibility = null,
    simulationResult = null
  ) {
    if (!blockers || blockers.length === 0) {
      return `## Blocker Analysis

No blockers identified.

---
`;
    }

    const blockerSections = blockers.map((blocker) =>
      this.#generateBlockerSection(
        blocker,
        blocker.rank,
        sampleCount,
        axisConstraints,
        storedContexts,
        populationSummary,
        storedPopulations,
        hasOrMoodConstraints,
        moodConstraints,
        gateCompatibility
      )
    );

    const note = `
> **Note on Sole-Blocker N values**: Each clause's N represents samples where all *other* clauses passed (excluding itself). Different clauses have different "others" sets, so N naturally varies. This is correct behavior indicating which clause is the decisive blocker when others succeed.
`;

    const probabilityFunnel = this.#generateProbabilityFunnel({
      sampleCount,
      blockers,
      simulationResult,
    });

    return `## Blocker Analysis
Signal: final (gate-clamped intensity).

${probabilityFunnel}

${blockerSections.join('\n')}
${note}`;
  }

  #generateProbabilityFunnel({ sampleCount, blockers, simulationResult }) {
    if (!Number.isFinite(sampleCount)) {
      return '';
    }

    const lines = ['### Probability Funnel'];

    lines.push(`- **Full sample**: ${this.#formatCount(sampleCount)}`);

    const inRegimeSampleCount = simulationResult?.inRegimeSampleCount;
    const moodRate =
      Number.isFinite(inRegimeSampleCount) && sampleCount > 0
        ? inRegimeSampleCount / sampleCount
        : null;
    lines.push(
      `- **Mood-regime pass**: ${this.#formatRateWithCounts(
        moodRate,
        inRegimeSampleCount,
        sampleCount
      )}`
    );

    const keyThresholds = this.#selectKeyThresholdClauses({
      blockers,
      clauseFailures: simulationResult?.clauseFailures,
      ablationImpact: simulationResult?.ablationImpact,
    });
    if (keyThresholds.length > 0) {
      for (const leaf of keyThresholds) {
        const gatePassCount = leaf.gatePassInRegimeCount;
        const inRegimeEvaluationCount = leaf.inRegimeEvaluationCount;
        const gatePassRate =
          Number.isFinite(gatePassCount) &&
          Number.isFinite(inRegimeEvaluationCount) &&
          inRegimeEvaluationCount > 0
            ? gatePassCount / inRegimeEvaluationCount
            : null;
        const label = this.#formatFunnelClauseLabel(leaf);
        lines.push(
          `- **Gate pass | mood-pass (${label})**: ${this.#formatRateWithCounts(
            gatePassRate,
            gatePassCount,
            inRegimeEvaluationCount
          )}`
        );
      }
    } else {
      lines.push('- **Gate pass | mood-pass**: N/A');
    }

    const orBlocks = this.#collectOrBlocks(blockers);
    if (orBlocks.length > 0) {
      orBlocks.forEach((orNode, index) => {
        const useInRegime =
          Number.isFinite(orNode?.inRegimeEvaluationCount) &&
          orNode.inRegimeEvaluationCount > 0;
        const evaluationCount = useInRegime
          ? orNode.inRegimeEvaluationCount
          : orNode?.evaluationCount;
        const unionCount = useInRegime
          ? this.#resolveOrUnionInRegimeCount(orNode)
          : this.#resolveOrUnionCount(orNode);
        const unionRate =
          Number.isFinite(unionCount) &&
          Number.isFinite(evaluationCount) &&
          evaluationCount > 0
            ? unionCount / evaluationCount
            : null;
        lines.push(
          `- **OR union pass | mood-pass (OR Block #${
            index + 1
          })**: ${this.#formatRateWithCounts(
            unionRate,
            unionCount,
            evaluationCount
          )}`
        );
      });
    } else {
      lines.push('- **OR union pass | mood-pass**: N/A');
    }

    const triggerCount = simulationResult?.triggerCount;
    const triggerRate =
      Number.isFinite(triggerCount) && sampleCount > 0
        ? triggerCount / sampleCount
        : null;
    lines.push(
      `- **Final trigger**: ${this.#formatRateWithCounts(
        triggerRate,
        triggerCount,
        sampleCount
      )}`
    );

    return `${lines.join('\n')}\n`;
  }

  #collectOrBlocks(blockers) {
    const orBlocks = [];
    const seen = new Set();
    if (!Array.isArray(blockers)) {
      return orBlocks;
    }

    const register = (node) => {
      if (!node || node.nodeType !== 'or') {
        return;
      }
      const key =
        node.id ??
        `${node.description ?? 'or'}:${node.evaluationCount ?? 'na'}:${
          node.failureCount ?? 'na'
        }`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      orBlocks.push(node);
    };

    const walk = (node) => {
      if (!node) return;
      register(node);
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          walk(child);
        }
      }
    };

    for (const blocker of blockers) {
      const root = blocker?.hierarchicalBreakdown;
      if (root) {
        walk(root);
      }
    }

    return orBlocks;
  }

  #collectFunnelLeaves({ blockers, clauseFailures }) {
    const sources =
      Array.isArray(clauseFailures) && clauseFailures.length > 0
        ? clauseFailures
        : blockers;
    const leaves = [];
    if (!Array.isArray(sources)) {
      return leaves;
    }

    for (const source of sources) {
      const root = source?.hierarchicalBreakdown ?? source;
      if (!root) continue;
      this.#flattenLeaves(root, leaves);
    }

    return leaves;
  }

  #selectKeyThresholdClauses({ blockers, clauseFailures, ablationImpact }) {
    const leafNodes = this.#collectFunnelLeaves({ blockers, clauseFailures });
    const eligibleLeaves = leafNodes.filter(
      (leaf) =>
        leaf?.nodeType === 'leaf' &&
        Number.isFinite(leaf?.gatePassInRegimeCount) &&
        Number.isFinite(leaf?.inRegimeEvaluationCount)
    );

    if (eligibleLeaves.length === 0) {
      return [];
    }

    const leafByClauseId = new Map();
    for (const leaf of eligibleLeaves) {
      if (leaf.clauseId && !leafByClauseId.has(leaf.clauseId)) {
        leafByClauseId.set(leaf.clauseId, leaf);
      }
    }

    const impacts = Array.isArray(ablationImpact?.clauseImpacts)
      ? [...ablationImpact.clauseImpacts]
      : [];
    impacts.sort(
      (a, b) =>
        (b?.impact ?? 0) - (a?.impact ?? 0) ||
        String(a?.clauseId ?? '').localeCompare(String(b?.clauseId ?? ''))
    );

    const selected = [];
    for (const impact of impacts) {
      const leaf = leafByClauseId.get(impact?.clauseId);
      if (!leaf) continue;
      selected.push(leaf);
      if (selected.length >= 2) {
        break;
      }
    }

    if (selected.length > 0) {
      return selected;
    }

    return eligibleLeaves
      .map((leaf) => {
        const score =
          typeof leaf?.inRegimeFailureRate === 'number'
            ? leaf.inRegimeFailureRate
            : typeof leaf?.failureRate === 'number'
              ? leaf.failureRate
              : 0;
        return { leaf, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((entry) => entry.leaf);
  }

  #formatFunnelClauseLabel(leaf) {
    const description = leaf?.description;
    if (description) {
      return `\`${description}\``;
    }
    const variablePath = leaf?.variablePath ?? 'unknown';
    const operator = leaf?.comparisonOperator ?? '?';
    const thresholdValue = leaf?.thresholdValue;
    const threshold =
      typeof thresholdValue === 'number'
        ? this.#formatNumber(thresholdValue)
        : thresholdValue ?? 'N/A';
    return `\`${variablePath} ${operator} ${threshold}\``;
  }

  #resolveOrUnionCount(orNode) {
    if (!orNode) return null;
    if (Number.isFinite(orNode.orUnionPassCount)) {
      return orNode.orUnionPassCount;
    }
    if (
      Number.isFinite(orNode.evaluationCount) &&
      Number.isFinite(orNode.failureCount)
    ) {
      return orNode.evaluationCount - orNode.failureCount;
    }
    return null;
  }

  #resolveOrUnionInRegimeCount(orNode) {
    if (!orNode) return null;
    if (Number.isFinite(orNode.orUnionPassInRegimeCount)) {
      return orNode.orUnionPassInRegimeCount;
    }
    if (
      Number.isFinite(orNode.inRegimeEvaluationCount) &&
      Number.isFinite(orNode.inRegimeFailureCount)
    ) {
      return orNode.inRegimeEvaluationCount - orNode.inRegimeFailureCount;
    }
    return null;
  }

  /**
   * Generate a single blocker section.
   * @param {object} blocker
   * @param {number} rank
   * @param {number} sampleCount
   * @param {Map|null} axisConstraints - Axis constraints from expression prerequisites
   * @param {object[]|null} storedContexts - Stored simulation contexts for gate failure rate computation
   * @returns {string}
   */
  #generateBlockerSection(
    blocker,
    rank,
    sampleCount,
    axisConstraints,
    storedContexts = null,
    populationSummary = null,
    storedPopulations = null,
    hasOrMoodConstraints = false,
    moodConstraints = [],
    gateCompatibility = null
  ) {
    const clauseDesc = blocker.clauseDescription ?? 'Unknown clause';
    const failureRate = blocker.failureRate ?? 0;
    const failureCount = Math.round(failureRate * sampleCount);
    const inRegimeFailureRate =
      blocker.inRegimeFailureRate ?? blocker.hierarchicalBreakdown?.inRegimeFailureRate ?? null;
    const inRegimeFailureCount =
      blocker.hierarchicalBreakdown?.inRegimeFailureCount ?? null;
    const inRegimeEvaluationCount =
      blocker.hierarchicalBreakdown?.inRegimeEvaluationCount ?? null;
    const severity = blocker.severity ?? 'unknown';

    // Extract condition details from hierarchicalBreakdown if available
    const hb = blocker.hierarchicalBreakdown ?? {};
    const redundantInRegime =
      blocker.redundantInRegime ?? hb.redundantInRegime ?? null;
    const redundancyStr = this.#formatBooleanValue(redundantInRegime);
    const clampTrivialInRegime = this.#resolveClampTrivialInRegime({
      ...hb,
      clampTrivialInRegime:
        blocker.clampTrivialInRegime !== undefined
          ? blocker.clampTrivialInRegime
          : hb.clampTrivialInRegime,
    });
    const clampTrivialStr = this.#formatClampTrivialLabel(clampTrivialInRegime);
    const globalFailStr = this.#formatFailRate(
      failureRate,
      failureCount,
      sampleCount
    );
    const inRegimeFailStr = this.#formatFailRate(
      inRegimeFailureRate,
      inRegimeFailureCount,
      inRegimeEvaluationCount
    );

    // For compound nodes (AND/OR), show compound type instead of trying to extract leaf fields
    let conditionLine;
    if (hb.isCompound) {
      const nodeType = (hb.nodeType ?? 'compound').toUpperCase();
      conditionLine = `**Condition**: Compound ${nodeType} block`;
    } else {
      const variablePath = hb.variablePath ?? 'unknown';
      const operator = hb.comparisonOperator ?? '?';
      const threshold = hb.thresholdValue ?? 'N/A';
      conditionLine = `**Condition**: \`${variablePath} ${operator} ${threshold}\``;
    }

    // Generate leaf breakdown section for compound nodes
    const leafBreakdown = this.#generateLeafBreakdown(blocker, sampleCount);
    const worstOffenderAnalysis = this.#generateWorstOffenderAnalysis(blocker, sampleCount);

    // Generate prototype math section for emotion/sexual threshold conditions
    const prototypeMath = this.#generatePrototypeMathSection(
      blocker,
      axisConstraints,
      storedContexts,
      populationSummary,
      storedPopulations,
      hasOrMoodConstraints,
      moodConstraints,
      gateCompatibility
    );

    const clauseAnchorId = this.#buildClauseAnchorId(hb.clauseId);
    const clauseAnchor = clauseAnchorId ? `<a id="${clauseAnchorId}"></a>\n` : '';

    return `### Blocker #${rank}: \`${clauseDesc}\`

${clauseAnchor}
${conditionLine}
**Fail% global**: ${globalFailStr}
**Fail% | mood-pass**: ${inRegimeFailStr}
**Severity**: ${severity}
**Redundant in regime**: ${redundancyStr}
**Clamp-trivial in regime**: ${clampTrivialStr}

${this.#generateFlags(blocker)}

${leafBreakdown}

${worstOffenderAnalysis}

${prototypeMath}

${this.#generateDistributionAnalysis(blocker)}

${this.#generateCeilingAnalysis(blocker)}

${this.#generateNearMissAnalysis(blocker)}

${this.#generateLastMileAnalysis(blocker)}

${this.#generateRecommendation(blocker)}

---
`;
  }

  /**
   * Generate the deterministic recommendations section based on MC diagnostics.
   * @private
   * @param {object} params
   * @param {string} params.expressionName
   * @param {Array|null} params.prerequisites
   * @param {object} params.simulationResult
   * @returns {string}
   */
  #generateRecommendationsSection({ expressionName, prerequisites, simulationResult }) {
    if (!simulationResult) {
      return '';
    }

    const expression = {
      id: expressionName ?? null,
      prerequisites: Array.isArray(prerequisites) ? prerequisites : null,
    };

    const factsBuilder = new RecommendationFactsBuilder({
      prototypeConstraintAnalyzer: this.#prototypeConstraintAnalyzer,
      logger: this.#logger,
    });
    const diagnosticFacts = factsBuilder.build({
      expression,
      simulationResult,
    });

    if (!diagnosticFacts) {
      return '';
    }

    const invariantFailures = (diagnosticFacts.invariants ?? []).filter(
      (inv) => inv.ok === false
    );
    if (invariantFailures.length > 0) {
      return `## Recommendations

> Recommendations suppressed: invariant violations detected in diagnostic facts.

---
`;
    }

    const engine = new RecommendationEngine();
    const recommendations = engine.generate(diagnosticFacts);
    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return '';
    }

    const impactByClauseId = new Map(
      (diagnosticFacts.clauses ?? []).map((clause) => [
        clause.clauseId,
        clause.impact,
      ])
    );

    const cards = recommendations.map((recommendation, index) =>
      this.#formatRecommendationCard(recommendation, index, impactByClauseId)
    );

    return `## Recommendations

${cards.join('\n')}

---
`;
  }

  /**
   * Format a single recommendation as a markdown "card".
   * @private
   * @param {object} recommendation
   * @param {number} index
   * @param {Map<string, number>} impactByClauseId
   * @returns {string}
   */
  #formatRecommendationCard(recommendation, index, impactByClauseId) {
    const title = recommendation.title ?? 'Recommendation';
    const confidence = recommendation.confidence ?? 'low';
    const severity = recommendation.severity ?? 'low';
    const type = recommendation.type ?? 'unknown';
    const impact = this.#resolveRecommendationImpact(
      recommendation,
      impactByClauseId
    );
    const impactStr =
      typeof impact === 'number' ? this.#formatSignedPercentagePoints(impact) : 'n/a';

    const evidenceLines = this.#formatRecommendationEvidence(
      recommendation.evidence ?? []
    );
    const actionLines = this.#formatRecommendationActions(
      recommendation.actions ?? []
    );
    const relatedClauseLinks = this.#formatRecommendationLinks(
      recommendation.relatedClauseIds ?? []
    );

    const bullets = [
      `- **Type**: ${type}`,
      `- **Severity**: ${severity}`,
      `- **Confidence**: ${confidence}`,
      `- **Impact (full sample)**: ${impactStr}`,
    ];

    if (recommendation.why) {
      bullets.push(`- **Why**: ${recommendation.why}`);
    }
    if (evidenceLines.length > 0) {
      bullets.push(`- **Evidence**:\n${evidenceLines.join('\n')}`);
    }
    if (actionLines.length > 0) {
      bullets.push(`- **Actions**:\n${actionLines.join('\n')}`);
    }
    if (recommendation.predictedEffect) {
      bullets.push(`- **Predicted Effect**: ${recommendation.predictedEffect}`);
    }
    if (relatedClauseLinks.length > 0) {
      bullets.push(`- **Related Clauses**: ${relatedClauseLinks.join(', ')}`);
    }

    return `### Recommendation ${index + 1}: ${title}

${bullets.join('\n')}
`;
  }

  #resolveRecommendationImpact(recommendation, impactByClauseId) {
    const relatedClauseIds = recommendation.relatedClauseIds ?? [];
    for (const clauseId of relatedClauseIds) {
      if (impactByClauseId.has(clauseId)) {
        return impactByClauseId.get(clauseId);
      }
    }
    return null;
  }

  #formatRecommendationEvidence(evidence) {
    if (!Array.isArray(evidence) || evidence.length === 0) {
      return [];
    }

    return evidence.map((entry) => {
      const numerator = this.#formatEvidenceCount(entry.numerator);
      const denominator = this.#formatEvidenceCount(entry.denominator);
      const ratio = `${numerator}/${denominator}`;
      const valueStr = this.#formatEvidenceValue(
        entry.value,
        entry.denominator
      );
      const populationLabel = this.#formatPopulationEvidenceLabel(
        entry.population
      );
      const base = `  - ${entry.label}: ${ratio} (${valueStr})`;
      return populationLabel ? `${base} | ${populationLabel}` : base;
    });
  }

  #formatPopulationEvidenceLabel(population) {
    if (!population || typeof population.name !== 'string') {
      return null;
    }
    if (!Number.isFinite(population.count)) {
      return null;
    }
    const countStr = this.#formatCount(population.count);
    return `Population: ${population.name} (N=${countStr})`;
  }

  #formatRecommendationActions(actions) {
    if (!Array.isArray(actions) || actions.length === 0) {
      return [];
    }
    return actions.map((action) => `  - ${action}`);
  }

  #formatRecommendationLinks(relatedClauseIds) {
    if (!Array.isArray(relatedClauseIds) || relatedClauseIds.length === 0) {
      return [];
    }

    return relatedClauseIds.map((clauseId) => {
      const anchorId = this.#buildClauseAnchorId(clauseId);
      if (anchorId) {
        return `[${clauseId}](#${anchorId})`;
      }
      return clauseId;
    });
  }

  #formatEvidenceCount(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '?';
    }
    return Number.isInteger(value) ? value : this.#formatNumber(value);
  }

  #formatEvidenceValue(value, denominator) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 'n/a';
    }
    if (value >= 0 && value <= 1 && denominator !== 1) {
      return this.#formatPercentage(value);
    }
    return this.#formatNumber(value);
  }

  #buildClauseAnchorId(clauseId) {
    if (!clauseId) {
      return null;
    }
    const token = String(clauseId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return token ? `clause-${token}` : null;
  }

  /**
   * Generate flags for a blocker based on problem indicators.
   * @param {object} blocker
   * @returns {string}
   */
  #generateFlags(blocker) {
    const flags = [];
    const adv = blocker.advancedAnalysis ?? {};
    const hb = blocker.hierarchicalBreakdown ?? {};

    // 1. Ceiling Effect (Critical)
    if (adv.ceilingAnalysis?.status === 'ceiling_detected') {
      flags.push('[CEILING]');
    }

    // 2. Decisive Blocker (High Priority)
    // Check advancedAnalysis.lastMileAnalysis.isDecisive OR isSingleClause
    if (adv.lastMileAnalysis?.isDecisive || hb.isSingleClause) {
      flags.push('[DECISIVE]');
    }

    // 3. High Tunability (Quick Wins) - nearMissRate > 0.10
    // Near-miss rate available at top level or in hierarchicalBreakdown
    const nearMissRate = hb.nearMissRate ?? blocker.nearMissRate;
    if (nearMissRate !== null && nearMissRate !== undefined && nearMissRate > 0.1) {
      flags.push('[TUNABLE]');
    }

    // 4. Low Tunability (Upstream Fix Required) - nearMissRate < 0.02
    if (nearMissRate !== null && nearMissRate !== undefined && nearMissRate < 0.02) {
      flags.push('[UPSTREAM]');
    }

    // 5. Heavy-Tailed Distribution - violationP50 < averageViolation * 0.5
    const avgViol = blocker.averageViolation;
    const p50 = hb.violationP50 ?? blocker.violationP50;
    if (p50 !== null && p50 !== undefined && avgViol !== null && avgViol !== undefined && p50 < avgViol * 0.5) {
      flags.push('[OUTLIERS-SKEW]');
    }

    // 6. Severe Outliers Present - violationP90 > averageViolation * 2
    const p90 = hb.violationP90 ?? blocker.violationP90;
    if (p90 !== null && p90 !== undefined && avgViol !== null && avgViol !== undefined && p90 > avgViol * 2) {
      flags.push('[SEVERE-TAIL]');
    }

    const flagsStr = flags.length > 0 ? flags.join(' ') : 'None';
    return `#### Flags
${flagsStr}`;
  }

  /**
   * Generate distribution analysis subsection.
   * For compound nodes, aggregates statistics from leaf conditions.
   * @param {object} blocker
   * @returns {string}
   */
  #generateDistributionAnalysis(blocker) {
    const hb = blocker.hierarchicalBreakdown ?? {};
    const adv = blocker.advancedAnalysis ?? {};

    // For compound nodes, aggregate from leaves
    if (hb.isCompound) {
      const leafStats = this.#aggregateLeafViolationStats(hb);
      if (leafStats) {
        const insight = leafStats.worstDescription
          ? `Worst violator: ${leafStats.worstDescription}`
          : 'See individual conditions for details';

        // Count top-level conditions (OR blocks count as 1 each)
        const topLevelCount = hb.children?.length ?? 0;
        const leafCountNote =
          leafStats.leafCount !== topLevelCount
            ? ` (${topLevelCount} top-level conditions; ${leafStats.leafCount} when OR blocks expanded)`
            : '';

        let lines = [
          `- **Compound Node**: Aggregated from ${leafStats.leafCount} leaf conditions${leafCountNote}`,
          `- **Highest Avg Violation**: ${this.#formatNumber(leafStats.maxAvgViolation)} (from \`${leafStats.worstDescription}\`)`,
          `- **Highest P90 Violation**: ${this.#formatNumber(leafStats.maxP90)}`,
        ];

        if (leafStats.maxP95 !== null) {
          lines.push(`- **Highest P95 Violation**: ${this.#formatNumber(leafStats.maxP95)}`);
        }
        if (leafStats.maxP99 !== null) {
          lines.push(`- **Highest P99 Violation**: ${this.#formatNumber(leafStats.maxP99)}`);
        }

        lines.push(`- **Interpretation**: ${insight}`);

        return `#### Distribution Analysis\n${lines.join('\n')}`;
      }

      return `#### Distribution Analysis
- **Compound Node**: Contains multiple conditions
- **Note**: See individual leaf conditions in breakdown above for violation statistics`;
    }

    // Standard leaf node distribution analysis
    const avgViol = blocker.averageViolation ?? 0;
    const p50 = hb.violationP50 ?? blocker.violationP50 ?? 0;
    const p90 = hb.violationP90 ?? blocker.violationP90 ?? 0;
    const p95 = hb.violationP95 ?? blocker.violationP95 ?? null;
    const p99 = hb.violationP99 ?? blocker.violationP99 ?? null;
    const observedMin = hb.observedMin ?? null;
    const observedMean = hb.observedMean ?? null;
    const insight =
      adv.percentileAnalysis?.insight ?? 'No distribution insight available.';

    // Build distribution lines
    let lines = [
      `- **Average Violation**: ${this.#formatNumber(avgViol)}`,
      `- **Median (P50)**: ${this.#formatNumber(p50)}`,
      `- **90th Percentile (P90)**: ${this.#formatNumber(p90)}`,
    ];

    // Add p95/p99 if available
    if (p95 !== null) {
      lines.push(`- **95th Percentile (P95)**: ${this.#formatNumber(p95)}`);
    }
    if (p99 !== null) {
      lines.push(`- **99th Percentile (P99)**: ${this.#formatNumber(p99)}`);
    }

    // Add observed value statistics if available
    if (observedMin !== null || observedMean !== null) {
      lines.push('');
      lines.push('**Observed Value Distribution**:');
      if (observedMin !== null) {
        lines.push(`- **Min Observed**: ${this.#formatNumber(observedMin)}`);
      }
      if (observedMean !== null) {
        lines.push(`- **Mean Observed**: ${this.#formatNumber(observedMean)}`);
      }
    }

    lines.push(`- **Interpretation**: ${insight}`);

    return `#### Distribution Analysis\n${lines.join('\n')}`;
  }

  /**
   * Aggregate violation statistics from leaf nodes of a compound node.
   * @private
   * @param {object} hb - Hierarchical breakdown node
   * @returns {{leafCount: number, maxAvgViolation: number, maxP90: number, maxP95: number|null, maxP99: number|null, worstDescription: string}|null}
   */
  #aggregateLeafViolationStats(hb) {
    const leaves = this.#flattenLeaves(hb);
    if (leaves.length === 0) return null;

    let maxAvgViolation = 0;
    let maxP90 = 0;
    let maxP95 = null;
    let maxP99 = null;
    let worstDescription = '';

    for (const leaf of leaves) {
      const avgViol = leaf.averageViolation ?? 0;
      const p90 = leaf.violationP90 ?? 0;
      const p95 = leaf.violationP95 ?? null;
      const p99 = leaf.violationP99 ?? null;

      if (avgViol > maxAvgViolation) {
        maxAvgViolation = avgViol;
        worstDescription = leaf.description ?? 'Unknown condition';
      }

      if (p90 > maxP90) {
        maxP90 = p90;
      }

      if (p95 !== null && (maxP95 === null || p95 > maxP95)) {
        maxP95 = p95;
      }

      if (p99 !== null && (maxP99 === null || p99 > maxP99)) {
        maxP99 = p99;
      }
    }

    return {
      leafCount: leaves.length,
      maxAvgViolation,
      maxP90,
      maxP95,
      maxP99,
      worstDescription,
    };
  }

  /**
   * Generate ceiling analysis subsection.
   * For compound nodes, extracts the worst ceiling issue from leaf conditions.
   * @param {object} blocker
   * @returns {string}
   */
  #generateCeilingAnalysis(blocker) {
    const hb = blocker.hierarchicalBreakdown ?? {};
    const adv = blocker.advancedAnalysis ?? {};

    // For compound nodes, find the worst ceiling issue among leaves
    if (hb.isCompound) {
      const ceilingData = this.#extractWorstCeilingFromLeaves(hb);

      if (ceilingData) {
        const achievableStr = ceilingData.gap > 0 ? 'UNREACHABLE' : 'achievable';
        return `#### Ceiling Analysis
- **Compound Node**: Contains ${ceilingData.totalLeaves} leaf conditions
- **Worst Ceiling Issue**: \`${ceilingData.description}\`
- **Max Observed**: ${this.#formatNumber(ceilingData.maxObserved)}
- **Threshold**: ${this.#formatNumber(ceilingData.threshold)}
- **Ceiling Gap**: ${this.#formatNumber(ceilingData.gap)} (${achievableStr})
- **Insight**: ${ceilingData.insight}`;
      }

      // No ceiling issues found in leaves
      return `#### Ceiling Analysis
- **Compound Node**: Contains multiple conditions
- **Status**: No ceiling effects detected in leaf conditions
- **Insight**: All thresholds appear achievable based on observed values`;
    }

    // Standard leaf node ceiling analysis
    const threshold = hb.thresholdValue ?? 'N/A';
    const ceilingGap = hb.ceilingGap ?? blocker.ceilingGap ?? 0;
    const ceilingStatus = adv.ceilingAnalysis?.achievable;
    const achievableStr =
      ceilingStatus === true
        ? 'achievable'
        : ceilingStatus === false
          ? 'UNREACHABLE'
          : 'unknown';
    const insight =
      adv.ceilingAnalysis?.insight ?? 'No ceiling insight available.';

    // Get maxObserved properly
    const maxVal = hb.maxObservedValue ?? blocker.maxObserved ?? 'N/A';

    return `#### Ceiling Analysis
- **Max Observed**: ${typeof maxVal === 'number' ? this.#formatNumber(maxVal) : maxVal}
- **Threshold**: ${typeof threshold === 'number' ? this.#formatNumber(threshold) : threshold}
- **Ceiling Gap**: ${this.#formatNumber(ceilingGap)} (${achievableStr})
- **Insight**: ${insight}`;
  }

  /**
   * Extract the worst ceiling issue from leaf nodes of a compound node.
   * @private
   * @param {object} hb - Hierarchical breakdown node
   * @returns {{description: string, maxObserved: number, threshold: number, gap: number, insight: string, totalLeaves: number}|null}
   */
  #extractWorstCeilingFromLeaves(hb) {
    const leaves = this.#flattenLeaves(hb);
    if (leaves.length === 0) return null;

    let worstCeiling = null;

    for (const leaf of leaves) {
      const gap = leaf.ceilingGap;
      const threshold = leaf.thresholdValue;
      const maxObserved = leaf.maxObservedValue;

      // Only consider leaves with ceiling data and positive gaps (unreachable)
      if (typeof gap === 'number' && gap > 0 && typeof threshold === 'number' && typeof maxObserved === 'number') {
        if (!worstCeiling || gap > worstCeiling.gap) {
          worstCeiling = {
            description: leaf.description ?? 'Unknown condition',
            maxObserved,
            threshold,
            gap,
            insight: `Max observed (${maxObserved.toFixed(2)}) never reached threshold (${threshold.toFixed(2)})`,
            totalLeaves: leaves.length,
          };
        }
      }
    }

    return worstCeiling;
  }

  /**
   * Generate near-miss analysis subsection.
   * For compound nodes, finds the most tunable leaf condition.
   * @param {object} blocker
   * @returns {string}
   */
  #generateNearMissAnalysis(blocker) {
    const hb = blocker.hierarchicalBreakdown ?? {};
    const adv = blocker.advancedAnalysis ?? {};

    // For compound nodes, find the leaf with highest tunability
    if (hb.isCompound) {
      const tunabilityData = this.#findMostTunableLeaf(hb);

      if (tunabilityData) {
        return `#### Near-Miss Analysis
- **Compound Node**: Contains ${tunabilityData.leafCount} leaf conditions
- **Most Tunable Condition**: \`${tunabilityData.description}\`
- **Near-Miss Rate**: ${this.#formatPercentage(tunabilityData.nearMissRate)} (epsilon: ${this.#formatNumber(tunabilityData.epsilon)})
- **Tunability**: ${tunabilityData.tunability}
- **Insight**: Adjusting threshold for this condition offers the best chance of improving trigger rate`;
      }

      return `#### Near-Miss Analysis
- **Compound Node**: Contains multiple conditions
- **Note**: No near-miss data available; see individual leaf conditions for details`;
    }

    // Standard leaf node near-miss analysis
    const nearMissRate = hb.nearMissRate ?? blocker.nearMissRate ?? 0;
    const epsilon = hb.nearMissEpsilon ?? blocker.nearMissEpsilon ?? 0;
    const tunability = adv.nearMissAnalysis?.tunability ?? 'unknown';
    const insight =
      adv.nearMissAnalysis?.insight ?? 'No near-miss insight available.';

    return `#### Near-Miss Analysis
- **Near-Miss Rate**: ${this.#formatPercentage(nearMissRate)} (epsilon: ${this.#formatNumber(epsilon)})
- **Tunability**: ${tunability}
- **Insight**: ${insight}`;
  }

  /**
   * Find the most tunable leaf condition weighted by impact.
   * Ranks by (nearMissRate * lastMileFailRate) to prioritize conditions
   * that are both tunable AND decisive blockers.
   * @private
   * @param {object} hb - Hierarchical breakdown node
   * @returns {{description: string, nearMissRate: number, epsilon: number, tunability: string, leafCount: number, impactScore: number}|null}
   */
  #findMostTunableLeaf(hb) {
    const leaves = this.#flattenLeaves(hb);
    if (leaves.length === 0) return null;

    let mostTunable = null;

    for (const leaf of leaves) {
      const nearMissRate = leaf.nearMissRate;
      const epsilon = leaf.nearMissEpsilon ?? 0;

      if (typeof nearMissRate === 'number' && nearMissRate > 0) {
        // Weight tunability by last-mile impact to prioritize decisive blockers
        const lastMileRate =
          leaf.siblingConditionedFailRate ?? leaf.lastMileFailRate ?? leaf.failureRate ?? 0;
        const impactScore = nearMissRate * lastMileRate;

        if (!mostTunable || impactScore > mostTunable.impactScore) {
          let tunability = 'low';
          if (nearMissRate > 0.1) tunability = 'high';
          else if (nearMissRate >= 0.02) tunability = 'moderate';

          mostTunable = {
            description: leaf.description ?? 'Unknown condition',
            nearMissRate,
            epsilon,
            tunability,
            leafCount: leaves.length,
            impactScore,
          };
        }
      }
    }

    return mostTunable;
  }

  /**
   * Generate last-mile analysis subsection.
   * For compound nodes, provides context-aware insight.
   * @param {object} blocker
   * @returns {string}
   */
  #generateLastMileAnalysis(blocker) {
    const hb = blocker.hierarchicalBreakdown ?? {};
    const adv = blocker.advancedAnalysis ?? {};
    const lastMileStatus = adv.lastMileAnalysis?.status;

    // For compound nodes that are the only prerequisite
    if (hb.isCompound && lastMileStatus === 'compound_single_prereq') {
      const worstLastMile = this.#findWorstLastMileLeaf(hb);

      if (worstLastMile) {
        return `#### Sole-Blocker Analysis
- **Compound Node**: This is the only prerequisite block
- **Most Decisive Condition**: \`${worstLastMile.description}\`
- **Sole-Blocker Rate**: ${this.#formatPercentage(worstLastMile.lastMileFailRate)}
- **Insight**: This condition is the primary bottleneck among the leaf conditions`;
      }

      return `#### Sole-Blocker Analysis
- **Compound Node**: This is the only prerequisite block
- **Note**: Analyze individual leaf conditions to identify bottlenecks
- **Insight**: ${adv.lastMileAnalysis?.insight ?? 'See leaf conditions for sole-blocker analysis'}`;
    }

    // Standard last-mile analysis
    const lastMileFailRate =
      hb.lastMileFailRate ?? blocker.lastMileFailRate ?? 0;
    const othersPassedCount = hb.othersPassedCount ?? 0;
    const isDecisive = adv.lastMileAnalysis?.isDecisive ?? false;
    const insight =
      adv.lastMileAnalysis?.insight ?? 'No last-mile insight available.';

    return `#### Sole-Blocker Analysis
- **Sole-Blocker Rate**: ${this.#formatPercentage(lastMileFailRate)}
- **Others Passed Count**: ${othersPassedCount}
- **Is Decisive**: ${isDecisive ? 'yes' : 'no'}
- **Insight**: ${insight}`;
  }

  /**
   * Find the leaf condition with the highest last-mile failure rate.
   * @private
   * @param {object} hb - Hierarchical breakdown node
   * @returns {{description: string, lastMileFailRate: number}|null}
   */
  #findWorstLastMileLeaf(hb) {
    const leaves = this.#flattenLeaves(hb);
    if (leaves.length === 0) return null;

    let worst = null;

    for (const leaf of leaves) {
      const lastMileRate = leaf.lastMileFailRate;

      if (typeof lastMileRate === 'number' && lastMileRate > 0) {
        if (!worst || lastMileRate > worst.lastMileFailRate) {
          worst = {
            description: leaf.description ?? 'Unknown condition',
            lastMileFailRate: lastMileRate,
          };
        }
      }
    }

    return worst;
  }

  /**
   * Generate recommendation subsection.
   * @param {object} blocker
   * @returns {string}
   */
  #generateRecommendation(blocker) {
    const adv = blocker.advancedAnalysis ?? {};
    const rec = adv.recommendation ?? {};
    const action = rec.action ?? 'investigate';
    const priority = rec.priority ?? 'unknown';
    const message = rec.message ?? 'No specific recommendation available.';

    return `#### Recommendation
**Action**: ${action}
**Priority**: ${priority}
**Guidance**: ${message}`;
  }

  // ========================================================================
  // Prototype Math Methods (for emotion/sexual threshold conditions)
  // ========================================================================

  /**
   * Generate prototype math section for emotion/sexual threshold blockers.
   * Shows prototype weights, max achievable intensity, and binding axes.
   * @private
   * @param {object} blocker - Blocker object
   * @param {Map|null} axisConstraints - Axis constraints from expression
   * @param {object[]|null} storedContexts - Stored simulation contexts for gate failure rate computation
   * @returns {string} Markdown section or empty string
   */
  #generatePrototypeMathSection(
    blocker,
    axisConstraints,
    storedContexts = null,
    populationSummary = null,
    storedPopulations = null,
    hasOrMoodConstraints = false,
    moodConstraints = [],
    gateCompatibility = null
  ) {
    if (!this.#prototypeConstraintAnalyzer || !axisConstraints) {
      return '';
    }

    // Extract emotion/sexual threshold conditions from blocker
    const emotionConditions = this.#extractEmotionConditions(blocker);

    if (emotionConditions.length === 0) {
      return '';
    }

    const analyses = emotionConditions.map((cond) => ({
      analysis: this.#analyzeEmotionCondition(cond, axisConstraints),
      operator: cond.operator ?? '>=',
    }));

    // Filter out null analyses
    const validAnalyses = analyses.filter((entry) => entry.analysis !== null);

    if (validAnalyses.length === 0) {
      return '';
    }

    const sections = validAnalyses.map(({ analysis, operator }) =>
      this.#formatPrototypeAnalysis(
        analysis,
        operator,
        storedContexts,
        moodConstraints,
        gateCompatibility
      )
    );

    const orConstraintWarning = hasOrMoodConstraints
      ? this.#formatOrMoodConstraintWarning()
      : '';
    const populationLabel =
      this.#formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedGlobal ?? null
      );

    return `#### Prototype Math Analysis

${orConstraintWarning}${populationLabel}${sections.join('\n\n')}`;
  }

  /**
   * Extract emotion/sexual threshold conditions from a blocker.
   * @private
   * @param {object} blocker - Blocker object
   * @returns {Array<{prototypeId: string, type: string, threshold: number, operator: string, description: string}>}
   */
  #extractEmotionConditions(blocker) {
    const conditions = [];
    const hb = blocker.hierarchicalBreakdown ?? {};

    // Check if this blocker or its leaves contain emotion/sexual conditions
    const leaves = hb.isCompound ? this.#flattenLeaves(hb) : [hb];

    for (const leaf of leaves) {
      const varPath = leaf.variablePath ?? '';
      const threshold = leaf.thresholdValue;
      const operator = leaf.comparisonOperator ?? leaf.operator;
      const desc = leaf.description ?? '';

      // Match patterns like "emotions.anger" or "sexual.arousal"
      const tunableInfo = getTunableVariableInfo(varPath);
      if (tunableInfo?.domain === 'emotions' && typeof threshold === 'number') {
        conditions.push({
          prototypeId: tunableInfo.name,
          type: 'emotion',
          threshold,
          operator,
          description: desc,
        });
      } else if (tunableInfo?.domain === 'sexual' && typeof threshold === 'number') {
        conditions.push({
          prototypeId: tunableInfo.name,
          type: 'sexual',
          threshold,
          operator,
          description: desc,
        });
      }
    }

    return conditions;
  }

  /**
   * Analyze a single emotion condition using the prototype constraint analyzer.
   * @private
   * @param {object} condition - Extracted condition
   * @param {Map} axisConstraints - Axis constraints
   * @returns {object|null} Analysis result or null
   */
  #analyzeEmotionCondition(condition, axisConstraints) {
    try {
      return this.#prototypeConstraintAnalyzer.analyzeEmotionThreshold(
        condition.prototypeId,
        condition.type,
        condition.threshold,
        axisConstraints,
        condition.operator ?? '>='
      );
    } catch (err) {
      this.#logger.warn(
        `Failed to analyze ${condition.type} condition ${condition.prototypeId}:`,
        err.message
      );
      return null;
    }
  }

  /**
   * Format a prototype analysis result as markdown.
   * @private
   * @param {object} analysis - Result from PrototypeConstraintAnalyzer
   * @param {string} operator - Comparison operator from the clause
   * @param {object[]|null} storedContexts - Stored simulation contexts for gate failure rate computation
   * @returns {string} Markdown section
   */
  #formatPrototypeAnalysis(
    analysis,
    operator,
    storedContexts = null,
    moodConstraints = [],
    gateCompatibility = null
  ) {
    const {
      prototypeId,
      type,
      threshold,
      maxAchievable,
      minAchievable,
      weights,
      gates,
      gateStatus,
      bindingAxes,
      axisAnalysis,
      sumAbsWeights,
      requiredRawSum,
      explanation,
    } = analysis;

    const comparisonOperator = analysis.operator ?? operator ?? '>=';
    const feasibility = this.#buildFeasibilitySummary({
      minAchievable,
      maxAchievable,
      threshold,
      operator: comparisonOperator,
    });
    const feasibilityBlock = this.#formatFeasibilityBlock(feasibility);

    // Format weights table
    const weightsTable = this.#formatWeightsTable(axisAnalysis);

    // Compute gate failure rates from stored contexts
    const gateFailureRates = this.#computeGateFailureRates(gates, storedContexts);

    // Format gate status with failure rates
    const gateStatusStr = this.#formatGateStatus(
      gates,
      gateStatus,
      gateFailureRates,
      comparisonOperator
    );

    // Format binding axes summary
    const bindingStr = this.#formatBindingAxes(bindingAxes);

    // Generate recommendations
    const recommendations = this.#generatePrototypeRecommendations(
      analysis,
      comparisonOperator
    );

    const regimeStats = this.#formatPrototypeRegimeStats({
      prototypeId,
      type,
      gates,
      weights,
      storedContexts,
      moodConstraints,
    });
    const gateCompatibilityBlock = this.#formatGateCompatibilityBlock(
      { prototypeId, type, comparisonOperator },
      gateCompatibility
    );

    return `##### ${type === 'emotion' ? '🧠' : '💗'} ${prototypeId} ${comparisonOperator} ${this.#formatNumber(threshold)} ${feasibility.statusIcon} ${feasibility.statusLabel}

${feasibilityBlock}
**Sum|Weights|**: ${sumAbsWeights.toFixed(2)} | **Required Raw Sum**: ${requiredRawSum.toFixed(2)}

${regimeStats}

${gateCompatibilityBlock}

${weightsTable}

${gateStatusStr}

${bindingStr}

**Analysis**: ${explanation}

${recommendations}`;
  }

  /**
   * Format prototype weights as a markdown table.
   * @private
   * @param {object[]} axisAnalysis - Axis analysis from PrototypeConstraintAnalyzer
   * @returns {string} Markdown table
   */
  #formatWeightsTable(axisAnalysis) {
    if (!axisAnalysis || axisAnalysis.length === 0) {
      return '*No weight analysis available*';
    }

    const header =
      '| Axis | Weight | Constraint | Optimal | Contribution | Binding |';
    const separator = '|------|--------|------------|---------|--------------|---------|';
    const rows = axisAnalysis.map((a) => {
      const weight = a.weight >= 0 ? `+${a.weight.toFixed(2)}` : a.weight.toFixed(2);
      const constraint = `[${a.constraintMin.toFixed(2)}, ${a.constraintMax.toFixed(2)}]`;
      const optimal = a.optimalValue.toFixed(2);
      const contribution = a.contribution.toFixed(3);
      const binding = a.isBinding
        ? a.conflictType
          ? `⚠️ ${a.conflictType}`
          : '⚠️ yes'
        : '—';
      return `| ${a.axis} | ${weight} | ${constraint} | ${optimal} | ${contribution} | ${binding} |`;
    });

    return `**Prototype Weights**:\n${header}\n${separator}\n${rows.join('\n')}`;
  }

  /**
   * Compute gate failure rates from stored simulation contexts.
   * Parses gate strings like "threat >= 0.30" and checks how often each fails.
   * @private
   * @param {string[]} gates - Gate condition strings
   * @param {object[]|null} storedContexts - Stored simulation contexts
   * @returns {Map<string, number>} Map from gate string to failure rate (0-1)
   */
  #computeGateFailureRates(gates, storedContexts) {
    const rates = new Map();

    if (!gates || gates.length === 0 || !storedContexts || storedContexts.length === 0) {
      return rates;
    }

    const parsedGates = gates
      .map((gateStr) => {
        try {
          return { gateStr, constraint: GateConstraint.parse(gateStr) };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (parsedGates.length === 0) {
      return rates;
    }

    const normalizedContexts = storedContexts.map((context) =>
      this.#normalizeContextAxes(context)
    );

    for (const { gateStr, constraint } of parsedGates) {
      let failCount = 0;
      const total = normalizedContexts.length;

      for (const normalized of normalizedContexts) {
        const axisValue = resolveAxisValue(
          constraint.axis,
          normalized.moodAxes,
          normalized.sexualAxes,
          normalized.traitAxes
        );

        if (!constraint.isSatisfiedBy(axisValue)) {
          failCount++;
        }
      }

      if (total > 0) {
        rates.set(gateStr, failCount / total);
      }
    }

    return rates;
  }

  /**
   * Format gate status as markdown.
   * @private
   * @param {string[]} gates - Gate condition strings
   * @param {object} gateStatus - Gate status from analyzer
   * @param {Map<string, number>} gateFailureRates - Gate failure rates from samples
   * @returns {string} Markdown section
   */
  #formatGateStatus(
    gates,
    gateStatus,
    gateFailureRates = new Map(),
    operator = '>='
  ) {
    if (!gates || gates.length === 0) {
      return '**Gates**: None';
    }

    const gateLines = gateStatus.gates.map((g) => {
      const icon = g.satisfiable ? '✅' : '❌';

      // Add observed failure rate from samples if available
      let failRateStr = '';
      if (gateFailureRates.has(g.gate)) {
        const failRate = gateFailureRates.get(g.gate);
        failRateStr = ` | **Observed Fail Rate**: ${this.#formatPercentage(failRate)}`;
      }

      return `- ${icon} \`${g.gate}\` - ${g.reason}${failRateStr}`;
    });

    const overallIcon = gateStatus.allSatisfiable ? '✅' : '❌';
    const isUpperBound = operator === '<=' || operator === '<';
    const gateNote =
      !gateStatus.allSatisfiable && isUpperBound
        ? '\n- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.'
        : '';
    return `**Gates** ${overallIcon}:\n${gateLines.join('\n')}${gateNote}`;
  }

  /**
   * Format binding axes summary.
   * @private
   * @param {object[]} bindingAxes - Binding axes from analyzer
   * @returns {string} Markdown section
   */
  #formatBindingAxes(bindingAxes) {
    if (!bindingAxes || bindingAxes.length === 0) {
      return '**Binding Axes**: None (all axes can reach optimal values)';
    }

    const conflicts = bindingAxes.filter((a) => a.conflictType);
    if (conflicts.length === 0) {
      const axesList = bindingAxes.map((a) => a.axis).join(', ');
      return `**Binding Axes**: ${axesList} (constraints limit optimal values)`;
    }

    const conflictLines = conflicts.map((a) => {
      if (a.conflictType === 'positive_weight_low_max') {
        return `- ⚠️ **${a.axis}**: Has positive weight (+${a.weight.toFixed(2)}) but constraint limits max to ${a.constraintMax.toFixed(2)}`;
      } else if (a.conflictType === 'negative_weight_high_min') {
        return `- ⚠️ **${a.axis}**: Has negative weight (${a.weight.toFixed(2)}) but constraint requires min ${a.constraintMin.toFixed(2)}`;
      }
      return `- ⚠️ **${a.axis}**: Binding conflict`;
    });

    return `**Binding Axes (Structural Conflicts)**:\n${conflictLines.join('\n')}`;
  }

  /**
   * Generate recommendations based on prototype analysis.
   * @private
   * @param {object} analysis - Prototype analysis result
   * @returns {string} Markdown recommendations
   */
  #generatePrototypeRecommendations(analysis, operator) {
    const { isReachable, gap, bindingAxes, gateStatus, threshold, maxAchievable } = analysis;

    const recommendations = [];
    const isUpperBound = operator === '<=' || operator === '<';

    if (isUpperBound) {
      if (maxAchievable <= threshold) {
        recommendations.push('**Recommendation**: Always satisfies threshold within constraints.');
      } else {
        recommendations.push(
          '**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.'
        );
      }
      return recommendations.join('\n');
    }

    if (!isReachable) {
      if (!gateStatus.allSatisfiable) {
        recommendations.push(
          '**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.'
        );
      } else if (bindingAxes.length > 0) {
        const conflicts = bindingAxes.filter((a) => a.conflictType);
        if (conflicts.length > 0) {
          recommendations.push(
            `**Recommendation**: Lower threshold to ${analysis.maxAchievable.toFixed(2)} or relax conflicting constraints on: ${conflicts.map((a) => a.axis).join(', ')}`
          );
        } else {
          recommendations.push(
            `**Recommendation**: Lower threshold to approximately ${analysis.maxAchievable.toFixed(2)}`
          );
        }
      } else {
        recommendations.push(
          `**Recommendation**: Threshold ${threshold} may be too high; max achievable is ${analysis.maxAchievable.toFixed(2)}`
        );
      }
    } else {
      const reachMargin = maxAchievable - threshold;
      if (reachMargin >= 0 && reachMargin < 0.05) {
        recommendations.push(
          `**Note**: Threshold is achievable but with narrow margin (gap: ${reachMargin.toFixed(3)}). Consider lowering threshold for more reliable triggering.`
        );
      }
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '';
  }

  /**
   * Build feasibility summary values for standardized feasibility reporting.
   * @private
   * @param {object} params
   * @returns {object}
   */
  #buildFeasibilitySummary({ minAchievable, maxAchievable, threshold, operator }) {
    const tuningDirection = this.#formatTuningDirection(operator);
    const isUpperBound = operator === '<=' || operator === '<';
    const hasNumbers =
      typeof minAchievable === 'number' &&
      typeof maxAchievable === 'number' &&
      typeof threshold === 'number';

    let status = 'unknown';
    if (hasNumbers) {
      if (isUpperBound) {
        const impossible = operator === '<'
          ? minAchievable >= threshold
          : minAchievable > threshold;
        const always = operator === '<'
          ? maxAchievable < threshold
          : maxAchievable <= threshold;
        status = impossible ? 'impossible' : always ? 'always' : 'sometimes';
      } else {
        const impossible = operator === '>'
          ? maxAchievable <= threshold
          : maxAchievable < threshold;
        const always = operator === '>'
          ? minAchievable > threshold
          : minAchievable >= threshold;
        status = impossible ? 'impossible' : always ? 'always' : 'sometimes';
      }
    }

    const statusIcon =
      status === 'always' ? '✅' : status === 'sometimes' ? '⚠️' : status === 'impossible' ? '❌' : '❓';

    const feasibilitySlack = hasNumbers
      ? (isUpperBound ? threshold - minAchievable : maxAchievable - threshold)
      : null;
    const alwaysSlack = hasNumbers
      ? (isUpperBound ? threshold - maxAchievable : minAchievable - threshold)
      : null;

    return {
      minAchievable,
      maxAchievable,
      threshold,
      status,
      statusIcon,
      statusLabel: status.toUpperCase(),
      feasibilitySlack,
      alwaysSlack,
      tuningDirection,
    };
  }

  /**
   * Format feasibility block as markdown.
   * @private
   * @param {object} feasibility
   * @returns {string}
   */
  #formatFeasibilityBlock(feasibility) {
    const minStr = this.#formatNumber(feasibility.minAchievable);
    const maxStr = this.#formatNumber(feasibility.maxAchievable);
    const thresholdStr = this.#formatNumber(feasibility.threshold);
    const slackStr = this.#formatSignedNumber(feasibility.feasibilitySlack);
    const alwaysSlackStr = this.#formatSignedNumber(feasibility.alwaysSlack);
    const tuning = feasibility.tuningDirection;

    return `**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [${minStr}, ${maxStr}]
- **Threshold**: ${thresholdStr}
- **Status**: ${feasibility.status}
- **Slack**: feasibility ${slackStr}; always ${alwaysSlackStr}
- **Tuning direction**: loosen -> ${tuning.loosen}, tighten -> ${tuning.tighten}`;
  }

  /**
   * Format regime statistics for a prototype from stored contexts.
   * @private
   * @param {object} params
   * @returns {string}
   */
  #formatPrototypeRegimeStats({
    prototypeId,
    type,
    gates,
    weights,
    storedContexts,
    moodConstraints,
  }) {
    if (!storedContexts || storedContexts.length === 0) {
      return '*Regime stats unavailable (no stored contexts).*';
    }

    const path = this.#getPrototypeContextPath(type, prototypeId);
    if (!path) {
      return '*Regime stats unavailable (unknown prototype path).*';
    }

    const inRegimeContexts = this.#filterContextsByMoodConstraints(
      storedContexts,
      moodConstraints
    );
    const globalStats = this.#computePrototypeRegimeStats(
      storedContexts,
      path,
      gates,
      weights
    );
    const inRegimeStats = this.#computePrototypeRegimeStats(
      inRegimeContexts,
      path,
      gates,
      weights
    );
    const inRegimeLabel =
      moodConstraints && moodConstraints.length > 0
        ? 'In mood regime'
        : 'In mood regime (no mood constraints)';

    const header = '| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |';
    const divider = '|--------|--------|-----|-----|-----|-----|-----|----------|';
    const rows = [
      ...this.#formatPrototypeRegimeRows('Global', globalStats),
      ...this.#formatPrototypeRegimeRows(inRegimeLabel, inRegimeStats),
    ];
    const globalMaxStr = globalStats?.finalDistribution
      ? this.#formatNumber(globalStats.finalDistribution.max)
      : 'N/A';
    const inRegimeMaxStr = inRegimeStats?.finalDistribution
      ? this.#formatNumber(inRegimeStats.finalDistribution.max)
      : 'N/A';

    return `**Regime Stats**:\n${header}\n${divider}\n${rows.join('\n')}
- **Observed max (global, final)**: ${globalMaxStr}
- **Observed max (mood-regime, final)**: ${inRegimeMaxStr}`;
  }

  /**
   * Compute distribution and gate pass rate for a regime.
   * @private
   * @param {Array} contexts
   * @param {string} varPath
   * @param {string[]} gates
   * @returns {object|null}
   */
  #computePrototypeRegimeStats(contexts, varPath, gates, weights = null) {
    if (!contexts || contexts.length === 0) {
      return null;
    }

    const rawValues = [];
    const finalValues = [];
    let gatePassCount = 0;
    const traceTarget = this.#resolveGateTraceTarget(varPath);

    for (const context of contexts) {
      if (traceTarget) {
        const traceSignals = this.#getGateTraceSignals(
          context,
          traceTarget.type,
          traceTarget.prototypeId
        );
        if (traceSignals) {
          rawValues.push(traceSignals.raw);
          finalValues.push(traceSignals.final);
          if (traceSignals.gatePass) {
            gatePassCount++;
          }
          continue;
        }
      }

      if (weights && Object.keys(weights).length > 0) {
        const normalized = this.#normalizeContextAxes(context);
        const signals = computeIntensitySignals({
          weights,
          gates,
          normalizedMood: normalized.moodAxes,
          normalizedSexual: normalized.sexualAxes,
          normalizedTraits: normalized.traitAxes,
        });

        rawValues.push(signals.raw);
        finalValues.push(signals.final);
        if (signals.gatePass) {
          gatePassCount++;
        }
        continue;
      }

      const value = this.#getNestedValue(context, varPath);
      if (typeof value === 'number') {
        finalValues.push(value);
      }
    }

    if ((!weights || Object.keys(weights).length === 0) && rawValues.length === 0) {
      gatePassCount = null;
    }

    const rawDistribution = rawValues.length > 0
      ? this.#computeDistributionStats(rawValues)
      : null;
    const finalDistribution = this.#computeDistributionStats(finalValues);
    const gatePassRate =
      gatePassCount === null
        ? this.#computeGatePassRate(gates, contexts)
        : contexts.length > 0
          ? gatePassCount / contexts.length
          : null;

    return {
      rawDistribution,
      finalDistribution,
      gatePassRate,
      count: finalValues.length,
    };
  }

  /**
   * Format a single regime row for the prototype stats table.
   * @private
   * @param {string} label
   * @param {object|null} stats
   * @returns {string}
   */
  #formatPrototypeRegimeRows(label, stats) {
    if (!stats || !stats.finalDistribution) {
      return [
        `| ${label} | final | N/A | N/A | N/A | N/A | N/A | ${this.#formatPercentage(stats?.gatePassRate)} |`,
      ];
    }

    const finalRow = `| ${label} | final | ${this.#formatNumber(stats.finalDistribution.median)} | ${this.#formatNumber(stats.finalDistribution.p90)} | ${this.#formatNumber(stats.finalDistribution.p95)} | ${this.#formatNumber(stats.finalDistribution.min)} | ${this.#formatNumber(stats.finalDistribution.max)} | ${this.#formatPercentage(stats.gatePassRate)} |`;

    if (!stats.rawDistribution) {
      return [finalRow];
    }

    const rawRow = `| ${label} | raw | ${this.#formatNumber(stats.rawDistribution.median)} | ${this.#formatNumber(stats.rawDistribution.p90)} | ${this.#formatNumber(stats.rawDistribution.p95)} | ${this.#formatNumber(stats.rawDistribution.min)} | ${this.#formatNumber(stats.rawDistribution.max)} | N/A |`;

    return [finalRow, rawRow];
  }

  /**
   * Format gate compatibility status for a prototype.
   * @private
   * @param {{prototypeId: string, type: string}} params
   * @param {object|null} gateCompatibility
   * @returns {string}
   */
  #formatGateCompatibilityBlock(
    { prototypeId, type, comparisonOperator },
    gateCompatibility
  ) {
    if (!gateCompatibility) {
      return '**Gate Compatibility (mood regime)**: N/A';
    }

    const compatibilityMap =
      type === 'sexual'
        ? gateCompatibility.sexualStates
        : gateCompatibility.emotions;
    const status = compatibilityMap?.[prototypeId];

    if (!status) {
      return '**Gate Compatibility (mood regime)**: N/A';
    }

    if (status.compatible) {
      return '**Gate Compatibility (mood regime)**: ✅ compatible';
    }

    const isBenignCeiling =
      comparisonOperator === '<=' || comparisonOperator === '<';
    const reason = status.reason ? ` - ${status.reason}` : '';
    if (isBenignCeiling) {
      return (
        '**Gate Compatibility (mood regime)**: ⚠️ incompatible ' +
        '(benign for <=/< clauses)' +
        `${reason}`
      );
    }

    return `**Gate Compatibility (mood regime)**: ❌ incompatible${reason}`;
  }

  /**
   * Compute overall gate pass rate for a set of contexts.
   * @private
   * @param {string[]} gates
   * @param {object[]|null} storedContexts
   * @returns {number|null}
   */
  #computeGatePassRate(gates, storedContexts) {
    if (!storedContexts || storedContexts.length === 0) return null;
    if (!gates || gates.length === 0) return 1;

    const parsedGates = gates
      .map((gateStr) => {
        try {
          return GateConstraint.parse(gateStr);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (parsedGates.length === 0) {
      return 1;
    }

    let passCount = 0;
    const total = storedContexts.length;

    for (const context of storedContexts) {
      const normalized = this.#normalizeContextAxes(context);
      let allPass = true;

      for (const constraint of parsedGates) {
        const axisValue = resolveAxisValue(
          constraint.axis,
          normalized.moodAxes,
          normalized.sexualAxes,
          normalized.traitAxes
        );

        if (!constraint.isSatisfiedBy(axisValue)) {
          allPass = false;
          break;
        }
      }

      if (allPass) {
        passCount++;
      }
    }

    return total > 0 ? passCount / total : null;
  }

  /**
   * Normalize axes from a stored context to align with EmotionCalculatorService.
   * @private
   * @param {object} context
   * @returns {{ moodAxes: object, sexualAxes: object, traitAxes: object }}
   */
  #normalizeContextAxes(context) {
    const moodAxes = normalizeMoodAxes(context?.moodAxes ?? context?.mood ?? {});
    const sexualAxes = normalizeSexualAxes(
      context?.sexualAxes ?? context?.sexual ?? null,
      context?.sexualArousal ?? null
    );
    const traitAxes = normalizeAffectTraits(context?.affectTraits);

    return { moodAxes, sexualAxes, traitAxes };
  }

  /**
   * Resolve stored gate trace signals from context.
   * @private
   * @param {object} context
   * @param {'emotion'|'sexual'} type
   * @param {string} prototypeId
   * @returns {{ raw: number, gated: number, final: number, gatePass: boolean }|null}
   */
  #getGateTraceSignals(context, type, prototypeId) {
    const gateTrace = context?.gateTrace ?? null;
    if (!gateTrace || !prototypeId) {
      return null;
    }
    if (type === 'emotion') {
      return gateTrace.emotions?.[prototypeId] ?? null;
    }
    if (type === 'sexual') {
      return gateTrace.sexualStates?.[prototypeId] ?? null;
    }
    return null;
  }

  /**
   * Resolve gate trace target from a variable path.
   * @private
   * @param {string} varPath
   * @returns {{ type: 'emotion'|'sexual', prototypeId: string }|null}
   */
  #resolveGateTraceTarget(varPath) {
    if (!varPath || typeof varPath !== 'string') {
      return null;
    }
    if (varPath.startsWith('emotions.')) {
      return { type: 'emotion', prototypeId: varPath.slice('emotions.'.length) };
    }
    if (varPath.startsWith('sexualStates.')) {
      return { type: 'sexual', prototypeId: varPath.slice('sexualStates.'.length) };
    }
    return null;
  }

  /**
   * Map prototype type to stored context path.
   * @private
   * @param {string} type
   * @param {string} prototypeId
   * @returns {string|null}
   */
  #getPrototypeContextPath(type, prototypeId) {
    if (type === 'emotion') {
      return `emotions.${prototypeId}`;
    }
    if (type === 'sexual') {
      return `sexualStates.${prototypeId}`;
    }
    return null;
  }

  /**
   * Format fail rate with optional counts.
   * @private
   * @param {number|null} rate
   * @param {number|null} failures
   * @param {number|null} total
   * @returns {string}
   */
  #formatFailRate(rate, failures = null, total = null) {
    if (rate === null || rate === undefined || typeof rate !== 'number' || isNaN(rate)) {
      return 'N/A';
    }
    const pct = this.#formatPercentage(rate);
    if (
      typeof failures === 'number' &&
      typeof total === 'number' &&
      total > 0
    ) {
      return `${pct} (${failures} / ${total})`;
    }
    return pct;
  }

  /**
   * Format an arbitrary rate with optional counts.
   * @private
   * @param {number|null} rate
   * @param {number|null} count
   * @param {number|null} total
   * @returns {string}
   */
  #formatRateWithCounts(rate, count = null, total = null) {
    if (rate === null || rate === undefined || typeof rate !== 'number' || isNaN(rate)) {
      return 'N/A';
    }
    const pct = this.#formatPercentage(rate);
    if (typeof count === 'number' && typeof total === 'number' && total > 0) {
      return `${pct} (${count} / ${total})`;
    }
    return pct;
  }

  /**
   * Check whether a clause leaf represents an emotion-threshold clause.
   * @private
   * @param {object} leaf
   * @returns {boolean}
   */
  #isEmotionThresholdLeaf(leaf) {
    const variablePath = leaf?.variablePath;
    if (!variablePath || typeof variablePath !== 'string') {
      return false;
    }
    const isEmotionPath =
      variablePath.startsWith('emotions.') ||
      variablePath.startsWith('previousEmotions.');
    return isEmotionPath && typeof leaf.thresholdValue === 'number';
  }

  /**
   * Format boolean values with yes/no/N/A.
   * @private
   * @param {boolean|null} value
   * @returns {string}
   */
  #formatBooleanValue(value) {
    if (value === true) return 'yes';
    if (value === false) return 'no';
    return 'N/A';
  }

  #formatClampTrivialLabel(value) {
    if (value === true) {
      return 'Trivially satisfied (clamped)';
    }
    return this.#formatBooleanValue(value);
  }

  #resolveClampTrivialInRegime(leaf) {
    if (!leaf) return null;
    if (typeof leaf.clampTrivialInRegime === 'boolean') {
      return leaf.clampTrivialInRegime;
    }

    const operator = leaf.comparisonOperator;
    if (operator !== '<=' && operator !== '<') {
      return null;
    }

    const gatePassRate = leaf.gatePassRateInRegime;
    const inRegimeMax = leaf.inRegimeMaxObservedValue;
    if (typeof gatePassRate !== 'number' || typeof inRegimeMax !== 'number') {
      return null;
    }

    return gatePassRate === 0 && inRegimeMax === 0;
  }

  /**
   * Format tuning direction labels.
   * @private
   * @param {string} operator
   * @returns {{loosen: string, tighten: string}}
   */
  #formatTuningDirection(operator) {
    switch (operator) {
      case '>=':
      case '>':
        return { loosen: 'threshold down', tighten: 'threshold up' };
      case '<=':
      case '<':
        return { loosen: 'threshold up', tighten: 'threshold down' };
      default:
        return { loosen: 'unknown', tighten: 'unknown' };
    }
  }

  /**
   * Format signed numbers for slack display.
   * @private
   * @param {number|null} value
   * @returns {string}
   */
  #formatSignedNumber(value) {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
      return 'N/A';
    }
    const formatted = this.#formatNumber(Math.abs(value), 3);
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
  }

  // ========================================================================
  // Leaf Breakdown Methods (for compound AND/OR nodes)
  // ========================================================================

  /**
   * Recursively flatten a hierarchical tree to extract all leaf nodes.
   * NOTE: This method loses OR/AND semantics - use #generateStructuredLeafBreakdown
   * for reports that need to preserve the logical structure.
   * @private
   * @param {object} node - Hierarchical breakdown node
   * @param {object[]} results - Array to accumulate results
   * @returns {object[]} Array of leaf nodes sorted by failure rate descending
   */
  #flattenLeaves(node, results = []) {
    if (!node) return results;

    // If this is a leaf node, add it to results
    if (node.nodeType === 'leaf' || !node.isCompound) {
      results.push(node);
    }

    // Recurse into children for compound nodes
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.#flattenLeaves(child, results);
      }
    }

    return results;
  }

  /**
   * Build a structured representation of the condition tree that preserves OR/AND semantics.
   * Returns groups of conditions with their logical context.
   * @private
   * @param {object} node - Hierarchical breakdown node
   * @returns {{type: 'and'|'or'|'leaf', node: object, children: Array}|null}
   */
  #buildStructuredTree(node) {
    if (!node) return null;

    // Leaf node
    if (node.nodeType === 'leaf' || !node.isCompound) {
      return { type: 'leaf', node, children: [] };
    }

    // Compound node (AND/OR)
    const structuredChildren = [];
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const structured = this.#buildStructuredTree(child);
        if (structured) {
          structuredChildren.push(structured);
        }
      }
    }

    return {
      type: node.nodeType, // 'and' or 'or'
      node,
      children: structuredChildren,
    };
  }

  /**
   * Calculate the effective pass rate for an OR block.
   * An OR block passes if ANY child passes.
   * @private
   * @param {object} orNode - OR node from hierarchical breakdown
   * @returns {number} Combined pass rate (0-1)
   */
  #calculateOrPassRate(orNode) {
    if (!orNode) return 0;
    const evaluationCount = orNode.evaluationCount;
    const failureCount = orNode.failureCount;

    if (
      typeof evaluationCount === 'number' &&
      evaluationCount > 0 &&
      typeof failureCount === 'number'
    ) {
      return (evaluationCount - failureCount) / evaluationCount;
    }

    const failureRate = orNode.failureRate;
    if (typeof failureRate === 'number') {
      return 1 - failureRate;
    }

    return 0;
  }

  /**
   * Calculate in-regime failure rate for an OR block.
   * @private
   * @param {object} orNode - OR node from hierarchical breakdown
   * @returns {number|null} In-regime failure rate (0-1) or null when unavailable
   */
  #calculateOrInRegimeFailureRate(orNode) {
    if (!orNode) return null;
    const inRegimeEvaluationCount = orNode.inRegimeEvaluationCount;
    const inRegimeFailureCount = orNode.inRegimeFailureCount;

    if (
      typeof inRegimeEvaluationCount === 'number' &&
      inRegimeEvaluationCount > 0 &&
      typeof inRegimeFailureCount === 'number'
    ) {
      return inRegimeFailureCount / inRegimeEvaluationCount;
    }

    return orNode.inRegimeFailureRate ?? null;
  }

  /**
   * Generate a single row for the leaf breakdown table.
   * @private
   * @param {object} leaf - Leaf node from hierarchical breakdown
   * @param {number} index - Row number (1-based)
   * @param {number} sampleCount - Total sample count for percentage calculation
   * @param {boolean} isOrLeaf - True if this leaf is inside an OR block (last-mile is N/A)
   * @param {boolean} includeGateMetrics - Whether to append gate columns
   * @returns {string} Markdown table row
   */
  #generateLeafRow(
    leaf,
    index,
    _sampleCount,
    isOrLeaf = false,
    includeGateMetrics = false
  ) {
    const description = leaf.description ?? 'Unknown';
    const failureRate = leaf.failureRate ?? 0;
    const inRegimeFailureRate = leaf.inRegimeFailureRate ?? null;
    const inRegimeFailureCount = leaf.inRegimeFailureCount ?? null;
    const inRegimeEvaluationCount = leaf.inRegimeEvaluationCount ?? null;
    const redundantInRegime = leaf.redundantInRegime ?? null;
    const clampTrivialInRegime = this.#resolveClampTrivialInRegime(leaf);
    const evaluationCount = leaf.evaluationCount ?? 0;
    const threshold = leaf.thresholdValue;
    const ceilingGap = leaf.ceilingGap;
    const nearMissRate = leaf.nearMissRate;

    // Select the appropriate observed bound based on operator type.
    // For >= and > operators: use maxObserved (we need high values)
    // For <= and < operators: use minObserved (we need low values)
    // This ensures the displayed bound matches what's used in Gap calculation.
    const operator = leaf.comparisonOperator;
    const isLowBound = operator === '<=' || operator === '<';
    const boundObserved = isLowBound
      ? leaf.minObservedValue
      : leaf.maxObservedValue;

    // For leaf nodes within compounds, prefer sibling-conditioned stats
    // (tracks when all OTHER leaves in the same compound passed)
    // Fall back to clause-level lastMileFailRate if sibling stats unavailable
    const siblingFailRate = leaf.siblingConditionedFailRate;
    const siblingsPassedCount = leaf.siblingsPassedCount ?? 0;
    const lastMileRate = leaf.lastMileFailRate;
    const othersPassedCount = leaf.othersPassedCount ?? 0;

    // Use sibling-conditioned rate if available (for leaves in compounds)
    // Otherwise fall back to clause-level last-mile rate
    const effectiveLastMileRate =
      typeof siblingFailRate === 'number' ? siblingFailRate : lastMileRate;
    const effectiveSupportCount =
      siblingsPassedCount > 0 ? siblingsPassedCount : othersPassedCount;

    // Format bound observed (max for >=, min for <=)
    const boundObsStr =
      typeof boundObserved === 'number' ? this.#formatNumber(boundObserved) : '-';

    // Format threshold
    const thresholdStr =
      typeof threshold === 'number' ? this.#formatNumber(threshold) : '-';

    const globalFailStr = this.#formatFailRate(failureRate);
    const inRegimeFailStr = this.#formatFailRate(
      inRegimeFailureRate,
      inRegimeFailureCount,
      inRegimeEvaluationCount
    );
    const redundantStr = this.#formatBooleanValue(redundantInRegime);
    const clampTrivialStr = this.#formatClampTrivialLabel(clampTrivialInRegime);

    // Format ceiling gap with indicator
    let gapStr = '-';
    if (typeof ceilingGap === 'number') {
      if (ceilingGap > 0) {
        gapStr = `+${this.#formatNumber(ceilingGap)} [CEIL]`;
      } else {
        gapStr = this.#formatNumber(ceilingGap);
      }
    }

    // Determine tunability from near-miss rate
    let tunabilityStr = '-';
    if (typeof nearMissRate === 'number') {
      if (nearMissRate > 0.1) {
        tunabilityStr = 'high';
      } else if (nearMissRate >= 0.02) {
        tunabilityStr = 'moderate';
      } else {
        tunabilityStr = 'low';
      }
    }

    // Format last-mile rate with N/A when no samples had all-siblings-pass
    // Include sample count (N) for statistical confidence assessment
    // For OR leaves, last-mile is conceptually meaningless (only one alternative needs to pass)
    let lastMileStr;
    if (isOrLeaf) {
      // OR alternatives are not "required" - only one needs to pass
      // Last-mile failure rate is meaningless for individual OR alternatives
      lastMileStr = 'N/A (OR alt)';
    } else if (typeof effectiveLastMileRate === 'number') {
      const pctStr = this.#formatPercentage(effectiveLastMileRate);
      // Show N and add warning indicator when sample size is low
      if (effectiveSupportCount > 0) {
        const warning = effectiveSupportCount < 10 ? '⚠️' : '';
        lastMileStr = `${pctStr} (N=${effectiveSupportCount})${warning}`;
      } else {
        lastMileStr = pctStr;
      }
    } else if (effectiveSupportCount === 0) {
      lastMileStr = 'N/A';
    } else {
      lastMileStr = '-';
    }

    let gatePassStr = '';
    let gateClampStr = '';
    let passGivenGateStr = '';
    let passInRegimeStr = '';
    if (includeGateMetrics) {
      if (this.#isEmotionThresholdLeaf(leaf)) {
        const inRegimePassCount =
          typeof inRegimeEvaluationCount === 'number' &&
          typeof inRegimeFailureCount === 'number'
            ? inRegimeEvaluationCount - inRegimeFailureCount
            : null;
        gatePassStr = this.#formatRateWithCounts(
          leaf.gatePassRateInRegime ?? null,
          leaf.gatePassInRegimeCount ?? null,
          inRegimeEvaluationCount ?? null
        );
        gateClampStr = this.#formatRateWithCounts(
          leaf.gateClampRateInRegime ?? null,
          leaf.gateFailInRegimeCount ?? null,
          inRegimeEvaluationCount
        );
        passGivenGateStr = this.#formatRateWithCounts(
          leaf.passRateGivenGateInRegime ?? null,
          leaf.gatePassAndClausePassInRegimeCount ?? null,
          leaf.gatePassInRegimeCount ?? null
        );
        passInRegimeStr = this.#formatRateWithCounts(
          leaf.inRegimePassRate ?? null,
          inRegimePassCount,
          inRegimeEvaluationCount ?? null
        );
      } else {
        gatePassStr = 'N/A';
        gateClampStr = 'N/A';
        passGivenGateStr = 'N/A';
        passInRegimeStr = 'N/A';
      }
    }

    const baseRow = `| ${index} | \`${description}\` | ${globalFailStr} | ${inRegimeFailStr} | ${evaluationCount} | ${boundObsStr} | ${thresholdStr} | ${gapStr} | ${tunabilityStr} | ${redundantStr} | ${clampTrivialStr} | ${lastMileStr} |`;
    if (!includeGateMetrics) {
      return baseRow;
    }

    return `${baseRow} ${gatePassStr} | ${gateClampStr} | ${passGivenGateStr} | ${passInRegimeStr} |`;
  }

  /**
   * Generate the leaf breakdown table for compound blockers.
   * Preserves OR/AND semantics by grouping conditions appropriately.
   * @private
   * @param {object} blocker - Blocker object with hierarchicalBreakdown
   * @param {number} sampleCount - Total sample count
   * @returns {string} Markdown section with structured leaf breakdown
   */
  #generateLeafBreakdown(blocker, sampleCount) {
    const hb = blocker.hierarchicalBreakdown ?? {};

    // Only generate for compound nodes with children
    if (!hb.isCompound || !hb.children || hb.children.length === 0) {
      return '';
    }

    // Build structured tree preserving AND/OR semantics
    const structured = this.#buildStructuredTree(hb);
    if (!structured) {
      return '';
    }

    // Generate the structured breakdown
    return this.#generateStructuredBreakdown(structured, sampleCount);
  }

  /**
   * Generate structured breakdown that preserves AND/OR semantics.
   * @private
   * @param {object} structured - Structured tree from #buildStructuredTree
   * @param {number} sampleCount - Total sample count
   * @returns {string} Markdown section
   */
  #generateStructuredBreakdown(structured, sampleCount) {
    const sections = [];
    let rowIndex = 1;
    let orBlockIndex = 1;

    // For top-level AND, process each child
    if (structured.type === 'and') {
      const andLeaves = [];
      const orBlocks = [];

      for (const child of structured.children) {
        if (child.type === 'leaf') {
          andLeaves.push(child);
        } else if (child.type === 'or') {
          orBlocks.push(child);
        } else if (child.type === 'and') {
          // Nested AND - flatten its leaves into the main AND section
          for (const grandchild of child.children) {
            if (grandchild.type === 'leaf') {
              andLeaves.push(grandchild);
            } else if (grandchild.type === 'or') {
              orBlocks.push(grandchild);
            }
          }
        }
      }

      // Generate required AND conditions section
      if (andLeaves.length > 0) {
        const andSection = this.#generateConditionGroup(
          'Required Conditions (ALL must pass)',
          andLeaves,
          sampleCount,
          rowIndex,
          null // No combined pass rate for AND - they're all required
        );
        sections.push(andSection.markdown);
        rowIndex = andSection.nextRowIndex;
      }

      // Generate OR block sections
      for (const orBlock of orBlocks) {
        const orBlockTitle = `OR Block #${orBlockIndex}`;
        const orPassRate = this.#calculateOrPassRate(orBlock.node);
        const orInRegimeFailureRate = this.#calculateOrInRegimeFailureRate(
          orBlock.node
        );
        const orSection = this.#generateConditionGroup(
          `${orBlockTitle} (ANY ONE must pass)`,
          orBlock.children,
          sampleCount,
          rowIndex,
          orPassRate,
          orInRegimeFailureRate
        );

        // Add OR contribution breakdown after the table
        const contributionBreakdown = this.#generateOrContributionBreakdown(
          orBlockTitle,
          orBlock.children
        );
        const overlapBreakdown = this.#generateOrOverlapBreakdown(
          orBlockTitle,
          orBlock.node,
          orBlock.children
        );

        sections.push(orSection.markdown + contributionBreakdown + overlapBreakdown);
        rowIndex = orSection.nextRowIndex;
        orBlockIndex++;
      }
    } else if (structured.type === 'or') {
      // Top-level OR (less common)
      const orPassRate = this.#calculateOrPassRate(structured.node);
      const orInRegimeFailureRate = this.#calculateOrInRegimeFailureRate(
        structured.node
      );
      const orSection = this.#generateConditionGroup(
        'OR Block (ANY ONE must pass)',
        structured.children,
        sampleCount,
        rowIndex,
        orPassRate,
        orInRegimeFailureRate
      );

      // Add OR contribution breakdown after the table
      const contributionBreakdown = this.#generateOrContributionBreakdown(
        'OR Block',
        structured.children
      );
      const overlapBreakdown = this.#generateOrOverlapBreakdown(
        'OR Block',
        structured.node,
        structured.children
      );

      sections.push(orSection.markdown + contributionBreakdown + overlapBreakdown);
    }

    if (sections.length === 0) {
      return '';
    }

    return `#### Condition Breakdown

${sections.join('\n\n')}`;
  }

  /**
   * Generate a condition group (AND or OR section) with table.
   * @private
   * @param {string} title - Group title
   * @param {object[]} children - Structured children
   * @param {number} sampleCount - Total samples
   * @param {number} startIndex - Starting row index
   * @param {number|null} combinedPassRate - For OR blocks, the combined pass rate
   * @returns {{markdown: string, nextRowIndex: number}}
   */
  #generateConditionGroup(
    title,
    children,
    sampleCount,
    startIndex,
    combinedPassRate,
    combinedInRegimeFailureRate = null
  ) {
    // For OR blocks, preserve nested AND structure for better readability
    // This helps users understand that conditions in a nested AND must ALL pass together
    const isOrBlock = combinedPassRate !== null;
    const entries = [];

    // Extract entries, preserving nested AND blocks as grouped units
    for (const child of children) {
      if (child.type === 'leaf') {
        entries.push({ type: 'leaf', node: child.node, groupLabel: null });
      } else if (child.type === 'and' && isOrBlock) {
        // Nested AND within OR - group these together
        const nestedLeaves = this.#flattenLeaves(child.node);
        if (nestedLeaves.length > 0) {
          entries.push({
            type: 'grouped_and',
            leaves: nestedLeaves,
            groupLabel: `AND Group (${nestedLeaves.length} conditions - all must pass together)`,
          });
        }
      } else {
        // For other nested compounds, flatten
        const nestedLeaves = this.#flattenLeaves(child.node);
        for (const leaf of nestedLeaves) {
          entries.push({ type: 'leaf', node: leaf, groupLabel: null });
        }
      }
    }

    if (entries.length === 0) {
      return { markdown: '', nextRowIndex: startIndex };
    }

    const includeGateMetrics = entries.some((entry) => {
      if (entry.type === 'leaf') {
        return this.#isEmotionThresholdLeaf(entry.node);
      }
      if (entry.type === 'grouped_and') {
        return entry.leaves.some((leaf) => this.#isEmotionThresholdLeaf(leaf));
      }
      return false;
    });

    const baseColumns = [
      '#',
      'Condition',
      'Fail% global',
      'Fail% \\| mood-pass',
      'Support',
      'Bound',
      'Threshold',
      'Gap',
      'Tunable',
      'Redundant (regime)',
      'Clamp-trivial (regime)',
      'Sole-Blocker Rate',
    ];
    const gateColumns = includeGateMetrics
      ? [
        'Gate pass (mood)',
        'Gate clamp (mood)',
        'Pass \\| gate (mood)',
        'Pass \\| mood (mood)',
      ]
      : [];
    const columns = baseColumns.concat(gateColumns);

    // Build header with appropriate columns
    // "Bound" column shows maxObserved for >= operators, minObserved for <= operators
    let header = `**${title}**\n\n`;
    header += `| ${columns.join(' | ')} |\n`;
    header += `|${columns.map(() => '---').join('|')}|`;

    // Generate rows with group labels for nested AND blocks
    const rows = [];
    let rowIndex = startIndex;

    for (const entry of entries) {
      if (entry.type === 'leaf') {
        // For OR blocks, mark leaves so last-mile shows N/A (OR alternatives aren't all required)
        rows.push(
          this.#generateLeafRow(
            entry.node,
            rowIndex,
            sampleCount,
            isOrBlock,
            includeGateMetrics
          )
        );
        rowIndex++;
      } else if (entry.type === 'grouped_and') {
        // Add a group marker row for nested AND blocks
        const emptyCells = columns.map(() => '');
        emptyCells[1] = `**${entry.groupLabel}**`;
        rows.push(`| ${emptyCells.join(' | ')} |`);
        // Add each leaf in the group with indentation
        // Note: Leaves inside a grouped AND within an OR are still OR alternatives
        // (the whole AND group is one alternative), so they also get isOrBlock=true
        for (const leaf of entry.leaves) {
          const leafRow = this.#generateLeafRow(
            leaf,
            rowIndex,
            sampleCount,
            isOrBlock,
            includeGateMetrics
          );
          // Add visual grouping indicator (└─) to the condition column
          const indentedRow = leafRow.replace(
            /\| (\d+) \| `([^`]+)`/,
            '| $1 | `└─ $2`'
          );
          rows.push(indentedRow);
          rowIndex++;
        }
      }
    }

    let footer = '';
    if (combinedPassRate !== null) {
      const combinedFailRate = 1 - combinedPassRate;
      const combinedFailStr = this.#formatFailRate(combinedFailRate);
      const combinedInRegimeFailStr = this.#formatFailRate(
        combinedInRegimeFailureRate
      );
      footer = `\n\n**Combined OR Block**: ${this.#formatPercentage(combinedPassRate)} pass rate (Fail% global: ${combinedFailStr} | Fail% \\| mood-pass: ${combinedInRegimeFailStr})`;
    }

    return {
      markdown: `${header}\n${rows.join('\n')}${footer}`,
      nextRowIndex: rowIndex,
    };
  }

  /**
   * Generate OR contribution breakdown showing which alternatives fire most often.
   * This helps users understand which OR alternatives are "carrying" the block
   * and which are rarely contributing.
   *
   * @private
   * @param {string} orBlockTitle - Title for the OR block (e.g., "OR Block #1")
   * @param {object[]} children - Structured children of the OR block
   * @returns {string} Markdown section with contribution breakdown
   */
  #generateOrContributionBreakdown(orBlockTitle, children) {
    // Collect contribution data from all leaf children (or nested ANDs)
    const contributions = [];

    for (const child of children) {
      if (child.node) {
        const node = child.node;
        let desc = node.description ?? 'Unknown condition';
        if (child.type === 'and') {
          const leaves = this.#flattenLeaves(node);
          desc = leaves.length > 0
            ? `(AND: ${leaves.map((l) => l.description ?? '?').join(' & ')})`
            : 'AND group';
        }
        contributions.push({
          description: desc,
          passRate: node.orPassRate,
          passCount: node.orPassCount ?? 0,
          exclusiveRate: node.orExclusivePassRate,
          exclusiveCount: node.orExclusivePassCount ?? 0,
          contributionRate: node.orContributionRate,
          contributionCount: node.orContributionCount ?? 0,
          successCount: node.orSuccessCount ?? 0,
        });
      }
    }

    // Filter to only those with contribution data
    const validContributions = contributions.filter(
      (c) => c.successCount > 0 || c.contributionCount > 0
    );

    if (validContributions.length === 0) {
      return '';
    }

    // Sort by pass rate descending, then contribution rate
    validContributions.sort((a, b) => {
      const rateA = a.passRate ?? 0;
      const rateB = b.passRate ?? 0;
      if (rateB !== rateA) return rateB - rateA;
      const contribA = a.contributionRate ?? 0;
      const contribB = b.contributionRate ?? 0;
      return contribB - contribA;
    });

    const totalSuccesses = validContributions[0]?.successCount ?? 0;
    if (totalSuccesses === 0) {
      return `\n\n**${orBlockTitle} OR Alternative Coverage**: No OR successes observed.`;
    }

    const header = `\n\n**${orBlockTitle} OR Alternative Coverage** (${totalSuccesses} total successes):`;
    const tableHeader = '| Alternative | P(alt passes \\| OR pass) | P(alt exclusively passes \\| OR pass) | First-pass share (order-dependent) |';
    const tableDivider = '|------------|---------------------------|------------------------------------|------------------------------------|';
    const rows = validContributions.map((c) => {
      const passRate =
        typeof c.passRate === 'number' ? this.#formatPercentage(c.passRate) : 'N/A';
      const exclusiveRate =
        typeof c.exclusiveRate === 'number'
          ? this.#formatPercentage(c.exclusiveRate)
          : 'N/A';
      const contributionRate =
        typeof c.contributionRate === 'number'
          ? this.#formatPercentage(c.contributionRate)
          : 'N/A';
      const passCountStr = `${c.passCount}/${c.successCount}`;
      const exclusiveCountStr = `${c.exclusiveCount}/${c.successCount}`;
      const contribCountStr = `${c.contributionCount}/${c.successCount}`;
      return `| \`${c.description}\` | ${passRate} (${passCountStr}) | ${exclusiveRate} (${exclusiveCountStr}) | ${contributionRate} (${contribCountStr}) |`;
    });

    const note = '\n*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*';

    return `${header}\n\n${tableHeader}\n${tableDivider}\n${rows.join('\n')}${note}`;
  }

  /**
   * Generate OR overlap breakdown with absolute union/exclusive/overlap rates.
   * @private
   * @param {string} orBlockTitle - Title for the OR block (e.g., "OR Block #1")
   * @param {object} orNode - OR node from hierarchical breakdown
   * @param {object[]} children - Structured children of the OR block
   * @returns {string} Markdown section with overlap breakdown
   */
  #generateOrOverlapBreakdown(orBlockTitle, orNode, children) {
    if (!orNode) {
      return '';
    }

    const evaluationCount = orNode.evaluationCount;
    if (!Number.isFinite(evaluationCount) || evaluationCount <= 0) {
      return '';
    }

    const idToLabel = new Map();
    for (const child of children ?? []) {
      if (!child?.node) {
        continue;
      }
      let desc = child.node.description ?? 'Unknown condition';
      if (child.type === 'and') {
        const leaves = this.#flattenLeaves(child.node);
        desc = leaves.length > 0
          ? `(AND: ${leaves.map((l) => l.description ?? '?').join(' & ')})`
          : 'AND group';
      }
      if (child.node.id) {
        idToLabel.set(child.node.id, desc);
      }
    }

    const childExclusiveCount = (children ?? []).reduce(
      (sum, child) => sum + (child?.node?.orExclusivePassCount ?? 0),
      0
    );

    const unionCount = Number.isFinite(orNode.orUnionPassCount)
      ? orNode.orUnionPassCount
      : evaluationCount - (orNode.failureCount ?? 0);
    const exclusiveCount = Number.isFinite(orNode.orBlockExclusivePassCount)
      ? orNode.orBlockExclusivePassCount
      : childExclusiveCount;
    const overlapCount = Math.max(0, unionCount - exclusiveCount);

    const formatRate = (count, denominator) => {
      if (!Number.isFinite(denominator) || denominator <= 0) {
        return 'N/A';
      }
      return `${this.#formatPercentage(count / denominator)} (${this.#formatCount(
        count
      )}/${this.#formatCount(denominator)})`;
    };

    const formatTopPair = (pairs, denominator) => {
      if (!Array.isArray(pairs) || pairs.length === 0) {
        return 'None';
      }
      const topPair = pairs.reduce(
        (best, current) =>
          current.passCount > best.passCount ? current : best,
        pairs[0]
      );
      const leftLabel = idToLabel.get(topPair.leftId) ?? topPair.leftId ?? '?';
      const rightLabel = idToLabel.get(topPair.rightId) ?? topPair.rightId ?? '?';
      const rateStr = formatRate(topPair.passCount ?? 0, denominator);
      return `\`${leftLabel}\` + \`${rightLabel}\` ${rateStr}`;
    };

    const rows = [
      `| Global | ${formatRate(unionCount, evaluationCount)} | ${formatRate(
        exclusiveCount,
        evaluationCount
      )} | ${formatRate(overlapCount, evaluationCount)} | ${formatTopPair(
        orNode.orPairPassCounts,
        evaluationCount
      )} |`,
    ];

    const inRegimeEvaluationCount = orNode.inRegimeEvaluationCount;
    if (
      Number.isFinite(inRegimeEvaluationCount) &&
      inRegimeEvaluationCount > 0
    ) {
      const inRegimeUnionCount = Number.isFinite(
        orNode.orUnionPassInRegimeCount
      )
        ? orNode.orUnionPassInRegimeCount
        : inRegimeEvaluationCount - (orNode.inRegimeFailureCount ?? 0);
      const inRegimeExclusiveCount = Number.isFinite(
        orNode.orBlockExclusivePassInRegimeCount
      )
        ? orNode.orBlockExclusivePassInRegimeCount
        : 0;
      const inRegimeOverlapCount = Math.max(
        0,
        inRegimeUnionCount - inRegimeExclusiveCount
      );
      rows.push(
        `| Mood regime | ${formatRate(
          inRegimeUnionCount,
          inRegimeEvaluationCount
        )} | ${formatRate(
          inRegimeExclusiveCount,
          inRegimeEvaluationCount
        )} | ${formatRate(
          inRegimeOverlapCount,
          inRegimeEvaluationCount
        )} | ${formatTopPair(
          orNode.orPairPassInRegimeCounts,
          inRegimeEvaluationCount
        )} |`
      );
    }

    const header = `\n\n**${orBlockTitle} OR Overlap (absolute rates)**:`;
    const tableHeader =
      '| Population | Union (any pass) | Exclusive (exactly one) | Overlap (2+ pass) | Top overlap pair |';
    const tableDivider = '|------------|------------------|------------------------|-------------------|------------------|';

    return `${header}\n\n${tableHeader}\n${tableDivider}\n${rows.join('\n')}`;
  }

  /**
   * Generate detailed analysis for the worst offending leaf conditions.
   * @private
   * @param {object} blocker - Blocker object with worstOffenders
   * @param {number} _sampleCount - Total sample count (reserved for future use)
   * @returns {string} Markdown section with worst offender analysis
   */
  #generateWorstOffenderAnalysis(blocker, _sampleCount) {
    // Use worstOffenders if available, otherwise extract from hierarchicalBreakdown
    let offenders = blocker.worstOffenders ?? [];
    const includeClampTrivial = blocker.includeClampTrivialOffenders === true;
    const leafByDescription = new Map();

    // If no worstOffenders, try to extract from hierarchicalBreakdown
    if (blocker.hierarchicalBreakdown) {
      const leaves = this.#flattenLeaves(blocker.hierarchicalBreakdown);
      for (const leaf of leaves) {
        const desc = leaf.description ?? null;
        if (typeof desc === 'string' && !leafByDescription.has(desc)) {
          leafByDescription.set(desc, leaf);
        }
      }
      if (offenders.length === 0) {
        offenders = leaves.filter((l) => (l.failureRate ?? 0) > 0.1);
      }
    }

    if (leafByDescription.size > 0) {
      offenders = offenders.map((offender) => {
        const desc = offender.description ?? null;
        const matched = typeof desc === 'string' ? leafByDescription.get(desc) : null;
        return matched ? { ...matched, ...offender } : offender;
      });
    }

    if (!includeClampTrivial) {
      offenders = offenders.filter(
        (offender) => !this.#resolveClampTrivialInRegime(offender)
      );
    }

    // Always deduplicate offenders by description to avoid listing the same condition twice
    // (e.g., emotions.anger >= 0.4 appearing in both Required AND and OR blocks)
    // Keep the instance with the higher score (more relevant)
    // Apply 70% penalty (multiply by 0.3) for OR-child leaves since they are alternatives,
    // not bottlenecks - if ANY alternative in an OR passes, the OR passes
    const seen = new Map();
    for (const offender of offenders) {
      const desc = offender.description ?? 'Unknown';
      const isOrChild = offender.parentNodeType === 'or';
      const orPenalty = isOrChild ? 0.3 : 1.0;
      const baseScore =
        (offender.siblingConditionedFailRate ?? offender.lastMileFailRate ?? 0) *
          0.6 +
        (offender.failureRate ?? 0) * 0.4;
      const score = baseScore * orPenalty;
      if (!seen.has(desc) || seen.get(desc).score < score) {
        seen.set(desc, { offender, score, isOrChild });
      }
    }
    const uniqueOffenders = Array.from(seen.values()).map((v) => ({
      ...v.offender,
      isOrChild: v.isOrChild,
    }));

    // Take top 5 by weighted score: prioritize last-mile failure over marginal failure
    // Last-mile (60%) tells us "is this THE bottleneck?" - more actionable
    // Marginal (40%) provides baseline failure context
    // OR-child leaves get 70% penalty as they are alternatives, not true bottlenecks
    offenders = uniqueOffenders
      .sort((a, b) => {
        const isOrChildA = a.parentNodeType === 'or' || a.isOrChild;
        const isOrChildB = b.parentNodeType === 'or' || b.isOrChild;
        const orPenaltyA = isOrChildA ? 0.3 : 1.0;
        const orPenaltyB = isOrChildB ? 0.3 : 1.0;
        const scoreA =
          ((a.siblingConditionedFailRate ?? a.lastMileFailRate ?? 0) * 0.6 +
          (a.failureRate ?? 0) * 0.4) * orPenaltyA;
        const scoreB =
          ((b.siblingConditionedFailRate ?? b.lastMileFailRate ?? 0) * 0.6 +
          (b.failureRate ?? 0) * 0.4) * orPenaltyB;
        return scoreB - scoreA;
      })
      .slice(0, 5);

    if (offenders.length === 0) {
      return '';
    }

    const analyses = offenders.map((offender, index) => {
      const rank = index + 1;
      const desc = offender.description ?? 'Unknown';
      const failureRate = offender.failureRate ?? 0;
      const inRegimeFailureRate = offender.inRegimeFailureRate ?? null;
      const inRegimeFailureCount = offender.inRegimeFailureCount ?? null;
      const inRegimeEvaluationCount = offender.inRegimeEvaluationCount ?? null;
      // Prefer sibling-conditioned rate for leaves in compounds
      const lastMileRate =
        offender.siblingConditionedFailRate ?? offender.lastMileFailRate;
      const ceilingGap = offender.ceilingGap;
      const nearMissRate = offender.nearMissRate;
      const maxObserved = offender.maxObservedValue;
      const threshold = offender.thresholdValue;
      const isOrChild = offender.parentNodeType === 'or' || offender.isOrChild;

      let lines = [];
      const globalFailStr = this.#formatFailRate(failureRate);
      const inRegimeFailStr = this.#formatFailRate(
        inRegimeFailureRate,
        inRegimeFailureCount,
        inRegimeEvaluationCount
      );
      // Add OR-alternative annotation if this is inside an OR block
      const orAnnotation = isOrChild ? ' ⚠️ OR-alternative' : '';
      lines.push(
        `**#${rank}: \`${desc}\`**${orAnnotation} (Fail% global: ${globalFailStr} | Fail% \\| mood-pass: ${inRegimeFailStr}${typeof lastMileRate === 'number' ? `, ${this.#formatPercentage(lastMileRate)} last-mile` : ''})`
      );

      // Add context note for OR alternatives
      if (isOrChild) {
        lines.push(`- ℹ️ This is an alternative within an OR block; other alternatives may cover this case`);
      }

      // Check for ceiling effect
      if (typeof ceilingGap === 'number' && ceilingGap > 0) {
        const maxStr = typeof maxObserved === 'number' ? this.#formatNumber(maxObserved) : 'N/A';
        const threshStr = typeof threshold === 'number' ? this.#formatNumber(threshold) : 'N/A';
        lines.push(`- ⚠️ **CEILING EFFECT**: Max observed (${maxStr}) never reaches threshold (${threshStr})`);
        lines.push(`- Recommendation: **adjust_upstream** - Modify prototypes/gates that produce this value`);
      } else if (typeof nearMissRate === 'number') {
        // Tunability-based recommendation
        if (nearMissRate > 0.1) {
          lines.push(`- Near-miss rate: ${this.#formatPercentage(nearMissRate)} (high tunability)`);
          lines.push(`- Recommendation: **tune_threshold** - Small adjustment will significantly improve trigger rate`);
        } else if (nearMissRate >= 0.02) {
          lines.push(`- Near-miss rate: ${this.#formatPercentage(nearMissRate)} (moderate tunability)`);
          lines.push(`- Recommendation: **tune_threshold** or **adjust_upstream** - Consider both options`);
        } else {
          lines.push(`- Values are far from threshold (low near-miss rate)`);
          lines.push(`- Recommendation: **adjust_upstream** - Review prototypes/generation rules`);
        }
      }

      return lines.join('\n');
    });

    return `#### Worst Offender Analysis\n\n${analyses.join('\n\n')}`;
  }

  // ========================================================================
  // Sensitivity Analysis Methods
  // ========================================================================

  #getSensitivityKindMetadata(kind, fallbackKind = 'marginalClausePassRateSweep') {
    const resolvedKind = kind ?? fallbackKind;

    switch (resolvedKind) {
      case 'expressionTriggerRateSweep':
        return {
          label: 'Global Expression Sensitivity',
          sectionTitle: 'Global Expression Sensitivity Analysis',
          sectionIntro:
            'This section shows how adjusting thresholds affects the **entire expression trigger rate**, not just individual clause pass rates.',
        };
      case 'marginalClausePassRateSweep':
      default:
        return {
          label: 'Marginal Clause Pass-Rate Sweep',
          sectionTitle: 'Marginal Clause Pass-Rate Sweep',
          sectionIntro:
            'This sweep shows how adjusting thresholds changes marginal clause pass rates across stored contexts.',
          disclaimer:
            'It does **not** estimate overall expression trigger rate.',
        };
    }
  }

  /**
   * Generate sensitivity analysis section showing how threshold changes affect pass rates.
   * @private
   * @param {import('./MonteCarloSimulator.js').SensitivityResult[]} sensitivityData - Sensitivity results
   * @returns {string} Markdown section or empty string
   */
  #generateSensitivityAnalysis(
    sensitivityData,
    populationSummary,
    storedPopulations,
    sweepWarningContext = null
  ) {
    if (!sensitivityData || sensitivityData.length === 0) {
      return '';
    }

    const kindMetadata = this.#getSensitivityKindMetadata(
      sensitivityData?.[0]?.kind,
      'marginalClausePassRateSweep'
    );
    const sections = sensitivityData.map((result) =>
      this.#formatSensitivityResult(result, sweepWarningContext)
    );

    const populationLabel =
      this.#formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedGlobal ?? null
      );

    const disclaimerLine = kindMetadata.disclaimer
      ? `${kindMetadata.disclaimer}\n`
      : '';

    return `## ${kindMetadata.sectionTitle}

${kindMetadata.sectionIntro}
${disclaimerLine}${populationLabel}${sections.join('\n\n')}`;
  }

  /**
   * Format a single sensitivity result as a markdown table.
   * @private
   * @param {import('./MonteCarloSimulator.js').SensitivityResult} result - Sensitivity result
   * @returns {string} Formatted markdown
   */
  #formatSensitivityResult(result, sweepWarningContext = null) {
    const { conditionPath, operator, originalThreshold, grid } = result;
    const isIntegerDomain = result?.isIntegerDomain === true;
    const kindMetadata = this.#getSensitivityKindMetadata(
      result?.kind,
      'marginalClausePassRateSweep'
    );

    if (!grid || grid.length === 0) {
      return '';
    }

    // Find the index of the original threshold in the grid
    const originalIndex = grid.findIndex(
      (pt) => Math.abs(pt.threshold - originalThreshold) < 0.001
    );

    // Build the table header
    const lines = [
      `### ${kindMetadata.label}: ${conditionPath} ${operator} [threshold]`,
      '',
      this.#formatSweepWarningsInline(
        this.#buildSweepWarningsForResult(result, {
          rateKey: 'passRate',
          scope: 'marginal',
          andOnly: sweepWarningContext?.andOnly === true,
          baselineTriggerRate:
            typeof sweepWarningContext?.baselineTriggerRate === 'number'
              ? sweepWarningContext.baselineTriggerRate
              : null,
        })
      ),
      isIntegerDomain
        ? '| Threshold | Effective Threshold | Pass Rate | Change | Samples |'
        : '| Threshold | Pass Rate | Change | Samples |',
      isIntegerDomain
        ? '|-----------|---------------------|-----------|--------|---------|'
        : '|-----------|-----------|--------|---------|',
    ];

    // Build table rows
    for (let i = 0; i < grid.length; i++) {
      const point = grid[i];
      const isOriginal = i === originalIndex;

      // Calculate change from original
      let changeStr = '—';
      if (originalIndex >= 0 && i !== originalIndex) {
        const originalRate = grid[originalIndex].passRate;
        if (originalRate > 0 && point.passRate > 0) {
          const multiplier = point.passRate / originalRate;
          if (multiplier > 1) {
            changeStr = `+${this.#formatNumber((multiplier - 1) * 100)}%`;
          } else if (multiplier < 1) {
            changeStr = `${this.#formatNumber((multiplier - 1) * 100)}%`;
          }
        } else if (originalRate === 0 && point.passRate > 0) {
          changeStr = '+∞';
        } else if (originalRate > 0 && point.passRate === 0) {
          changeStr = '-100%';
        }
      }

      // Format the row
      const thresholdStr = isOriginal
        ? `**${this.#formatThresholdValue(point.threshold, isIntegerDomain)}**`
        : this.#formatThresholdValue(point.threshold, isIntegerDomain);
      const rateStr = isOriginal
        ? `**${this.#formatPercentage(point.passRate)}**`
        : this.#formatPercentage(point.passRate);
      const samplesStr = point.sampleCount.toLocaleString();
      const changeDisplay = isOriginal
        ? '**baseline (stored contexts)**'
        : changeStr;

      if (isIntegerDomain) {
        const effectiveThresholdStr = isOriginal
          ? `**${this.#formatEffectiveThreshold(point.effectiveThreshold)}**`
          : this.#formatEffectiveThreshold(point.effectiveThreshold);
        lines.push(
          `| ${thresholdStr} | ${effectiveThresholdStr} | ${rateStr} | ${changeDisplay} | ${samplesStr} |`
        );
      } else {
        lines.push(
          `| ${thresholdStr} | ${rateStr} | ${changeDisplay} | ${samplesStr} |`
        );
      }
    }

    if (isIntegerDomain) {
      lines.push('');
      lines.push(
        '_Thresholds are integer-effective; decimals collapse to integer boundaries._'
      );
      lines.push('');
    }

    // Add recommendation if original threshold has very low pass rate
    const originalRate =
      originalIndex >= 0 ? grid[originalIndex].passRate : null;
    if (originalRate !== null && originalRate < 0.01) {
      // Find first threshold with meaningfully higher pass rate
      const betterOption = grid.find((pt) => pt.passRate >= originalRate * 10);
      if (betterOption && betterOption.threshold !== originalThreshold) {
        lines.push('');
        lines.push(
          `**💡 Recommendation**: Consider adjusting threshold to ${this.#formatThresholdValue(
            betterOption.threshold,
            isIntegerDomain
          )} for ~${this.#formatPercentage(betterOption.passRate)} pass rate.`
        );
      }
    }

    return lines.join('\n');
  }


  /**
   * Format global expression sensitivity results.
   * Shows how changing a threshold affects the ENTIRE expression trigger rate.
   *
   * @private
   * @param {object} result - Sensitivity result with isExpressionLevel: true
   * @returns {string} - Formatted markdown section
   */
  #formatGlobalSensitivityResult(result, sweepWarningContext = null) {
    const { varPath, operator, originalThreshold, grid } = result;
    const isIntegerDomain = result?.isIntegerDomain === true;
    const kindMetadata = this.#getSensitivityKindMetadata(
      result?.kind,
      'expressionTriggerRateSweep'
    );

    if (!grid || grid.length === 0) {
      return '';
    }

    // Find the index of the original threshold in the grid
    const originalIndex = grid.findIndex(
      (pt) => Math.abs(pt.threshold - originalThreshold) < 0.001
    );

    // Build the table header - note "Trigger Rate" instead of "Pass Rate"
    const lines = [
      `### 🎯 ${kindMetadata.label}: ${varPath} ${operator} [threshold]`,
      '',
      this.#formatSweepWarningsInline(
        this.#buildSweepWarningsForResult(result, {
          rateKey: 'triggerRate',
          scope: 'expression',
          andOnly: sweepWarningContext?.andOnly === true,
          baselineTriggerRate:
            typeof sweepWarningContext?.baselineTriggerRate === 'number'
              ? sweepWarningContext.baselineTriggerRate
              : null,
        })
      ),
      '> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.',
      '',
      isIntegerDomain
        ? '| Threshold | Effective Threshold | Trigger Rate | Change | Samples |'
        : '| Threshold | Trigger Rate | Change | Samples |',
      isIntegerDomain
        ? '|-----------|---------------------|--------------|--------|---------|'
        : '|-----------|--------------|--------|---------|',
    ];

    // Build table rows
    for (let i = 0; i < grid.length; i++) {
      const point = grid[i];
      const isOriginal = i === originalIndex;

      // Calculate change from original
      let changeStr = '—';
      if (originalIndex >= 0 && i !== originalIndex) {
        const originalRate = grid[originalIndex].triggerRate;
        if (originalRate > 0 && point.triggerRate > 0) {
          const multiplier = point.triggerRate / originalRate;
          if (multiplier > 1) {
            changeStr = `+${this.#formatNumber((multiplier - 1) * 100)}%`;
          } else if (multiplier < 1) {
            changeStr = `${this.#formatNumber((multiplier - 1) * 100)}%`;
          }
        } else if (originalRate === 0 && point.triggerRate > 0) {
          changeStr = '+∞';
        } else if (originalRate > 0 && point.triggerRate === 0) {
          changeStr = '-100%';
        } else if (originalRate === 0 && point.triggerRate === 0) {
          changeStr = '0%';
        }
      }

      // Format the row
      const thresholdStr = isOriginal
        ? `**${this.#formatThresholdValue(point.threshold, isIntegerDomain)}**`
        : this.#formatThresholdValue(point.threshold, isIntegerDomain);
      const rateStr = isOriginal
        ? `**${this.#formatPercentage(point.triggerRate)}**`
        : this.#formatPercentage(point.triggerRate);
      const samplesStr = point.sampleCount.toLocaleString();
      const changeDisplay = isOriginal
        ? '**baseline (stored contexts)**'
        : changeStr;

      if (isIntegerDomain) {
        const effectiveThresholdStr = isOriginal
          ? `**${this.#formatEffectiveThreshold(point.effectiveThreshold)}**`
          : this.#formatEffectiveThreshold(point.effectiveThreshold);
        lines.push(
          `| ${thresholdStr} | ${effectiveThresholdStr} | ${rateStr} | ${changeDisplay} | ${samplesStr} |`
        );
      } else {
        lines.push(
          `| ${thresholdStr} | ${rateStr} | ${changeDisplay} | ${samplesStr} |`
        );
      }
    }

    if (isIntegerDomain) {
      lines.push('');
      lines.push(
        '_Thresholds are integer-effective; decimals collapse to integer boundaries._'
      );
      lines.push('');
    }

    // Add recommendation if original threshold has very low trigger rate
    const originalRate =
      originalIndex >= 0 ? grid[originalIndex].triggerRate : null;
    if (originalRate !== null && originalRate === 0) {
      // Find first threshold where expression starts triggering
      const betterOption = grid.find((pt) => pt.triggerRate > 0);
      if (betterOption && betterOption.threshold !== originalThreshold) {
        lines.push('');
        lines.push(
          `**🎯 First threshold with triggers**: ${this.#formatThresholdValue(
            betterOption.threshold,
            isIntegerDomain
          )} → ${this.#formatPercentage(betterOption.triggerRate)} trigger rate`
        );
        lines.push(
          `**💡 Actionable Insight**: Adjusting threshold to ${this.#formatThresholdValue(
            betterOption.threshold,
            isIntegerDomain
          )} would achieve ~${this.#formatPercentage(
            betterOption.triggerRate
          )} expression trigger rate.`
        );
      } else {
        // No threshold in the grid produces triggers - suggest expanding search
        lines.push('');
        lines.push(
          `**⚠️ No Triggers Found**: None of the tested thresholds produced expression triggers. The expression may require more extreme threshold changes or other blocking conditions may dominate.`
        );
      }
    } else if (originalRate !== null && originalRate < 0.01) {
      // Find threshold with meaningfully higher trigger rate
      const betterOption = grid.find((pt) => pt.triggerRate >= originalRate * 5);
      if (betterOption && betterOption.threshold !== originalThreshold) {
        lines.push('');
        lines.push(
          `**💡 Actionable Insight**: Adjusting threshold to ${this.#formatThresholdValue(
            betterOption.threshold,
            isIntegerDomain
          )} would increase expression trigger rate to ~${this.#formatPercentage(
            betterOption.triggerRate
          )}.`
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate global sensitivity analysis section.
   * Shows how changing thresholds affects the entire expression, not just individual clauses.
   *
   * @private
   * @param {object[]} globalSensitivityData - Array of expression-level sensitivity results
   * @returns {string} - Formatted markdown section
   */
  #generateGlobalSensitivitySection(
    globalSensitivityData,
    populationSummary,
    storedPopulations,
    sweepWarningContext = null,
    fullSampleTriggerRate = null
  ) {
    if (!globalSensitivityData || globalSensitivityData.length === 0) {
      return '';
    }

    const kindMetadata = this.#getSensitivityKindMetadata(
      globalSensitivityData?.[0]?.kind,
      'expressionTriggerRateSweep'
    );
    const populationLabel =
      this.#formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedGlobal ?? null
      );
    const storedBaselineTriggerRate =
      typeof sweepWarningContext?.baselineTriggerRate === 'number'
        ? sweepWarningContext.baselineTriggerRate
        : null;
    const baselineParts = [];
    if (typeof fullSampleTriggerRate === 'number') {
      baselineParts.push(
        `**Baseline (full sample)**: ${this.#formatPercentage(fullSampleTriggerRate)}`
      );
    }
    if (typeof storedBaselineTriggerRate === 'number') {
      baselineParts.push(
        `**Baseline (stored contexts)**: ${this.#formatPercentage(
          storedBaselineTriggerRate
        )}`
      );
    }
    const baselineLine =
      baselineParts.length > 0 ? `${baselineParts.join(' | ')}\n` : '';

    // Check if baseline samples are sufficient for meaningful analysis
    // With < 5 baseline hits, sampling noise dominates and results are unreliable
    const lowConfidenceResults = globalSensitivityData.reduce(
      (acc, result) => {
        if (!result.grid || result.grid.length === 0) return acc;
        const originalIndex = result.grid.findIndex(
          (pt) => Math.abs(pt.threshold - result.originalThreshold) < 0.001
        );
        if (originalIndex < 0) return acc;
        const baseline = result.grid[originalIndex];
        // Calculate approximate baseline hits: triggerRate * sampleCount
        const estimatedHits = baseline.triggerRate * baseline.sampleCount;
        if (estimatedHits < 5) {
          acc.push({
            sampleCount: baseline.sampleCount,
            estimatedHits,
          });
        }
        return acc;
      },
      []
    );

    const lowConfidenceWarning = (() => {
      if (lowConfidenceResults.length === 0) {
        return '';
      }

      const populationName =
        storedPopulations?.storedGlobal?.name ??
        (populationSummary?.storedContextCount > 0
          ? 'stored contexts'
          : 'full sample');
      const sampleCount =
        lowConfidenceResults[0]?.sampleCount ?? populationSummary?.sampleCount;
      const estimatedHits = lowConfidenceResults[0]?.estimatedHits;
      const sampleCountStr = this.#formatCount(sampleCount);
      const hitCountStr = this.#formatCount(Math.round(estimatedHits ?? 0));

      return `> ⚠️ **Low confidence**: fewer than 5 baseline expression hits for population ${populationName} (N=${sampleCountStr}, hits≈${hitCountStr}). Global sensitivity tables are shown for reference.\n\n`;
    })();

    const sections = globalSensitivityData.map((result) =>
      this.#formatGlobalSensitivityResult(result, sweepWarningContext)
    );

    return `## ${kindMetadata.sectionTitle}

${kindMetadata.sectionIntro}
This is the key metric for tuning—it answers "What actually happens to the expression if I change this?"
${lowConfidenceWarning}${baselineLine}${populationLabel}${sections.join('\n\n')}`;
  }

  // ============================================================================
  // PROTOTYPE FIT ANALYSIS SECTIONS
  // ============================================================================

  /**
   * Perform prototype fit analysis using the ranking service.
   * @private
   * @param {Array|null} prerequisites - Expression prerequisites
   * @param {Array} storedContexts - Monte Carlo contexts
   * @returns {Object|null} Analysis results or null if service unavailable
   */
  #performPrototypeFitAnalysis(prerequisites, storedContexts) {
    if (!this.#prototypeFitRankingService || !prerequisites) {
      return null;
    }

    try {
      // Analyze all prototype fits
      const fitResults = this.#prototypeFitRankingService.analyzeAllPrototypeFit(
        prerequisites,
        storedContexts
      );

      // Compute implied prototype from prerequisites
      const impliedPrototype = this.#prototypeFitRankingService.computeImpliedPrototype(
        prerequisites,
        storedContexts
      );

      // Detect prototype gaps
      const gapDetection = this.#prototypeFitRankingService.detectPrototypeGaps(
        prerequisites,
        storedContexts
      );

      // Extract leaderboard array from fitResults object
      // analyzeAllPrototypeFit returns { leaderboard, currentPrototype, bestAlternative, improvementFactor }
      return { fitResults: fitResults?.leaderboard ?? [], impliedPrototype, gapDetection };
    } catch (err) {
      this.#logger.warn('Failed to perform prototype fit analysis:', err.message);
      return null;
    }
  }

  /**
   * Generate the Prototype Fit & Substitution section.
   * Shows top 10 prototypes ranked by how well they fit the expression's mood regime.
   * @private
   * @param {Array|null} fitResults - Results from analyzeAllPrototypeFit
   * @returns {string} Markdown section
   */
  #generatePrototypeFitSection(
    fitResults,
    populationSummary,
    storedPopulations,
    hasOrMoodConstraints = false
  ) {
    // Defensive: ensure fitResults is an array
    const results = Array.isArray(fitResults) ? fitResults : [];
    if (results.length === 0) {
      return '';
    }

    const top10 = results.slice(0, 10);
    const includeType = top10.some((result) => result.type === 'sexual');

    const orConstraintWarning = hasOrMoodConstraints
      ? this.#formatOrMoodConstraintWarning()
      : '';
    const populationLabel =
      this.#formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedMoodRegime ?? null
      );

    let section = `
## 🎯 Prototype Fit Analysis

Ranking of ${includeType ? 'emotion/sexual' : 'emotion'} prototypes by how well they fit this expression's mood regime.

${orConstraintWarning}${populationLabel}| Rank | Prototype |${includeType ? ' Type |' : ''} Gate Pass | P(I≥t) | Conflict | Composite |
|------|-----------|${includeType ? '------|' : ''}-----------|--------|----------|-----------|
`;

    for (const result of top10) {
      const gatePass = this.#formatPercentage(result.gatePassRate);
      const intensity = this.#formatPercentage(result.intensityDistribution?.pAboveThreshold ?? 0);
      const conflict = this.#formatPercentage(result.conflictScore);
      const composite = this.#formatNumber(result.compositeScore);

      const typeLabel = result.type === 'sexual' ? 'sexual' : 'emotion';
      section += `| ${result.rank} | **${result.prototypeId}** |${includeType ? ` ${typeLabel} |` : ''} ${gatePass} | ${intensity} | ${conflict} | ${composite} |\n`;
    }

    // Add details for top 3
    section += '\n### Top 3 Prototype Details\n\n';

    for (const result of top10.slice(0, 3)) {
      const typeLabel = result.type === 'sexual' ? 'sexual' : 'emotion';
      section += `#### ${result.rank}. ${result.prototypeId}${includeType ? ` (${typeLabel})` : ''}\n\n`;

      // Intensity distribution
      if (result.intensityDistribution) {
        const dist = result.intensityDistribution;
        section += `- **Intensity Distribution**: P50=${this.#formatNumber(dist.p50)}, P90=${this.#formatNumber(dist.p90)}, P95=${this.#formatNumber(dist.p95)}\n`;
      }

      // Conflicting axes
      if (result.conflictingAxes && result.conflictingAxes.length > 0) {
        const conflicts = result.conflictingAxes
          .map(c => `${c.axis} (weight=${this.#formatNumber(c.weight)}, wants ${c.direction})`)
          .join(', ');
        section += `- **Conflicting Axes**: ${conflicts}\n`;
        section += `- **Conflict Magnitude**: ${this.#formatNumber(result.conflictMagnitude)}\n`;
      } else {
        section += `- **Conflicting Axes**: None\n`;
      }

      section += '\n';
    }

    // Recommendations
    const currentPrototype = results.find(r => r.rank === 1);
    if (currentPrototype && results.length > 1) {
      const secondBest = results[1];
      if (secondBest.compositeScore > currentPrototype.compositeScore * 1.2) {
        section += `> **💡 Suggestion**: Consider using **${secondBest.prototypeId}** instead - it scores ${this.#formatNumber((secondBest.compositeScore / currentPrototype.compositeScore - 1) * 100)}% better for this mood regime.\n\n`;
      }
    }

    section += '---\n';
    return section;
  }

  /**
   * Generate the Implied Prototype section.
   * Shows prototypes that best match the expression's constraint "signature".
   * @private
   * @param {Object|null} impliedAnalysis - Results from computeImpliedPrototype
   * @returns {string} Markdown section
   */
  #generateImpliedPrototypeSection(
    impliedAnalysis,
    populationSummary,
    storedPopulations,
    hasOrMoodConstraints = false
  ) {
    if (!impliedAnalysis) {
      return '';
    }
    const includeType = ['bySimilarity', 'byGatePass', 'byCombined'].some(
      (key) => impliedAnalysis[key]?.some((result) => result.type === 'sexual')
    );

    const orConstraintWarning = hasOrMoodConstraints
      ? this.#formatOrMoodConstraintWarning()
      : '';
    const populationLabel =
      this.#formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedMoodRegime ?? null
      );

    let section = `## 🧭 Implied Prototype from Prerequisites

Analysis of which prototypes best match the expression's constraint pattern.

${orConstraintWarning}${populationLabel}
`;

    // Target signature
    if (impliedAnalysis.targetSignature && impliedAnalysis.targetSignature.size > 0) {
      section += '### Target Signature\n\n';
      section += '| Axis | Direction | Importance |\n';
      section += '|------|-----------|------------|\n';

      for (const [axis, data] of impliedAnalysis.targetSignature) {
        const direction = data.direction > 0 ? '↑ High' : data.direction < 0 ? '↓ Low' : '— Neutral';
        section += `| ${axis} | ${direction} | ${this.#formatNumber(data.importance)} |\n`;
      }
      section += '\n';
    }

    // Top by similarity
    if (impliedAnalysis.bySimilarity && impliedAnalysis.bySimilarity.length > 0) {
      section += '### Top 5 by Cosine Similarity\n\n';
      section += `| Rank | Prototype |${includeType ? ' Type |' : ''} Similarity | Gate Pass | Combined |\n`;
      section += `|------|-----------|${includeType ? '------|' : ''}------------|-----------|----------|\n`;

      for (let i = 0; i < Math.min(5, impliedAnalysis.bySimilarity.length); i++) {
        const r = impliedAnalysis.bySimilarity[i];
        const typeLabel = r.type === 'sexual' ? 'sexual' : 'emotion';
        section += `| ${i + 1} | **${r.prototypeId}** |${includeType ? ` ${typeLabel} |` : ''} ${this.#formatNumber(r.cosineSimilarity)} | ${this.#formatPercentage(r.gatePassRate)} | ${this.#formatNumber(r.combinedScore)} |\n`;
      }
      section += '\n';
    }

    // Top by gate pass
    if (impliedAnalysis.byGatePass && impliedAnalysis.byGatePass.length > 0) {
      section += '### Top 5 by Gate Pass Rate\n\n';
      section += `| Rank | Prototype |${includeType ? ' Type |' : ''} Gate Pass | Similarity | Combined |\n`;
      section += `|------|-----------|${includeType ? '------|' : ''}-----------|------------|----------|\n`;

      for (let i = 0; i < Math.min(5, impliedAnalysis.byGatePass.length); i++) {
        const r = impliedAnalysis.byGatePass[i];
        const typeLabel = r.type === 'sexual' ? 'sexual' : 'emotion';
        section += `| ${i + 1} | **${r.prototypeId}** |${includeType ? ` ${typeLabel} |` : ''} ${this.#formatPercentage(r.gatePassRate)} | ${this.#formatNumber(r.cosineSimilarity)} | ${this.#formatNumber(r.combinedScore)} |\n`;
      }
      section += '\n';
    }

    // Top combined
    if (impliedAnalysis.byCombined && impliedAnalysis.byCombined.length > 0) {
      section += '### Top 5 by Combined Score\n\n';
      section += `| Rank | Prototype |${includeType ? ' Type |' : ''} Combined | Similarity | Gate Pass |\n`;
      section += `|------|-----------|${includeType ? '------|' : ''}----------|------------|----------|\n`;

      for (let i = 0; i < Math.min(5, impliedAnalysis.byCombined.length); i++) {
        const r = impliedAnalysis.byCombined[i];
        const typeLabel = r.type === 'sexual' ? 'sexual' : 'emotion';
        section += `| ${i + 1} | **${r.prototypeId}** |${includeType ? ` ${typeLabel} |` : ''} ${this.#formatNumber(r.combinedScore)} | ${this.#formatNumber(r.cosineSimilarity)} | ${this.#formatPercentage(r.gatePassRate)} |\n`;
      }
      section += '\n';
    }

    section += '---\n';
    return section;
  }

  /**
   * Generate the Gap Detection section.
   * Identifies if there's a "missing prototype" gap in prototype space.
   * @private
   * @param {Object|null} gapResult - Results from detectPrototypeGaps
   * @returns {string} Markdown section
   */
  #generateGapDetectionSection(gapResult, populationSummary, storedPopulations) {
    if (!gapResult) {
      return '';
    }

    const populationLabel =
      this.#formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedMoodRegime ?? null
      );

    let section = `## 🔍 Prototype Gap Detection

Analysis of prototype coverage in "prototype space".

${populationLabel}
`;

    // Gap status
    if (gapResult.gapDetected) {
      section += `### ⚠️ Coverage Gap Detected

**Nearest Distance**: ${this.#formatNumber(gapResult.nearestDistance)} (threshold: 0.5)

`;
      if (gapResult.distanceContext) {
        section += `**Distance Context**: ${gapResult.distanceContext}\n\n`;
      }
      if (gapResult.coverageWarning) {
        section += `> ${gapResult.coverageWarning}\n\n`;
      }
    } else {
      section += `### ✅ Good Coverage

**Nearest Distance**: ${this.#formatNumber(gapResult.nearestDistance)} - within acceptable range.

`;
      if (gapResult.distanceContext) {
        section += `**Distance Context**: ${gapResult.distanceContext}\n\n`;
      }
    }

    // k-Nearest neighbors
    if (gapResult.kNearestNeighbors && gapResult.kNearestNeighbors.length > 0) {
      const includeType = gapResult.kNearestNeighbors.some(
        (neighbor) => neighbor.type === 'sexual'
      );
      section += '### k-Nearest Prototypes\n\n';
      section += `| Rank | Prototype |${includeType ? ' Type |' : ''} Distance | Weight Dist | Gate Dist |\n`;
      section += `|------|-----------|${includeType ? '------|' : ''}----------|-------------|----------|\n`;

      for (let i = 0; i < gapResult.kNearestNeighbors.length; i++) {
        const n = gapResult.kNearestNeighbors[i];
        const typeLabel = n.type === 'sexual' ? 'sexual' : 'emotion';
        section += `| ${i + 1} | **${n.prototypeId}** |${includeType ? ` ${typeLabel} |` : ''} ${this.#formatNumber(n.combinedDistance)} | ${this.#formatNumber(n.weightDistance)} | ${this.#formatNumber(n.gateDistance)} |\n`;
      }
      section += '\n';
    }

    // Suggested prototype
    if (gapResult.suggestedPrototype) {
      const suggested = gapResult.suggestedPrototype;
      section += '### 💡 Suggested New Prototype\n\n';

      if (suggested.rationale) {
        section += `**Rationale**: ${suggested.rationale}\n\n`;
      }

      // Suggested weights
      if (suggested.weights && Object.keys(suggested.weights).length > 0) {
        section += '**Suggested Weights**:\n\n';
        section += '| Axis | Weight |\n';
        section += '|------|--------|\n';

        const sortedWeights = Object.entries(suggested.weights)
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

        for (const [axis, weight] of sortedWeights) {
          section += `| ${axis} | ${this.#formatNumber(weight)} |\n`;
        }
        section += '\n';
      }

      // Suggested gates
      if (suggested.gates && suggested.gates.length > 0) {
        section += '**Suggested Gates**:\n\n';
        for (const gate of suggested.gates) {
          section += `- \`${gate}\`\n`;
        }
        section += '\n';
      }
    }

    section += '---\n';
    return section;
  }

  /**
   * Generate the legend section (appears once at end of report).
   * @returns {string}
   */
  #generateLegend() {
    return `## Legend

### Global Metrics
- **Trigger Rate**: Probability (0-100%) that the expression evaluates to true across random samples
- **Confidence Interval**: 95% Wilson score interval indicating statistical certainty of the trigger rate
- **Sample Size**: Number of random state pairs generated for simulation
- **Rarity Categories**: impossible (0%), extremely_rare (<0.001%), rare (<0.05%), normal (<2%), frequent (>=2%)

### Per-Clause Metrics
- **Fail% global**: Percentage of samples where this specific clause evaluated to false (unconditional)
- **Fail% | mood-pass**: Percentage of samples where this clause evaluated to false within the mood regime
- **Gate pass (mood)**: Percentage of mood-regime samples where gates passed (emotion-threshold clauses only)
- **Gate clamp (mood)**: Percentage of mood-regime samples where gates failed and the final intensity was clamped to 0 (emotion-threshold clauses only)
- **Pass | gate (mood)**: Percentage of gate-pass samples that passed the threshold within the mood regime (emotion-threshold clauses only)
- **Pass | mood (mood)**: Percentage of mood-regime samples that passed the threshold (emotion-threshold clauses only)
- **Support**: Number of samples evaluated for this clause (evaluation count)
- **Clamp-trivial (regime)**: Clause is trivially satisfied because gates always clamp intensity to 0 in regime (<= or < thresholds only)
- **Violation Magnitude**: How far the actual value was from the threshold when the clause failed
- **P50 (Median)**: Middle value of violations; 50% of failures had violations at or below this
- **P90 (90th Percentile)**: 90% of failures had violations at or below this; indicates severity of worst cases
- **P95 (95th Percentile)**: 95% of failures had violations at or below this; shows extreme violations
- **P99 (99th Percentile)**: 99% of failures had violations at or below this; identifies outlier violations
- **Min Observed**: Lowest value observed for this variable across all samples
- **Mean Observed**: Average value observed for this variable across all samples
- **Near-Miss Rate**: Percentage of ALL samples where the value was within epsilon of the threshold (close calls)
- **Epsilon**: The tolerance distance used to detect near-misses (typically 5% of value range)
- **Sole-Blocker Rate (N)**: Failure rate among samples where ALL OTHER clauses passed. N differs per clause because each clause excludes itself from the "others" check: Clause A's N = samples where B,C,D... passed; Clause B's N = samples where A,C,D... passed. This variance is mathematically correct and order-invariant
- **Bound**: The relevant extreme value for verifying Gap. For \`>=\` operators: Max Observed (highest value seen). For \`<=\` operators: Min Observed (lowest value seen)
- **Ceiling Gap**: Direction-aware calculation. For \`>=\` operators: (Threshold - Max Observed). For \`<=\` operators: (Min Observed - Threshold). Positive = threshold unreachable; negative = threshold achievable

### Tunability Levels
- **High**: >10% near-miss rate; threshold adjustments will help significantly
- **Moderate**: 2-10% near-miss rate; threshold adjustments may help somewhat
- **Low**: <2% near-miss rate; threshold adjustments won't help; fix upstream

### Severity Levels
- **Critical**: Ceiling detected or fundamentally broken condition
- **High**: Decisive blocker with tuning potential
- **Medium**: Moderate contributor to failures
- **Low**: Other clauses fail first; lower priority

### Recommended Actions
- **redesign**: Condition is fundamentally problematic; rethink the logic
- **tune_threshold**: Adjust threshold value; quick win available
- **adjust_upstream**: Modify prototypes, gates, or weights that feed this variable
- **lower_priority**: Focus on other blockers first
- **investigate**: Needs further analysis

### Problem Flags
- **[CEILING]**: Threshold is unreachable (max observed never reaches threshold)
- **[DECISIVE]**: This clause is the primary bottleneck
- **[TUNABLE]**: Many samples are borderline; small adjustments help
- **[UPSTREAM]**: Values are far from threshold; fix upstream data
- **[OUTLIERS-SKEW]**: Median violation much lower than mean (outliers skew average)
- **[SEVERE-TAIL]**: Some samples fail badly while most are moderate
`;
  }

  /**
   * Generate the static analysis cross-reference section.
   * Compares static analysis findings with Monte Carlo observations.
   * @param {object|null} staticAnalysis - Static analysis results
   * @param {object[]} blockers - MC blocker results for comparison
   * @returns {string}
   */
  #generateStaticCrossReference(staticAnalysis, blockers) {
    // Skip section if no static analysis data
    if (
      !staticAnalysis ||
      ((!staticAnalysis.gateConflicts || staticAnalysis.gateConflicts.length === 0) &&
        (!staticAnalysis.unreachableThresholds || staticAnalysis.unreachableThresholds.length === 0))
    ) {
      return '';
    }

    const lines = [
      '## Static Analysis Cross-Reference',
      '',
      'This section compares findings from static analysis with Monte Carlo observations.',
      '',
    ];

    // Gate Conflicts Section
    if (staticAnalysis.gateConflicts && staticAnalysis.gateConflicts.length > 0) {
      lines.push('### Gate Conflicts');
      lines.push('');
      lines.push('| Axis | Conflict | Static Result | MC Confirmation |');
      lines.push('|------|----------|---------------|-----------------|');

      for (const conflict of staticAnalysis.gateConflicts) {
        const axis = conflict.axis || 'unknown';
        const conflictDesc = this.#formatGateConflict(conflict);
        const mcConfirmation = this.#checkMcConfirmation(axis, blockers);

        lines.push(`| ${axis} | ${conflictDesc} | ❌ Impossible | ${mcConfirmation} |`);
      }

      lines.push('');
    }

    // Unreachable Thresholds Section
    if (staticAnalysis.unreachableThresholds && staticAnalysis.unreachableThresholds.length > 0) {
      lines.push('### Unreachable Thresholds');
      lines.push('');
      lines.push('| Prototype | Required | Max Possible | Gap | MC Confirmation |');
      lines.push('|-----------|----------|--------------|-----|-----------------|');

      for (const issue of staticAnalysis.unreachableThresholds) {
        const prototypeId = issue.prototypeId || 'unknown';
        const threshold = typeof issue.threshold === 'number' ? this.#formatNumber(issue.threshold) : '?';
        const maxPossible = typeof issue.maxPossible === 'number' ? this.#formatNumber(issue.maxPossible) : '?';
        const gap = typeof issue.threshold === 'number' && typeof issue.maxPossible === 'number'
          ? this.#formatNumber(issue.threshold - issue.maxPossible)
          : '?';
        const mcConfirmation = this.#checkEmotionMcConfirmation(prototypeId, blockers);

        lines.push(`| ${prototypeId} | ${threshold} | ${maxPossible} | +${gap} | ${mcConfirmation} |`);
      }

      lines.push('');
    }

    // Summary
    lines.push('### Cross-Reference Summary');
    lines.push('');

    const totalStaticIssues =
      (staticAnalysis.gateConflicts?.length || 0) +
      (staticAnalysis.unreachableThresholds?.length || 0);

    const hasMcBlockers = blockers && blockers.length > 0;

    if (totalStaticIssues > 0 && hasMcBlockers) {
      lines.push('✅ **Confirmed**: Static analysis issues are corroborated by Monte Carlo simulation.');
    } else if (totalStaticIssues > 0 && !hasMcBlockers) {
      lines.push('⚠️ **Discrepancy**: Static analysis found issues but MC shows no blockers. May indicate path-sensitivity.');
    } else {
      lines.push('✅ **Agreement**: Both analyses agree on the expression state.');
    }

    lines.push('');

    return lines.join('\n');
  }

  /**
   * Format a gate conflict for display.
   * @param {object} conflict - Gate conflict info
   * @returns {string}
   */
  #formatGateConflict(conflict) {
    if (conflict.description) {
      return conflict.description;
    }

    const requiredMin = conflict.requiredMin;
    const requiredMax = conflict.requiredMax;

    if (typeof requiredMin === 'number' && typeof requiredMax === 'number') {
      if (requiredMin > requiredMax) {
        return `Requires ≥${this.#formatNumber(requiredMin)} AND ≤${this.#formatNumber(requiredMax)}`;
      }
    }

    return 'Conflicting constraints';
  }

  /**
   * Check if MC results confirm a static analysis finding for an axis.
   * @param {string} axis - Axis name to check
   * @param {object[]} blockers - MC blockers
   * @returns {string} Confirmation status string
   */
  #checkMcConfirmation(axis, blockers) {
    if (!blockers || blockers.length === 0) {
      return '— No MC data';
    }

    // Check if any blocker references this axis
    for (const blocker of blockers) {
      const varPath = blocker.hierarchicalBreakdown?.variablePath || '';
      if (varPath.includes(axis) || varPath.includes(`moodAxes.${axis}`)) {
        const failRate = blocker.hierarchicalBreakdown?.failureRate;
        const inRegimeFailRate = blocker.hierarchicalBreakdown?.inRegimeFailureRate;
        if (typeof failRate === 'number') {
          return `✅ Fail% global: ${this.#formatPercentage(failRate)} | Fail% \\| mood-pass: ${this.#formatPercentage(inRegimeFailRate)}`;
        }
        return '✅ Confirmed';
      }
    }

    return '— Not observed';
  }

  /**
   * Check if MC results confirm a static analysis finding for an emotion.
   * @param {string} prototypeId - Emotion/sexual prototype ID
   * @param {object[]} blockers - MC blockers
   * @returns {string} Confirmation status string
   */
  #checkEmotionMcConfirmation(prototypeId, blockers) {
    if (!blockers || blockers.length === 0) {
      return '— No MC data';
    }

    // Check if any blocker references this emotion/prototype
    for (const blocker of blockers) {
      const varPath = blocker.hierarchicalBreakdown?.variablePath || '';
      if (varPath.includes(`emotions.${prototypeId}`) || varPath.includes(`sexualStates.${prototypeId}`)) {
        const failRate = blocker.hierarchicalBreakdown?.failureRate;
        const inRegimeFailRate = blocker.hierarchicalBreakdown?.inRegimeFailureRate;
        if (typeof failRate === 'number') {
          return `✅ Fail% global: ${this.#formatPercentage(failRate)} | Fail% \\| mood-pass: ${this.#formatPercentage(inRegimeFailRate)}`;
        }
        return '✅ Confirmed';
      }
    }

    return '— Not observed';
  }

  /**
   * Format a value as a percentage (0-100 scale with % suffix).
   * Handles small values specially to avoid misleading "0.00%" display.
   *
   * @param {number} value - Value in 0-1 range
   * @param {number} decimals - Default decimal places (increased for small values)
   * @returns {string}
   */
  #formatPercentage(value, decimals = 2) {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
      return 'N/A';
    }

    // Handle exact zero
    if (value === 0) {
      return '0.00%';
    }

    const pct = value * 100;

    // For very small non-zero values, show more precision or use descriptive format
    // 0.01% = 0.0001 in value, 0.001% = 0.00001, etc.
    if (pct > 0 && pct < 0.01) {
      // For extremely small values (< 0.001%), use scientific notation
      if (pct < 0.001) {
        return `${pct.toExponential(2)}%`;
      }
      // For small values (0.001% to 0.01%), show 4 decimal places
      return `${pct.toFixed(4)}%`;
    }

    // For values that would round to 0.00, show more precision
    if (pct > 0 && pct < 0.005) {
      return `${pct.toFixed(3)}%`;
    }

    return `${pct.toFixed(decimals)}%`;
  }

  #formatSignedPercentagePoints(value) {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
      return 'N/A';
    }
    const points = value * 100;
    const sign = points > 0 ? '+' : points < 0 ? '-' : '';
    return `${sign}${Math.abs(points).toFixed(2)} pp`;
  }

  /**
   * Format a number with specified decimal places.
   * @param {number} value
   * @param {number} decimals
   * @returns {string}
   */
  #formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
      return 'N/A';
    }
    return value.toFixed(decimals);
  }

  /**
   * Format threshold values with integer-domain awareness.
   * @param {number} value
   * @param {boolean} isIntegerDomain
   * @returns {string}
   */
  #formatThresholdValue(value, isIntegerDomain) {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
      return 'N/A';
    }

    if (isIntegerDomain) {
      const rounded = Math.round(value);
      if (Math.abs(value - rounded) < 0.000001) {
        return String(rounded);
      }
    }

    return this.#formatNumber(value);
  }

  /**
   * Format effective thresholds for integer domains.
   * @param {number|null} value
   * @returns {string}
   */
  #formatEffectiveThreshold(value) {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
      return '—';
    }
    return String(Math.round(value));
  }

  /**
   * Determine rarity category based on trigger rate.
   * @param {number} triggerRate - Value in 0-1 range
   * @returns {string}
   */
  #getRarityCategory(triggerRate) {
    if (triggerRate === 0) return 'unobserved';
    if (triggerRate < 0.00001) return 'extremely_rare';
    if (triggerRate < 0.0005) return 'rare';
    if (triggerRate < 0.02) return 'normal';
    return 'frequent';
  }
}

export default MonteCarloReportGenerator;
