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
import { ActionResult } from './core/actionResult.js';

/**
 * Service for resolving action target scopes using the Result pattern.
 * This is a refactored version that uses ActionResult for consistent error handling.
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
   * This method maintains the original interface for backward compatibility,
   * but internally uses ActionResult for better error handling.
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
    const result = this.resolveTargetsWithResult(
      scopeName,
      actorEntity,
      discoveryContext,
      trace,
      actionId
    );

    // Convert ActionResult back to legacy format for backward compatibility
    if (result.success) {
      return { targets: result.value };
    } else {
      // Extract the first error for backward compatibility
      const error = result.errors[0];
      return { targets: [], error };
    }
  }

  /**
   * Resolves a target scope name into actionable target contexts using ActionResult.
   *
   * @param {string} scopeName - The name of the scope to resolve.
   * @param {Entity} actorEntity - The entity performing the action.
   * @param {ActionContext} discoveryContext - Context for DSL evaluation.
   * @param {TraceContext|null} [trace] - Optional tracing instance.
   * @param {string} [actionId] - Optional action ID for error context.
   * @returns {ActionResult<ActionTargetContext[]>} Result containing resolved targets or errors.
   */
  resolveTargetsWithResult(
    scopeName,
    actorEntity,
    discoveryContext,
    trace = null,
    actionId = null
  ) {
    const source = 'TargetResolutionService.resolveTargetsWithResult';
    trace?.info(`Resolving scope '${scopeName}'.`, source);

    // Validate actor entity
    const actorValidation = this.#validateActorEntity(
      actorEntity,
      scopeName,
      trace,
      actionId
    );
    if (!actorValidation.success) {
      return actorValidation;
    }

    // Handle special scope names
    if (scopeName === TARGET_DOMAIN_NONE) {
      trace?.info(
        `Scope is 'none'; returning a single no-target context.`,
        source
      );
      return ActionResult.success([ActionTargetContext.noTarget()]);
    }

    if (scopeName === TARGET_DOMAIN_SELF) {
      trace?.info(
        `Scope is 'self'; returning the actor as the target.`,
        source
      );
      return ActionResult.success([
        ActionTargetContext.forEntity(actorEntity.id),
      ]);
    }

    // Resolve DSL scope
    return this.#resolveScopeToIds(
      scopeName,
      actorEntity,
      discoveryContext,
      trace,
      actionId
    ).map((ids) => {
      trace?.info(
        `DSL scope '${scopeName}' resolved to ${ids.size} target(s).`,
        source,
        { targetIds: Array.from(ids) }
      );
      return Array.from(ids, (id) => ActionTargetContext.forEntity(id));
    });
  }

  /**
   * Validates the actor entity.
   *
   * @param {Entity} actorEntity - The entity to validate.
   * @param {string} scopeName - The scope being resolved.
   * @param {TraceContext|null} trace - Optional tracing instance.
   * @param {string} actionId - Optional action ID for error context.
   * @returns {ActionResult<void>} Success if valid, failure with error context.
   * @private
   */
  #validateActorEntity(actorEntity, scopeName, trace, actionId) {
    const source = 'TargetResolutionService.#validateActorEntity';

    if (!actorEntity) {
      const errorMessage = 'Actor entity is null or undefined';
      this.#logger.error(errorMessage);
      trace?.error(errorMessage, source);

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
      return ActionResult.failure(errorContext);
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
      return ActionResult.failure(errorContext);
    }

    return ActionResult.success();
  }

  /**
   * Resolves a DSL scope definition to a set of entity IDs.
   *
   * @param {string} scopeName - Name of the scope definition.
   * @param {Entity} actorEntity - The entity initiating the resolution.
   * @param {ActionContext} discoveryContext - Context for evaluating scope rules.
   * @param {TraceContext|null} [trace] - Optional tracing instance.
   * @param {string} [actionId] - Optional action ID for error context.
   * @returns {ActionResult<Set<string>>} Result containing the set of resolved entity IDs or errors.
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

    // Get scope definition
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
      return ActionResult.failure(errorContext);
    }

    // Parse AST if needed
    const astResult = this.#parseAst(scopeDefinition, scopeName, trace, source);
    if (!astResult.success) {
      return astResult;
    }

    // Build actor with components
    const actorResult = this.#buildActorWithComponents(
      actorEntity,
      trace,
      source
    );
    if (!actorResult.success) {
      return actorResult;
    }

    const actorWithComponents = actorResult.value;
    const ast = astResult.value;

    // Build runtime context
    const runtimeCtx = this.#buildRuntimeContext(
      actorWithComponents,
      discoveryContext
    );

    // Validate runtime context
    if (!runtimeCtx || !runtimeCtx.entityManager) {
      const error = new Error(
        'Invalid runtime context: missing entity manager'
      );
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
      return ActionResult.failure(errorContext);
    }

    // Resolve scope using engine
    try {
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

      return ActionResult.success(resolvedIds);
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
      return ActionResult.failure(errorContext);
    }
  }

  /**
   * Parses the AST for a scope definition.
   *
   * @param {object} scopeDefinition - The scope definition.
   * @param {string} scopeName - The scope name.
   * @param {TraceContext|null} trace - Optional tracing instance.
   * @param {string} source - The source method name.
   * @returns {ActionResult<object>} Result containing the parsed AST or error.
   * @private
   */
  #parseAst(scopeDefinition, scopeName, trace, source) {
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
      return ActionResult.success(ast);
    } catch (error) {
      const errorMessage = `Failed to parse scope expression for '${scopeName}': ${error.message}`;
      this.#logger.error(errorMessage, error);
      trace?.error(errorMessage, source);

      error.name = 'ScopeParseError';
      return ActionResult.failure(error);
    }
  }

  /**
   * Builds actor entity with components loaded.
   *
   * @param {Entity} actorEntity - The actor entity.
   * @param {TraceContext|null} trace - Optional tracing instance.
   * @param {string} source - The source method name.
   * @returns {ActionResult<Entity>} Result containing actor with components or error.
   * @private
   */
  #buildActorWithComponents(actorEntity, trace, source) {
    try {
      // If actor already has components, return as-is
      if (actorEntity && actorEntity.components) {
        return ActionResult.success(actorEntity);
      }

      // If no component type IDs, create empty components
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
        const actorWithComponents = {
          ...actorEntity,
          id: actorEntity.id, // Explicitly preserve the ID getter
          definitionId: actorEntity.definitionId, // Preserve other critical getters
          componentTypeIds: actorEntity.componentTypeIds,
          components: {},
        };
        return ActionResult.success(actorWithComponents);
      }

      // Build components for the actor entity
      const components = {};
      const componentErrors = [];

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
          const errorMessage = `Failed to get component data for ${componentTypeId} on actor ${actorEntity.id}: ${error.message}`;
          trace?.error(errorMessage, source);
          componentErrors.push(new Error(errorMessage));
        }
      }

      // If we had errors loading components but got some, continue with partial data
      if (componentErrors.length > 0 && Object.keys(components).length === 0) {
        // All component loads failed
        return ActionResult.failure(componentErrors);
      }

      // Create a new actor entity object with components
      // IMPORTANT: Preserve Entity class getters (especially 'id') that are lost with spread operator
      const actorWithComponents = {
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

      return ActionResult.success(actorWithComponents);
    } catch (error) {
      const errorMessage = `Failed to build actor with components: ${error.message}`;
      this.#logger.error(errorMessage, error);
      trace?.error(errorMessage, source);
      return ActionResult.failure(error);
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
    if (actionId || actorId) {
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

export default TargetResolutionService;
