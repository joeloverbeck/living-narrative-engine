/**
 * @file Unified scope resolver service that consolidates scope resolution logic
 * @see specs/unified-scope-resolver-consolidation-spec.md
 */

/** @typedef {import('../../interfaces/IScopeEngine.js').IScopeEngine} IScopeEngine */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../../scopeDsl/scopeRegistry.js').default} ScopeRegistry */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../scopeDsl/IDslParser.js').IDslParser} IDslParser */
/** @typedef {import('../errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */
/** @typedef {import('../tracing/traceContext.js').TraceContext} TraceContext */
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../types/runtimeContext.js').RuntimeContext} RuntimeContext */

import { validateDependency } from '../../utils/validationUtils.js';
import { ActionResult } from '../core/actionResult.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../../constants/targetDomains.js';
import { ERROR_PHASES } from '../errors/actionErrorTypes.js';

/**
 * @typedef {Object} ScopeResolutionContext
 * @property {Entity} actor - The entity performing the action
 * @property {string} actorLocation - Current location of the actor
 * @property {ActionContext} actionContext - Full action context for evaluation
 * @property {TraceContext} [trace] - Optional trace for debugging
 * @property {string} [actionId] - Optional action ID for error context
 */

/**
 * @typedef {Object} ScopeResolutionOptions
 * @property {boolean} [useCache=true] - Whether to use cached results
 * @property {number} [cacheTTL=5000] - Cache time-to-live in milliseconds
 * @property {boolean} [includeMetadata=false] - Include resolution metadata
 * @property {boolean} [validateEntities=true] - Validate resolved entities exist
 */

/**
 * Unified service for resolving scopes to entity IDs with caching and consistent error handling.
 * Consolidates scope resolution logic previously embedded in TargetResolutionService.
 *
 * @class UnifiedScopeResolver
 */
export class UnifiedScopeResolver {
  #scopeRegistry;
  #scopeEngine;
  #entityManager;
  #jsonLogicEvaluationService;
  #dslParser;
  #logger;
  #actionErrorContextBuilder;
  #cacheStrategy;

  /**
   * Creates an instance of UnifiedScopeResolver.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ScopeRegistry} deps.scopeRegistry - Registry for named scopes.
   * @param {IScopeEngine} deps.scopeEngine - Engine used to resolve scopes.
   * @param {IEntityManager} deps.entityManager - Entity manager for lookups.
   * @param {JsonLogicEvaluationService} deps.jsonLogicEvaluationService - Service to evaluate JsonLogic.
   * @param {IDslParser} deps.dslParser - Parser used for Scope-DSL expressions.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {ActionErrorContextBuilder} deps.actionErrorContextBuilder - Builds enhanced error contexts.
   * @param {Object} [deps.cacheStrategy] - Optional cache strategy implementation.
   */
  constructor({
    scopeRegistry,
    scopeEngine,
    entityManager,
    jsonLogicEvaluationService,
    dslParser,
    logger,
    actionErrorContextBuilder,
    cacheStrategy,
  }) {
    validateDependency(scopeRegistry, 'ScopeRegistry', undefined, {
      requiredMethods: ['getScope'],
    });
    validateDependency(scopeEngine, 'IScopeEngine', undefined, {
      requiredMethods: ['resolve'],
    });
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(
      jsonLogicEvaluationService,
      'JsonLogicEvaluationService',
      undefined,
      {
        requiredMethods: ['evaluate'],
      }
    );
    validateDependency(dslParser, 'IDslParser', undefined, {
      requiredMethods: ['parse'],
    });
    validateDependency(logger, 'ILogger');
    validateDependency(
      actionErrorContextBuilder,
      'ActionErrorContextBuilder',
      undefined,
      {
        requiredMethods: ['buildErrorContext'],
      }
    );

    this.#scopeRegistry = scopeRegistry;
    this.#scopeEngine = scopeEngine;
    this.#entityManager = entityManager;
    this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
    this.#dslParser = dslParser;
    this.#logger = logger.child({ service: 'UnifiedScopeResolver' });
    this.#actionErrorContextBuilder = actionErrorContextBuilder;
    this.#cacheStrategy = cacheStrategy;
  }

  /**
   * Resolves a scope to entity IDs with consistent error handling.
   *
   * @param {string} scopeName - The scope to resolve
   * @param {ScopeResolutionContext} context - Resolution context
   * @param {ScopeResolutionOptions} [options={}] - Resolution options
   * @returns {Promise<ActionResult>} ActionResult containing Set of entity IDs or errors
   */
  async resolve(scopeName, context, options = {}) {
    const source = 'UnifiedScopeResolver.resolve';
    const {
      useCache = true,
      cacheTTL = 5000,
      includeMetadata = false,
      validateEntities = true,
    } = options;

    context.trace?.info(`Resolving scope '${scopeName}'.`, source);

    // Validate context
    const contextValidation = this.#validateContext(context, scopeName);
    if (!contextValidation.success) {
      return contextValidation;
    }

    // Handle special scopes
    const specialScopeResult = this.#handleSpecialScopes(scopeName, context);
    if (specialScopeResult !== null) {
      context.trace?.info(
        `Resolved special scope '${scopeName}'.`,
        source,
        { entityCount: specialScopeResult.value.size }
      );
      return specialScopeResult;
    }

    // Check cache if enabled
    if (useCache && this.#cacheStrategy) {
      const cacheKey = this.#cacheStrategy.generateKey(scopeName, context);
      const cachedResult = await this.#cacheStrategy.get(
        cacheKey,
        () => this.#resolveScopeInternal(scopeName, context, validateEntities),
        cacheTTL
      );

      if (cachedResult.success) {
        context.trace?.info(
          `Resolved scope '${scopeName}' from cache.`,
          source,
          { entityCount: cachedResult.value.size }
        );
        return cachedResult;
      }
    }

    // Resolve without cache
    const result = await this.#resolveScopeInternal(
      scopeName,
      context,
      validateEntities
    );

    if (result.success) {
      context.trace?.info(
        `Resolved scope '${scopeName}' to ${result.value.size} entities.`,
        source,
        { entityIds: Array.from(result.value) }
      );
    }

    return result;
  }

  /**
   * Batch resolves multiple scopes efficiently.
   *
   * @param {Array<{scopeName: string, context: ScopeResolutionContext}>} requests - Batch resolution requests
   * @param {ScopeResolutionOptions} [options={}] - Resolution options
   * @returns {Promise<ActionResult>} ActionResult containing Map of scope names to entity ID sets
   */
  async resolveBatch(requests, options = {}) {
    const source = 'UnifiedScopeResolver.resolveBatch';
    const results = new Map();
    const errors = [];

    this.#logger.info(
      `Batch resolving ${requests.length} scopes.`,
      { source }
    );

    // Process requests in parallel for efficiency
    const resolutionPromises = requests.map(async ({ scopeName, context }) => {
      const result = await this.resolve(scopeName, context, options);
      return { scopeName, result };
    });

    const resolutions = await Promise.all(resolutionPromises);

    // Collect results and errors
    for (const { scopeName, result } of resolutions) {
      if (result.success) {
        results.set(scopeName, result.value);
      } else {
        errors.push(...result.errors.map(err => ({
          ...err,
          scopeName, // Add scope context to errors
        })));
      }
    }

    if (errors.length > 0) {
      return ActionResult.failure(errors);
    }

    return ActionResult.success(results);
  }

  /**
   * Validates the resolution context.
   *
   * @param {ScopeResolutionContext} context - The context to validate
   * @param {string} scopeName - The scope being resolved
   * @returns {ActionResult} Success if valid, failure with error context
   * @private
   */
  #validateContext(context, scopeName) {
    const source = 'UnifiedScopeResolver.#validateContext';

    if (!context || !context.actor) {
      const error = new Error('Resolution context is missing actor entity');
      error.name = 'InvalidContextError';
      const errorContext = this.#buildEnhancedError(
        error,
        scopeName,
        context,
        ERROR_PHASES.VALIDATION
      );
      return ActionResult.failure(errorContext);
    }

    if (!context.actor.id || typeof context.actor.id !== 'string') {
      const error = new Error(
        `Invalid actor entity ID: ${JSON.stringify(context.actor.id)}`
      );
      error.name = 'InvalidActorIdError';
      const errorContext = this.#buildEnhancedError(
        error,
        scopeName,
        context,
        ERROR_PHASES.VALIDATION
      );
      return ActionResult.failure(errorContext);
    }

    if (!context.actorLocation) {
      const error = new Error('Resolution context is missing actor location');
      error.name = 'InvalidContextError';
      const errorContext = this.#buildEnhancedError(
        error,
        scopeName,
        context,
        ERROR_PHASES.VALIDATION
      );
      return ActionResult.failure(errorContext);
    }

    return ActionResult.success();
  }

  /**
   * Handles special scope names that don't require DSL resolution.
   *
   * @param {string} scopeName - The scope name
   * @param {ScopeResolutionContext} context - Resolution context
   * @returns {ActionResult|null} Result if special scope, null otherwise
   * @private
   */
  #handleSpecialScopes(scopeName, context) {
    switch (scopeName) {
      case TARGET_DOMAIN_NONE:
        return ActionResult.success(new Set());

      case TARGET_DOMAIN_SELF:
        return ActionResult.success(new Set([context.actor.id]));

      default:
        return null; // Not a special scope
    }
  }

  /**
   * Internal scope resolution logic.
   *
   * @param {string} scopeName - The scope to resolve
   * @param {ScopeResolutionContext} context - Resolution context
   * @param {boolean} validateEntities - Whether to validate resolved entities
   * @returns {Promise<ActionResult>} Result with entity IDs or errors
   * @private
   */
  async #resolveScopeInternal(scopeName, context, validateEntities) {
    const source = 'UnifiedScopeResolver.#resolveScopeInternal';

    // Get scope definition
    const scopeDefinition = this.#scopeRegistry.getScope(scopeName);
    if (!scopeDefinition || !scopeDefinition.expr?.trim()) {
      const error = new Error(
        `Missing scope definition: Scope '${scopeName}' not found or has no expression`
      );
      error.name = 'ScopeNotFoundError';
      const errorContext = this.#buildEnhancedError(
        error,
        scopeName,
        context,
        ERROR_PHASES.VALIDATION
      );
      return ActionResult.failure(errorContext);
    }

    // Parse AST
    const astResult = this.#parseAst(scopeDefinition, scopeName, context);
    if (!astResult.success) {
      return astResult;
    }

    // Build actor with components
    const actorResult = await this.#buildActorWithComponents(
      context.actor,
      context
    );
    if (!actorResult.success) {
      return actorResult;
    }

    // Build runtime context
    const runtimeCtx = this.#buildRuntimeContext(
      actorResult.value,
      context
    );

    // Resolve scope
    try {
      const resolvedIds = this.#scopeEngine.resolve(
        astResult.value,
        actorResult.value,
        runtimeCtx,
        context.trace
      );

      if (!resolvedIds || !(resolvedIds instanceof Set)) {
        throw new Error(
          `Scope engine returned invalid result: ${typeof resolvedIds}`
        );
      }

      // Optionally validate entities exist
      if (validateEntities && resolvedIds.size > 0) {
        const validationResult = await this.#validateResolvedEntities(
          resolvedIds,
          scopeName,
          context
        );
        if (!validationResult.success) {
          return validationResult;
        }
      }

      return ActionResult.success(resolvedIds);
    } catch (error) {
      const errorContext = this.#buildEnhancedError(
        error,
        scopeName,
        context,
        ERROR_PHASES.SCOPE_RESOLUTION,
        {
          scopeExpression: scopeDefinition.expr,
          actorLocation: actorResult.value?.location || context.actorLocation,
        }
      );
      return ActionResult.failure(errorContext);
    }
  }

  /**
   * Parses the AST for a scope definition.
   *
   * @param {object} scopeDefinition - The scope definition
   * @param {string} scopeName - The scope name
   * @param {ScopeResolutionContext} context - Resolution context
   * @returns {ActionResult} Result containing the parsed AST or error
   * @private
   */
  #parseAst(scopeDefinition, scopeName, context) {
    const source = 'UnifiedScopeResolver.#parseAst';

    try {
      if (scopeDefinition.ast) {
        context.trace?.info(
          `Using pre-parsed AST for scope '${scopeName}'.`,
          source
        );
        return ActionResult.success(scopeDefinition.ast);
      }

      context.trace?.info(
        `Parsing expression for scope '${scopeName}' on demand.`,
        source
      );
      const ast = this.#dslParser.parse(scopeDefinition.expr);
      return ActionResult.success(ast);
    } catch (error) {
      error.name = 'ScopeParseError';
      const errorContext = this.#buildEnhancedError(
        error,
        scopeName,
        context,
        ERROR_PHASES.VALIDATION,
        {
          scopeExpression: scopeDefinition.expr,
        }
      );
      return ActionResult.failure(errorContext);
    }
  }

  /**
   * Builds actor entity with components loaded.
   *
   * @param {Entity} actorEntity - The actor entity
   * @param {ScopeResolutionContext} context - Resolution context
   * @returns {Promise<ActionResult>} Result containing actor with components or error
   * @private
   */
  async #buildActorWithComponents(actorEntity, context) {
    const source = 'UnifiedScopeResolver.#buildActorWithComponents';

    try {
      // If actor already has components, return as-is
      if (actorEntity.components) {
        return ActionResult.success(actorEntity);
      }

      // If no component type IDs, create empty components
      if (!actorEntity.componentTypeIds?.length) {
        context.trace?.warn(
          `Actor entity ${actorEntity.id} has no components.`,
          source
        );
        const actorWithComponents = {
          ...actorEntity,
          id: actorEntity.id, // Preserve ID getter
          components: {},
        };
        return ActionResult.success(actorWithComponents);
      }

      // Build components
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
          componentErrors.push({
            componentTypeId,
            error: error.message,
          });
          context.trace?.error(
            `Failed to load component ${componentTypeId}: ${error.message}`,
            source
          );
        }
      }

      // Continue with partial data if we got some components
      if (componentErrors.length > 0 && Object.keys(components).length === 0) {
        const error = new Error('Failed to load any components for actor');
        error.componentErrors = componentErrors;
        return ActionResult.failure(error);
      }

      const actorWithComponents = {
        ...actorEntity,
        id: actorEntity.id, // Preserve ID getter
        components,
      };

      return ActionResult.success(actorWithComponents);
    } catch (error) {
      return ActionResult.failure(error);
    }
  }

  /**
   * Builds the runtime context for scope evaluation.
   *
   * @param {Entity} actorEntity - The actor entity with components
   * @param {ScopeResolutionContext} context - Resolution context
   * @returns {RuntimeContext} The runtime context
   * @private
   */
  #buildRuntimeContext(actorEntity, context) {
    return {
      entityManager: this.#entityManager,
      jsonLogicEval: this.#jsonLogicEvaluationService,
      logger: this.#logger,
      actor: actorEntity,
      location: context.actorLocation,
    };
  }

  /**
   * Validates that resolved entities exist.
   *
   * @param {Set<string>} entityIds - The resolved entity IDs
   * @param {string} scopeName - The scope name
   * @param {ScopeResolutionContext} context - Resolution context
   * @returns {Promise<ActionResult>} Success or validation errors
   * @private
   */
  async #validateResolvedEntities(entityIds, scopeName, context) {
    const invalidIds = [];

    for (const entityId of entityIds) {
      try {
        const exists = this.#entityManager.getEntity(entityId);
        if (!exists) {
          invalidIds.push(entityId);
        }
      } catch (error) {
        invalidIds.push(entityId);
      }
    }

    if (invalidIds.length > 0) {
      const error = new Error(
        `Scope '${scopeName}' resolved to ${invalidIds.length} non-existent entities`
      );
      error.name = 'InvalidResolvedEntitiesError';
      error.invalidEntityIds = invalidIds;
      const errorContext = this.#buildEnhancedError(
        error,
        scopeName,
        context,
        ERROR_PHASES.VALIDATION,
        {
          invalidEntityIds,
          totalResolved: entityIds.size,
        }
      );
      return ActionResult.failure(errorContext);
    }

    return ActionResult.success();
  }

  /**
   * Builds enhanced error context with suggestions.
   *
   * @param {Error} error - The original error
   * @param {string} scopeName - The scope name
   * @param {ScopeResolutionContext} context - Resolution context
   * @param {string} phase - The error phase
   * @param {object} [additionalContext={}] - Additional context
   * @returns {object} Enhanced error context
   * @private
   */
  #buildEnhancedError(error, scopeName, context, phase, additionalContext = {}) {
    const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
      error: error,
      actionDef: context.actionId ? { id: context.actionId } : null,
      actorId: context.actor?.id,
      phase: phase,
      trace: context.trace,
      additionalContext: {
        scopeName: scopeName,
        actorLocation: context.actorLocation,
        suggestions: this.#generateFixSuggestions(error, scopeName),
        ...additionalContext,
      },
    });

    return errorContext;
  }

  /**
   * Generates fix suggestions based on the error type.
   *
   * @param {Error} error - The error
   * @param {string} scopeName - The scope name
   * @returns {Array<string>} Array of suggestions
   * @private
   */
  #generateFixSuggestions(error, scopeName) {
    const suggestions = [];

    switch (error.name) {
      case 'ScopeNotFoundError':
        suggestions.push(
          `Verify scope '${scopeName}' is defined in a loaded mod`,
          'Check for typos in the scope name',
          'Ensure the mod containing this scope is loaded'
        );
        break;

      case 'ScopeParseError':
        suggestions.push(
          'Check the scope expression syntax',
          'Verify all operators and functions are valid',
          'Ensure quotes and brackets are balanced'
        );
        break;

      case 'InvalidActorIdError':
        suggestions.push(
          'Ensure the actor entity is properly initialized',
          'Verify the entity ID is a valid string',
          'Check that the entity exists in the entity manager'
        );
        break;

      case 'InvalidResolvedEntitiesError':
        suggestions.push(
          'Verify the scope expression returns valid entity IDs',
          'Check that referenced entities exist in the current context',
          'Ensure entity lifecycle is properly managed'
        );
        break;

      default:
        suggestions.push(
          'Check the scope expression for errors',
          'Verify all required data is available',
          'Review the action and scope configuration'
        );
    }

    return suggestions;
  }
}

export default UnifiedScopeResolver;