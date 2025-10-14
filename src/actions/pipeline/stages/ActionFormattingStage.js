/**
 * @file Stage for formatting resolved actions
 * @see ../PipelineStage.js
 */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';
import { LegacyFallbackFormatter } from './actionFormatting/legacy/LegacyFallbackFormatter.js';
import { LegacyStrategy } from './actionFormatting/legacy/LegacyStrategy.js';
import { TargetNormalizationService } from './actionFormatting/TargetNormalizationService.js';
import { createActionFormattingTask } from './actionFormatting/ActionFormattingTaskFactory.js';
import { ActionFormattingDecider } from './actionFormatting/ActionFormattingDecider.js';
import { PerActionMetadataStrategy } from './actionFormatting/strategies/PerActionMetadataStrategy.js';
import { GlobalMultiTargetStrategy } from './actionFormatting/strategies/GlobalMultiTargetStrategy.js';
import { FormattingAccumulator } from './actionFormatting/FormattingAccumulator.js';
import { ActionFormattingErrorFactory } from './actionFormatting/ActionFormattingErrorFactory.js';
import { TraceAwareInstrumentation } from './actionFormatting/TraceAwareInstrumentation.js';
import { NoopInstrumentation } from './actionFormatting/NoopInstrumentation.js';

/** @typedef {import('./actionFormatting/ActionFormattingInstrumentation.js').ActionFormattingInstrumentation} ActionFormattingInstrumentation */

/** @typedef {import('../../../interfaces/IActionCommandFormatter.js').IActionCommandFormatter} IActionCommandFormatter */
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */
/** @typedef {import('../../../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class ActionFormattingStage
 * @augments PipelineStage
 * @description Formats actions with resolved targets into final discovered actions
 */
export class ActionFormattingStage extends PipelineStage {
  #commandFormatter;
  #entityManager;
  #safeEventDispatcher;
  #getEntityDisplayNameFn;
  #errorContextBuilder;
  #logger;
  #legacyFallbackFormatter;
  #legacyStrategy;
  #targetNormalizationService;

  #errorFactory;

  #perActionMetadataStrategy;

  #globalMultiTargetStrategy;

  #decider;

  /**
   * Creates an ActionFormattingStage instance
   *
   * @param {object} deps - Dependencies
   * @param {IActionCommandFormatter} deps.commandFormatter - Formatter for action commands
   * @param {EntityManager} deps.entityManager - Entity manager
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher
   * @param {Function} deps.getEntityDisplayNameFn - Function to get entity display names
   * @param {ActionErrorContextBuilder} deps.errorContextBuilder - Builder for error contexts
   * @param {ILogger} deps.logger - Logger for diagnostic output
   */
  constructor({
    commandFormatter,
    entityManager,
    safeEventDispatcher,
    getEntityDisplayNameFn,
    errorContextBuilder,
    logger,
  }) {
    super('ActionFormatting');
    this.#commandFormatter = commandFormatter;
    this.#entityManager = entityManager;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#getEntityDisplayNameFn = getEntityDisplayNameFn;
    this.#errorContextBuilder = errorContextBuilder;
    this.#logger = logger;

    this.#targetNormalizationService = new TargetNormalizationService({
      logger: this.#logger,
    });

    this.#legacyFallbackFormatter = new LegacyFallbackFormatter({
      commandFormatter: this.#commandFormatter,
      entityManager: this.#entityManager,
      getEntityDisplayNameFn: this.#getEntityDisplayNameFn,
    });

    this.#legacyStrategy = new LegacyStrategy({
      commandFormatter: this.#commandFormatter,
      entityManager: this.#entityManager,
      safeEventDispatcher: this.#safeEventDispatcher,
      getEntityDisplayNameFn: this.#getEntityDisplayNameFn,
      logger: this.#logger,
      fallbackFormatter: this.#legacyFallbackFormatter,
      createError: (
        errorOrResult,
        actionDef,
        actorId,
        trace,
        targetId = null,
        fallbackTargetId = null
      ) =>
        this.#createError(
          errorOrResult,
          actionDef,
          actorId,
          trace,
          targetId,
        fallbackTargetId
      ),
      validateVisualProperties: (visual, actionId) =>
        this.#validateVisualProperties(visual, actionId),
      targetNormalizationService: this.#targetNormalizationService,
    });

    this.#errorFactory = new ActionFormattingErrorFactory({
      errorContextBuilder: this.#errorContextBuilder,
    });

    this.#perActionMetadataStrategy = new PerActionMetadataStrategy({
      commandFormatter: this.#commandFormatter,
      entityManager: this.#entityManager,
      safeEventDispatcher: this.#safeEventDispatcher,
      getEntityDisplayNameFn: this.#getEntityDisplayNameFn,
      logger: this.#logger,
      fallbackFormatter: this.#legacyFallbackFormatter,
      targetNormalizationService: this.#targetNormalizationService,
    });
    this.#perActionMetadataStrategy.priority = 300;

    this.#globalMultiTargetStrategy = new GlobalMultiTargetStrategy({
      commandFormatter: this.#commandFormatter,
      entityManager: this.#entityManager,
      safeEventDispatcher: this.#safeEventDispatcher,
      getEntityDisplayNameFn: this.#getEntityDisplayNameFn,
      logger: this.#logger,
      fallbackFormatter: this.#legacyFallbackFormatter,
      targetNormalizationService: this.#targetNormalizationService,
    });
    this.#globalMultiTargetStrategy.priority = 200;

    this.#decider = new ActionFormattingDecider({
      strategies: [
        this.#perActionMetadataStrategy,
        this.#globalMultiTargetStrategy,
      ],
      errorFactory: this.#errorFactory,
    });
  }

  /**
   * Internal execution of the action formatting stage
   *
   * @param {object} context - The pipeline context
   * @param {import('../../../entities/entity.js').default} context.actor - The actor entity
   * @param {Array<{actionDef: import('../../../interfaces/IGameDataRepository.js').ActionDefinition, targetContexts: import('../../../models/actionTargetContext.js').ActionTargetContext[]}>} context.actionsWithTargets - Actions with their targets
   * @param {Object<string, import('../../../interfaces/IActionCommandFormatter.js').ResolvedTarget[]>} [context.resolvedTargets] - Multi-target resolved data from MultiTargetResolutionStage
   * @param {object} [context.targetDefinitions] - Target definitions for multi-target actions
   * @param {import('../../tracing/traceContext.js').TraceContext|import('../../tracing/structuredTrace.js').StructuredTrace|import('../../tracing/actionAwareStructuredTrace.js').default} [context.trace] - Optional trace context
   * @returns {Promise<PipelineResult>} Formatted actions
   */
  async executeInternal(context) {
    const { trace } = context;

    // Check if this is an action-aware trace
    const isActionAwareTrace =
      trace && typeof trace.captureActionData === 'function';

    if (isActionAwareTrace) {
      return this.#executeWithTracing(context);
    }

    // Standard execution path (unchanged for backward compatibility)
    return this.#executeStandard(context);
  }

  /**
   * Execute formatting with action tracing enabled
   *
   * @param {object} context - The pipeline context
   * @returns {Promise<PipelineResult>} Formatted actions with trace data
   * @private
   */
  async #executeWithTracing(context) {
    const {
      actor,
      actionsWithTargets = [],
      resolvedTargets,
      targetDefinitions,
      trace,
    } = context;
    const source = `${this.name}Stage.execute`;

    // Capture stage start
    const stageStartTime = Date.now();
    const startPerformanceTime = performance.now(); // ACTTRA-018: Performance timing

    // Track overall statistics
    trace?.step(
      `Formatting ${actionsWithTargets.length} actions with their targets`,
      source
    );

    // Determine which formatting path we're using
    const hasPerActionMetadata = actionsWithTargets.some(
      (awt) =>
        awt.resolvedTargets &&
        awt.targetDefinitions &&
        awt.isMultiTarget !== undefined
    );

    if (hasPerActionMetadata) {
      const instrumentation = new TraceAwareInstrumentation(trace);
      return this.#formatActionsWithDecider({
        actor,
        actionsWithTargets,
        resolvedTargets,
        targetDefinitions,
        trace,
        instrumentation,
      });
    }

    const processingStats = {
      total: actionsWithTargets.length,
      successful: 0,
      failed: 0,
      perActionMetadata: 0,
      multiTarget: 0,
      legacy: 0,
    };

    let formattingPath;
    let result;

    if (resolvedTargets && targetDefinitions) {
      formattingPath = 'multi-target';

      // Capture initial formatting context for each action
      for (const { actionDef } of actionsWithTargets) {
        trace.captureActionData('formatting', actionDef.id, {
          timestamp: Date.now(),
          status: 'started',
          formattingPath,
          actorId: actor.id,
          hasResolvedTargets: !!resolvedTargets,
          hasTargetDefinitions: !!targetDefinitions,
        });
      }

      result = await this.#formatMultiTargetActionsTraced(
        context,
        trace,
        processingStats
      );
    } else {
      formattingPath = 'legacy';

      // Check if any actions have multi-target definitions
      const hasMultiTargetActions = actionsWithTargets.some(
        ({ actionDef }) =>
          actionDef.targets && typeof actionDef.targets === 'object'
      );

      if (hasMultiTargetActions) {
        // Log warning about multi-target actions in legacy context
        this.#logger.warn(
          'Processing mixed legacy and multi-target actions through legacy formatting path. ' +
            'Multi-target actions will be handled individually with fallback formatting.'
        );
      }

      // Capture initial formatting context for each action
      for (const { actionDef, targetContexts } of actionsWithTargets) {
        // Validate visual properties early in processing
        this.#validateVisualProperties(actionDef.visual, actionDef.id);

        trace.captureActionData('formatting', actionDef.id, {
          timestamp: Date.now(),
          status: 'started',
          formattingPath,
          actorId: actor.id,
          targetContextCount: targetContexts?.length || 0,
          isMultiTargetInLegacy:
            actionDef.targets && typeof actionDef.targets === 'object',
        });
      }

      const legacyOutcome = await this.#legacyStrategy.format({
        actor,
        actionsWithTargets,
        trace,
        processingStats,
        traceSource: source,
      });
      result = legacyOutcome.pipelineResult;
    }

    // Capture stage completion
    const stageEndTime = Date.now();

    // Capture summary for the stage
    trace.captureActionData('formatting', '__stage_summary', {
      timestamp: stageEndTime,
      status: 'completed',
      formattingPath,
      statistics: processingStats,
      performance: {
        totalDuration: stageEndTime - stageStartTime,
        averagePerAction:
          actionsWithTargets.length > 0
            ? (stageEndTime - stageStartTime) / actionsWithTargets.length
            : 0,
      },
      errors: result?.errors?.length || 0,
    });

    return result || PipelineResult.success({ actions: [], errors: [] });
  }

  /**
   * Execute standard formatting without tracing
   *
   * @param {object} context - The pipeline context
   * @returns {Promise<PipelineResult>} Formatted actions
   * @private
   */
  async #executeStandard(context) {
    const {
      actor,
      actionsWithTargets = [],
      resolvedTargets,
      targetDefinitions,
      trace,
    } = context;
    const source = `${this.name}Stage.execute`;

    trace?.step(
      `Formatting ${actionsWithTargets.length} actions with their targets`,
      source
    );

    // Check if we have any actions with per-action metadata (new approach)
    const hasPerActionMetadata = actionsWithTargets.some(
      (awt) =>
        awt.resolvedTargets &&
        awt.targetDefinitions &&
        awt.isMultiTarget !== undefined
    );

    if (hasPerActionMetadata) {
      // Process all actions based on their individual metadata (new approach)
      const instrumentation = new NoopInstrumentation();
      return this.#formatActionsWithDecider({
        actor,
        actionsWithTargets,
        resolvedTargets,
        targetDefinitions,
        trace,
        instrumentation,
      });
    }

    // Fall back to old behavior for backward compatibility
    // Check if we have multi-target data to process
    if (resolvedTargets && targetDefinitions) {
      return this.#formatMultiTargetActions(context, trace);
    }

    // Check if any actions have multi-target definitions
    const hasMultiTargetActions = actionsWithTargets.some(
      ({ actionDef }) =>
        actionDef.targets && typeof actionDef.targets === 'object'
    );

    if (hasMultiTargetActions) {
      // Log warning about multi-target actions in legacy context
      this.#logger.warn(
        'Processing mixed legacy and multi-target actions through legacy formatting path. ' +
          'Multi-target actions will be handled individually with fallback formatting.'
      );
    }

    // Process legacy format actions
    const legacyOutcome = await this.#legacyStrategy.format({
      actor,
      actionsWithTargets,
      trace,
      traceSource: source,
    });

    return legacyOutcome.pipelineResult;
  }

  /**
   * @description Formats actions using the strategy decider and shared accumulator.
   * @param {object} params - Formatting parameters.
   * @param {import('../../../../entities/entity.js').default} params.actor - Actor executing the actions.
   * @param {Array<{actionDef: import('../../../../interfaces/IGameDataRepository.js').ActionDefinition, targetContexts?: import('../../../../models/actionTargetContext.js').ActionTargetContext[]}>} params.actionsWithTargets - Actions queued for formatting.
   * @param {object|null} [params.resolvedTargets] - Batch-level resolved targets fallback.
   * @param {object|null} [params.targetDefinitions] - Batch-level target definitions fallback.
   * @param {ActionFormattingInstrumentation} params.instrumentation - Instrumentation hooks.
   * @param {import('../../tracing/traceContext.js').TraceContext|import('../../tracing/structuredTrace.js').StructuredTrace|import('../../tracing/actionAwareStructuredTrace.js').default|undefined} params.trace - Optional trace context.
   * @returns {Promise<PipelineResult>} Pipeline result describing formatted actions and errors.
   * @private
   */
  async #formatActionsWithDecider({
    actor,
    actionsWithTargets = [],
    resolvedTargets = null,
    targetDefinitions = null,
    instrumentation,
    trace,
  }) {
    const formatterOptions = {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };

    const accumulator = new FormattingAccumulator();

    const tasks = actionsWithTargets.map((actionWithTargets) =>
      createActionFormattingTask({
        actor,
        actionWithTargets,
        formatterOptions,
        batchResolvedTargets: resolvedTargets ?? null,
        batchTargetDefinitions: targetDefinitions ?? null,
      })
    );

    instrumentation?.stageStarted?.({
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

    const createError = (context) => this.#errorFactory.create(context);

    for (const task of tasks) {
      if (!task?.actionDef) {
        continue;
      }

      this.#validateVisualProperties(task.actionDef.visual, task.actionDef.id);

      const decision = this.#decider.decide({
        task,
        actorId: actor.id,
        trace,
      });

      for (const failure of decision.validationFailures) {
        accumulator.addError(failure.error);
      }

      if (decision.strategy) {
        await decision.strategy.format({
          task,
          instrumentation,
          accumulator,
          createError,
          trace,
        });
        continue;
      }

      await this.#formatLegacyFallbackTask({
        task,
        instrumentation,
        accumulator,
        createError,
        trace,
      });
    }

    const errors = accumulator.getErrors();

    instrumentation?.stageCompleted?.({
      formattingPath: 'per-action',
      statistics: accumulator.getStatistics(),
      errorCount: errors.length,
    });

    return PipelineResult.success({
      actions: accumulator.getFormattedActions(),
      errors,
    });
  }

  /**
   * @description Handles legacy formatting when no modern strategy matches a task.
   * @param {object} params - Execution parameters.
   * @param {import('./actionFormatting/ActionFormattingTaskFactory.js').ActionFormattingTask} params.task - Task to format.
   * @param {ActionFormattingInstrumentation} params.instrumentation - Instrumentation hooks.
   * @param {FormattingAccumulator} params.accumulator - Shared accumulator for statistics and results.
   * @param {Function} params.createError - Bound error factory.
   * @param {import('../../tracing/traceContext.js').TraceContext|import('../../tracing/structuredTrace.js').StructuredTrace|import('../../tracing/actionAwareStructuredTrace.js').default|undefined} params.trace - Optional trace context.
   * @returns {Promise<void>} Resolves once formatting completes.
   * @private
   */
  async #formatLegacyFallbackTask({
    task,
    instrumentation,
    accumulator,
    createError,
    trace,
  }) {
    if (!task) {
      return;
    }

    const { actionDef, targetContexts = [], actor } = task;
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

    instrumentation?.actionStarted?.({
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
          error: new Error('No target contexts available for action formatting'),
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
      instrumentation?.actionFailed?.({
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
            errorOrResult:
              formatResult ?? {
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
      instrumentation?.actionFailed?.({
        actionDef,
        timestamp: Date.now(),
        payload,
      });
    } else {
      instrumentation?.actionCompleted?.({
        actionDef,
        timestamp: Date.now(),
        payload,
      });
    }
  }

  /**
   * Format a single legacy action using the command formatter.
   *
   * @param {import('../../../../interfaces/IGameDataRepository.js').ActionDefinition} actionDef - Action definition metadata.
   * @param {import('../../../../models/actionTargetContext.js').ActionTargetContext} targetContext - Target context payload.
   * @param {object} formatterOptions - Formatter configuration payload.
   * @returns {import('../../../../formatters/formatActionTypedefs.js').FormatActionCommandResult} Formatter result.
   * @private
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

  /**
   * Format multi-target actions with trace data capture
   *
   * @param {object} context - The pipeline context
   * @param {import('../../tracing/actionAwareStructuredTrace.js').default} trace - Action-aware trace
   * @param {object} stats - Processing statistics
   * @returns {Promise<PipelineResult>} Formatted actions
   * @private
   */
  async #formatMultiTargetActionsTraced(context, trace, stats) {
    const { actor, resolvedTargets, targetDefinitions, actionsWithTargets } =
      context;
    const source = `${this.name}Stage.execute`;
    const formattedActions = [];
    const errors = [];

    this.#logger.debug('formatMultiTargetActionsTraced called with:', {
      actionsCount: actionsWithTargets.length,
      resolvedTargetsKeys: resolvedTargets
        ? Object.keys(resolvedTargets)
        : null,
      targetDefinitionsKeys: targetDefinitions
        ? Object.keys(targetDefinitions)
        : null,
    });

    for (const { actionDef } of actionsWithTargets) {
      const actionStartTime = Date.now();

      // Validate visual properties early in processing
      this.#validateVisualProperties(actionDef.visual, actionDef.id);

      try {
        // Capture formatting attempt
        trace.captureActionData('formatting', actionDef.id, {
          timestamp: actionStartTime,
          status: 'formatting',
          formattingPath: 'multi-target',
          hasFormatMultiTarget: !!this.#commandFormatter.formatMultiTarget,
        });

        let formattingResult;
        let fallbackUsed = false;

        // Check if formatter supports multi-target
        if (this.#commandFormatter.formatMultiTarget) {
          formattingResult = this.#commandFormatter.formatMultiTarget(
            actionDef,
            resolvedTargets,
            this.#entityManager,
            {
              logger: this.#logger,
              debug: true,
              safeEventDispatcher: this.#safeEventDispatcher,
            },
            {
              displayNameFn: this.#getEntityDisplayNameFn,
              targetDefinitions,
            }
          );

          if (!formattingResult.ok) {
            // Try fallback
            fallbackUsed = true;
            const primaryTarget =
              this.#getPrimaryTargetContext(resolvedTargets);
            formattingResult = this.#legacyFallbackFormatter.formatWithFallback(
              {
                actionDefinition: actionDef,
                targetContext: primaryTarget,
                formatterOptions: {
                  logger: this.#logger,
                  debug: true,
                  safeEventDispatcher: this.#safeEventDispatcher,
                },
                targetDefinitions,
                resolvedTargets,
              }
            );
          }
        } else {
          // Direct fallback to legacy
          fallbackUsed = true;
          const primaryTarget = this.#getPrimaryTargetContext(resolvedTargets);
          formattingResult = this.#legacyFallbackFormatter.formatWithFallback({
            actionDefinition: actionDef,
            targetContext: primaryTarget,
            formatterOptions: {
              logger: this.#logger,
              debug: true,
              safeEventDispatcher: this.#safeEventDispatcher,
            },
            targetDefinitions,
            resolvedTargets,
          });
        }

        // Process results
        if (formattingResult && formattingResult.ok) {
          const commands = Array.isArray(formattingResult.value)
            ? formattingResult.value
            : [formattingResult.value];

          for (const commandData of commands) {
            // Check if this is an object with command and targets, or just a string
            const command =
              typeof commandData === 'string'
                ? commandData
                : commandData.command;
            const specificTargets =
              typeof commandData === 'object' && commandData.targets
                ? commandData.targets
                : resolvedTargets;

            const targetIds = this.#extractTargetIds(specificTargets);
            const params = {
              targetIds,
              isMultiTarget: true,
            };

            if (targetIds.primary && targetIds.primary.length === 1) {
              params.targetId = targetIds.primary[0];
            }

            const actionInfo = {
              id: actionDef.id,
              name: actionDef.name,
              command: command,
              description: actionDef.description || '',
              params,
              visual: actionDef.visual || null,
            };
            formattedActions.push(actionInfo);
          }
          stats.successful++;
          stats.multiTarget++;
        } else {
          stats.failed++;
          errors.push(
            this.#createError(
              formattingResult || 'No formatting result',
              actionDef,
              actor.id,
              trace
            )
          );
        }

        const actionEndTime = Date.now();

        // Capture completion
        trace.captureActionData('formatting', actionDef.id, {
          timestamp: actionEndTime,
          status: formattingResult?.ok ? 'completed' : 'failed',
          fallbackUsed,
          performance: {
            duration: actionEndTime - actionStartTime,
          },
        });
      } catch (error) {
        stats.failed++;
        const actionEndTime = Date.now();

        trace.captureActionData('formatting', actionDef.id, {
          timestamp: actionEndTime,
          status: 'failed',
          error: error.message,
          performance: {
            duration: actionEndTime - actionStartTime,
          },
        });

        errors.push(this.#createError(error, actionDef, actor.id, trace));
      }
    }

    trace?.info(
      `Multi-target action formatting completed: ${formattedActions.length} formatted actions, ${errors.length} errors`,
      source
    );

    return PipelineResult.success({
      actions: formattedActions,
      errors,
    });
  }

  /**
   * Format multi-target actions using enhanced formatter
   *
   * @param context
   * @param trace
   * @private
   */
  async #formatMultiTargetActions(context, trace) {
    const { actor, resolvedTargets, targetDefinitions, actionsWithTargets } =
      context;
    const source = `${this.name}Stage.execute`;
    const formattedActions = [];
    const errors = [];

    this.#logger.debug('formatMultiTargetActions called with:', {
      actionsCount: actionsWithTargets.length,
      resolvedTargetsKeys: resolvedTargets
        ? Object.keys(resolvedTargets)
        : null,
      targetDefinitionsKeys: targetDefinitions
        ? Object.keys(targetDefinitions)
        : null,
    });

    for (const { actionDef } of actionsWithTargets) {
      // Validate visual properties early in processing
      this.#validateVisualProperties(actionDef.visual, actionDef.id);

      try {
        // Check if formatter supports multi-target
        if (this.#commandFormatter.formatMultiTarget) {
          const formatResult = this.#commandFormatter.formatMultiTarget(
            actionDef,
            resolvedTargets,
            this.#entityManager,
            {
              logger: this.#logger,
              debug: true,
              safeEventDispatcher: this.#safeEventDispatcher,
            },
            {
              displayNameFn: this.#getEntityDisplayNameFn,
              targetDefinitions,
            }
          );

          if (formatResult.ok) {
            // Handle both single command and array of commands
            const commands = Array.isArray(formatResult.value)
              ? formatResult.value
              : [formatResult.value];

            for (const commandData of commands) {
              // Check if this is an object with command and targets, or just a string
              const command =
                typeof commandData === 'string'
                  ? commandData
                  : commandData.command;
              const specificTargets =
                typeof commandData === 'object' && commandData.targets
                  ? commandData.targets
                  : resolvedTargets;

              const targetIds = this.#extractTargetIds(specificTargets);
              const params = {
                targetIds,
                isMultiTarget: true,
              };

              // Backward compatibility: if there's a single primary target, also set targetId
              if (targetIds.primary && targetIds.primary.length === 1) {
                params.targetId = targetIds.primary[0];
              }

              const actionInfo = {
                id: actionDef.id,
                name: actionDef.name,
                command: command,
                description: actionDef.description || '',
                params,
                visual: actionDef.visual || null,
              };
              formattedActions.push(actionInfo);
            }
          } else {
            // Multi-target formatting failed, try fallback to legacy formatting
            const primaryTarget =
              this.#getPrimaryTargetContext(resolvedTargets);
            const fallbackResult =
              this.#legacyFallbackFormatter.formatWithFallback({
                actionDefinition: actionDef,
                targetContext: primaryTarget,
                formatterOptions: {
                  logger: this.#logger,
                  debug: true,
                  safeEventDispatcher: this.#safeEventDispatcher,
                },
                targetDefinitions,
                resolvedTargets,
              });

            if (fallbackResult.ok) {
              const actionInfo = {
                id: actionDef.id,
                name: actionDef.name,
                command: fallbackResult.value,
                description: actionDef.description || '',
                params: primaryTarget?.entityId
                  ? { targetId: primaryTarget.entityId }
                  : {},
                visual: actionDef.visual || null,
              };
              formattedActions.push(actionInfo);
            } else {
              const errorSource = primaryTarget ? fallbackResult : formatResult;
              errors.push(
                this.#createError(
                  errorSource,
                  actionDef,
                  actor.id,
                  trace,
                  primaryTarget?.entityId
                )
              );
            }
          }
        } else {
          // Fallback to legacy formatting for first target of each type
          const primaryTarget = this.#getPrimaryTargetContext(resolvedTargets);
          if (primaryTarget) {
            const formatResult =
              this.#legacyFallbackFormatter.formatWithFallback({
                actionDefinition: actionDef,
                targetContext: primaryTarget,
                formatterOptions: {
                  logger: this.#logger,
                  debug: true,
                  safeEventDispatcher: this.#safeEventDispatcher,
                },
                targetDefinitions,
                resolvedTargets,
              });

            if (formatResult.ok) {
              const actionInfo = {
                id: actionDef.id,
                name: actionDef.name,
                command: formatResult.value,
                description: actionDef.description || '',
                params: { targetId: primaryTarget.entityId },
                visual: actionDef.visual || null,
              };
              formattedActions.push(actionInfo);
            } else {
              errors.push(
                this.#createError(
                  formatResult,
                  actionDef,
                  actor.id,
                  trace,
                  primaryTarget.entityId
                )
              );
            }
          } else {
            // No targets available for formatting
            errors.push(
              this.#createError(
                'No targets available for action',
                actionDef,
                actor.id,
                trace
              )
            );
          }
        }
      } catch (error) {
        errors.push(this.#createError(error, actionDef, actor.id, trace));
      }
    }

    trace?.info(
      `Multi-target action formatting completed: ${formattedActions.length} formatted actions, ${errors.length} errors`,
      source
    );

    return PipelineResult.success({
      actions: formattedActions,
      errors,
    });
  }

  /**
   * Format legacy actions with trace data capture
   *
   * @param {object} context - The pipeline context
   * @param {import('../../tracing/actionAwareStructuredTrace.js').default} trace - Action-aware trace
   * @param {object} stats - Processing statistics
   * @returns {Promise<PipelineResult>} Formatted actions
   * @private
   */
  /**
   * Extract target IDs from resolved targets for params
   * Enhanced to use TargetManager for optimized placeholder resolution
   *
   * @param resolvedTargets
   * @private
   */
  #extractTargetIds(resolvedTargets) {
    const normalization = this.#targetNormalizationService.normalize({
      resolvedTargets,
      isMultiTarget: true,
    });

    return normalization.targetIds || {};
  }

  /**
   * Create TargetExtractionResult from resolved targets format
   * Converts from { placeholder: [{ id: 'entity_123', ... }] } to TargetManager format
   *
   * @param resolvedTargets - Resolved targets in current format
   * @returns {TargetExtractionResult} Optimized target extraction result
   * @private
   */
  #createTargetExtractionResult(resolvedTargets) {
    // Convert to simple targets object format for TargetManager
    const normalization = this.#targetNormalizationService.normalize({
      resolvedTargets,
      isMultiTarget: true,
    });

    return normalization.targetExtractionResult;
  }

  /**
   * @description Build a legacy-compatible target context for the primary target.
   *
   * @param {Object<string, import('../../../interfaces/IActionCommandFormatter.js').ResolvedTarget[]>|undefined} resolvedTargets - Resolved targets mapped by placeholder key
   * @returns {import('../../../models/actionTargetContext.js').ActionTargetContext|null} Target context for the primary entity or null if unavailable
   * @private
   */
  #getPrimaryTargetContext(resolvedTargets) {
    // Find first target from primary or first available target type
    const normalization = this.#targetNormalizationService.normalize({
      resolvedTargets,
      isMultiTarget: true,
    });

    return normalization.primaryTargetContext;
  }

  /**
   * Basic validation for actionDef.visual structure
   * Logs warnings for invalid visual properties but doesn't block processing
   *
   * @param {object} visual - Visual properties to validate
   * @param {string} actionId - Action ID for logging context
   * @returns {boolean} True if valid or correctable, false if severely malformed
   * @private
   */
  #validateVisualProperties(visual, actionId) {
    if (!visual) {
      return true; // null or undefined is acceptable
    }

    if (typeof visual !== 'object' || Array.isArray(visual)) {
      this.#logger.warn(
        `Invalid visual property structure for action '${actionId}': expected object, got ${typeof visual}. Visual properties will be passed through.`
      );
      return true; // Pass through for downstream validation
    }

    // Check for known visual properties and warn about unknowns
    const knownProperties = [
      'backgroundColor',
      'textColor',
      'hoverBackgroundColor',
      'hoverTextColor',
    ];
    const providedProperties = Object.keys(visual);
    const unknownProperties = providedProperties.filter(
      (prop) => !knownProperties.includes(prop)
    );

    if (unknownProperties.length > 0) {
      this.#logger.warn(
        `Unknown visual properties for action '${actionId}': ${unknownProperties.join(', ')}. These will be passed through but may not be used.`
      );
    }

    // Basic type validation for known properties
    for (const [prop, value] of Object.entries(visual)) {
      if (knownProperties.includes(prop) && typeof value !== 'string') {
        this.#logger.warn(
          `Visual property '${prop}' for action '${actionId}' should be a string, got ${typeof value}. Property will be passed through.`
        );
      }
    }

    return true;
  }

  /**
   * Create error context for formatting failures
   *
   * @param errorOrResult
   * @param actionDef
   * @param actorId
   * @param trace
   * @param targetId
   * @param fallbackTargetId
   * @private
   */
  #createError(
    errorOrResult,
    actionDef,
    actorId,
    trace,
    targetId = null,
    fallbackTargetId = null
  ) {
    return this.#errorFactory.create({
      errorOrResult,
      actionDef,
      actorId,
      trace,
      targetId,
      fallbackTargetId,
    });
  }
}

export default ActionFormattingStage;
