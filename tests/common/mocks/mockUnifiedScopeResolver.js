/**
 * @file Mock UnifiedScopeResolver for backward compatibility with TargetResolutionService tests
 *
 * This mock simulates the old TargetResolutionService behavior by using the
 * original dependencies to create a UnifiedScopeResolver-like interface.
 */

import { ActionResult } from '../../../src/actions/core/actionResult.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../../../src/constants/targetDomains.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';

/**
 * Creates a mock UnifiedScopeResolver from old TargetResolutionService dependencies
 *
 * @param {object} dependencies - The old dependencies
 * @returns {object} Mock UnifiedScopeResolver
 */
export function createMockUnifiedScopeResolver(dependencies) {
  const {
    scopeRegistry,
    scopeEngine,
    entityManager,
    logger,
    safeEventDispatcher,
    jsonLogicEvaluationService,
    dslParser,
    actionErrorContextBuilder,
  } = dependencies;

  return {
    resolve(scopeName, context) {
      const source = 'MockUnifiedScopeResolver.resolve';

      // TEMPORARY DIAGNOSTIC: Entry point
      console.debug(`[DIAGNOSTIC] MockUnifiedScopeResolver.resolve CALLED:`, {
        scopeName,
        hasContext: !!context,
        hasActor: !!context?.actor,
        actorId: context?.actor?.id,
      });

      // Log that we're resolving the scope
      context?.trace?.info(`Resolving scope '${scopeName}'.`, source);

      // Validate actor entity (matching UnifiedScopeResolver behavior)
      if (!context || !context.actor) {
        const error = new Error('Resolution context is missing actor entity');
        error.name = 'InvalidContextError';
        context?.trace?.error('Actor entity is null or undefined', source);
        const errorContext = actionErrorContextBuilder.buildErrorContext({
          error: error,
          actionDef: context?.actionId ? { id: context.actionId } : null,
          actorId: null,
          phase: ERROR_PHASES.VALIDATION,
          trace: context?.trace,
          additionalContext: {
            scopeName: scopeName,
            source: source,
          },
        });

        // Create enhanced error like UnifiedScopeResolver does
        const enhancedError = new Error(error.message);
        enhancedError.name = error.name;
        enhancedError.stack = error.stack;
        Object.assign(enhancedError, errorContext);

        return ActionResult.failure(enhancedError);
      }

      // Validate actor ID - reject null, non-strings, string 'undefined', string 'null', or empty strings
      if (
        !context.actor.id ||
        typeof context.actor.id !== 'string' ||
        context.actor.id === 'undefined' ||
        context.actor.id === 'null' ||
        context.actor.id.trim() === ''
      ) {
        const error = new Error(
          `Invalid actor entity ID: ${JSON.stringify(context.actor.id)}`
        );
        error.name = 'InvalidActorIdError';
        const errorContext = actionErrorContextBuilder.buildErrorContext({
          error: error,
          actionDef: context.actionId ? { id: context.actionId } : null,
          actorId: context.actor.id || 'invalid',
          phase: ERROR_PHASES.VALIDATION,
          trace: context.trace,
          additionalContext: {
            scopeName: scopeName,
            source: source,
            actorId: context.actor.id,
            actorIdType: typeof context.actor.id,
          },
        });

        // Create enhanced error like UnifiedScopeResolver does
        const enhancedError = new Error(error.message);
        enhancedError.name = error.name;
        enhancedError.stack = error.stack;
        Object.assign(enhancedError, errorContext);

        return ActionResult.failure(enhancedError);
      }

      // Handle special scopes
      if (scopeName === TARGET_DOMAIN_NONE) {
        return ActionResult.success(new Set());
      }

      if (scopeName === TARGET_DOMAIN_SELF) {
        return ActionResult.success(new Set([context.actor.id]));
      }

      // Get scope definition
      const scopeDefinition = scopeRegistry.getScope(scopeName);

      // TEMPORARY DIAGNOSTIC: Log scope lookup
      console.debug(`[DIAGNOSTIC] MockUnifiedScopeResolver scope lookup:`, {
        scopeName,
        found: !!scopeDefinition,
        hasExpr: !!scopeDefinition?.expr,
        expr: scopeDefinition?.expr,
      });

      // Check if scope definition exists
      if (!scopeDefinition) {
        const error = new Error(
          `Missing scope definition: Scope '${scopeName}' not found`
        );
        error.name = 'ScopeNotFoundError';

        const errorContext = actionErrorContextBuilder.buildErrorContext({
          error: error,
          actionDef: context.actionId ? { id: context.actionId } : null,
          actorId: context.actor?.id,
          phase: ERROR_PHASES.VALIDATION,
          trace: context.trace,
          additionalContext: {
            scopeName: scopeName,
            source: source,
          },
        });

        // Create enhanced error like UnifiedScopeResolver does
        const enhancedError = new Error(error.message);
        enhancedError.name = error.name;
        enhancedError.stack = error.stack;
        Object.assign(enhancedError, errorContext);

        return ActionResult.failure(enhancedError);
      }

      // Check if expression is a string and not empty
      if (
        !scopeDefinition.expr ||
        typeof scopeDefinition.expr !== 'string' ||
        !scopeDefinition.expr.trim()
      ) {
        const error = new Error(
          `Missing scope definition: Scope '${scopeName}' not found or has no expression`
        );
        error.name = 'ScopeNotFoundError';

        const errorContext = actionErrorContextBuilder.buildErrorContext({
          error: error,
          actionDef: context.actionId ? { id: context.actionId } : null,
          actorId: context.actor?.id,
          phase: ERROR_PHASES.VALIDATION,
          trace: context.trace,
          additionalContext: {
            scopeName: scopeName,
            source: source,
            expressionType: typeof scopeDefinition.expr,
            expressionValue: scopeDefinition.expr,
          },
        });

        // Create enhanced error like UnifiedScopeResolver does
        const enhancedError = new Error(error.message);
        enhancedError.name = error.name;
        enhancedError.stack = error.stack;
        Object.assign(enhancedError, errorContext);

        return ActionResult.failure(enhancedError);
      }

      // Parse AST
      let ast;
      try {
        if (scopeDefinition.ast) {
          context.trace?.info(
            `Using pre-parsed AST for scope '${scopeName}'.`,
            source
          );
          ast = scopeDefinition.ast;
        } else {
          context.trace?.info(
            `Parsing expression for scope '${scopeName}' on demand.`,
            source
          );
          try {
            ast = dslParser.parse(scopeDefinition.expr);
          } catch (parseError) {
            // Set the error name to match UnifiedScopeResolver behavior
            parseError.name = 'ScopeParseError';
            throw parseError;
          }
        }
      } catch (error) {
        const errorContext = actionErrorContextBuilder.buildErrorContext({
          error: error,
          actionDef: context.actionId ? { id: context.actionId } : null,
          actorId: context.actor?.id,
          phase: ERROR_PHASES.VALIDATION,
          trace: context.trace,
          additionalContext: {
            scopeName: scopeName,
            source: source,
            scopeExpression: scopeDefinition.expr,
          },
        });

        // Create enhanced error like UnifiedScopeResolver does
        const enhancedError = new Error(error.message);
        enhancedError.name = error.name;
        enhancedError.stack = error.stack;
        Object.assign(enhancedError, errorContext);

        return ActionResult.failure(enhancedError);
      }

      try {
        // Build actor with components
        const actorWithComponents = buildActorWithComponents(
          context.actor,
          entityManager,
          context.trace,
          source,
          logger
        );

        if (!actorWithComponents) {
          const error = new Error('Failed to load any components for actor');
          error.name = 'ComponentLoadError';
          const errorContext = actionErrorContextBuilder.buildErrorContext({
            error: error,
            actionDef: context.actionId ? { id: context.actionId } : null,
            actorId: context.actor?.id,
            phase: ERROR_PHASES.VALIDATION,
            trace: context.trace,
            additionalContext: {
              scopeName: scopeName,
              source: source,
            },
          });

          // Create enhanced error like UnifiedScopeResolver does
          const enhancedError = new Error(error.message);
          enhancedError.name = error.name;
          enhancedError.stack = error.stack;
          Object.assign(enhancedError, errorContext);

          return ActionResult.failure(enhancedError);
        }

        // Build runtime context
        // Use jsonLogicEval from actionContext if provided, otherwise fall back to the service
        const jsonLogicEval =
          context.actionContext?.jsonLogicEval || jsonLogicEvaluationService;

        const runtimeCtx = {
          entityManager: entityManager,
          jsonLogicEval: jsonLogicEval,
          logger: logger,
          actor: actorWithComponents,
          location: context.actorLocation,
        };

        // If the context has a target (for dependent scopes), include it
        if (context.target) {
          runtimeCtx.target = context.target;
        } else if (context.actionContext?.target) {
          // Also check actionContext for target
          runtimeCtx.target = context.actionContext.target;
        }

        // Resolve scope

        let resolvedIds;
        try {
          resolvedIds = scopeEngine.resolve(
            ast,
            actorWithComponents,
            runtimeCtx,
            context.trace
          );
        } catch (scopeError) {
          throw scopeError;
        }

        if (!resolvedIds || !(resolvedIds instanceof Set)) {
          throw new Error(
            `Scope engine returned invalid result: ${typeof resolvedIds}`
          );
        }

        return ActionResult.success(resolvedIds);
      } catch (error) {
        const errorContext = actionErrorContextBuilder.buildErrorContext({
          error: error,
          actionDef: context.actionId ? { id: context.actionId } : null,
          actorId: context.actor?.id,
          phase: ERROR_PHASES.SCOPE_RESOLUTION,
          trace: context.trace,
          additionalContext: {
            scopeName: scopeName,
            source: source,
            actorLocation: context.actorLocation,
          },
        });

        // Create enhanced error like UnifiedScopeResolver does
        const enhancedError = new Error(error.message);
        enhancedError.name = error.name;
        enhancedError.stack = error.stack;
        Object.assign(enhancedError, errorContext);

        return ActionResult.failure(enhancedError);
      }
    },

    resolveBatch(requests) {
      const results = new Map();
      const errors = [];

      for (const { scopeName, context } of requests) {
        const result = this.resolve(scopeName, context);
        if (result.success) {
          results.set(scopeName, result.value);
        } else {
          errors.push(...result.errors);
        }
      }

      if (errors.length > 0) {
        return ActionResult.failure(errors);
      }

      return ActionResult.success(results);
    },
  };
}

/**
 * Helper function to build actor with components
 *
 * @param actorEntity
 * @param entityManager
 * @param trace
 * @param source
 * @param logger
 */
function buildActorWithComponents(
  actorEntity,
  entityManager,
  trace,
  source,
  logger
) {
  if (!actorEntity) {
    return null;
  }

  // If actor already has components, return as-is
  if (
    actorEntity.components &&
    Object.keys(actorEntity.components).length > 0
  ) {
    return actorEntity;
  }

  // Try to load components from entity manager using the entity ID
  const entityInstance = entityManager.getEntityInstance(actorEntity.id);
  if (entityInstance && entityInstance.getAllComponents) {
    const components = entityInstance.getAllComponents();
    trace?.info(
      `buildActorWithComponents: Loaded ${Object.keys(components).length} components for entity ${actorEntity.id}`,
      source
    );
    if (components && Object.keys(components).length > 0) {
      return {
        ...actorEntity,
        id: actorEntity.id,
        components,
      };
    }
  } else {
    trace?.warn(
      `buildActorWithComponents: Could not get entity instance for ${actorEntity.id}`,
      source
    );
  }

  // If no component type IDs, create empty components
  if (!actorEntity.componentTypeIds?.length) {
    trace?.warn(
      `Actor entity ${actorEntity.id} has no components or componentTypeIds`,
      source
    );
    return {
      ...actorEntity,
      id: actorEntity.id,
      components: {},
    };
  }

  // Build components
  const components = {};
  const componentErrors = [];

  for (const componentTypeId of actorEntity.componentTypeIds) {
    try {
      const data = entityManager.getComponentData(
        actorEntity.id,
        componentTypeId
      );
      if (data) {
        components[componentTypeId] = data;
      }
    } catch (error) {
      // Log error and track it
      componentErrors.push({
        componentTypeId,
        error: error.message,
      });
      trace?.error(
        `Failed to load component ${componentTypeId}: ${error.message}`,
        source
      );
    }
  }

  // If all components failed to load, return null to indicate failure
  if (componentErrors.length > 0 && Object.keys(components).length === 0) {
    return null;
  }

  return {
    ...actorEntity,
    id: actorEntity.id,
    components,
  };
}

import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';

/**
 * Helper function to create TargetResolutionService with UnifiedScopeResolver
 * from old-style dependencies
 *
 * @param dependencies
 */
export function createTargetResolutionServiceWithMocks(dependencies) {
  // Create mock UnifiedScopeResolver
  const unifiedScopeResolver = createMockUnifiedScopeResolver(dependencies);

  // Create TargetResolutionService with new dependencies structure
  return new TargetResolutionService({
    unifiedScopeResolver,
    logger: dependencies.logger,
    serviceSetup: dependencies.serviceSetup,
  });
}
