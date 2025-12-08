/**
 * @file ScopeContextBuilder - Service for building scope evaluation contexts
 * @see IScopeContextBuilder.js
 * @see MultiTargetResolutionStage.js
 */

import { BaseService } from '../base/BaseService.js';
import { ServiceError, ServiceErrorCodes } from '../base/ServiceError.js';
import { validateDependency } from '../../../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../../../entities/entity.js').default} Entity
 * @typedef {import('../../../../interfaces/coreServices.js').IEntityManager} IEntityManager
 * @typedef {import('../../../../scopeDsl/utils/targetContextBuilder.js').default} TargetContextBuilder
 * @typedef {import('../../../tracing/traceContext.js').TraceContext} TraceContext
 * @typedef {import('../interfaces/IScopeContextBuilder.js').ScopeContext} ScopeContext
 * @typedef {import('../interfaces/IScopeContextBuilder.js').ResolvedTarget} ResolvedTarget
 * @typedef {import('../interfaces/IScopeContextBuilder.js').ContextBuildResult} ContextBuildResult
 * @typedef {import('../interfaces/IScopeContextBuilder.js').ValidationResult} ValidationResult
 */

/**
 * Service for building scope evaluation contexts for target resolution
 *
 * Provides:
 * - Context-aware scope building based on dependencies
 * - Primary target specialization for specific evaluation scenarios
 * - Context validation and completeness checking
 * - Integration with existing TargetContextBuilder
 *
 * Extracted from MultiTargetResolutionStage lines 579-597 and 610-644
 */
export class ScopeContextBuilder extends BaseService {
  #contextBuilder;
  #entityManager;

  /**
   * @param {object} deps
   * @param {TargetContextBuilder} deps.targetContextBuilder
   * @param {IEntityManager} deps.entityManager
   * @param {import('../../../../interfaces/coreServices.js').ILogger} deps.logger
   */
  constructor({ targetContextBuilder, entityManager, logger }) {
    super({ logger });

    validateDependency(targetContextBuilder, 'TargetContextBuilder', null, {
      requiredMethods: ['buildBaseContext', 'buildDependentContext'],
    });
    validateDependency(entityManager, 'IEntityManager', null, {
      requiredMethods: ['getEntityInstance'],
    });

    this.#contextBuilder = targetContextBuilder;
    this.#entityManager = entityManager;

    this.logOperation('initialized', {
      service: 'ScopeContextBuilder',
      contextBuilder: targetContextBuilder.constructor.name,
      entityManager: entityManager.constructor.name,
    });
  }

  /**
   * Build initial context for scope evaluation
   *
   * This maps to the IScopeContextBuilder interface method and delegates
   * to the extracted buildScopeContext logic.
   *
   * @param {Entity} actor - The acting entity
   * @param {object} actionContext - Action discovery context
   * @returns {ScopeContext} Initial evaluation context
   */
  buildInitialContext(actor, actionContext) {
    this.validateParams({ actor, actionContext }, ['actor', 'actionContext']);

    const locationId =
      actionContext.location?.id ||
      actor.getComponentData('core:position')?.locationId;

    // Build base context using TargetContextBuilder
    const baseContext = this.#contextBuilder.buildBaseContext(
      actor.id,
      locationId
    );

    this.logOperation('buildInitialContext', {
      actorId: actor.id,
      locationId,
      hasBaseContext: !!baseContext,
    });

    return baseContext;
  }

  /**
   * Build scope context for target resolution
   *
   * Extracted exact logic from MultiTargetResolutionStage lines 579-597
   *
   * @param {Entity} actor - Acting entity
   * @param {object} actionContext - Action context with location and other data
   * @param {object} resolvedTargets - Previously resolved targets
   * @param {object} targetDef - Target definition with scope and dependencies
   * @param {TraceContext} trace - Tracing context for debugging
   * @returns {object} Scope evaluation context
   */
  buildScopeContext(actor, actionContext, resolvedTargets, targetDef, trace) {
    this.validateParams({ actor, actionContext, resolvedTargets, targetDef }, [
      'actor',
      'actionContext',
      'resolvedTargets',
      'targetDef',
    ]);

    // Start with base context
    const baseContext = this.#contextBuilder.buildBaseContext(
      actor.id,
      actionContext.location?.id ||
        actor.getComponentData('core:position')?.locationId
    );

    // Preserve container if provided so ScopeEngine can resolve services like BodyGraphService
    if (actionContext?.container) {
      baseContext.container = actionContext.container;
    }

    // Add resolved targets if this is a dependent target
    if (targetDef.contextFrom || Object.keys(resolvedTargets).length > 0) {
      const dependentContext = this.#contextBuilder.buildDependentContext(
        baseContext,
        resolvedTargets,
        targetDef
      );

      this.logOperation('buildScopeContext', {
        actorId: actor.id,
        contextType: 'dependent',
        targetDefContextFrom: targetDef.contextFrom,
        resolvedTargetCount: Object.keys(resolvedTargets).length,
      });

      return dependentContext;
    }

    this.logOperation('buildScopeContext', {
      actorId: actor.id,
      contextType: 'base',
    });

    return baseContext;
  }

  /**
   * Build context for specific primary target
   *
   * Extracted exact logic from MultiTargetResolutionStage lines 610-644
   *
   * @param {Entity} actor - Acting entity
   * @param {object} actionContext - Action context
   * @param {object} resolvedTargets - All resolved targets
   * @param {object} specificPrimary - Specific primary target to contextualize
   * @param {object} targetDef - Target definition
   * @param {TraceContext} trace - Tracing context
   * @returns {object} Enhanced context with primary target
   */
  buildScopeContextForSpecificPrimary(
    actor,
    actionContext,
    resolvedTargets,
    specificPrimary,
    targetDef,
    trace
  ) {
    this.validateParams({ actor, actionContext, resolvedTargets, targetDef }, [
      'actor',
      'actionContext',
      'resolvedTargets',
      'targetDef',
    ]);
    // Note: specificPrimary can be null, so we don't validate it as required

    // Build base context using the ORIGINAL actor
    // This is critical because operators like isClosestLeftOccupant need
    // context.actor to refer to the entity performing the action, not the target
    const baseContext = this.#contextBuilder.buildBaseContext(
      actor.id,
      actionContext.location?.id ||
        actor.getComponentData('core:position')?.locationId
    );

    // Build context with the specific primary target
    const context = { ...baseContext };

    if (actionContext?.container) {
      context.container = actionContext.container;
    }

    // Add all resolved targets
    context.targets = { ...resolvedTargets };

    // Add the specific primary as the 'target' for scope evaluation
    // This allows operators to access the primary target (e.g., furniture)
    // while keeping the original actor in context.actor
    if (specificPrimary) {
      const entity = this.#entityManager.getEntityInstance(specificPrimary.id);
      if (entity) {
        context.target = {
          id: entity.id,
          components: entity.getAllComponents ? entity.getAllComponents() : {},
        };
      } else {
        this.logger.warn(
          'Failed to get entity for specific primary target in buildScopeContextForSpecificPrimary',
          {
            specificPrimaryId: specificPrimary.id,
            actorId: actor.id,
          }
        );
        if (context.target && context.target.id === actor.id) {
          delete context.target;
        }
      }
    } else if (context.target && context.target.id === actor.id) {
      // No specific primary resolved; avoid leaking actor as target for dependent scopes
      delete context.target;
    }

    this.logOperation('buildScopeContextForSpecificPrimary', {
      actorId: actor.id,
      specificPrimaryId: specificPrimary?.id,
      resolvedTargetCount: Object.keys(resolvedTargets).length,
      hasEntityTarget: !!context.target,
    });

    return context;
  }

  /**
   * Add resolved target to the evaluation context (IScopeContextBuilder interface)
   *
   * @param {ScopeContext} context - Current evaluation context
   * @param {string} targetKey - Key of the resolved target
   * @param {ResolvedTarget} resolvedTarget - The resolved target data
   * @returns {ScopeContext} Updated context with target added
   */
  addResolvedTarget(context, targetKey, resolvedTarget) {
    this.validateParams({ context, targetKey, resolvedTarget }, [
      'context',
      'targetKey',
      'resolvedTarget',
    ]);

    this.validateNonBlankString(targetKey, 'targetKey');

    const updatedContext = { ...context };
    if (!updatedContext.targets) {
      updatedContext.targets = {};
    }
    updatedContext.targets[targetKey] = resolvedTarget;

    this.logOperation('addResolvedTarget', {
      targetKey,
      targetId: resolvedTarget?.id,
    });

    return updatedContext;
  }

  /**
   * Build context for a target that depends on another target (IScopeContextBuilder interface)
   *
   * @param {ScopeContext} baseContext - Base evaluation context
   * @param {string} contextFromKey - Key of the target to use as context
   * @param {Object.<string, ResolvedTarget>} resolvedTargets - All resolved targets
   * @returns {ContextBuildResult} Result with built context or error
   */
  buildDependentContext(baseContext, contextFromKey, resolvedTargets) {
    this.validateParams({ baseContext, contextFromKey, resolvedTargets }, [
      'baseContext',
      'contextFromKey',
      'resolvedTargets',
    ]);

    this.validateNonBlankString(contextFromKey, 'contextFromKey');

    try {
      // Create target definition for delegation to TargetContextBuilder
      const targetDef = { contextFrom: contextFromKey };

      const context = this.#contextBuilder.buildDependentContext(
        baseContext,
        resolvedTargets,
        targetDef
      );

      this.logOperation('buildDependentContext', {
        contextFromKey,
        resolvedTargetCount: Object.keys(resolvedTargets).length,
        success: true,
      });

      return {
        success: true,
        context,
      };
    } catch (error) {
      this.logOperation(
        'buildDependentContext',
        {
          contextFromKey,
          error: error.message,
          success: false,
        },
        'error'
      );

      return {
        success: false,
        error: `Failed to build dependent context: ${error.message}`,
      };
    }
  }

  /**
   * Merge multiple contexts together (IScopeContextBuilder interface)
   *
   * @param {ScopeContext[]} contexts - Array of contexts to merge
   * @returns {ScopeContext} Merged context
   */
  mergeContexts(contexts) {
    this.validateParams({ contexts }, ['contexts']);

    if (!Array.isArray(contexts)) {
      this.throwError(
        'contexts must be an array',
        ServiceErrorCodes.VALIDATION_ERROR,
        { providedType: typeof contexts }
      );
    }

    if (contexts.length === 0) {
      this.logOperation('mergeContexts', {
        contextCount: 0,
        result: 'empty',
      });
      return {};
    }

    const merged = {};

    for (const context of contexts) {
      if (context && typeof context === 'object') {
        // Copy all properties except targets first
        const { targets, ...otherProps } = context;
        Object.assign(merged, otherProps);

        // Merge targets specifically to avoid overwriting
        if (targets) {
          if (!merged.targets) {
            merged.targets = {};
          }
          merged.targets = { ...merged.targets, ...targets };
        }
      }
    }

    this.logOperation('mergeContexts', {
      contextCount: contexts.length,
      mergedTargetCount: Object.keys(merged.targets || {}).length,
    });

    return merged;
  }

  /**
   * Validate context completeness (IScopeContextBuilder interface)
   *
   * Checks that the context has all required fields and proper structure
   * for scope evaluation.
   *
   * @param {ScopeContext} context - Context to validate
   * @returns {ValidationResult} Validation result with success flag and issues
   */
  validateContext(context) {
    const errors = [];
    const warnings = [];

    if (!context || typeof context !== 'object') {
      return {
        success: false,
        errors: ['Context must be a non-null object'],
        warnings: [],
      };
    }

    // Check required fields
    if (!context.actor) {
      errors.push('Context missing required actor field');
    } else if (!context.actor.id) {
      errors.push('Context actor missing id field');
    }

    if (!context.location) {
      warnings.push('Context missing location field');
    }

    // Validate targets structure if present
    if (context.targets && typeof context.targets !== 'object') {
      errors.push('Context targets must be an object');
    }

    // Validate target entity structure if present
    if (context.target) {
      if (!context.target.id) {
        errors.push('Context target missing id field');
      }
      if (!context.target.components) {
        warnings.push('Context target missing components field');
      }
    }

    const result = {
      success: errors.length === 0,
      errors,
      warnings,
    };

    this.logOperation(
      'validateContext',
      {
        success: result.success,
        errorCount: errors.length,
        warningCount: warnings.length,
      },
      'debug'
    );

    return result;
  }
}
