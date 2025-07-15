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
/** @typedef {import('./errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */

import { ITargetResolutionService } from '../interfaces/ITargetResolutionService.js';
import { ActionTargetContext } from '../models/actionTargetContext.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../constants/targetDomains.js';
import { ServiceSetup } from '../utils/serviceInitializerUtils.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import { ERROR_PHASES } from './errors/actionErrorTypes.js';

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
  #actionErrorContextBuilder;

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
   * @param {ActionErrorContextBuilder} deps.actionErrorContextBuilder - Builds enhanced error contexts.
   * @param {ServiceSetup} [deps.serviceSetup] - Optional service setup helper.
   */
  constructor({
    scopeRegistry,
    scopeEngine,
    entityManager,
    logger,
    serviceSetup,
    safeEventDispatcher,
    jsonLogicEvaluationService,
    dslParser,
    actionErrorContextBuilder,
  }) {
    super();
    const setup = serviceSetup ?? new ServiceSetup();
    this.#logger = setup.setupService('TargetResolutionService', logger, {
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
      actionErrorContextBuilder: {
        value: actionErrorContextBuilder,
        requiredMethods: ['buildErrorContext'],
      },
    });
    this.#scopeRegistry = scopeRegistry;
    this.#scopeEngine = scopeEngine;
    this.#entityManager = entityManager;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#jsonLogicEvalService = jsonLogicEvaluationService;
    this.#dslParser = dslParser;
    this.#actionErrorContextBuilder = actionErrorContextBuilder;
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
   * @returns {import('./resolutionResult.js').ResolutionResult} Resolved targets and optional error.
   */
  resolveTargets(
    scopeName,
    actorEntity,
    discoveryContext,
    trace = null,
    actionId = null
  ) {
    const source = 'TargetResolutionService.resolveTargets';
    trace?.info(`Resolving scope '${scopeName}'.`, source);

    // Comprehensive actor entity validation
    if (!actorEntity) {
      const errorMessage = 'Actor entity is null or undefined';
      this.#logger.error(errorMessage);
      trace?.error(errorMessage, source);

      if (this.#actionErrorContextBuilder) {
        const error = new Error(errorMessage);
        error.name = 'InvalidActorError';
        const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
          error: error,
          actionDef: actionId ? { id: actionId } : null,
          actorId: null,
          phase: ERROR_PHASES.VALIDATION,
          trace: trace,
          additionalContext: {
            scopeName: scopeName,
            source: source,
          },
        });
        return { targets: [], error: errorContext };
      }

      return { targets: [], error: new Error(errorMessage) };
    }

    if (
      !actorEntity.id ||
      typeof actorEntity.id !== 'string' ||
      actorEntity.id === 'undefined'
    ) {
      const errorMessage = `Invalid actor entity ID: ${JSON.stringify(actorEntity.id)} (type: ${typeof actorEntity.id})`;
      const errorDetails = {
        actorEntity,
        actorId: actorEntity.id,
        actorIdType: typeof actorEntity.id,
        hasComponents: !!actorEntity.components,
        hasComponentTypeIds: !!actorEntity.componentTypeIds,
      };

      this.#logger.error(errorMessage, errorDetails);
      trace?.error(errorMessage, source);

      if (this.#actionErrorContextBuilder) {
        const error = new Error(errorMessage);
        error.name = 'InvalidActorIdError';
        const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
          error: error,
          actionDef: actionId ? { id: actionId } : null,
          actorId: actorEntity.id || 'invalid',
          phase: ERROR_PHASES.VALIDATION,
          trace: trace,
          additionalContext: {
            ...errorDetails,
            scopeName: scopeName,
            source: source,
          },
        });
        return { targets: [], error: errorContext };
      }

      return { targets: [], error: new Error(errorMessage) };
    }

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
      trace,
      actionId
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
   * @param {string} [actionId] - Optional action ID for error context.
   * @returns {{ids: Set<string>, error?: Error}} The set of resolved entity IDs and optional error.
   * @private
   */
  #resolveScopeToIds(
    scopeName,
    actorEntity,
    discoveryContext,
    trace = null,
    actionId = null
  ) {
    const source = 'TargetResolutionService.#resolveScopeToIds';
    trace?.info(`Resolving scope '${scopeName}' with DSL.`, source);
    const scopeDefinition = this.#scopeRegistry.getScope(scopeName);

    if (
      !scopeDefinition ||
      typeof scopeDefinition.expr !== 'string' ||
      !scopeDefinition.expr.trim()
    ) {
      const errorMessage = `Missing scope definition: Scope '${scopeName}' not found or has no expression in registry.`;
      const error = new Error(errorMessage);
      error.name = 'ScopeNotFoundError';

      this.#handleResolutionError(
        errorMessage,
        { scopeName },
        trace,
        source,
        error,
        actionId,
        actorEntity.id
      );

      if (this.#actionErrorContextBuilder) {
        const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
          error: error,
          actionDef: actionId ? { id: actionId } : null,
          actorId: actorEntity.id,
          phase: ERROR_PHASES.VALIDATION,
          trace: trace,
          additionalContext: {
            scopeName: scopeName,
            source: source,
          },
        });
        return { ids: new Set(), error: errorContext };
      }

      return { ids: new Set(), error: error };
    }

    // Declare actorWithComponents outside try block so it's available in catch block
    let actorWithComponents = actorEntity;

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

      // Ensure actor entity has components built before passing to scope engine
      // This is necessary for proper scope evaluation that depends on component state

      if (actorEntity && !actorEntity.components) {
        if (
          !actorEntity.componentTypeIds ||
          !Array.isArray(actorEntity.componentTypeIds)
        ) {
          trace?.warn(
            `Actor entity ${actorEntity.id} has no components or componentTypeIds`,
            source
          );
          // Create empty components object to prevent errors
          // IMPORTANT: Preserve Entity class getters (especially 'id') that are lost with spread operator
          actorWithComponents = {
            ...actorEntity,
            id: actorEntity.id, // Explicitly preserve the ID getter
            definitionId: actorEntity.definitionId, // Preserve other critical getters
            componentTypeIds: actorEntity.componentTypeIds,
            components: {},
          };
        } else {
          // Build components for the actor entity
          const components = {};
          for (const componentTypeId of actorEntity.componentTypeIds) {
            try {
              const data = this.#entityManager.getComponentData(
                actorEntity.id,
                componentTypeId
              );
              if (data) {
                components[componentTypeId] = data;
              }
            } catch (error) {
              trace?.error(
                `Failed to get component data for ${componentTypeId} on actor ${actorEntity.id}: ${error.message}`,
                source
              );
            }
          }

          // Create a new actor entity object with components
          // IMPORTANT: Preserve Entity class getters (especially 'id') that are lost with spread operator
          actorWithComponents = {
            ...actorEntity,
            id: actorEntity.id, // Explicitly preserve the ID getter
            definitionId: actorEntity.definitionId, // Preserve other critical getters
            componentTypeIds: actorEntity.componentTypeIds,
            components,
          };
          trace?.info(
            `Built ${Object.keys(components).length} components for actor ${actorEntity.id}`,
            source
          );
        }
      }

      const runtimeCtx = this.#buildRuntimeContext(
        actorWithComponents,
        discoveryContext
      );

      // Validate runtime context before proceeding
      if (!runtimeCtx || !runtimeCtx.entityManager) {
        throw new Error('Invalid runtime context: missing entity manager');
      }

      const resolvedIds = this.#scopeEngine.resolve(
        ast,
        actorWithComponents,
        runtimeCtx,
        trace
      );

      // Validate resolved IDs
      if (!resolvedIds || !(resolvedIds instanceof Set)) {
        throw new Error(
          `Scope engine returned invalid result: ${typeof resolvedIds}`
        );
      }

      return { ids: resolvedIds };
    } catch (error) {
      const errorMessage = `Error resolving scope '${scopeName}': ${error.message}`;

      this.#handleResolutionError(
        errorMessage,
        {
          error: error.message,
          stack: error.stack,
          scopeName: scopeName,
          actorLocation: actorWithComponents?.location || 'unknown',
        },
        trace,
        source,
        error,
        actionId,
        actorEntity.id
      );

      if (this.#actionErrorContextBuilder) {
        const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
          error: error,
          actionDef: actionId ? { id: actionId } : null,
          actorId: actorEntity.id,
          phase: ERROR_PHASES.VALIDATION,
          trace: trace,
          additionalContext: {
            scopeName: scopeName,
            source: source,
            actorLocation: actorWithComponents?.location || 'unknown',
            scopeExpression: scopeDefinition?.expr,
          },
        });
        return { ids: new Set(), error: errorContext };
      }

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
   * Handles resolution errors by building enhanced error contexts.
   *
   * @param {string} message - User-friendly error message.
   * @param {object} details - Supplemental diagnostic information.
   * @param {TraceContext|null} trace - Optional trace used for logging.
   * @param {string} source - Originating service or method name.
   * @param {Error|null} [originalError] - The original error instance, if any.
   * @param {string} [actionId] - Optional action ID for error context.
   * @param {string} [actorId] - Optional actor ID for error context.
   * @param {string} [targetId] - Optional target ID for error context.
   * @returns {void}
   * @private
   */
  #handleResolutionError(
    message,
    details,
    trace,
    source,
    originalError = null,
    actionId = null,
    actorId = null,
    targetId = null
  ) {
    trace?.error(message, source, details);

    const error = originalError || new Error(message);
    if (!originalError) {
      error.name = 'TargetResolutionError';
    }

    // If we have context information, build enhanced error context
    if (this.#actionErrorContextBuilder && (actionId || actorId)) {
      try {
        const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
          error: error,
          actionDef: actionId ? { id: actionId } : null,
          actorId: actorId,
          phase: ERROR_PHASES.VALIDATION,
          trace: trace,
          targetId: targetId,
          additionalContext: {
            ...details,
            source: source,
            scopeName: details.scopeName,
          },
        });

        // Dispatch enhanced error context
        safeDispatchError(
          this.#safeEventDispatcher,
          errorContext,
          null,
          this.#logger
        );
        return;
      } catch (contextError) {
        this.#logger.error('Failed to build error context', contextError);
        // Fall through to legacy error handling
      }
    }

    // Legacy error handling
    originalError
      ? this.#logger.error(message, originalError)
      : this.#logger.warn(message);

    // Standardize details structure
    const standardizedDetails = {
      ...details,
      scopeName: details.scopeName || source,
    };

    if (originalError) {
      standardizedDetails.error = originalError.message;
      standardizedDetails.stack = originalError.stack;
    }

    safeDispatchError(
      this.#safeEventDispatcher,
      message,
      standardizedDetails,
      this.#logger
    );
  }
}
