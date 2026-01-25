/**
 * @file ReportIntegrityAnalyzer - Collects and analyzes report integrity warnings
 * @description Extracted from MonteCarloReportGenerator for cohesive integrity analysis responsibility.
 * Handles warning collection for gate/final mismatches, sweep monotonicity, and mood regime issues.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { evaluateConstraint, getNestedValue } from '../utils/moodRegimeUtils.js';
import GateConstraint from '../models/GateConstraint.js';
import { resolveAxisValue } from '../utils/axisNormalizationUtils.js';
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

/**
 * Analyzes report integrity and collects warnings for Monte Carlo simulation results.
 * Responsible for detecting gate/final mismatches, sweep monotonicity violations,
 * and mood regime hash inconsistencies.
 */
class ReportIntegrityAnalyzer {
  #formattingService;
  #statisticalService;
  #treeTraversal;
  #dataExtractor;
  #prototypeConstraintAnalyzer;
  #logger;

  /**
   * @param {object} deps
   * @param {import('./ReportFormattingService.js').default} deps.formattingService - Required formatting service
   * @param {import('./StatisticalComputationService.js').default} deps.statisticalService - Required statistical computation service
   * @param {import('./BlockerTreeTraversal.js').default} deps.treeTraversal - Required tree traversal service
   * @param {import('./ReportDataExtractor.js').default} deps.dataExtractor - Required data extractor service
   * @param {import('./PrototypeConstraintAnalyzer.js').default} [deps.prototypeConstraintAnalyzer] - Optional analyzer for prototype math
   * @param {import('../../interfaces/coreServices.js').ILogger} [deps.logger] - Optional logger
   */
  constructor({
    formattingService,
    statisticalService,
    treeTraversal,
    dataExtractor,
    prototypeConstraintAnalyzer = null,
    logger = null,
  }) {
    if (!formattingService) {
      throw new Error('ReportIntegrityAnalyzer requires formattingService');
    }
    if (!statisticalService) {
      throw new Error('ReportIntegrityAnalyzer requires statisticalService');
    }
    if (!treeTraversal) {
      throw new Error('ReportIntegrityAnalyzer requires treeTraversal');
    }
    if (!dataExtractor) {
      throw new Error('ReportIntegrityAnalyzer requires dataExtractor');
    }
    if (logger) {
      validateDependency(logger, 'ILogger', console, {
        requiredMethods: ['info', 'warn', 'error', 'debug'],
      });
    }
    this.#formattingService = formattingService;
    this.#statisticalService = statisticalService;
    this.#treeTraversal = treeTraversal;
    this.#dataExtractor = dataExtractor;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
    this.#logger = logger;
  }

  /**
   * Collects all integrity warnings for the report.
   * This is the main public API that delegates to internal collection methods.
   * @param {object} params
   * @param {object[]} params.blockers - Analyzed blockers from FailureExplainer
   * @param {Map} params.axisConstraints - Axis constraints map
   * @param {object[]} params.storedContexts - Stored simulation contexts
   * @param {object[]} params.moodConstraints - Mood constraints for filtering
   * @param {object} params.storedPopulations - Population metadata
   * @param {object} params.simulationResult - Raw simulation result
   * @param {object[]} [params.sensitivityData] - Sensitivity analysis results
   * @param {object[]} [params.globalSensitivityData] - Global sensitivity results
   * @returns {Array<object>} Array of integrity warning objects
   */
  collect({
    blockers,
    axisConstraints,
    storedContexts,
    moodConstraints,
    storedPopulations,
    simulationResult,
    sensitivityData = [],
    globalSensitivityData = [],
  }) {
    const sweepWarningContext = this.#buildSweepWarningContext({
      blockers,
      globalSensitivityData,
    });

    const sweepWarnings = this.#collectSweepIntegrityWarnings({
      sensitivityData,
      globalSensitivityData,
      sweepWarningContext,
    });

    const contextWarnings = this.#collectReportIntegrityWarnings({
      blockers,
      axisConstraints,
      storedContexts,
      moodConstraints,
      storedPopulations,
      simulationResult,
    });

    return this.#mergeReportIntegrityWarnings(sweepWarnings, contextWarnings);
  }

  /**
   * Build context needed for sweep warning evaluation.
   * @private
   * @param {object} params
   * @param {object[]} params.blockers
   * @param {object[]} params.globalSensitivityData
   * @returns {object}
   */
  #buildSweepWarningContext({ blockers, globalSensitivityData }) {
    return {
      andOnly: this.#treeTraversal.isAndOnlyBlockers(blockers),
      baselineTriggerRate: this.#dataExtractor.extractBaselineTriggerRate(globalSensitivityData),
    };
  }

  /**
   * Collect sweep-related integrity warnings from sensitivity data.
   * @private
   * @param {object} params
   * @param {object[]} params.sensitivityData
   * @param {object[]} params.globalSensitivityData
   * @param {object} params.sweepWarningContext
   * @returns {Array<object>}
   */
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

  /**
   * Build sweep warnings for a single sensitivity result.
   * @private
   * @param {object} result
   * @param {object} context
   * @param {string} context.rateKey
   * @param {string} context.scope
   * @param {boolean} context.andOnly
   * @param {number|null} context.baselineTriggerRate
   * @returns {Array<object>}
   */
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
            message: `Stored-context trigger rate (${this.#formattingService.formatPercentage(
              baselineTriggerRate
            )}) exceeds clause pass rate (${this.#formattingService.formatPercentage(
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

  /**
   * Merge two arrays of warnings, deduplicating by key fields.
   * @private
   * @param {Array<object>} existing
   * @param {Array<object>} incoming
   * @returns {Array<object>}
   */
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
   * Analyze an emotion condition using prototype constraint analyzer.
   * @private
   * @param {object} condition
   * @param {Map} axisConstraints
   * @returns {object|null}
   */
  #analyzeEmotionCondition(condition, axisConstraints) {
    if (!this.#prototypeConstraintAnalyzer) {
      return null;
    }
    try {
      return this.#prototypeConstraintAnalyzer.analyzeEmotionThreshold(
        condition.prototypeId,
        condition.type,
        condition.threshold,
        axisConstraints,
        condition.operator ?? '>='
      );
    } catch (err) {
      if (this.#logger) {
        this.#logger.warn(
          `Failed to analyze ${condition.type} condition ${condition.prototypeId}:`,
          err.message
        );
      }
      return null;
    }
  }

  /**
   * Check if a context matches all mood constraints.
   * @private
   * @param {object} context
   * @param {object[]} moodConstraints
   * @returns {boolean}
   */
  #contextMatchesConstraints(context, moodConstraints) {
    if (!Array.isArray(moodConstraints) || moodConstraints.length === 0) {
      return true;
    }

    return moodConstraints.every((constraint) => {
      // Use the canonical getNestedValue from moodRegimeUtils for consistency
      // with MonteCarloSimulator's population hash calculation
      const value = getNestedValue(context, constraint.varPath);
      return evaluateConstraint(value, constraint.operator, constraint.threshold);
    });
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
      this.#dataExtractor.extractEmotionConditions(
        blocker,
        (node) => this.#treeTraversal.flattenLeaves(node)
      )
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
        hasImpossibleConstraints,
      } = analysis;
      const path = this.#dataExtractor.getPrototypeContextPath(type, prototypeId);

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
          const traceSignals = this.#dataExtractor.getGateTraceSignals(
            context,
            type,
            prototypeId
          );
          let gatePass = traceSignals ? Boolean(traceSignals.gatePass) : true;

          if (!traceSignals && parsedGates.length > 0) {
            const normalized = this.#statisticalService.normalizeContextAxes(context);
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

          const finalValue = this.#statisticalService.getNestedValue(context, path);
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
            ? this.#statisticalService.computeDistributionStats(finalValues)
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

        // Skip I4 warning when axis constraints are impossible (min > max from conflicting prototype gates)
        // In such cases, the theoretical max is unreliable due to merged conflicting constraints
        if (
          population.name === 'stored-mood-regime' &&
          typeof maxAchievable === 'number' &&
          !hasImpossibleConstraints &&
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
}

export default ReportIntegrityAnalyzer;
