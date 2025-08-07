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
/** @typedef {import('./tracing/actionTraceFilter.js').default} ActionTraceFilter */

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
 * Enhanced with action tracing capabilities when tracing is enabled.
 */
export class ActionDiscoveryService extends IActionDiscoveryService {
  #entityManager;
  #logger;
  #getActorLocationFn;
  #traceContextFactory;
  #actionPipelineOrchestrator;
  #actionAwareTraceFactory;
  #actionTraceFilter;

  /**
   * Creates an ActionDiscoveryService instance.
   *
   * @param {object} deps - The dependencies object.
   * @param {EntityManager} deps.entityManager - The entity manager instance.
   * @param {ILogger} deps.logger - Logger for diagnostic output.
   * @param {ActionPipelineOrchestrator} deps.actionPipelineOrchestrator - The pipeline orchestrator.
   * @param {TraceContextFactory} deps.traceContextFactory - Factory for creating trace contexts.
   * @param {Function} deps.getActorLocationFn - Function to get actor location.
   * @param {Function} [deps.actionAwareTraceFactory] - Optional factory for creating action-aware traces.
   * @param {ActionTraceFilter} [deps.actionTraceFilter] - Optional filter for action tracing.
   * @param {ServiceSetup} [deps.serviceSetup] - Optional service setup helper.
   */
  constructor({
    entityManager,
    logger,
    actionPipelineOrchestrator,
    traceContextFactory,
    serviceSetup,
    getActorLocationFn = getActorLocation,
    actionAwareTraceFactory = null,
    actionTraceFilter = null,
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

    // Optional action tracing dependencies
    if (actionAwareTraceFactory) {
      if (typeof actionAwareTraceFactory !== 'function') {
        this.#logger.warn(
          'ActionDiscoveryService: actionAwareTraceFactory must be a function, ignoring'
        );
      } else {
        this.#actionAwareTraceFactory = actionAwareTraceFactory;
      }
    }

    if (actionTraceFilter) {
      if (!actionTraceFilter.isEnabled || !actionTraceFilter.shouldTrace) {
        this.#logger.warn(
          'ActionDiscoveryService: actionTraceFilter missing required methods, ignoring'
        );
      } else {
        this.#actionTraceFilter = actionTraceFilter;
      }
    }

    const actionTracingAvailable = !!(
      this.#actionAwareTraceFactory && this.#actionTraceFilter
    );

    this.#logger.debug(
      'ActionDiscoveryService initialised with pipeline orchestrator.',
      {
        actionTracingAvailable,
        hasActionAwareTraceFactory: !!this.#actionAwareTraceFactory,
        hasActionTraceFilter: !!this.#actionTraceFilter,
      }
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
   * Enhanced with action tracing capabilities.
   *
   * @param {Entity} actorEntity - The entity for whom to find actions.
   * @param {ActionContext} [baseContext] - The current action context.
   * @param {object} [options] - Optional settings.
   * @param {boolean} [options.trace] - If true, generates a detailed trace of the discovery process.
   * @returns {Promise<import('../interfaces/IActionDiscoveryService.js').DiscoveredActionsResult>} The discovered actions result.
   */
  async getValidActions(actorEntity, baseContext = {}, options = {}) {
    const { trace: shouldTrace = false } = options;
    const source = 'ActionDiscoveryService.getValidActions';

    // Validate actor entity first
    if (!actorEntity || !isNonBlankString(actorEntity.id)) {
      const message =
        'ActionDiscoveryService.getValidActions: actorEntity parameter must be an object with a non-empty id';
      this.#logger.error(message, { actorEntity });
      throw new InvalidActorEntityError(message);
    }

    // Create appropriate trace based on tracing configuration
    const trace = shouldTrace
      ? await this.#createTraceContext(actorEntity.id, baseContext, options)
      : null;

    this.#logger.debug(
      `Starting action discovery for actor ${actorEntity.id}`,
      {
        actorId: actorEntity.id,
        traceEnabled: !!trace,
        actionTracingEnabled: this.#isActionTracingEnabled(),
        options,
      }
    );

    // Log trace type for debugging
    if (trace) {
      const traceType = this.#getTraceTypeName(trace);
      this.#logger.debug(`Created ${traceType} for actor ${actorEntity.id}`, {
        actorId: actorEntity.id,
        traceType,
      });
    }

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

    // Delegate to the pipeline orchestrator with enhanced trace
    const result = await this.#actionPipelineOrchestrator.discoverActions(
      actorEntity,
      discoveryContext,
      { trace }
    );

    // Log pipeline completion with action tracing statistics
    if (
      trace?.getTracedActions &&
      typeof trace.getTracedActions === 'function'
    ) {
      const tracedActions = trace.getTracedActions();
      const tracingSummary = trace.getTracingSummary?.() || {};

      this.#logger.info(
        `Action discovery completed for actor ${actorEntity.id} with action tracing`,
        {
          actorId: actorEntity.id,
          actionCount: result.actions?.length || 0,
          errorCount: result.errors?.length || 0,
          tracedActionCount: tracedActions.size,
          totalStagesTracked: tracingSummary.totalStagesTracked || 0,
          sessionDuration: tracingSummary.sessionDuration || 0,
        }
      );
    } else {
      this.#logger.debug(
        `Finished action discovery for actor ${actorEntity.id}. Found ${result.actions.length} actions.`
      );
    }

    return result;
  }

  /**
   * Create appropriate trace context based on action tracing configuration
   *
   * @private
   * @param {string} actorId - Actor ID for trace context
   * @param {object} baseContext - Base context for tracing
   * @param {object} options - Discovery options
   * @returns {Promise<TraceContext|null>}
   */
  async #createTraceContext(actorId, baseContext, options) {
    try {
      // Check if action tracing should be enabled
      const actionTracingEnabled = this.#isActionTracingEnabled();

      if (actionTracingEnabled && this.#actionAwareTraceFactory) {
        this.#logger.debug(
          `Creating ActionAwareStructuredTrace for actor ${actorId}`,
          { actorId, actionTracingEnabled }
        );

        // Create action-aware trace using the factory function pattern
        const actionAwareTrace = this.#actionAwareTraceFactory({
          actorId,
          enableActionTracing: true,
          context: {
            ...baseContext,
            discoveryOptions: options,
            createdAt: Date.now(),
          },
        });

        return actionAwareTrace;
      }

      // Fall back to standard trace
      this.#logger.debug(
        `Creating standard StructuredTrace for actor ${actorId}`,
        {
          actorId,
          actionTracingEnabled,
          hasActionAwareFactory: !!this.#actionAwareTraceFactory,
        }
      );

      return this.#traceContextFactory();
    } catch (error) {
      this.#logger.error(
        `Failed to create trace context for actor ${actorId}, falling back to standard trace`,
        error
      );

      // Always fall back to standard trace on error
      try {
        return this.#traceContextFactory();
      } catch (fallbackError) {
        this.#logger.error(
          `Failed to create fallback trace context for actor ${actorId}`,
          fallbackError
        );
        return null;
      }
    }
  }

  /**
   * Check if action tracing is enabled
   *
   * @private
   * @returns {boolean}
   */
  #isActionTracingEnabled() {
    try {
      return this.#actionTraceFilter?.isEnabled() || false;
    } catch (error) {
      this.#logger.warn(
        'Error checking action tracing status, assuming disabled',
        error
      );
      return false;
    }
  }

  /**
   * Get trace type name for debugging
   *
   * @private
   * @param {object} trace - Trace instance
   * @returns {string}
   */
  #getTraceTypeName(trace) {
    if (trace?.captureActionData) {
      return 'ActionAwareStructuredTrace';
    }
    if (trace?.step) {
      return 'StructuredTrace';
    }
    return 'UnknownTrace';
  }

  /**
   * Check if action tracing is available
   *
   * @returns {boolean} True if action tracing is configured and available
   */
  isActionTracingAvailable() {
    return !!(this.#actionAwareTraceFactory && this.#actionTraceFilter);
  }

  /**
   * Get action tracing status for debugging
   *
   * @returns {object} Action tracing status information
   */
  getActionTracingStatus() {
    return {
      available: this.isActionTracingAvailable(),
      enabled: this.#isActionTracingEnabled(),
      hasFilter: !!this.#actionTraceFilter,
      hasFactory: !!this.#actionAwareTraceFactory,
    };
  }
}
