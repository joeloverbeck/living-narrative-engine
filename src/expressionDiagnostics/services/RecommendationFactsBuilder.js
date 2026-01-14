/**
 * @file RecommendationFactsBuilder - Builds DiagnosticFacts from Monte Carlo results.
 */

import { extractMoodConstraints, evaluateConstraint } from '../utils/moodRegimeUtils.js';
import AxisInterval from '../models/AxisInterval.js';
import InvariantValidator from './InvariantValidator.js';

class RecommendationFactsBuilder {
  #invariantValidator;
  #prototypeConstraintAnalyzer;
  #logger;
  #gateClampConfig;

  constructor({
    invariantValidator = new InvariantValidator(),
    prototypeConstraintAnalyzer = null,
    logger = null,
    gateClampConfig = {},
  } = {}) {
    this.#invariantValidator = invariantValidator;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
    this.#logger = logger;
    this.#gateClampConfig = gateClampConfig;
  }

  /**
   * Build DiagnosticFacts from a simulation result.
   *
   * @param {object} params
   * @param {object} params.expression
   * @param {import('./MonteCarloSimulator.js').SimulationResult} params.simulationResult
   * @returns {object|null}
   */
  build({ expression, simulationResult }) {
    if (!simulationResult) {
      return null;
    }

    const sampleCount = simulationResult.sampleCount ?? 0;
    const inRegimeSampleCount =
      simulationResult.inRegimeSampleCount ?? sampleCount;
    const moodConstraints = extractMoodConstraints(
      expression?.prerequisites,
      {
        includeMoodAlias: true,
        andOnly: true,
      }
    );

    const gateClampConfig = this.#getGateClampConfig(simulationResult);
    const clauseFacts = this.#buildClauseFacts(
      simulationResult,
      moodConstraints,
      gateClampConfig
    );
    const clauseFactsById = new Map(
      clauseFacts.map((clause) => [clause.clauseId, clause])
    );
    const axisConstraints = this.#extractAxisConstraints(
      expression?.prerequisites
    );
    const prototypeClauseStats =
      this.#collectPrototypeClauseStats(simulationResult);
    const prototypeFacts = this.#buildPrototypeFacts(
      simulationResult,
      prototypeClauseStats,
      clauseFactsById,
      axisConstraints
    );

    const diagnosticFacts = {
      expressionId: expression?.id ?? null,
      sampleCount,
      moodRegime: {
        definition: moodConstraints.length > 0 ? moodConstraints : null,
        sampleCount: inRegimeSampleCount,
      },
      overallPassRate: simulationResult.triggerRate ?? 0,
      clauses: clauseFacts,
      prototypes: prototypeFacts,
      invariants: [],
    };

    diagnosticFacts.invariants =
      this.#invariantValidator.validate(diagnosticFacts);

    return diagnosticFacts;
  }

  #buildClauseFacts(simulationResult, moodConstraints, gateClampConfig) {
    const clauseFailures = simulationResult.clauseFailures ?? [];
    const impactMap = new Map(
      (simulationResult.ablationImpact?.clauseImpacts ?? []).map((impact) => [
        impact.clauseId,
        impact.impact,
      ])
    );
    const gateClampContext = this.#buildGateClampContext(
      simulationResult,
      moodConstraints,
      gateClampConfig
    );

    const clauseFactsById = new Map();

    for (const clauseFailure of clauseFailures) {
      const breakdown = clauseFailure.hierarchicalBreakdown;
      if (!breakdown) {
        continue;
      }
      const leaves = [];
      this.#collectLeafNodes(breakdown, leaves);
      for (const leaf of leaves) {
        if (!leaf.clauseId) {
          continue;
        }
        if (clauseFactsById.has(leaf.clauseId)) {
          continue;
        }

        const impact =
          typeof impactMap.get(leaf.clauseId) === 'number'
            ? impactMap.get(leaf.clauseId)
            : 0;
        const failRateInMood =
          leaf.inRegimeFailureRate ??
          clauseFailure.inRegimeFailureRate ??
          null;
        const avgViolationInMood =
          typeof leaf.averageViolation === 'number'
            ? leaf.averageViolation
            : typeof clauseFailure.averageViolation === 'number'
              ? clauseFailure.averageViolation
              : 0;

        const prototypeInfo = this.#extractPrototypeInfo(leaf.variablePath);

        const gateClampRegimePermissive = this.#buildGateClampRegimePermissive(
          leaf,
          gateClampContext
        );

        clauseFactsById.set(leaf.clauseId, {
          clauseId: leaf.clauseId,
          clauseLabel: leaf.description ?? clauseFailure.clauseDescription ?? '',
          clauseType: leaf.clauseType ?? 'other',
          prototypeId: prototypeInfo?.prototypeId ?? null,
          impact,
          failRateInMood,
          avgViolationInMood,
          operator: leaf.comparisonOperator ?? leaf.operator ?? null,
          thresholdValue:
            typeof leaf.thresholdValue === 'number' ? leaf.thresholdValue : null,
          conditionalFailRate:
            leaf.siblingConditionedFailRate ?? leaf.lastMileFailRate ?? null,
          nearMissRate: leaf.nearMissRate ?? null,
          rawPassInRegimeCount:
            typeof leaf.rawPassInRegimeCount === 'number'
              ? leaf.rawPassInRegimeCount
              : null,
          lostPassInRegimeCount:
            typeof leaf.lostPassInRegimeCount === 'number'
              ? leaf.lostPassInRegimeCount
              : null,
          lostPassRateInRegime:
            typeof leaf.lostPassRateInRegime === 'number'
              ? leaf.lostPassRateInRegime
              : null,
          gateClampRegimePermissive,
        });
      }
    }

    return Array.from(clauseFactsById.values());
  }

  #buildPrototypeFacts(
    simulationResult,
    prototypeClauseStats,
    clauseFactsById,
    axisConstraints
  ) {
    const summary = simulationResult.prototypeEvaluationSummary;
    if (!summary) {
      return [];
    }

    const gateCompatibility = simulationResult.gateCompatibility ?? {
      emotions: {},
      sexualStates: {},
    };

    const prototypes = [];
    const addPrototypes = (entries, typeKey) => {
      for (const [prototypeId, stats] of Object.entries(entries ?? {})) {
        const moodSampleCount = stats.moodSampleCount ?? 0;
        const gatePassCount = stats.gatePassCount ?? 0;
        const gateFailCount = stats.gateFailCount ?? 0;
        const gatePassRate =
          moodSampleCount > 0 ? gatePassCount / moodSampleCount : 0;
        const gateFailRate =
          moodSampleCount > 0 ? gateFailCount / moodSampleCount : 0;
        const meanValueGivenGate =
          gatePassCount > 0 ? stats.valueSumGivenGate / gatePassCount : 0;

        const candidateClauses =
          prototypeClauseStats.get(`${typeKey}:${prototypeId}`) ?? [];
        const selectedClause = this.#selectPrototypeClause(candidateClauses);
        const clauseFact = selectedClause?.clauseId
          ? clauseFactsById?.get(selectedClause.clauseId)
          : null;
        const thresholdPassCount =
          selectedClause?.gatePassAndClausePassInRegimeCount ?? 0;
        const thresholdPassGivenGateCount = thresholdPassCount;
        const pThreshGivenGate =
          gatePassCount > 0 ? thresholdPassGivenGateCount / gatePassCount : 0;
        const pThreshEffective = gatePassRate * pThreshGivenGate;
        const axisConflicts = this.#buildAxisConflicts({
          prototypeId,
          typeKey,
          axisConstraints,
          clauseFact,
        });

        prototypes.push({
          prototypeId,
          prototypeLabel: prototypeId,
          moodSampleCount,
          gateFailCount,
          gatePassCount,
          thresholdPassGivenGateCount,
          thresholdPassCount,
          gateFailRate,
          gatePassRate,
          pThreshGivenGate,
          pThreshEffective,
          meanValueGivenGate,
          failedGateCounts: this.#formatFailedGateCounts(
            stats.failedGateCounts
          ),
          compatibilityScore: this.#getCompatibilityScore(
            gateCompatibility,
            typeKey,
            prototypeId
          ),
          axisConflicts,
        });
      }
    };

    addPrototypes(summary.emotions, 'emotions');
    addPrototypes(summary.sexualStates, 'sexualStates');

    return prototypes;
  }

  #collectLeafNodes(node, leaves) {
    if (!node) {
      return;
    }
    if (node.nodeType === 'leaf') {
      leaves.push(node);
      return;
    }
    for (const child of node.children ?? []) {
      this.#collectLeafNodes(child, leaves);
    }
  }

  #extractPrototypeInfo(variablePath) {
    if (!variablePath || typeof variablePath !== 'string') {
      return null;
    }
    if (variablePath.startsWith('emotions.')) {
      return {
        typeKey: 'emotions',
        prototypeId: variablePath.slice('emotions.'.length),
      };
    }
    if (variablePath.startsWith('sexualStates.')) {
      return {
        typeKey: 'sexualStates',
        prototypeId: variablePath.slice('sexualStates.'.length),
      };
    }
    return null;
  }

  #selectPrototypeClause(clauses) {
    if (!clauses || clauses.length === 0) {
      return null;
    }

    return [...clauses].sort((a, b) => {
      const aCount = a.gatePassInRegimeCount ?? 0;
      const bCount = b.gatePassInRegimeCount ?? 0;
      return (
        bCount - aCount || (a.clauseId ?? '').localeCompare(b.clauseId ?? '')
      );
    })[0];
  }

  #collectPrototypeClauseStats(simulationResult) {
    const clauseFailures = simulationResult.clauseFailures ?? [];
    const index = new Map();

    for (const clauseFailure of clauseFailures) {
      const breakdown = clauseFailure.hierarchicalBreakdown;
      if (!breakdown) {
        continue;
      }
      const leaves = [];
      this.#collectLeafNodes(breakdown, leaves);
      for (const leaf of leaves) {
        const prototypeInfo = this.#extractPrototypeInfo(leaf.variablePath);
        if (!prototypeInfo) {
          continue;
        }
        const key = `${prototypeInfo.typeKey}:${prototypeInfo.prototypeId}`;
        const list = index.get(key) ?? [];
        list.push({
          clauseId: leaf.clauseId ?? null,
          gatePassInRegimeCount: leaf.gatePassInRegimeCount ?? 0,
          gatePassAndClausePassInRegimeCount:
            leaf.gatePassAndClausePassInRegimeCount ?? 0,
        });
        index.set(key, list);
      }
    }

    return index;
  }

  #formatFailedGateCounts(failedGateCounts = {}) {
    return Object.entries(failedGateCounts)
      .map(([gateId, count]) => ({ gateId, count }))
      .sort((a, b) => b.count - a.count || a.gateId.localeCompare(b.gateId));
  }

  #getCompatibilityScore(gateCompatibility, typeKey, prototypeId) {
    const compatibility = gateCompatibility?.[typeKey]?.[prototypeId];
    if (!compatibility) {
      return 0;
    }
    return compatibility.compatible ? 1 : -1;
  }

  #extractAxisConstraints(prerequisites) {
    if (!this.#prototypeConstraintAnalyzer || !Array.isArray(prerequisites)) {
      return null;
    }
    try {
      return this.#prototypeConstraintAnalyzer.extractAxisConstraints(
        prerequisites
      );
    } catch (err) {
      if (this.#logger?.warn) {
        this.#logger.warn('RecommendationFactsBuilder axis constraints failed:', err);
      }
      return null;
    }
  }

  #buildAxisConflicts({ prototypeId, typeKey, axisConstraints, clauseFact }) {
    if (!this.#prototypeConstraintAnalyzer || !axisConstraints) {
      return [];
    }

    const type = typeKey === 'emotions' ? 'emotion' : 'sexual';
    const threshold =
      typeof clauseFact?.thresholdValue === 'number'
        ? clauseFact.thresholdValue
        : 0;
    const operator = clauseFact?.operator ?? '>=';

    let analysis;
    try {
      analysis = this.#prototypeConstraintAnalyzer.analyzeEmotionThreshold(
        prototypeId,
        type,
        threshold,
        axisConstraints,
        operator
      );
    } catch (err) {
      if (this.#logger?.warn) {
        this.#logger.warn(
          'RecommendationFactsBuilder axis conflict analysis failed:',
          err
        );
      }
      return [];
    }

    const axisAnalysis = Array.isArray(analysis?.axisAnalysis)
      ? analysis.axisAnalysis
      : [];

    return axisAnalysis
      .filter((axis) => axis?.conflictType)
      .map((axis) => {
        const bounds =
          typeof axis.defaultMin === 'number' && typeof axis.defaultMax === 'number'
            ? { min: axis.defaultMin, max: axis.defaultMax }
            : this.#getDefaultAxisBounds(axis.axis);
        const unboundOptimal = axis.weight > 0 ? bounds.max : bounds.min;
        const unboundContribution = axis.weight * unboundOptimal;
        const contributionDelta = unboundContribution - axis.contribution;
        return {
          axis: axis.axis,
          weight: axis.weight,
          constraintMin: axis.constraintMin,
          constraintMax: axis.constraintMax,
          conflictType: axis.conflictType,
          contributionDelta,
          lostRawSum: axis.lostRawSum ?? null,
          lostIntensity: axis.lostIntensity ?? null,
          sources: Array.isArray(axis.sources) ? axis.sources : [],
        };
      });
  }

  #getDefaultAxisBounds(axis) {
    const sexualAxes = new Set([
      'sex_excitation',
      'sex_inhibition',
      'baseline_libido',
      'sexual_arousal',
    ]);

    if (sexualAxes.has(axis)) {
      return { min: 0, max: 1 };
    }

    return { min: -1, max: 1 };
  }

  #getGateClampConfig(simulationResult) {
    const planConfig = simulationResult?.gateClampRegimePlan?.gateClampConfig ?? {};
    return {
      softAlignmentEnabled: false,
      softQuantileLower: 0.1,
      softQuantileUpper: 0.9,
      ...this.#gateClampConfig,
      ...planConfig,
    };
  }

  #buildGateClampContext(simulationResult, moodConstraints, gateClampConfig) {
    const gateClampRegimePlan = simulationResult?.gateClampRegimePlan;
    if (!gateClampRegimePlan) {
      return null;
    }

    return {
      clauseGateMap: gateClampRegimePlan.clauseGateMap ?? {},
      moodRegimeAxisHistograms: simulationResult?.moodRegimeAxisHistograms ?? {},
      moodRegimeSampleReservoir:
        simulationResult?.moodRegimeSampleReservoir ?? null,
      regimeBoundsByAxis: this.#buildRegimeBounds(moodConstraints),
      gateClampConfig,
    };
  }

  #buildRegimeBounds(moodConstraints) {
    const boundsByAxis = new Map();
    if (!Array.isArray(moodConstraints)) {
      return boundsByAxis;
    }

    for (const constraint of moodConstraints) {
      const varPath = constraint?.varPath;
      if (typeof varPath !== 'string') {
        continue;
      }
      const axis = varPath.split('.').pop();
      if (!axis) {
        continue;
      }
      const threshold =
        typeof constraint.threshold === 'number' ? constraint.threshold : null;
      if (threshold === null) {
        continue;
      }
      const operator = constraint.operator;
      let interval = boundsByAxis.get(axis) ?? AxisInterval.forRawMoodAxis();
      try {
        interval = interval.applyConstraint(operator, threshold);
      } catch {
        continue;
      }
      boundsByAxis.set(axis, interval);
    }

    return boundsByAxis;
  }

  #buildGateClampRegimePermissive(leaf, gateClampContext) {
    if (!gateClampContext || !leaf?.clauseId) {
      return null;
    }

    const clauseGateInfo = gateClampContext.clauseGateMap?.[leaf.clauseId];
    if (!clauseGateInfo) {
      return null;
    }

    const gatePredicates = Array.isArray(clauseGateInfo.gatePredicates)
      ? clauseGateInfo.gatePredicates
      : [];
    if (gatePredicates.length === 0) {
      return null;
    }

    const moodRegimeCount =
      typeof leaf.inRegimeEvaluationCount === 'number'
        ? leaf.inRegimeEvaluationCount
        : null;
    const gatePassInRegimeCount =
      typeof leaf.gatePassInRegimeCount === 'number'
        ? leaf.gatePassInRegimeCount
        : null;
    const gateFailInRegimeCount =
      typeof leaf.gateFailInRegimeCount === 'number'
        ? leaf.gateFailInRegimeCount
        : null;
    const gateClampRateInRegime =
      typeof leaf.gateClampRateInRegime === 'number'
        ? leaf.gateClampRateInRegime
        : null;

    const normalizedPredicates = gatePredicates.map((predicate) => {
      const implication = this.#getGatePredicateImplication(
        predicate,
        gateClampContext.regimeBoundsByAxis
      );
      return {
        axis: predicate.axis,
        operator: predicate.operator,
        thresholdNormalized: predicate.thresholdNormalized ?? null,
        thresholdRaw:
          typeof predicate.thresholdRaw === 'number'
            ? predicate.thresholdRaw
            : null,
        impliedByRegime: implication.impliedByRegime,
        regimeBounds: implication.regimeBounds,
      };
    });

    const axisEvidence = this.#buildGateClampAxisEvidence(
      normalizedPredicates,
      gateClampContext.moodRegimeAxisHistograms,
      moodRegimeCount
    );
    const axisEvidenceByAxis = new Map(
      axisEvidence.map((entry) => [entry.axis, entry])
    );

    const allGatesImplied =
      normalizedPredicates.length > 0 &&
      normalizedPredicates.every((predicate) => predicate.impliedByRegime);

    const candidates = allGatesImplied
      ? []
      : this.#buildGateClampCandidates({
        gatePredicates: normalizedPredicates,
        axisEvidenceByAxis,
        moodRegimeCount,
        moodRegimeAxisHistograms: gateClampContext.moodRegimeAxisHistograms,
        moodRegimeSampleReservoir: gateClampContext.moodRegimeSampleReservoir,
        gateClampConfig: gateClampContext.gateClampConfig,
      });

    return {
      moodRegimeCount,
      gatePassInRegimeCount,
      gateFailInRegimeCount,
      gateClampRateInRegime,
      gatePredicates: normalizedPredicates,
      axisEvidence,
      allGatesImplied,
      candidates,
    };
  }

  #getGatePredicateImplication(predicate, regimeBoundsByAxis) {
    if (!predicate || !regimeBoundsByAxis) {
      return { impliedByRegime: false, regimeBounds: null };
    }
    const thresholdRaw =
      typeof predicate.thresholdRaw === 'number'
        ? predicate.thresholdRaw
        : null;
    const axisBounds = regimeBoundsByAxis.get(predicate.axis);
    if (!axisBounds || thresholdRaw === null) {
      return {
        impliedByRegime: false,
        regimeBounds: axisBounds
          ? { min: axisBounds.min, max: axisBounds.max }
          : null,
      };
    }

    const { min, max } = axisBounds;
    const operator = predicate.operator;
    let implied = false;

    switch (operator) {
      case '>=':
        implied = min >= thresholdRaw;
        break;
      case '>':
        implied = min > thresholdRaw;
        break;
      case '<=':
        implied = max <= thresholdRaw;
        break;
      case '<':
        implied = max < thresholdRaw;
        break;
      case '==':
        implied = min >= thresholdRaw && max <= thresholdRaw;
        break;
      default:
        implied = false;
    }

    return {
      impliedByRegime: implied,
      regimeBounds: { min, max },
    };
  }

  #buildGateClampAxisEvidence(
    gatePredicates,
    moodRegimeAxisHistograms,
    moodRegimeCount
  ) {
    const evidence = [];
    for (const predicate of gatePredicates) {
      const thresholdRaw =
        typeof predicate.thresholdRaw === 'number'
          ? predicate.thresholdRaw
          : null;
      const histogram =
        predicate.axis && moodRegimeAxisHistograms
          ? moodRegimeAxisHistograms[predicate.axis]
          : null;

      if (!histogram || thresholdRaw === null) {
        continue;
      }

      const belowCount = this.#countHistogramWhere(
        histogram,
        (value) => value < thresholdRaw
      );
      const aboveCount = this.#countHistogramWhere(
        histogram,
        (value) => value > thresholdRaw
      );
      const denominator =
        typeof moodRegimeCount === 'number'
          ? moodRegimeCount
          : histogram.sampleCount ?? 0;

      const quantiles = {
        p10: this.#computeHistogramQuantile(histogram, 0.1),
        p50: this.#computeHistogramQuantile(histogram, 0.5),
        p90: this.#computeHistogramQuantile(histogram, 0.9),
      };

      evidence.push({
        axis: predicate.axis,
        operator: predicate.operator,
        thresholdRaw,
        thresholdNormalized: predicate.thresholdNormalized ?? null,
        fractionBelow: {
          count: belowCount,
          denominator,
          rate: denominator > 0 ? belowCount / denominator : null,
        },
        fractionAbove: {
          count: aboveCount,
          denominator,
          rate: denominator > 0 ? aboveCount / denominator : null,
        },
        quantiles,
      });
    }

    return evidence;
  }

  #buildGateClampCandidates({
    gatePredicates,
    axisEvidenceByAxis,
    moodRegimeCount,
    moodRegimeAxisHistograms,
    moodRegimeSampleReservoir,
    gateClampConfig,
  }) {
    const candidates = [];
    const replayGatePredicates = gatePredicates.filter(
      (predicate) =>
        typeof predicate.thresholdRaw === 'number' &&
        typeof predicate.axis === 'string'
    );
    const predicateAxes = gatePredicates
      .filter(
        (predicate) =>
          typeof predicate.thresholdRaw === 'number' &&
          typeof predicate.axis === 'string'
      )
      .map((predicate) => ({
        axis: predicate.axis,
        operator: predicate.operator,
        thresholdRaw: predicate.thresholdRaw,
        thresholdNormalized: predicate.thresholdNormalized ?? null,
      }));

    const hasReservoir =
      Array.isArray(moodRegimeSampleReservoir?.samples) &&
      moodRegimeSampleReservoir.samples.length > 0;

    for (const predicate of predicateAxes) {
      candidates.push(
        this.#buildGateClampCandidate({
          id: `hard:${predicate.axis}:${predicate.operator}:${predicate.thresholdRaw}`,
          kind: 'hard',
          axes: [predicate],
          gatePredicates: replayGatePredicates,
          moodRegimeCount,
          moodRegimeAxisHistograms,
          moodRegimeSampleReservoir,
        })
      );

      if (gateClampConfig?.softAlignmentEnabled) {
        const axisEvidence = axisEvidenceByAxis.get(predicate.axis);
        const softThreshold = this.#computeSoftThreshold(
          predicate,
          axisEvidence
        );
        if (
          typeof softThreshold === 'number' &&
          softThreshold !== predicate.thresholdRaw
        ) {
          candidates.push(
            this.#buildGateClampCandidate({
              id: `soft:${predicate.axis}:${predicate.operator}:${softThreshold}`,
              kind: 'soft',
              axes: [
                {
                  axis: predicate.axis,
                  operator: predicate.operator,
                  thresholdRaw: softThreshold,
                  thresholdNormalized: null,
                },
              ],
              gatePredicates: replayGatePredicates,
              moodRegimeCount,
              moodRegimeAxisHistograms,
              moodRegimeSampleReservoir,
            })
          );
        }
      }
    }

    if (predicateAxes.length > 1 && hasReservoir) {
      const combinedKey = predicateAxes
        .map((predicate) => `${predicate.axis}${predicate.operator}${predicate.thresholdRaw}`)
        .join('|');
      candidates.push(
        this.#buildGateClampCandidate({
          id: `hard:combined:${combinedKey}`,
          kind: 'hard',
          axes: predicateAxes,
          gatePredicates: replayGatePredicates,
          moodRegimeCount,
          moodRegimeAxisHistograms,
          moodRegimeSampleReservoir,
        })
      );
    }

    return candidates;
  }

  #buildGateClampCandidate({
    id,
    kind,
    axes,
    gatePredicates,
    moodRegimeCount,
    moodRegimeAxisHistograms,
    moodRegimeSampleReservoir,
  }) {
    const evaluation = this.#evaluateGateClampCandidate({
      axes,
      gatePredicates,
      moodRegimeCount,
      moodRegimeAxisHistograms,
      moodRegimeSampleReservoir,
    });

    return {
      id,
      kind,
      axes,
      keepRatio: evaluation.keepRatio,
      keepCount: evaluation.keepCount,
      keepDenominator: evaluation.keepDenominator,
      predClampRate: evaluation.predClampRate,
      predPassRate: evaluation.predPassRate,
      predSampleCount: evaluation.predSampleCount,
    };
  }

  #evaluateGateClampCandidate({
    axes,
    gatePredicates,
    moodRegimeCount,
    moodRegimeAxisHistograms,
    moodRegimeSampleReservoir,
  }) {
    const reservoirSamples = Array.isArray(moodRegimeSampleReservoir?.samples)
      ? moodRegimeSampleReservoir.samples
      : [];
    const hasReservoir = reservoirSamples.length > 0;

    let keepCount = null;
    let predSampleCount = null;
    let predPassCount = null;

    if (hasReservoir) {
      keepCount = 0;
      predPassCount = 0;
      for (const sample of reservoirSamples) {
        if (!this.#sampleSatisfiesConstraints(sample, axes)) {
          continue;
        }
        keepCount += 1;
        if (this.#sampleSatisfiesConstraints(sample, gatePredicates)) {
          predPassCount += 1;
        }
      }
      predSampleCount = keepCount;
    } else if (axes.length === 1) {
      const axis = axes[0].axis;
      const histogram = moodRegimeAxisHistograms?.[axis];
      if (histogram) {
        keepCount = this.#countHistogramWhere(histogram, (value) =>
          evaluateConstraint(value, axes[0].operator, axes[0].thresholdRaw)
        );
      }
    }

    const denominator =
      typeof moodRegimeCount === 'number'
        ? moodRegimeCount
        : typeof moodRegimeSampleReservoir?.sampleCount === 'number'
          ? moodRegimeSampleReservoir.sampleCount
          : null;
    const keepRatio =
      typeof keepCount === 'number' &&
      typeof denominator === 'number' &&
      denominator > 0
        ? keepCount / denominator
        : null;

    let predClampRate = null;
    let predPassRate = null;
    if (
      typeof predSampleCount === 'number' &&
      predSampleCount > 0 &&
      typeof predPassCount === 'number'
    ) {
      predPassRate = predPassCount / predSampleCount;
      predClampRate = 1 - predPassRate;
    }

    return {
      keepRatio,
      keepCount,
      keepDenominator: denominator,
      predClampRate,
      predPassRate,
      predSampleCount,
    };
  }

  #sampleSatisfiesConstraints(sample, constraints) {
    if (!sample || !Array.isArray(constraints)) {
      return false;
    }
    if (constraints.length === 0) {
      return true;
    }

    for (const constraint of constraints) {
      const axis = constraint.axis;
      const threshold = constraint.thresholdRaw;
      if (typeof axis !== 'string' || typeof threshold !== 'number') {
        return false;
      }
      const value = sample[axis];
      if (!evaluateConstraint(value, constraint.operator, threshold)) {
        return false;
      }
    }

    return true;
  }

  #computeSoftThreshold(predicate, axisEvidence) {
    if (!axisEvidence?.quantiles) {
      return null;
    }
    const { p10, p90, p50 } = axisEvidence.quantiles;
    const thresholdRaw = predicate.thresholdRaw;
    if (typeof thresholdRaw !== 'number') {
      return null;
    }

    switch (predicate.operator) {
      case '>=':
      case '>':
        if (typeof p10 !== 'number') {
          return null;
        }
        return Math.min(thresholdRaw, p10);
      case '<=':
      case '<':
        if (typeof p90 !== 'number') {
          return null;
        }
        return Math.max(thresholdRaw, p90);
      case '==':
        if (typeof p50 !== 'number') {
          return null;
        }
        return thresholdRaw;
      default:
        return null;
    }
  }

  #countHistogramWhere(histogram, predicate) {
    if (!histogram || typeof predicate !== 'function') {
      return 0;
    }
    const bins = Array.isArray(histogram.bins) ? histogram.bins : [];
    let count = 0;
    for (let i = 0; i < bins.length; i++) {
      const value = this.#getHistogramValue(histogram, i);
      if (predicate(value)) {
        count += bins[i] ?? 0;
      }
    }
    return count;
  }

  #getHistogramValue(histogram, index) {
    const { min, max, binCount } = histogram;
    if (
      typeof min !== 'number' ||
      typeof max !== 'number' ||
      typeof binCount !== 'number' ||
      binCount <= 1
    ) {
      return 0;
    }
    if (binCount === max - min + 1) {
      return min + index;
    }
    const ratio = index / (binCount - 1);
    return min + ratio * (max - min);
  }

  #computeHistogramQuantile(histogram, quantile) {
    if (!histogram || typeof quantile !== 'number') {
      return null;
    }
    const bins = Array.isArray(histogram.bins) ? histogram.bins : [];
    const sampleCount =
      typeof histogram.sampleCount === 'number'
        ? histogram.sampleCount
        : bins.reduce((sum, count) => sum + (count ?? 0), 0);
    if (sampleCount <= 0) {
      return null;
    }
    const target = quantile * sampleCount;
    let cumulative = 0;
    for (let i = 0; i < bins.length; i++) {
      cumulative += bins[i] ?? 0;
      if (cumulative >= target) {
        return this.#getHistogramValue(histogram, i);
      }
    }
    return this.#getHistogramValue(histogram, bins.length - 1);
  }
}

export default RecommendationFactsBuilder;
