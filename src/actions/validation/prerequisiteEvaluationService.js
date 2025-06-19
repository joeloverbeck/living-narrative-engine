// src/actions/validation/prerequisiteEvaluationService.js

import { setupService } from '../../utils/serviceInitializerUtils.js';

/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../data/gameDataRepository.js').GameDataRepository} GameDataRepository */ // ADDED
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('./actionValidationContextBuilder.js').ActionValidationContextBuilder} ActionValidationContextBuilder */

/**
 * @class PrerequisiteEvaluationService
 * @description Service dedicated to evaluating prerequisite rules (typically JsonLogic) for actions.
 * It resolves any `condition_ref` instances within the rules, builds the necessary evaluation context,
 * and then uses the JsonLogicEvaluationService to evaluate the final, resolved rules.
 */
export class PrerequisiteEvaluationService {
  #logger;
  #jsonLogicEvaluationService;
  #actionValidationContextBuilder;
  #gameDataRepository; // ADDED

  /**
   * Creates an instance of PrerequisiteEvaluationService.
   *
   * @param {object} dependencies - The required services.
   * @param {ILogger} dependencies.logger - Logger instance.
   * @param {JsonLogicEvaluationService} dependencies.jsonLogicEvaluationService - Service for JsonLogic evaluation.
   * @param {ActionValidationContextBuilder} dependencies.actionValidationContextBuilder - Builder for evaluation contexts.
   * @param {GameDataRepository} dependencies.gameDataRepository - Repository for accessing game data like condition definitions.
   * @throws {Error} If dependencies are missing or invalid.
   */
  constructor({
    logger,
    jsonLogicEvaluationService,
    actionValidationContextBuilder,
    gameDataRepository, // ADDED
  }) {
    this.#logger = setupService('PrerequisiteEvaluationService', logger, {
      jsonLogicEvaluationService: {
        value: jsonLogicEvaluationService,
        requiredMethods: ['evaluate'],
      },
      actionValidationContextBuilder: {
        value: actionValidationContextBuilder,
        requiredMethods: ['buildContext'],
      },
      // ADDED: Validate the new dependency
      gameDataRepository: {
        value: gameDataRepository,
        requiredMethods: ['getConditionDefinition'], // Assuming this method exists
      },
    });

    this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
    this.#actionValidationContextBuilder = actionValidationContextBuilder;
    this.#gameDataRepository = gameDataRepository; // ADDED

    this.#logger.debug(
      'PrerequisiteEvaluationService initialised (with ActionValidationContextBuilder and GameDataRepository).'
    );
  }

  /**
   * Checks for circular condition references and throws an error if detected.
   *
   * @private
   * @param {string} conditionId - The referenced condition ID.
   * @param {Set<string>} visited - Set of already visited condition IDs.
   * @param {string} actionId - The ID of the action being validated.
   * @throws {Error} If a circular reference is detected.
   */
  _checkCircularReference(conditionId, visited, actionId) {
    if (visited.has(conditionId)) {
      throw new Error(
        `Circular reference detected in prerequisites for action '${actionId}'. Path: ${[...visited, conditionId].join(' -> ')}`
      );
    }
  }

  /**
   * Recursively traverses a JSON Logic rule and replaces all `condition_ref`
   * objects with the actual logic from the referenced condition definition.
   *
   * @private
   * @param {object | any} logic - The JSON Logic rule or sub-rule to resolve.
   * @param {string} actionId - The ID of the action being validated (for logging).
   * @param {Set<string>} visited - A set to track visited condition IDs and prevent infinite recursion.
   * @returns {object | any} The resolved logic tree.
   * @throws {Error} If a condition reference cannot be found or if a circular reference is detected.
   */
  _resolveConditionReferences(logic, actionId, visited = new Set()) {
    if (!logic || typeof logic !== 'object' || logic === null) {
      return logic; // Not a resolvable object, return as-is
    }

    if (Array.isArray(logic)) {
      // If it's an array of rules (e.g., in 'and'/'or'), resolve each one
      return logic.map((item) =>
        this._resolveConditionReferences(item, actionId, new Set(visited))
      );
    }

    // Base case: This is a condition reference object like {"condition_ref": "..."}
    if (Object.prototype.hasOwnProperty.call(logic, 'condition_ref')) {
      const conditionId = logic.condition_ref;
      if (typeof conditionId !== 'string') {
        throw new Error(`Invalid condition_ref value: not a string.`);
      }

      this._checkCircularReference(conditionId, visited, actionId);
      visited.add(conditionId);

      this.#logger.debug(
        `PrereqEval[${actionId}]: Resolving reference to '${conditionId}'...`
      );

      // Assumes GameDataRepository has this method
      const conditionDef =
        this.#gameDataRepository.getConditionDefinition(conditionId);

      if (!conditionDef || !conditionDef.logic) {
        throw new Error(
          `Could not resolve condition_ref '${conditionId}'. Definition or its logic property not found.`
        );
      }

      // Recursively resolve the logic from the definition itself, in case it also contains references.
      return this._resolveConditionReferences(
        conditionDef.logic,
        actionId,
        new Set(visited)
      );
    }

    // Recursive step: This is a logic block (e.g., {"var": ...}, {"!": ...}). Resolve its contents.
    const resolvedLogic = {};
    for (const operator in logic) {
      if (Object.prototype.hasOwnProperty.call(logic, operator)) {
        resolvedLogic[operator] = this._resolveConditionReferences(
          logic[operator],
          actionId,
          new Set(visited)
        );
      }
    }
    return resolvedLogic;
  }

  /**
   * Evaluates an array of prerequisite rules for a given action context.
   * It first builds the evaluation context, then resolves all `condition_ref`
   * instances in the rules, and finally applies the JsonLogic rules.
   *
   * @param {object[]} prerequisites - The array of prerequisite rule objects.
   * @param {ActionDefinition} actionDefinition - The definition of the action being evaluated.
   * @param {Entity} actor - The entity performing the action.
   * @param {ActionTargetContext} targetContext - The context of the action's target.
   * @returns {boolean} True if all prerequisites pass, false otherwise.
   */
  evaluate(prerequisites, actionDefinition, actor, targetContext) {
    const actionId = actionDefinition?.id ?? 'unknown_action';
    const actorId = actor?.id ?? 'unknown_actor';

    if (!prerequisites || prerequisites.length === 0) {
      this.#logger.debug(
        `PrereqEval[${actionId}]: → PASSED (No prerequisites to evaluate).`
      );
      return true;
    }

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
      this.#logger.debug(
        `PrereqEval[${actionId}] Context:`,
        JSON.stringify(evalCtx, null, 2)
      );
    } catch (buildError) {
      this.#logger.error(
        `PrereqEval[${actionId}]: ← FAILED (Internal Error: Failed to build evaluation context). Error: ${buildError.message}`,
        {
          actorId: actorId,
          targetContext: targetContext,
          stack: buildError.stack,
        }
      );
      return false;
    }

    this.#logger.debug(
      `PrereqEval[${actionId}]: Evaluating ${prerequisites.length} prerequisite rule(s)...`
    );

    for (const [index, prereqObject] of prerequisites.entries()) {
      const ruleNumber = index + 1;

      if (
        !prereqObject ||
        typeof prereqObject !== 'object' ||
        !prereqObject.logic
      ) {
        this.#logger.error(
          `PrereqEval[${actionId}]: ← FAILED (Rule ${ruleNumber}/${prerequisites.length}): Prerequisite item is invalid or missing 'logic' property: ${JSON.stringify(prereqObject)}`
        );
        return false;
      }

      let pass = false;
      try {
        // Step 1: Resolve any condition references into a final, evaluatable rule.
        const resolvedLogic = this._resolveConditionReferences(
          prereqObject.logic,
          actionId
        );

        this.#logger.debug(
          `PrereqEval[${actionId}]:   - Evaluating resolved rule ${ruleNumber}: ${JSON.stringify(resolvedLogic)}`
        );

        // Step 2: Evaluate the fully resolved rule.
        pass = this.#jsonLogicEvaluationService.evaluate(
          resolvedLogic,
          evalCtx
        );
      } catch (evalError) {
        this.#logger.error(
          `PrereqEval[${actionId}]: ← FAILED (Rule ${ruleNumber}/${prerequisites.length}): Error during rule resolution or evaluation. Rule: ${JSON.stringify(prereqObject)}`,
          {
            error: evalError.message,
            stack: evalError.stack,
          }
        );
        return false;
      }

      if (!pass) {
        this.#logger.debug(
          `PrereqEval[${actionId}]: ← FAILED (Rule ${ruleNumber}/${prerequisites.length}): Prerequisite check FAILED. Rule: ${JSON.stringify(prereqObject)}`
        );
        if (prereqObject.failure_message) {
          this.#logger.debug(`   Reason: ${prereqObject.failure_message}`);
        }
        return false;
      } else {
        this.#logger.debug(
          `PrereqEval[${actionId}]:   - Prerequisite Rule ${ruleNumber}/${prerequisites.length} PASSED.`
        );
      }
    }

    this.#logger.debug(
      `PrereqEval[${actionId}]: → PASSED (All ${prerequisites.length} prerequisite rules evaluated successfully).`
    );
    return true;
  }
}
