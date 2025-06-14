// src/actions/validation/prerequisiteEvaluationService.js

import {
  initLogger,
  validateServiceDeps,
} from '../../utils/serviceInitializer.js';

/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
// --- START: Refactor-AVS-3.3.1 ---
// No change needed here for 3.3.2
/** @typedef {import('./actionValidationContextBuilder.js').ActionValidationContextBuilder} ActionValidationContextBuilder */

// --- END: Refactor-AVS-3.3.1 ---

/**
 * @class PrerequisiteEvaluationService
 * @description Service dedicated to evaluating prerequisite rules (typically JsonLogic) for actions.
 * It first builds the necessary evaluation context using the ActionValidationContextBuilder
 * and then uses the JsonLogicEvaluationService to evaluate the rules against that context.
 */
export class PrerequisiteEvaluationService {
  #logger;
  #jsonLogicEvaluationService;
  // --- START: Refactor-AVS-3.3.1 ---
  // No change needed here for 3.3.2
  #actionValidationContextBuilder;

  // --- END: Refactor-AVS-3.3.1 ---

  /**
   * Creates an instance of PrerequisiteEvaluationService.
   *
   * @param {object} dependencies - The required services.
   * @param {ILogger} dependencies.logger - Logger instance.
   * @param {JsonLogicEvaluationService} dependencies.jsonLogicEvaluationService - Service for JsonLogic evaluation.
   * @param {ActionValidationContextBuilder} dependencies.actionValidationContextBuilder - Builder for evaluation contexts.
   * @throws {Error} If dependencies are missing or invalid.
   */
  constructor({
    logger,
    jsonLogicEvaluationService,
    actionValidationContextBuilder,
  }) {
    try {
      this.#logger = initLogger('PrerequisiteEvaluationService', logger, [
        'debug',
        'error',
        'warn',
        'info',
      ]);
    } catch (e) {
      const errorMsg = `PrerequisiteEvaluationService Constructor: CRITICAL - Invalid or missing ILogger instance. Error: ${e.message}`;
      // eslint-disable-next-line no-console
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      validateServiceDeps('PrerequisiteEvaluationService', this.#logger, {
        jsonLogicEvaluationService: {
          value: jsonLogicEvaluationService,
          requiredMethods: ['evaluate'],
        },
        actionValidationContextBuilder: {
          value: actionValidationContextBuilder,
          requiredMethods: ['buildContext'],
        },
      });
    } catch (e) {
      this.#logger.error(
        `PrerequisiteEvaluationService Constructor: Dependency validation failed. Error: ${e.message}`
      );
      throw e;
    }

    this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
    this.#actionValidationContextBuilder = actionValidationContextBuilder;

    this.#logger.debug(
      'PrerequisiteEvaluationService initialised (with ActionValidationContextBuilder).'
    );
  }

  /**
   * Evaluates an array of prerequisite rules for a given action context.
   * It first builds the evaluation context using the provided action details
   * and then applies the JsonLogic rules.
   *
   * @param {object[]} prerequisites - The array of prerequisite rule objects. Should conform to expected structure (e.g., { logic: {...}, failure_message?: "..." }).
   * @param {ActionDefinition} actionDefinition - The definition of the action being evaluated.
   * @param {Entity} actor - The entity performing the action.
   * @param {ActionTargetContext} targetContext - The context of the action's target.
   * @returns {boolean} True if all prerequisites pass (or if the list is empty), false if any rule fails, if there's an evaluation error, or if context building fails.
   */
  evaluate(prerequisites, actionDefinition, actor, targetContext) {
    // Signature updated in 3.3.1
    // --- START: Refactor-AVS-3.3.2 ---
    // Task: Derive actionId at the beginning
    const actionId = actionDefinition?.id ?? 'unknown_action'; // AC1
    const actorId = actor?.id ?? 'unknown_actor'; // Needed for logging context in case of error
    // --- END: Refactor-AVS-3.3.2 ---

    // ─── 1 If there are no rules, we’re done (validation passed) ────────
    if (!prerequisites || prerequisites.length === 0) {
      // --- START: Refactor-AVS-3.3.2 ---
      // Task: Update Logging (Use local actionId)
      this.#logger.debug(
        `PrereqEval[${actionId}]: → PASSED (No prerequisites to evaluate).`
      ); // AC6
      // Task: Remove old logs (None existed for checking passed-in evalCtx) // AC7 (N/A)
      // --- END: Refactor-AVS-3.3.2 ---
      return true; // No rules means prerequisites are met.
    }

    // --- START: Refactor-AVS-3.3.2 ---
    // ─── 2 Build the Evaluation Context (NEW STEP) ───────────────────────
    let evalCtx;
    try {
      evalCtx = this.#actionValidationContextBuilder.buildContext(
        actionDefinition,
        actor,
        targetContext
      );
      this.#logger.debug(
        `PrereqEval[${actionId}]: Evaluation Context Built Successfully.`
      );

      // =================================================================
      // ===> ADD THIS LINE HERE <===
      this.#logger.debug(
        `PrereqEval[${actionId}] Context:`,
        JSON.stringify(evalCtx, null, 2)
      );
      // =================================================================
    } catch (buildError) {
      // Task: Wrap in try...catch, Handle errors in catch(err) // AC3
      // Task: Log error detailing failure (include required context) and return false // AC4
      this.#logger.error(
        `PrereqEval[${actionId}]: ← FAILED (Internal Error: Failed to build evaluation context via ActionValidationContextBuilder). Error: ${buildError.message}`,
        {
          actorId: actorId,
          targetContext: targetContext, // Include the target context object
          // buildError.message is already in the main string
          stack: buildError.stack, // Include stack trace
        }
      ); // AC6 (log uses actionId)
      return false; // Context building failed
    }

    // Task: Handle Missing Context (Post-Build Check) - Self-correction applied: Removed redundant check as builder throws on failure. The catch block handles it.
    // --- END: Refactor-AVS-3.3.2 ---

    // ─── 3 Evaluate prerequisite rules ──────────────────────────────────
    // --- START: Refactor-AVS-3.3.2 ---
    // Task: Update Logging (Use local actionId)
    this.#logger.debug(
      `PrereqEval[${actionId}]: Evaluating ${prerequisites.length} prerequisite rule(s)...`
    ); // AC6
    // --- END: Refactor-AVS-3.3.2 ---
    for (const [index, prereqObject] of prerequisites.entries()) {
      const ruleNumber = index + 1;

      // Basic structural check of the prerequisite object itself
      if (
        !prereqObject ||
        typeof prereqObject !== 'object' ||
        Array.isArray(prereqObject)
      ) {
        // --- START: Refactor-AVS-3.3.2 ---
        // Task: Update Logging (Use local actionId)
        this.#logger.error(
          `PrereqEval[${actionId}]: ← FAILED (Rule ${ruleNumber}/${prerequisites.length}): Prerequisite item is not a valid object: ${JSON.stringify(prereqObject)}` // AC6
        );
        // --- END: Refactor-AVS-3.3.2 ---
        return false; // Invalid structure fails validation
      }

      const ruleLogic = prereqObject.logic;
      // Check for the presence and basic type of the 'logic' property
      if (!ruleLogic || typeof ruleLogic !== 'object') {
        // JsonLogic rules are objects
        // --- START: Refactor-AVS-3.3.2 ---
        // Task: Update Logging (Use local actionId)
        this.#logger.error(
          `PrereqEval[${actionId}]: ← FAILED (Rule ${ruleNumber}/${prerequisites.length}): Prerequisite object is missing the required 'logic' property or it's not an object: ${JSON.stringify(prereqObject)}` // AC6
        );
        // --- END: Refactor-AVS-3.3.2 ---
        return false; // Invalid structure fails validation
      }

      let pass = false; // Default to false
      try {
        // --- START: Refactor-AVS-3.3.2 ---
        // Task: Update Rule Evaluation (Ensure local evalCtx is used)
        // Use the service's injected JsonLogicEvaluationService instance with the locally built context
        pass = this.#jsonLogicEvaluationService.evaluate(ruleLogic, evalCtx); // AC5
        // --- END: Refactor-AVS-3.3.2 ---
      } catch (evalError) {
        // --- START: Refactor-AVS-3.3.2 ---
        // Task: Update Logging (Use local actionId)
        this.#logger.error(
          `PrereqEval[${actionId}]: ← FAILED (Rule ${ruleNumber}/${prerequisites.length}): Error during JsonLogic evaluation. Rule: ${JSON.stringify(prereqObject)}`,
          {
            error: evalError.message,
            stack: evalError.stack,
          }
        ); // AC6
        // --- END: Refactor-AVS-3.3.2 ---
        return false; // Evaluation error means failure
      }

      if (!pass) {
        // --- START: Refactor-AVS-3.3.2 ---
        // Task: Update Logging (Use local actionId)
        this.#logger.debug(
          `PrereqEval[${actionId}]: ← FAILED (Rule ${ruleNumber}/${prerequisites.length}): Prerequisite check FAILED. Rule: ${JSON.stringify(prereqObject)}`
        ); // AC6
        // --- END: Refactor-AVS-3.3.2 ---
        if (prereqObject.failure_message) {
          this.#logger.debug(`   Reason: ${prereqObject.failure_message}`); // Log message doesn't contain actionId, so no change needed
        }
        return false; // First failure stops the process
      } else {
        // --- START: Refactor-AVS-3.3.2 ---
        // Task: Update Logging (Use local actionId)
        this.#logger.debug(
          `PrereqEval[${actionId}]:   - Prerequisite Rule ${ruleNumber}/${prerequisites.length} PASSED: ${JSON.stringify(prereqObject)}`
        ); // AC6
        // --- END: Refactor-AVS-3.3.2 ---
      }
    }

    // ─── 4 All prerequisites passed ────────────────────────────────────
    // --- START: Refactor-AVS-3.3.2 ---
    // Task: Update Logging (Use local actionId)
    this.#logger.debug(
      `PrereqEval[${actionId}]: → PASSED (All ${prerequisites.length} prerequisite rules evaluated successfully).`
    ); // AC6
    // --- END: Refactor-AVS-3.3.2 ---
    return true; // All rules passed
  }
}
