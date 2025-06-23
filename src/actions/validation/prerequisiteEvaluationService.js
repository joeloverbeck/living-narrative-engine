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
    return this.#resolveReferences(logic, actionId, visited);
  }

  /**
   * Recursively resolves condition references within logic objects or arrays.
   *
   * @private
   * @param {object | any} obj - The logic element to resolve.
   * @param {string} actionId - The ID of the action being validated.
   * @param {Set<string>} visited - Set of already visited condition IDs.
   * @returns {object | any} The resolved logic element.
   * @throws {Error} If a condition reference cannot be found.
   */
  #resolveReferences(obj, actionId, visited) {
    if (!obj || typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) =>
        this.#resolveReferences(item, actionId, new Set(visited))
      );
    }

    if (Object.prototype.hasOwnProperty.call(obj, 'condition_ref')) {
      const conditionId = obj.condition_ref;
      if (typeof conditionId !== 'string') {
        throw new Error(`Invalid condition_ref value: not a string.`);
      }

      this._checkCircularReference(conditionId, visited, actionId);
      visited.add(conditionId);

      this.#logger.debug(
        `PrereqEval[${actionId}]: Resolving reference to '${conditionId}'...`
      );

      const conditionDef =
        this.#gameDataRepository.getConditionDefinition(conditionId);

      if (!conditionDef || !conditionDef.logic) {
        throw new Error(
          `Could not resolve condition_ref '${conditionId}'. Definition or its logic property not found.`
        );
      }

      return this.#resolveReferences(
        conditionDef.logic,
        actionId,
        new Set(visited)
      );
    }

    const resolved = {};
    for (const [key, val] of Object.entries(obj)) {
      resolved[key] = this.#resolveReferences(val, actionId, new Set(visited));
    }
    return resolved;
  }

  /**
   * Builds the evaluation context for prerequisite evaluation.
   *
   * @private
   * @param {ActionDefinition} actionDefinition - The definition of the action being evaluated.
   * @param {Entity} actor - The entity performing the action.
   * @param {ActionTargetContext} targetContext - The context of the action's target.
   * @param {string} actionId - The ID of the action being evaluated.
   * @param {string} actorId - The ID of the acting entity.
   * @returns {JsonLogicEvaluationContext | null} The built evaluation context, or null on failure.
   */
  _buildEvaluationContext(
    actionDefinition,
    actor,
    targetContext,
    actionId,
    actorId
  ) {
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
      return null;
    }

    return evalCtx;
  }

  /**
   * Validates and evaluates a single prerequisite rule.
   *
   * @private
   * @param {object} prereqObject - The prerequisite object containing a logic rule.
   * @param {number} ruleNumber - The index (1-based) of the rule being evaluated.
   * @param {number} totalRules - Total number of prerequisite rules.
   * @param {JsonLogicEvaluationContext} evalCtx - The context used for evaluation.
   * @param {string} actionId - The ID of the action being evaluated.
   * @returns {boolean} True if the prerequisite passes, false otherwise.
   */
  _evaluatePrerequisite(
    prereqObject,
    ruleNumber,
    totalRules,
    evalCtx,
    actionId
  ) {
    if (
      !prereqObject ||
      typeof prereqObject !== 'object' ||
      !prereqObject.logic
    ) {
      this.#logger.error(
        `PrereqEval[${actionId}]: ← FAILED (Rule ${ruleNumber}/${totalRules}): Prerequisite item is invalid or missing 'logic' property: ${JSON.stringify(
          prereqObject
        )}`
      );
      return false;
    }

    let pass = false;
    try {
      const resolvedLogic = this._resolveConditionReferences(
        prereqObject.logic,
        actionId
      );

      this.#logger.debug(
        `PrereqEval[${actionId}]:   - Evaluating resolved rule ${ruleNumber}: ${JSON.stringify(
          resolvedLogic
        )}`
      );

      pass = this.#jsonLogicEvaluationService.evaluate(resolvedLogic, evalCtx);
    } catch (evalError) {
      this.#logger.error(
        `PrereqEval[${actionId}]: ← FAILED (Rule ${ruleNumber}/${totalRules}): Error during rule resolution or evaluation. Rule: ${JSON.stringify(
          prereqObject
        )}`,
        {
          error: evalError.message,
          stack: evalError.stack,
        }
      );
      return false;
    }

    if (!pass) {
      this.#logger.debug(
        `PrereqEval[${actionId}]: ← FAILED (Rule ${ruleNumber}/${totalRules}): Prerequisite check FAILED. Rule: ${JSON.stringify(
          prereqObject
        )}`
      );
      if (prereqObject.failure_message) {
        this.#logger.debug(`   Reason: ${prereqObject.failure_message}`);
      }
      return false;
    }

    this.#logger.debug(
      `PrereqEval[${actionId}]:   - Prerequisite Rule ${ruleNumber}/${totalRules} PASSED.`
    );
    return true;
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

    const evalCtx = this._buildEvaluationContext(
      actionDefinition,
      actor,
      targetContext,
      actionId,
      actorId
    );
    if (!evalCtx) {
      return false;
    }

    this.#logger.debug(
      `PrereqEval[${actionId}]: Evaluating ${prerequisites.length} prerequisite rule(s)...`
    );

    for (const [index, prereqObject] of prerequisites.entries()) {
      const ruleNumber = index + 1;
      const passed = this._evaluatePrerequisite(
        prereqObject,
        ruleNumber,
        prerequisites.length,
        evalCtx,
        actionId
      );
      if (!passed) {
        return false;
      }
    }

    this.#logger.debug(
      `PrereqEval[${actionId}]: → PASSED (All ${prerequisites.length} prerequisite rules evaluated successfully).`
    );
    return true;
  }
}
