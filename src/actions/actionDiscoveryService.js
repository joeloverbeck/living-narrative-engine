// src/actions/actionDiscoveryService.js

// ────────────────────────────────────────────────────────────────────────────────
// Type imports
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('./actionIndex.js').ActionIndex} ActionIndex */
/** @typedef {import('./tracing/traceContext.js').TraceContext} TraceContext */
/** @typedef {import('./actionTypes.js').TraceContextFactory} TraceContextFactory */
/** @typedef {import('./actionCandidateProcessor.js').ActionCandidateProcessor} ActionCandidateProcessor */

import { IActionDiscoveryService } from '../interfaces/IActionDiscoveryService.js';
import { setupService } from '../utils/serviceInitializerUtils.js';
import { getActorLocation } from '../utils/actorLocationUtils.js';
import {
  createDiscoveryError,
  extractTargetId,
} from './utils/discoveryErrorUtils.js';

// ────────────────────────────────────────────────────────────────────────────────
/**
 * @class ActionDiscoveryService
 * @augments IActionDiscoveryService
 * @description Discovers valid actions for entities. Does not extend BaseService because it already inherits from IActionDiscoveryService.
 */
export class ActionDiscoveryService extends IActionDiscoveryService {
  #entityManager;
  #logger;
  #getActorLocationFn;
  #actionIndex;
  #traceContextFactory;
  #actionCandidateProcessor;

  /**
   * Creates an ActionDiscoveryService instance.
   *
   * @param {object} deps - The dependencies object.
   * @param {EntityManager} deps.entityManager - The entity manager instance.
   * @param {ActionIndex} deps.actionIndex - The action index for candidate actions.
   * @param {ILogger} deps.logger - Logger for diagnostic output.
   * @param {ActionCandidateProcessor} deps.actionCandidateProcessor - Processor for candidate actions.
   * @param {TraceContextFactory} deps.traceContextFactory - Factory for creating trace contexts.
   * @param {Function} deps.getActorLocationFn - Function to get actor location.
   */
  constructor({
    entityManager,
    actionIndex,
    logger,
    actionCandidateProcessor,
    traceContextFactory,
    getActorLocationFn = getActorLocation,
  }) {
    super();
    this.#logger = setupService('ActionDiscoveryService', logger, {
      entityManager: {
        value: entityManager,
      },
      actionIndex: {
        value: actionIndex,
        requiredMethods: ['getCandidateActions'],
      },
      actionCandidateProcessor: {
        value: actionCandidateProcessor,
        requiredMethods: ['process'],
      },
      traceContextFactory: { value: traceContextFactory, isFunction: true },
      getActorLocationFn: { value: getActorLocationFn, isFunction: true },
    });

    this.#entityManager = entityManager;
    this.#actionIndex = actionIndex;
    this.#actionCandidateProcessor = actionCandidateProcessor;
    this.#traceContextFactory = traceContextFactory;
    this.#getActorLocationFn = getActorLocationFn;

    this.#logger.debug(
      'ActionDiscoveryService initialised with streamlined logic.'
    );
  }

  /**
   * Prepares a populated discovery context for the specified actor.
   *
   * @param {Entity} actorEntity - The actor entity.
   * @param {ActionContext} baseContext - The base context to extend.
   * @returns {ActionContext} The populated discovery context.
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
   * Retrieves candidate action definitions for the given actor.
   *
   * @param {Entity} actorEntity - The actor entity.
   * @param {TraceContext|null} trace - Optional trace context.
   * @returns {import('../interfaces/IGameDataRepository.js').ActionDefinition[]} Candidate action definitions.
   * @throws {Error} Propagates any retrieval errors.
   * @private
   */
  #fetchCandidateActions(actorEntity, trace) {
    try {
      return this.#actionIndex.getCandidateActions(actorEntity, trace);
    } catch (err) {
      this.#logger.error(
        `Error retrieving candidate actions: ${err.message}`,
        err
      );
      throw err;
    }
  }

  /**
   * Processes a single candidate action definition.
   *
   * @param {import('../interfaces/IGameDataRepository.js').ActionDefinition} actionDef - The action definition.
   * @param {Entity} actorEntity - The actor performing the action.
   * @param {ActionContext} discoveryContext - The populated discovery context.
   * @param {TraceContext|null} trace - Optional trace context.
   * @returns {Promise<{actions: any[], errors: any[]}>} Result of processing.
   * @private
   */
  #processCandidate(actionDef, actorEntity, discoveryContext, trace) {
    return Promise.resolve()
      .then(() =>
        this.#actionCandidateProcessor.process(
          actionDef,
          actorEntity,
          discoveryContext,
          trace
        )
      )
      .then((result) => result ?? { actions: [], errors: [] })
      .catch((err) => {
        this.#logger.error(
          `Error processing candidate action '${actionDef.id}': ${err.message}`,
          err
        );
        return {
          actions: [],
          errors: [createDiscoveryError(actionDef.id, extractTargetId(err), err)],
        };
      });
  }

  /**
   * The main public method is now a high-level orchestrator.
   * It is simpler, with its complex inner logic delegated to helpers.
   *
   * @param {Entity} actorEntity - The entity for whom to find actions.
   * @param {ActionContext} [baseContext] - The current action context.
   * @param {object} [options] - Optional settings.
   * @param {boolean} [options.trace] - If true, generates a detailed trace of the discovery process.
   * @returns {Promise<import('../interfaces/IActionDiscoveryService.js').DiscoveredActionsResult>} The discovered actions result.
   */
  async getValidActions(actorEntity, baseContext = {}, options = {}) {
    const { trace: shouldTrace = false } = options;
    const trace = shouldTrace ? this.#traceContextFactory() : null;

    if (!actorEntity || typeof actorEntity.id !== 'string') {
      this.#logger.error('getValidActions called with invalid actor entity.');
      return { actions: [], errors: [], trace: null };
    }

    trace?.info(
      `Starting action discovery for actor '${actorEntity.id}'.`,
      'getValidActions',
      { withTrace: shouldTrace }
    );

    let candidateDefs = [];
    try {
      candidateDefs = this.#fetchCandidateActions(actorEntity, trace);
    } catch (err) {
      return {
        actions: [],
        errors: [createDiscoveryError('candidateRetrieval', null, err)],
        trace,
      };
    }
    const actions = [];
    const errors = [];
    const discoveryContext = this.#prepareDiscoveryContext(
      actorEntity,
      baseContext
    );

    const processingPromises = candidateDefs.map((actionDef) =>
      this.#processCandidate(actionDef, actorEntity, discoveryContext, trace)
    );
    const results = await Promise.all(processingPromises);

    for (const { actions: a, errors: e } of results) {
      actions.push(...a);
      errors.push(...e);
    }

    this.#logger.debug(
      `Finished action discovery for actor ${actorEntity.id}. Found ${actions.length} actions from ${candidateDefs.length} candidates.`
    );
    trace?.info(
      `Finished discovery. Found ${actions.length} valid actions.`,
      'getValidActions'
    );

    return { actions, errors, trace };
  }
}
