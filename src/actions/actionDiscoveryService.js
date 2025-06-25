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
/** @typedef {import('../scopeDsl/scopeRegistry.js').default} ScopeRegistry */
/** @typedef {import('./actionIndex.js').ActionIndex} ActionIndex */
/** @typedef {import('./tracing/traceContext.js').TraceContext} TraceContext */

import { ActionTargetContext } from '../models/actionTargetContext.js';
import { IActionDiscoveryService } from '../interfaces/IActionDiscoveryService.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../constants/targetDomains.js';
import { setupService } from '../utils/serviceInitializerUtils.js';
import { getActorLocation } from '../utils/actorLocationUtils.js';
import { getEntityDisplayName } from '../utils/entityUtils.js';
import { ITargetResolutionService } from '../interfaces/ITargetResolutionService.js';
import { TraceContext as TraceContextImpl } from './tracing/traceContext.js';


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
  #targetResolutionService;
  #actionIndex;

  /**
   * @param {object} deps
   * @param {EntityManager}      deps.entityManager
   * @param {PrerequisiteEvaluationService} deps.prerequisiteEvaluationService
   * @param {ActionIndex}        deps.actionIndex
   * @param {ILogger}            deps.logger
   * @param {formatActionCommandFn} deps.formatActionCommandFn
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param {ITargetResolutionService} deps.targetResolutionService
   * @param {Function}           deps.getActorLocationFn
   * @param {Function}           deps.getEntityDisplayNameFn
   */
  constructor({
                entityManager,
                prerequisiteEvaluationService, // New dependency for direct evaluation.
                actionIndex,
                logger,
                formatActionCommandFn,
                safeEventDispatcher,
                targetResolutionService,
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
      targetResolutionService: { value: targetResolutionService, requiredMethods: ['resolveTargets'] },
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
    this.#getActorLocationFn = getActorLocationFn;
    this.#getEntityDisplayNameFn = getEntityDisplayNameFn;

    this.#logger.debug('ActionDiscoveryService initialised with streamlined logic.');
  }

  /**
   * Checks if the actor meets the prerequisites for an action, in a target-agnostic context.
   *
   * @param {import('../data/gameDataRepository.js').ActionDefinition} actionDef The action to check.
   * @param {Entity} actorEntity The entity performing the action.
   * @param {TraceContext} [trace=null] The optional trace context for logging.
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
   * @param {ActionContext} context
   * @returns {ActionContext}
   * @private
   */
  #prepareDiscoveryContext(actorEntity, context) {
    const discoveryContext = { ...context };
    if (!discoveryContext.getActor) {
      discoveryContext.getActor = () => actorEntity;
    }

    discoveryContext.currentLocation =
      context.currentLocation ??
      this.#getActorLocationFn(actorEntity.id, this.#entityManager);

    return discoveryContext;
  }

  /**
   * Finds and validates all available actions for an actor.
   * Can optionally trace the entire discovery process for debugging.
   *
   * @param {Entity} actorEntity The entity for whom to find actions.
   * @param {ActionContext} context The current action context.
   * @param {object} [options={}] Optional settings.
   * @param {boolean} [options.trace=false] - If true, generates a detailed trace of the discovery process.
   * @returns {Promise<import('../interfaces/IActionDiscoveryService.js').DiscoveredActionsResult>}
   */
  async getValidActions(actorEntity, context, options = {}) {
    const { trace: shouldTrace = false } = options;
    const trace = shouldTrace ? new TraceContextImpl() : null;
    const source = 'ActionDiscoveryService.getValidActions';

    if (!actorEntity) {
      this.#logger.debug('Actor entity is null; returning empty result.');
      return { actions: [], errors: [], trace: null };
    }

    trace?.addLog('info', `Starting action discovery for actor '${actorEntity.id}'.`, source, { withTrace: shouldTrace });

    const candidateDefs = this.#actionIndex.getCandidateActions(actorEntity, trace);
    const validActions = [];
    const errors = [];

    const formatterOptions = {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };

    const discoveryContext = this.#prepareDiscoveryContext(actorEntity, context);

    for (const actionDef of candidateDefs) {
      trace?.addLog('step', `Processing candidate action: '${actionDef.id}'`, source);

      // STEP 1: Check actor-only prerequisites ONCE per action.
      if (!this.#actorMeetsPrerequisites(actionDef, actorEntity, trace)) {
        trace?.addLog('failure', `Action '${actionDef.id}' discarded due to failed actor prerequisites.`, source);
        this.#logger.debug(
          `Actor '${actorEntity.id}' failed actor-only prerequisites for action '${actionDef.id}'. Skipping.`
        );
        continue;
      }
      trace?.addLog('success', `Action '${actionDef.id}' passed actor prerequisite check.`, source);


      // STEP 2: Logic is now a simple, declarative call to the new service.
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
        continue;
      }

      // STEP 3: Generate DiscoveredActionInfo for all valid targets.
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
          });
          this.#logger.warn(
            `Failed to format command for action '${actionDef.id}' with target '${targetCtx.entityId}'.`
          );
        }
      }
    } // --- End of loop over candidateDefs ---

    this.#logger.debug(
      `Finished action discovery for actor ${actorEntity.id}. Found ${validActions.length} actions from ${candidateDefs.length} candidates.`
    );
    trace?.addLog('info', `Finished discovery. Found ${validActions.length} valid actions.`, source);

    return { actions: validActions, errors, trace };
  }
}