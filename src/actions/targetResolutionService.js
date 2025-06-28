/** @typedef {import('../interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../scopeDsl/scopeRegistry.js').default} ScopeRegistry */
/** @typedef {import('../interfaces/IScopeEngine.js').IScopeEngine} IScopeEngine */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('./tracing/traceContext.js').TraceContext} TraceContext */
/** @typedef {import('../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */

import { ITargetResolutionService } from '../interfaces/ITargetResolutionService.js';
import { ActionTargetContext } from '../models/actionTargetContext.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../constants/targetDomains.js';
import { setupService } from '../utils/serviceInitializerUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';
import { TRACE_INFO, TRACE_ERROR } from './tracing/traceContext.js';

/**
 * Service for resolving action target scopes.
 *
 * @class TargetResolutionService
 * @augments ITargetResolutionService
 * @description Resolves target scopes to concrete entity identifiers using DSL expressions.
 */
export class TargetResolutionService extends ITargetResolutionService {
  #scopeRegistry;
  #scopeEngine;
  #entityManager;
  #logger;
  #safeEventDispatcher;
  #jsonLogicEvalService;

  /**
   * @param {object} deps
   * @param {ScopeRegistry} deps.scopeRegistry
   * @param {IScopeEngine} deps.scopeEngine
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param {JsonLogicEvaluationService} deps.jsonLogicEvaluationService
   */
  constructor({
    scopeRegistry,
    scopeEngine,
    entityManager,
    logger,
    safeEventDispatcher,
    jsonLogicEvaluationService,
  }) {
    super();
    this.#logger = setupService('TargetResolutionService', logger, {
      scopeRegistry: { value: scopeRegistry, requiredMethods: ['getScope'] },
      scopeEngine: { value: scopeEngine, requiredMethods: ['resolve'] },
      entityManager: { value: entityManager },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      jsonLogicEvaluationService: {
        value: jsonLogicEvaluationService,
        requiredMethods: ['evaluate'],
      },
    });
    this.#scopeRegistry = scopeRegistry;
    this.#scopeEngine = scopeEngine;
    this.#entityManager = entityManager;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#jsonLogicEvalService = jsonLogicEvaluationService;
  }

  /**
   * Resolves a target scope name into actionable target contexts.
   *
   * @override
   * @description Resolves a target scope name into actionable target contexts.
   * @param {string} scopeName - The name of the scope to resolve.
   * @param {Entity} actorEntity - The entity performing the action.
   * @param {ActionContext} discoveryContext - Context for DSL evaluation.
   * @param {TraceContext|null} [trace] - Optional tracing instance.
   * @returns {Promise<ActionTargetContext[]>} Resolved target contexts.
   */
  async resolveTargets(scopeName, actorEntity, discoveryContext, trace = null) {
    const source = 'TargetResolutionService.resolveTargets';
    trace?.info(`Resolving scope '${scopeName}'.`, source);

    if (scopeName === TARGET_DOMAIN_NONE) {
      trace?.info(
        `Scope is 'none'; returning a single no-target context.`,
        source
      );
      return [ActionTargetContext.noTarget()];
    }

    if (scopeName === TARGET_DOMAIN_SELF) {
      trace?.info(
        `Scope is 'self'; returning the actor as the target.`,
        source
      );
      return [ActionTargetContext.forEntity(actorEntity.id)];
    }

    const targetIds = this.#resolveScopeToIds(
      scopeName,
      actorEntity,
      discoveryContext,
      trace
    );

    trace?.info(
      `DSL scope '${scopeName}' resolved to ${targetIds.size} target(s).`,
      source,
      { targetIds: Array.from(targetIds) }
    );
    return Array.from(targetIds, (id) => ActionTargetContext.forEntity(id));
  }

  /**
   * Resolves a DSL scope definition to a set of entity IDs.
   *
   * @description Resolves a DSL scope definition to a set of entity IDs.
   * @param {string} scopeName - Name of the scope definition.
   * @param {Entity} actorEntity - The entity initiating the resolution.
   * @param {ActionContext} discoveryContext - Context for evaluating scope rules.
   * @param {TraceContext|null} [trace] - Optional tracing instance.
   * @returns {Set<string>} The set of resolved entity IDs.
   * @private
   */
  #resolveScopeToIds(scopeName, actorEntity, discoveryContext, trace = null) {
    const source = 'TargetResolutionService.#resolveScopeToIds';
    trace?.info(`Resolving scope '${scopeName}' with DSL.`, source);
    const scopeDefinition = this.#scopeRegistry.getScope(scopeName);

    if (
      !scopeDefinition ||
      typeof scopeDefinition.expr !== 'string' ||
      !scopeDefinition.expr.trim()
    ) {
      const errorMessage = `Missing scope definition: Scope '${scopeName}' not found or has no expression in registry.`;
      this.#handleResolutionError(errorMessage, { scopeName }, trace, source);
      return new Set();
    }

    try {
      // All scopes must have pre-parsed ASTs
      const ast = scopeDefinition.ast;
      if (!ast) {
        throw new Error(
          `Scope definition '${scopeName}' is missing the required AST property. All scopes must have pre-parsed ASTs.`
        );
      }

      trace?.info(`Using pre-parsed AST for scope '${scopeName}'.`, source);

      const runtimeCtx = this.#buildRuntimeContext(
        actorEntity,
        discoveryContext
      );
      return (
        this.#scopeEngine.resolve(ast, actorEntity, runtimeCtx, trace) ??
        new Set()
      );
    } catch (error) {
      const errorMessage = `Error resolving scope '${scopeName}': ${error.message}`;
      this.#handleResolutionError(
        errorMessage,
        { error: error.message, stack: error.stack },
        trace,
        source,
        error
      );
      return new Set();
    }
  }

  /**
   * @description Builds the runtime context passed to the scope engine.
   * @param {Entity} actorEntity The current actor entity.
   * @param {ActionContext} discoveryContext Context for scope resolution.
   * @returns {object} The runtime context for scope evaluation.
   * @private
   */
  #buildRuntimeContext(actorEntity, discoveryContext) {
    return {
      entityManager: this.#entityManager,
      jsonLogicEval: this.#jsonLogicEvalService,
      logger: this.#logger,
      actor: actorEntity,
      location: discoveryContext.currentLocation,
    };
  }

  /**
   * Logs a resolution error and dispatches a system error event.
   *
   * @description Logs a resolution error and dispatches a system error event.
   * @param {string} message - User-friendly error message.
   * @param {object} details - Supplemental diagnostic information.
   * @param {TraceContext|null} trace - Optional trace used for logging.
   * @param {string} source - Originating service or method name.
   * @param {Error|null} [originalError] - The original error instance, if any.
   * @returns {void}
   * @private
   */
  #handleResolutionError(
    message,
    details,
    trace,
    source,
    originalError = null
  ) {
    trace?.error(message, source, details);
    originalError
      ? this.#logger.error(message, originalError)
      : this.#logger.warn(message);
    this.#safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message,
      details,
    });
  }
}
