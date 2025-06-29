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

/**
 * @typedef {object} ProcessResult
 * @property {DiscoveredActionInfo[]} actions - Valid discovered actions
 * @property {object[]} errors - Errors encountered during processing
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
   */
  constructor({
    prerequisiteEvaluationService,
    targetResolutionService,
    entityManager,
    actionCommandFormatter,
    safeEventDispatcher,
    getEntityDisplayNameFn,
    logger,
  }) {
    this.#prerequisiteEvaluationService = prerequisiteEvaluationService;
    this.#targetResolutionService = targetResolutionService;
    this.#entityManager = entityManager;
    this.#commandFormatter = actionCommandFormatter;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#getEntityDisplayNameFn = getEntityDisplayNameFn;
    this.#logger = logger;
  }

  /**
   * Processes a candidate action definition to generate valid action commands.
   *
   * @param {ActionDefinition} actionDef - The action definition to process.
   * @param {Entity} actorEntity - The entity performing the action.
   * @param {ActionContext} context - The action discovery context.
   * @param {TraceContext} [trace] - Optional trace context for logging.
   * @returns {ProcessResult|null} Result containing valid actions and errors, or null if no valid targets.
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
      this.#logger.error(
        `Error checking prerequisites for action '${actionDef.id}'.`,
        error
      );
      return {
        actions: [],
        errors: [this.#createDiscoveryError(actionDef.id, null, error)],
      };
    }

    if (!meetsPrereqs) {
      trace?.failure(
        `Action '${actionDef.id}' discarded due to failed actor prerequisites.`,
        source
      );
      return null;
    }
    trace?.success(
      `Action '${actionDef.id}' passed actor prerequisite check.`,
      source
    );

    // STEP 2: Resolve targets using the dedicated service
    const targetContexts = this.#targetResolutionService.resolveTargets(
      actionDef.scope,
      actorEntity,
      context,
      trace
    );

    if (targetContexts.length === 0) {
      this.#logger.debug(
        `Action '${actionDef.id}' resolved to 0 targets. Skipping.`
      );
      return null;
    }
    trace?.info(
      `Scope for action '${actionDef.id}' resolved to ${targetContexts.length} targets.`,
      source,
      { targets: targetContexts.map((t) => t.entityId) }
    );

    // STEP 3: Generate DiscoveredActionInfo for all valid targets
    return this.#formatActionsForTargets(actionDef, targetContexts);
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
   * Formats an action for a given list of targets.
   *
   * @param {ActionDefinition} actionDef - The action definition.
   * @param {ActionTargetContext[]} targetContexts - The target contexts to format.
   * @returns {{actions: DiscoveredActionInfo[], errors: object[]}} The formatted actions and any errors.
   * @private
   */
  #formatActionsForTargets(actionDef, targetContexts) {
    const validActions = [];
    const errors = [];
    // Options are identical for all targets; compute once for reuse
    const formatterOptions = {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };

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
        validActions.push({
          id: actionDef.id,
          name: actionDef.name || actionDef.commandVerb,
          command: formatResult.value,
          description: actionDef.description || '',
          params: { targetId: targetContext.entityId },
        });
      } else {
        errors.push(
          this.#createDiscoveryError(
            actionDef.id,
            targetContext.entityId,
            formatResult.error,
            formatResult.details
          )
        );
        this.#logger.warn(
          `Failed to format command for action '${actionDef.id}' with target '${targetContext.entityId}'.`
        );
      }
    }
    return { actions: validActions, errors };
  }

  /**
   * Creates a standardized error object for action discovery.
   *
   * @param {string} actionId - ID of the action that failed.
   * @param {string|null} targetId - ID of the target entity, if available.
   * @param {Error|string} error - The encountered error instance or message.
   * @param {any|null} [details] - Optional additional error details.
   * @returns {{ actionId: string, targetId: string|null, error: Error|string, details: any|null }} The standardized error object.
   * @private
   */
  #createDiscoveryError(actionId, targetId, error, details = null) {
    return { actionId, targetId, error, details };
  }
}
