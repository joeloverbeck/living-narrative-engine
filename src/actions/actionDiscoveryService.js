// src/actions/actionDiscoveryService.js

// ────────────────────────────────────────────────────────────────────────────────
// Type imports
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./validation/prerequisiteEvaluationService.js').PrerequisiteEvaluationService} PrerequisiteEvaluationService */
/** @typedef {import('./actionFormatter.js').formatActionCommand} formatActionCommandFn */
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./actionIndex.js').ActionIndex} ActionIndex */
/** @typedef {import('./tracing/traceContext.js').TraceContext} TraceContext */
/** @typedef {import('./actionTypes.js').TraceContextFactory} TraceContextFactory */

/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */

import { IActionDiscoveryService } from '../interfaces/IActionDiscoveryService.js';
import { setupService } from '../utils/serviceInitializerUtils.js';
import { getActorLocation } from '../utils/actorLocationUtils.js';
import { getEntityDisplayName } from '../utils/entityUtils.js';
import {
  TRACE_INFO,
  TRACE_SUCCESS,
  TRACE_FAILURE,
  TRACE_STEP,
} from './tracing/traceContext.js';

// ────────────────────────────────────────────────────────────────────────────────
/**
 * @class ActionDiscoveryService
 * @augments IActionDiscoveryService
 * @description Discovers valid actions for entities. Does not extend BaseService because it already inherits from IActionDiscoveryService.
 */
export class ActionDiscoveryService extends IActionDiscoveryService {
  #entityManager;
  #prerequisiteEvaluationService;
  #formatActionCommandFn;
  #logger;
  #safeEventDispatcher;
  #getActorLocationFn;
  #getEntityDisplayNameFn;
  #actionIndex;
  #targetResolutionService;
  #traceContextFactory;

  /**
   * @param {object} deps
   * @param {EntityManager}      deps.entityManager
   * @param {PrerequisiteEvaluationService} deps.prerequisiteEvaluationService
   * @param {ActionIndex}        deps.actionIndex
   * @param {ILogger}            deps.logger
   * @param {formatActionCommandFn} deps.formatActionCommandFn
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param {ITargetResolutionService} deps.targetResolutionService
   * @param {TraceContextFactory} deps.traceContextFactory
   * @param {Function}           deps.getActorLocationFn
   * @param {Function}           deps.getEntityDisplayNameFn
   */
  constructor({
    entityManager,
    prerequisiteEvaluationService,
    actionIndex,
    logger,
    formatActionCommandFn,
    safeEventDispatcher,
    targetResolutionService,
    traceContextFactory,
    getActorLocationFn = getActorLocation,
    getEntityDisplayNameFn = getEntityDisplayName,
  }) {
    super();
    this.#logger = setupService('ActionDiscoveryService', logger, {
      entityManager: {
        value: entityManager,
      },
      prerequisiteEvaluationService: {
        value: prerequisiteEvaluationService,
        requiredMethods: ['evaluate'],
      },
      actionIndex: {
        value: actionIndex,
        requiredMethods: ['getCandidateActions'],
      },
      formatActionCommandFn: { value: formatActionCommandFn, isFunction: true },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      targetResolutionService: {
        value: targetResolutionService,
        requiredMethods: ['resolveTargets'],
      },
      traceContextFactory: { value: traceContextFactory, isFunction: true },
      getActorLocationFn: { value: getActorLocationFn, isFunction: true },
      getEntityDisplayNameFn: {
        value: getEntityDisplayNameFn,
        isFunction: true,
      },
    });

    this.#entityManager = entityManager;
    this.#prerequisiteEvaluationService = prerequisiteEvaluationService;
    this.#actionIndex = actionIndex;
    this.#formatActionCommandFn = formatActionCommandFn;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#targetResolutionService = targetResolutionService;
    this.#traceContextFactory = traceContextFactory;
    this.#getActorLocationFn = getActorLocationFn;
    this.#getEntityDisplayNameFn = getEntityDisplayNameFn;

    this.#logger.debug(
      'ActionDiscoveryService initialised with streamlined logic.'
    );
  }

  /**
   * Checks if the actor meets the prerequisites for an action, in a target-agnostic context.
   *
   * @param {import('../data/gameDataRepository.js').ActionDefinition} actionDef The action to check.
   * @param {Entity} actorEntity The entity performing the action.
   * @param {TraceContext} [trace] The optional trace context for logging.
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
   * @description Prepares a populated discovery context for the specified actor.
   * @param {Entity} actorEntity
   * @param {ActionContext} baseContext
   * @returns {ActionContext}
   * @private
   */
  #prepareDiscoveryContext(actorEntity, baseContext) {
    const discoveryContext = { ...baseContext };
    if (!discoveryContext.getActor) {
      discoveryContext.getActor = () => actorEntity;
    }

    discoveryContext.currentLocation =
      baseContext.currentLocation ??
      this.#getActorLocationFn(actorEntity.id, this.#entityManager);

    return discoveryContext;
  }

  /**
   * The main public method is now a high-level orchestrator.
   * It is simpler, with its complex inner logic delegated to helpers.
   *
   * @param {Entity} actorEntity The entity for whom to find actions.
   * @param {ActionContext} baseContext The current action context.
   * @param {object} [options] Optional settings.
   * @param {boolean} [options.trace] - If true, generates a detailed trace of the discovery process.
   * @returns {Promise<import('../interfaces/IActionDiscoveryService.js').DiscoveredActionsResult>}
   */
  async getValidActions(actorEntity, baseContext, options = {}) {
    const { trace: shouldTrace = false } = options;
    const trace = shouldTrace ? this.#traceContextFactory() : null;

    if (!actorEntity) {
      this.#logger.debug('Actor entity is null; returning empty result.');
      return { actions: [], errors: [], trace: null };
    }

    trace?.addLog(
      TRACE_INFO,
      `Starting action discovery for actor '${actorEntity.id}'.`,
      'getValidActions',
      { withTrace: shouldTrace }
    );

    const candidateDefs = this.#actionIndex.getCandidateActions(
      actorEntity,
      trace
    );
    const actions = [];
    const errors = [];
    const discoveryContext = this.#prepareDiscoveryContext(
      actorEntity,
      baseContext
    );

    for (const actionDef of candidateDefs) {
      try {
        const result = await this.#processCandidateAction(
          actionDef,
          actorEntity,
          discoveryContext,
          trace
        );

        if (result) {
          actions.push(...result.actions);
          errors.push(...result.errors);
        }
      } catch (err) {
        errors.push({
          actionId: actionDef.id,
          targetId:
            err?.targetId ?? err?.target?.entityId ?? err?.entityId ?? null,
          error: err,
        });
        this.#logger.error(
          `Error processing candidate action '${actionDef.id}': ${err.message}`,
          err
        );
      }
    }

    this.#logger.debug(
      `Finished action discovery for actor ${actorEntity.id}. Found ${actions.length} actions from ${candidateDefs.length} candidates.`
    );
    trace?.addLog(
      TRACE_INFO,
      `Finished discovery. Found ${actions.length} valid actions.`,
      'getValidActions'
    );

    return { actions, errors, trace };
  }

  /**
   * NEW: Processes a single candidate action through the entire pipeline.
   *
   * @param {import('../data/gameDataRepository.js').ActionDefinition} actionDef
   * @param {Entity} actorEntity
   * @param {ActionContext} discoveryContext
   * @param {TraceContext} trace
   * @returns {Promise<{actions: import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[], errors: Error[]}|null>}
   * @private
   */
  async #processCandidateAction(
    actionDef,
    actorEntity,
    discoveryContext,
    trace
  ) {
    const source = 'ActionDiscoveryService.#processCandidateAction';
    trace?.addLog(
      TRACE_STEP,
      `Processing candidate action: '${actionDef.id}'`,
      source
    );

    // STEP 1: Check actor prerequisites
    if (!this.#actorMeetsPrerequisites(actionDef, actorEntity, trace)) {
      trace?.addLog(
        TRACE_FAILURE,
        `Action '${actionDef.id}' discarded due to failed actor prerequisites.`,
        source
      );
      return null;
    }
    trace?.addLog(
      TRACE_SUCCESS,
      `Action '${actionDef.id}' passed actor prerequisite check.`,
      source
    );

    // STEP 2: Resolve targets using the dedicated service
    const targetContexts = await this.#targetResolutionService.resolveTargets(
      actionDef.scope,
      actorEntity,
      discoveryContext,
      trace
    );

    if (targetContexts.length === 0) {
      this.#logger.debug(
        `Action '${actionDef.id}' resolved to 0 targets. Skipping.`
      );
      return null;
    }
    trace?.addLog(
      TRACE_INFO,
      `Scope for action '${actionDef.id}' resolved to ${targetContexts.length} targets.`,
      source,
      { targets: targetContexts.map((t) => t.entityId) }
    );

    // STEP 3: Generate DiscoveredActionInfo for all valid targets
    return this.#formatActionsForTargets(actionDef, targetContexts);
  }

  /**
   * NEW: Formats an action for a given list of targets.
   *
   * @param {import('../data/gameDataRepository.js').ActionDefinition} actionDef
   * @param {ActionTargetContext[]} targetContexts
   * @returns {{actions: import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[], errors: Error[]}}
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

    for (const targetCtx of targetContexts) {
      const formatResult = this.#formatActionCommandFn(
        actionDef,
        targetCtx,
        this.#entityManager,
        formatterOptions,
        this.#getEntityDisplayNameFn
      );

      if (formatResult.ok) {
        validActions.push({
          id: actionDef.id,
          name: actionDef.name || actionDef.commandVerb,
          command: formatResult.value,
          description: actionDef.description || '',
          params: { targetId: targetCtx.entityId },
        });
      } else {
        errors.push({
          actionId: actionDef.id,
          targetId: targetCtx.entityId,
          error: formatResult.error,
          details: formatResult.details,
        });
        this.#logger.warn(
          `Failed to format command for action '${actionDef.id}' with target '${targetCtx.entityId}'.`
        );
      }
    }
    return { actions: validActions, errors };
  }
}
