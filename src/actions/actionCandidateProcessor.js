// src/actions/actionCandidateProcessor.js

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

/**
 * @typedef {object} ProcessResult
 * @property {DiscoveredActionInfo[]} actions - Valid discovered actions
 * @property {ActionErrorContext[]} errors - Errors encountered during processing
 * @property {string} [cause] - Optional reason why no actions were produced
 */

/**
 * @class ActionCandidateProcessor
 * @description Processes candidate actions through prerequisite evaluation and target resolution to generate valid action commands.
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
   * Processes a candidate action definition to generate valid action commands.
   *
   * @param {ActionDefinition} actionDef - The action definition to process.
   * @param {Entity} actorEntity - The entity performing the action.
   * @param {ActionContext} context - The action discovery context.
   * @param {TraceContext} [trace] - Optional trace context for logging.
   * @returns {ProcessResult} Result containing valid actions and errors.
   */
  process(actionDef, actorEntity, context, trace = null) {
    const source = 'ActionCandidateProcessor.process';
    trace?.step(`Processing candidate action: '${actionDef.id}'`, source);

    // STEP 1: Check actor prerequisites
    let meetsPrereqs;
    try {
      meetsPrereqs = this.#actorMeetsPrerequisites(
        actionDef,
        actorEntity,
        trace
      );
    } catch (error) {
      return this.#handlePrerequisiteError(
        actionDef,
        error,
        actorEntity.id,
        trace
      );
    }

    if (!meetsPrereqs) {
      trace?.failure(
        `Action '${actionDef.id}' discarded due to failed actor prerequisites.`,
        source
      );
      return { actions: [], errors: [], cause: 'prerequisites-failed' };
    }
    trace?.success(
      `Action '${actionDef.id}' passed actor prerequisite check.`,
      source
    );

    // STEP 2: Resolve targets using the dedicated service
    const { targets: targetContexts, error: resolutionError } =
      this.#targetResolutionService.resolveTargets(
        actionDef.scope,
        actorEntity,
        context,
        trace
      );

    if (resolutionError) {
      return this.#handleResolutionError(
        actionDef,
        resolutionError,
        actorEntity.id,
        trace
      );
    }

    if (targetContexts.length === 0) {
      this.#logger.debug(
        `Action '${actionDef.id}' resolved to 0 targets. Skipping.`
      );
      return { actions: [], errors: [], cause: 'no-targets' };
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
   * @returns {boolean} True if the actor-state prerequisites pass.
   * @private
   */
  #actorMeetsPrerequisites(actionDef, actorEntity, trace = null) {
    if (!actionDef.prerequisites || actionDef.prerequisites.length === 0) {
      return true; // No prerequisites to check.
    }
    // Call to prerequisite evaluation is now simpler, as it no longer needs a target context.
    return this.#prerequisiteEvaluationService.evaluate(
      actionDef.prerequisites,
      actionDef,
      actorEntity,
      trace // Pass trace down
    );
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
   * Handles errors that occur during prerequisite evaluation.
   *
   * @param {ActionDefinition} actionDef - The action being processed.
   * @param {Error} error - The encountered error.
   * @param {string} actorId - The actor entity ID.
   * @param {TraceContext} [trace] - Optional trace context.
   * @returns {ProcessResult} Result with the captured error.
   * @private
   */
  #handlePrerequisiteError(actionDef, error, actorId, trace) {
    const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
      error,
      actionDef,
      actorId,
      phase: ERROR_PHASES.VALIDATION,
      trace,
    });

    this.#logger.error(
      `Error checking prerequisites for action '${actionDef.id}'.`,
      errorContext
    );

    return {
      actions: [],
      errors: [createActionErrorContext(errorContext)],
      cause: 'prerequisite-error',
    };
  }

  /**
   * Handles errors that occur during target resolution.
   *
   * @param {ActionDefinition} actionDef - The action being processed.
   * @param {Error} error - The encountered error.
   * @param {string} actorId - The actor entity ID.
   * @param {TraceContext} [trace] - Optional trace context.
   * @returns {ProcessResult} Result with the captured error.
   * @private
   */
  #handleResolutionError(actionDef, error, actorId, trace) {
    const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
      error,
      actionDef,
      actorId,
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

    return {
      actions: [],
      errors: [createActionErrorContext(errorContext)],
      cause: 'resolution-error',
    };
  }

  /**
   * Formats an action for a given list of targets.
   *
   * @param {ActionDefinition} actionDef - The action definition.
   * @param {ActionTargetContext[]} targetContexts - The target contexts to format.
   * @param {string} actorId - The actor entity ID.
   * @param {TraceContext} [trace] - Optional trace context.
   * @returns {{actions: DiscoveredActionInfo[], errors: ActionErrorContext[]}} The formatted actions and any errors.
   * @private
   */
  #formatActionsForTargets(actionDef, targetContexts, actorId, trace) {
    const validActions = [];
    const errors = [];
    // Options are identical for all targets; compute once for reuse
    const formatterOptions = this.#buildFormatterOptions();

    for (const targetContext of targetContexts) {
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
        const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
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
    }

    return { actions: validActions, errors };
  }
}
