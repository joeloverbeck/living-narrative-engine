/**
 * @file ResolveOutcomeHandler - Resolves non-deterministic action outcomes
 *
 * Executes the RESOLVE_OUTCOME operation during rule execution by delegating to
 * ChanceCalculationService, which orchestrates the full calculation pipeline.
 *
 * Operation flow:
 * 1. Validate parameters (actor_skill_component, result_variable required)
 * 2. Extract actorId/targetId from event payload
 * 3. Build a pseudo-actionDef from operation parameters
 * 4. Delegate to ChanceCalculationService.resolveOutcome()
 * 5. Store result object in executionContext.evaluationContext.context[result_variable]
 *
 * Related files:
 * @see specs/non-deterministic-actions-system.md - System specification
 * @see data/schemas/operations/resolveOutcome.schema.json - Operation schema
 * @see src/combat/services/ChanceCalculationService.js - Orchestrates all combat services
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Parameters expected by the ResolveOutcomeHandler#execute method.
 *
 * @typedef {object} ResolveOutcomeParams
 * @property {string} actor_skill_component - Required. Component ID for actor's skill (e.g., 'skills:melee_skill').
 * @property {string} [target_skill_component] - Optional. Component ID for target's skill (for opposed checks).
 * @property {number} [actor_skill_default=0] - Default value if actor lacks skill component.
 * @property {number} [target_skill_default=0] - Default value if target lacks skill component.
 * @property {'ratio'|'logistic'|'linear'} [formula='ratio'] - Probability calculation formula.
 * @property {number} [difficulty_modifier=0] - Static modifier to difficulty.
 * @property {string} result_variable - Required. Context variable to store result object.
 */

/**
 * Result object structure stored in context.
 *
 * @typedef {object} ResolveOutcomeResult
 * @property {'CRITICAL_SUCCESS'|'SUCCESS'|'FAILURE'|'FUMBLE'} outcome - The determined outcome.
 * @property {number} roll - The d100 roll (1-100).
 * @property {number} threshold - Success threshold (0-100).
 * @property {number} margin - roll - threshold (negative = success margin).
 * @property {boolean} isCritical - Whether the outcome was critical.
 * @property {number} actorSkill - Actor's resolved skill value.
 * @property {number} targetSkill - Target's resolved skill value.
 * @property {object} breakdown - Calculation breakdown from ProbabilityCalculatorService.
 */

// -----------------------------------------------------------------------------
//  Error class
// -----------------------------------------------------------------------------

/**
 * Error thrown when RESOLVE_OUTCOME operation fails due to invalid parameters.
 * Includes diagnostic details to help identify the root cause.
 *
 * FAIL-FAST: This error is thrown immediately when validation fails,
 * rather than silently returning and causing cryptic timeout errors.
 */
export class ResolveOutcomeOperationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {object} details - Diagnostic details about the failure
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'ResolveOutcomeOperationError';
    this.details = details;
  }
}

// -----------------------------------------------------------------------------
//  Handler implementation
// -----------------------------------------------------------------------------

/**
 * @class ResolveOutcomeHandler
 * Implements the operation handler for the "RESOLVE_OUTCOME" operation type.
 * Delegates to ChanceCalculationService for outcome resolution in non-deterministic actions.
 *
 * FAIL-FAST: This handler throws ResolveOutcomeOperationError on invalid parameters
 * rather than silently returning. This makes debugging outcome resolution failures
 * immediately visible instead of causing cryptic timeout errors.
 */
class ResolveOutcomeHandler {
  /** @type {object} */
  #chanceCalculationService;
  /** @type {ILogger} */
  #logger;

  /**
   * Creates an instance of ResolveOutcomeHandler.
   *
   * @param {object} dependencies - Dependencies object.
   * @param {object} dependencies.chanceCalculationService - Service for orchestrating chance calculations.
   * @param {ILogger} dependencies.logger - The logging service instance.
   * @throws {Error} If any dependency is missing or invalid.
   */
  constructor({ chanceCalculationService, logger }) {
    // Validate logger
    if (
      !logger ||
      typeof logger.debug !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.error !== 'function'
    ) {
      throw new Error(
        'ResolveOutcomeHandler requires a valid ILogger instance with debug, warn, and error methods.'
      );
    }

    // Validate service
    if (
      !chanceCalculationService ||
      typeof chanceCalculationService.resolveOutcome !== 'function'
    ) {
      throw new Error(
        'ResolveOutcomeHandler requires a valid chanceCalculationService with resolveOutcome method.'
      );
    }

    this.#chanceCalculationService = chanceCalculationService;
    this.#logger = logger;

    this.#logger.debug('ResolveOutcomeHandler initialized.');
  }

  /**
   * Executes the RESOLVE_OUTCOME operation.
   * Stores the result in executionContext.evaluationContext.context[result_variable].
   *
   * @param {ResolveOutcomeParams | null | undefined} params - Operation parameters.
   * @param {object} executionContext - The operation execution context.
   * @returns {void}
   */
  execute(params, executionContext) {
    const {
      actor_skill_component,
      target_skill_component,
      actor_skill_default = 0,
      target_skill_default = 0,
      formula = 'ratio',
      difficulty_modifier = 0,
      result_variable,
      target_role = 'secondary',
    } = params || {};

    // --- 1. Validate Required Parameters (FAIL-FAST) ---
    if (!actor_skill_component || typeof actor_skill_component !== 'string') {
      const error = new ResolveOutcomeOperationError(
        'RESOLVE_OUTCOME: Missing or invalid "actor_skill_component" parameter. Must be a non-empty string.',
        {
          receivedValue: actor_skill_component,
          receivedType: typeof actor_skill_component,
          allParams: params,
        }
      );
      this.#logger.error(error.message, error.details);
      throw error;
    }

    if (!result_variable || typeof result_variable !== 'string') {
      const error = new ResolveOutcomeOperationError(
        'RESOLVE_OUTCOME: Missing or invalid "result_variable" parameter. Must be a non-empty string.',
        {
          receivedValue: result_variable,
          receivedType: typeof result_variable,
          allParams: params,
        }
      );
      this.#logger.error(error.message, error.details);
      throw error;
    }

    // --- 2. Extract Actor/Target IDs from Event ---
    const event = executionContext?.evaluationContext?.event;
    const actorId = event?.payload?.actorId;
    const primaryTargetId =
      event?.payload?.primaryId ||
      event?.payload?.targetId ||
      event?.payload?.targets?.primary?.entityId;
    const secondaryTargetId =
      event?.payload?.secondaryId || event?.payload?.targets?.secondary?.entityId;
    const tertiaryTargetId =
      event?.payload?.tertiaryId || event?.payload?.targets?.tertiary?.entityId;

    let targetId;
    switch (target_role) {
      case 'primary':
        targetId = primaryTargetId || secondaryTargetId || tertiaryTargetId;
        break;
      case 'tertiary':
        targetId = tertiaryTargetId || secondaryTargetId || primaryTargetId;
        break;
      case 'secondary':
      default:
        targetId = secondaryTargetId || primaryTargetId;
        break;
    }

    if (!actorId) {
      const error = new ResolveOutcomeOperationError(
        'RESOLVE_OUTCOME: Missing actorId in event payload. ' +
          'This usually means the event was not properly constructed or placeholder resolution failed.',
        {
          eventPayload: event?.payload,
          hasEvent: !!event,
          hasPayload: !!event?.payload,
          hasExecutionContext: !!executionContext,
          hasEvaluationContext: !!executionContext?.evaluationContext,
        }
      );
      this.#logger.error(error.message, error.details);
      throw error;
    }

    // --- 3. Build Pseudo-ActionDef from Operation Parameters ---
    // ChanceCalculationService expects an actionDef with chanceBased configuration.
    // We construct this from the operation parameters for compatibility.
    const pseudoActionDef = {
      id: 'RESOLVE_OUTCOME_OPERATION',
      chanceBased: {
        enabled: true,
        contestType: target_skill_component ? 'opposed' : 'simple',
        actorSkill: {
          component: actor_skill_component,
          default: actor_skill_default,
        },
        targetSkill: target_skill_component
          ? {
              component: target_skill_component,
              default: target_skill_default,
              targetRole: target_role,
            }
          : undefined,
        formula,
        fixedDifficulty: difficulty_modifier,
      },
    };

    // --- 4. Delegate to ChanceCalculationService ---
    const outcomeResult = this.#chanceCalculationService.resolveOutcome({
      actorId,
      targetId,
      primaryTargetId,
      secondaryTargetId,
      tertiaryTargetId,
      actionDef: pseudoActionDef,
    });

    // --- 5. Build Result Object (maintaining backward compatibility) ---
    const result = {
      outcome: outcomeResult.outcome,
      roll: outcomeResult.roll,
      threshold: outcomeResult.threshold,
      margin: outcomeResult.margin,
      isCritical: outcomeResult.isCritical,
      actorSkill: 0, // Not directly available from service result
      targetSkill: 0, // Not directly available from service result
      breakdown: {}, // Breakdown is in the display result, not outcome result
      modifiers: outcomeResult.modifiers,
    };

    // --- 6. Store in Context Variable (FAIL-FAST) ---
    if (!executionContext?.evaluationContext?.context) {
      const error = new ResolveOutcomeOperationError(
        'RESOLVE_OUTCOME: Missing evaluationContext.context for variable storage.',
        {
          hasExecutionContext: !!executionContext,
          hasEvaluationContext: !!executionContext?.evaluationContext,
          result_variable,
        }
      );
      this.#logger.error(error.message, error.details);
      throw error;
    }

    executionContext.evaluationContext.context[result_variable] = result;

    this.#logger.debug(
      `RESOLVE_OUTCOME: Stored result in "${result_variable}" - outcome: ${result.outcome}, roll: ${result.roll}, threshold: ${result.threshold}`
    );
  }
}

export default ResolveOutcomeHandler;
