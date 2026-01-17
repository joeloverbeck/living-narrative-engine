/**
 * @file NonAxisClauseFeasibility - Data model for non-axis clause feasibility results
 * @description Defines the data model type definitions for non-axis clause feasibility analysis
 * results, including JSDoc typedefs, classification constants, and factory/validation helpers.
 * @see specs/prototype-fit-blockers-scope-disambiguation.md
 * @see NonAxisFeasibilityAnalyzer.js
 */

/**
 * Classification result for a non-axis clause feasibility analysis.
 *
 * Classification rules (deterministic):
 * - IMPOSSIBLE: passRate === 0 AND maxValue < threshold - eps
 * - RARE: passRate > 0 AND passRate < rareThreshold (0.001)
 * - OK: passRate >= 0.001
 * - UNKNOWN: insufficient data to classify
 *
 * @typedef {'IMPOSSIBLE' | 'RARE' | 'OK' | 'UNKNOWN'} FeasibilityClassification
 */

/**
 * Evidence object for feasibility result.
 *
 * @typedef {object} NonAxisClauseEvidence
 * @property {string | null} bestSampleRef - Sample ID for maxValue (e.g., "sample_0").
 * @property {string} note - Short textual explanation of the classification.
 */

/**
 * Result of analyzing a single non-axis clause's feasibility within the mood regime population.
 *
 * @typedef {object} NonAxisClauseFeasibility
 * @property {string} clauseId - Deterministic identifier (hash of normalized clause).
 * @property {string} sourcePath - Pointer back into prerequisites tree.
 * @property {string} varPath - Variable path, e.g., "emotions.confusion".
 * @property {string} operator - Comparison operator: >=, <=, >, <, ==, !=.
 * @property {number} threshold - Threshold value for the comparison.
 * @property {'final' | 'raw' | 'delta'} signal - Signal type: 'final' for non-delta, 'delta' for delta clauses.
 * @property {'in_regime'} population - Always 'in_regime' for this model.
 * @property {number | null} passRate - passCount / inRegimeCount, or null if no data.
 * @property {number | null} maxValue - max(LHS) over in-regime samples, or null if no data.
 * @property {number | null} p95Value - 95th percentile (from stored contexts), or null if no data.
 * @property {number | null} marginMax - maxValue - threshold, or null if no data.
 * @property {FeasibilityClassification} classification - Feasibility classification result.
 * @property {NonAxisClauseEvidence} evidence - Evidence supporting the classification.
 */

/**
 * Valid feasibility classification values.
 *
 * @type {readonly ['IMPOSSIBLE', 'RARE', 'OK', 'UNKNOWN']}
 */
export const FEASIBILITY_CLASSIFICATIONS = Object.freeze([
  'IMPOSSIBLE',
  'RARE',
  'OK',
  'UNKNOWN',
]);

/**
 * Valid comparison operators for non-axis clauses.
 *
 * @type {readonly ['>=', '>', '<=', '<', '==', '!=']}
 */
const VALID_OPERATORS = Object.freeze(['>=', '>', '<=', '<', '==', '!=']);

/**
 * Valid signal types for non-axis clauses.
 *
 * @type {readonly ['final', 'raw', 'delta']}
 */
const VALID_SIGNALS = Object.freeze(['final', 'raw', 'delta']);

/**
 * Create a NonAxisClauseFeasibility object with validation.
 *
 * @param {Partial<NonAxisClauseFeasibility>} props - Partial properties to create from.
 * @returns {Readonly<NonAxisClauseFeasibility>} Frozen NonAxisClauseFeasibility object.
 * @throws {Error} If required fields (clauseId, varPath, threshold) are missing or invalid.
 */
export function createNonAxisClauseFeasibility(props) {
  // Validate required fields
  if (!props.clauseId || typeof props.clauseId !== 'string') {
    throw new Error('clauseId is required and must be a non-empty string');
  }
  if (!props.varPath || typeof props.varPath !== 'string') {
    throw new Error('varPath is required and must be a non-empty string');
  }
  if (typeof props.threshold !== 'number' || Number.isNaN(props.threshold)) {
    throw new Error('threshold is required and must be a number');
  }

  // Validate optional fields with type checking
  const operator = props.operator ?? '>=';
  if (!VALID_OPERATORS.includes(operator)) {
    throw new Error(
      `operator must be one of: ${VALID_OPERATORS.join(', ')}, got: ${operator}`
    );
  }

  const signal = props.signal ?? 'final';
  if (!VALID_SIGNALS.includes(signal)) {
    throw new Error(
      `signal must be one of: ${VALID_SIGNALS.join(', ')}, got: ${signal}`
    );
  }

  const classification = props.classification ?? 'UNKNOWN';
  if (!isValidClassification(classification)) {
    throw new Error(
      `classification must be one of: ${FEASIBILITY_CLASSIFICATIONS.join(', ')}, got: ${classification}`
    );
  }

  // Validate passRate range if provided
  if (
    props.passRate !== null &&
    props.passRate !== undefined &&
    (typeof props.passRate !== 'number' ||
      props.passRate < 0 ||
      props.passRate > 1)
  ) {
    throw new Error('passRate must be a number in [0, 1] or null');
  }

  return Object.freeze({
    clauseId: props.clauseId,
    sourcePath: props.sourcePath ?? '',
    varPath: props.varPath,
    operator,
    threshold: props.threshold,
    signal,
    population: 'in_regime',
    passRate: props.passRate ?? null,
    maxValue: props.maxValue ?? null,
    p95Value: props.p95Value ?? null,
    marginMax: props.marginMax ?? null,
    classification,
    evidence: Object.freeze({
      bestSampleRef: props.evidence?.bestSampleRef ?? null,
      note: props.evidence?.note ?? '',
    }),
  });
}

/**
 * Validate a feasibility classification value.
 *
 * @param {string} classification - Classification value to validate.
 * @returns {boolean} True if the classification is valid.
 */
export function isValidClassification(classification) {
  return FEASIBILITY_CLASSIFICATIONS.includes(classification);
}
