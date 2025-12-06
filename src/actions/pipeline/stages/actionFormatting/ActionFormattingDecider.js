/**
 * @file Selects the appropriate formatting strategy for a given task.
 */

/**
 * @typedef {import('./ActionFormattingTaskFactory.js').ActionFormattingTask} ActionFormattingTask
 */
/**
 * @typedef {import('../../../../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition
 */
/**
 * @typedef {import('../../../tracing/traceContext.js').TraceContext|import('../../../tracing/structuredTrace.js').StructuredTrace|import('../../../tracing/actionAwareStructuredTrace.js').default|undefined} TraceLike
 */
/**
 * @typedef {import('./ActionFormattingErrorFactory.js').ActionFormattingErrorFactory} ActionFormattingErrorFactory
 */

/**
 * @typedef {object} Strategy
 * @property {(task: ActionFormattingTask) => boolean} canFormat - Predicate used to determine whether the strategy should be applied.
 * @property {(params: object) => Promise<void>} format - Formatting implementation invoked by the stage.
 * @property {number} [priority] - Optional numeric priority to influence ordering.
 */

/**
 * @typedef {object} ValidationFailure
 * @property {string} code - Machine readable identifier for the validation issue.
 * @property {string} message - Human readable description of the issue.
 * @property {unknown} error - Structured error payload created by {@link ActionFormattingErrorFactory}.
 */

/**
 * @typedef {object} StrategyEvaluation
 * @property {string} name - Name of the evaluated strategy.
 * @property {boolean} canFormat - Result of invoking {@link Strategy.canFormat}.
 * @property {'matched'|'predicate_mismatch'|'validation_failed'} [reason] - Additional diagnostic information.
 */

/**
 * @typedef {object} DecisionMetadata
 * @property {string} selectedStrategy - Name of the chosen strategy or `legacy` when falling back.
 * @property {StrategyEvaluation[]} evaluations - Diagnostics captured during selection.
 * @property {string[]} validationErrors - List of validation failure codes.
 */

/**
 * @typedef {object} DecideParams
 * @property {ActionFormattingTask} task - Task requiring a strategy decision.
 * @property {string} actorId - Identifier of the actor executing the pipeline.
 * @property {TraceLike} [trace] - Optional trace context forwarded to the error factory.
 */

/**
 * @typedef {object} DecisionOutcome
 * @property {Strategy|null} strategy - Selected strategy instance or `null` when falling back to legacy behaviour.
 * @property {DecisionMetadata} metadata - Diagnostic metadata describing the decision.
 * @property {ValidationFailure[]} validationFailures - Structured validation failures discovered during validation.
 */

/**
 * @typedef {object} DeciderOptions
 * @property {Strategy[]} strategies - Strategies that can participate in the decision.
 * @property {ActionFormattingErrorFactory} errorFactory - Error factory used to build validation failures.
 * @property {(a: Strategy, b: Strategy) => number} [comparator] - Optional custom comparator used to sort strategies.
 */

/**
 * @class ActionFormattingDecider
 * @description Encapsulates the logic that selects the appropriate formatting strategy for each task.
 */
export class ActionFormattingDecider {
  #strategies;

  #errorFactory;

  #comparator;

  #strategyOrder;

  /**
   * @param {DeciderOptions} options - Decider configuration options.
   */
  constructor({ strategies, errorFactory, comparator }) {
    this.#strategies = Array.isArray(strategies) ? [...strategies] : [];
    this.#errorFactory = errorFactory;
    this.#comparator = typeof comparator === 'function' ? comparator : null;
    this.#strategyOrder = new Map();

    this.#strategies.forEach((strategy, index) => {
      this.#strategyOrder.set(strategy, this.#strategies.length - index);
    });

    this.#sortStrategies();
  }

  /**
   * @description Determines which strategy should handle the supplied task.
   * @param {DecideParams} params - Decision parameters.
   * @returns {DecisionOutcome} Outcome describing the selected strategy and validation state.
   */
  decide({ task, actorId, trace }) {
    const validationFailures = this.#validateTask({ task, actorId, trace });
    const evaluations = [];
    let selectedStrategy = null;

    for (const strategy of this.#strategies) {
      const strategyName = this.#getStrategyName(strategy);
      const evaluation = /** @type {StrategyEvaluation} */ ({
        name: strategyName,
        canFormat: false,
      });

      try {
        evaluation.canFormat = Boolean(strategy?.canFormat?.(task));
      } catch (error) {
        evaluation.canFormat = false;
        evaluation.reason = 'predicate_mismatch';
        evaluations.push(evaluation);
        continue;
      }

      if (!evaluation.canFormat) {
        evaluation.reason = 'predicate_mismatch';
        evaluations.push(evaluation);
        continue;
      }

      if (validationFailures.length > 0) {
        evaluation.reason = 'validation_failed';
        evaluations.push(evaluation);
        continue;
      }

      evaluation.reason = 'matched';
      evaluations.push(evaluation);
      selectedStrategy = strategy;
      break;
    }

    const metadata = /** @type {DecisionMetadata} */ ({
      selectedStrategy: selectedStrategy
        ? this.#getStrategyName(selectedStrategy)
        : 'legacy',
      evaluations,
      validationErrors: validationFailures.map((failure) => failure.code),
    });

    return {
      strategy: selectedStrategy,
      metadata,
      validationFailures,
    };
  }

  /**
   * @description Sorts strategies using the configured comparator or priority metadata.
   * @returns {void}
   */
  #sortStrategies() {
    const comparator =
      this.#comparator ??
      ((a, b) => this.#getPriority(b) - this.#getPriority(a));

    this.#strategies.sort((left, right) => {
      try {
        return comparator(left, right);
      } catch (error) {
        return 0;
      }
    });
  }

  /**
   * @param {Strategy} strategy - Strategy whose priority should be resolved.
   * @returns {number} Priority score for sorting.
   */
  #getPriority(strategy) {
    if (!strategy) {
      return 0;
    }

    const explicitPriority =
      typeof strategy.priority === 'number' ? strategy.priority : null;

    if (explicitPriority !== null) {
      return explicitPriority;
    }

    // Preserve construction order when no explicit priority is defined.
    const storedPriority = this.#strategyOrder.get(strategy);
    return typeof storedPriority === 'number' ? storedPriority : 0;
  }

  /**
   * @param {Strategy} strategy - Strategy instance being evaluated.
   * @returns {string} Human readable name for diagnostics.
   */
  #getStrategyName(strategy) {
    if (!strategy) {
      return 'UnknownStrategy';
    }

    if (typeof strategy.name === 'string' && strategy.name.length > 0) {
      return strategy.name;
    }

    const ctorName = strategy.constructor?.name;
    return typeof ctorName === 'string' && ctorName.length > 0
      ? ctorName
      : 'AnonymousStrategy';
  }

  /**
   * @param {object} options - Validation options.
   * @param {ActionFormattingTask} options.task - Task to validate.
   * @param {string} options.actorId - Actor identifier.
   * @param {TraceLike} [options.trace] - Optional trace context.
   * @returns {ValidationFailure[]} Validation failures discovered for the task.
   */
  #validateTask({ task, actorId, trace }) {
    const failures = [];

    if (!task || !task.actionDef) {
      return failures;
    }

    if (task.metadata?.hasPerActionMetadata) {
      const missing = this.#collectMissing([
        ['resolvedTargets', task.resolvedTargets],
        ['targetDefinitions', task.targetDefinitions],
        ['isMultiTarget', typeof task.isMultiTarget === 'boolean'],
      ]);

      if (missing.length > 0) {
        failures.push(
          this.#buildValidationFailure({
            code: 'per_action_metadata_missing',
            message: `Per-action metadata for '${task.actionDef.id}' is incomplete`,
            missing,
            task,
            actorId,
            trace,
          })
        );
      }
    } else if (task.metadata?.source === 'batch') {
      const missing = this.#collectMissing([
        ['resolvedTargets', task.resolvedTargets],
        ['targetDefinitions', task.targetDefinitions],
      ]);

      if (missing.length > 0) {
        failures.push(
          this.#buildValidationFailure({
            code: 'batch_metadata_missing',
            message: `Batch metadata for '${task.actionDef.id}' is incomplete`,
            missing,
            task,
            actorId,
            trace,
          })
        );
      }
    }

    return failures;
  }

  /**
   * @param {Array<[string, unknown]>} descriptors - Field descriptors to inspect.
   * @returns {string[]} Names of missing properties.
   */
  #collectMissing(descriptors) {
    const missing = [];

    for (const [field, value] of descriptors) {
      const isPresent = typeof value === 'boolean' ? value : Boolean(value);
      if (!isPresent) {
        missing.push(field);
      }
    }

    return missing;
  }

  /**
   * @param {object} options - Failure construction options.
   * @param {string} options.code - Failure identifier.
   * @param {string} options.message - Description of the failure.
   * @param {string[]} options.missing - List of missing properties.
   * @param {ActionFormattingTask} options.task - Task associated with the failure.
   * @param {string} options.actorId - Actor identifier.
   * @param {TraceLike} [options.trace] - Optional trace context.
   * @returns {ValidationFailure} Structured validation failure.
   */
  #buildValidationFailure({ code, message, missing, task, actorId, trace }) {
    const errorPayload = {
      error: new Error(message),
      details: {
        code,
        missing,
        metadataSource: task.metadata?.source ?? 'unknown',
      },
    };

    const structuredError = this.#errorFactory?.create({
      errorOrResult: errorPayload,
      actionDef: /** @type {ActionDefinition} */ (task.actionDef),
      actorId: actorId ?? task.actor?.id ?? 'unknown',
      trace,
    });

    return {
      code,
      message,
      error: structuredError ?? errorPayload,
    };
  }
}

export default ActionFormattingDecider;
