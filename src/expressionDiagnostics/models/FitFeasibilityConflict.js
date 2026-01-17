/**
 * @file FitFeasibilityConflict - Data model for fit vs feasibility conflict warnings
 * @description Defines the data model type definitions for fit vs feasibility conflict warnings,
 * including JSDoc typedefs, conflict type constants, and factory/validation helpers.
 * @see specs/prototype-fit-blockers-scope-disambiguation.md
 * @see FitFeasibilityConflictDetector.js
 */

/**
 * Type of conflict between prototype fit and clause feasibility.
 *
 * @typedef {'fit_vs_clause_impossible' | 'gate_contradiction'} ConflictType
 */

/**
 * Prototype score entry in conflict reports.
 *
 * @typedef {object} PrototypeScore
 * @property {string} prototypeId - Prototype identifier.
 * @property {number} score - Composite score from fit analysis.
 */

/**
 * Fit vs feasibility conflict warning data model.
 *
 * @typedef {object} FitFeasibilityConflict
 * @property {ConflictType} type - Type of conflict detected.
 * @property {PrototypeScore[]} topPrototypes - Top prototypes from fit leaderboard.
 * @property {string[]} impossibleClauseIds - IDs of impossible clauses or gate contradictions.
 * @property {string} explanation - Human-readable explanation of the conflict.
 * @property {string[]} suggestedFixes - Suggestions for resolution (up to 5).
 */

/**
 * Valid conflict type values.
 *
 * @type {readonly ['fit_vs_clause_impossible', 'gate_contradiction']}
 */
export const CONFLICT_TYPES = Object.freeze([
  'fit_vs_clause_impossible',
  'gate_contradiction',
]);

/**
 * Validate a conflict type value.
 *
 * @param {string} type - Conflict type to validate.
 * @returns {boolean} True if the type is valid.
 */
export function isValidConflictType(type) {
  return CONFLICT_TYPES.includes(type);
}

/**
 * Create a PrototypeScore object with validation.
 *
 * @param {string} prototypeId - Prototype identifier.
 * @param {number} score - Composite score value.
 * @returns {Readonly<PrototypeScore>} Frozen PrototypeScore object.
 * @throws {Error} If prototypeId is not a non-empty string or score is not a number.
 */
export function createPrototypeScore(prototypeId, score) {
  if (!prototypeId || typeof prototypeId !== 'string') {
    throw new Error('prototypeId is required and must be a non-empty string');
  }
  if (typeof score !== 'number' || Number.isNaN(score)) {
    throw new Error('score is required and must be a number');
  }
  return Object.freeze({ prototypeId, score });
}

/**
 * Create a FitFeasibilityConflict object with validation.
 *
 * @param {Partial<FitFeasibilityConflict>} props - Partial properties to create from.
 * @returns {Readonly<FitFeasibilityConflict>} Frozen FitFeasibilityConflict object.
 * @throws {Error} If required fields (type, explanation) are missing or invalid.
 */
export function createFitFeasibilityConflict(props) {
  // Validate type field
  if (!props.type || !isValidConflictType(props.type)) {
    throw new Error(`type must be one of: ${CONFLICT_TYPES.join(', ')}`);
  }

  // Validate explanation field
  if (!props.explanation || typeof props.explanation !== 'string') {
    throw new Error('explanation is required and must be a string');
  }

  // Validate topPrototypes array items if provided
  const topPrototypes = props.topPrototypes ?? [];
  if (!Array.isArray(topPrototypes)) {
    throw new Error('topPrototypes must be an array');
  }

  // Validate each prototype score in the array
  const frozenPrototypes = topPrototypes.map((p, idx) => {
    if (!p || typeof p !== 'object') {
      throw new Error(`topPrototypes[${idx}] must be an object`);
    }
    if (!p.prototypeId || typeof p.prototypeId !== 'string') {
      throw new Error(
        `topPrototypes[${idx}].prototypeId is required and must be a string`
      );
    }
    if (typeof p.score !== 'number' || Number.isNaN(p.score)) {
      throw new Error(
        `topPrototypes[${idx}].score is required and must be a number`
      );
    }
    return Object.freeze({ prototypeId: p.prototypeId, score: p.score });
  });

  // Validate impossibleClauseIds array if provided
  const impossibleClauseIds = props.impossibleClauseIds ?? [];
  if (!Array.isArray(impossibleClauseIds)) {
    throw new Error('impossibleClauseIds must be an array');
  }

  // Validate suggestedFixes array if provided
  const suggestedFixes = props.suggestedFixes ?? [];
  if (!Array.isArray(suggestedFixes)) {
    throw new Error('suggestedFixes must be an array');
  }

  return Object.freeze({
    type: props.type,
    topPrototypes: Object.freeze(frozenPrototypes),
    impossibleClauseIds: Object.freeze([...impossibleClauseIds]),
    explanation: props.explanation,
    suggestedFixes: Object.freeze([...suggestedFixes]),
  });
}
