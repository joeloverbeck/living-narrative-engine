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
   * Executes the action formatting stage
   *
   * @param {object} context - The pipeline context
   * @param {import('../../../entities/entity.js').default} context.actor - The actor entity
   * @param {Array<{actionDef: import('../../../interfaces/IGameDataRepository.js').ActionDefinition, targetContexts: import('../../../models/actionTargetContext.js').ActionTargetContext[]}>} context.actionsWithTargets - Actions with their targets
   * @param {import('../../tracing/traceContext.js').TraceContext} [context.trace] - Optional trace context
   * @returns {Promise<PipelineResult>} Formatted actions
   */
  async execute(context) {
    const { actor, actionsWithTargets = [], trace } = context;
    const source = `${this.name}Stage.execute`;

    trace?.step(
      `Formatting ${actionsWithTargets.length} actions with their targets`,
      source
    );

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
            const errorContext = this.#errorContextBuilder.buildErrorContext({
              error: formatResult.error,
              actionDef,
              actorId: actor.id,
              phase: ERROR_PHASES.VALIDATION,
              trace,
              targetId: targetContext.entityId,
              additionalContext: {
                stage: 'action_formatting',
                formatDetails: formatResult.details,
              },
            });

            errors.push(errorContext);

            this.#logger.warn(
              `Failed to format command for action '${actionDef.id}' with target '${targetContext.entityId}'.`,
              errorContext
            );
          }
        } catch (error) {
          // Handle thrown errors (e.g., from mocked formatters in tests)
          // Extract targetId from error properties if available
          let targetId = targetContext.entityId;
          if (error.target?.entityId) {
            targetId = error.target.entityId;
          } else if (error.entityId) {
            targetId = error.entityId;
          }

          const errorContext = this.#errorContextBuilder.buildErrorContext({
            error,
            actionDef,
            actorId: actor.id,
            phase: ERROR_PHASES.VALIDATION,
            trace,
            targetId,
            additionalContext: {
              stage: 'action_formatting',
              thrown: true,
            },
          });

          errors.push(errorContext);

          this.#logger.warn(
            `Failed to format command for action '${actionDef.id}' with target '${targetId}'.`,
            errorContext
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
}

export default ActionFormattingStage;
