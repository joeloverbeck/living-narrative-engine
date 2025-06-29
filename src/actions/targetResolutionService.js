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
/** @typedef {import('../types/runtimeContext.js').RuntimeContext} RuntimeContext */
/** @typedef {import('../scopeDsl/IDslParser.js').IDslParser} IDslParser */

import { ITargetResolutionService } from '../interfaces/ITargetResolutionService.js';
import { ActionTargetContext } from '../models/actionTargetContext.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../constants/targetDomains.js';
import { setupService } from '../utils/serviceInitializerUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';

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
  #dslParser;

  /**
   * Creates an instance of TargetResolutionService.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ScopeRegistry} deps.scopeRegistry - Registry for named scopes.
   * @param {IScopeEngine} deps.scopeEngine - Engine used to resolve scopes.
   * @param {IEntityManager} deps.entityManager - Entity manager for lookups.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Dispatches system errors.
   * @param {JsonLogicEvaluationService} deps.jsonLogicEvaluationService - Service to evaluate JsonLogic.
   * @param {IDslParser} deps.dslParser - Parser used for Scope-DSL expressions.
   */
  constructor({
    scopeRegistry,
    scopeEngine,
    entityManager,
    logger,
    safeEventDispatcher,
    jsonLogicEvaluationService,
    dslParser,
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
      dslParser: { value: dslParser, requiredMethods: ['parse'] },
    });
    this.#scopeRegistry = scopeRegistry;
    this.#scopeEngine = scopeEngine;
    this.#entityManager = entityManager;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#jsonLogicEvalService = jsonLogicEvaluationService;
    this.#dslParser = dslParser;
  }

  /**
   * Resolves a target scope name into actionable target contexts.
   *
   * @override
   * @param {string} scopeName - The name of the scope to resolve.
   * @param {Entity} actorEntity - The entity performing the action.
   * @param {ActionContext} discoveryContext - Context for DSL evaluation.
   * @param {TraceContext|null} [trace] - Optional tracing instance.
   * @returns {import('./resolutionResult.js').ResolutionResult} Resolved targets and optional error.
   */
  resolveTargets(scopeName, actorEntity, discoveryContext, trace = null) {
    const source = 'TargetResolutionService.resolveTargets';
    trace?.info(`Resolving scope '${scopeName}'.`, source);

    if (scopeName === TARGET_DOMAIN_NONE) {
      trace?.info(
        `Scope is 'none'; returning a single no-target context.`,
        source
      );
      return { targets: [ActionTargetContext.noTarget()] };
    }

    if (scopeName === TARGET_DOMAIN_SELF) {
      trace?.info(
        `Scope is 'self'; returning the actor as the target.`,
        source
      );
      return { targets: [ActionTargetContext.forEntity(actorEntity.id)] };
    }

    const { ids: targetIds, error } = this.#resolveScopeToIds(
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
    return {
      targets: Array.from(targetIds, (id) => ActionTargetContext.forEntity(id)),
      error,
    };
  }

  /**
   * Resolves a DSL scope definition to a set of entity IDs.
   *
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
      return { ids: new Set(), error: new Error(errorMessage) };
    }

    try {
      let ast = scopeDefinition.ast;
      if (!ast) {
        trace?.info(
          `Parsing expression for scope '${scopeName}' on demand.`,
          source
        );
        ast = this.#dslParser.parse(scopeDefinition.expr);
      } else {
        trace?.info(`Using pre-parsed AST for scope '${scopeName}'.`, source);
      }

      const runtimeCtx = this.#buildRuntimeContext(
        actorEntity,
        discoveryContext
      );
      return {
        ids:
          this.#scopeEngine.resolve(ast, actorEntity, runtimeCtx, trace) ??
          new Set(),
      };
    } catch (error) {
      const errorMessage = `Error resolving scope '${scopeName}': ${error.message}`;
      this.#handleResolutionError(
        errorMessage,
        { error: error.message, stack: error.stack },
        trace,
        source,
        error
      );
      return { ids: new Set(), error };
    }
  }

  /**
   * Builds the runtime context passed to the scope engine.
   *
   * @param {Entity} actorEntity The current actor entity.
   * @param {ActionContext} discoveryContext Context for scope resolution.
   * @returns {RuntimeContext} The runtime context for scope evaluation.
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
