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
    const result = this.#jsonLogicEvaluationService.evaluate(logic, context);
    return result;
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
      this.#auditActorComponents(evaluationContext, actionId, actorId);
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
   * Performs diagnostics and logging for the actor section of the evaluation context.
   *
   * @private
   * @param {JsonLogicEvaluationContext} evaluationContext - The generated evaluation context.
   * @param {string} actionId - Identifier for the action being evaluated.
   * @param {string} actorId - Identifier for the acting entity provided to evaluation.
   * @throws {Error} If the actor components cannot be serialized for logging purposes.
   * @returns {void}
   */
  #auditActorComponents(evaluationContext, actionId, actorId) {
    if (!evaluationContext || typeof evaluationContext !== 'object') {
      return;
    }

    const actorContext = evaluationContext.actor;
    if (!actorContext || typeof actorContext !== 'object') {
      return;
    }

    const prefix = this.#logPrefix(actionId);
    const resolvedActorId = actorContext.id ?? actorId ?? 'unknown_actor';

    this.#logger.debug(
      `${prefix}: Actor context resolved for entity [${resolvedActorId}].`
    );

    const hasComponentsProperty = Object.prototype.hasOwnProperty.call(
      actorContext,
      'components'
    );

    if (!hasComponentsProperty) {
      this.#logger.error(
        `${prefix}: ERROR - Actor context is missing components property entirely!`
      );
      return;
    }

    const { components } = actorContext;

    if (!components || typeof components !== 'object') {
      this.#logger.warn(
        `${prefix}: WARNING - Actor entity [${resolvedActorId}] appears to have NO components. This may indicate a loading issue.`
      );
      return;
    }

    let componentSnapshot = null;

    try {
      if (components && typeof components.toJSON === 'function') {
        componentSnapshot = components.toJSON();
      } else if (components && typeof components === 'object') {
        componentSnapshot = { ...components };
      }
    } catch (err) {
      this.#logger.debug(
        `${prefix}: Could not serialize components for validation logging`,
        err
      );
      this.#logger.warn(
        `${prefix}: WARNING - Actor entity [${resolvedActorId}] components could not be inspected. Treating as missing.`
      );
      return;
    }

    if (!componentSnapshot || Object.keys(componentSnapshot).length === 0) {
      this.#logger.warn(
        `${prefix}: WARNING - Actor entity [${resolvedActorId}] appears to have NO components. This may indicate a loading issue.`
      );
      return;
    }

    const componentKeys = Object.keys(componentSnapshot);

    this.#logger.debug(
      `${prefix}: Actor entity [${resolvedActorId}] has ${componentKeys.length} components available.`
    );

    try {
      const serializedComponents = JSON.stringify(componentSnapshot);
      this.#logger.debug(
        `${prefix}: Actor components snapshot => ${serializedComponents}`
      );
    } catch (serializationError) {
      this.#logger.debug(
        `${prefix}: Could not serialize components for validation logging`,
        serializationError
      );

      if (serializationError instanceof TypeError) {
        throw serializationError;
      }
    }
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

    // Record prerequisite evaluation start
    trace?.step('Starting prerequisite evaluation', source);
    trace?.data('Prerequisite rule', source, {
      logic: originalLogic || {},
      actionId: actionId,
    });

    // Resolve condition references
    const resolvedLogic = this._resolveConditionReferences(
      originalLogic,
      actionId
    );

    if (JSON.stringify(originalLogic) !== JSON.stringify(resolvedLogic)) {
      trace?.step('Resolving condition_ref', source);
      trace?.data('Condition reference resolved', source, {
        originalLogic: originalLogic || {},
        resolvedLogic: resolvedLogic || {},
      });
    }

    this.#logger.debug(
      `${this.#logPrefix(actionId)}:   - Evaluating resolved rule: ${JSON.stringify(
        resolvedLogic
      )}`
    );

    // Record JSON Logic evaluation
    trace?.step('Evaluating JSON Logic', source);
    trace?.data('Evaluation context', source, {
      actor: evaluationContext.actor?.id,
      hasComponents: !!evaluationContext.actor?.components,
      componentCount: evaluationContext.actor?.components
        ? Object.keys(evaluationContext.actor.components).length
        : 0,
    });

    const result = this._executeJsonLogic(resolvedLogic, evaluationContext);

    // Record result with appropriate status
    if (result) {
      trace?.success(`Prerequisite passed`, source, {
        result: Boolean(result),
        logic: resolvedLogic,
      });
    } else {
      trace?.failure(`Prerequisite failed`, source, {
        result: Boolean(result),
        logic: resolvedLogic,
        failureMessage:
          prereqObject.failure_message || 'Prerequisite condition not met',
      });
    }

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
    // Support span-based tracing if available
    if (trace?.withSpan) {
      return trace.withSpan(
        `prerequisite.rule.${ruleNumber}`,
        () => {
          return this.#evaluatePrerequisiteInternal(
            prereqObject,
            ruleNumber,
            totalRules,
            evaluationContext,
            actionId,
            trace
          );
        },
        {
          actionId: actionId,
          ruleNumber: ruleNumber,
          totalRules: totalRules,
        }
      );
    }

    // Fallback to original implementation
    return this.#evaluatePrerequisiteInternal(
      prereqObject,
      ruleNumber,
      totalRules,
      evaluationContext,
      actionId,
      trace
    );
  }

  /**
   * Internal implementation of single prerequisite rule evaluation.
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
  #evaluatePrerequisiteInternal(
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
    const source = 'PrerequisiteEvaluationService.#evaluateRules';

    // Support span-based tracing if available
    if (trace?.withSpan) {
      return trace.withSpan(
        'prerequisite.evaluateRules',
        () => {
          return this.#evaluateRulesInternal(
            prerequisites,
            evaluationContext,
            actionId,
            trace
          );
        },
        {
          actionId: actionId,
          ruleCount: prerequisites.length,
        }
      );
    }

    // Fallback to original implementation
    return this.#evaluateRulesInternal(
      prerequisites,
      evaluationContext,
      actionId,
      trace
    );
  }

  /**
   * Internal implementation of rule evaluation logic.
   *
   * @private
   * @param {object[]} prerequisites - The prerequisite rule objects.
   * @param {JsonLogicEvaluationContext} evaluationContext - Context for rule evaluation.
   * @param {string} actionId - The ID of the action being evaluated.
   * @param {TraceContext} [trace] - Optional tracing context.
   * @returns {boolean} True if all rules pass, false if any fail.
   */
  #evaluateRulesInternal(
    prerequisites,
    evaluationContext,
    actionId,
    trace = null
  ) {
    const source = 'PrerequisiteEvaluationService.#evaluateRules';

    this.#logger.debug(
      `${this.#logPrefix(actionId)}: Evaluating ${prerequisites.length} prerequisite rule(s)...`
    );

    trace?.step(
      `Evaluating ${prerequisites.length} prerequisite rules`,
      source
    );

    for (const [index, prereqObject] of prerequisites.entries()) {
      const ruleNumber = index + 1;

      trace?.step(
        `Evaluating rule ${ruleNumber}/${prerequisites.length}`,
        source
      );

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
        trace?.failure(`Rule ${ruleNumber} failed`, source, {
          ruleNumber: ruleNumber,
          totalRules: prerequisites.length,
          failureMessage: prereqObject.failure_message,
        });
        return false;
      }

      trace?.success(`Rule ${ruleNumber} passed`, source, {
        ruleNumber: ruleNumber,
        totalRules: prerequisites.length,
      });
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
   * @param {object} [options] - Optional configuration overrides.
   * @param {object} [options.contextOverride] - Partial evaluation context to merge
   *   into the generated prerequisite context (e.g. resolved targets).
   * @returns {boolean} True if all prerequisites pass, false otherwise.
   */
  evaluate(
    prerequisites,
    actionDefinition,
    actor,
    trace = null,
    options = {}
  ) {
    const source = 'PrerequisiteEvaluationService.evaluate';
    const actionId = actionDefinition?.id ?? 'unknown_action';
    const actorId = actor?.id ?? 'unknown_actor';
    const { contextOverride = null } = options || {};

    // Support both old and new trace APIs
    if (trace?.withSpan) {
      return trace.withSpan(
        'prerequisite.evaluate',
        () => {
          return this.#evaluatePrerequisitesInternal(
            prerequisites,
            actionDefinition,
            actor,
            actionId,
            actorId,
            trace,
            contextOverride
          );
        },
        {
          actionId: actionId,
          actorId: actorId,
          ruleCount: prerequisites?.length || 0,
        }
      );
    }

    // Fallback to original implementation for backward compatibility
    return this.#evaluatePrerequisitesInternal(
      prerequisites,
      actionDefinition,
      actor,
      actionId,
      actorId,
      trace,
      contextOverride
    );
  }

  /**
   * Internal method for prerequisite evaluation logic.
   * Separated to support span wrapping while maintaining backward compatibility.
   *
   * @private
   * @param {object[]} prerequisites - The array of prerequisite rule objects.
   * @param {ActionDefinition} actionDefinition - The definition of the action being evaluated.
   * @param {Entity} actor - The entity performing the action.
   * @param {string} actionId - The ID of the action being evaluated.
   * @param {string} actorId - The ID of the acting entity.
   * @param {TraceContext} [trace] - Optional tracing context for detailed logging.
   * @returns {boolean} True if all prerequisites pass, false otherwise.
   */
  #evaluatePrerequisitesInternal(
    prerequisites,
    actionDefinition,
    actor,
    actionId,
    actorId,
    trace,
    contextOverride = null
  ) {
    const source = 'PrerequisiteEvaluationService.evaluate';

    // Record prerequisite evaluation start
    trace?.step('Checking prerequisites', source);

    if (!prerequisites || prerequisites.length === 0) {
      this.#logger.debug(
        `${this.#logPrefix(actionId)}: → PASSED (No prerequisites to evaluate).`
      );
      trace?.success('No prerequisites to evaluate', source);
      return true;
    }

    trace?.data('Prerequisites to evaluate', source, {
      count: prerequisites.length,
      actionId: actionId,
      actorId: actorId,
    });

    const evaluationContext = this.#buildPrerequisiteContext(
      actionDefinition,
      actor,
      actionId,
      actorId
    );
    if (!evaluationContext) {
      trace?.failure('Failed to build evaluation context', source, {
        actionId: actionId,
        actorId: actorId,
      });
      return false;
    }

    const finalEvaluationContext = this.#applyContextOverride(
      evaluationContext,
      contextOverride,
      actionId
    );

    trace?.data('Built prerequisite evaluation context', source, {
      actorId: finalEvaluationContext.actor?.id,
      hasComponents: !!finalEvaluationContext.actor?.components,
      componentCount: finalEvaluationContext.actor?.components
        ? Object.keys(finalEvaluationContext.actor.components).length
        : 0,
    });

    const result = this.#evaluateRules(
      prerequisites,
      finalEvaluationContext,
      actionId,
      trace
    );

    // Record final result
    if (result) {
      trace?.success('All prerequisites passed', source, {
        count: prerequisites.length,
      });
    } else {
      trace?.failure('Prerequisites evaluation failed', source, {
        actionId: actionId,
        actorId: actorId,
      });
    }

    return result;
  }

  /**
   * Applies a partial override to the generated evaluation context.
   *
   * @private
   * @param {JsonLogicEvaluationContext} baseContext - Context produced by the builder.
   * @param {object|null} contextOverride - Additional context data to merge.
   * @param {string} actionId - Identifier of the action being evaluated.
   * @returns {JsonLogicEvaluationContext} The merged evaluation context.
   */
  #applyContextOverride(baseContext, contextOverride, actionId) {
    if (!contextOverride || typeof contextOverride !== 'object') {
      return baseContext;
    }

    const mergedContext = { ...baseContext };

    for (const [key, value] of Object.entries(contextOverride)) {
      if (value === undefined) {
        continue;
      }

      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof mergedContext[key] === 'object' &&
        mergedContext[key] !== null &&
        !Array.isArray(mergedContext[key])
      ) {
        mergedContext[key] = { ...mergedContext[key], ...value };
      } else {
        mergedContext[key] = value;
      }
    }

    this.#logger.debug(
      `${this.#logPrefix(actionId)}: Applied context override for prerequisite evaluation.`,
      { overrideKeys: Object.keys(contextOverride) }
    );

    return mergedContext;
  }
}
