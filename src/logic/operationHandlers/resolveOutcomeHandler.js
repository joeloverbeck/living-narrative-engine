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
//  Handler implementation
// -----------------------------------------------------------------------------

/**
 * @class ResolveOutcomeHandler
 * Implements the operation handler for the "RESOLVE_OUTCOME" operation type.
 * Delegates to ChanceCalculationService for outcome resolution in non-deterministic actions.
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
    } = params || {};

    // --- 1. Validate Required Parameters ---
    if (!actor_skill_component || typeof actor_skill_component !== 'string') {
      this.#logger.error(
        'RESOLVE_OUTCOME: Missing or invalid "actor_skill_component" parameter. Must be a non-empty string.',
        { params }
      );
      return;
    }

    if (!result_variable || typeof result_variable !== 'string') {
      this.#logger.error(
        'RESOLVE_OUTCOME: Missing or invalid "result_variable" parameter. Must be a non-empty string.',
        { params }
      );
      return;
    }

    // --- 2. Extract Actor/Target IDs from Event ---
    const event = executionContext?.evaluationContext?.event;
    const actorId = event?.payload?.actorId;
    const targetId = event?.payload?.secondaryId || event?.payload?.targetId;

    if (!actorId) {
      this.#logger.error('RESOLVE_OUTCOME: Missing actorId in event payload.', {
        eventPayload: event?.payload,
      });
      return;
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

    // --- 6. Store in Context Variable ---
    if (!executionContext?.evaluationContext?.context) {
      this.#logger.error(
        'RESOLVE_OUTCOME: Missing evaluationContext.context for variable storage.'
      );
      return;
    }

    executionContext.evaluationContext.context[result_variable] = result;

    this.#logger.debug(
      `RESOLVE_OUTCOME: Stored result in "${result_variable}" - outcome: ${result.outcome}, roll: ${result.roll}, threshold: ${result.threshold}`
    );
  }
}

export default ResolveOutcomeHandler;
