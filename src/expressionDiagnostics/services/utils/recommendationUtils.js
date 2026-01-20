/**
 * @file recommendationUtils - Shared utilities for recommendation generation
 * @description Pure functions for confidence calculation, severity determination,
 * population building, choke classification, and impact extraction.
 * @see RecommendationEngine.js (orchestrator that uses these utilities)
 */

// === CONSTANTS ===

/**
 * Severity ordering for recommendation sorting.
 * Lower values indicate higher severity (sorted first).
 */
export const SEVERITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Threshold for classifying gate failures as a choke point.
 * Gate fail rate >= this value indicates a gate problem.
 */
export const CHOKE_GATE_FAIL_RATE = 0.2;

/**
 * Maximum pass-given-gate rate before threshold is considered a choke.
 * Values below this threshold indicate a threshold problem.
 */
export const CHOKE_PASS_GIVEN_GATE_MAX = 0.95;

// === CONFIDENCE & SEVERITY ===

/**
 * Determines confidence level based on sample count.
 *
 * @param {number} sampleCount - Number of samples in the mood regime
 * @returns {'high'|'medium'|'low'} Confidence level
 */
export function getConfidence(sampleCount) {
  if (sampleCount >= 500) {
    return 'high';
  }
  if (sampleCount >= 200) {
    return 'medium';
  }
  return 'low';
}

/**
 * Determines severity level based on impact score.
 *
 * @param {number} impact - Impact score (0-1 range)
 * @returns {'high'|'medium'|'low'} Severity level
 */
export function getSeverity(impact) {
  if (impact >= 0.2) {
    return 'high';
  }
  if (impact >= 0.1) {
    return 'medium';
  }
  return 'low';
}

// === POPULATION BUILDING ===

/**
 * Builds a population object for recommendation evidence.
 *
 * @param {string} name - Population name
 * @param {number} count - Population count
 * @returns {{name: string, count: number|null}|null} Population object or null
 */
export function buildPopulation(name, count) {
  if (typeof name !== 'string' || name.length === 0) {
    return null;
  }
  if (typeof count !== 'number' || Number.isNaN(count)) {
    return { name, count: null };
  }
  return { name, count };
}

// === IMPACT EXTRACTION ===

/**
 * Extracts impact score from a recommendation ID by looking up the clause.
 *
 * @param {string} id - Recommendation ID (format: "type:subtype:clauseId")
 * @param {Array<{clauseId: string, impact: number}>} clauses - Array of clause objects
 * @returns {number} Impact score (0 if not found)
 */
export function getImpactFromId(id, clauses) {
  const parts = String(id).split(':');
  const clauseId = parts.slice(2).join(':');
  const clause = clauses.find((entry) => entry.clauseId === clauseId);
  return typeof clause?.impact === 'number' ? clause.impact : 0;
}

// === CHOKE CLASSIFICATION ===

/**
 * Determines if a threshold is a choke point based on statistical measures.
 *
 * @param {object} params
 * @param {number|null} params.passGivenGate - Probability of passing threshold given gate passed
 * @param {number|null} params.meanValueGivenGate - Mean value when gate is passed
 * @param {number|null} params.thresholdValue - Threshold value being tested
 * @returns {boolean} True if this is a threshold choke point
 */
export function isThresholdChoke({
  passGivenGate,
  meanValueGivenGate,
  thresholdValue,
}) {
  if (typeof passGivenGate === 'number') {
    return passGivenGate < CHOKE_PASS_GIVEN_GATE_MAX;
  }
  if (
    typeof meanValueGivenGate === 'number' &&
    typeof thresholdValue === 'number'
  ) {
    return meanValueGivenGate < thresholdValue;
  }
  return false;
}

/**
 * Classifies the type of choke point affecting a prototype-clause pair.
 *
 * @param {object} params
 * @param {object} params.prototype - Prototype data with statistics
 * @param {object} params.clause - Clause data with threshold information
 * @param {boolean} params.gateMismatch - Whether there's an explicit gate mismatch
 * @param {boolean} params.thresholdMismatch - Whether there's an explicit threshold mismatch
 * @returns {'gate'|'threshold'|'mixed'} Choke type classification
 */
export function classifyChokeType({
  prototype,
  clause,
  gateMismatch,
  thresholdMismatch,
}) {
  if (gateMismatch && thresholdMismatch) {
    return 'mixed';
  }
  if (gateMismatch) {
    return 'gate';
  }
  if (thresholdMismatch) {
    return 'threshold';
  }

  const gateFailRate = prototype.gateFailRate ?? null;
  const gatePassCount =
    typeof prototype.gatePassCount === 'number' ? prototype.gatePassCount : 0;
  const passGivenGate =
    typeof prototype.pThreshGivenGate === 'number'
      ? prototype.pThreshGivenGate
      : null;
  const meanValueGivenGate =
    typeof prototype.meanValueGivenGate === 'number'
      ? prototype.meanValueGivenGate
      : null;
  const thresholdValue =
    typeof clause.thresholdValue === 'number' ? clause.thresholdValue : null;

  const gateProblem =
    typeof gateFailRate === 'number' && gateFailRate >= CHOKE_GATE_FAIL_RATE;
  const thresholdProblem =
    gatePassCount > 0 &&
    isThresholdChoke({
      passGivenGate,
      meanValueGivenGate,
      thresholdValue,
    });

  if (gateProblem && thresholdProblem) {
    return 'mixed';
  }
  if (gateProblem) {
    return 'gate';
  }
  if (thresholdProblem) {
    return 'threshold';
  }
  return 'mixed';
}
