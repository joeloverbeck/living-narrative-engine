/**
 * @file Stage for formatting resolved actions
 * @see ../PipelineStage.js
 */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';
import { ERROR_PHASES } from '../../errors/actionErrorTypes.js';

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
   * @param {import('../../tracing/traceContext.js').TraceContext|import('../../tracing/structuredTrace.js').StructuredTrace} [context.trace] - Optional trace context
   * @returns {Promise<PipelineResult>} Formatted actions
   */
  async executeInternal(context) {
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
        'Multi-target actions detected but no resolvedTargets/targetDefinitions provided. ' +
          'This may result in incorrect formatting.'
      );
    }

    // Process legacy format actions
    return this.#formatLegacyActions(context, trace);
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
              const actionInfo = {
                id: actionDef.id,
                name: actionDef.name,
                command: command,
                description: actionDef.description || '',
                params: {
                  targetIds: this.#extractTargetIds(resolvedTargets),
                  isMultiTarget: true,
                },
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
                const actionInfo = {
                  id: actionDef.id,
                  name: actionDef.name,
                  command: command,
                  description: actionDef.description || '',
                  params: {
                    targetIds: this.#extractTargetIds(actionSpecificTargets),
                    isMultiTarget: true,
                  },
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
   *
   * @param resolvedTargets
   * @private
   */
  #extractTargetIds(resolvedTargets) {
    const targetIds = {};
    for (const [key, targets] of Object.entries(resolvedTargets)) {
      targetIds[key] = targets.map((t) => t.id);
    }
    return targetIds;
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
