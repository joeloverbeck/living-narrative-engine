/**
 * @file Strategy responsible for formatting actions that rely on batch-level multi-target metadata.
 */

/**
 * @typedef {import('../../../../../interfaces/IActionCommandFormatter.js').IActionCommandFormatter} IActionCommandFormatter
 */
/**
 * @typedef {import('../../../../../entities/entityManager.js').default} EntityManager
 */
/**
 * @typedef {import('../../../../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */
/**
 * @typedef {import('../../../../../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition
 */
/**
 * @typedef {import('../../../../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext
 */
/**
 * @typedef {import('../ActionFormattingTaskFactory.js').ActionFormattingTask} ActionFormattingTask
 */
/**
 * @typedef {import('../legacy/LegacyFallbackFormatter.js').LegacyFallbackFormatter} LegacyFallbackFormatter
 */
/**
 * @typedef {import('../TargetNormalizationService.js').TargetNormalizationService} TargetNormalizationService
 */
/**
 * @typedef {import('../FormattingAccumulator.js').FormattingAccumulator} FormattingAccumulator
 */
/**
 * @typedef {import('../ActionFormattingInstrumentation.js').ActionFormattingInstrumentation} ActionFormattingInstrumentation
 */
/**
 * @typedef {ReturnType<TargetNormalizationService['normalize']>} TargetNormalizationResult
 */

/**
 * @typedef {object} StrategyDeps
 * @property {IActionCommandFormatter} commandFormatter - Formatter used for actions.
 * @property {EntityManager} entityManager - Entity manager dependency.
 * @property {ISafeEventDispatcher} safeEventDispatcher - Dispatcher consumed by formatters.
 * @property {Function} getEntityDisplayNameFn - Helper resolving entity display names.
 * @property {import('../../../../../logging/consoleLogger.js').default} [logger] - Optional logger instance.
 * @property {LegacyFallbackFormatter} fallbackFormatter - Fallback formatter implementation.
 * @property {TargetNormalizationService} targetNormalizationService - Normalisation service instance.
 */

/**
 * @typedef {object} FormatParams
 * @property {ActionFormattingTask} task - Task prepared by {@link ActionFormattingTaskFactory}.
 * @property {ActionFormattingInstrumentation|null|undefined} [instrumentation] - Optional instrumentation hooks.
 * @property {FormattingAccumulator} accumulator - Accumulator shared across strategies.
 * @property {Function} createError - Error factory bound to the stage implementation.
 * @property {import('../../../../tracing/traceContext.js').TraceContext|import('../../../../tracing/structuredTrace.js').StructuredTrace|import('../../../../tracing/actionAwareStructuredTrace.js').default|undefined} [trace] - Optional trace adapter.
 */

/**
 * @class GlobalMultiTargetStrategy
 * @description Formats actions using batch-level multi-target metadata.
 */
export class GlobalMultiTargetStrategy {
  #commandFormatter;
  #entityManager;
  #safeEventDispatcher;
  #getEntityDisplayNameFn;
  #logger;
  #fallbackFormatter;
  #targetNormalizationService;

  /**
   * @param {StrategyDeps} deps - Strategy dependencies.
   */
  constructor({
    commandFormatter,
    entityManager,
    safeEventDispatcher,
    getEntityDisplayNameFn,
    logger,
    fallbackFormatter,
    targetNormalizationService,
  }) {
    this.#commandFormatter = commandFormatter;
    this.#entityManager = entityManager;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#getEntityDisplayNameFn = getEntityDisplayNameFn;
    this.#logger = logger;
    this.#fallbackFormatter = fallbackFormatter;
    this.#targetNormalizationService = targetNormalizationService;
  }

  /**
   * @description Determines whether the strategy can handle the provided task.
   * @param {ActionFormattingTask|undefined|null} task - Candidate task.
   * @returns {boolean} True when the task relies on batch-level metadata.
   */
  canFormat(task) {
    return Boolean(
      task &&
        !task.metadata?.hasPerActionMetadata &&
        task.metadata?.source === 'batch' &&
        task.resolvedTargets &&
        task.targetDefinitions
    );
  }

  /**
   * @description Formats the provided task using batch-level resolved targets.
   * @param {FormatParams} params - Formatting parameters.
   * @returns {Promise<void>} Resolves once formatting completes.
   */
  async format({ task, instrumentation, accumulator, createError, trace }) {
    if (!task) {
      return;
    }

    const { actionDef: originalActionDef, formattedTemplate } = task;
    // Use a shallow clone with the formattedTemplate if available to avoid mutating cached definitions
    const actionDef = formattedTemplate
      ? { ...originalActionDef, template: formattedTemplate }
      : originalActionDef;
    const actionId = actionDef.id;
    const startTimestamp = Date.now();

    accumulator.registerAction(actionId, 'multi-target');
    instrumentation?.actionStarted?.({
      actionDef,
      timestamp: startTimestamp,
      payload: {
        hasResolvedTargets: Boolean(task.resolvedTargets),
        hasTargetDefinitions: Boolean(task.targetDefinitions),
        metadataSource: task.metadata?.source,
        supportsFormatMultiTarget: Boolean(
          this.#commandFormatter?.formatMultiTarget
        ),
      },
    });

    const normalization = this.#targetNormalizationService.normalize({
      resolvedTargets: task.resolvedTargets,
      targetContexts: task.targetContexts,
      isMultiTarget: true,
      actionId: actionDef.id,
    });

    if (normalization.error) {
      this.#recordNormalizationFailure({
        task,
        accumulator,
        instrumentation,
        createError,
        trace,
        normalization,
      });
      return;
    }

    const formatterOptions = this.#buildFormatterOptions(task);
    const multiTargetFormatter = this.#commandFormatter.formatMultiTarget;

    let formatterResult = null;
    let fallbackUsed = false;

    if (typeof multiTargetFormatter === 'function') {
      formatterResult = multiTargetFormatter(
        actionDef,
        task.resolvedTargets,
        this.#entityManager,
        formatterOptions,
        {
          displayNameFn: this.#getEntityDisplayNameFn,
          targetDefinitions: task.targetDefinitions,
        }
      );

      if (!formatterResult || !formatterResult.ok) {
        fallbackUsed = true;
        formatterResult = await this.#formatWithFallback({
          task,
          normalization,
          formatterOptions,
        });
      }
    } else {
      fallbackUsed = true;
      formatterResult = await this.#formatWithFallback({
        task,
        normalization,
        formatterOptions,
      });
    }

    if (!formatterResult || !formatterResult.ok) {
      const structured = createError({
        errorOrResult: formatterResult ?? {
          error: 'Multi-target formatter returned no result',
        },
        actionDef,
        actorId: task.actor.id,
        trace,
        targetId: normalization.primaryTargetContext?.entityId ?? null,
      });
      accumulator.recordFailure(actionId);
      accumulator.addError(structured);
      instrumentation?.actionFailed?.({
        actionDef,
        timestamp: Date.now(),
        payload: {
          formatterMethod: fallbackUsed ? 'format' : 'formatMultiTarget',
          fallbackUsed,
          error: formatterResult?.error ?? 'Unknown formatting failure',
        },
      });
      return;
    }

    const commands = Array.isArray(formatterResult.value)
      ? formatterResult.value
      : [formatterResult.value];

    let successCount = 0;
    let failureCount = 0;

    for (const commandPayload of commands) {
      const {
        command,
        params,
        normalization: commandNormalization,
      } = this.#buildCommandPayload({
        task,
        normalization,
        commandPayload,
      });

      if (commandNormalization.error) {
        failureCount += 1;
        const structured = createError({
          errorOrResult: commandNormalization.error,
          actionDef,
          actorId: task.actor.id,
          trace,
          targetId: commandNormalization.primaryTargetContext?.entityId ?? null,
        });
        accumulator.addError(structured);
        continue;
      }

      accumulator.addFormattedAction({
        id: actionDef.id,
        name: actionDef.name,
        command,
        description: actionDef.description || '',
        params,
        visual: actionDef.visual || null,
      });
      successCount += 1;
    }

    if (successCount > 0) {
      accumulator.recordSuccess(actionId);
    }
    if (failureCount > 0) {
      accumulator.recordFailure(actionId);
    }

    const payload = {
      formatterMethod: fallbackUsed ? 'format' : 'formatMultiTarget',
      fallbackUsed,
      commandCount: commands.length,
      successCount,
      failureCount,
    };

    const hook = failureCount > 0 ? 'actionFailed' : 'actionCompleted';
    instrumentation?.[hook]?.({
      actionDef,
      timestamp: Date.now(),
      payload,
    });
  }

  /**
   * @param {ActionFormattingTask} task - Task to inspect.
   * @returns {object} Formatter options forwarded to command formatters.
   */
  #buildFormatterOptions(task) {
    const options = {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };

    if (task?.formatterOptions && typeof task.formatterOptions === 'object') {
      return { ...options, ...task.formatterOptions };
    }

    return options;
  }

  /**
   * @param {object} params - Fallback execution parameters.
   * @param {ActionFormattingTask} params.task - Formatting task.
   * @param {TargetNormalizationResult} params.normalization - Normalised target payload.
   * @param {object} params.formatterOptions - Formatter options forwarded to the legacy formatter.
   * @returns {Promise<import('../../../../formatters/formatActionTypedefs.js').FormatActionCommandResult>} Formatter result.
   */
  async #formatWithFallback({ task, normalization, formatterOptions }) {
    const fallbackNormalization = normalization.error
      ? this.#targetNormalizationService.normalize({
          targetContexts: task.targetContexts,
          actionId: task.actionDef.id,
          isMultiTarget: false,
        })
      : normalization;

    const preparedFallback = this.#fallbackFormatter.prepareFallback({
      actionDefinition: task.actionDef,
      targetContext: fallbackNormalization.primaryTargetContext,
      targetDefinitions: task.targetDefinitions,
      resolvedTargets: task.resolvedTargets,
    });

    return this.#fallbackFormatter.formatWithFallback({
      preparedFallback,
      formatterOptions,
    });
  }

  /**
   * @param {object} params - Command payload construction parameters.
   * @param {ActionFormattingTask} params.task - Formatting task.
   * @param {TargetNormalizationResult} params.normalization - Baseline normalisation payload.
   * @param {string|{command:string,targets?:object}} params.commandPayload - Formatter output payload.
   * @returns {{command:string,params:object,normalization:TargetNormalizationResult}} Structured command payload.
   */
  #buildCommandPayload({ task, normalization, commandPayload }) {
    let command;
    let targetSource = normalization;

    if (typeof commandPayload === 'object' && commandPayload !== null) {
      command = commandPayload.command;

      if (commandPayload.targets) {
        targetSource = this.#targetNormalizationService.normalize({
          resolvedTargets: commandPayload.targets,
          targetContexts: task.targetContexts,
          isMultiTarget: true,
          actionId: task.actionDef.id,
        });
      }
    } else {
      command = /** @type {string} */ (commandPayload);
    }

    const params = targetSource.params ?? {};

    return { command, params, normalization: targetSource };
  }

  /**
   * @param {object} params - Normalisation failure handling parameters.
   * @param {ActionFormattingTask} params.task - Current formatting task.
   * @param {FormattingAccumulator} params.accumulator - Shared accumulator.
   * @param {ActionFormattingInstrumentation|null|undefined} params.instrumentation - Instrumentation hooks.
   * @param {Function} params.createError - Error factory callback.
   * @param {TargetNormalizationResult} params.normalization - Failed normalisation payload.
   * @param {import('../../../../tracing/traceContext.js').TraceContext|import('../../../../tracing/structuredTrace.js').StructuredTrace|import('../../../../tracing/actionAwareStructuredTrace.js').default|undefined} params.trace - Optional trace context.
   * @returns {void}
   */
  #recordNormalizationFailure({
    task,
    accumulator,
    instrumentation,
    createError,
    normalization,
    trace,
  }) {
    const { actionDef } = task;
    const structured = createError({
      errorOrResult: normalization.error,
      actionDef,
      actorId: task.actor.id,
      trace,
      targetId: normalization.primaryTargetContext?.entityId ?? null,
    });
    accumulator.recordFailure(actionDef.id);
    accumulator.addError(structured);

    instrumentation?.actionFailed?.({
      actionDef,
      timestamp: Date.now(),
      payload: {
        formatterMethod: 'formatMultiTarget',
        error: normalization.error,
      },
    });
  }
}

export default GlobalMultiTargetStrategy;
