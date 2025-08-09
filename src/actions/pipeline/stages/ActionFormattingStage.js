/**
 * @file Stage for formatting resolved actions
 * @see ../PipelineStage.js
 */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';
import { ERROR_PHASES } from '../../errors/actionErrorTypes.js';
import { TargetExtractionResult } from '../../../entities/multiTarget/targetExtractionResult.js';

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
    const processingStats = {
      total: actionsWithTargets.length,
      successful: 0,
      failed: 0,
      perActionMetadata: 0,
      multiTarget: 0,
      legacy: 0,
    };

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

    let formattingPath;
    let result;

    if (hasPerActionMetadata) {
      formattingPath = 'per-action';

      // Capture initial formatting context for each action
      for (const actionWithTargets of actionsWithTargets) {
        const { actionDef } = actionWithTargets;

        trace.captureActionData('formatting', actionDef.id, {
          timestamp: Date.now(),
          status: 'started',
          formattingPath,
          actorId: actor.id,
          hasPerActionMetadata: !!actionWithTargets.resolvedTargets,
          isMultiTarget: !!actionWithTargets.isMultiTarget,
          targetContextCount: actionWithTargets.targetContexts?.length || 0,
        });
      }

      result = await this.#formatActionsWithPerActionMetadataTraced(
        context,
        trace,
        processingStats
      );
    } else if (resolvedTargets && targetDefinitions) {
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

      result = await this.#formatLegacyActionsTraced(
        context,
        trace,
        processingStats
      );
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
      return this.#formatActionsWithPerActionMetadata(context, trace);
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
    return this.#formatLegacyActions(context, trace);
  }

  /**
   * Format actions with per-action metadata and capture trace data
   *
   * @param {object} context - The pipeline context
   * @param {import('../../tracing/actionAwareStructuredTrace.js').default} trace - Action-aware trace
   * @param {object} stats - Processing statistics
   * @returns {Promise<PipelineResult>} Formatted actions
   * @private
   */
  async #formatActionsWithPerActionMetadataTraced(context, trace, stats) {
    const { actor, actionsWithTargets = [] } = context;
    const source = `${this.name}Stage.execute`;
    const formattedActions = [];
    const errors = [];

    // Options are identical for all targets; compute once for reuse
    const formatterOptions = {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };

    for (const actionWithTargets of actionsWithTargets) {
      const {
        actionDef,
        targetContexts,
        resolvedTargets,
        targetDefinitions,
        isMultiTarget,
      } = actionWithTargets;

      const actionStartTime = Date.now();

      try {
        // Capture formatting attempt
        trace.captureActionData('formatting', actionDef.id, {
          timestamp: actionStartTime,
          status: 'formatting',
          isMultiTarget,
          hasResolvedTargets: !!resolvedTargets,
          hasTargetDefinitions: !!targetDefinitions,
          targetContextCount: targetContexts?.length || 0,
        });

        // Check if this action has multi-target metadata
        if (isMultiTarget && resolvedTargets && targetDefinitions) {
          stats.multiTarget++;
          let formatterMethod = 'formatMultiTarget';
          let fallbackUsed = false;

          // Process as multi-target action
          if (this.#commandFormatter.formatMultiTarget) {
            const formatResult = this.#commandFormatter.formatMultiTarget(
              actionDef,
              resolvedTargets,
              this.#entityManager,
              formatterOptions,
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

              for (const command of commands) {
                const targetIds = this.#extractTargetIds(resolvedTargets);
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
                };
                formattedActions.push(actionInfo);
              }
              stats.successful++;
            } else {
              // Multi-target formatting failed, try fallback to legacy formatting
              fallbackUsed = true;
              const primaryTarget =
                this.#getPrimaryTargetContext(resolvedTargets);
              if (primaryTarget) {
                const fallbackResult = this.#formatLegacyAction(
                  actionDef,
                  primaryTarget,
                  formatterOptions
                );
                if (fallbackResult.ok) {
                  const actionInfo = {
                    id: actionDef.id,
                    name: actionDef.name,
                    command: fallbackResult.value,
                    description: actionDef.description || '',
                    params: { targetId: primaryTarget.entityId },
                  };
                  formattedActions.push(actionInfo);
                  stats.successful++;
                } else {
                  stats.failed++;
                  errors.push(
                    this.#createError(
                      fallbackResult,
                      actionDef,
                      actor.id,
                      trace,
                      primaryTarget.entityId
                    )
                  );
                }
              } else {
                stats.failed++;
                errors.push(
                  this.#createError(formatResult, actionDef, actor.id, trace)
                );
              }
            }
          } else {
            // Fallback to legacy formatting for first target
            fallbackUsed = true;
            formatterMethod = 'format';
            const primaryTarget =
              this.#getPrimaryTargetContext(resolvedTargets);
            if (primaryTarget) {
              const formatResult = this.#formatLegacyAction(
                actionDef,
                primaryTarget,
                formatterOptions
              );
              if (formatResult.ok) {
                const actionInfo = {
                  id: actionDef.id,
                  name: actionDef.name,
                  command: formatResult.value,
                  description: actionDef.description || '',
                  params: { targetId: primaryTarget.entityId },
                };
                formattedActions.push(actionInfo);
                stats.successful++;
              } else {
                stats.failed++;
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
              stats.failed++;
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

          const actionEndTime = Date.now();

          // Capture formatting completion
          trace.captureActionData('formatting', actionDef.id, {
            timestamp: actionEndTime,
            status: stats.failed > 0 ? 'failed' : 'completed',
            formatterMethod,
            fallbackUsed,
            performance: {
              duration: actionEndTime - actionStartTime,
            },
          });
        } else {
          // Process as legacy action
          stats.legacy++;
          let successCount = 0;
          let failureCount = 0;

          for (const targetContext of targetContexts) {
            try {
              const formatResult = this.#formatLegacyAction(
                actionDef,
                targetContext,
                formatterOptions
              );

              if (formatResult.ok) {
                const actionInfo = {
                  id: actionDef.id,
                  name: actionDef.name,
                  command: formatResult.value,
                  description: actionDef.description || '',
                  params: { targetId: targetContext.entityId },
                };
                formattedActions.push(actionInfo);
                successCount++;
              } else {
                failureCount++;
                errors.push(
                  this.#createError(
                    formatResult,
                    actionDef,
                    actor.id,
                    trace,
                    targetContext.entityId
                  )
                );
              }
            } catch (error) {
              failureCount++;
              errors.push(
                this.#createError(
                  error,
                  actionDef,
                  actor.id,
                  trace,
                  targetContext.entityId
                )
              );
            }
          }

          if (successCount > 0) stats.successful++;
          if (failureCount > 0) stats.failed++;

          const actionEndTime = Date.now();

          // Capture formatting completion
          trace.captureActionData('formatting', actionDef.id, {
            timestamp: actionEndTime,
            status: failureCount > 0 ? 'partial' : 'completed',
            formatterMethod: 'format',
            fallbackUsed: false,
            successCount,
            failureCount,
            performance: {
              duration: actionEndTime - actionStartTime,
            },
          });
        }
      } catch (error) {
        stats.failed++;
        const actionEndTime = Date.now();

        // Capture error
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

    stats.perActionMetadata = stats.multiTarget + stats.legacy;

    trace?.info(
      `Action formatting completed: ${formattedActions.length} formatted actions, ${errors.length} errors`,
      source
    );

    return PipelineResult.success({
      actions: formattedActions,
      errors,
    });
  }

  /**
   * Format actions based on their individual metadata
   *
   * @param context
   * @param trace
   * @private
   */
  async #formatActionsWithPerActionMetadata(context, trace) {
    const { actor, actionsWithTargets = [] } = context;
    const source = `${this.name}Stage.execute`;
    const formattedActions = [];
    const errors = [];

    // Options are identical for all targets; compute once for reuse
    const formatterOptions = {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };

    for (const actionWithTargets of actionsWithTargets) {
      const {
        actionDef,
        targetContexts,
        resolvedTargets,
        targetDefinitions,
        isMultiTarget,
      } = actionWithTargets;

      try {
        // Check if this action has multi-target metadata
        if (isMultiTarget && resolvedTargets && targetDefinitions) {
          // Process as multi-target action
          if (this.#commandFormatter.formatMultiTarget) {
            const formatResult = this.#commandFormatter.formatMultiTarget(
              actionDef,
              resolvedTargets,
              this.#entityManager,
              formatterOptions,
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

              for (const command of commands) {
                const targetIds = this.#extractTargetIds(resolvedTargets);
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
                };
                formattedActions.push(actionInfo);
              }
            } else {
              // Multi-target formatting failed, try fallback to legacy formatting
              const primaryTarget =
                this.#getPrimaryTargetContext(resolvedTargets);
              if (primaryTarget) {
                const fallbackResult = this.#formatLegacyAction(
                  actionDef,
                  primaryTarget,
                  formatterOptions
                );
                if (fallbackResult.ok) {
                  const actionInfo = {
                    id: actionDef.id,
                    name: actionDef.name,
                    command: fallbackResult.value,
                    description: actionDef.description || '',
                    params: { targetId: primaryTarget.entityId },
                  };
                  formattedActions.push(actionInfo);
                } else {
                  errors.push(
                    this.#createError(
                      fallbackResult,
                      actionDef,
                      actor.id,
                      trace,
                      primaryTarget.entityId
                    )
                  );
                }
              } else {
                errors.push(
                  this.#createError(formatResult, actionDef, actor.id, trace)
                );
              }
            }
          } else {
            // Fallback to legacy formatting for first target
            const primaryTarget =
              this.#getPrimaryTargetContext(resolvedTargets);
            if (primaryTarget) {
              const formatResult = this.#formatLegacyAction(
                actionDef,
                primaryTarget,
                formatterOptions
              );
              if (formatResult.ok) {
                const actionInfo = {
                  id: actionDef.id,
                  name: actionDef.name,
                  command: formatResult.value,
                  description: actionDef.description || '',
                  params: { targetId: primaryTarget.entityId },
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
        } else {
          // Process as legacy action
          for (const targetContext of targetContexts) {
            try {
              const formatResult = this.#formatLegacyAction(
                actionDef,
                targetContext,
                formatterOptions
              );

              if (formatResult.ok) {
                const actionInfo = {
                  id: actionDef.id,
                  name: actionDef.name,
                  command: formatResult.value,
                  description: actionDef.description || '',
                  params: { targetId: targetContext.entityId },
                };
                formattedActions.push(actionInfo);
              } else {
                errors.push(
                  this.#createError(
                    formatResult,
                    actionDef,
                    actor.id,
                    trace,
                    targetContext.entityId
                  )
                );
              }
            } catch (error) {
              errors.push(
                this.#createError(
                  error,
                  actionDef,
                  actor.id,
                  trace,
                  targetContext.entityId
                )
              );
            }
          }
        }
      } catch (error) {
        errors.push(this.#createError(error, actionDef, actor.id, trace));
      }
    }

    trace?.info(
      `Action formatting completed: ${formattedActions.length} formatted actions, ${errors.length} errors`,
      source
    );

    return PipelineResult.success({
      actions: formattedActions,
      errors,
    });
  }

  /**
   * Format a single legacy action
   *
   * @param actionDef
   * @param targetContext
   * @param formatterOptions
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
            if (primaryTarget) {
              // Transform action def to use {target} placeholder for legacy formatter compatibility
              const fallbackActionDef = {
                ...actionDef,
                template: this.#transformTemplateForLegacyFallback(
                  actionDef.template,
                  targetDefinitions
                ),
              };

              formattingResult = this.#commandFormatter.format(
                fallbackActionDef,
                primaryTarget,
                this.#entityManager,
                {
                  logger: this.#logger,
                  debug: true,
                  safeEventDispatcher: this.#safeEventDispatcher,
                },
                { displayNameFn: this.#getEntityDisplayNameFn }
              );
            }
          }
        } else {
          // Direct fallback to legacy
          fallbackUsed = true;
          const primaryTarget = this.#getPrimaryTargetContext(resolvedTargets);
          if (primaryTarget) {
            formattingResult = this.#commandFormatter.format(
              actionDef,
              primaryTarget,
              this.#entityManager,
              {
                logger: this.#logger,
                debug: true,
                safeEventDispatcher: this.#safeEventDispatcher,
              },
              { displayNameFn: this.#getEntityDisplayNameFn }
            );
          }
        }

        // Process results
        if (formattingResult && formattingResult.ok) {
          const commands = Array.isArray(formattingResult.value)
            ? formattingResult.value
            : [formattingResult.value];

          for (const command of commands) {
            const targetIds = this.#extractTargetIds(resolvedTargets);
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

            for (const command of commands) {
              const targetIds = this.#extractTargetIds(resolvedTargets);
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
              };
              formattedActions.push(actionInfo);
            }
          } else {
            // Multi-target formatting failed, try fallback to legacy formatting
            const primaryTarget =
              this.#getPrimaryTargetContext(resolvedTargets);
            if (primaryTarget) {
              // Transform action def to use {target} placeholder for legacy formatter compatibility
              const fallbackActionDef = {
                ...actionDef,
                template: this.#transformTemplateForLegacyFallback(
                  actionDef.template,
                  targetDefinitions
                ),
              };

              const fallbackResult = this.#commandFormatter.format(
                fallbackActionDef,
                primaryTarget,
                this.#entityManager,
                {
                  logger: this.#logger,
                  debug: true,
                  safeEventDispatcher: this.#safeEventDispatcher,
                },
                { displayNameFn: this.#getEntityDisplayNameFn }
              );

              if (fallbackResult.ok) {
                const actionInfo = {
                  id: actionDef.id,
                  name: actionDef.name,
                  command: fallbackResult.value,
                  description: actionDef.description || '',
                  params: { targetId: primaryTarget.entityId },
                };
                formattedActions.push(actionInfo);
              } else {
                errors.push(
                  this.#createError(
                    fallbackResult,
                    actionDef,
                    actor.id,
                    trace,
                    primaryTarget.entityId
                  )
                );
              }
            } else {
              errors.push(
                this.#createError(formatResult, actionDef, actor.id, trace)
              );
            }
          }
        } else {
          // Fallback to legacy formatting for first target of each type
          const primaryTarget = this.#getPrimaryTargetContext(resolvedTargets);
          if (primaryTarget) {
            const formatResult = this.#commandFormatter.format(
              actionDef,
              primaryTarget,
              this.#entityManager,
              {
                logger: this.#logger,
                debug: true,
                safeEventDispatcher: this.#safeEventDispatcher,
              },
              { displayNameFn: this.#getEntityDisplayNameFn }
            );

            if (formatResult.ok) {
              const actionInfo = {
                id: actionDef.id,
                name: actionDef.name,
                command: formatResult.value,
                description: actionDef.description || '',
                params: { targetId: primaryTarget.entityId },
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
  async #formatLegacyActionsTraced(context, trace, stats) {
    const { actor, actionsWithTargets = [] } = context;
    const source = `${this.name}Stage.execute`;
    const formattedActions = [];
    const errors = [];

    // Options are identical for all targets; compute once for reuse
    const formatterOptions = {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };

    for (const { actionDef, targetContexts } of actionsWithTargets) {
      const actionStartTime = Date.now();

      // Check if this is actually a multi-target action in legacy path
      const isMultiTargetAction =
        actionDef.targets && typeof actionDef.targets === 'object';

      // Legacy actions are already captured in executeWithTracing, but capture additional details here
      trace.captureActionData('formatting', actionDef.id, {
        timestamp: actionStartTime,
        status: 'formatting',
        formattingPath: 'legacy',
        isMultiTargetInLegacy: isMultiTargetAction,
        targetContextCount: targetContexts.length,
      });

      if (isMultiTargetAction) {
        // Handle multi-target action in legacy path
        const actionSpecificTargets = this.#extractTargetsFromContexts(
          targetContexts,
          actionDef
        );

        if (
          actionSpecificTargets &&
          Object.keys(actionSpecificTargets).length > 0
        ) {
          // Try multi-target formatting if available
          if (this.#commandFormatter.formatMultiTarget) {
            const formatResult = this.#commandFormatter.formatMultiTarget(
              actionDef,
              actionSpecificTargets,
              this.#entityManager,
              formatterOptions,
              {
                displayNameFn: this.#getEntityDisplayNameFn,
                targetDefinitions: actionDef.targets,
              }
            );

            if (formatResult.ok) {
              const commands = Array.isArray(formatResult.value)
                ? formatResult.value
                : [formatResult.value];

              for (const command of commands) {
                const targetIds = this.#extractTargetIds(actionSpecificTargets);
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
                };
                formattedActions.push(actionInfo);
              }
              stats.successful++;
              stats.multiTarget++;
            } else if (targetContexts.length > 0) {
              // Fallback to first target
              const fallbackResult = this.#commandFormatter.format(
                actionDef,
                targetContexts[0],
                this.#entityManager,
                formatterOptions,
                { displayNameFn: this.#getEntityDisplayNameFn }
              );

              if (fallbackResult.ok) {
                const actionInfo = {
                  id: actionDef.id,
                  name: actionDef.name,
                  command: fallbackResult.value,
                  description: actionDef.description || '',
                  params: { targetId: targetContexts[0].entityId },
                };
                formattedActions.push(actionInfo);
                stats.successful++;
                stats.legacy++;
              } else {
                stats.failed++;
                errors.push(
                  this.#createError(
                    fallbackResult,
                    actionDef,
                    actor.id,
                    trace,
                    targetContexts[0].entityId
                  )
                );
              }
            }
          } else {
            // Fallback to legacy formatting with first target
            if (targetContexts.length > 0) {
              const fallbackResult = this.#commandFormatter.format(
                actionDef,
                targetContexts[0],
                this.#entityManager,
                formatterOptions,
                { displayNameFn: this.#getEntityDisplayNameFn }
              );

              if (fallbackResult.ok) {
                const actionInfo = {
                  id: actionDef.id,
                  name: actionDef.name,
                  command: fallbackResult.value,
                  description: actionDef.description || '',
                  params: { targetId: targetContexts[0].entityId },
                };
                formattedActions.push(actionInfo);
                stats.successful++;
                stats.legacy++;
              } else {
                stats.failed++;
                errors.push(
                  this.#createError(
                    fallbackResult,
                    actionDef,
                    actor.id,
                    trace,
                    targetContexts[0].entityId
                  )
                );
              }
            }
          }
        } else {
          // Multi-target action without proper resolved targets - skip and warn
          this.#logger.warn(
            `Skipping multi-target action '${actionDef.id}' in legacy formatting ` +
              `path - no resolved targets available for proper formatting`
          );
        }
      } else {
        // Process regular legacy actions
        let successCount = 0;
        let failureCount = 0;

        for (const targetContext of targetContexts) {
          try {
            const formatResult = this.#commandFormatter.format(
              actionDef,
              targetContext,
              this.#entityManager,
              formatterOptions,
              { displayNameFn: this.#getEntityDisplayNameFn }
            );

            if (formatResult.ok) {
              const actionInfo = {
                id: actionDef.id,
                name: actionDef.name,
                command: formatResult.value,
                description: actionDef.description || '',
                params: { targetId: targetContext.entityId },
              };
              formattedActions.push(actionInfo);
              successCount++;
            } else {
              failureCount++;
              this.#logger.warn(
                `Failed to format command for action '${actionDef.id}' with target '${targetContext.entityId}'`,
                { formatResult, actionDef, targetContext }
              );
              errors.push(
                this.#createError(
                  formatResult,
                  actionDef,
                  actor.id,
                  trace,
                  targetContext.entityId
                )
              );
            }
          } catch (error) {
            failureCount++;
            const targetId =
              error?.target?.entityId ||
              error?.entityId ||
              targetContext.entityId;
            this.#logger.warn(
              `Failed to format command for action '${actionDef.id}' with target '${targetId}'`,
              { error, actionDef, targetContext }
            );
            errors.push(
              this.#createError(
                error,
                actionDef,
                actor.id,
                trace,
                null,
                targetContext.entityId
              )
            );
          }
        }

        if (successCount > 0) {
          stats.successful++;
          stats.legacy++;
        }
        if (failureCount > 0) stats.failed++;

        const actionEndTime = Date.now();

        // Capture completion
        trace.captureActionData('formatting', actionDef.id, {
          timestamp: actionEndTime,
          status: failureCount > 0 ? 'partial' : 'completed',
          formatterMethod: 'format',
          successCount,
          failureCount,
          performance: {
            duration: actionEndTime - actionStartTime,
          },
        });
      }
    }

    this.#logger.debug(
      `Action formatting complete: ${formattedActions.length} actions formatted successfully`
    );

    trace?.info(
      `Action formatting completed: ${formattedActions.length} formatted actions, ${errors.length} errors`,
      source
    );

    return PipelineResult.success({
      actions: formattedActions,
      errors,
    });
  }

  /**
   * Format actions using legacy approach (existing implementation)
   *
   * @param context
   * @param trace
   * @private
   */
  async #formatLegacyActions(context, trace) {
    const { actor, actionsWithTargets = [] } = context;
    const source = `${this.name}Stage.execute`;

    const formattedActions = [];
    const errors = [];

    // Options are identical for all targets; compute once for reuse
    const formatterOptions = {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };

    // Process each action with its targets
    for (const { actionDef, targetContexts } of actionsWithTargets) {
      // Check if this is a multi-target action being processed through legacy path
      const isMultiTargetAction =
        actionDef.targets && typeof actionDef.targets === 'object';

      if (isMultiTargetAction) {
        // Handle multi-target action individually when in mixed mode
        // Extract resolved targets from targetContexts for this specific action
        const actionSpecificTargets = this.#extractTargetsFromContexts(
          targetContexts,
          actionDef
        );

        if (
          actionSpecificTargets &&
          Object.keys(actionSpecificTargets).length > 0
        ) {
          // Try to format using multi-target formatter if available
          if (this.#commandFormatter.formatMultiTarget) {
            const formatResult = this.#commandFormatter.formatMultiTarget(
              actionDef,
              actionSpecificTargets,
              this.#entityManager,
              formatterOptions,
              {
                displayNameFn: this.#getEntityDisplayNameFn,
                targetDefinitions: actionDef.targets, // Pass the target definitions
              }
            );

            if (formatResult.ok) {
              const commands = Array.isArray(formatResult.value)
                ? formatResult.value
                : [formatResult.value];

              for (const command of commands) {
                const targetIds = this.#extractTargetIds(actionSpecificTargets);
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
                };
                formattedActions.push(actionInfo);
              }
            } else {
              // Fallback to legacy formatting with first target
              if (targetContexts.length > 0) {
                const fallbackResult = this.#commandFormatter.format(
                  actionDef,
                  targetContexts[0],
                  this.#entityManager,
                  formatterOptions,
                  { displayNameFn: this.#getEntityDisplayNameFn }
                );

                if (fallbackResult.ok) {
                  const actionInfo = {
                    id: actionDef.id,
                    name: actionDef.name,
                    command: fallbackResult.value,
                    description: actionDef.description || '',
                    params: { targetId: targetContexts[0].entityId },
                  };
                  formattedActions.push(actionInfo);
                } else {
                  errors.push(
                    this.#createError(
                      fallbackResult,
                      actionDef,
                      actor.id,
                      trace,
                      targetContexts[0].entityId
                    )
                  );
                }
              }
            }
          } else {
            // Fallback to legacy formatting with first target
            if (targetContexts.length > 0) {
              const fallbackResult = this.#commandFormatter.format(
                actionDef,
                targetContexts[0],
                this.#entityManager,
                formatterOptions,
                { displayNameFn: this.#getEntityDisplayNameFn }
              );

              if (fallbackResult.ok) {
                const actionInfo = {
                  id: actionDef.id,
                  name: actionDef.name,
                  command: fallbackResult.value,
                  description: actionDef.description || '',
                  params: { targetId: targetContexts[0].entityId },
                };
                formattedActions.push(actionInfo);
              } else {
                errors.push(
                  this.#createError(
                    fallbackResult,
                    actionDef,
                    actor.id,
                    trace,
                    targetContexts[0].entityId
                  )
                );
              }
            }
          }
        } else {
          // Multi-target action without proper resolved targets - skip and warn
          this.#logger.warn(
            `Skipping multi-target action '${actionDef.id}' in legacy formatting ` +
              `path - no resolved targets available for proper formatting`
          );
        }
        continue;
      }

      for (const targetContext of targetContexts) {
        try {
          const formatResult = this.#commandFormatter.format(
            actionDef,
            targetContext,
            this.#entityManager,
            formatterOptions,
            {
              displayNameFn: this.#getEntityDisplayNameFn,
            }
          );

          if (formatResult.ok) {
            const actionInfo = {
              id: actionDef.id,
              name: actionDef.name,
              command: formatResult.value,
              description: actionDef.description || '',
              params: { targetId: targetContext.entityId },
            };
            formattedActions.push(actionInfo);
          } else {
            this.#logger.warn(
              `Failed to format command for action '${actionDef.id}' with target '${targetContext.entityId}'`,
              { formatResult, actionDef, targetContext }
            );
            errors.push(
              this.#createError(
                formatResult,
                actionDef,
                actor.id,
                trace,
                targetContext.entityId
              )
            );
          }
        } catch (error) {
          const targetId =
            error?.target?.entityId ||
            error?.entityId ||
            targetContext.entityId;
          this.#logger.warn(
            `Failed to format command for action '${actionDef.id}' with target '${targetId}'`,
            { error, actionDef, targetContext }
          );
          errors.push(
            this.#createError(
              error,
              actionDef,
              actor.id,
              trace,
              null,
              targetContext.entityId
            )
          );
        }
      }
    }

    this.#logger.debug(
      `Action formatting complete: ${formattedActions.length} actions formatted successfully`
    );

    trace?.info(
      `Action formatting completed: ${formattedActions.length} formatted actions, ${errors.length} errors`,
      source
    );

    return PipelineResult.success({
      actions: formattedActions,
      errors,
    });
  }

  /**
   * Extract target IDs from resolved targets for params
   * Enhanced to use TargetManager for optimized placeholder resolution
   *
   * @param resolvedTargets
   * @private
   */
  #extractTargetIds(resolvedTargets) {
    const targetIds = {};

    // Use optimized approach: if we have a TargetExtractionResult, use O(1) lookups
    if (
      resolvedTargets &&
      typeof resolvedTargets.getEntityIdByPlaceholder === 'function'
    ) {
      // resolvedTargets is already a TargetExtractionResult
      for (const placeholderName of resolvedTargets.getTargetNames()) {
        const entityId =
          resolvedTargets.getEntityIdByPlaceholder(placeholderName);
        if (entityId) {
          targetIds[placeholderName] = [entityId]; // Keep array format for backward compatibility
        }
      }
    } else {
      // Legacy format: preserve all targets in each category
      for (const [key, targets] of Object.entries(resolvedTargets)) {
        targetIds[key] = targets.map((t) => t.id);
      }
    }

    return targetIds;
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
    const targets = {};
    for (const [key, targetList] of Object.entries(resolvedTargets)) {
      if (Array.isArray(targetList) && targetList.length > 0) {
        targets[key] = targetList[0].id; // Take first target from each category
      }
    }

    // Use existing factory method to create TargetExtractionResult
    return TargetExtractionResult.fromResolvedParameters(
      {
        isMultiTarget: Object.keys(targets).length > 1,
        targetIds: Object.keys(targets).length > 0 ? targets : undefined,
      },
      this.#logger
    );
  }

  /**
   * Get primary target context for fallback formatting
   *
   * @param resolvedTargets
   * @private
   */
  #getPrimaryTargetContext(resolvedTargets) {
    // Find first target from primary or first available target type
    const primaryTargets =
      resolvedTargets.primary || Object.values(resolvedTargets)[0];
    if (!primaryTargets || primaryTargets.length === 0) return null;

    const target = primaryTargets[0];
    // Create a proper ActionTargetContext for the base formatter
    return {
      type: 'entity',
      entityId: target.id,
      displayName: target.displayName,
    };
  }

  /**
   * Transform multi-target template to use {target} placeholder for legacy formatter
   *
   * @param template
   * @param targetDefinitions
   * @private
   */
  #transformTemplateForLegacyFallback(template, targetDefinitions) {
    if (!targetDefinitions) return template;

    let transformedTemplate = template;

    // Replace primary target placeholder with {target}
    const primaryDef = targetDefinitions.primary;
    if (primaryDef?.placeholder) {
      const placeholderRegex = new RegExp(
        `\\{${primaryDef.placeholder}\\}`,
        'g'
      );
      transformedTemplate = transformedTemplate.replace(
        placeholderRegex,
        '{target}'
      );
    }

    // Remove other placeholders that can't be handled by legacy formatter
    for (const [key, def] of Object.entries(targetDefinitions)) {
      if (key !== 'primary' && def?.placeholder) {
        const placeholderRegex = new RegExp(`\\{${def.placeholder}\\}`, 'g');
        transformedTemplate = transformedTemplate.replace(placeholderRegex, '');
      }
    }

    return transformedTemplate.trim().replace(/\s+/g, ' '); // Clean up extra spaces
  }

  /**
   * Extract targets from target contexts for a specific action
   *
   * @param {Array} targetContexts - Array of target contexts
   * @param {object} actionDef - Action definition
   * @returns {object} Targets object in multi-target format
   * @private
   */
  #extractTargetsFromContexts(targetContexts, actionDef) {
    if (!targetContexts || targetContexts.length === 0) {
      return {};
    }

    // Group target contexts by their placeholder (if available)
    const targetsByPlaceholder = {};

    // First pass: group by placeholder if available
    for (const tc of targetContexts) {
      const placeholder = tc.placeholder || 'primary'; // Default to primary if no placeholder

      if (!targetsByPlaceholder[placeholder]) {
        targetsByPlaceholder[placeholder] = [];
      }

      targetsByPlaceholder[placeholder].push({
        id: tc.entityId,
        displayName: tc.displayName || tc.entityId,
        entity: tc.entityId
          ? this.#entityManager.getEntityInstance(tc.entityId)
          : null,
        contextFromId: tc.contextFromId, // Preserve context relationship
      });
    }

    // If we have target definitions, validate against them
    if (actionDef.targets && typeof actionDef.targets === 'object') {
      const expectedTargets = Object.keys(actionDef.targets);

      // Check if we have all required targets
      for (const targetKey of expectedTargets) {
        const targetDef = actionDef.targets[targetKey];
        const placeholder = targetDef.placeholder || targetKey;

        if (
          !targetsByPlaceholder[placeholder] ||
          targetsByPlaceholder[placeholder].length === 0
        ) {
          // If we don't have this target type, this action is not available
          this.#logger.debug(
            `Missing required target '${targetKey}' for action '${actionDef.id}'`
          );
          return {};
        }
      }
    }

    return targetsByPlaceholder;
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
    // Handle both error strings and format result objects
    let error, formatDetails;
    if (typeof errorOrResult === 'object' && errorOrResult.error) {
      // Format result object with error and optional details
      error = errorOrResult.error;
      formatDetails = errorOrResult.details;
    } else {
      // Direct error (string or Error object)
      error = errorOrResult;
    }

    // Extract target ID from error object if available, with fallback order:
    // 1. Explicitly provided targetId
    // 2. Error object properties (target.entityId, entityId)
    // 3. Fallback target ID (from original context)
    // 4. No target ID
    const extractedTargetId =
      targetId ||
      error?.target?.entityId ||
      error?.entityId ||
      fallbackTargetId ||
      null;

    // Build additional context based on error type
    let additionalContext = {
      stage: 'action_formatting',
    };

    // Add error-specific context
    if (formatDetails) {
      additionalContext.formatDetails = formatDetails;
    } else if (error instanceof Error && !formatDetails) {
      additionalContext.thrown = true;
    }

    return this.#errorContextBuilder.buildErrorContext({
      error,
      actionDef,
      actorId,
      phase: ERROR_PHASES.VALIDATION,
      trace,
      targetId: extractedTargetId,
      additionalContext,
    });
  }
}

export default ActionFormattingStage;
