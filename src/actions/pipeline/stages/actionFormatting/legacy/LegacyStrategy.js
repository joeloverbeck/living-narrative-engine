/**
 * @file Legacy formatting strategy implementation
 */

import { PipelineResult } from '../../../PipelineResult.js';

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
 * @typedef {import('../../../../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext
 */
/**
 * @typedef {import('../../../../../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition
 */

/**
 * @description Formats actions using the legacy path while preserving existing side effects.
 */
export class LegacyStrategy {
  #commandFormatter;
  #entityManager;
  #safeEventDispatcher;
  #getEntityDisplayNameFn;
  #logger;
  #fallbackFormatter;
  #createError;
  #targetNormalizationService;
  #validateVisualProperties;

  /**
   * @param {object} deps
   * @param {IActionCommandFormatter} deps.commandFormatter - Command formatter dependency
   * @param {EntityManager} deps.entityManager - Entity manager reference
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher for formatter side effects
   * @param {Function} deps.getEntityDisplayNameFn - Helper to resolve entity display names
   * @param {import('../../../../../logging/consoleLogger.js').default} deps.logger - Logger instance
   * @param {import('./LegacyFallbackFormatter.js').LegacyFallbackFormatter} deps.fallbackFormatter - Legacy fallback formatter
   * @param {Function} deps.createError - Factory to build structured errors
   * @param {import('../TargetNormalizationService.js').TargetNormalizationService} deps.targetNormalizationService - Target normalisation service
   * @param {Function} deps.validateVisualProperties - Visual validation helper
   * @description Creates a new legacy formatting strategy.
   */
  constructor({
    commandFormatter,
    entityManager,
    safeEventDispatcher,
    getEntityDisplayNameFn,
    logger,
    fallbackFormatter,
    createError,
    targetNormalizationService,
    validateVisualProperties,
  }) {
    this.#commandFormatter = commandFormatter;
    this.#entityManager = entityManager;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#getEntityDisplayNameFn = getEntityDisplayNameFn;
    this.#logger = logger;
    this.#fallbackFormatter = fallbackFormatter;
    this.#createError = createError;
    this.#targetNormalizationService = targetNormalizationService;
    this.#validateVisualProperties = validateVisualProperties;
  }

  /**
   * @param {object} params
   * @param {import('../../../../../entities/entity.js').default} params.actor - Actor performing the actions
   * @param {Array<{actionDef: ActionDefinition, targetContexts: ActionTargetContext[]}>} params.actionsWithTargets - Actions and contexts
   * @param {import('../../../../tracing/actionAwareStructuredTrace.js').default|import('../../../../tracing/traceContext.js').TraceContext|import('../../../../tracing/structuredTrace.js').StructuredTrace|undefined} params.trace - Trace adapter
   * @param {object|undefined} params.processingStats - Mutable statistics accumulator from the stage
   * @param {string} params.traceSource - Source label for trace logging
   * @returns {Promise<{ formattedCommands: Array, errors: Array, fallbackUsed: boolean, statistics: { formatted: number, errors: number, fallbackInvocations: number }, pipelineResult: PipelineResult }>} Outcome information
   * @description Formats actions with or without tracing support.
   */
  async format({
    actor,
    actionsWithTargets = [],
    trace,
    processingStats,
    traceSource,
  }) {
    const formatterOptions = this.#buildFormatterOptions();
    const isActionAwareTrace =
      trace && typeof trace.captureActionData === 'function';

    if (isActionAwareTrace) {
      return this.#formatTraced({
        actor,
        actionsWithTargets,
        trace,
        formatterOptions,
        processingStats,
        traceSource,
      });
    }

    return this.#formatStandard({
      actor,
      actionsWithTargets,
      trace,
      formatterOptions,
      traceSource,
    });
  }

  /**
   * @returns {object}
   * @description Generates formatter options for legacy execution.
   */
  #buildFormatterOptions() {
    return {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };
  }

  /**
   * @param {object} params
   * @param {import('../../../../../entities/entity.js').default} params.actor
   * @param {Array<{actionDef: ActionDefinition, targetContexts: ActionTargetContext[]}>} params.actionsWithTargets
   * @param {import('../../../../tracing/actionAwareStructuredTrace.js').default} params.trace
   * @param {object} params.formatterOptions
   * @param {object|undefined} params.processingStats
   * @param {string} params.traceSource
   * @returns {Promise<{ formattedCommands: Array, errors: Array, fallbackUsed: boolean, statistics: { formatted: number, errors: number, fallbackInvocations: number }, pipelineResult: PipelineResult }>}
   * @description Formats actions while emitting action-aware trace events.
   */
  async #formatTraced({
    actor,
    actionsWithTargets,
    trace,
    formatterOptions,
    processingStats,
    traceSource,
  }) {
    const formattedActions = [];
    const errors = [];
    let fallbackInvocations = 0;

    for (const { actionDef, targetContexts } of actionsWithTargets) {
      const actionStartTime = Date.now();

      this.#validateVisualProperties(actionDef.visual, actionDef.id);

      const isMultiTargetAction =
        actionDef.targets && typeof actionDef.targets === 'object';

      trace.captureActionData('formatting', actionDef.id, {
        timestamp: actionStartTime,
        status: 'formatting',
        formattingPath: 'legacy',
        isMultiTargetInLegacy: isMultiTargetAction,
        targetContextCount: targetContexts.length,
      });

      if (isMultiTargetAction) {
        const actionSpecificTargets = this.#extractTargetsFromContexts(
          targetContexts,
          actionDef
        );

        if (
          actionSpecificTargets &&
          Object.keys(actionSpecificTargets).length > 0
        ) {
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

              for (const commandData of commands) {
                const command =
                  typeof commandData === 'string'
                    ? commandData
                    : commandData.command;
                const specificTargets =
                  typeof commandData === 'object' && commandData.targets
                    ? commandData.targets
                    : actionSpecificTargets;

                const normalizationResult =
                  this.#targetNormalizationService.normalize({
                    resolvedTargets: specificTargets,
                    isMultiTarget: true,
                  });

                if (normalizationResult.error) {
                  errors.push(
                    this.#createError(
                      normalizationResult.error,
                      actionDef,
                      actor.id,
                      trace
                    )
                  );
                  continue;
                }

                const params = {
                  ...normalizationResult.params,
                  isMultiTarget: true,
                };

                formattedActions.push({
                  id: actionDef.id,
                  name: actionDef.name,
                  command,
                  description: actionDef.description || '',
                  params,
                  visual: actionDef.visual || null,
                });
              }

              this.#incrementStat(processingStats, 'successful');
              this.#incrementStat(processingStats, 'multiTarget');
            } else if (targetContexts.length > 0) {
              const fallbackResult = this.#fallbackFormatter.formatWithFallback(
                {
                  actionDefinition: actionDef,
                  targetContext: targetContexts[0],
                  formatterOptions,
                  targetDefinitions: actionDef.targets,
                  resolvedTargets: actionSpecificTargets,
                }
              );

              if (fallbackResult.ok) {
                formattedActions.push({
                  id: actionDef.id,
                  name: actionDef.name,
                  command: fallbackResult.value,
                  description: actionDef.description || '',
                  params: targetContexts[0]?.entityId
                    ? { targetId: targetContexts[0].entityId }
                    : {},
                  visual: actionDef.visual || null,
                });
                this.#incrementStat(processingStats, 'successful');
                this.#incrementStat(processingStats, 'legacy');
                fallbackInvocations++;
              } else {
                this.#incrementStat(processingStats, 'failed');
                errors.push(
                  this.#createError(
                    fallbackResult,
                    actionDef,
                    actor.id,
                    trace,
                    targetContexts[0]?.entityId || null
                  )
                );
              }
            }
          } else if (targetContexts.length > 0) {
            const fallbackResult = this.#fallbackFormatter.formatWithFallback({
              actionDefinition: actionDef,
              targetContext: targetContexts[0],
              formatterOptions,
              targetDefinitions: actionDef.targets,
              resolvedTargets: actionSpecificTargets,
            });

            if (fallbackResult.ok) {
              formattedActions.push({
                id: actionDef.id,
                name: actionDef.name,
                command: fallbackResult.value,
                description: actionDef.description || '',
                params: this.#buildFallbackParams(targetContexts[0]),
                visual: actionDef.visual || null,
              });
              this.#incrementStat(processingStats, 'successful');
              this.#incrementStat(processingStats, 'legacy');
              fallbackInvocations++;
            } else {
              this.#incrementStat(processingStats, 'failed');
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
          this.#logger.warn(
            `Skipping multi-target action '${actionDef.id}' in legacy formatting ` +
              `path - no resolved targets available for proper formatting`
          );
        }
      } else {
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
              formattedActions.push({
                id: actionDef.id,
                name: actionDef.name,
                command: formatResult.value,
                description: actionDef.description || '',
                params: { targetId: targetContext.entityId },
                visual: actionDef.visual || null,
              });
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
          this.#incrementStat(processingStats, 'successful');
          this.#incrementStat(processingStats, 'legacy');
        }
        if (failureCount > 0) {
          this.#incrementStat(processingStats, 'failed');
        }

        const actionEndTime = Date.now();
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
      traceSource
    );

    const outcome = {
      formattedCommands: formattedActions,
      errors,
      fallbackUsed: fallbackInvocations > 0,
      statistics: {
        formatted: formattedActions.length,
        errors: errors.length,
        fallbackInvocations,
      },
    };

    return {
      ...outcome,
      pipelineResult: PipelineResult.success({
        actions: formattedActions,
        errors,
      }),
    };
  }

  /**
   * @param {object} params
   * @param {import('../../../../../entities/entity.js').default} params.actor
   * @param {Array<{actionDef: ActionDefinition, targetContexts: ActionTargetContext[]}>} params.actionsWithTargets
   * @param {import('../../../../tracing/structuredTrace.js').StructuredTrace|import('../../../../tracing/traceContext.js').TraceContext|undefined} params.trace
   * @param {object} params.formatterOptions
   * @param {string} params.traceSource
   * @returns {Promise<{ formattedCommands: Array, errors: Array, fallbackUsed: boolean, statistics: { formatted: number, errors: number, fallbackInvocations: number }, pipelineResult: PipelineResult }>}
   * @description Formats actions without action-aware tracing.
   */
  async #formatStandard({
    actor,
    actionsWithTargets,
    trace,
    formatterOptions,
    traceSource,
  }) {
    const formattedActions = [];
    const errors = [];
    let fallbackInvocations = 0;

    for (const { actionDef, targetContexts } of actionsWithTargets) {
      this.#validateVisualProperties(actionDef.visual, actionDef.id);

      const isMultiTargetAction =
        actionDef.targets && typeof actionDef.targets === 'object';

      if (isMultiTargetAction) {
        const actionSpecificTargets = this.#extractTargetsFromContexts(
          targetContexts,
          actionDef
        );

        if (
          actionSpecificTargets &&
          Object.keys(actionSpecificTargets).length > 0
        ) {
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

              for (const commandData of commands) {
                const command =
                  typeof commandData === 'string'
                    ? commandData
                    : commandData.command;
                const specificTargets =
                  typeof commandData === 'object' && commandData.targets
                    ? commandData.targets
                    : actionSpecificTargets;

                const normalizationResult =
                  this.#targetNormalizationService.normalize({
                    resolvedTargets: specificTargets,
                    isMultiTarget: true,
                  });

                if (normalizationResult.error) {
                  errors.push(
                    this.#createError(
                      normalizationResult.error,
                      actionDef,
                      actor.id,
                      trace
                    )
                  );
                  continue;
                }

                const params = {
                  ...normalizationResult.params,
                  isMultiTarget: true,
                };

                formattedActions.push({
                  id: actionDef.id,
                  name: actionDef.name,
                  command,
                  description: actionDef.description || '',
                  params,
                  visual: actionDef.visual || null,
                });
              }
            } else if (targetContexts.length > 0) {
              const fallbackResult = this.#fallbackFormatter.formatWithFallback(
                {
                  actionDefinition: actionDef,
                  targetContext: targetContexts[0],
                  formatterOptions,
                  targetDefinitions: actionDef.targets,
                  resolvedTargets: actionSpecificTargets,
                }
              );

              if (fallbackResult.ok) {
                formattedActions.push({
                  id: actionDef.id,
                  name: actionDef.name,
                  command: fallbackResult.value,
                  description: actionDef.description || '',
                  params: this.#buildFallbackParams(targetContexts[0]),
                  visual: actionDef.visual || null,
                });
                fallbackInvocations++;
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
          } else if (targetContexts.length > 0) {
            const fallbackResult = this.#fallbackFormatter.formatWithFallback({
              actionDefinition: actionDef,
              targetContext: targetContexts[0],
              formatterOptions,
              targetDefinitions: actionDef.targets,
              resolvedTargets: actionSpecificTargets,
            });

            if (fallbackResult.ok) {
              formattedActions.push({
                id: actionDef.id,
                name: actionDef.name,
                command: fallbackResult.value,
                description: actionDef.description || '',
                params: this.#buildFallbackParams(targetContexts[0]),
                visual: actionDef.visual || null,
              });
              fallbackInvocations++;
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
        } else {
          this.#logger.warn(
            `Skipping multi-target action '${actionDef.id}' in legacy formatting path - no resolved targets available for proper formatting`
          );
        }
      } else {
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
              formattedActions.push({
                id: actionDef.id,
                name: actionDef.name,
                command: formatResult.value,
                description: actionDef.description || '',
                params: { targetId: targetContext.entityId },
                visual: actionDef.visual || null,
              });
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
    }

    this.#logger.debug(
      `Action formatting complete: ${formattedActions.length} actions formatted successfully`
    );

    trace?.info(
      `Action formatting completed: ${formattedActions.length} formatted actions, ${errors.length} errors`,
      traceSource
    );

    const outcome = {
      formattedCommands: formattedActions,
      errors,
      fallbackUsed: fallbackInvocations > 0,
      statistics: {
        formatted: formattedActions.length,
        errors: errors.length,
        fallbackInvocations,
      },
    };

    return {
      ...outcome,
      pipelineResult: PipelineResult.success({
        actions: formattedActions,
        errors,
      }),
    };
  }

  /**
   * @param {Array<ActionTargetContext>} targetContexts
   * @param {ActionDefinition} actionDef
   * @returns {Record<string, Array>}
   * @description Builds placeholder keyed resolved targets from contexts.
   */
  #extractTargetsFromContexts(targetContexts, actionDef) {
    if (!targetContexts || targetContexts.length === 0) {
      return {};
    }

    const targetsByPlaceholder = {};

    for (const targetContext of targetContexts) {
      const placeholder = targetContext.placeholder || 'primary';

      if (!targetsByPlaceholder[placeholder]) {
        targetsByPlaceholder[placeholder] = [];
      }

      targetsByPlaceholder[placeholder].push({
        id: targetContext.entityId,
        displayName: targetContext.displayName || targetContext.entityId,
        entity: targetContext.entityId
          ? this.#entityManager.getEntityInstance(targetContext.entityId)
          : null,
        contextFromId: targetContext.contextFromId,
      });
    }

    if (actionDef.targets && typeof actionDef.targets === 'object') {
      const expectedTargets = Object.keys(actionDef.targets);

      for (const targetKey of expectedTargets) {
        const targetDef = actionDef.targets[targetKey];
        const placeholder = targetDef.placeholder || targetKey;

        if (
          !targetsByPlaceholder[placeholder] ||
          targetsByPlaceholder[placeholder].length === 0
        ) {
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
   * @param {ActionTargetContext|undefined|null} targetContext - Target context to extract the entity identifier from.
   * @returns {Record<string, unknown>} Parameters for the fallback formatted action.
   * @description Ensures fallback params omit targetId when no identifier is available.
   */
  #buildFallbackParams(targetContext) {
    const targetId = targetContext?.entityId;

    if (!targetId) {
      return {};
    }

    return { targetId };
  }

  /**
   * @param {object|undefined} stats
   * @param {string} key
   * @description Safely increments statistic counters when provided.
   */
  #incrementStat(stats, key) {
    if (!stats || typeof stats !== 'object') {
      return;
    }

    if (typeof stats[key] !== 'number') {
      stats[key] = 0;
    }

    stats[key] += 1;
  }
}

export default LegacyStrategy;
