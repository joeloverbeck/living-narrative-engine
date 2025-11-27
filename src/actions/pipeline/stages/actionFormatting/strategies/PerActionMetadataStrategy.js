/**
 * @file Strategy responsible for formatting actions that provide per-action multi-target metadata.
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
 * @property {IActionCommandFormatter} commandFormatter - Formatter for action commands.
 * @property {EntityManager} entityManager - Entity manager reference used by formatters.
 * @property {ISafeEventDispatcher} safeEventDispatcher - Dispatcher used when formatters emit events.
 * @property {Function} getEntityDisplayNameFn - Helper that resolves entity display names.
 * @property {import('../../../../../logging/consoleLogger.js').default} [logger] - Optional logger instance.
 * @property {LegacyFallbackFormatter} fallbackFormatter - Fallback formatter used when multi-target formatting fails.
 * @property {TargetNormalizationService} targetNormalizationService - Target normalisation service instance.
 */

/**
 * @typedef {object} FormatParams
 * @property {ActionFormattingTask} task - Formatting task created by {@link ActionFormattingTaskFactory}.
 * @property {ActionFormattingInstrumentation|null|undefined} [instrumentation] - Optional instrumentation hooks.
 * @property {FormattingAccumulator} accumulator - Shared accumulator for formatted results.
 * @property {Function} createError - Error factory provided by the ActionFormattingCoordinator.
 * @property {import('../../../../tracing/traceContext.js').TraceContext|import('../../../../tracing/structuredTrace.js').StructuredTrace|import('../../../../tracing/actionAwareStructuredTrace.js').default|undefined} [trace] - Optional trace context.
 */

/**
 * @class PerActionMetadataStrategy
 * @description Formats actions whose metadata contains per-action multi-target information.
 */
export class PerActionMetadataStrategy {
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
   * @description Determines whether the provided task should be handled by this strategy.
   * @param {ActionFormattingTask|undefined|null} task - Candidate task.
   * @returns {boolean} True when the task carries per-action metadata.
   */
  canFormat(task) {
    return Boolean(task?.metadata?.hasPerActionMetadata);
  }

  /**
   * @description Formats the provided task and records lifecycle statistics.
   * @param {FormatParams} params - Formatting parameters.
   * @returns {Promise<void>} Resolves when formatting completes.
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

    accumulator.registerAction(actionId, 'per-action');
    instrumentation?.actionStarted?.({
      actionDef,
      timestamp: startTimestamp,
      payload: {
        metadataSource: task.metadata?.source,
        targetContextCount: task.targetContexts?.length || 0,
        hasResolvedTargets: Boolean(task.resolvedTargets),
        hasTargetDefinitions: Boolean(task.targetDefinitions),
        isMultiTarget: Boolean(task.isMultiTarget),
      },
    });

    if (this.#shouldUseMultiTarget(task)) {
      await this.#formatUsingMultiTarget({
        task,
        instrumentation,
        accumulator,
        createError,
        trace,
      });
      return;
    }

    await this.#formatUsingLegacyContexts({
      task,
      instrumentation,
      accumulator,
      createError,
      trace,
    });
  }

  /**
   * @param {ActionFormattingTask} task - Task to inspect.
   * @returns {boolean} True when multi-target formatting should be attempted.
   */
  #shouldUseMultiTarget(task) {
    return (
      Boolean(task.isMultiTarget) &&
      Boolean(task.resolvedTargets) &&
      Boolean(task.targetDefinitions)
    );
  }

  /**
   * @param {FormatParams} params - Formatting parameters.
   * @returns {Promise<void>} Resolves when processing completes.
   */
  async #formatUsingMultiTarget({
    task,
    instrumentation,
    accumulator,
    createError,
    trace,
  }) {
    const { actionDef: originalActionDef, actor, resolvedTargets, targetDefinitions, formattedTemplate } = task;
    // Use a shallow clone with the formattedTemplate if available to avoid mutating cached definitions
    const actionDef = formattedTemplate
      ? { ...originalActionDef, template: formattedTemplate }
      : originalActionDef;
    const formatterOptions = this.#buildFormatterOptions(task);

    const hasMultiTargetFormatter =
      typeof this.#commandFormatter.formatMultiTarget === 'function';

    const normalization = this.#targetNormalizationService.normalize({
      resolvedTargets,
      targetContexts: task.targetContexts,
      isMultiTarget: true,
      actionId: actionDef.id,
    });

    if (normalization.error) {
      const structured = createError({
        errorOrResult: normalization.error,
        actionDef,
        actorId: actor.id,
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
      return;
    }

    let formatterResult = null;
    let fallbackUsed = false;
    let formatException = null;

    if (hasMultiTargetFormatter) {
      try {
        formatterResult = this.#commandFormatter.formatMultiTarget(
          actionDef,
          resolvedTargets,
          this.#entityManager,
          formatterOptions,
          {
            displayNameFn: this.#getEntityDisplayNameFn,
            targetDefinitions,
          }
        );
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        this.#logger?.error?.(
          `PerActionMetadataStrategy: formatMultiTarget threw for action '${actionDef.id}'`,
          normalizedError
        );
        formatException = normalizedError;
        formatterResult = {
          ok: false,
          error: normalizedError,
        };
      }
    }

    if (!formatterResult || !formatterResult.ok) {
      fallbackUsed = true;
      formatterResult = await this.#formatWithFallback({
        task,
        normalization,
        formatterOptions,
      });
    }

    if (!formatterResult || !formatterResult.ok) {
      let errorOrResult = formatterResult ?? formatException ?? {
        error: 'Multi-target formatter returned no result',
      };

      if (formatException) {
        const fallbackError = formatterResult?.error;
        if (fallbackError && fallbackError !== formatException) {
          const fallbackMessage =
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError);
          const combinedError = new Error(
            `${formatException.message} (fallback: ${fallbackMessage})`
          );
          combinedError.cause = formatException;
          errorOrResult = combinedError;
        } else {
          errorOrResult = formatException;
        }
      }

      const structured = createError({
        errorOrResult,
        actionDef,
        actorId: actor.id,
        trace,
        targetId: normalization.primaryTargetContext?.entityId ?? null,
      });
      accumulator.recordFailure(actionDef.id);
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
          actorId: actor.id,
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
      accumulator.recordSuccess(actionDef.id);
    }
    if (failureCount > 0) {
      accumulator.recordFailure(actionDef.id);
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
   * @param {ActionFormattingTask} task - Formatting task.
   * @returns {object} Formatter options shared with the legacy strategy.
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
   * @param {object} params.formatterOptions - Options forwarded to the formatter.
   * @returns {Promise<import('../../../../formatters/formatActionTypedefs.js').FormatActionCommandResult>} Formatter result.
   */
  async #formatWithFallback({ task, normalization, formatterOptions }) {
    const { actionDef, targetDefinitions, resolvedTargets } = task;

    const fallbackNormalization = normalization.error
      ? this.#targetNormalizationService.normalize({
          targetContexts: task.targetContexts,
          resolvedTargets: null,
          isMultiTarget: false,
          actionId: actionDef.id,
        })
      : normalization;

    const preparedFallback = this.#fallbackFormatter.prepareFallback({
      actionDefinition: actionDef,
      targetContext: fallbackNormalization.primaryTargetContext,
      targetDefinitions,
      resolvedTargets,
    });

    return this.#fallbackFormatter.formatWithFallback({
      preparedFallback,
      formatterOptions,
    });
  }

  /**
   * @param {object} params - Payload construction parameters.
   * @param {ActionFormattingTask} params.task - Formatting task.
   * @param {TargetNormalizationResult} params.normalization - Target normalisation result.
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
          isMultiTarget: Boolean(task.isMultiTarget),
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
   * @param {FormatParams} params - Formatting parameters.
   * @returns {Promise<void>} Resolves when processing completes.
   */
  async #formatUsingLegacyContexts({
    task,
    instrumentation,
    accumulator,
    createError,
    trace,
  }) {
    const { actionDef: originalActionDef, actor, targetContexts, formattedTemplate } = task;
    // Use a shallow clone with the formattedTemplate if available to avoid mutating cached definitions
    const actionDef = formattedTemplate
      ? { ...originalActionDef, template: formattedTemplate }
      : originalActionDef;
    const formatterOptions = this.#buildFormatterOptions(task);

    let successes = 0;
    let failures = 0;

    for (const targetContext of targetContexts || []) {
      const result = this.#commandFormatter.format(
        actionDef,
        targetContext,
        this.#entityManager,
        formatterOptions,
        { displayNameFn: this.#getEntityDisplayNameFn }
      );

      if (result.ok) {
        const normalization = this.#targetNormalizationService.normalize({
          targetContexts: [targetContext],
          isMultiTarget: false,
          actionId: actionDef.id,
        });

        accumulator.addFormattedAction({
          id: actionDef.id,
          name: actionDef.name,
          command: result.value,
          description: actionDef.description || '',
          params: normalization.params,
          visual: actionDef.visual || null,
        });
        successes += 1;
      } else {
        failures += 1;
        const structured = createError({
          errorOrResult: result,
          actionDef,
          actorId: actor.id,
          trace,
          targetId: targetContext?.entityId ?? null,
        });
        accumulator.addError(structured);
      }
    }

    if (successes > 0) {
      accumulator.recordSuccess(actionDef.id);
    }
    if (failures > 0) {
      accumulator.recordFailure(actionDef.id);
    }

    const statusPayload = {
      formatterMethod: 'format',
      successCount: successes,
      failureCount: failures,
    };

    const hook = failures > 0 ? 'actionFailed' : 'actionCompleted';
    instrumentation?.[hook]?.({
      actionDef,
      timestamp: Date.now(),
      payload: statusPayload,
    });
  }
}

export default PerActionMetadataStrategy;
