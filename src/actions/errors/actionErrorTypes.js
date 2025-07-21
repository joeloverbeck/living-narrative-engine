/**
 * @file Type definitions for the enhanced action error context system.
 * @see specs/action-system-better-error-context.md
 */

/**
 * @typedef {object} ActionErrorContext
 * @property {string} actionId - ID of the action that failed
 * @property {string|null} targetId - ID of the target entity (if applicable)
 * @property {Error} error - The original error instance
 * @property {import('../../data/gameDataRepository.js').ActionDefinition} actionDefinition - Full action definition
 * @property {ActorSnapshot} actorSnapshot - Actor state at time of error
 * @property {EvaluationTrace} evaluationTrace - Step-by-step evaluation log
 * @property {SuggestedFix[]} suggestedFixes - Potential resolutions
 * @property {object} environmentContext - Additional context data
 * @property {number} timestamp - When the error occurred
 * @property {string} phase - Which phase failed (discovery|validation|execution)
 */

/**
 * @typedef {object} ActorSnapshot
 * @property {string} id - Actor entity ID
 * @property {object} components - All actor components at time of error
 * @property {string} location - Actor's current location
 * @property {object} metadata - Additional actor metadata
 */

/**
 * @typedef {object} EvaluationTrace
 * @property {EvaluationStep[]} steps - Ordered evaluation steps
 * @property {object} finalContext - Final evaluation context
 * @property {string} failurePoint - Where evaluation failed
 */

/**
 * @typedef {object} EvaluationStep
 * @property {string} type - Step type (prerequisite|scope|validation)
 * @property {object} input - Input to this step
 * @property {object} output - Output from this step
 * @property {boolean} success - Whether step succeeded
 * @property {string} message - Human-readable description
 * @property {number} duration - Step execution time in ms
 */

/**
 * @typedef {object} SuggestedFix
 * @property {string} type - Fix type (missing_component|invalid_state|configuration)
 * @property {string} description - Human-readable fix description
 * @property {object} details - Specific fix details
 * @property {number} confidence - Confidence score (0-1)
 */

/**
 * Phases where errors can occur in the action system
 *
 * @enum {string}
 */
export const ERROR_PHASES = {
  DISCOVERY: 'discovery',
  VALIDATION: 'validation',
  EXECUTION: 'execution',
  SCOPE_RESOLUTION: 'scope_resolution',
};

/**
 * Types of suggested fixes
 *
 * @enum {string}
 */
export const FIX_TYPES = {
  MISSING_COMPONENT: 'missing_component',
  INVALID_STATE: 'invalid_state',
  CONFIGURATION: 'configuration',
  MISSING_PREREQUISITE: 'missing_prerequisite',
  INVALID_TARGET: 'invalid_target',
  SCOPE_RESOLUTION: 'scope_resolution',
};

/**
 * Types of evaluation steps
 *
 * @enum {string}
 */
export const EVALUATION_STEP_TYPES = {
  PREREQUISITE: 'prerequisite',
  SCOPE: 'scope',
  VALIDATION: 'validation',
  TARGET_RESOLUTION: 'target_resolution',
  CONDITION_REF: 'condition_ref',
  JSON_LOGIC: 'json_logic',
};
