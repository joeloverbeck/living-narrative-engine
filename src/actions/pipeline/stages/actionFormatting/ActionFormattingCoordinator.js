/**
 * @file Coordinator responsible for orchestrating action formatting tasks.
 */

import { PipelineResult } from '../../PipelineResult.js';
import { createActionFormattingTask } from './ActionFormattingTaskFactory.js';
import { FormattingAccumulator } from './FormattingAccumulator.js';

/**
 * @typedef {import('../../../../entities/entity.js').default} Entity
 */
/**
 * @typedef {import('../../../../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition
 */
/**
 * @typedef {import('../../../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext
 */
/**
 * @typedef {import('./ActionFormattingTaskFactory.js').ActionFormattingTask} ActionFormattingTask
 */
/**
 * @typedef {import('./ActionFormattingInstrumentation.js').ActionFormattingInstrumentation} ActionFormattingInstrumentation
 */
/**
 * @typedef {import('./FormattingAccumulator.js').FormattingAccumulator} FormattingAccumulator
 */
/**
 * @typedef {import('./ActionFormattingDecider.js').ActionFormattingDecider} ActionFormattingDecider
 */
/**
 * @typedef {import('./ActionFormattingErrorFactory.js').ActionFormattingErrorFactory} ActionFormattingErrorFactory
 */
/**
 * @typedef {import('./legacy/LegacyFallbackFormatter.js').LegacyFallbackFormatter} LegacyFallbackFormatter
 */

/**
 * @typedef {object} PipelineContext
 * @property {Entity} actor - Actor executing the formatting pipeline.
 * @property {Array<{ actionDef: ActionDefinition, targetContexts?: ActionTargetContext[], resolvedTargets?: object|null, targetDefinitions?: object|null, isMultiTarget?: boolean }>} actionsWithTargets - Actions awaiting formatting.
 * @property {object|null|undefined} [resolvedTargets] - Batch level resolved targets payload.
 * @property {object|null|undefined} [targetDefinitions] - Batch level target definition payload.
 * @property {import('../../../tracing/traceContext.js').TraceContext|import('../../../tracing/structuredTrace.js').StructuredTrace|import('../../../tracing/actionAwareStructuredTrace.js').default|undefined} [trace] - Optional trace context forwarded to instrumentation.
 */

/**
 * @typedef {object} CoordinatorDependencies
 * @property {PipelineContext} context - Pipeline execution context payload.
 * @property {ActionFormattingInstrumentation|null|undefined} [instrumentation] - Instrumentation adapter.
 * @property {ActionFormattingDecider} decider - Strategy decider used to select formatting behaviour.
 * @property {() => FormattingAccumulator} accumulatorFactory - Factory that produces accumulators used for statistics aggregation.
 * @property {ActionFormattingErrorFactory} errorFactory - Error factory responsible for building structured errors.
 * @property {LegacyFallbackFormatter} fallbackFormatter - Legacy fallback formatter instance.
 * @property {import('./TargetNormalizationService.js').TargetNormalizationService} targetNormalizationService - Target normalisation service (reserved for upcoming strategy wiring).
 * @property {import('../../../../interfaces/IActionCommandFormatter.js').IActionCommandFormatter} commandFormatter - Formatter responsible for producing final action commands.
 * @property {import('../../../../entities/entityManager.js').default} entityManager - Entity manager forwarded to command formatter.
 * @property {import('../../../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} safeEventDispatcher - Dispatcher used by formatter implementations when emitting events.
 * @property {Function} getEntityDisplayNameFn - Helper that resolves entity display names.
 * @property {import('../../../../logging/consoleLogger.js').default} logger - Logger used for diagnostics and validation warnings.
 * @property {(visual: unknown, actionId: string) => boolean} validateVisualProperties - Visual validation helper mirroring the stage behaviour.
 * @property {object} [formatterOptions] - Optional preconstructed formatter options forwarded to tasks.
 * @property {(options: import('./ActionFormattingTaskFactory.js').ActionFormattingTaskFactoryOptions) => ActionFormattingTask} [createTask] - Task factory override (mainly for testing).
 */

/**
 * @class ActionFormattingCoordinator
 * @description Coordinates per-action formatting execution while preserving existing instrumentation semantics.
 */
export class ActionFormattingCoordinator {
  #context;

  #instrumentation;

  #decider;

  #accumulatorFactory;

  #errorFactory;

  #fallbackFormatter;

  #targetNormalizationService;

  #commandFormatter;

  #entityManager;

  #safeEventDispatcher;

  #getEntityDisplayNameFn;

  #logger;

  #validateVisualProperties;

  #createTask;

  #providedFormatterOptions;

  /**
   * @param {CoordinatorDependencies} deps - Coordinator dependencies.
   */
  constructor({
    context,
    instrumentation,
    decider,
    accumulatorFactory,
    errorFactory,
    fallbackFormatter,
    targetNormalizationService,
    commandFormatter,
    entityManager,
    safeEventDispatcher,
    getEntityDisplayNameFn,
    logger,
    validateVisualProperties,
    formatterOptions = null,
    createTask = createActionFormattingTask,
  }) {
    this.#context = context;
    this.#instrumentation = instrumentation ?? null;
    this.#decider = decider;
    this.#accumulatorFactory =
      typeof accumulatorFactory === 'function'
        ? accumulatorFactory
        : () => new FormattingAccumulator();
    this.#errorFactory = errorFactory;
    this.#fallbackFormatter = fallbackFormatter;
    this.#targetNormalizationService = targetNormalizationService;
    this.#commandFormatter = commandFormatter;
    this.#entityManager = entityManager;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#getEntityDisplayNameFn = getEntityDisplayNameFn;
    this.#logger = logger;
    this.#validateVisualProperties =
      typeof validateVisualProperties === 'function'
        ? validateVisualProperties
        : () => true;
    this.#createTask = createTask;
    this.#providedFormatterOptions = formatterOptions;
  }

  /**
   * @description Executes the coordinator for the configured pipeline context.
   * @returns {Promise<PipelineResult>} Pipeline result containing formatted actions and accumulated errors.
   */
  async run() {
    const {
      actor,
      actionsWithTargets = [],
      resolvedTargets,
      targetDefinitions,
      trace,
    } = this.#context ?? {};

    const accumulator = this.#accumulatorFactory();
    const formatterOptions = this.#buildFormatterOptions();
    const tasks = actionsWithTargets.map((actionWithTargets) =>
      this.#createTask({
        actor,
        actionWithTargets,
        formatterOptions,
        batchResolvedTargets: resolvedTargets ?? null,
        batchTargetDefinitions: targetDefinitions ?? null,
      })
    );

    this.#emitStageStarted(actor, tasks);

    const createError = (context) => this.#errorFactory.create(context);

    for (const task of tasks) {
      if (!task?.actionDef) {
        continue;
      }

      this.#validateVisualProperties(task.actionDef.visual, task.actionDef.id);

      const decision = this.#decider.decide({
        task,
        actorId: task.actor.id,
        trace,
      });

      this.#recordValidationFailures({
        decision,
        task,
        accumulator,
      });

      if (decision.strategy && decision.validationFailures.length === 0) {
        await decision.strategy.format({
          task,
          instrumentation: this.#instrumentation,
          accumulator,
          createError,
          trace,
        });
        continue;
      }

      await this.#formatLegacyFallbackTask({
        task,
        accumulator,
        createError,
        trace,
      });
    }

    const errors = accumulator.getErrors();

    this.#emitStageCompleted(accumulator, errors.length);

    return PipelineResult.success({
      actions: accumulator.getFormattedActions(),
      errors,
    });
  }

  /**
   * @param {object} params - Validation handling parameters.
   * @param {{ validationFailures?: Array<{ code?: string, error?: unknown }> }} params.decision - Decider outcome.
   * @param {ActionFormattingTask} params.task - Task currently being processed.
   * @param {FormattingAccumulator} params.accumulator - Accumulator collecting errors.
   * @returns {void}
   */
  #recordValidationFailures({ decision, task, accumulator }) {
    const failures = Array.isArray(decision?.validationFailures)
      ? decision.validationFailures
      : [];

    if (failures.length === 0 || !task?.actionDef) {
      return;
    }

    const failureCodes = [];

    for (const failure of failures) {
      if (failure?.code) {
        failureCodes.push(failure.code);
      }
      accumulator.addError(failure?.error);
    }

    this.#instrumentation?.actionFailed?.({
      actionDef: task.actionDef,
      timestamp: Date.now(),
      payload: {
        reason: 'validation-failed',
        failureCodes,
        metadataSource: task.metadata?.source,
      },
    });
  }

  /**
   * @returns {object} Formatter options derived from the provided dependencies.
   */
  #buildFormatterOptions() {
    if (
      this.#providedFormatterOptions &&
      typeof this.#providedFormatterOptions === 'object'
    ) {
      return this.#providedFormatterOptions;
    }

    return {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };
  }

  /**
   * @param {Entity} actor - Actor owning the actions.
   * @param {ActionFormattingTask[]} tasks - Tasks prepared for execution.
   * @returns {void}
   */
  #emitStageStarted(actor, tasks) {
    this.#instrumentation?.stageStarted?.({
      actor,
      formattingPath: 'per-action',
      actions: tasks.map((task) => ({
        actionDef: task.actionDef,
        metadata: {
          source: task.metadata?.source,
          hasPerActionMetadata: Boolean(task.metadata?.hasPerActionMetadata),
          targetContextCount: task.targetContexts?.length || 0,
          hasResolvedTargets: Boolean(task.resolvedTargets),
          hasTargetDefinitions: Boolean(task.targetDefinitions),
        },
      })),
    });
  }

  /**
   * @param {FormattingAccumulator} accumulator - Accumulator capturing statistics.
   * @param {number} errorCount - Total error count recorded during execution.
   * @returns {void}
   */
  #emitStageCompleted(accumulator, errorCount) {
    this.#instrumentation?.stageCompleted?.({
      formattingPath: 'per-action',
      statistics: accumulator.getStatistics(),
      errorCount,
    });
  }

  /**
   * @param {object} params - Fallback execution parameters.
   * @param {ActionFormattingTask} params.task - Task requiring legacy formatting.
   * @param {FormattingAccumulator} params.accumulator - Accumulator storing results.
   * @param {Function} params.createError - Error factory helper.
   * @param {import('../../../tracing/traceContext.js').TraceContext|import('../../../tracing/structuredTrace.js').StructuredTrace|import('../../../tracing/actionAwareStructuredTrace.js').default|undefined} params.trace - Optional trace context.
   * @returns {Promise<void>} Resolves once formatting completes.
   */
  async #formatLegacyFallbackTask({ task, accumulator, createError, trace }) {
    const {
      actionDef: originalActionDef,
      targetContexts = [],
      actor,
      formattedTemplate,
    } = task;
    // Use a shallow clone with the formattedTemplate if available to avoid mutating cached definitions
    const actionDef = formattedTemplate
      ? { ...originalActionDef, template: formattedTemplate }
      : originalActionDef;
    const actionId = actionDef.id;

    const formatterOptions = {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
      ...(task.formatterOptions && typeof task.formatterOptions === 'object'
        ? task.formatterOptions
        : {}),
    };

    accumulator.registerAction(actionId, 'legacy');

    this.#instrumentation?.actionStarted?.({
      actionDef,
      timestamp: Date.now(),
      payload: {
        metadataSource: task.metadata?.source,
        targetContextCount: targetContexts.length,
      },
    });

    if (!Array.isArray(targetContexts) || targetContexts.length === 0) {
      const structured = createError({
        errorOrResult: {
          error: new Error(
            'No target contexts available for action formatting'
          ),
          details: {
            code: 'legacy_missing_target_contexts',
            metadataSource: task.metadata?.source,
          },
        },
        actionDef,
        actorId: actor.id,
        trace,
      });
      accumulator.addError(structured);
      accumulator.recordFailure(actionId);
      this.#instrumentation?.actionFailed?.({
        actionDef,
        timestamp: Date.now(),
        payload: {
          reason: 'missing-target-contexts',
          metadataSource: task.metadata?.source,
        },
      });
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const targetContext of targetContexts) {
      try {
        const formatResult = this.#formatLegacyAction(
          actionDef,
          targetContext,
          formatterOptions
        );

        if (formatResult?.ok) {
          accumulator.addFormattedAction({
            id: actionDef.id,
            name: actionDef.name,
            command: formatResult.value,
            description: actionDef.description || '',
            params: { targetId: targetContext.entityId },
            visual: actionDef.visual || null,
          });
          successCount += 1;
        } else {
          failureCount += 1;
          const structured = createError({
            errorOrResult: formatResult ?? {
              error: 'Legacy formatter returned no result',
            },
            actionDef,
            actorId: actor.id,
            trace,
            targetId: targetContext.entityId ?? null,
          });
          accumulator.addError(structured);
        }
      } catch (error) {
        failureCount += 1;
        const structured = createError({
          errorOrResult: error,
          actionDef,
          actorId: actor.id,
          trace,
          targetId: targetContext.entityId ?? null,
        });
        accumulator.addError(structured);
      }
    }

    if (successCount > 0) {
      accumulator.recordSuccess(actionId);
    }
    if (failureCount > 0) {
      accumulator.recordFailure(actionId);
    }

    const payload = {
      formatterMethod: 'format',
      successCount,
      failureCount,
      metadataSource: task.metadata?.source,
      targetContextCount: targetContexts.length,
      status:
        failureCount > 0 && successCount > 0
          ? 'partial'
          : failureCount > 0
            ? 'failed'
            : 'completed',
    };

    if (failureCount > 0 && successCount === 0) {
      this.#instrumentation?.actionFailed?.({
        actionDef,
        timestamp: Date.now(),
        payload,
      });
      return;
    }

    this.#instrumentation?.actionCompleted?.({
      actionDef,
      timestamp: Date.now(),
      payload,
    });
  }

  /**
   * @param {ActionDefinition} actionDef - Action definition metadata.
   * @param {ActionTargetContext} targetContext - Target context payload.
   * @param {object} formatterOptions - Formatter configuration options.
   * @returns {import('../../../formatters/formatActionTypedefs.js').FormatActionCommandResult} Formatter result payload.
   */
  #formatLegacyAction(actionDef, targetContext, formatterOptions) {
    return this.#commandFormatter.format(
      actionDef,
      targetContext,
      this.#entityManager,
      formatterOptions,
      { displayNameFn: this.#getEntityDisplayNameFn }
    );
  }
}

export default ActionFormattingCoordinator;
