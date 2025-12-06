/** @typedef {import('../interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('./scopes/unifiedScopeResolver.js').UnifiedScopeResolver} UnifiedScopeResolver */
/** @typedef {import('./tracing/traceContext.js').TraceContext} TraceContext */

import { ITargetResolutionService } from '../interfaces/ITargetResolutionService.js';
import { ActionTargetContext } from '../models/actionTargetContext.js';
import { ServiceSetup } from '../utils/serviceInitializerUtils.js';
import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * Service for resolving action target scopes.
 * Delegates to UnifiedScopeResolver for actual scope resolution logic.
 *
 * @class TargetResolutionService
 * @augments ITargetResolutionService
 * @description Provides backward compatibility layer for target resolution.
 */
export class TargetResolutionService extends ITargetResolutionService {
  #unifiedScopeResolver;
  #logger;

  /**
   * Creates an instance of TargetResolutionService.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {UnifiedScopeResolver} deps.unifiedScopeResolver - Unified scope resolver service.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {ServiceSetup} [deps.serviceSetup] - Optional service setup helper.
   */
  constructor({ unifiedScopeResolver, logger, serviceSetup }) {
    super();
    const setup = serviceSetup ?? new ServiceSetup();

    validateDependency(
      unifiedScopeResolver,
      'UnifiedScopeResolver',
      undefined,
      {
        requiredMethods: ['resolve'],
      }
    );

    this.#logger = setup.setupService('TargetResolutionService', logger, {
      unifiedScopeResolver: {
        value: unifiedScopeResolver,
        requiredMethods: ['resolve'],
      },
    });

    this.#unifiedScopeResolver = unifiedScopeResolver;
  }

  /**
   * Resolves a target scope name into actionable target contexts.
   *
   * @override
   * @param {string} scopeName - The name of the scope to resolve.
   * @param {Entity} actorEntity - The entity performing the action.
   * @param {ActionContext} discoveryContext - Context for DSL evaluation.
   * @param {TraceContext|null} [trace] - Optional tracing instance.
   * @param {string} [actionId] - Optional action ID for error context.
   * @returns {ActionResult} Result containing resolved targets or errors.
   */
  resolveTargets(
    scopeName,
    actorEntity,
    discoveryContext,
    trace = null,
    actionId = null
  ) {
    // Support both old and new trace APIs
    if (trace?.withSpan) {
      return trace.withSpan(
        'target.resolve',
        () => {
          return this.#resolveTargetsInternal(
            scopeName,
            actorEntity,
            discoveryContext,
            trace,
            actionId
          );
        },
        {
          scopeName: scopeName,
          actorId: actorEntity?.id,
          actionId: actionId,
        }
      );
    }

    // Fallback to original implementation for backward compatibility
    return this.#resolveTargetsInternal(
      scopeName,
      actorEntity,
      discoveryContext,
      trace,
      actionId
    );
  }

  /**
   * Internal implementation of target resolution logic.
   *
   * @private
   * @param {string} scopeName - The name of the scope to resolve.
   * @param {Entity} actorEntity - The entity performing the action.
   * @param {ActionContext} discoveryContext - Context for DSL evaluation.
   * @param {TraceContext|null} [trace] - Optional tracing instance.
   * @param {string} [actionId] - Optional action ID for error context.
   * @returns {ActionResult} Result containing resolved targets or errors.
   */
  #resolveTargetsInternal(
    scopeName,
    actorEntity,
    discoveryContext,
    trace = null,
    actionId = null
  ) {
    const source = 'TargetResolutionService.resolveTargets';

    // Enhanced debug logging for sit_down action
    if (
      actionId === 'positioning:sit_down' ||
      scopeName === 'positioning:available_furniture'
    ) {
      this.#logger.debug('Resolving scope for sit_down', {
        scopeName,
        actionId,
        actorId: actorEntity?.id,
        actorLocation: discoveryContext?.currentLocation,
        hasDiscoveryContext: !!discoveryContext,
        discoveryContextKeys: discoveryContext
          ? Object.keys(discoveryContext)
          : null,
      });
    }

    trace?.info(
      `Delegating scope resolution for '${scopeName}' to UnifiedScopeResolver.`,
      source
    );

    // Build context for UnifiedScopeResolver
    const context = {
      actor: actorEntity,
      actorLocation: discoveryContext.currentLocation,
      actionContext: discoveryContext,
      trace: trace,
      actionId: actionId,
    };

    // Enhanced debug logging for sit_down action
    if (
      actionId === 'positioning:sit_down' ||
      scopeName === 'positioning:available_furniture'
    ) {
      this.#logger.debug('Context built for UnifiedScopeResolver', {
        hasActor: !!context.actor,
        actorId: context.actor?.id,
        actorLocation: context.actorLocation,
        hasActionContext: !!context.actionContext,
        actionContextEntityManager: !!context.actionContext?.entityManager,
      });
    }

    // Delegate to UnifiedScopeResolver
    const result = this.#unifiedScopeResolver.resolve(scopeName, context);

    // Enhanced debug logging for sit_down action
    if (
      actionId === 'positioning:sit_down' ||
      scopeName === 'positioning:available_furniture'
    ) {
      this.#logger.debug('UnifiedScopeResolver result for sit_down', {
        success: result.success,
        hasValue: !!result.value,
        valueSize: result.value ? result.value.size : 0,
        entities: result.value ? Array.from(result.value) : [],
      });
    }

    // Check if the resolution failed
    if (!result.success) {
      return result; // Return the failure as-is
    }

    // Transform the successful result to ActionTargetContext array
    const entityIds = result.value;

    // Handle special case for empty set
    if (entityIds.size === 0) {
      // Special handling for 'none' scope - it should return noTarget context
      if (scopeName === 'none') {
        trace?.info(
          `Scope 'none' resolved to no targets - returning noTarget context.`,
          source
        );
        return result.map(() => [ActionTargetContext.noTarget()]);
      }

      // For other scopes that resolve to empty set, return empty array
      trace?.info(`Scope '${scopeName}' resolved to no targets.`, source);
      return result.map(() => []);
    }

    trace?.info(
      `Scope '${scopeName}' resolved to ${entityIds.size} target(s).`,
      source,
      { targetIds: Array.from(entityIds) }
    );

    return result.map((ids) =>
      Array.from(ids, (id) => ActionTargetContext.forEntity(id))
    );
  }
}

export default TargetResolutionService;
