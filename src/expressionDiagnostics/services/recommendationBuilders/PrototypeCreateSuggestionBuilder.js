/**
 * @file PrototypeCreateSuggestionBuilder - Builds prototype_create_suggestion recommendations.
 * @description Extracted from RecommendationEngine to handle the complex logic for
 * determining when to suggest creating a new emotion prototype.
 *
 * Emission logic: (A && B) || C, with spam brake.
 *   A = No usable existing prototype (all candidates fail usability thresholds)
 *   B = Proposed prototype materially improves fit (delta >= 15% or special case)
 *   C = Gap signal detected (target signature distant from all prototypes)
 *
 * @see RecommendationEngine.js (orchestrator that delegates to this builder)
 */

import {
  getSeverity,
  buildPopulation,
} from '../utils/recommendationUtils.js';

// === CONSTANTS ===

/** Default threshold t* for P(I >= t*) calculations */
export const DEFAULT_THRESHOLD_T_STAR = 0.55;

/** Maximum candidates to consider from leaderboard */
export const CANDIDATE_SET_SIZE = 10;

/** Minimum gate pass rate for a prototype to be considered usable */
export const USABLE_GATE_PASS_RATE_MIN = 0.3;

/** Minimum P(I >= t*) for a prototype to be considered usable */
export const USABLE_P_AT_LEAST_T_MIN = 0.1;

/** Maximum conflict rate for a prototype to be considered usable */
export const USABLE_CONFLICT_RATE_MAX = 0.2;

/** Minimum delta improvement required for condition B */
export const IMPROVEMENT_DELTA_MIN = 0.15;

/** Threshold below which both existing and proposed are considered "low" */
export const IMPROVEMENT_BOTH_LOW_THRESHOLD = 0.05;

/** Distance threshold for gap signal (condition C) */
export const GAP_NEAREST_DISTANCE_THRESHOLD = 0.45;

/** Percentile threshold for gap signal (condition C) */
export const GAP_PERCENTILE_THRESHOLD = 95;

/** Minimum gate pass rate for sanity check */
export const SANITY_GATE_PASS_RATE_MIN = 0.2;

/** Minimum non-zero weights for sanity check */
export const SANITY_MIN_NON_ZERO_WEIGHTS = 3;

/** Maximum distance for spam brake to trigger */
export const SPAM_BRAKE_DISTANCE_MAX = 0.35;

/** Minimum P(I >= t*) for spam brake to trigger */
export const SPAM_BRAKE_P_AT_LEAST_T_MIN = 0.15;

/**
 * Builder class for prototype_create_suggestion recommendations.
 *
 * Responsible for:
 * - Determining when prototype creation should be suggested
 * - Synthesizing proposed prototypes via the synthesis service
 * - Building evidence and confidence assessments
 */
class PrototypeCreateSuggestionBuilder {
  #prototypeSynthesisService;

  /**
   * @param {object} options
   * @param {object} options.prototypeSynthesisService - Required synthesis service for prototype creation.
   * @throws {Error} If prototypeSynthesisService is not provided.
   */
  constructor({ prototypeSynthesisService }) {
    if (!prototypeSynthesisService) {
      throw new Error(
        'PrototypeCreateSuggestionBuilder requires prototypeSynthesisService'
      );
    }
    this.#prototypeSynthesisService = prototypeSynthesisService;
  }

  /**
   * Build a prototype_create_suggestion recommendation from diagnostic facts.
   *
   * Emission logic: (A && B) || C, with spam brake.
   *
   * @param {object} diagnosticFacts - The complete diagnostic facts object.
   * @returns {object|null} The recommendation object, or null if no recommendation should be emitted.
   */
  build(diagnosticFacts) {
    const prototypeFit = diagnosticFacts.prototypeFit;
    const gapDetection = diagnosticFacts.gapDetection;
    const targetSignature = diagnosticFacts.targetSignature;

    if (!prototypeFit || !gapDetection || !targetSignature) {
      return null;
    }

    const leaderboard = prototypeFit.leaderboard ?? [];
    if (leaderboard.length === 0) {
      return null;
    }

    // Select anchor clause and determine threshold t*
    const clauses = diagnosticFacts.clauses ?? [];
    const anchorClause = this.#selectAnchorClause(clauses);
    const thresholdTStar =
      typeof anchorClause?.thresholdValue === 'number'
        ? anchorClause.thresholdValue
        : DEFAULT_THRESHOLD_T_STAR;

    // Build candidate set
    const candidates = this.#buildCandidateSet(leaderboard, gapDetection);
    if (candidates.length === 0) {
      return null;
    }

    // Find best existing prototype
    const best = this.#findBestExistingPrototype(candidates, thresholdTStar);

    // Check spam brake first
    const nearestDistance = gapDetection.nearestDistance ?? 0;
    const bestPAtLeastT = this.#getPAtLeastT(best, thresholdTStar);
    if (
      nearestDistance <= SPAM_BRAKE_DISTANCE_MAX &&
      bestPAtLeastT >= SPAM_BRAKE_P_AT_LEAST_T_MIN
    ) {
      return null;
    }

    // Evaluate A, B, C conditions
    const A = this.#checkNoUsablePrototype(candidates, thresholdTStar);
    const C = this.#checkGapSignal(gapDetection);

    // Early exit if neither A nor C is true
    if (!A && !C) {
      return null;
    }

    // Synthesize proposed prototype
    const synthesized = this.#synthesizeProposedPrototype(
      diagnosticFacts,
      anchorClause,
      thresholdTStar
    );
    if (!synthesized) {
      return null;
    }

    // Evaluate B condition
    const B = this.#checkImprovementCondition(
      synthesized.predictedFit,
      best,
      thresholdTStar
    );

    // Determine if we should emit based on (A && B) || C
    const shouldEmitAB = A && B;
    const shouldEmitC = C && this.#passesSanityCheck(synthesized);
    if (!shouldEmitAB && !shouldEmitC) {
      return null;
    }

    // Determine confidence
    const confidence = this.#determineConfidence(A, B, C, shouldEmitC);
    if (confidence === 'low') {
      return null;
    }

    // Determine severity
    const anchorImpact =
      typeof anchorClause?.impact === 'number' ? anchorClause.impact : 0;
    const severity = anchorClause ? getSeverity(anchorImpact) : 'low';

    // Build evidence
    const evidence = this.#buildPrototypeCreateEvidence({
      gapDetection,
      best,
      synthesized,
      thresholdTStar,
      targetSignature,
      anchorClause,
      C,
    });

    // Build why rationale
    const why = this.#buildPrototypeCreateWhy(A, B, C, shouldEmitAB, shouldEmitC);

    const expressionId = diagnosticFacts.expressionId ?? 'unknown';
    const anchorClauseId = anchorClause?.clauseId ?? 'none';

    return {
      id: `prototype_create_suggestion:${expressionId}:${anchorClauseId}`,
      type: 'prototype_create_suggestion',
      title: 'Prototype creation suggested',
      severity,
      confidence,
      why,
      evidence,
      proposedPrototype: {
        name: synthesized.name,
        weights: synthesized.weights,
        gates: synthesized.gates,
        derivedFrom: {
          anchorPrototype: this.#getAnchorPrototypeId(anchorClause, diagnosticFacts),
          targetSignature: this.#serializeTargetSignature(targetSignature),
          regimeBounds: diagnosticFacts.moodRegime?.bounds ?? null,
        },
      },
      predictedFit: this.#buildPredictedFitPayload(
        synthesized.predictedFit,
        best,
        thresholdTStar,
        diagnosticFacts
      ),
      relatedClauseIds: anchorClause?.clauseId ? [anchorClause.clauseId] : [],
    };
  }

  // === PRIVATE METHODS ===

  /**
   * Select anchor clause: highest-impact clause with prototypeId, tie-break by clauseId.
   *
   * @param {Array} clauses - Array of clause objects.
   * @returns {object|null} The selected anchor clause, or null if none found.
   */
  #selectAnchorClause(clauses) {
    const withPrototype = clauses.filter((c) => c.prototypeId);
    if (withPrototype.length === 0) {
      return null;
    }
    return [...withPrototype].sort((a, b) => {
      const impactA = typeof a.impact === 'number' ? a.impact : 0;
      const impactB = typeof b.impact === 'number' ? b.impact : 0;
      if (impactB !== impactA) {
        return impactB - impactA;
      }
      return String(a.clauseId ?? '').localeCompare(String(b.clauseId ?? ''));
    })[0];
  }

  /**
   * Build candidate set from leaderboard (top K by combinedScore or distance).
   *
   * @param {Array} leaderboard - Leaderboard array from prototypeFit.
   * @param {object} _gapDetection - Gap detection data (unused but kept for signature consistency).
   * @returns {Array} Top CANDIDATE_SET_SIZE candidates.
   */
  #buildCandidateSet(leaderboard, _gapDetection) {
    // Primary: use combinedScore if available
    const sorted = [...leaderboard].sort((a, b) => {
      const scoreA = typeof a.combinedScore === 'number' ? a.combinedScore : 0;
      const scoreB = typeof b.combinedScore === 'number' ? b.combinedScore : 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      // Fallback to distance (lower is better)
      const distA = typeof a.distance === 'number' ? a.distance : 1;
      const distB = typeof b.distance === 'number' ? b.distance : 1;
      return distA - distB;
    });
    return sorted.slice(0, CANDIDATE_SET_SIZE);
  }

  /**
   * Find best existing prototype by lexicographic: pAtLeastT(t*), gatePassRate, p95.
   *
   * @param {Array} candidates - Candidate prototypes.
   * @param {number} thresholdTStar - Threshold value t*.
   * @returns {object|null} The best candidate, or null if empty.
   */
  #findBestExistingPrototype(candidates, thresholdTStar) {
    if (candidates.length === 0) {
      return null;
    }
    return [...candidates].sort((a, b) => {
      const pA = this.#getPAtLeastT(a, thresholdTStar);
      const pB = this.#getPAtLeastT(b, thresholdTStar);
      if (pB !== pA) {
        return pB - pA;
      }
      const gprA = a.gatePassRate ?? 0;
      const gprB = b.gatePassRate ?? 0;
      if (gprB !== gprA) {
        return gprB - gprA;
      }
      const p95A = a.intensityDistribution?.p95 ?? 0;
      const p95B = b.intensityDistribution?.p95 ?? 0;
      return p95B - p95A;
    })[0];
  }

  /**
   * Get pAtLeastT for a given threshold from a prototype's intensityDistribution.
   *
   * @param {object} prototype - Prototype object with intensityDistribution.
   * @param {number} threshold - Threshold value t*.
   * @returns {number} P(I >= t*) value.
   */
  #getPAtLeastT(prototype, threshold) {
    if (!prototype?.intensityDistribution?.pAboveThreshold) {
      return 0;
    }
    const pAbove = prototype.intensityDistribution.pAboveThreshold;
    // Find exact match or closest
    const entry = pAbove.find(
      (e) => typeof e.t === 'number' && Math.abs(e.t - threshold) < 0.001
    );
    if (entry && typeof entry.p === 'number') {
      return entry.p;
    }
    // If no exact match, use interpolation or fallback
    return this.#interpolatePAtLeastT(pAbove, threshold);
  }

  /**
   * Interpolate pAtLeastT when exact threshold not found.
   *
   * @param {Array} pAbove - Array of {t, p} entries.
   * @param {number} threshold - Threshold to interpolate.
   * @returns {number} Interpolated probability.
   */
  #interpolatePAtLeastT(pAbove, threshold) {
    if (!Array.isArray(pAbove) || pAbove.length === 0) {
      return 0;
    }
    // Sort by threshold
    const sorted = [...pAbove]
      .filter((e) => typeof e.t === 'number' && typeof e.p === 'number')
      .sort((a, b) => a.t - b.t);
    if (sorted.length === 0) {
      return 0;
    }
    // Below min threshold
    if (threshold <= sorted[0].t) {
      return sorted[0].p;
    }
    // Above max threshold
    if (threshold >= sorted[sorted.length - 1].t) {
      return sorted[sorted.length - 1].p;
    }
    // Linear interpolation
    for (let i = 0; i < sorted.length - 1; i++) {
      if (threshold >= sorted[i].t && threshold <= sorted[i + 1].t) {
        const t0 = sorted[i].t;
        const t1 = sorted[i + 1].t;
        const p0 = sorted[i].p;
        const p1 = sorted[i + 1].p;
        const ratio = (threshold - t0) / (t1 - t0);
        return p0 + ratio * (p1 - p0);
      }
    }
    return 0;
  }

  /**
   * Check condition A: No usable existing prototype.
   *
   * @param {Array} candidates - Candidate prototypes.
   * @param {number} thresholdTStar - Threshold value t*.
   * @returns {boolean} True if no usable prototype exists.
   */
  #checkNoUsablePrototype(candidates, thresholdTStar) {
    for (const proto of candidates) {
      if (this.#isUsablePrototype(proto, thresholdTStar)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if a prototype is usable.
   *
   * @param {object} proto - Prototype candidate.
   * @param {number} thresholdTStar - Threshold value t*.
   * @returns {boolean} True if prototype meets usability thresholds.
   */
  #isUsablePrototype(proto, thresholdTStar) {
    const gatePassRate = proto.gatePassRate ?? 0;
    const pAtLeastT = this.#getPAtLeastT(proto, thresholdTStar);
    const conflictRate = proto.conflictRate ?? null;

    if (gatePassRate < USABLE_GATE_PASS_RATE_MIN) {
      return false;
    }
    if (pAtLeastT < USABLE_P_AT_LEAST_T_MIN) {
      return false;
    }
    if (
      typeof conflictRate === 'number' &&
      conflictRate > USABLE_CONFLICT_RATE_MAX
    ) {
      return false;
    }
    return true;
  }

  /**
   * Check condition C: Prototype space gap signal.
   *
   * @param {object} gapDetection - Gap detection data.
   * @returns {boolean} True if gap signal detected.
   */
  #checkGapSignal(gapDetection) {
    const nearestDistance = gapDetection.nearestDistance ?? 0;
    const distancePercentile = gapDetection.distancePercentile ?? 0;

    return (
      nearestDistance > GAP_NEAREST_DISTANCE_THRESHOLD ||
      distancePercentile >= GAP_PERCENTILE_THRESHOLD
    );
  }

  /**
   * Check condition B: Proposed prototype materially improves fit.
   *
   * @param {object} predictedFit - Predicted fit from synthesized prototype.
   * @param {object} best - Best existing prototype.
   * @param {number} thresholdTStar - Threshold value t*.
   * @returns {boolean} True if improvement condition is met.
   */
  #checkImprovementCondition(predictedFit, best, thresholdTStar) {
    const pNew = this.#getPAtLeastTFromPredicted(predictedFit, thresholdTStar);
    const pBest = this.#getPAtLeastT(best, thresholdTStar);
    const delta = pNew - pBest;

    // Primary condition: delta >= 0.15
    if (delta >= IMPROVEMENT_DELTA_MIN) {
      return true;
    }

    // Special case: both < 0.05, require pNew >= 0.10
    if (
      pNew < IMPROVEMENT_BOTH_LOW_THRESHOLD &&
      pBest < IMPROVEMENT_BOTH_LOW_THRESHOLD
    ) {
      return pNew >= USABLE_P_AT_LEAST_T_MIN;
    }

    return false;
  }

  /**
   * Get pAtLeastT from predicted fit structure.
   *
   * @param {object} predictedFit - Predicted fit object.
   * @param {number} threshold - Threshold value t*.
   * @returns {number} P(I >= t*) from predicted fit.
   */
  #getPAtLeastTFromPredicted(predictedFit, threshold) {
    if (!predictedFit?.pAtLeastT) {
      return 0;
    }
    const pAtLeastT = predictedFit.pAtLeastT;
    // Find exact match first
    const entry = pAtLeastT.find(
      (e) => typeof e.t === 'number' && Math.abs(e.t - threshold) < 0.001
    );
    if (entry && typeof entry.p === 'number') {
      return entry.p;
    }
    // If no exact match, use interpolation
    return this.#interpolatePAtLeastT(pAtLeastT, threshold);
  }

  /**
   * Synthesize proposed prototype using the synthesis service.
   *
   * @param {object} diagnosticFacts - Complete diagnostic facts.
   * @param {object} anchorClause - Selected anchor clause.
   * @param {number} threshold - Threshold value t*.
   * @returns {object|null} Synthesized prototype, or null on failure.
   */
  #synthesizeProposedPrototype(diagnosticFacts, anchorClause, threshold) {
    const targetSignature = diagnosticFacts.targetSignature;
    const regimeBounds = diagnosticFacts.moodRegime?.bounds ?? {};
    const storedMoodRegimeContexts =
      diagnosticFacts.storedMoodRegimeContexts ?? [];
    const prototypeDefinitions = diagnosticFacts.prototypeDefinitions ?? {};

    // Get anchor prototype if available
    let anchorPrototype = null;
    if (anchorClause?.prototypeId) {
      const def = prototypeDefinitions[anchorClause.prototypeId];
      if (def) {
        anchorPrototype = {
          id: anchorClause.prototypeId,
          weights: def.weights ?? {},
          gates: def.gates ?? [],
        };
      }
    }

    // Collect existing prototype names for collision avoidance
    const existingNames = new Set(Object.keys(prototypeDefinitions));

    try {
      return this.#prototypeSynthesisService.synthesize({
        targetSignature,
        regimeBounds,
        storedMoodRegimeContexts,
        anchorPrototype,
        threshold,
        existingNames,
      });
    } catch {
      return null;
    }
  }

  /**
   * Check sanity conditions for C-triggered emission.
   *
   * @param {object} synthesized - Synthesized prototype.
   * @returns {boolean} True if sanity check passes.
   */
  #passesSanityCheck(synthesized) {
    const gatePassRate = synthesized.predictedFit?.gatePassRate ?? 0;
    const weights = synthesized.weights ?? {};
    const nonZeroCount = Object.values(weights).filter(
      (w) => typeof w === 'number' && Math.abs(w) > 0.001
    ).length;

    return (
      gatePassRate >= SANITY_GATE_PASS_RATE_MIN &&
      nonZeroCount >= SANITY_MIN_NON_ZERO_WEIGHTS
    );
  }

  /**
   * Determine confidence level.
   *
   * @param {boolean} A - Condition A (no usable prototype).
   * @param {boolean} B - Condition B (improvement).
   * @param {boolean} C - Condition C (gap signal).
   * @param {boolean} sanityPassed - Whether sanity check passed.
   * @returns {'high'|'medium'|'low'} Confidence level.
   */
  #determineConfidence(A, B, C, sanityPassed) {
    if ((A && B) || (C && B)) {
      return 'high';
    }
    if (C && sanityPassed) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Build evidence array for prototype create suggestion.
   *
   * @param {object} params - Evidence building parameters.
   * @returns {Array} Array of evidence objects.
   */
  #buildPrototypeCreateEvidence({
    gapDetection,
    best,
    synthesized,
    thresholdTStar,
    targetSignature,
    anchorClause,
    C,
  }) {
    const evidence = [];

    // Gap evidence (if C triggered)
    if (C) {
      const nearestDistance = gapDetection.nearestDistance ?? 0;
      const distancePercentile = gapDetection.distancePercentile ?? null;
      evidence.push({
        label: 'Nearest prototype distance',
        value: nearestDistance,
        population: null,
      });
      if (typeof distancePercentile === 'number') {
        evidence.push({
          label: 'Distance percentile',
          value: distancePercentile,
          population: null,
        });
      }
    }

    // Best existing prototype fit
    if (best) {
      const bestPAtLeastT = this.#getPAtLeastT(best, thresholdTStar);
      evidence.push({
        label: `Best existing P(I >= ${thresholdTStar.toFixed(2)})`,
        value: bestPAtLeastT,
        prototypeId: best.prototypeId ?? null,
        population: buildPopulation(
          'stored-mood-regime',
          best.moodSampleCount ?? null
        ),
      });
      evidence.push({
        label: 'Best existing gate pass rate',
        value: best.gatePassRate ?? 0,
        prototypeId: best.prototypeId ?? null,
        population: buildPopulation(
          'stored-mood-regime',
          best.moodSampleCount ?? null
        ),
      });
    }

    // Proposed prototype fit
    const predictedFit = synthesized.predictedFit ?? {};
    const proposedPAtLeastT = this.#getPAtLeastTFromPredicted(
      predictedFit,
      thresholdTStar
    );
    evidence.push({
      label: `Proposed P(I >= ${thresholdTStar.toFixed(2)})`,
      value: proposedPAtLeastT,
      population: buildPopulation(
        'stored-mood-regime',
        predictedFit.N ?? null
      ),
    });
    evidence.push({
      label: 'Proposed gate pass rate',
      value: predictedFit.gatePassRate ?? 0,
      population: buildPopulation(
        'stored-mood-regime',
        predictedFit.N ?? null
      ),
    });

    // Delta
    const bestPAtLeastT = best ? this.#getPAtLeastT(best, thresholdTStar) : 0;
    const delta = proposedPAtLeastT - bestPAtLeastT;
    evidence.push({
      label: `Delta P(I >= ${thresholdTStar.toFixed(2)})`,
      value: delta,
      population: null,
    });

    // Target signature summary
    const sigSummary = this.#summarizeTargetSignature(targetSignature);
    if (sigSummary) {
      evidence.push({
        label: 'Target signature',
        value: sigSummary,
        population: null,
      });
    }

    // Anchor prototype
    if (anchorClause?.prototypeId) {
      evidence.push({
        label: 'Anchor prototype',
        value: anchorClause.prototypeId,
        population: null,
      });
    }

    return evidence;
  }

  /**
   * Build why rationale string.
   *
   * @param {boolean} A - Condition A.
   * @param {boolean} B - Condition B.
   * @param {boolean} C - Condition C.
   * @param {boolean} shouldEmitAB - Whether emitting due to A && B.
   * @param {boolean} shouldEmitC - Whether emitting due to C.
   * @returns {string} Human-readable rationale.
   */
  #buildPrototypeCreateWhy(A, B, C, shouldEmitAB, shouldEmitC) {
    const parts = [];
    if (shouldEmitAB) {
      parts.push('No existing prototype meets usability thresholds.');
      parts.push('Proposed prototype improves fit by at least 15 percentage points.');
    } else if (shouldEmitC) {
      parts.push(
        'Target signature is distant from all existing prototypes (gap detected).'
      );
      if (B) {
        parts.push('Proposed prototype also improves fit.');
      }
    }
    return parts.join(' ');
  }

  /**
   * Build predicted fit payload for the recommendation.
   *
   * @param {object} predictedFit - Predicted fit from synthesized prototype.
   * @param {object} best - Best existing prototype.
   * @param {number} thresholdTStar - Threshold value t*.
   * @param {object} _diagnosticFacts - Diagnostic facts (unused but kept for consistency).
   * @returns {object} Predicted fit payload.
   */
  #buildPredictedFitPayload(predictedFit, best, thresholdTStar, _diagnosticFacts) {
    const N = predictedFit?.N ?? 0;
    const gatePassRate = predictedFit?.gatePassRate ?? 0;
    const mean = predictedFit?.mean ?? 0;
    const p95 = predictedFit?.p95 ?? 0;
    const pAtLeastT = predictedFit?.pAtLeastT ?? [];

    // Build comparison
    const bestPAtLeastT = best ? this.#getPAtLeastT(best, thresholdTStar) : 0;
    const proposedPAtLeastT = this.#getPAtLeastTFromPredicted(
      predictedFit,
      thresholdTStar
    );

    return {
      population: 'stored-mood-regime',
      N,
      gatePassRate,
      mean,
      p95,
      pAtLeastT,
      comparison: {
        bestExistingPrototype: best?.prototypeId ?? null,
        bestExisting: bestPAtLeastT,
        delta: proposedPAtLeastT - bestPAtLeastT,
      },
    };
  }

  /**
   * Get anchor prototype ID from clause and definitions.
   *
   * @param {object} anchorClause - Anchor clause.
   * @param {object} diagnosticFacts - Diagnostic facts.
   * @returns {string|null} Anchor prototype ID, or null if not found.
   */
  #getAnchorPrototypeId(anchorClause, diagnosticFacts) {
    if (!anchorClause?.prototypeId) {
      return null;
    }
    const defs = diagnosticFacts.prototypeDefinitions ?? {};
    return defs[anchorClause.prototypeId] ? anchorClause.prototypeId : null;
  }

  /**
   * Serialize target signature for evidence.
   *
   * @param {object} targetSignature - Target signature object.
   * @returns {object|null} Serialized signature.
   */
  #serializeTargetSignature(targetSignature) {
    if (!targetSignature || typeof targetSignature !== 'object') {
      return null;
    }
    const result = {};
    for (const [axis, data] of Object.entries(targetSignature)) {
      if (data && typeof data === 'object') {
        result[axis] = {
          dir: data.dir ?? null,
          importance: data.importance ?? null,
        };
      }
    }
    return result;
  }

  /**
   * Summarize target signature for evidence display.
   *
   * @param {object} targetSignature - Target signature object.
   * @returns {string|null} Summary string.
   */
  #summarizeTargetSignature(targetSignature) {
    if (!targetSignature || typeof targetSignature !== 'object') {
      return null;
    }
    const entries = Object.entries(targetSignature)
      .filter(([, data]) => data && typeof data.importance === 'number')
      .sort((a, b) => (b[1].importance ?? 0) - (a[1].importance ?? 0))
      .slice(0, 3)
      .map(([axis, data]) => `${axis}:${data.dir ?? '?'}(${(data.importance ?? 0).toFixed(2)})`);
    return entries.length > 0 ? entries.join(', ') : null;
  }
}

export default PrototypeCreateSuggestionBuilder;
