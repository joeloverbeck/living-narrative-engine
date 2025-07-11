// src/actions/validation/prerequisiteEvaluationService.js

import { BaseService } from '../../utils/serviceBase.js';
import { resolveReferences } from './conditionReferenceResolver.js';

/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../data/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition */
// ActionTargetContext import removed as it's no longer used for prerequisite evaluation.
/** @typedef {import('./actionValidationContextBuilder.js').ActionValidationContextBuilder} ActionValidationContextBuilder */
/** @typedef {import('../tracing/traceContext.js').TraceContext} TraceContext */

/**
 * @class PrerequisiteEvaluationService
 * @augments BaseService
 * @description Service dedicated to evaluating prerequisite rules (typically JsonLogic) for actions.
 * It resolves any `condition_ref` instances within the rules, builds the necessary evaluation context,
 * and then uses the JsonLogicEvaluationService to evaluate the final, resolved rules.
 */
export class PrerequisiteEvaluationService extends BaseService {
  #logger;
  #jsonLogicEvaluationService;
  #actionValidationContextBuilder;
  #gameDataRepository;

  /**
   * Builds the prefix used for logging messages.
   *
   * @private
   * @param {string} actionId - Identifier of the action being evaluated.
   * @returns {string} The standardized log prefix.
   */
  #logPrefix(actionId) {
    return `PrereqEval[${actionId}]`;
  }

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
    gameDataRepository,
  }) {
    super();
    this.#logger = this._init('PrerequisiteEvaluationService', logger, {
      jsonLogicEvaluationService: {
        value: jsonLogicEvaluationService,
        requiredMethods: ['evaluate'],
      },
      actionValidationContextBuilder: {
        value: actionValidationContextBuilder,
        requiredMethods: ['buildContext'],
      },
      gameDataRepository: {
        value: gameDataRepository,
        requiredMethods: ['getConditionDefinition'], // Assuming this method exists
      },
    });

    this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
    this.#actionValidationContextBuilder = actionValidationContextBuilder;
    this.#gameDataRepository = gameDataRepository;

    this.#logger.debug(
      'PrerequisiteEvaluationService initialised (with ActionValidationContextBuilder and GameDataRepository).'
    );
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
    try {
      return resolveReferences(
        logic,
        this.#gameDataRepository,
        {
          debug: (msg) =>
            this.#logger.debug(`${this.#logPrefix(actionId)}: ${msg}`),
        },
        visited
      );
    } catch (err) {
      if (err.message.startsWith('Circular condition_ref detected')) {
        throw new Error(
          `Circular reference detected in prerequisites for action '${actionId}'. ${err.message}`
        );
      }
      throw err;
    }
  }

  /**
   * Validates the prerequisite rule object structure.
   *
   * @private
   * @param {object} prereqObject - The prerequisite rule object.
   * @param {number} ruleNumber - The index of the rule being evaluated.
   * @param {number} totalRules - The total number of rules.
   * @param {string} actionId - The ID of the action being evaluated.
   * @returns {boolean} True if the rule object is valid, false otherwise.
   */
  _validatePrerequisiteRule(prereqObject, ruleNumber, totalRules, actionId) {
    if (
      !prereqObject ||
      typeof prereqObject !== 'object' ||
      !prereqObject.logic
    ) {
      this.#logger.error(
        `${this.#logPrefix(actionId)}: ← FAILED (Rule ${ruleNumber}/${totalRules}): Prerequisite item is invalid or missing 'logic' property: ${JSON.stringify(
          prereqObject
        )}`
      );
      return false;
    }
    return true;
  }

  /**
   * Executes a JsonLogic rule using the evaluation service.
   *
   * @private
   * @param {object} logic - The resolved JsonLogic rule to evaluate.
   * @param {JsonLogicEvaluationContext} context - Evaluation context.
   * @returns {boolean} Result of the rule evaluation.
   */
  _executeJsonLogic(logic, context) {
    return this.#jsonLogicEvaluationService.evaluate(logic, context);
  }

  /**
   * Logs the outcome of a prerequisite evaluation.
   *
   * @private
   * @param {boolean} pass - Whether the rule passed.
   * @param {object} prereqObject - The original prerequisite rule.
   * @param {number} ruleNumber - The index of the rule evaluated.
   * @param {number} totalRules - Total number of rules evaluated.
   * @param {string} actionId - Action identifier for log prefixing.
   * @returns {boolean} The pass value for convenience.
   */
  _logPrerequisiteResult(pass, prereqObject, ruleNumber, totalRules, actionId) {
    if (!pass) {
      this.#logger.debug(
        `${this.#logPrefix(actionId)}: ← FAILED (Rule ${ruleNumber}/${totalRules}): Prerequisite check FAILED. Rule: ${JSON.stringify(
          prereqObject
        )}`
      );
      if (prereqObject.failure_message) {
        this.#logger.debug(`   Reason: ${prereqObject.failure_message}`);
      }
      return false;
    }

    this.#logger.debug(
      `${this.#logPrefix(actionId)}:   - Prerequisite Rule ${ruleNumber}/${totalRules} PASSED.`
    );
    return true;
  }

  /**
   * Builds the evaluation context for prerequisite evaluation.
   *
   * @private
   * @param {ActionDefinition} actionDefinition - The definition of the action being evaluated.
   * @param {Entity} actor - The entity performing the action.
   * @param {string} actionId - The ID of the action being evaluated.
   * @param {string} actorId - The ID of the acting entity.
   * @returns {JsonLogicEvaluationContext | null} The built evaluation context, or null on failure.
   */
  #buildPrerequisiteContext(actionDefinition, actor, actionId, actorId) {
    let evaluationContext;
    try {
      evaluationContext = this.#actionValidationContextBuilder.buildContext(
        actionDefinition,
        actor
      );
      this.#logger.debug(
        `${this.#logPrefix(actionId)}: Evaluation Context Built Successfully.`
      );

      // Enhanced logging to detect truly missing entities
      // Note: Since we can't directly access the entity manager from here,
      // we'll check if the components accessor returns sensible data
      if (evaluationContext?.actor?.components) {
        try {
          // The toJSON method we added should now work
          const componentsSnapshot = JSON.parse(
            JSON.stringify(evaluationContext.actor.components)
          );
          const componentCount = Object.keys(componentsSnapshot).length;

          if (componentCount === 0) {
            this.#logger.warn(
              `${this.#logPrefix(actionId)}: WARNING - Actor entity [${evaluationContext.actor.id}] ` +
                `appears to have NO components. This may indicate a loading issue.`
            );
          } else {
            this.#logger.debug(
              `${this.#logPrefix(actionId)}: Actor entity [${evaluationContext.actor.id}] ` +
                `has ${componentCount} components available.`
            );
          }
        } catch (err) {
          this.#logger.debug(
            `${this.#logPrefix(actionId)}: Could not serialize components for validation logging`,
            err
          );
        }
      }

      // Check if the actor context is missing components property entirely
      if (evaluationContext?.actor && !evaluationContext.actor.components) {
        this.#logger.error(
          `${this.#logPrefix(actionId)}: ERROR - Actor context is missing components property entirely!`
        );
      }

      this.#logger.debug(
        `${this.#logPrefix(actionId)} Context:`,
        JSON.stringify(evaluationContext, null, 2)
      );
    } catch (buildError) {
      this.#logger.error(
        `${this.#logPrefix(actionId)}: ← FAILED (Internal Error: Failed to build evaluation context). Error: ${buildError.message}`,
        {
          actorId: actorId,
          stack: buildError.stack,
        }
      );
      return null;
    }

    return evaluationContext;
  }

  /**
   * Resolves any condition references and evaluates the resulting logic.
   *
   * @private
   * @param {object} prereqObject - The prerequisite containing a logic rule.
   * @param {string} actionId - Identifier of the action being evaluated.
   * @param {JsonLogicEvaluationContext} evaluationContext - Context for evaluation.
   * @param {TraceContext} [trace] - Optional tracing context.
   * @returns {boolean} Result of evaluating the rule.
   */
  #resolveAndEvaluate(prereqObject, actionId, evaluationContext, trace) {
    const source = 'PrerequisiteEvaluationService._evaluatePrerequisite';
    const originalLogic = prereqObject.logic;

    trace?.info('Evaluating rule.', source, {
      logic: originalLogic || {},
    });

    const resolvedLogic = this._resolveConditionReferences(
      originalLogic,
      actionId
    );

    if (JSON.stringify(originalLogic) !== JSON.stringify(resolvedLogic)) {
      trace?.data('Condition reference resolved.', source, {
        resolvedLogic: resolvedLogic || {},
      });
    }

    this.#logger.debug(
      `${this.#logPrefix(actionId)}:   - Evaluating resolved rule: ${JSON.stringify(
        resolvedLogic
      )}`
    );

    const result = this._executeJsonLogic(resolvedLogic, evaluationContext);

    result
      ? trace?.success(`Rule evaluation result: ${result}`, source, {
          result: Boolean(result),
        })
      : trace?.failure(`Rule evaluation result: ${result}`, source, {
          result: Boolean(result),
        });

    return result;
  }

  /**
   * Validates and evaluates a single prerequisite rule.
   *
   * @private
   * @param {object} prereqObject - The prerequisite object containing a logic rule.
   * @param {number} ruleNumber - The index (1-based) of the rule being evaluated.
   * @param {number} totalRules - Total number of prerequisite rules.
   * @param {JsonLogicEvaluationContext} evaluationContext - The context used for evaluation.
   * @param {string} actionId - The ID of the action being evaluated.
   * @param {TraceContext} [trace] - Optional tracing context.
   * @returns {boolean} True if the prerequisite passes, false otherwise.
   */
  _evaluatePrerequisite(
    prereqObject,
    ruleNumber,
    totalRules,
    evaluationContext,
    actionId,
    trace = null
  ) {
    const source = 'PrerequisiteEvaluationService._evaluatePrerequisite';
    if (
      !this._validatePrerequisiteRule(
        prereqObject,
        ruleNumber,
        totalRules,
        actionId
      )
    ) {
      return false;
    }

    let rulePassed;
    try {
      rulePassed = this.#resolveAndEvaluate(
        prereqObject,
        actionId,
        evaluationContext,
        trace
      );
    } catch (evalError) {
      trace?.error(
        `Error during rule evaluation: ${evalError.message}`,
        source,
        { error: evalError }
      );
      this.#logger.error(
        `${this.#logPrefix(actionId)}: ← FAILED (Rule ${ruleNumber}/${totalRules}): Error during rule resolution or evaluation. Rule: ${JSON.stringify(
          prereqObject
        )}`,
        {
          error: evalError.message,
          stack: evalError.stack,
        }
      );
      return false;
    }

    return this._logPrerequisiteResult(
      rulePassed,
      prereqObject,
      ruleNumber,
      totalRules,
      actionId
    );
  }

  /**
   * Evaluates an array of prerequisite rules using the provided context.
   *
   * @private
   * @param {object[]} prerequisites - The prerequisite rule objects.
   * @param {JsonLogicEvaluationContext} evaluationContext - Context for rule evaluation.
   * @param {string} actionId - The ID of the action being evaluated.
   * @param {TraceContext} [trace] - Optional tracing context.
   * @returns {boolean} True if all rules pass, false if any fail.
   */
  #evaluateRules(prerequisites, evaluationContext, actionId, trace = null) {
    this.#logger.debug(
      `${this.#logPrefix(actionId)}: Evaluating ${prerequisites.length} prerequisite rule(s)...`
    );

    for (const [index, prereqObject] of prerequisites.entries()) {
      const ruleNumber = index + 1;
      if (
        !this._evaluatePrerequisite(
          prereqObject,
          ruleNumber,
          prerequisites.length,
          evaluationContext,
          actionId,
          trace
        )
      ) {
        // Failure is already logged by _evaluatePrerequisite
        return false;
      }
    }

    this.#logger.debug(
      `${this.#logPrefix(actionId)}: → PASSED (All ${prerequisites.length} prerequisite rules evaluated successfully).`
    );
    return true;
  }

  /**
   * Orchestrates prerequisite evaluation by building context and evaluating rules.
   * It first builds the evaluation context, then resolves all `condition_ref`
   * instances in the rules, and finally applies the JsonLogic rules.
   *
   * @param {object[]} prerequisites - The array of prerequisite rule objects.
   * @param {ActionDefinition} actionDefinition - The definition of the action being evaluated.
   * @param {Entity} actor - The entity performing the action.
   * @param {TraceContext} [trace] - Optional tracing context for detailed logging.
   * @returns {boolean} True if all prerequisites pass, false otherwise.
   */
  evaluate(prerequisites, actionDefinition, actor, trace = null) {
    const source = 'PrerequisiteEvaluationService.evaluate';
    const actionId = actionDefinition?.id ?? 'unknown_action';
    const actorId = actor?.id ?? 'unknown_actor';

    if (!prerequisites || prerequisites.length === 0) {
      this.#logger.debug(
        `${this.#logPrefix(actionId)}: → PASSED (No prerequisites to evaluate).`
      );
      return true;
    }

    const evaluationContext = this.#buildPrerequisiteContext(
      actionDefinition,
      actor,
      actionId,
      actorId
    );
    if (!evaluationContext) {
      return false;
    }

    trace?.data('Built prerequisite evaluation context.', source, {
      context: evaluationContext || {},
    });

    return this.#evaluateRules(
      prerequisites,
      evaluationContext,
      actionId,
      trace
    );
  }
}

