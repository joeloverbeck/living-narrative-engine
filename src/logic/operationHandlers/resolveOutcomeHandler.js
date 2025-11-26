/**
 * @file ResolveOutcomeHandler - Resolves non-deterministic action outcomes
 *
 * Executes the RESOLVE_OUTCOME operation during rule execution by orchestrating:
 * 1. SkillResolverService - Retrieves actor/target skill values from components
 * 2. ProbabilityCalculatorService - Calculates success probability
 * 3. OutcomeDeterminerService - Determines final outcome (SUCCESS, FAILURE, CRITICAL, FUMBLE)
 *
 * Operation flow:
 * 1. Validate parameters (actor_skill_component, result_variable required)
 * 2. Extract actorId/targetId from event payload
 * 3. Resolve skill values for actor and target
 * 4. Calculate probability using specified formula
 * 5. Determine outcome (rolls d100 internally)
 * 6. Store result object in executionContext.evaluationContext.context[result_variable]
 *
 * Related files:
 * @see specs/non-deterministic-actions-system.md - System specification
 * @see data/schemas/operations/resolveOutcome.schema.json - Operation schema
 * @see src/combat/services/SkillResolverService.js - Skill resolution
 * @see src/combat/services/ProbabilityCalculatorService.js - Probability calculation
 * @see src/combat/services/OutcomeDeterminerService.js - Outcome determination
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
 * Orchestrates skill resolution, probability calculation, and outcome determination
 * for non-deterministic actions in the game engine.
 */
class ResolveOutcomeHandler {
  /** @type {object} */
  #skillResolverService;
  /** @type {object} */
  #probabilityCalculatorService;
  /** @type {object} */
  #outcomeDeterminerService;
  /** @type {ILogger} */
  #logger;

  /**
   * Creates an instance of ResolveOutcomeHandler.
   *
   * @param {object} dependencies - Dependencies object.
   * @param {object} dependencies.skillResolverService - Service for resolving skill values from entity components.
   * @param {object} dependencies.probabilityCalculatorService - Service for calculating success probability.
   * @param {object} dependencies.outcomeDeterminerService - Service for determining final outcome.
   * @param {ILogger} dependencies.logger - The logging service instance.
   * @throws {Error} If any dependency is missing or invalid.
   */
  constructor({
    skillResolverService,
    probabilityCalculatorService,
    outcomeDeterminerService,
    logger,
  }) {
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

    // Validate services
    if (
      !skillResolverService ||
      typeof skillResolverService.getSkillValue !== 'function'
    ) {
      throw new Error(
        'ResolveOutcomeHandler requires a valid skillResolverService with getSkillValue method.'
      );
    }
    if (
      !probabilityCalculatorService ||
      typeof probabilityCalculatorService.calculate !== 'function'
    ) {
      throw new Error(
        'ResolveOutcomeHandler requires a valid probabilityCalculatorService with calculate method.'
      );
    }
    if (
      !outcomeDeterminerService ||
      typeof outcomeDeterminerService.determine !== 'function'
    ) {
      throw new Error(
        'ResolveOutcomeHandler requires a valid outcomeDeterminerService with determine method.'
      );
    }

    this.#skillResolverService = skillResolverService;
    this.#probabilityCalculatorService = probabilityCalculatorService;
    this.#outcomeDeterminerService = outcomeDeterminerService;
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
      this.#logger.error(
        'RESOLVE_OUTCOME: Missing actorId in event payload.',
        { eventPayload: event?.payload }
      );
      return;
    }

    // --- 3. Resolve Skill Values ---
    const actorSkill = this.#skillResolverService.getSkillValue(
      actorId,
      actor_skill_component,
      actor_skill_default
    );

    const targetSkill = target_skill_component
      ? this.#skillResolverService.getSkillValue(
          targetId,
          target_skill_component,
          target_skill_default
        )
      : { baseValue: 0, hasComponent: false };

    // --- 4. Calculate Probability ---
    const probability = this.#probabilityCalculatorService.calculate({
      actorSkill: actorSkill.baseValue,
      targetSkill: targetSkill.baseValue,
      difficulty: difficulty_modifier,
      formula,
    });

    // --- 5. Determine Outcome ---
    const outcome = this.#outcomeDeterminerService.determine({
      finalChance: probability.finalChance,
    });

    // --- 6. Build Result Object ---
    const result = {
      outcome: outcome.outcome,
      roll: outcome.roll,
      threshold: probability.finalChance,
      margin: outcome.margin,
      isCritical: outcome.isCritical,
      actorSkill: actorSkill.baseValue,
      targetSkill: targetSkill.baseValue,
      breakdown: probability.breakdown,
    };

    // --- 7. Store in Context Variable ---
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
