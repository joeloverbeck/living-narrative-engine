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
import RuntimeContextBuilder from '../scopeDsl/runtimeContextBuilder.js';
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
  #logger;
  #safeEventDispatcher;
  #runtimeContextBuilder;

  /**
   * @param {object} deps
   * @param {ScopeRegistry} deps.scopeRegistry
   * @param {IScopeEngine} deps.scopeEngine
   * @param {ILogger} deps.logger
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param {JsonLogicEvaluationService} deps.jsonLogicEvaluationService
   * @param {RuntimeContextBuilder} [deps.runtimeContextBuilder]
   */
  constructor({
    scopeRegistry,
    scopeEngine,
    logger,
    safeEventDispatcher,
    jsonLogicEvaluationService,
    runtimeContextBuilder,
  }) {
    super();
    this.#logger = setupService('TargetResolutionService', logger, {
      scopeRegistry: { value: scopeRegistry, requiredMethods: ['getScope'] },
      scopeEngine: { value: scopeEngine, requiredMethods: ['resolve'] },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      jsonLogicEvaluationService: {
        value: jsonLogicEvaluationService,
        requiredMethods: ['evaluate'],
      },
      runtimeContextBuilder: {
        value: runtimeContextBuilder,
        requiredMethods: ['build'],
      },
    });
    this.#scopeRegistry = scopeRegistry;
    this.#scopeEngine = scopeEngine;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#runtimeContextBuilder =
      runtimeContextBuilder ||
      new RuntimeContextBuilder({
        jsonLogicEvaluationService,
        logger,
      });
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
      const ast = scopeDefinition.ast;
      if (!ast) {
        const errorMessage = `Error resolving scope '${scopeName}': AST not available`;
        this.#handleResolutionError(errorMessage, { scopeName }, trace, source);
        return new Set();
      }

      const runtimeCtx = this.#runtimeContextBuilder.build(
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
