// src/actions/actionCandidateProcessorWithResult.js

// ────────────────────────────────────────────────────────────────────────────────
// Type imports
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./validation/prerequisiteEvaluationService.js').PrerequisiteEvaluationService} PrerequisiteEvaluationService */
/** @typedef {import('../interfaces/IActionCommandFormatter.js').IActionCommandFormatter} IActionCommandFormatter */
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./tracing/traceContext.js').TraceContext} TraceContext */
/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../data/gameDataRepository.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo} DiscoveredActionInfo */
/** @typedef {import('./errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */
/** @typedef {import('./errors/actionErrorTypes.js').ActionErrorContext} ActionErrorContext */

// Dependency imports
import { createActionErrorContext } from './utils/discoveryErrorUtils.js';
import { ERROR_PHASES } from './errors/actionErrorTypes.js';
import { ActionResult } from './core/actionResult.js';

/**
 * @typedef {object} ProcessResultData
 * @property {DiscoveredActionInfo[]} actions - Valid discovered actions
 * @property {ActionErrorContext[]} errors - Errors encountered during processing
 * @property {string} [cause] - Optional reason why no actions were produced
 */

/**
 * @class ActionCandidateProcessor
 * @description Processes candidate actions through prerequisite evaluation and target resolution to generate valid action commands.
 * Uses ActionResult pattern for consistent error handling and composable operations.
 */
export class ActionCandidateProcessor {
  #prerequisiteEvaluationService;
  #targetResolutionService;
  #entityManager;
  #commandFormatter;
  #safeEventDispatcher;
  #getEntityDisplayNameFn;
  #logger;
  #actionErrorContextBuilder;

  /**
   * Creates an instance of ActionCandidateProcessor.
   *
   * @param {object} deps - The dependencies object.
   * @param {PrerequisiteEvaluationService} deps.prerequisiteEvaluationService - Service for evaluating action prerequisites.
   * @param {ITargetResolutionService} deps.targetResolutionService - Service for resolving action targets.
   * @param {EntityManager} deps.entityManager - Manager for entity operations.
   * @param {IActionCommandFormatter} deps.actionCommandFormatter - Service used to format action commands.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher for error handling.
   * @param {Function} deps.getEntityDisplayNameFn - Function to get entity display names.
   * @param {ILogger} deps.logger - Logger instance for diagnostic output.
   * @param {ActionErrorContextBuilder} deps.actionErrorContextBuilder - Service for building enhanced error context.
   */
  constructor({
    prerequisiteEvaluationService,
    targetResolutionService,
    entityManager,
    actionCommandFormatter,
    safeEventDispatcher,
    getEntityDisplayNameFn,
    logger,
    actionErrorContextBuilder,
  }) {
    this.#prerequisiteEvaluationService = prerequisiteEvaluationService;
    this.#targetResolutionService = targetResolutionService;
    this.#entityManager = entityManager;
    this.#commandFormatter = actionCommandFormatter;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#getEntityDisplayNameFn = getEntityDisplayNameFn;
    this.#logger = logger;
    this.#actionErrorContextBuilder = actionErrorContextBuilder;
  }

  /**
   * Processes a candidate action definition and returns ActionResult.
   *
   * @param {ActionDefinition} actionDef - The action definition to process.
   * @param {Entity} actorEntity - The entity performing the action.
   * @param {ActionContext} context - The action discovery context.
   * @param {TraceContext} [trace] - Optional trace context for logging.
   * @returns {ActionResult} Result containing valid actions and errors.
   */
  process(actionDef, actorEntity, context, trace = null) {
    // Support both old and new trace APIs
    if (trace?.withSpan) {
      return trace.withSpan(
        'candidate.process',
        () => {
          return this.#processInternal(actionDef, actorEntity, context, trace);
        },
        {
          actionId: actionDef.id,
          actorId: actorEntity.id,
          scope: actionDef.scope,
        }
      );
    }

    // Fallback to original implementation for backward compatibility
    return this.#processInternal(actionDef, actorEntity, context, trace);
  }

  /**
   * Internal implementation of candidate processing logic.
   *
   * @private
   * @param {ActionDefinition} actionDef - The action definition to process.
   * @param {Entity} actorEntity - The entity performing the action.
   * @param {ActionContext} context - The action discovery context.
   * @param {TraceContext} [trace] - Optional trace context for logging.
   * @returns {ActionResult} Result containing valid actions and errors.
   */
  #processInternal(actionDef, actorEntity, context, trace = null) {
    const source = 'ActionCandidateProcessor.process';
    trace?.step(`Processing candidate action: '${actionDef.id}'`, source);

    // STEP 1: Check actor prerequisites
    const prereqResult = this.#checkActorPrerequisites(
      actionDef,
      actorEntity,
      trace
    );

    if (!prereqResult.success) {
      const errors = [];
      if (prereqResult.errors) {
        for (const err of prereqResult.errors) {
          // If error is already an ActionErrorContext, use it directly
          if (err.timestamp && err.phase) {
            errors.push(createActionErrorContext(err));
          } else {
            // Build error context for raw errors
            const errorContext =
              this.#actionErrorContextBuilder.buildErrorContext({
                error: err,
                actionDef,
                actorId: actorEntity.id,
                phase: ERROR_PHASES.VALIDATION,
                trace,
              });
            errors.push(createActionErrorContext(errorContext));
          }
        }
      }
      return ActionResult.success({
        actions: [],
        errors,
        cause: 'prerequisite-error',
      });
    }

    if (!prereqResult.value) {
      trace?.failure(
        `Action '${actionDef.id}' discarded due to failed actor prerequisites.`,
        source
      );
      return ActionResult.success({
        actions: [],
        errors: [],
        cause: 'prerequisites-failed',
      });
    }

    trace?.success(
      `Action '${actionDef.id}' passed actor prerequisite check.`,
      source
    );

    // STEP 2: Resolve targets using the dedicated service
    const targetResult = this.#resolveTargets(
      actionDef,
      actorEntity,
      context,
      trace
    );

    if (!targetResult.success) {
      const errors = [];
      if (targetResult.errors) {
        for (const err of targetResult.errors) {
          // If error is already an ActionErrorContext, use it directly
          if (err.timestamp && err.phase) {
            errors.push(createActionErrorContext(err));
          } else {
            // Build error context for raw errors
            const errorContext =
              this.#actionErrorContextBuilder.buildErrorContext({
                error: err,
                actionDef,
                actorId: actorEntity.id,
                phase: ERROR_PHASES.VALIDATION,
                trace,
                additionalContext: {
                  scope: actionDef.scope,
                },
              });
            errors.push(createActionErrorContext(errorContext));
          }
        }
      }
      return ActionResult.success({
        actions: [],
        errors,
        cause: 'resolution-error',
      });
    }

    const targetContexts = targetResult.value;

    if (targetContexts.length === 0) {
      this.#logger.debug(
        `Action '${actionDef.id}' resolved to 0 targets. Skipping.`
      );
      return ActionResult.success({
        actions: [],
        errors: [],
        cause: 'no-targets',
      });
    }

    trace?.info(
      `Scope for action '${actionDef.id}' resolved to ${targetContexts.length} targets.`,
      source,
      { targets: targetContexts.map((t) => t.entityId) }
    );

    // STEP 3: Generate DiscoveredActionInfo for all valid targets
    return this.#formatActionsForTargets(
      actionDef,
      targetContexts,
      actorEntity.id,
      trace
    );
  }

  /**
   * Checks if the actor meets the prerequisites for an action.
   *
   * @param {ActionDefinition} actionDef - The action to check.
   * @param {Entity} actorEntity - The entity performing the action.
   * @param {TraceContext} [trace] - The optional trace context for logging.
   * @returns {ActionResult} Result indicating if prerequisites are met.
   * @private
   */
  #checkActorPrerequisites(actionDef, actorEntity, trace = null) {
    if (!actionDef.prerequisites || actionDef.prerequisites.length === 0) {
      return ActionResult.success(true); // No prerequisites to check.
    }

    try {
      const meetsPrereqs = this.#prerequisiteEvaluationService.evaluate(
        actionDef.prerequisites,
        actionDef,
        actorEntity,
        trace
      );
      return ActionResult.success(meetsPrereqs);
    } catch (error) {
      const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
        error,
        actionDef,
        actorId: actorEntity.id,
        phase: ERROR_PHASES.VALIDATION,
        trace,
      });

      this.#logger.error(
        `Error checking prerequisites for action '${actionDef.id}'.`,
        errorContext
      );

      return ActionResult.failure(errorContext);
    }
  }

  /**
   * Resolves targets for an action.
   *
   * @param {ActionDefinition} actionDef - The action definition.
   * @param {Entity} actorEntity - The entity performing the action.
   * @param {ActionContext} context - The action discovery context.
   * @param {TraceContext} [trace] - Optional trace context.
   * @returns {ActionResult} Result containing resolved targets.
   * @private
   */
  #resolveTargets(actionDef, actorEntity, context, trace) {
    try {
      // Use the resolveTargets method which returns ActionResult
      const result = this.#targetResolutionService.resolveTargets(
        actionDef.scope,
        actorEntity,
        context,
        trace,
        actionDef.id
      );

      // Service returns ActionResult directly
      return result;
    } catch (error) {
      const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
        error,
        actionDef,
        actorId: actorEntity.id,
        phase: ERROR_PHASES.VALIDATION,
        trace,
        additionalContext: {
          scope: actionDef.scope,
        },
      });

      this.#logger.error(
        `Error resolving scope for action '${actionDef.id}': ${error.message}`,
        errorContext
      );

      return ActionResult.failure(errorContext);
    }
  }

  /**
   * Builds the common formatter options object.
   *
   * @returns {object} Formatter options passed to the command formatter.
   * @private
   */
  #buildFormatterOptions() {
    return {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };
  }

  /**
   * Formats an action for a given list of targets.
   *
   * @param {ActionDefinition} actionDef - The action definition.
   * @param {ActionTargetContext[]} targetContexts - The target contexts to format.
   * @param {string} actorId - The actor entity ID.
   * @param {TraceContext} [trace] - Optional trace context.
   * @returns {ActionResult} Result containing formatted actions and any errors.
   * @private
   */
  #formatActionsForTargets(actionDef, targetContexts, actorId, trace) {
    const validActions = [];
    const errors = [];
    const formatterOptions = this.#buildFormatterOptions();

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

          validActions.push(actionInfo);
        } else {
          const errorContext =
            this.#actionErrorContextBuilder.buildErrorContext({
              error: formatResult.error,
              actionDef,
              actorId,
              phase: ERROR_PHASES.VALIDATION,
              trace,
              targetId: targetContext.entityId,
              additionalContext: {
                formatDetails: formatResult.details,
              },
            });

          errors.push(createActionErrorContext(errorContext));

          this.#logger.warn(
            `Failed to format command for action '${actionDef.id}' with target '${targetContext.entityId}'.`,
            errorContext
          );
        }
      } catch (error) {
        const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
          error,
          actionDef,
          actorId,
          phase: ERROR_PHASES.VALIDATION,
          trace,
          targetId: targetContext.entityId,
        });

        errors.push(createActionErrorContext(errorContext));

        this.#logger.error(
          `Error formatting action '${actionDef.id}' for target '${targetContext.entityId}'.`,
          errorContext
        );
      }
    }

    return ActionResult.success({ actions: validActions, errors });
  }
}

export default ActionCandidateProcessor;
