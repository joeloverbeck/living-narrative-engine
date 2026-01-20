/**
 * @file RecommendationEngine - Emits deterministic recommendations from DiagnosticFacts.
 */

import {
  SEVERITY_ORDER,
  CHOKE_PASS_GIVEN_GATE_MAX,
  getConfidence,
  getSeverity,
  buildPopulation,
  getImpactFromId,
  classifyChokeType,
} from './utils/recommendationUtils.js';
import PrototypeCreateSuggestionBuilder from './recommendationBuilders/PrototypeCreateSuggestionBuilder.js';
import GateClampRecommendationBuilder from './recommendationBuilders/GateClampRecommendationBuilder.js';
import SoleBlockerRecommendationBuilder from './recommendationBuilders/SoleBlockerRecommendationBuilder.js';
import AxisConflictAnalyzer from './recommendationBuilders/AxisConflictAnalyzer.js';
import OverconstrainedConjunctionBuilder from './recommendationBuilders/OverconstrainedConjunctionBuilder.js';

class RecommendationEngine {
  #prototypeCreateBuilder;
  #gateClampBuilder;
  #soleBlockerBuilder;
  #axisConflictAnalyzer;
  #overconstrainedBuilder;

  /**
   * @param {object} [options]
   * @param {object} [options.prototypeSynthesisService] - Optional synthesis service for prototype creation recommendations.
   * @param {object} [options.emotionSimilarityService] - Optional service for finding similar emotions.
   * @param {object} [options.gateClampBuilder] - Optional builder for gate clamp recommendations.
   * @param {object} [options.soleBlockerBuilder] - Optional builder for sole-blocker edit recommendations.
   * @param {object} [options.axisConflictAnalyzer] - Optional analyzer for axis conflict recommendations.
   * @param {object} [options.overconstrainedBuilder] - Optional builder for overconstrained conjunction recommendations.
   */
  constructor({
    prototypeSynthesisService = null,
    emotionSimilarityService = null,
    gateClampBuilder = null,
    soleBlockerBuilder = null,
    axisConflictAnalyzer = null,
    overconstrainedBuilder = null,
  } = {}) {
    // Initialize prototype create builder if synthesis service is provided
    this.#prototypeCreateBuilder = prototypeSynthesisService
      ? new PrototypeCreateSuggestionBuilder({ prototypeSynthesisService })
      : null;
    // Initialize gate clamp builder (use provided or create default)
    this.#gateClampBuilder = gateClampBuilder ?? new GateClampRecommendationBuilder();
    // Initialize sole-blocker builder (use provided or create default)
    this.#soleBlockerBuilder = soleBlockerBuilder ?? new SoleBlockerRecommendationBuilder();
    // Initialize axis conflict analyzer (use provided or create default with emotion similarity service)
    this.#axisConflictAnalyzer =
      axisConflictAnalyzer ??
      new AxisConflictAnalyzer({ emotionSimilarityService });
    // Initialize overconstrained conjunction builder (use provided or create default with emotion similarity service)
    this.#overconstrainedBuilder =
      overconstrainedBuilder ??
      new OverconstrainedConjunctionBuilder({ emotionSimilarityService });
  }

  /**
   * Generate recommendations from DiagnosticFacts.
   *
   * @param {object|null} diagnosticFacts
   * @returns {Array<object>}
   */
  generate(diagnosticFacts) {
    if (!diagnosticFacts) {
      return [];
    }

    const invariants = diagnosticFacts.invariants ?? [];
    const hasInvariantFailure = invariants.some((inv) => inv.ok === false);
    if (hasInvariantFailure) {
      return [];
    }

    const clauses = diagnosticFacts.clauses ?? [];
    const prototypes = diagnosticFacts.prototypes ?? [];
    const overconstrainedDetails = diagnosticFacts.overconstrainedDetails ?? [];

    // Skip clause/prototype analysis if no data, but still process overconstrained details
    const hasClauseData = clauses.length > 0 && prototypes.length > 0;
    if (!hasClauseData && overconstrainedDetails.length === 0) {
      return [];
    }

    const recommendations = [];

    // Overconstrained conjunction recommendations (can exist without clause/prototype data)
    for (const info of overconstrainedDetails) {
      recommendations.push(this.#overconstrainedBuilder.build(info));
    }

    // Skip clause-based processing if no clause data
    if (!hasClauseData) {
      return recommendations;
    }

    const topClauses = [...clauses]
      .sort((a, b) => {
        const impactA = typeof a.impact === 'number' ? a.impact : 0;
        const impactB = typeof b.impact === 'number' ? b.impact : 0;
        return (
          impactB - impactA ||
          String(a.clauseId ?? '').localeCompare(String(b.clauseId ?? ''))
        );
      })
      .slice(0, 3);

    for (const clause of topClauses) {
      // Delegate to gate clamp builder
      const gateClampRecommendation = this.#gateClampBuilder.build(clause);
      if (gateClampRecommendation) {
        recommendations.push(gateClampRecommendation);
      }

      const soleBlockerRecommendation = this.#soleBlockerBuilder.build(clause);
      if (soleBlockerRecommendation) {
        recommendations.push(soleBlockerRecommendation);
      }
    }

    const candidates = topClauses.filter((clause) => clause.prototypeId);

    for (const clause of candidates) {
      const prototype = prototypes.find(
        (entry) => entry.prototypeId === clause.prototypeId
      );
      if (!prototype) {
        continue;
      }

      const gateFailRate = prototype.gateFailRate ?? 0;
      const pThreshGivenGate = prototype.pThreshGivenGate ?? 0;
      const meanValueGivenGate = prototype.meanValueGivenGate ?? 0;
      const compatibilityScore = prototype.compatibilityScore ?? 0;
      const thresholdValue = clause.thresholdValue;
      const axisConflicts = this.#axisConflictAnalyzer.normalize(
        prototype.axisConflicts
      );
      const lostPassRateInRegime =
        typeof clause.lostPassRateInRegime === 'number'
          ? clause.lostPassRateInRegime
          : null;

      const gateMismatch =
        clause.operator === '>=' &&
        typeof lostPassRateInRegime === 'number' &&
        lostPassRateInRegime >= 0.25;
      const thresholdMismatch =
        typeof thresholdValue === 'number' &&
        pThreshGivenGate <= 0.1 &&
        meanValueGivenGate <= thresholdValue - 0.15;
      const hasBlockingOperator =
        clause.operator === '>=' || clause.operator === '>';
      const chokeType = classifyChokeType({
        prototype,
        clause,
        gateMismatch,
        thresholdMismatch,
      });
      const gateIncompatibility =
        hasBlockingOperator && compatibilityScore <= -0.25;
      const axisSignConflict =
        axisConflicts.length > 0 &&
        hasBlockingOperator &&
        pThreshGivenGate < CHOKE_PASS_GIVEN_GATE_MAX &&
        (chokeType === 'threshold' || chokeType === 'mixed');

      if (
        !gateMismatch &&
        !thresholdMismatch &&
        !gateIncompatibility &&
        !axisSignConflict
      ) {
        continue;
      }

      const moodSampleCount = prototype.moodSampleCount ?? 0;
      const confidence = getConfidence(moodSampleCount);
      const impact = typeof clause.impact === 'number' ? clause.impact : 0;

      if (gateMismatch || thresholdMismatch) {
        const evidence = this.#buildEvidence({
          prototype,
          clause,
          gateMismatch,
          chokeType,
        });

        const whyParts = [
          'Prototype-linked clause is a top-3 impact choke.',
        ];
        if (gateMismatch) {
          whyParts.push('Lost-pass rate exceeds 25%.');
        }
        if (thresholdMismatch) {
          whyParts.push(
            'Pass|gate and mean value trail the clause threshold.'
          );
        }
        if (confidence === 'low') {
          whyParts.push(
            `Low confidence due to limited mood samples (N=${moodSampleCount}).`
          );
        }

        recommendations.push({
          id: `prototype_mismatch:${clause.prototypeId}:${clause.clauseId}`,
          type: 'prototype_mismatch',
          severity: getSeverity(impact),
          confidence,
          title: this.#getMismatchTitle(gateMismatch, thresholdMismatch),
          why: whyParts.join(' '),
          evidence,
          actions: this.#buildActions({
            gateMismatch,
            thresholdMismatch,
          }),
          predictedEffect:
            'Reduce mismatch to improve trigger rate and stability.',
          relatedClauseIds: clause.clauseId ? [clause.clauseId] : [],
          chokeType,
        });
      }

      if (gateIncompatibility) {
        const evidence = this.#buildEvidence({
          prototype,
          clause,
          gateMismatch,
          gateIncompatibility,
          compatibilityScore,
          chokeType: 'gate',
        });
        const whyParts = [
          'Prototype-linked clause is a top-3 impact choke.',
          'Gate compatibility indicates the regime blocks this prototype.',
          'Prototype values are always clamped to 0 in the regime.',
        ];
        if (confidence === 'low') {
          whyParts.push(
            `Low confidence due to limited mood samples (N=${moodSampleCount}).`
          );
        }

        recommendations.push({
          id: `gate_incompatibility:${clause.prototypeId}:${clause.clauseId}`,
          type: 'gate_incompatibility',
          severity: getSeverity(impact),
          confidence,
          title: 'Prototype gate incompatible with regime',
          why: whyParts.join(' '),
          evidence,
          actions: this.#buildGateIncompatibilityActions(),
          predictedEffect:
            'Align gate constraints to allow the prototype to activate.',
          relatedClauseIds: clause.clauseId ? [clause.clauseId] : [],
          chokeType: 'gate',
        });
      }

      if (axisSignConflict) {
        // Delegate axis conflict analysis to the analyzer
        const analysisResult = this.#axisConflictAnalyzer.analyze({
          axisConflicts,
          prototypeId: clause.prototypeId,
          moodSampleCount: prototype.moodSampleCount,
        });
        const evidence = [
          ...analysisResult.evidence,
          ...this.#buildEvidence({ prototype, clause, chokeType }),
        ];
        const conflictSummary = axisConflicts
          .map((conflict) => `${conflict.axis} (${conflict.conflictType})`)
          .join(', ');
        const whyParts = [
          'Prototype-linked clause is a top-3 impact choke.',
          'Axis sign conflicts indicate regime constraints oppose prototype weights.',
          `Conflicts: ${conflictSummary}.`,
        ];
        if (confidence === 'low') {
          whyParts.push(
            `Low confidence due to limited mood samples (N=${moodSampleCount}).`
          );
        }

        recommendations.push({
          id: `axis_sign_conflict:${clause.prototypeId}:${clause.clauseId}`,
          type: 'axis_sign_conflict',
          severity: this.#axisConflictAnalyzer.getSeverity({
            axisConflicts,
            clause,
            impact,
          }),
          confidence,
          title: 'Prototype axis sign conflict',
          why: whyParts.join(' '),
          evidence,
          actions: analysisResult.actions,
          structuredActions: analysisResult.structuredActions,
          predictedEffect:
            'Choose Option A or B based on your design intent.',
          relatedClauseIds: clause.clauseId ? [clause.clauseId] : [],
          chokeType,
        });
      }
    }

    // Prototype create suggestion (delegated to builder)
    if (this.#prototypeCreateBuilder) {
      const prototypeCreateSuggestion =
        this.#prototypeCreateBuilder.build(diagnosticFacts);
      if (prototypeCreateSuggestion) {
        recommendations.push(prototypeCreateSuggestion);
      }
    }

    return recommendations.sort((a, b) => {
      const severityDiff =
        (SEVERITY_ORDER[a.severity] ?? 99) -
        (SEVERITY_ORDER[b.severity] ?? 99);
      if (severityDiff !== 0) {
        return severityDiff;
      }

      const impactA = getImpactFromId(a.id, clauses);
      const impactB = getImpactFromId(b.id, clauses);
      if (impactB !== impactA) {
        return impactB - impactA;
      }

      return String(a.id).localeCompare(String(b.id));
    });
  }

  /**
   * Returns a specific title based on the type of prototype mismatch.
   * @param {boolean} gateMismatch - Whether there's a gate mismatch
   * @param {boolean} thresholdMismatch - Whether there's a threshold mismatch
   * @returns {string} Specific actionable title
   */
  #getMismatchTitle(gateMismatch, thresholdMismatch) {
    if (gateMismatch && thresholdMismatch) {
      return 'Prototype gate and threshold both misaligned';
    }
    if (gateMismatch) {
      return 'Prototype gate suppresses emotion in this regime';
    }
    if (thresholdMismatch) {
      return 'Threshold too high for observed distribution';
    }
    // Fallback (shouldn't occur if called correctly)
    return 'Prototype structurally mismatched';
  }

  #buildEvidence({
    prototype,
    clause,
    gateMismatch,
    gateIncompatibility = false,
    compatibilityScore = 0,
    chokeType = 'mixed',
  }) {
    const moodSampleCount = prototype.moodSampleCount ?? 0;
    const gateFailCount = prototype.gateFailCount ?? 0;
    const gatePassCount = prototype.gatePassCount ?? 0;
    const thresholdPassCount = prototype.thresholdPassCount ?? 0;
    const pThreshGivenGate = prototype.pThreshGivenGate ?? 0;
    const gateFailRate = prototype.gateFailRate ?? 0;
    const meanValueGivenGate = prototype.meanValueGivenGate ?? null;
    const rawPassInRegimeCount = clause.rawPassInRegimeCount ?? null;
    const lostPassInRegimeCount = clause.lostPassInRegimeCount ?? null;

    const evidence = [];
    const includeGate = chokeType === 'gate' || chokeType === 'mixed';
    const includeThreshold =
      chokeType === 'threshold' || chokeType === 'mixed';

    if (includeGate) {
      evidence.push({
        label: 'Gate fail rate',
        numerator: gateFailCount,
        denominator: moodSampleCount,
        value: gateFailRate,
        population: buildPopulation('mood-regime', moodSampleCount),
      });

      if (gateMismatch) {
        if (
          typeof rawPassInRegimeCount === 'number' &&
          typeof lostPassInRegimeCount === 'number' &&
          rawPassInRegimeCount > 0
        ) {
          evidence.push({
            label: 'Lost passes | raw >= threshold',
            numerator: lostPassInRegimeCount,
            denominator: rawPassInRegimeCount,
            value: lostPassInRegimeCount / rawPassInRegimeCount,
            population: buildPopulation(
              'mood-regime',
              rawPassInRegimeCount
            ),
          });
        }
        const failedGateCounts = prototype.failedGateCounts ?? [];
        if (failedGateCounts.length > 0 && gateFailCount > 0) {
          const topGate = failedGateCounts[0];
          evidence.push({
            label: `Most failed gate: ${topGate.gateId}`,
            numerator: topGate.count ?? 0,
            denominator: gateFailCount,
            value:
              gateFailCount > 0 ? (topGate.count ?? 0) / gateFailCount : 0,
            population: buildPopulation('mood-regime', gateFailCount),
          });
        }
      }

      if (gateIncompatibility) {
        evidence.push({
          label: 'Gate compatibility',
          numerator: compatibilityScore,
          denominator: 1,
          value: compatibilityScore,
          population: buildPopulation('mood-regime', moodSampleCount),
        });
      }
    }

    if (includeThreshold) {
      evidence.push({
        label: 'Pass | gate',
        numerator: thresholdPassCount,
        denominator: gatePassCount,
        value: pThreshGivenGate,
        population: buildPopulation(
          'gate-pass (mood-regime)',
          gatePassCount
        ),
      });

      if (typeof meanValueGivenGate === 'number') {
        evidence.push({
          label: 'Mean value | gate',
          numerator: meanValueGivenGate,
          denominator: 1,
          value: meanValueGivenGate,
          population: buildPopulation(
            'gate-pass (mood-regime)',
            gatePassCount
          ),
        });
      }

      if (typeof clause.thresholdValue === 'number') {
        evidence.push({
          label: 'Clause threshold',
          numerator: clause.thresholdValue,
          denominator: 1,
          value: clause.thresholdValue,
          population: buildPopulation('mood-regime', moodSampleCount),
        });
      }
    }

    return evidence;
  }

  #buildActions({ gateMismatch, thresholdMismatch }) {
    const actions = [];
    if (gateMismatch) {
      actions.push(
        'Tighten mood-regime axis constraints that allow gate-clamped states.'
      );
      actions.push('Loosen prototype gate thresholds or swap the prototype.');
    }
    if (thresholdMismatch) {
      actions.push(
        'Lower the prototype threshold or rebalance weights to raise values.'
      );
    }

    if (actions.length === 0) {
      actions.push('Review prototype gating and threshold alignment.');
    }

    return Array.from(new Set(actions));
  }

  #buildGateIncompatibilityActions() {
    return [
      'Regime makes the gate impossible; adjust gate inputs or swap prototype.',
    ];
  }
}

export default RecommendationEngine;
