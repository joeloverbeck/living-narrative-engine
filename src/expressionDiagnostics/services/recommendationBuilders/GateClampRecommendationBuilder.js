/**
 * @file GateClampRecommendationBuilder - Builds gate_clamp_regime_permissive recommendations.
 * @description Extracted from RecommendationEngine to handle the complex logic for
 * determining when to suggest tightening mood-regime axis constraints to reduce
 * gate-clamped states.
 *
 * Emission logic:
 *   - Gate clamp rate >= 20% (significant clamp frequency)
 *   - Not all gates are implied by the regime
 *   - A candidate constraint exists that:
 *     - Keeps >= 50% of regime samples
 *     - Reduces clamp rate by >= 10%
 *     - Actually tightens the regime bounds
 *
 * @see RecommendationEngine.js (orchestrator that delegates to this builder)
 */

import {
  getConfidence,
  getSeverity,
  buildPopulation,
} from '../utils/recommendationUtils.js';

// === CONSTANTS ===

/** Minimum gate clamp rate to trigger recommendation */
export const GATE_CLAMP_MIN_RATE = 0.2;

/** Minimum keep ratio for candidate to be considered */
export const GATE_CLAMP_MIN_KEEP = 0.5;

/** Minimum delta reduction in clamp rate */
export const GATE_CLAMP_MIN_DELTA = 0.1;

/**
 * Builder class for gate_clamp_regime_permissive recommendations.
 *
 * Responsible for:
 * - Determining when gate clamp recommendations should be suggested
 * - Selecting the best candidate constraint to reduce gate clamping
 * - Building evidence and confidence assessments
 *
 * This builder is stateless and requires no constructor dependencies.
 */
class GateClampRecommendationBuilder {
  /**
   * Build a gate_clamp_regime_permissive recommendation from clause facts.
   *
   * @param {object} clause - Clause object with gateClampRegimePermissive data.
   * @returns {object|null} The recommendation object, or null if no recommendation should be emitted.
   */
  build(clause) {
    const gateClampFacts = clause?.gateClampRegimePermissive;
    if (!gateClampFacts) {
      return null;
    }

    const gateClampRate = gateClampFacts.gateClampRateInRegime;
    if (typeof gateClampRate !== 'number') {
      return null;
    }
    if (gateClampRate < GATE_CLAMP_MIN_RATE) {
      return null;
    }
    if (gateClampFacts.allGatesImplied) {
      return null;
    }

    const candidate = this.#selectCandidate(gateClampFacts);
    if (!candidate) {
      return null;
    }

    const moodRegimeCount =
      typeof gateClampFacts.moodRegimeCount === 'number'
        ? gateClampFacts.moodRegimeCount
        : 0;
    const confidence = getConfidence(moodRegimeCount);
    const impact = typeof clause.impact === 'number' ? clause.impact : 0;

    const whyParts = [
      'Mood regime admits gate-clamped states for this clause.',
      `Gate clamp rate is ${(gateClampRate * 100).toFixed(1)}%.`,
      `Candidate constraint keeps ${(candidate.keepRatio * 100).toFixed(
        1
      )}% of regime samples.`,
    ];
    if (confidence === 'low') {
      whyParts.push(
        `Low confidence due to limited mood samples (N=${moodRegimeCount}).`
      );
    }

    return {
      id: `gate_clamp_regime_permissive:${clause.clauseId ?? 'unknown'}:${candidate.id}`,
      type: 'gate_clamp_regime_permissive',
      severity: getSeverity(impact),
      confidence,
      title: 'Mood regime allows gate-clamped states',
      why: whyParts.join(' '),
      evidence: this.#buildEvidence(gateClampFacts, candidate),
      actions: this.#buildActions(candidate),
      predictedEffect:
        'Reduce gate clamp frequency while preserving regime coverage.',
      relatedClauseIds: clause.clauseId ? [clause.clauseId] : [],
    };
  }

  // === PRIVATE METHODS ===

  /**
   * Select the best candidate constraint from available candidates.
   * Sorts by predClampRate (ascending), then keepRatio (descending), then id.
   *
   * @param {object} gateClampFacts - Gate clamp facts from clause.
   * @returns {object|null} The best candidate, or null if none eligible.
   */
  #selectCandidate(gateClampFacts) {
    const clampRate = gateClampFacts?.gateClampRateInRegime;
    if (typeof clampRate !== 'number') {
      return null;
    }

    const candidates = Array.isArray(gateClampFacts.candidates)
      ? gateClampFacts.candidates
      : [];
    const eligible = candidates.filter((candidate) =>
      this.#candidateMeetsThresholds(candidate, clampRate, gateClampFacts)
    );

    if (eligible.length === 0) {
      return null;
    }

    return eligible
      .slice()
      .sort((a, b) => {
        const clampA =
          typeof a.predClampRate === 'number' ? a.predClampRate : 1;
        const clampB =
          typeof b.predClampRate === 'number' ? b.predClampRate : 1;
        if (clampA !== clampB) {
          return clampA - clampB;
        }
        const keepA = typeof a.keepRatio === 'number' ? a.keepRatio : -1;
        const keepB = typeof b.keepRatio === 'number' ? b.keepRatio : -1;
        if (keepB !== keepA) {
          return keepB - keepA;
        }
        return String(a.id).localeCompare(String(b.id));
      })[0];
  }

  /**
   * Check if a candidate meets all threshold requirements.
   *
   * @param {object} candidate - Candidate constraint.
   * @param {number} clampRate - Current gate clamp rate.
   * @param {object} gateClampFacts - Gate clamp facts for regime bounds.
   * @returns {boolean} True if candidate meets all thresholds.
   */
  #candidateMeetsThresholds(candidate, clampRate, gateClampFacts) {
    if (!candidate || typeof clampRate !== 'number') {
      return false;
    }
    if (
      typeof candidate.keepRatio !== 'number' ||
      typeof candidate.predClampRate !== 'number'
    ) {
      return false;
    }
    if (candidate.keepRatio < GATE_CLAMP_MIN_KEEP) {
      return false;
    }
    if (candidate.predClampRate > clampRate - GATE_CLAMP_MIN_DELTA) {
      return false;
    }
    return this.#candidateTightensRegime(
      candidate,
      gateClampFacts?.gatePredicates
    );
  }

  /**
   * Check if the candidate constraint actually tightens the regime bounds.
   * A constraint is redundant if it's already implied by existing bounds.
   *
   * @param {object} candidate - Candidate constraint with axes.
   * @param {Array} gatePredicates - Gate predicates with regime bounds.
   * @returns {boolean} True if candidate tightens the regime.
   */
  #candidateTightensRegime(candidate, gatePredicates) {
    if (!candidate || !Array.isArray(candidate.axes)) {
      return false;
    }

    const boundsByAxis = new Map();
    for (const predicate of gatePredicates ?? []) {
      if (predicate?.axis && predicate.regimeBounds) {
        boundsByAxis.set(predicate.axis, predicate.regimeBounds);
      }
    }

    let tightens = false;
    for (const axisConstraint of candidate.axes) {
      const axis = axisConstraint?.axis;
      const operator = axisConstraint?.operator;
      const threshold = axisConstraint?.thresholdRaw;
      if (
        typeof axis !== 'string' ||
        typeof operator !== 'string' ||
        typeof threshold !== 'number'
      ) {
        return false;
      }

      const bounds = boundsByAxis.get(axis);
      if (
        !bounds ||
        typeof bounds.min !== 'number' ||
        typeof bounds.max !== 'number'
      ) {
        tightens = true;
        continue;
      }

      if (this.#constraintTightensBounds(bounds, operator, threshold)) {
        tightens = true;
      }
    }

    return tightens;
  }

  /**
   * Check if a single constraint tightens the given bounds.
   *
   * @param {object} bounds - Regime bounds with min and max.
   * @param {string} operator - Comparison operator.
   * @param {number} threshold - Threshold value.
   * @returns {boolean} True if constraint tightens bounds.
   */
  #constraintTightensBounds(bounds, operator, threshold) {
    const min = bounds.min;
    const max = bounds.max;

    switch (operator) {
      case '>=':
        return threshold > min;
      case '>':
        return threshold + Number.EPSILON > min;
      case '<=':
        return threshold < max;
      case '<':
        return threshold - Number.EPSILON < max;
      case '==':
        return !(min >= threshold && max <= threshold);
      default:
        return false;
    }
  }

  /**
   * Build evidence array for the recommendation.
   *
   * @param {object} gateClampFacts - Gate clamp facts.
   * @param {object} candidate - Selected candidate.
   * @returns {Array} Array of evidence objects.
   */
  #buildEvidence(gateClampFacts, candidate) {
    const evidence = [];
    const moodRegimeCount =
      typeof gateClampFacts.moodRegimeCount === 'number'
        ? gateClampFacts.moodRegimeCount
        : null;
    const gateFail = gateClampFacts.gateFailInRegimeCount;
    const gatePass = gateClampFacts.gatePassInRegimeCount;
    if (typeof gateFail === 'number' && typeof moodRegimeCount === 'number') {
      evidence.push({
        label: 'Gate clamp rate (mood regime)',
        numerator: gateFail,
        denominator: moodRegimeCount,
        value: gateClampFacts.gateClampRateInRegime ?? 0,
        population: buildPopulation('mood-regime', moodRegimeCount),
      });
    }

    if (
      typeof candidate.keepRatio === 'number' &&
      typeof candidate.keepCount === 'number' &&
      typeof candidate.keepDenominator === 'number'
    ) {
      evidence.push({
        label: 'Keep ratio for proposed constraint',
        numerator: candidate.keepCount,
        denominator: candidate.keepDenominator,
        value: candidate.keepRatio,
        population: buildPopulation(
          'mood-regime',
          candidate.keepDenominator
        ),
      });
    }

    if (
      typeof candidate.predClampRate === 'number' &&
      typeof candidate.predSampleCount === 'number'
    ) {
      const predClampCount = Math.round(
        candidate.predClampRate * candidate.predSampleCount
      );
      evidence.push({
        label: 'Predicted gate clamp rate (post-constraint)',
        numerator: predClampCount,
        denominator: candidate.predSampleCount,
        value: candidate.predClampRate,
        population: buildPopulation(
          'mood-regime',
          candidate.predSampleCount
        ),
      });
    }

    if (typeof gatePass === 'number' && typeof moodRegimeCount === 'number') {
      evidence.push({
        label: 'Gate pass count (mood regime)',
        numerator: gatePass,
        denominator: moodRegimeCount,
        value: moodRegimeCount > 0 ? gatePass / moodRegimeCount : 0,
        population: buildPopulation('mood-regime', moodRegimeCount),
      });
    }

    for (const axisEvidence of gateClampFacts.axisEvidence ?? []) {
      const axis = axisEvidence?.axis ?? 'unknown';
      const operator = axisEvidence?.operator ?? '?';
      const threshold =
        typeof axisEvidence?.thresholdRaw === 'number'
          ? axisEvidence.thresholdRaw
          : 'n/a';
      const labelSuffix = `${axis} ${operator} ${threshold}`;

      if (axisEvidence?.fractionBelow) {
        const denominator =
          typeof axisEvidence.fractionBelow.denominator === 'number'
            ? axisEvidence.fractionBelow.denominator
            : typeof moodRegimeCount === 'number'
              ? moodRegimeCount
              : 0;
        evidence.push({
          label: `Axis below gate (${labelSuffix})`,
          numerator: axisEvidence.fractionBelow.count ?? 0,
          denominator,
          value: axisEvidence.fractionBelow.rate ?? null,
          population: buildPopulation('mood-regime', denominator),
        });
      }

      if (axisEvidence?.fractionAbove) {
        const denominator =
          typeof axisEvidence.fractionAbove.denominator === 'number'
            ? axisEvidence.fractionAbove.denominator
            : typeof moodRegimeCount === 'number'
              ? moodRegimeCount
              : 0;
        evidence.push({
          label: `Axis above gate (${labelSuffix})`,
          numerator: axisEvidence.fractionAbove.count ?? 0,
          denominator,
          value: axisEvidence.fractionAbove.rate ?? null,
          population: buildPopulation('mood-regime', denominator),
        });
      }
    }

    return evidence;
  }

  /**
   * Build actions array for the recommendation.
   *
   * @param {object} candidate - Selected candidate with axes.
   * @returns {Array<string>} Array of action strings.
   */
  #buildActions(candidate) {
    const axes = Array.isArray(candidate?.axes) ? candidate.axes : [];
    const axisHints = axes
      .map((axis) => {
        if (!axis) {
          return null;
        }
        const threshold =
          typeof axis.thresholdRaw === 'number' ? axis.thresholdRaw : 'n/a';
        return `${axis.axis} ${axis.operator ?? '?'} ${threshold}`;
      })
      .filter(Boolean)
      .join(', ');

    const actions = [
      'Tighten mood-regime axis constraints that allow gate-clamped states.',
    ];
    if (axisHints) {
      actions.push(`Add regime bounds aligned with gate predicates: ${axisHints}.`);
    }
    actions.push(
      'If the regime cannot be tightened safely, revisit gate thresholds instead.'
    );

    return Array.from(new Set(actions));
  }
}

export default GateClampRecommendationBuilder;
