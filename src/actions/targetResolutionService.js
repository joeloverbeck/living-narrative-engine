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
import { parseDslExpression } from '../scopeDsl/parser.js';
import { setupService } from '../utils/serviceInitializerUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';
import { TRACE_INFO, TRACE_ERROR } from './tracing/traceContext.js';

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

  /** @override */
  async resolveTargets(scopeName, actorEntity, discoveryContext, trace = null) {
    const source = 'TargetResolutionService.resolveTargets';
    trace?.addLog(TRACE_INFO, `Resolving scope '${scopeName}'.`, source);

    if (scopeName === TARGET_DOMAIN_NONE) {
      trace?.addLog(
        TRACE_INFO,
        `Scope is 'none'; returning a single no-target context.`,
        source
      );
      return [ActionTargetContext.noTarget()];
    }

    if (scopeName === TARGET_DOMAIN_SELF) {
      trace?.addLog(
        TRACE_INFO,
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

    trace?.addLog(
      TRACE_INFO,
      `DSL scope '${scopeName}' resolved to ${targetIds.size} target(s).`,
      source,
      { targetIds: Array.from(targetIds) }
    );
    const targetContexts = [];
    for (const targetId of targetIds) {
      targetContexts.push(ActionTargetContext.forEntity(targetId));
    }
    return targetContexts;
  }

  /**
   * This entire method is moved from ActionDiscoveryService.
   *
   * @param scopeName
   * @param actorEntity
   * @param discoveryContext
   * @param trace
   */
  #resolveScopeToIds(scopeName, actorEntity, discoveryContext, trace = null) {
    const source = 'TargetResolutionService.#resolveScopeToIds';
    trace?.addLog(
      TRACE_INFO,
      `Resolving scope '${scopeName}' with DSL.`,
      source
    );
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
      const ast = parseDslExpression(scopeDefinition.expr);

      // The runtimeCtx now uses the service's own injected dependencies
      const runtimeCtx = {
        entityManager: this.#entityManager, // Already an injected dependency
        jsonLogicEval: this.#jsonLogicEvalService, // <-- USE INJECTED SERVICE
        logger: this.#logger, // Already an injected dependency
        actor: actorEntity,
        location: discoveryContext.currentLocation, // This comes from the lean context
      };
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
   * Centralizes the logging and event dispatching for resolution failures.
   *
   * @param message
   * @param details
   * @param trace
   * @param source
   * @param originalError
   */
  #handleResolutionError(
    message,
    details,
    trace,
    source,
    originalError = null
  ) {
    trace?.addLog(TRACE_ERROR, message, source, details);
    originalError
      ? this.#logger.error(message, originalError)
      : this.#logger.warn(message);
    this.#safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message,
      details,
    });
  }
}
