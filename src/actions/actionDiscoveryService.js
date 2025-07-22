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
/** @typedef {import('./actionPipelineOrchestrator.js').ActionPipelineOrchestrator} ActionPipelineOrchestrator */
/** @typedef {import('./errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */
/** @typedef {import('./errors/actionErrorTypes.js').ActionErrorContext} ActionErrorContext */

import { IActionDiscoveryService } from '../interfaces/IActionDiscoveryService.js';
import { ServiceSetup } from '../utils/serviceInitializerUtils.js';
import { getActorLocation } from '../utils/actorLocationUtils.js';
import { InvalidActorEntityError } from '../errors/invalidActorEntityError.js';
import { isNonBlankString } from '../utils/textUtils.js';

// ────────────────────────────────────────────────────────────────────────────────
/**
 * @class ActionDiscoveryService
 * @augments IActionDiscoveryService
 * @description Discovers valid actions for entities using a pipeline orchestrator.
 */
export class ActionDiscoveryService extends IActionDiscoveryService {
  #entityManager;
  #logger;
  #getActorLocationFn;
  #traceContextFactory;
  #actionPipelineOrchestrator;

  /**
   * Creates an ActionDiscoveryService instance.
   *
   * @param {object} deps - The dependencies object.
   * @param {EntityManager} deps.entityManager - The entity manager instance.
   * @param {ILogger} deps.logger - Logger for diagnostic output.
   * @param {ActionPipelineOrchestrator} deps.actionPipelineOrchestrator - The pipeline orchestrator.
   * @param {TraceContextFactory} deps.traceContextFactory - Factory for creating trace contexts.
   * @param {Function} deps.getActorLocationFn - Function to get actor location.
   * @param {ServiceSetup} [deps.serviceSetup] - Optional service setup helper.
   */
  constructor({
    entityManager,
    logger,
    actionPipelineOrchestrator,
    traceContextFactory,
    serviceSetup,
    getActorLocationFn = getActorLocation,
  }) {
    super();
    const setup = serviceSetup ?? new ServiceSetup();
    this.#logger = setup.setupService('ActionDiscoveryService', logger, {
      entityManager: {
        value: entityManager,
      },
      actionPipelineOrchestrator: {
        value: actionPipelineOrchestrator,
        requiredMethods: ['discoverActions'],
      },
      traceContextFactory: { value: traceContextFactory, isFunction: true },
      getActorLocationFn: { value: getActorLocationFn, isFunction: true },
    });

    this.#entityManager = entityManager;
    this.#actionPipelineOrchestrator = actionPipelineOrchestrator;
    this.#traceContextFactory = traceContextFactory;
    this.#getActorLocationFn = getActorLocationFn;

    this.#logger.debug(
      'ActionDiscoveryService initialised with pipeline orchestrator.'
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
   * The main public method now delegates to the pipeline orchestrator.
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

    // Support both old and new trace APIs
    if (trace?.withSpanAsync) {
      return trace.withSpanAsync(
        'action.discover',
        async () => {
          return this.#getValidActionsInternal(
            actorEntity,
            baseContext,
            trace,
            shouldTrace
          );
        },
        {
          actorId: actorEntity?.id,
          withTrace: shouldTrace,
        }
      );
    }

    // Fallback to original implementation for backward compatibility
    return this.#getValidActionsInternal(
      actorEntity,
      baseContext,
      trace,
      shouldTrace
    );
  }

  /**
   * Internal implementation of action discovery logic.
   *
   * @private
   * @param {Entity} actorEntity - The entity for whom to find actions.
   * @param {ActionContext} baseContext - The current action context.
   * @param {TraceContext|null} trace - Optional tracing instance.
   * @param {boolean} shouldTrace - Whether tracing is enabled.
   * @returns {Promise<import('../interfaces/IActionDiscoveryService.js').DiscoveredActionsResult>} The discovered actions result.
   */
  async #getValidActionsInternal(actorEntity, baseContext, trace, shouldTrace) {
    const SOURCE = 'getValidActions';

    if (!actorEntity || !isNonBlankString(actorEntity.id)) {
      const message =
        'ActionDiscoveryService.getValidActions: actorEntity parameter must be an object with a non-empty id';
      this.#logger.error(message, { actorEntity });
      throw new InvalidActorEntityError(message);
    }

    if (
      baseContext !== undefined &&
      (typeof baseContext !== 'object' || baseContext === null)
    ) {
      const message =
        'ActionDiscoveryService.getValidActions: baseContext must be an object when provided';
      this.#logger.error(message, { baseContext });
      throw new Error(message);
    }

    trace?.info(
      `Starting action discovery for actor '${actorEntity.id}'.`,
      SOURCE,
      { withTrace: shouldTrace }
    );

    // Prepare the discovery context
    const discoveryContext = this.#prepareDiscoveryContext(
      actorEntity,
      baseContext
    );

    // Delegate to the pipeline orchestrator
    const result = await this.#actionPipelineOrchestrator.discoverActions(
      actorEntity,
      discoveryContext,
      { trace }
    );

    this.#logger.debug(
      `Finished action discovery for actor ${actorEntity.id}. Found ${result.actions.length} actions.`
    );

    return result;
  }
}
